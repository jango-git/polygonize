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
    grad: &Gradients,
    low: f32,
    high: f32,
    simplify_px: f64,
    min_points: usize,
    min_length: f64,
) -> Vec<Polyline> {
    let (cols, rows) = (grad.cols, grad.rows);
    if cols < 3 || rows < 3 {
        return Vec::new();
    }
    let n = cols * rows;
    let (gx, gy) = (&grad.gx, &grad.gy);

    // 1. Gradient magnitude + maximum (for normalized thresholds).
    let mut mag = vec![0.0f32; n];
    let mut max = 0.0f32;
    for i in 0..n {
        let m = (gx[i] * gx[i] + gy[i] * gy[i]).sqrt();
        mag[i] = m;
        if m > max {
            max = m;
        }
    }
    if max <= 0.0 {
        return Vec::new();
    }

    // 2. Non-maximum suppression: keep a pixel only if its magnitude is >= the two
    // neighbors across the edge (along the quantized gradient direction).
    let mut thin = vec![0.0f32; n];
    for y in 1..rows - 1 {
        for x in 1..cols - 1 {
            let i = y * cols + x;
            let m = mag[i];
            if m <= 0.0 {
                continue;
            }
            let (ox, oy) = gradient_step(gx[i], gy[i]);
            let a = mag[(y as isize + oy) as usize * cols + (x as isize + ox) as usize];
            let b = mag[(y as isize - oy) as usize * cols + (x as isize - ox) as usize];
            if m >= a && m >= b {
                thin[i] = m;
            }
        }
    }

    // 3. Hysteresis: strong pixels (>= HIGH) seed; weak pixels (>= LOW) survive only if
    // 8-connected to a strong one.
    let hi = high * max;
    let lo = low * max;
    let mut edge = vec![false; n];
    let mut stack: Vec<usize> = Vec::new();
    for i in 0..n {
        if thin[i] >= hi {
            edge[i] = true;
            stack.push(i);
        }
    }
    let mut buf = [(0usize, 0usize); 8];
    while let Some(i) = stack.pop() {
        let k = neighbors(i % cols, i / cols, cols, rows, &mut buf);
        for &(nx, ny) in buf.iter().take(k) {
            let j = ny * cols + nx;
            if !edge[j] && thin[j] >= lo {
                edge[j] = true;
                stack.push(j);
            }
        }
    }

    // 4. Link the edge mask into chains. Endpoints (degree 1) first -> open contours;
    // remaining unvisited pixels -> closed loops.
    let mut visited = vec![false; n];
    let mut chains: Vec<(Vec<usize>, bool)> = Vec::new();
    for i in 0..n {
        if !edge[i] || visited[i] {
            continue;
        }
        let k = neighbors(i % cols, i / cols, cols, rows, &mut buf);
        let degree = buf.iter().take(k).filter(|&&(nx, ny)| edge[ny * cols + nx]).count();
        if degree == 1 {
            chains.push((walk(i, &edge, &mut visited, cols, rows), false));
        }
    }
    for i in 0..n {
        if !edge[i] || visited[i] {
            continue;
        }
        let chain = walk(i, &edge, &mut visited, cols, rows);
        let closed = chain.len() > 2 && adjacent8(chain[0], chain[chain.len() - 1], cols);
        chains.push((chain, closed));
    }

    // 5 + 6. Simplify and filter. Cell index -> image coords: the field is downscaled, so
    // scale each axis back to image pixels here (before simplifying) so the simplify and
    // length thresholds stay in image pixels.
    let scale_x = grad.width / cols as f64;
    let scale_y = grad.height / rows as f64;
    let mut out = Vec::new();
    for (chain, closed) in chains {
        let pts: Vec<(f64, f64)> = chain
            .iter()
            .map(|&i| ((i % cols) as f64 * scale_x, (i / cols) as f64 * scale_y))
            .collect();
        let simplified = douglas_peucker(&pts, simplify_px);
        if simplified.len() < min_points {
            continue;
        }
        let length: f64 = simplified
            .windows(2)
            .map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1))
            .sum();
        if length < min_length {
            continue;
        }
        out.push(Polyline {
            points: simplified.iter().map(|&(x, y)| (x as f32, y as f32)).collect(),
            closed,
        });
    }
    out
}

/// Quantized gradient direction as a single-step neighbor offset (one of the 4 axes).
fn gradient_step(dx: f32, dy: f32) -> (isize, isize) {
    let mut a = dy.atan2(dx).to_degrees();
    if a < 0.0 {
        a += 180.0; // the gradient line is symmetric
    }
    if a < 22.5 || a >= 157.5 {
        (1, 0)
    } else if a < 67.5 {
        (1, 1)
    } else if a < 112.5 {
        (0, 1)
    } else {
        (-1, 1)
    }
}

/// Fill `buf` with the in-bounds 8-neighborhood of `(x, y)`; returns the count.
fn neighbors(x: usize, y: usize, cols: usize, rows: usize, buf: &mut [(usize, usize); 8]) -> usize {
    let mut k = 0;
    let (x0, y0) = (x as isize, y as isize);
    for dy in -1isize..=1 {
        for dx in -1isize..=1 {
            if dx == 0 && dy == 0 {
                continue;
            }
            let (nx, ny) = (x0 + dx, y0 + dy);
            if nx >= 0 && nx < cols as isize && ny >= 0 && ny < rows as isize {
                buf[k] = (nx as usize, ny as usize);
                k += 1;
            }
        }
    }
    k
}

/// Greedily follow unvisited edge neighbors from `start`, consuming them, into one chain.
fn walk(
    start: usize,
    edge: &[bool],
    visited: &mut [bool],
    cols: usize,
    rows: usize,
) -> Vec<usize> {
    let mut chain = vec![start];
    visited[start] = true;
    let mut cur = start;
    let mut buf = [(0usize, 0usize); 8];
    loop {
        let k = neighbors(cur % cols, cur / cols, cols, rows, &mut buf);
        let mut next = None;
        for &(nx, ny) in buf.iter().take(k) {
            let j = ny * cols + nx;
            if edge[j] && !visited[j] {
                next = Some(j);
                break;
            }
        }
        match next {
            Some(j) => {
                visited[j] = true;
                chain.push(j);
                cur = j;
            }
            None => break,
        }
    }
    chain
}

fn adjacent8(a: usize, b: usize, cols: usize) -> bool {
    let (ax, ay) = ((a % cols) as isize, (a / cols) as isize);
    let (bx, by) = ((b % cols) as isize, (b / cols) as isize);
    (ax - bx).abs() <= 1 && (ay - by).abs() <= 1
}

/// Iterative Douglas-Peucker (explicit stack avoids deep recursion on long contours).
fn douglas_peucker(pts: &[(f64, f64)], eps: f64) -> Vec<(f64, f64)> {
    let n = pts.len();
    if n < 3 {
        return pts.to_vec();
    }
    let mut keep = vec![false; n];
    keep[0] = true;
    keep[n - 1] = true;
    let mut stack = vec![(0usize, n - 1)];
    while let Some((lo, hi)) = stack.pop() {
        if hi <= lo + 1 {
            continue;
        }
        let mut max_d = 0.0;
        let mut idx = lo;
        for i in lo + 1..hi {
            let d = perp_dist(pts[i], pts[lo], pts[hi]);
            if d > max_d {
                max_d = d;
                idx = i;
            }
        }
        if max_d > eps {
            keep[idx] = true;
            stack.push((lo, idx));
            stack.push((idx, hi));
        }
    }
    (0..n).filter(|&i| keep[i]).map(|i| pts[i]).collect()
}

/// Perpendicular distance from `p` to the line through `a` and `b`.
fn perp_dist(p: (f64, f64), a: (f64, f64), b: (f64, f64)) -> f64 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let len2 = dx * dx + dy * dy;
    if len2 == 0.0 {
        return (p.0 - a.0).hypot(p.1 - a.1);
    }
    (dx * (a.1 - p.1) - dy * (a.0 - p.0)).abs() / len2.sqrt()
}
