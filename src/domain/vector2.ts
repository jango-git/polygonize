// A plain point in image space (world coordinates, Y down). Shared across the
// domain, tools and preview; structurally compatible with three.js Vector2 and
// with the document's vertex/anchor/center shapes, so those pass wherever a
// Vector2 is expected.
export interface Vector2 {
  x: number;
  y: number;
}
