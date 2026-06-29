//! Port of `src/domain/featureMap.ts` - downscaled grayscale + Sobel magnitude,
//! normalized to [0, 1], plus the bilinear sampler used by seeding.

const DEFAULT_MAX_DIM: usize = 1024;

#[derive(Default)]
pub struct DensityMap {
    pub values: Vec<f32>,
    pub cols: usize,
    pub rows: usize,
}

/// Downscaled Sobel gradient field used by contour tracing. Cached after `set_image` so
/// re-tracing with different thresholds reuses it without re-deriving the gradients.
/// `cols`/`rows` are the (downscaled) field dimensions; `width`/`height` are the source
/// image size, so contour cell coordinates can be scaled back to image pixels.
#[derive(Default)]
pub struct Gradients {
    pub gx: Vec<f32>,
    pub gy: Vec<f32>,
    pub cols: usize,
    pub rows: usize,
    pub width: f64,
    pub height: f64,
}

impl DensityMap {
    /// Bilinear sample at normalized coordinates (u, v) in [0, 1].
    /// Mirrors `sampleDensity` in seeding.ts.
    pub fn sample(&self, u: f64, v: f64) -> f64 {
        if self.cols == 0 || self.rows == 0 {
            return 0.0;
        }
        let cols = self.cols as f64;
        let rows = self.rows as f64;
        let x = (u * (cols - 1.0)).clamp(0.0, cols - 1.0);
        let y = (v * (rows - 1.0)).clamp(0.0, rows - 1.0);
        let x0 = x.floor() as usize;
        let y0 = y.floor() as usize;
        let x1 = (x0 + 1).min(self.cols - 1);
        let y1 = (y0 + 1).min(self.rows - 1);
        let fx = x - x0 as f64;
        let fy = y - y0 as f64;
        let v00 = self.values[y0 * self.cols + x0] as f64;
        let v10 = self.values[y0 * self.cols + x1] as f64;
        let v01 = self.values[y1 * self.cols + x0] as f64;
        let v11 = self.values[y1 * self.cols + x1] as f64;
        v00 * (1.0 - fx) * (1.0 - fy)
            + v10 * fx * (1.0 - fy)
            + v01 * (1.0 - fx) * fy
            + v11 * fx * fy
    }
}

/// Build the edge-density map and the gradient field from one downscaled Sobel pass. The
/// density map keeps the gradient magnitude (drives the seeding radius); the gradient
/// field keeps the same `(gx, gy)` (its direction drives contour tracing). Both run at the
/// single downscaled resolution (`DEFAULT_MAX_DIM`).
pub fn analyze_image(data: &[u8], width: usize, height: usize) -> (DensityMap, Gradients) {
    if width == 0 || height == 0 || data.len() < width * height * 4 {
        return (DensityMap::default(), Gradients::default());
    }

    let (gray, cols, rows) = downscale_to_gray(data, width, height);
    let (gx, gy) = compute_gradients(&gray, cols, rows);

    // Edge-density: gradient magnitude normalized to [0, 1].
    let mut values = vec![0.0f32; cols * rows];
    let mut max = 0.0f64;
    for i in 0..cols * rows {
        let mag = ((gx[i] * gx[i] + gy[i] * gy[i]) as f64).sqrt();
        values[i] = mag as f32;
        if mag > max {
            max = mag;
        }
    }
    if max > 0.0 {
        let inv = 1.0 / max as f32;
        for v in values.iter_mut() {
            *v *= inv;
        }
    }
    let density = DensityMap {
        values,
        cols,
        rows,
    };

    let gradients = Gradients {
        gx,
        gy,
        cols,
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
    let max_dim = DEFAULT_MAX_DIM as f64;
    let scale = (max_dim / width.max(height) as f64).min(1.0);
    let cols = (2.0_f64).max((width as f64 * scale).round()) as usize;
    let rows = (2.0_f64).max((height as f64 * scale).round()) as usize;

    let mut gray = vec![0.0f32; cols * rows];
    for gy in 0..rows {
        let sy0 = gy * height / rows;
        let sy1 = (sy0 + 1).max((gy + 1) * height / rows);
        for gx in 0..cols {
            let sx0 = gx * width / cols;
            let sx1 = (sx0 + 1).max((gx + 1) * width / cols);
            let mut sum = 0.0f64;
            let mut n = 0u32;
            for sy in sy0..sy1 {
                for sx in sx0..sx1 {
                    let idx = (sy * width + sx) * 4;
                    sum += 0.299 * data[idx] as f64
                        + 0.587 * data[idx + 1] as f64
                        + 0.114 * data[idx + 2] as f64;
                    n += 1;
                }
            }
            gray[gy * cols + gx] = if n > 0 { (sum / n as f64 / 255.0) as f32 } else { 0.0 };
        }
    }

    (gray, cols, rows)
}

/// Sobel gradients `(Ix, Iy)` per cell over the grayscale map (clamped borders).
fn compute_gradients(gray: &[f32], cols: usize, rows: usize) -> (Vec<f32>, Vec<f32>) {
    let at = |x: isize, y: isize| -> f64 {
        let cx = x.clamp(0, cols as isize - 1) as usize;
        let cy = y.clamp(0, rows as isize - 1) as usize;
        gray[cy * cols + cx] as f64
    };

    let mut gx = vec![0.0f32; cols * rows];
    let mut gy = vec![0.0f32; cols * rows];
    for y in 0..rows as isize {
        for x in 0..cols as isize {
            let tl = at(x - 1, y - 1);
            let tc = at(x, y - 1);
            let tr = at(x + 1, y - 1);
            let ml = at(x - 1, y);
            let mr = at(x + 1, y);
            let bl = at(x - 1, y + 1);
            let bc = at(x, y + 1);
            let br = at(x + 1, y + 1);
            let i = (y as usize) * cols + x as usize;
            gx[i] = (tr + 2.0 * mr + br - (tl + 2.0 * ml + bl)) as f32;
            gy[i] = (bl + 2.0 * bc + br - (tl + 2.0 * tc + tr)) as f32;
        }
    }

    (gx, gy)
}
