import { signals } from "../signals.js";
import { evaluatePoints } from "./pipeline.js";

// Two ways a stack edit commits. The split matters: a structural edit changes what
// reaches the pipeline (geometry must be regenerated), while a view-only edit only
// affects presentation but still needs to be recorded in undo history.

// Geometry-changing edit: fire the structural signal and regenerate points. Note the
// drag path (updateModifier) deliberately does NOT go through here - it skips the
// modifiers signal to avoid panel churn every frame and calls evaluatePoints directly.
export function commitStructural(): void {
  signals.modifiers.emit();
  evaluatePoints();
}

// View-only edit (folder collapse/expand): no geometry change, so no pipeline run, but
// signals.document still fires so the edit lands in undo history.
export function commitViewOnly(): void {
  signals.modifiers.emit();
  signals.document.emit();
}
