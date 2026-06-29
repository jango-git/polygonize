//! Port of `src/domain/seeding.ts` - variable-radius Poisson-disk (Bridson) sampling
//! driven by the Sobel density map, with a reusable base-interior cache.

use crate::rng::Rng;
use crate::sobel::DensityMap;
use std::collections::HashSet;
use std::f64::consts::{FRAC_PI_2, PI, SQRT_2};

const MAX_CANDIDATES: usize = 30;
/// Candidate budget for the per-frame fill grow. The cached base field already
/// covers the bulk of the area, so the fill only patches the band around modifier
/// clouds - far fewer samples suffice there than for the from-scratch base field.
const FILL_MAX_CANDIDATES: usize = 12;
const MAX_INTERIOR: usize = 20_000;
const FILL_SEED_OFFSET: u32 = 0x9e3779b9;

/// Cached interior positions, reused while only modifiers change (image, seed and
/// radii stay the same). Cleared on `set_image`.
pub struct BaseInterior {
    width: f64,
    height: f64,
    seed: u32,
    min_radius: f64,
    max_radius: f64,
    border_per_side: u32,
    positions: Vec<(f64, f64)>,
}

struct Field<'a> {
    width: f64,
    height: f64,
    min_radius: f64,
    max_radius: f64,
    cell_size: f64,
    grid_columns: usize,
    grid_rows: usize,
    grid: Vec<i32>,
    nodes_x: Vec<f64>,
    nodes_y: Vec<f64>,
    nodes_output: Vec<bool>,
    density: &'a DensityMap,
    rng: Rng,
}

impl<'a> Field<'a> {
    fn new(
        width: f64,
        height: f64,
        min_radius: f64,
        max_radius: f64,
        density: &'a DensityMap,
        rng: Rng,
    ) -> Self {
        let cell_size = min_radius / SQRT_2;
        let grid_columns = (width / cell_size).ceil() as usize + 2;
        let grid_rows = (height / cell_size).ceil() as usize + 2;
        let grid = vec![-1i32; grid_columns * grid_rows];
        Field {
            width,
            height,
            min_radius,
            max_radius,
            cell_size,
            grid_columns,
            grid_rows,
            grid,
            nodes_x: Vec::new(),
            nodes_y: Vec::new(),
            nodes_output: Vec::new(),
            density,
            rng,
        }
    }

    fn node_count(&self) -> usize {
        self.nodes_x.len()
    }

    fn radius_at(&self, x: f64, y: f64) -> f64 {
        let edge = self.density.sample(x / self.width, y / self.height);
        self.min_radius + (1.0 - edge) * (self.max_radius - self.min_radius)
    }

    fn insert_node(&mut self, x: f64, y: f64, output: bool) -> usize {
        let index = self.nodes_x.len();
        self.nodes_x.push(x);
        self.nodes_y.push(y);
        self.nodes_output.push(output);
        let col = (x / self.cell_size).floor() as isize;
        let row = (y / self.cell_size).floor() as isize;
        let cell = row * self.grid_columns as isize + col;
        if cell >= 0 && (cell as usize) < self.grid.len() {
            self.grid[cell as usize] = index as i32;
        }
        index
    }

    fn too_close(&self, x: f64, y: f64, radius: f64) -> bool {
        let col = (x / self.cell_size).floor() as isize;
        let row = (y / self.cell_size).floor() as isize;
        let radius_sq = radius * radius;
        // The rejection test is `dist < radius` (the candidate's own radius), so we
        // only need to scan cells within `radius` - not the global `max_radius`.
        // `ceil(radius/cell_size)` is the exact bound (same formula the old global
        // `search_cells` used with `max_radius`), so results are identical, just
        // far fewer cells scanned in dense (small-radius) regions.
        let search = (radius / self.cell_size).ceil() as isize;
        for d_row in -search..=search {
            let n_row = row + d_row;
            if n_row < 0 || n_row >= self.grid_rows as isize {
                continue;
            }
            for d_col in -search..=search {
                let n_col = col + d_col;
                if n_col < 0 || n_col >= self.grid_columns as isize {
                    continue;
                }
                let occupant = self.grid[(n_row * self.grid_columns as isize + n_col) as usize];
                if occupant < 0 {
                    continue;
                }
                let oi = occupant as usize;
                let dx = self.nodes_x[oi] - x;
                let dy = self.nodes_y[oi] - y;
                if dx * dx + dy * dy < radius_sq {
                    return true;
                }
            }
        }
        false
    }

    /// Allowed candidate-angle interval `(start, span)` for an origin. Border seed
    /// points sit exactly on a canvas edge/corner, so ~half (edge) or ~3/4 (corner) of
    /// the full circle points off-canvas and every candidate there is wasted on the
    /// bounds check. Restricting the angle to the inward half/quarter-plane removes
    /// that waste. Interior origins get the full circle.
    fn angle_range(&self, ox: f64, oy: f64) -> (f64, f64) {
        let on_left = ox <= 0.0;
        let on_right = ox >= self.width;
        let on_top = oy <= 0.0;
        let on_bottom = oy >= self.height;
        match (on_left, on_right, on_top, on_bottom) {
            (true, false, false, false) => (-FRAC_PI_2, PI), // left edge -> inward +x
            (false, true, false, false) => (FRAC_PI_2, PI),  // right edge -> inward -x
            (false, false, true, false) => (0.0, PI),        // top edge -> inward +y
            (false, false, false, true) => (PI, PI),         // bottom edge -> inward -y
            (true, false, true, false) => (0.0, FRAC_PI_2),  // top-left corner
            (false, true, true, false) => (FRAC_PI_2, FRAC_PI_2), // top-right
            (false, true, false, true) => (PI, FRAC_PI_2),   // bottom-right
            (true, false, false, true) => (PI + FRAC_PI_2, FRAC_PI_2), // bottom-left
            _ => (0.0, PI * 2.0),                             // interior (or degenerate)
        }
    }

    /// Like `too_close`, but in one neighborhood scan also reports the nearest
    /// occupant whose index is a modifier (in `[mod_lo, mod_hi)`) within `radius`.
    /// Used by the reuse loop for hole-targeted grow seeding.
    fn probe(
        &self,
        x: f64,
        y: f64,
        radius: f64,
        mod_lo: usize,
        mod_hi: usize,
    ) -> (bool, Option<usize>) {
        let col = (x / self.cell_size).floor() as isize;
        let row = (y / self.cell_size).floor() as isize;
        let radius_sq = radius * radius;
        let search = (radius / self.cell_size).ceil() as isize;
        let mut collided = false;
        let mut best_modifier: Option<usize> = None;
        let mut best_d2 = f64::INFINITY;
        for d_row in -search..=search {
            let n_row = row + d_row;
            if n_row < 0 || n_row >= self.grid_rows as isize {
                continue;
            }
            for d_col in -search..=search {
                let n_col = col + d_col;
                if n_col < 0 || n_col >= self.grid_columns as isize {
                    continue;
                }
                let occupant = self.grid[(n_row * self.grid_columns as isize + n_col) as usize];
                if occupant < 0 {
                    continue;
                }
                let oi = occupant as usize;
                let dx = self.nodes_x[oi] - x;
                let dy = self.nodes_y[oi] - y;
                let d2 = dx * dx + dy * dy;
                if d2 < radius_sq {
                    collided = true;
                    if oi >= mod_lo && oi < mod_hi && d2 < best_d2 {
                        best_d2 = d2;
                        best_modifier = Some(oi);
                    }
                }
            }
        }
        (collided, best_modifier)
    }

    fn grow(&mut self, initial_active: Vec<usize>, limit: usize, max_candidates: usize) {
        let mut active = initial_active;
        let mut placed = 0;

        while !active.is_empty() && placed < limit {
            let active_index = (self.rng.next() * active.len() as f64).floor() as usize;
            let oi = active[active_index];
            let ox = self.nodes_x[oi];
            let oy = self.nodes_y[oi];
            let origin_radius = self.radius_at(ox, oy);
            let (angle_start, angle_span) = self.angle_range(ox, oy);

            let mut placed_from_origin = false;
            for _ in 0..max_candidates {
                let angle = angle_start + self.rng.next() * angle_span;
                let distance = origin_radius + self.rng.next() * origin_radius;
                let cx = ox + angle.cos() * distance;
                let cy = oy + angle.sin() * distance;

                if cx < 0.0 || cx > self.width || cy < 0.0 || cy > self.height {
                    continue;
                }

                let candidate_radius = self.radius_at(cx, cy);
                if self.too_close(cx, cy, candidate_radius) {
                    continue;
                }

                let new_index = self.insert_node(cx, cy, true);
                active.push(new_index);
                placed += 1;
                placed_from_origin = true;
                break;
            }

            if !placed_from_origin {
                active[active_index] = active[active.len() - 1];
                active.pop();
            }
        }
    }
}

fn append_border_nodes(field: &mut Field, border_per_side: u32) -> usize {
    let w = field.width;
    let h = field.height;
    field.insert_node(0.0, 0.0, true);
    field.insert_node(w, 0.0, true);
    field.insert_node(w, h, true);
    field.insert_node(0.0, h, true);

    let denom = (border_per_side + 1) as f64;
    for index in 1..=border_per_side {
        let i = index as f64;
        let off_x = w * i / denom;
        let off_y = h * i / denom;
        field.insert_node(off_x, 0.0, true);
        field.insert_node(off_x, h, true);
        field.insert_node(0.0, off_y, true);
        field.insert_node(w, off_y, true);
    }

    field.node_count()
}

#[allow(clippy::float_cmp, clippy::too_many_arguments)]
fn get_base_interior<'a>(
    width: f64,
    height: f64,
    border_per_side: u32,
    seed: u32,
    min_radius: f64,
    max_radius: f64,
    density: &DensityMap,
    cache: &'a mut Option<BaseInterior>,
) -> &'a [(f64, f64)] {
    let hit = matches!(cache, Some(c)
        if c.width == width
            && c.height == height
            && c.seed == seed
            && c.min_radius == min_radius
            && c.max_radius == max_radius
            && c.border_per_side == border_per_side);

    if !hit {
        let base_rng = Rng::new(seed);
        let mut field = Field::new(width, height, min_radius, max_radius, density, base_rng);
        let border_count = append_border_nodes(&mut field, border_per_side);
        let origins: Vec<usize> = (0..border_count).collect();
        field.grow(origins, MAX_INTERIOR, MAX_CANDIDATES);

        let mut positions = Vec::with_capacity(field.node_count() - border_count);
        for idx in border_count..field.node_count() {
            positions.push((field.nodes_x[idx], field.nodes_y[idx]));
        }

        *cache = Some(BaseInterior {
            width,
            height,
            seed,
            min_radius,
            max_radius,
            border_per_side,
            positions,
        });
    }

    cache.as_ref().unwrap().positions.as_slice()
}

#[allow(clippy::too_many_arguments)]
pub fn generate_seed_points(
    width_f: f32,
    height_f: f32,
    border_per_side: u32,
    min_radius_f: f32,
    max_radius_f: f32,
    seed: u32,
    modifier_xy: &[f32],
    density: &DensityMap,
    base_interior: &mut Option<BaseInterior>,
) -> (Vec<f32>, usize) {
    let width = width_f as f64;
    let height = height_f as f64;
    let min_radius = (min_radius_f as f64).max(1.0);
    let max_radius = (max_radius_f as f64).max(min_radius + 1.0);

    let positions = get_base_interior(
        width,
        height,
        border_per_side,
        seed,
        min_radius,
        max_radius,
        density,
        base_interior,
    )
    .to_vec();

    let fill_rng = Rng::new(seed ^ FILL_SEED_OFFSET);
    let mut field = Field::new(width, height, min_radius, max_radius, density, fill_rng);
    // Border nodes are inserted first and are all output=true, so they form the leading
    // `border_count` entries of `out` below. JS uses this to tag their origin.
    let border_count = append_border_nodes(&mut field, border_per_side);

    // Every modifier point is inserted as an obstacle (output=false) so the field
    // can't grow into the interior of dense clouds.
    let modifier_start = field.node_count();
    let mut i = 0;
    while i + 1 < modifier_xy.len() {
        field.insert_node(modifier_xy[i] as f64, modifier_xy[i + 1] as f64, false);
        i += 2;
    }
    let modifier_end = field.node_count();

    // Reuse cached base points that don't collide with a modifier. A *dropped* base
    // point marks a hole punched by a cloud - exactly where fill is needed. We seed
    // growth only from the modifiers bordering those holes (hole-targeted), instead of
    // from every modifier: origins with no free space around them (the common case in
    // saturated dense zones) never enter the active set and never burn candidate sweeps.
    // Growth is self-propagating, so one origin per hole-region suffices.
    let mut active_origins: Vec<usize> = Vec::new();
    let mut seen_origins: HashSet<usize> = HashSet::new();
    for &(cx, cy) in positions.iter() {
        let candidate_radius = field.radius_at(cx, cy);
        let (collided, near_modifier) =
            field.probe(cx, cy, candidate_radius, modifier_start, modifier_end);
        if collided {
            if let Some(mi) = near_modifier {
                if seen_origins.insert(mi) {
                    active_origins.push(mi);
                }
            }
        } else {
            field.insert_node(cx, cy, true);
        }
    }

    field.grow(active_origins, MAX_INTERIOR, FILL_MAX_CANDIDATES);

    let mut out = Vec::new();
    for idx in 0..field.node_count() {
        if field.nodes_output[idx] {
            out.push(field.nodes_x[idx] as f32);
            out.push(field.nodes_y[idx] as f32);
        }
    }

    (out, border_count)
}
