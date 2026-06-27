const FOUR_SQRT3 = 4 * Math.sqrt(3);
const LOW = 0.55;

export function triangleSpike(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;
  const area = Math.abs(abx * acy - aby * acx) * 0.5;
  const sumSq =
    abx * abx + aby * aby + acx * acx + acy * acy + (cx - bx) * (cx - bx) + (cy - by) * (cy - by);
  if (sumSq <= 0) return 1;

  const quality = (FOUR_SQRT3 * area) / sumSq;
  const spike = (1 - quality - LOW) / (1 - LOW);
  return spike <= 0 ? 0 : spike >= 1 ? 1 : spike;
}

export const SLIVER_THRESHOLD = 0.5;
