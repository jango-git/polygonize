import { DeltaOperation, signals } from "../signals.js";

// Derived signals fire when a run completes (geometry is in the render buffers). Structural
// signals (`modifiers`) are emitted synchronously by the callers that mutate the stack.
export function emitDerived(): void {
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
}
