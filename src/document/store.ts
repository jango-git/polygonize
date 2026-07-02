import { randomSeed } from "../domain/rng.js";
import { DEFAULT_COLOR_SETTINGS, DEFAULT_SEED_SETTINGS } from "../settings/types.js";
import { DOCUMENT_VERSION, type DocumentData } from "./types.js";

// The empty starting document: source at defaults, derived buffers empty. The seed RNG is
// deterministic (domain/rng), so a fresh document still reproduces a stable field once an
// image loads. Also used as the defaults base when normalizing a loaded document.
export function emptyDocument(): DocumentData {
  return {
    version: DOCUMENT_VERSION,
    image: null,
    seed: randomSeed(),
    seedSettings: { ...DEFAULT_SEED_SETTINGS },
    colorSettings: { ...DEFAULT_COLOR_SETTINGS },
    stack: [],
    points: [],
    renderPositions: new Float32Array(0),
    renderColors: new Uint8Array(0),
    triangleCount: 0,
  };
}

let data: DocumentData = emptyDocument();

export const store = {
  data(): DocumentData {
    return data;
  },
  replace(next: DocumentData): void {
    data = next;
  },
};
