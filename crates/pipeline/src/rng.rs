//! Port of `src/domain/rng.ts` - mulberry32-style generator. Must stay bit-for-bit
//! identical to the TS version so a given seed yields the same point set.

/// 2^32, used to normalize the final u32 hash into a float in [0, 1).
const U32_RANGE: f64 = 4294967296.0;

pub struct Rng {
    state: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng { state: seed }
    }

    /// Returns a float in [0, 1), matching the JS `nextRandom`.
    pub fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut mixed = self.state;
        mixed = (mixed ^ (mixed >> 15)).wrapping_mul(mixed | 1);
        mixed ^= mixed.wrapping_add((mixed ^ (mixed >> 7)).wrapping_mul(mixed | 61));
        ((mixed ^ (mixed >> 14)) as f64) / U32_RANGE
    }
}
