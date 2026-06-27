export {};

declare function postMessage(message: unknown, transfer?: Transferable[]): void;

interface SetImageMessage {
  type: "setImage";
  imageData: ArrayBuffer;
  imageWidth: number;
  imageHeight: number;
}

interface ComputeMessage {
  type: "compute";
  id: number;
  coordinates: ArrayBuffer;
  triangleCount: number;
  samplesPerTriangle: number;
  strategy: "average" | "median";
}

let imageData: Uint8ClampedArray | null = null;
let imageWidth = 0;
let imageHeight = 0;

self.addEventListener("message", (event: Event) => {
  const message = (event as MessageEvent<SetImageMessage | ComputeMessage>).data;

  if (message.type === "setImage") {
    imageData = new Uint8ClampedArray(message.imageData);
    imageWidth = message.imageWidth;
    imageHeight = message.imageHeight;
    return;
  }

  if (message.type === "compute") {
    const coordinates = new Float64Array(message.coordinates);
    const result = computeGrid(
      message.id,
      coordinates,
      message.triangleCount,
      message.samplesPerTriangle,
      message.strategy,
    );
    postMessage(result, [result.entries.buffer, result.cellIndex.buffer]);
  }
});

interface GridResult {
  id: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  entries: Float32Array;
  cellIndex: Int32Array;
}

function computeGrid(
  id: number,
  coordinates: Float64Array,
  triangleCount: number,
  samplesPerTriangle: number,
  strategy: "average" | "median",
): GridResult {
  const startTime = performance.now();

  const sampleCount = Math.max(1, Math.floor(samplesPerTriangle));

  const cellSize = triangleCount > 0 ? Math.sqrt((imageWidth * imageHeight) / triangleCount) : 64;
  const columns = Math.max(1, Math.ceil(imageWidth / cellSize));
  const rows = Math.max(1, Math.ceil(imageHeight / cellSize));
  const cellWidth = imageWidth / columns;
  const cellHeight = imageHeight / rows;
  const cellCount = columns * rows;

  const barycentricSamples = new Float64Array(sampleCount * 2);
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    let weightTowardsB = halton(sampleIndex + 1, 2);
    let weightTowardsC = halton(sampleIndex + 1, 3);
    if (weightTowardsB + weightTowardsC > 1) {
      weightTowardsB = 1 - weightTowardsB;
      weightTowardsC = 1 - weightTowardsC;
    }
    barycentricSamples[sampleIndex * 2] = weightTowardsB;
    barycentricSamples[sampleIndex * 2 + 1] = weightTowardsC;
  }

  const redSamples = new Uint8Array(sampleCount);
  const greenSamples = new Uint8Array(sampleCount);
  const blueSamples = new Uint8Array(sampleCount);

  const samplingStart = performance.now();
  const centroids = new Float64Array(triangleCount * 2);
  const triangleColors = new Uint8Array(triangleCount * 3);
  const trianglesPerCell = new Int32Array(cellCount);

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const offset = triangleIndex * 6;
    const aX = coordinates[offset],
      aY = coordinates[offset + 1];
    const bX = coordinates[offset + 2],
      bY = coordinates[offset + 3];
    const cX = coordinates[offset + 4],
      cY = coordinates[offset + 5];

    const centroidX = (aX + bX + cX) / 3;
    const centroidY = (aY + bY + cY) / 3;
    centroids[triangleIndex * 2] = centroidX;
    centroids[triangleIndex * 2 + 1] = centroidY;

    const color = sampleTriangleColor(
      aX,
      aY,
      bX,
      bY,
      cX,
      cY,
      sampleCount,
      strategy,
      barycentricSamples,
      redSamples,
      greenSamples,
      blueSamples,
    );
    triangleColors[triangleIndex * 3] = color.red;
    triangleColors[triangleIndex * 3 + 1] = color.green;
    triangleColors[triangleIndex * 3 + 2] = color.blue;

    const column = Math.min(Math.floor(centroidX / cellWidth), columns - 1);
    const row = Math.min(Math.floor(centroidY / cellHeight), rows - 1);
    trianglesPerCell[row * columns + column]++;
  }

  const samplingTime = performance.now() - samplingStart;

  const gridStart = performance.now();
  const cellIndex = new Int32Array(cellCount * 2);
  let runningOffset = 0;
  for (let cell = 0; cell < cellCount; cell++) {
    cellIndex[cell * 2] = runningOffset;
    cellIndex[cell * 2 + 1] = trianglesPerCell[cell];
    runningOffset += trianglesPerCell[cell];
  }

  const entries = new Float32Array(triangleCount * 5);
  const writeCursor = new Int32Array(cellCount);

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const centroidX = centroids[triangleIndex * 2];
    const centroidY = centroids[triangleIndex * 2 + 1];
    const column = Math.min(Math.floor(centroidX / cellWidth), columns - 1);
    const row = Math.min(Math.floor(centroidY / cellHeight), rows - 1);
    const cell = row * columns + column;

    const entryIndex = cellIndex[cell * 2] + writeCursor[cell];
    writeCursor[cell]++;

    const entryOffset = entryIndex * 5;
    entries[entryOffset] = centroidX;
    entries[entryOffset + 1] = centroidY;
    entries[entryOffset + 2] = triangleColors[triangleIndex * 3];
    entries[entryOffset + 3] = triangleColors[triangleIndex * 3 + 1];
    entries[entryOffset + 4] = triangleColors[triangleIndex * 3 + 2];
  }

  const gridTime = performance.now() - gridStart;
  const totalTime = performance.now() - startTime;

  const totalSamples = triangleCount * sampleCount;
  const samplesPerMs = samplingTime > 0 ? totalSamples / samplingTime : 0;
  console.log(
    `[colorWorker] ${triangleCount} tris × ${sampleCount} (${strategy}): ` +
      `total ${totalTime.toFixed(1)}ms | ` +
      `sampling ${samplingTime.toFixed(1)}ms (${(samplesPerMs / 1000).toFixed(2)}M samples/s) | ` +
      `grid ${gridTime.toFixed(1)}ms | ${columns}×${rows} cells`,
  );

  return {
    id,
    cols: columns,
    rows,
    cellW: cellWidth,
    cellH: cellHeight,
    entries,
    cellIndex,
  };
}

function sampleTriangleColor(
  aX: number,
  aY: number,
  bX: number,
  bY: number,
  cX: number,
  cY: number,
  sampleCount: number,
  strategy: "average" | "median",
  barycentricSamples: Float64Array,
  redSamples: Uint8Array,
  greenSamples: Uint8Array,
  blueSamples: Uint8Array,
): { red: number; green: number; blue: number } {
  if (!imageData) return { red: 128, green: 128, blue: 128 };

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const weightTowardsB = barycentricSamples[sampleIndex * 2];
    const weightTowardsC = barycentricSamples[sampleIndex * 2 + 1];
    const sampleX = aX + weightTowardsB * (bX - aX) + weightTowardsC * (cX - aX);
    const sampleY = aY + weightTowardsB * (bY - aY) + weightTowardsC * (cY - aY);
    const pixelX = clamp(Math.floor(sampleX), 0, imageWidth - 1);
    const pixelY = clamp(Math.floor(sampleY), 0, imageHeight - 1);
    const pixelOffset = (pixelY * imageWidth + pixelX) * 4;
    redSamples[sampleIndex] = imageData[pixelOffset];
    greenSamples[sampleIndex] = imageData[pixelOffset + 1];
    blueSamples[sampleIndex] = imageData[pixelOffset + 2];
  }

  if (strategy === "median") {
    return {
      red: median(redSamples, sampleCount),
      green: median(greenSamples, sampleCount),
      blue: median(blueSamples, sampleCount),
    };
  }
  return {
    red: mean(redSamples, sampleCount),
    green: mean(greenSamples, sampleCount),
    blue: mean(blueSamples, sampleCount),
  };
}

function halton(index: number, base: number): number {
  let fraction = 1;
  let result = 0;
  while (index > 0) {
    fraction /= base;
    result += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return result;
}

function mean(values: Uint8Array, count: number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) sum += values[i];
  return Math.round(sum / count);
}

function median(values: Uint8Array, count: number): number {
  const sorted = values.subarray(0, count).sort();
  const middle = count >> 1;
  return count % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}
