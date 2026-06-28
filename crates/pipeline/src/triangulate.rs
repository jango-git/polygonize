//! Replacement for `src/domain/triangulation.ts` - spade constrained Delaunay.
//! Points are indexed as the union `modifiers (0..modifier_count) ++ generated`.
//! Constraint edges are index pairs into the modifier block.

use spade::{ConstrainedDelaunayTriangulation, HasPosition, Point2, Triangulation};

struct Vertex {
    position: Point2<f64>,
    index: u32,
}

impl HasPosition for Vertex {
    type Scalar = f64;
    fn position(&self) -> Point2<f64> {
        self.position
    }
}

type Cdt = ConstrainedDelaunayTriangulation<Vertex>;

/// Returns triangle index triples into the union point set.
pub fn triangulate(
    modifier_xy: &[f32],
    generated_xy: &[f32],
    edges: &[u32],
    modifier_count: usize,
) -> Vec<u32> {
    let generated_count = generated_xy.len() / 2;
    let total = modifier_count + generated_count;
    if total < 3 {
        return Vec::new();
    }

    // Vertices in union order: `modifiers ++ generated`. `bulk_load_cdt` preserves
    // this order, so each vertex's stored `index` (and the edge indices below) stay
    // valid. The index travels in the vertex data, so it survives spade's dedup of
    // coincident positions (which may shift internal vertex indices).
    let mut vertices = Vec::with_capacity(total);
    for k in 0..modifier_count {
        vertices.push(Vertex {
            position: Point2::new(modifier_xy[2 * k] as f64, modifier_xy[2 * k + 1] as f64),
            index: k as u32,
        });
    }
    for k in 0..generated_count {
        vertices.push(Vertex {
            position: Point2::new(generated_xy[2 * k] as f64, generated_xy[2 * k + 1] as f64),
            index: (modifier_count + k) as u32,
        });
    }

    // Constraint edges index into the modifier block. Filter degenerate and
    // out-of-range pairs: `try_bulk_load_cdt` panics on an invalid index (the old
    // per-insert path guarded this via `handles.get`).
    let mut edge_pairs = Vec::with_capacity(edges.len() / 2);
    let mut i = 0;
    while i + 1 < edges.len() {
        let a = edges[i] as usize;
        let b = edges[i + 1] as usize;
        i += 2;
        if a != b && a < total && b < total {
            edge_pairs.push([a, b]);
        }
    }

    // Bulk load is ~O(n) (space-filling order) vs. the per-vertex `insert` walk.
    // `try_*` skips intersecting constraints instead of panicking - mirroring the
    // old `try_add_constraint` skip-and-continue behavior.
    let cdt = match Cdt::try_bulk_load_cdt(vertices, edge_pairs, |_| {}) {
        Ok(cdt) => cdt,
        Err(_) => return Vec::new(),
    };

    let mut out = Vec::with_capacity(cdt.num_inner_faces() * 3);
    for face in cdt.inner_faces() {
        let vs = face.vertices();
        out.push(vs[0].data().index);
        out.push(vs[1].data().index);
        out.push(vs[2].data().index);
    }
    out
}
