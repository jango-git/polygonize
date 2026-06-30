import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  Material,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { HOVER_COLOR, MODIFIER_COLOR } from "./palette.js";
import { DOT_FRAG, DOT_VERT } from "./shaders.js";

type Vec2 = { x: number; y: number };

// The vector overlays drawn on top of the triangulation: the in-progress draft
// path, the selected modifier highlight, the hover outline, nearby-modifier
// outlines, and bezier tangent whiskers. Each is its own layer with independent
// lifecycle and disposal.
export class OverlayLayer {
  readonly #scene: Scene;
  readonly #requestRender: () => void;
  readonly #renderer: WebGLRenderer;

  #draftLine?: Line;
  #draftDots?: Points;
  #highlightLine?: Line;
  #highlightDots?: Points;
  #hoverLine?: Line;
  #nearbyLines: Line[] = [];
  #whiskerLines: Line[] = [];
  #whiskerDots?: Points;

  constructor(scene: Scene, requestRender: () => void, renderer: WebGLRenderer) {
    this.#scene = scene;
    this.#requestRender = requestRender;
    this.#renderer = renderer;
  }

  setDraftPath(
    outline: Vec2[] | null,
    closed: boolean,
    handles: Vec2[] = [],
    color = MODIFIER_COLOR,
  ): void {
    if (this.#draftLine) this.#disposeOverlay(this.#draftLine, this.#draftDots);
    this.#draftLine = undefined;
    this.#draftDots = undefined;

    if (outline && outline.length > 0) {
      // Same color as the edit-mode highlight so creating and editing a modifier
      // look identical (the active group's color when drawing into a group).
      this.#draftLine = this.#makePathLine(this.#closeLoop(outline, closed), color);
      this.#draftDots = this.#makePathDots(handles.length ? handles : outline, color);
      this.#scene.add(this.#draftLine, this.#draftDots);
    }
    this.#requestRender();
  }

  setHighlightedPath(
    outline: Vec2[] | null,
    closed: boolean,
    handles: Vec2[] = [],
    color = MODIFIER_COLOR,
  ): void {
    if (this.#highlightLine) this.#disposeOverlay(this.#highlightLine, this.#highlightDots);
    this.#highlightLine = undefined;
    this.#highlightDots = undefined;

    if (outline && outline.length > 0) {
      this.#highlightLine = this.#makePathLine(this.#closeLoop(outline, closed), color);
      this.#highlightDots = this.#makePathDots(handles.length ? handles : outline, color);
      this.#scene.add(this.#highlightLine, this.#highlightDots);
    }
    this.#requestRender();
  }

  setHoverPath(outline: Vec2[] | null, closed: boolean, color = HOVER_COLOR): void {
    if (this.#hoverLine) this.#disposeOverlay(this.#hoverLine, undefined);
    this.#hoverLine = undefined;

    if (outline && outline.length > 0) {
      this.#hoverLine = this.#makePathLine(this.#closeLoop(outline, closed), color);
      this.#hoverLine.renderOrder = 8;
      this.#scene.add(this.#hoverLine);
    }
    this.#requestRender();
  }

  setNearbyPaths(paths: { outline: Vec2[]; closed: boolean; color?: number }[]): void {
    for (const line of this.#nearbyLines) this.#disposeOverlay(line, undefined);
    this.#nearbyLines = [];

    for (const { outline, closed, color } of paths) {
      if (outline.length === 0) continue;
      const line = this.#makePathLine(this.#closeLoop(outline, closed), color ?? HOVER_COLOR);
      (line.material as Material).opacity = 0.3;
      line.renderOrder = 5;
      this.#nearbyLines.push(line);
      this.#scene.add(line);
    }
    this.#requestRender();
  }

  // Bezier tangent handles: each segment is one anchor->handle-end whisker, with
  // a dot at every handle end. Shares one layer between the selected curve and
  // the in-progress draft (only one is ever shown at a time).
  setHandleWhiskers(segments: [Vec2, Vec2][], dots: Vec2[], color = MODIFIER_COLOR): void {
    for (const line of this.#whiskerLines) this.#disposeOverlay(line, undefined);
    this.#whiskerLines = [];
    if (this.#whiskerDots) this.#disposeOverlay(undefined, this.#whiskerDots);
    this.#whiskerDots = undefined;

    for (const [a, b] of segments) {
      const line = this.#makePathLine([a, b], color);
      (line.material as Material).opacity = 0.6;
      line.renderOrder = 6;
      this.#whiskerLines.push(line);
      this.#scene.add(line);
    }
    if (dots.length > 0) {
      this.#whiskerDots = this.#makePathDots(dots, color, 10.5, false);
      this.#scene.add(this.#whiskerDots);
    }
    this.#requestRender();
  }

  #closeLoop(points: Vec2[], closed: boolean): Vec2[] {
    if (!closed || points.length < 2) return points;
    return [...points, points[0]];
  }

  #makePathLine(points: Vec2[], color: number): Line {
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 2;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color, transparent: true, depthTest: false });
    const line = new Line(geometry, material);
    line.renderOrder = 6;
    return line;
  }

  #makePathDots(points: Vec2[], color: number, size = 12, round = true): Points {
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 2;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    // A filled dot with a lighter rim of the same hue so the editable control
    // points stay legible against the field-point overlay behind them. uRound
    // toggles disc vs square (square sets the bezier handle ends apart).
    const fill = new Color().setHex(color, SRGBColorSpace);
    const material = new ShaderMaterial({
      uniforms: {
        // three multiplies PointsMaterial.size by the pixel ratio when it uploads
        // the size; match that so these dots are sized like the field points.
        uSize: { value: size * this.#renderer.getPixelRatio() },
        uColor: { value: [fill.r, fill.g, fill.b] },
        uOpacity: { value: 1 },
        uRound: { value: round ? 1 : 0 },
      },
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      transparent: true,
      depthTest: false,
    });
    const dots = new Points(geometry, material);
    dots.renderOrder = 7;
    return dots;
  }

  #disposeOverlay(line: Line | undefined, dots: Points | undefined): void {
    for (const obj of [line, dots]) {
      if (!obj) continue;
      this.#scene.remove(obj);
      obj.geometry.dispose();
      (obj.material as Material).dispose();
    }
  }
}
