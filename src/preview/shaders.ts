import { CanvasTexture, Texture } from "three";

// Sample the image at the point center and emit the inverse of the displayed
// (sRGB) color. The texture is uploaded as sRGB, so on WebGL2 the sampler hands
// us linear values; we re-encode to sRGB before inverting so the dot is the
// perceptual inverse of what the eye sees behind it. uv mirrors how the
// background plane maps the texture (top-left of the image is world (0,0)).
export const INVERTED_POINT_VERT = /* glsl */ `
  uniform sampler2D uImage;
  uniform vec2 uImgSize;
  uniform float uHasImage;
  uniform float uSize;
  varying vec3 vColor;

  vec3 linearToSrgb(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
  }

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize;

    vec2 uv = vec2(position.x / uImgSize.x, 1.0 - position.y / uImgSize.y);
    vec3 srgb = linearToSrgb(texture2D(uImage, uv).rgb);
    // Fall back to a neutral grey when there is no image to sample.
    vColor = mix(vec3(0.8), vec3(1.0) - srgb, uHasImage);
  }
`;

export const INVERTED_POINT_FRAG = /* glsl */ `
  uniform sampler2D uDisc;
  uniform float uOpacity;
  varying vec3 vColor;

  void main() {
    float a = texture2D(uDisc, gl_PointCoord).a;
    gl_FragColor = vec4(vColor, a * uOpacity);
  }
`;

// Control-point dot: a flat fill with a lighter rim of the same hue, mixed toward
// white (keeps hue, raises lightness), giving the editable points a crisp edge
// against the field points. uInnerRatio is the fill radius as a fraction of the
// outer radius, so 1 - uInnerRatio is the ring thickness (0.75 -> a 25% ring for
// regular dots; the selected dot uses a much smaller ratio for a bold ring).
export const DOT_VERT = /* glsl */ `
  uniform float uSize;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
  }
`;

export const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uSize;
  uniform float uRound;
  uniform float uInnerRatio;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    // Distance to the sprite edge: radial for round dots, chebyshev for square.
    float d = mix(max(abs(p.x), abs(p.y)), length(p), uRound);

    float px = 1.0 / uSize;        // one device pixel in sprite-coord units
    float outerR = 0.5 - px;       // keep the outline a pixel off the sprite edge
    float innerR = outerR * uInnerRatio;

    float alpha = 1.0 - smoothstep(outerR - px, outerR, d);
    float fillMask = 1.0 - smoothstep(innerR - px, innerR, d);

    vec3 col = mix(uRim, uColor, fillMask);

    float a = alpha * uOpacity;
    if (a <= 0.0) discard;
    gl_FragColor = vec4(col, a);
  }
`;

export function createDiscTexture(): Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
