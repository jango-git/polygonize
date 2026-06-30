//! Per-triangle color sampling. A direct port of the sampler in the former
//! `colorWorker.ts` - same Halton low-discrepancy barycentric samples and the same
//! average/median reduction, so the produced colors are bit-for-bit identical.

/// Average (0) or median (1) reduction of the sampled pixels.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Strategy {
    Average,
    Median,
}

impl Strategy {
    pub fn from_u8(value: u8) -> Self {
        if value == 1 {
            Strategy::Median
        } else {
            Strategy::Average
        }
    }
}

/// Cached RGBA image the samples are read from. `data` is row-major RGBA bytes.
pub struct Image {
    pub data: Vec<u8>,
    pub width: usize,
    pub height: usize,
}

/// Precompute `sample_count` barycentric (b, c) weight pairs, folded into the lower
/// triangle so every sample lands inside the unit triangle. Returned flat as
/// `[b0, c0, b1, c1, ...]`.
pub fn barycentric_samples(sample_count: usize) -> Vec<f64> {
    let mut samples = vec![0.0_f64; sample_count * 2];
    for index in 0..sample_count {
        let mut weight_towards_b = halton(index + 1, 2);
        let mut weight_towards_c = halton(index + 1, 3);
        if weight_towards_b + weight_towards_c > 1.0 {
            weight_towards_b = 1.0 - weight_towards_b;
            weight_towards_c = 1.0 - weight_towards_c;
        }
        samples[index * 2] = weight_towards_b;
        samples[index * 2 + 1] = weight_towards_c;
    }
    samples
}

/// Sample one triangle's color. `samples` are the precomputed barycentric weights; the
/// `*_buffer` scratch slices (length >= `sample_count`) are reused across calls to avoid
/// per-triangle allocation. Returns `(r, g, b)`.
#[allow(clippy::too_many_arguments)]
pub fn sample_triangle_color(
    image: Option<&Image>,
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    cx: f64,
    cy: f64,
    sample_count: usize,
    strategy: Strategy,
    samples: &[f64],
    red_buffer: &mut [u8],
    green_buffer: &mut [u8],
    blue_buffer: &mut [u8],
) -> (u8, u8, u8) {
    let image = match image {
        Some(image) => image,
        None => return (128, 128, 128),
    };

    for sample_index in 0..sample_count {
        let weight_towards_b = samples[sample_index * 2];
        let weight_towards_c = samples[sample_index * 2 + 1];
        let sample_x = ax + weight_towards_b * (bx - ax) + weight_towards_c * (cx - ax);
        let sample_y = ay + weight_towards_b * (by - ay) + weight_towards_c * (cy - ay);
        let pixel_x = clamp(sample_x.floor() as i64, 0, image.width as i64 - 1) as usize;
        let pixel_y = clamp(sample_y.floor() as i64, 0, image.height as i64 - 1) as usize;
        let pixel_offset = (pixel_y * image.width + pixel_x) * 4;
        red_buffer[sample_index] = image.data[pixel_offset];
        green_buffer[sample_index] = image.data[pixel_offset + 1];
        blue_buffer[sample_index] = image.data[pixel_offset + 2];
    }

    match strategy {
        Strategy::Median => (
            median(red_buffer, sample_count),
            median(green_buffer, sample_count),
            median(blue_buffer, sample_count),
        ),
        Strategy::Average => (
            mean(red_buffer, sample_count),
            mean(green_buffer, sample_count),
            mean(blue_buffer, sample_count),
        ),
    }
}

fn halton(mut index: usize, base: usize) -> f64 {
    let mut fraction = 1.0_f64;
    let mut result = 0.0_f64;
    while index > 0 {
        fraction /= base as f64;
        result += fraction * (index % base) as f64;
        index /= base;
    }
    result
}

fn mean(values: &[u8], count: usize) -> u8 {
    let mut sum = 0.0_f64;
    for &value in &values[..count] {
        sum += value as f64;
    }
    (sum / count as f64).round() as u8
}

fn median(values: &mut [u8], count: usize) -> u8 {
    let slice = &mut values[..count];
    slice.sort_unstable();
    let middle = count >> 1;
    if count % 2 == 1 {
        slice[middle]
    } else {
        ((slice[middle - 1] as f64 + slice[middle] as f64) / 2.0).round() as u8
    }
}

fn clamp(value: i64, low: i64, high: i64) -> i64 {
    if value < low {
        low
    } else if value > high {
        high
    } else {
        value
    }
}
