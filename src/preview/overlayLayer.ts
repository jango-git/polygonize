import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Material,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { HOVER_COLOR, MODIFIER_COLOR } from "./palette.js";
import { DOT_FRAG, DOT_VERT } from "./shaders.js";

type Vec2 = { x: number; y: number };

// Overlay line thickness in CSS pixels. Native WebGL lines are clamped to 1px on
// most drivers, so the modifier outlines are drawn as Line2 (fat lines) instead,
// whose width the shader expands from `LineMaterial.resolution` (the CSS canvas
// size) - hence DPR-independent and a touch more visible than a hairline.
const LINE_WIDTH = 2;

// Diameter (px) of the editable control-point dots.
const CONTROL_DOT_SIZE = 15;

// Fill radius as a fraction of the dot radius; 1 - ratio is the ring thickness.
// Regular dots get a thin ring; the selected point keeps the same size but a much
// bolder ring, so it reads as selected without a big bright blob.
const NORMAL_RING_INNER = 0.75;
const SELECTED_RING_INNER = 0.38;

// The selected point keeps the fill in its group hue but gets a white ring, so it
// reads as selected by contrast rather than by size.
const SELECTED_RING_COLOR = 0xffffff;

// Size of the square dots at the bezier tangent handle ends. Larger than the
// whisker line weight so the handles stay easy to grab.
const WHISKER_DOT_SIZE = 15.75;

// The vector overlays drawn on top of the triangulation: the in-progress draft
// path, the selected modifier highlight, the hover outline, nearby-modifier
// outlines, and bezier tangent whiskers. Each is its own layer with independent
// lifecycle and disposal.
export class OverlayLayer {
  readonly #scene: Scene;
  readonly #requestRender: () => void;
  readonly #renderer: WebGLRenderer;

  #draftLine?: Line2;
  #draftDots?: Points;
  #highlightLine?: Line2;
  #highlightDots?: Points;
  #hoverLine?: Line2;
  #nearbyLines: Line2[] = [];
  #whiskerLines: Line2[] = [];
  #whiskerDots?: Points;
  #selectedDot?: Points;
  readonly #sizeTarget = new Vector2();

  constructor(scene: Scene, requestRender: () => void, renderer: WebGLRenderer) {
    this.#scene = scene;
    this.#requestRender = requestRender;
    this.#renderer = renderer;
  }

  // Line2 widths are computed from the material's `resolution` (CSS canvas size),
  // so it must track resizes. Called once per render, before drawing, since the
  // overlay lines are not rebuilt on a resize.
  updateResolution(): void {
    this.#renderer.getSize(this.#sizeTarget);
    const apply = (line?: Line2): void => {
      if (line) (line.material as LineMaterial).resolution.copy(this.#sizeTarget);
    };
    apply(this.#draftLine);
    apply(this.#highlightLine);
    apply(this.#hoverLine);
    for (const line of this.#nearbyLines) apply(line);
    for (const line of this.#whiskerLines) apply(line);
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
      const line = this.#makePathLine(this.#closeLoop(outline, closed), color ?? HOVER_COLOR, 0.3);
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
      const line = this.#makePathLine([a, b], color, 0.6);
      line.renderOrder = 6;
      this.#whiskerLines.push(line);
      this.#scene.add(line);
    }
    if (dots.length > 0) {
      this.#whiskerDots = this.#makePathDots(dots, color, WHISKER_DOT_SIZE, false);
      this.#scene.add(this.#whiskerDots);
    }
    this.#requestRender();
  }

  // The single emphasized dot marking the selected control point. Drawn above the
  // regular highlight dots (renderOrder 7) so it is never occluded by them.
  setSelectedControlPoint(point: Vec2 | null, color = MODIFIER_COLOR): void {
    if (this.#selectedDot) this.#disposeOverlay(undefined, this.#selectedDot);
    this.#selectedDot = undefined;
    if (point) {
      // Same size/fill as a regular control dot, but a bold white ring marks it
      // selected (a contrasting outline rather than a bigger or brighter dot).
      this.#selectedDot = this.#makePathDots(
        [point],
        color,
        CONTROL_DOT_SIZE,
        true,
        SELECTED_RING_INNER,
        SELECTED_RING_COLOR,
      );
      this.#selectedDot.renderOrder = 8;
      this.#scene.add(this.#selectedDot);
    }
    this.#requestRender();
  }

  #closeLoop(points: Vec2[], closed: boolean): Vec2[] {
    if (!closed || points.length < 2) return points;
    return [...points, points[0]];
  }

  #makePathLine(points: Vec2[], color: number, opacity = 1): Line2 {
    const positions = new Array<number>(points.length * 3);
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 2;
    });
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    const material = new LineMaterial({
      color,
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity,
      depthTest: false,
    });
    material.resolution.copy(this.#renderer.getSize(this.#sizeTarget));
    const line = new Line2(geometry, material);
    // These overlays are always on-screen and tiny; skip culling so a missing
    // bounding sphere can never make a fat line vanish on pan/zoom.
    line.frustumCulled = false;
    line.renderOrder = 6;
    return line;
  }

  #makePathDots(
    points: Vec2[],
    color: number,
    size = CONTROL_DOT_SIZE,
    round = true,
    innerRatio = NORMAL_RING_INNER,
    rimColor?: number,
  ): Points {
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 2;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    // A filled dot with a ring around it so the editable control points stay
    // legible against the field-point overlay behind them. By default the ring is
    // the fill hue lightened toward white; callers can override it (the selected
    // point uses a contrasting ring). uRound toggles disc vs square (square sets
    // the bezier handle ends apart).
    const fill = new Color().setHex(color, SRGBColorSpace);
    const rim =
      rimColor !== undefined
        ? new Color().setHex(rimColor, SRGBColorSpace)
        : new Color(fill.r * 0.5 + 0.5, fill.g * 0.5 + 0.5, fill.b * 0.5 + 0.5);
    const material = new ShaderMaterial({
      uniforms: {
        // three multiplies PointsMaterial.size by the pixel ratio when it uploads
        // the size; match that so these dots are sized like the field points.
        uSize: { value: size * this.#renderer.getPixelRatio() },
        uColor: { value: [fill.r, fill.g, fill.b] },
        uRim: { value: [rim.r, rim.g, rim.b] },
        uOpacity: { value: 1 },
        uRound: { value: round ? 1 : 0 },
        uInnerRatio: { value: innerRatio },
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

  #disposeOverlay(line: Line2 | undefined, dots: Points | undefined): void {
    for (const obj of [line, dots]) {
      if (!obj) continue;
      this.#scene.remove(obj);
      obj.geometry.dispose();
      (obj.material as Material).dispose();
    }
  }
}
