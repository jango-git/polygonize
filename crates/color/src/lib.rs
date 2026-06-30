//! WASM color pipeline: samples per-triangle colors from the source image and builds the
//! spatial lookup grid consumed by the renderer. Mirrors the structure of the `pipeline`
//! crate - a thread_local state caches the image so it is uploaded once per image, not per
//! `compute` call. Runs inside the color web worker (see `domain/colorWasm.ts`).

use js_sys::{Float32Array, Int32Array};
use wasm_bindgen::prelude::*;

mod grid;
mod sampling;

use sampling::{Image, Strategy};

thread_local! {
    static STATE: std::cell::RefCell<State> = std::cell::RefCell::new(State::default());
}

#[derive(Default)]
struct State {
    /// Cached RGBA source image, uploaded by `set_image`, sampled by `compute`.
    image: Option<Image>,
}

/// Result of [`compute`]: the packed spatial lookup grid. `entries` holds `[cx, cy, r, g, b]`
/// per triangle grouped by cell; `cell_index` holds `[start, count]` per cell.
#[wasm_bindgen]
pub struct GridResult {
    cols: u32,
    rows: u32,
    cell_w: f32,
    cell_h: f32,
    entries: Vec<f32>,
    cell_index: Vec<i32>,
}

#[wasm_bindgen]
impl GridResult {
    #[wasm_bindgen(getter)]
    pub fn cols(&self) -> u32 {
        self.cols
    }

    #[wasm_bindgen(getter)]
    pub fn rows(&self) -> u32 {
        self.rows
    }

    #[wasm_bindgen(getter)]
    pub fn cell_w(&self) -> f32 {
        self.cell_w
    }

    #[wasm_bindgen(getter)]
    pub fn cell_h(&self) -> f32 {
        self.cell_h
    }

    #[wasm_bindgen(getter)]
    pub fn entries(&self) -> Float32Array {
        Float32Array::from(self.entries.as_slice())
    }

    #[wasm_bindgen(getter)]
    pub fn cell_index(&self) -> Int32Array {
        Int32Array::from(self.cell_index.as_slice())
    }
}

/// Initialize panic hooks (debug builds only). Safe to call multiple times.
#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "debug")]
    console_error_panic_hook::set_once();
}

/// Cache the RGBA source image. Sampled by subsequent [`compute`] calls.
#[wasm_bindgen]
pub fn set_image(rgba: &[u8], width: u32, height: u32) {
    let image = Image {
        data: rgba.to_vec(),
        width: width as usize,
        height: height as usize,
    };
    STATE.with(|s| s.borrow_mut().image = Some(image));
}

/// Drop the cached image (canvas cleared or replaced).
#[wasm_bindgen]
pub fn reset_image() {
    STATE.with(|s| s.borrow_mut().image = None);
}

/// Sample triangle colors and build the lookup grid. `coordinates` is `[ax, ay, bx, by,
/// cx, cy, ...]` (6 f64 per triangle); `strategy` is 0 = average, 1 = median.
#[wasm_bindgen]
pub fn compute(
    coordinates: &[f64],
    triangle_count: u32,
    samples_per_triangle: u32,
    strategy: u8,
) -> GridResult {
    STATE.with(|s| {
        let s = s.borrow();
        let result = grid::compute_grid(
            s.image.as_ref(),
            coordinates,
            triangle_count as usize,
            samples_per_triangle,
            Strategy::from_u8(strategy),
        );
        GridResult {
            cols: result.cols,
            rows: result.rows,
            cell_w: result.cell_w,
            cell_h: result.cell_h,
            entries: result.entries,
            cell_index: result.cell_index,
        }
    })
}
