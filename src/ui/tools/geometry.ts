// A plain point in image space (world coordinates, Y down). Shared by every tool
// interaction module; structurally compatible with the document's vertex/anchor/center
// shapes, so those can be passed wherever a Vector2 is expected.
export interface Vector2 {
  x: number;
  y: number;
}
