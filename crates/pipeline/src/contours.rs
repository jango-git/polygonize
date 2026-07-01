//! Canny-style contour tracing over the cached Sobel gradient field, returning simplified
//! polylines. Feeds the editable "Traced contours" path modifiers: magnitude ->
//! non-maximum suppression -> hysteresis double-threshold -> link into chains ->
//! Douglas-Peucker simplify. One-shot per image (not per frame).

use crate::sobel::Gradients;

pub struct Polyline {
    pub points: Vec<(f32, f32)>,
    pub closed: bool,
}

/// Trace contours. `low`/`high` are hysteresis thresholds as fractions of the maximum
/// gradient magnitude; `simplify_px` is the Douglas-Peucker tolerance in pixels;
/// `min_points` drops polylines simplified below that many vertices; `min_length` drops
/// polylines whose arc length (pixels) is below it - this removes the swarm of tiny but
/// valid contours (e.g. beard hairs) while keeping long ones.
pub fn trace(
    gradients: &Gradients,
    low: f32,
    high: f32,
    simplify_px: f64,
    min_points: usize,
    min_length: f64,
) -> Vec<Polyline> {
    let (columns, rows) = (gradients.columns, gradients.rows);
    if columns < 3 || rows < 3 {
        return Vec::new();
    }
    let cell_count = columns * rows;
    let (gradient_x, gradient_y) = (&gradients.gradient_x, &gradients.gradient_y);

    // 1. Gradient magnitude + maximum (for normalized thresholds).
    let mut magnitude = vec![0.0f32; cell_count];
    let mut max_magnitude = 0.0f32;
    for i in 0..cell_count {
        let value = (gradient_x[i] * gradient_x[i] + gradient_y[i] * gradient_y[i]).sqrt();
        magnitude[i] = value;
        if value > max_magnitude {
            max_magnitude = value;
        }
    }
    if max_magnitude <= 0.0 {
        return Vec::new();
    }

    // 2. Non-maximum suppression: keep a pixel only if its magnitude is >= the two
    // neighbors across the edge (along the quantized gradient direction).
    let mut thinned = vec![0.0f32; cell_count];
    for y in 1..rows - 1 {
        for x in 1..columns - 1 {
            let i = y * columns + x;
            let value = magnitude[i];
            if value <= 0.0 {
                continue;
            }
            let (step_x, step_y) = gradient_step(gradient_x[i], gradient_y[i]);
            let forward = magnitude
                [(y as isize + step_y) as usize * columns + (x as isize + step_x) as usize];
            let backward = magnitude
                [(y as isize - step_y) as usize * columns + (x as isize - step_x) as usize];
            if value >= forward && value >= backward {
                thinned[i] = value;
            }
        }
    }

    // 3. Hysteresis: strong pixels (>= HIGH) seed; weak pixels (>= LOW) survive only if
    // 8-connected to a strong one.
    let high_cutoff = high * max_magnitude;
    let low_cutoff = low * max_magnitude;
    let mut is_edge = vec![false; cell_count];
    let mut stack: Vec<usize> = Vec::new();
    for i in 0..cell_count {
        if thinned[i] >= high_cutoff {
            is_edge[i] = true;
            stack.push(i);
        }
    }
    let mut neighbor_buffer = [(0usize, 0usize); 8];
    while let Some(i) = stack.pop() {
        let neighbor_count = neighbors(
            i % columns,
            i / columns,
            columns,
            rows,
            &mut neighbor_buffer,
        );
        for &(neighbor_x, neighbor_y) in neighbor_buffer.iter().take(neighbor_count) {
            let j = neighbor_y * columns + neighbor_x;
            if !is_edge[j] && thinned[j] >= low_cutoff {
                is_edge[j] = true;
                stack.push(j);
            }
        }
    }

    // 4. Link the edge mask into chains. Endpoints (degree 1) first -> open contours;
    // remaining unvisited pixels -> closed loops.
    let mut visited = vec![false; cell_count];
    let mut chains: Vec<(Vec<usize>, bool)> = Vec::new();
    for i in 0..cell_count {
        if !is_edge[i] || visited[i] {
            continue;
        }
        let neighbor_count = neighbors(
            i % columns,
            i / columns,
            columns,
            rows,
            &mut neighbor_buffer,
        );
        let degree = neighbor_buffer
            .iter()
            .take(neighbor_count)
            .filter(|&&(neighbor_x, neighbor_y)| is_edge[neighbor_y * columns + neighbor_x])
            .count();
        if degree == 1 {
            chains.push((walk(i, &is_edge, &mut visited, columns, rows), false));
        }
    }
    for i in 0..cell_count {
        if !is_edge[i] || visited[i] {
            continue;
        }
        let chain = walk(i, &is_edge, &mut visited, columns, rows);
        let closed = chain.len() > 2 && adjacent8(chain[0], chain[chain.len() - 1], columns);
        chains.push((chain, closed));
    }

    // 5 + 6. Simplify and filter. Cell index -> image coords: the field is downscaled, so
    // scale each axis back to image pixels here (before simplifying) so the simplify and
    // length thresholds stay in image pixels.
    let scale_x = gradients.width / columns as f64;
    let scale_y = gradients.height / rows as f64;
    let mut out = Vec::new();
    for (chain, closed) in chains {
        let points: Vec<(f64, f64)> = chain
            .iter()
            .map(|&i| {
                (
                    (i % columns) as f64 * scale_x,
                    (i / columns) as f64 * scale_y,
                )
            })
            .collect();
        let simplified = douglas_peucker(&points, simplify_px);
        if simplified.len() < min_points {
            continue;
        }
        let length: f64 = simplified
            .windows(2)
            .map(|pair| (pair[1].0 - pair[0].0).hypot(pair[1].1 - pair[0].1))
            .sum();
        if length < min_length {
            continue;
        }
        out.push(Polyline {
            points: simplified
                .iter()
                .map(|&(x, y)| (x as f32, y as f32))
                .collect(),
            closed,
        });
    }
    out
}

/// Quantized gradient direction as a single-step neighbor offset (one of the 4 axes).
fn gradient_step(dx: f32, dy: f32) -> (isize, isize) {
    let mut angle = dy.atan2(dx).to_degrees();
    if angle < 0.0 {
        angle += 180.0; // the gradient line is symmetric
    }
    if !(22.5..157.5).contains(&angle) {
        (1, 0)
    } else if angle < 67.5 {
        (1, 1)
    } else if angle < 112.5 {
        (0, 1)
    } else {
        (-1, 1)
    }
}

/// Fill `buffer` with the in-bounds 8-neighborhood of `(x, y)`; returns the count.
fn neighbors(
    x: usize,
    y: usize,
    columns: usize,
    rows: usize,
    buffer: &mut [(usize, usize); 8],
) -> usize {
    let mut count = 0;
    let (x0, y0) = (x as isize, y as isize);
    for dy in -1isize..=1 {
        for dx in -1isize..=1 {
            if dx == 0 && dy == 0 {
                continue;
            }
            let (neighbor_x, neighbor_y) = (x0 + dx, y0 + dy);
            if neighbor_x >= 0
                && neighbor_x < columns as isize
                && neighbor_y >= 0
                && neighbor_y < rows as isize
            {
                buffer[count] = (neighbor_x as usize, neighbor_y as usize);
                count += 1;
            }
        }
    }
    count
}

/// Greedily follow unvisited edge neighbors from `start`, consuming them, into one chain.
fn walk(
    start: usize,
    is_edge: &[bool],
    visited: &mut [bool],
    columns: usize,
    rows: usize,
) -> Vec<usize> {
    let mut chain = vec![start];
    visited[start] = true;
    let mut current = start;
    let mut neighbor_buffer = [(0usize, 0usize); 8];
    loop {
        let neighbor_count = neighbors(
            current % columns,
            current / columns,
            columns,
            rows,
            &mut neighbor_buffer,
        );
        let mut next = None;
        for &(neighbor_x, neighbor_y) in neighbor_buffer.iter().take(neighbor_count) {
            let j = neighbor_y * columns + neighbor_x;
            if is_edge[j] && !visited[j] {
                next = Some(j);
                break;
            }
        }
        match next {
            Some(j) => {
                visited[j] = true;
                chain.push(j);
                current = j;
            }
            None => break,
        }
    }
    chain
}

fn adjacent8(a: usize, b: usize, columns: usize) -> bool {
    let (ax, ay) = ((a % columns) as isize, (a / columns) as isize);
    let (bx, by) = ((b % columns) as isize, (b / columns) as isize);
    (ax - bx).abs() <= 1 && (ay - by).abs() <= 1
}

/// Iterative Douglas-Peucker (explicit stack avoids deep recursion on long contours).
fn douglas_peucker(points: &[(f64, f64)], tolerance: f64) -> Vec<(f64, f64)> {
    let count = points.len();
    if count < 3 {
        return points.to_vec();
    }
    let mut keep = vec![false; count];
    keep[0] = true;
    keep[count - 1] = true;
    let mut stack = vec![(0usize, count - 1)];
    while let Some((segment_start, segment_end)) = stack.pop() {
        if segment_end <= segment_start + 1 {
            continue;
        }
        let mut max_distance = 0.0;
        let mut farthest = segment_start;
        for i in segment_start + 1..segment_end {
            let distance =
                perpendicular_distance(points[i], points[segment_start], points[segment_end]);
            if distance > max_distance {
                max_distance = distance;
                farthest = i;
            }
        }
        if max_distance > tolerance {
            keep[farthest] = true;
            stack.push((segment_start, farthest));
            stack.push((farthest, segment_end));
        }
    }
    (0..count).filter(|&i| keep[i]).map(|i| points[i]).collect()
}

/// Perpendicular distance from `p` to the line through `a` and `b`.
fn perpendicular_distance(p: (f64, f64), a: (f64, f64), b: (f64, f64)) -> f64 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let length_squared = dx * dx + dy * dy;
    if length_squared == 0.0 {
        return (p.0 - a.0).hypot(p.1 - a.1);
    }
    (dx * (a.1 - p.1) - dy * (a.0 - p.0)).abs() / length_squared.sqrt()
}
