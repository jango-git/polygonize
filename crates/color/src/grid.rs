//! Builds the spatial color-lookup grid: samples every triangle's color, bins triangle
//! centroids into a uniform grid, and packs the result as CSR (`cell_index` start/count
//! pairs + a flat `entries` array). A direct port of `computeGrid` from the former
//! `colorWorker.ts`.

use crate::sampling::{barycentric_samples, sample_triangle_color, Image, Strategy};

/// Packed lookup grid. `entries` holds `[cx, cy, r, g, b]` per triangle, grouped by cell;
/// `cell_index` holds `[start, count]` per cell into `entries`.
pub struct Grid {
    pub cols: u32,
    pub rows: u32,
    pub cell_w: f32,
    pub cell_h: f32,
    pub entries: Vec<f32>,
    pub cell_index: Vec<i32>,
}

pub fn compute_grid(
    image: Option<&Image>,
    coordinates: &[f64],
    triangle_count: usize,
    samples_per_triangle: u32,
    strategy: Strategy,
) -> Grid {
    let sample_count = (samples_per_triangle as usize).max(1);

    let (image_width, image_height) = match image {
        Some(image) => (image.width as f64, image.height as f64),
        None => (0.0, 0.0),
    };

    // No image (or empty canvas): nothing to sample. Return a degenerate 1x1 grid so the
    // lookup on the main thread stays well-formed. This path does not occur in practice.
    if image_width <= 0.0 || image_height <= 0.0 {
        return Grid {
            cols: 1,
            rows: 1,
            cell_w: 1.0,
            cell_h: 1.0,
            entries: Vec::new(),
            cell_index: vec![0, 0],
        };
    }

    let cell_size = if triangle_count > 0 {
        (image_width * image_height / triangle_count as f64).sqrt()
    } else {
        64.0
    };
    let columns = ((image_width / cell_size).ceil() as usize).max(1);
    let rows = ((image_height / cell_size).ceil() as usize).max(1);
    let cell_width = image_width / columns as f64;
    let cell_height = image_height / rows as f64;
    let cell_count = columns * rows;

    let samples = barycentric_samples(sample_count);
    let mut red_buffer = vec![0_u8; sample_count];
    let mut green_buffer = vec![0_u8; sample_count];
    let mut blue_buffer = vec![0_u8; sample_count];

    let mut centroids = vec![0.0_f64; triangle_count * 2];
    let mut triangle_colors = vec![0_u8; triangle_count * 3];
    let mut triangles_per_cell = vec![0_i32; cell_count];

    for triangle_index in 0..triangle_count {
        let offset = triangle_index * 6;
        let ax = coordinates[offset];
        let ay = coordinates[offset + 1];
        let bx = coordinates[offset + 2];
        let by = coordinates[offset + 3];
        let cx = coordinates[offset + 4];
        let cy = coordinates[offset + 5];

        let centroid_x = (ax + bx + cx) / 3.0;
        let centroid_y = (ay + by + cy) / 3.0;
        centroids[triangle_index * 2] = centroid_x;
        centroids[triangle_index * 2 + 1] = centroid_y;

        let (red, green, blue) = sample_triangle_color(
            image,
            ax,
            ay,
            bx,
            by,
            cx,
            cy,
            sample_count,
            strategy,
            &samples,
            &mut red_buffer,
            &mut green_buffer,
            &mut blue_buffer,
        );
        triangle_colors[triangle_index * 3] = red;
        triangle_colors[triangle_index * 3 + 1] = green;
        triangle_colors[triangle_index * 3 + 2] = blue;

        let column = ((centroid_x / cell_width).floor() as i64).min(columns as i64 - 1) as usize;
        let row = ((centroid_y / cell_height).floor() as i64).min(rows as i64 - 1) as usize;
        triangles_per_cell[row * columns + column] += 1;
    }

    let mut cell_index = vec![0_i32; cell_count * 2];
    let mut running_offset = 0_i32;
    for cell in 0..cell_count {
        cell_index[cell * 2] = running_offset;
        cell_index[cell * 2 + 1] = triangles_per_cell[cell];
        running_offset += triangles_per_cell[cell];
    }

    let mut entries = vec![0.0_f32; triangle_count * 5];
    let mut write_cursor = vec![0_i32; cell_count];

    for triangle_index in 0..triangle_count {
        let centroid_x = centroids[triangle_index * 2];
        let centroid_y = centroids[triangle_index * 2 + 1];
        let column = ((centroid_x / cell_width).floor() as i64).min(columns as i64 - 1) as usize;
        let row = ((centroid_y / cell_height).floor() as i64).min(rows as i64 - 1) as usize;
        let cell = row * columns + column;

        let entry_index = (cell_index[cell * 2] + write_cursor[cell]) as usize;
        write_cursor[cell] += 1;

        let entry_offset = entry_index * 5;
        entries[entry_offset] = centroid_x as f32;
        entries[entry_offset + 1] = centroid_y as f32;
        entries[entry_offset + 2] = triangle_colors[triangle_index * 3] as f32;
        entries[entry_offset + 3] = triangle_colors[triangle_index * 3 + 1] as f32;
        entries[entry_offset + 4] = triangle_colors[triangle_index * 3 + 2] as f32;
    }

    Grid {
        cols: columns as u32,
        rows: rows as u32,
        cell_w: cell_width as f32,
        cell_h: cell_height as f32,
        entries,
        cell_index,
    }
}
