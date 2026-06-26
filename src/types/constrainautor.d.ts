declare module "@kninnug/constrainautor" {
  interface DelaunatorLike {
    coords: ArrayLike<number>;
    triangles: Uint32Array;
    halfedges: Int32Array;
  }

  export default class Constrainautor {
    del: DelaunatorLike;
    constructor(del: DelaunatorLike, edges?: readonly [number, number][]);
    constrainOne(p1: number, p2: number): number;
    constrainAll(edges: readonly [number, number][]): this;
    delaunify(deep?: boolean): this;
  }
}
