import { newPointUUID, type Point } from "../document/types.js";
import type { DensityMap } from "./featureMap.js";
import type { SeedSettings } from "../settings/types.js";
import { makeRandomGenerator, type RandomGenerator } from "./rng.js";

const MAX_CANDIDATES = 30;
const MAX_INTERIOR = 20_000;

interface FieldNode {
  x: number;
  y: number;
  output: boolean;
}

interface PoissonField {
  width: number;
  height: number;
  cellSize: number;
  gridColumns: number;
  gridRows: number;
  searchCells: number;
  grid: Int32Array;
  nodes: FieldNode[];
  radiusAt: (x: number, y: number) => number;
  randomGenerator: RandomGenerator;
}

const FILL_SEED_OFFSET = 0x9e3779b9;

interface Position {
  x: number;
  y: number;
}

interface BaseInteriorCache {
  width: number;
  height: number;
  seed: number;
  minRadius: number;
  maxRadius: number;
  borderPerSide: number;
  density: DensityMap;
  positions: Position[];
}

let baseInteriorCache: BaseInteriorCache | null = null;

export function generateSeedPoints(
  width: number,
  height: number,
  settings: SeedSettings,
  density: DensityMap,
  seed: number,
  modifierPoints: Point[],
): Point[] {
  const minRadius = Math.max(1, settings.minRadius);
  const maxRadius = Math.max(minRadius + 1, settings.maxRadius);

  const radiusAt = (x: number, y: number): number => {
    const edgeStrength = sampleDensity(density, x / width, y / height);
    return minRadius + (1 - edgeStrength) * (maxRadius - minRadius);
  };

  const baseInterior = getBaseInterior(
    width,
    height,
    settings,
    density,
    seed,
    minRadius,
    maxRadius,
    radiusAt,
  );

  const fillRandom = makeRandomGenerator((seed ^ FILL_SEED_OFFSET) >>> 0);
  const finalField = createField(width, height, minRadius, maxRadius, radiusAt, fillRandom);
  appendBorderNodes(finalField, settings);

  const modifierStart = finalField.nodes.length;
  for (const point of modifierPoints) {
    insertNode(finalField, { x: point.x, y: point.y, output: false });
  }
  const modifierIndices = range(modifierStart, finalField.nodes.length);

  for (const candidate of baseInterior) {
    const candidateRadius = radiusAt(candidate.x, candidate.y);
    if (!tooClose(finalField, candidate.x, candidate.y, candidateRadius)) {
      insertNode(finalField, { x: candidate.x, y: candidate.y, output: true });
    }
  }

  growField(finalField, modifierIndices, MAX_INTERIOR);

  const result: Point[] = [];
  for (const node of finalField.nodes) {
    if (node.output) result.push({ uuid: newPointUUID(), x: node.x, y: node.y });
  }
  return result;
}

function getBaseInterior(
  width: number,
  height: number,
  settings: SeedSettings,
  density: DensityMap,
  seed: number,
  minRadius: number,
  maxRadius: number,
  radiusAt: (x: number, y: number) => number,
): Position[] {
  const borderPerSide = Math.max(0, Math.floor(settings.borderPerSide));
  const cache = baseInteriorCache;
  if (
    cache &&
    cache.width === width &&
    cache.height === height &&
    cache.seed === seed &&
    cache.minRadius === minRadius &&
    cache.maxRadius === maxRadius &&
    cache.borderPerSide === borderPerSide &&
    cache.density === density
  ) {
    return cache.positions;
  }

  const baseRandom = makeRandomGenerator(seed >>> 0);
  const baseField = createField(width, height, minRadius, maxRadius, radiusAt, baseRandom);
  const borderCount = appendBorderNodes(baseField, settings);
  growField(baseField, range(0, borderCount), MAX_INTERIOR);

  const positions: Position[] = [];
  for (let index = borderCount; index < baseField.nodes.length; index++) {
    positions.push({ x: baseField.nodes[index].x, y: baseField.nodes[index].y });
  }

  baseInteriorCache = {
    width,
    height,
    seed,
    minRadius,
    maxRadius,
    borderPerSide,
    density,
    positions,
  };
  return positions;
}

function createField(
  width: number,
  height: number,
  minRadius: number,
  maxRadius: number,
  radiusAt: (x: number, y: number) => number,
  randomGenerator: RandomGenerator,
): PoissonField {
  const cellSize = minRadius / Math.SQRT2;
  const gridColumns = Math.ceil(width / cellSize) + 2;
  const gridRows = Math.ceil(height / cellSize) + 2;
  const searchCells = Math.ceil(maxRadius / cellSize);
  const grid = new Int32Array(gridColumns * gridRows).fill(-1);
  return {
    width,
    height,
    cellSize,
    gridColumns,
    gridRows,
    searchCells,
    grid,
    nodes: [],
    radiusAt,
    randomGenerator,
  };
}

function appendBorderNodes(field: PoissonField, settings: SeedSettings): number {
  const { width, height } = field;
  insertNode(field, { x: 0, y: 0, output: true });
  insertNode(field, { x: width, y: 0, output: true });
  insertNode(field, { x: width, y: height, output: true });
  insertNode(field, { x: 0, y: height, output: true });

  const perSide = Math.max(0, Math.floor(settings.borderPerSide));
  for (let index = 1; index <= perSide; index++) {
    const offsetX = (width * index) / (perSide + 1);
    const offsetY = (height * index) / (perSide + 1);
    insertNode(field, { x: offsetX, y: 0, output: true });
    insertNode(field, { x: offsetX, y: height, output: true });
    insertNode(field, { x: 0, y: offsetY, output: true });
    insertNode(field, { x: width, y: offsetY, output: true });
  }

  return field.nodes.length;
}

function growField(field: PoissonField, initialActive: number[], limit: number): void {
  const active = initialActive.slice();
  let placed = 0;

  while (active.length > 0 && placed < limit) {
    const activeIndex = Math.floor(field.randomGenerator() * active.length);
    const origin = field.nodes[active[activeIndex]];
    const originRadius = field.radiusAt(origin.x, origin.y);

    let placedFromOrigin = false;
    for (let attempt = 0; attempt < MAX_CANDIDATES; attempt++) {
      const angle = field.randomGenerator() * Math.PI * 2;
      const distance = originRadius + field.randomGenerator() * originRadius;
      const candidateX = origin.x + Math.cos(angle) * distance;
      const candidateY = origin.y + Math.sin(angle) * distance;

      if (
        candidateX < 0 ||
        candidateX > field.width ||
        candidateY < 0 ||
        candidateY > field.height
      ) {
        continue;
      }

      const candidateRadius = field.radiusAt(candidateX, candidateY);
      if (tooClose(field, candidateX, candidateY, candidateRadius)) continue;

      const newIndex = insertNode(field, { x: candidateX, y: candidateY, output: true });
      active.push(newIndex);
      placed++;
      placedFromOrigin = true;
      break;
    }

    if (!placedFromOrigin) {
      active[activeIndex] = active[active.length - 1];
      active.pop();
    }
  }
}

function insertNode(field: PoissonField, node: FieldNode): number {
  const index = field.nodes.length;
  field.nodes.push(node);
  const columnIndex = Math.floor(node.x / field.cellSize);
  const rowIndex = Math.floor(node.y / field.cellSize);
  const cell = rowIndex * field.gridColumns + columnIndex;
  if (cell >= 0 && cell < field.grid.length) field.grid[cell] = index;
  return index;
}

function tooClose(field: PoissonField, x: number, y: number, radius: number): boolean {
  const columnIndex = Math.floor(x / field.cellSize);
  const rowIndex = Math.floor(y / field.cellSize);
  const radiusSquared = radius * radius;

  for (let deltaRow = -field.searchCells; deltaRow <= field.searchCells; deltaRow++) {
    const neighborRow = rowIndex + deltaRow;
    if (neighborRow < 0 || neighborRow >= field.gridRows) continue;
    for (let deltaColumn = -field.searchCells; deltaColumn <= field.searchCells; deltaColumn++) {
      const neighborColumn = columnIndex + deltaColumn;
      if (neighborColumn < 0 || neighborColumn >= field.gridColumns) continue;
      const occupantIndex = field.grid[neighborRow * field.gridColumns + neighborColumn];
      if (occupantIndex < 0) continue;
      const occupant = field.nodes[occupantIndex];
      const distanceX = occupant.x - x;
      const distanceY = occupant.y - y;
      if (distanceX * distanceX + distanceY * distanceY < radiusSquared) return true;
    }
  }

  return false;
}

function range(start: number, end: number): number[] {
  const values: number[] = [];
  for (let value = start; value < end; value++) values.push(value);
  return values;
}

function sampleDensity(density: DensityMap, u: number, v: number): number {
  if (density.cols === 0 || density.rows === 0) return 0;
  const x = Math.max(0, Math.min(density.cols - 1, u * (density.cols - 1)));
  const y = Math.max(0, Math.min(density.rows - 1, v * (density.rows - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, density.cols - 1);
  const y1 = Math.min(y0 + 1, density.rows - 1);
  const fx = x - x0;
  const fy = y - y0;
  const v00 = density.values[y0 * density.cols + x0];
  const v10 = density.values[y0 * density.cols + x1];
  const v01 = density.values[y1 * density.cols + x0];
  const v11 = density.values[y1 * density.cols + x1];
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}
