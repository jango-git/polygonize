//! Port of `src/domain/featureMap.ts` - downscaled grayscale + Sobel magnitude,
//! normalized to [0, 1], plus the bilinear sampler used by seeding.

const DEFAULT_MAX_DIMENSION: usize = 1024;

#[derive(Default)]
pub struct DensityMap {
    pub values: Vec<f32>,
    pub columns: usize,
    pub rows: usize,
}

/// Downscaled Sobel gradient field used by contour tracing. Cached after `set_image` so
/// re-tracing with different thresholds reuses it without re-deriving the gradients.
/// `columns`/`rows` are the (downscaled) field dimensions; `width`/`height` are the source
/// image size, so contour cell coordinates can be scaled back to image pixels.
#[derive(Default)]
pub struct Gradients {
    pub gradient_x: Vec<f32>,
    pub gradient_y: Vec<f32>,
    pub columns: usize,
    pub rows: usize,
    pub width: f64,
    pub height: f64,
}

impl DensityMap {
    /// Bilinear sample at normalized coordinates (u, v) in [0, 1].
    /// Mirrors `sampleDensity` in seeding.ts.
    pub fn sample(&self, u: f64, v: f64) -> f64 {
        if self.columns == 0 || self.rows == 0 {
            return 0.0;
        }
        let columns = self.columns as f64;
        let rows = self.rows as f64;
        let x = (u * (columns - 1.0)).clamp(0.0, columns - 1.0);
        let y = (v * (rows - 1.0)).clamp(0.0, rows - 1.0);
        let x0 = x.floor() as usize;
        let y0 = y.floor() as usize;
        let x1 = (x0 + 1).min(self.columns - 1);
        let y1 = (y0 + 1).min(self.rows - 1);
        let fx = x - x0 as f64;
        let fy = y - y0 as f64;
        let v00 = self.values[y0 * self.columns + x0] as f64;
        let v10 = self.values[y0 * self.columns + x1] as f64;
        let v01 = self.values[y1 * self.columns + x0] as f64;
        let v11 = self.values[y1 * self.columns + x1] as f64;
        v00 * (1.0 - fx) * (1.0 - fy)
            + v10 * fx * (1.0 - fy)
            + v01 * (1.0 - fx) * fy
            + v11 * fx * fy
    }
}

/// Build the edge-density map and the gradient field from one downscaled Sobel pass. The
/// density map keeps the gradient magnitude (drives the seeding radius); the gradient
/// field keeps the same `(gradient_x, gradient_y)` (its direction drives contour tracing). Both run at the
/// single downscaled resolution (`DEFAULT_MAX_DIMENSION`).
pub fn analyze_image(data: &[u8], width: usize, height: usize) -> (DensityMap, Gradients) {
    if width == 0 || height == 0 || data.len() < width * height * 4 {
        return (DensityMap::default(), Gradients::default());
    }

    let (gray, columns, rows) = downscale_to_gray(data, width, height);
    let (gradient_x, gradient_y) = compute_gradients(&gray, columns, rows);

    // Edge-density: gradient magnitude normalized to [0, 1].
    let mut values = vec![0.0f32; columns * rows];
    let mut max_magnitude = 0.0f64;
    for i in 0..columns * rows {
        let magnitude =
            ((gradient_x[i] * gradient_x[i] + gradient_y[i] * gradient_y[i]) as f64).sqrt();
        values[i] = magnitude as f32;
        if magnitude > max_magnitude {
            max_magnitude = magnitude;
        }
    }
    if max_magnitude > 0.0 {
        let inverse_max = 1.0 / max_magnitude as f32;
        for value in values.iter_mut() {
            *value *= inverse_max;
        }
    }
    let density = DensityMap {
        values,
        columns,
        rows,
    };

    let gradients = Gradients {
        gradient_x,
        gradient_y,
        columns,
        rows,
        width: width as f64,
        height: height as f64,
    };

    (density, gradients)
}

/// Downscale to grayscale by averaging each source block, with luminance normalized to
/// [0, 1]. (The density branch normalizes by its own max afterwards, so this uniform
/// scale leaves the density map unchanged.)
fn downscale_to_gray(data: &[u8], width: usize, height: usize) -> (Vec<f32>, usize, usize) {
    let max_dimension = DEFAULT_MAX_DIMENSION as f64;
    let scale = (max_dimension / width.max(height) as f64).min(1.0);
    let columns = (2.0_f64).max((width as f64 * scale).round()) as usize;
    let rows = (2.0_f64).max((height as f64 * scale).round()) as usize;

    let mut gray = vec![0.0f32; columns * rows];
    for row in 0..rows {
        let source_y_start = row * height / rows;
        let source_y_end = (source_y_start + 1).max((row + 1) * height / rows);
        for column in 0..columns {
            let source_x_start = column * width / columns;
            let source_x_end = (source_x_start + 1).max((column + 1) * width / columns);
            let mut sum = 0.0f64;
            let mut count = 0u32;
            for source_y in source_y_start..source_y_end {
                for source_x in source_x_start..source_x_end {
                    let offset = (source_y * width + source_x) * 4;
                    sum += 0.299 * data[offset] as f64
                        + 0.587 * data[offset + 1] as f64
                        + 0.114 * data[offset + 2] as f64;
                    count += 1;
                }
            }
            gray[row * columns + column] = if count > 0 {
                (sum / count as f64 / 255.0) as f32
            } else {
                0.0
            };
        }
    }

    (gray, columns, rows)
}

/// Sobel gradients `(Ix, Iy)` per cell over the grayscale map (clamped borders).
fn compute_gradients(gray: &[f32], columns: usize, rows: usize) -> (Vec<f32>, Vec<f32>) {
    let at = |x: isize, y: isize| -> f64 {
        let clamped_x = x.clamp(0, columns as isize - 1) as usize;
        let clamped_y = y.clamp(0, rows as isize - 1) as usize;
        gray[clamped_y * columns + clamped_x] as f64
    };

    let mut gradient_x = vec![0.0f32; columns * rows];
    let mut gradient_y = vec![0.0f32; columns * rows];
    for y in 0..rows as isize {
        for x in 0..columns as isize {
            let top_left = at(x - 1, y - 1);
            let top_center = at(x, y - 1);
            let top_right = at(x + 1, y - 1);
            let mid_left = at(x - 1, y);
            let mid_right = at(x + 1, y);
            let bottom_left = at(x - 1, y + 1);
            let bottom_center = at(x, y + 1);
            let bottom_right = at(x + 1, y + 1);
            let i = (y as usize) * columns + x as usize;
            gradient_x[i] = (top_right + 2.0 * mid_right + bottom_right
                - (top_left + 2.0 * mid_left + bottom_left)) as f32;
            gradient_y[i] = (bottom_left + 2.0 * bottom_center + bottom_right
                - (top_left + 2.0 * top_center + top_right)) as f32;
        }
    }

    (gradient_x, gradient_y)
}
