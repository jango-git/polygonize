use js_sys::{Float32Array, Uint32Array};
use wasm_bindgen::prelude::*;

mod rng;
mod seeding;
mod sobel;
mod triangulate;

use sobel::DensityMap;

thread_local! {
    static STATE: std::cell::RefCell<State> = std::cell::RefCell::new(State::default());
}

#[derive(Default)]
struct State {
    density: Option<DensityMap>,
    /// Cached interior point positions, reused while only modifiers change.
    base_interior: Option<seeding::BaseInterior>,
}

/// Result of [`generate`]: the freshly generated points (border + interior) and the
/// triangle index triples over the combined point set (`modifiers ++ generated`).
#[wasm_bindgen]
pub struct GenerateResult {
    generated_xy: Vec<f32>,
    triangles: Vec<u32>,
    border_count: u32,
}

#[wasm_bindgen]
impl GenerateResult {
    #[wasm_bindgen(getter)]
    pub fn generated_xy(&self) -> Float32Array {
        Float32Array::from(self.generated_xy.as_slice())
    }

    #[wasm_bindgen(getter)]
    pub fn triangles(&self) -> Uint32Array {
        Uint32Array::from(self.triangles.as_slice())
    }

    /// Number of leading points in `generated_xy` that are border nodes (the rest are
    /// interior). Lets JS tag point origin without reordering the array.
    #[wasm_bindgen(getter)]
    pub fn border_count(&self) -> u32 {
        self.border_count
    }
}

/// Initialize panic hooks (debug builds only). Safe to call multiple times.
#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "debug")]
    console_error_panic_hook::set_once();
}

/// Compute and cache the Sobel edge-density map for the given RGBA image.
#[wasm_bindgen]
pub fn set_image(rgba: &[u8], width: u32, height: u32) {
    let density = sobel::compute_edge_density(rgba, width as usize, height as usize);
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.density = Some(density);
        s.base_interior = None;
    });
}

/// Triangulate a bare point set with constraint edges (no seeding). Used when there
/// is no image, so only modifier points exist. Returns triangle index triples.
#[wasm_bindgen]
pub fn triangulate_only(points_xy: &[f32], edges: &[u32]) -> Uint32Array {
    let count = points_xy.len() / 2;
    let tris = triangulate::triangulate(points_xy, &[], edges, count);
    Uint32Array::from(tris.as_slice())
}

/// Drop cached density + interior (image cleared or replaced).
#[wasm_bindgen]
pub fn reset_image() {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.density = None;
        s.base_interior = None;
    });
}

/// Generate interior points (Bridson) and triangulate the union of modifier points and
/// generated points with the given constraint edges (indices into the modifier block).
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn generate(
    modifier_xy: &[f32],
    edges: &[u32],
    seed: u32,
    border_per_side: u32,
    min_radius: f32,
    max_radius: f32,
    img_width: f32,
    img_height: f32,
) -> GenerateResult {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        let density = s.density.take().unwrap_or_default();

        let (generated, border_count) = seeding::generate_seed_points(
            img_width,
            img_height,
            border_per_side,
            min_radius,
            max_radius,
            seed,
            modifier_xy,
            &density,
            &mut s.base_interior,
        );

        s.density = Some(density);

        let modifier_count = modifier_xy.len() / 2;
        let triangles = triangulate::triangulate(modifier_xy, &generated, edges, modifier_count);

        GenerateResult {
            generated_xy: generated,
            triangles,
            border_count: border_count as u32,
        }
    })
}
