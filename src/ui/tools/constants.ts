// Screen-space grab radius (px) for control points, bezier handles/anchors, and the
// path-close snap. Generous so the small dots and handle squares are easy to hit.
export const GRAB_RADIUS_PX = 15;

// Sample count for a circle drawn by the circle / 3-point-circle tools.
export const CIRCLE_DEFAULT_POINTS = 24;

// A retracted bezier handle (magnitude at or below this) reads as a corner: the
// double-click toggle expands it, and the whisker / hit-test code skips it. Shared by the
// highlight overlay and the topology edits.
export const HANDLE_EPSILON = 1e-3;
