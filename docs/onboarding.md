# Tesselot - architecture

## Preface

Tesselot is a browser-based low-poly image editor: the user draws guide shapes over the
picture (**modifiers**: lines, curves, circles), and the app seeds the rest of the space
with points, triangulates it, and colors it in. What this gives the user is covered in the
README; this document is about how the code is put together.

The one thing to understand before reading the code: the pipeline is fully non-destructive.
State is strictly split into **source** - what the user set (the image, settings, the shape
tree) - and **derived** - points, triangulation, colors. Only source is stored and lands in
history; derived is recomputed from it on every edit and every load, and is never saved.

Almost the rest of the architecture follows from this split: undo is cheap (a snapshot is
just source), everything is deterministic (one source always yields one derived), heavy
computation is pushed to the background (derived is expensive to compute), and data flows
strictly one way - from source to derived, never back.

If this feels familiar, it is close to the unidirectional data flow of Redux/Flux - a
single state, changes only through commands, subscribers reacting to events - plus a layer
of computed state on top, like computed/reselect.

## Five layers

| Layer | Folder | Responsible for | Knows about |
|---|---|---|---|
| **UI** | `src/ui/` | input: drawing, the panel, tools, hotkeys | the model (sends commands) |
| **Model** | `src/document/` | source + derived, history, events | nothing above itself |
| **Domain** | `src/domain/` | pure logic: how a shape becomes points, bridges to WASM | called by the model |
| **Render** | `src/preview/` | draws the picture and triangles with three.js | only listens to the model |
| **Native** | `crates/` | Rust->WASM: heavy geometry and color | nothing, pure functions |

There are also a few supporting folders: `persistence/` (saving and export), `settings/`,
`i18n/`.

Flow rule: UI only changes the model, render only reads the model, they never talk to each
other directly. An event bus inside the model connects them - that is the unidirectional
cycle.

## Data flow

The main scenario - "from a mouse stroke to recolored triangles":

```
   user                 (1) UI catches the input
       |
       v
   (2) a command changes SOURCE: added/moved a shape
       |
       v
   (3) recompute: source -> points -> triangles      [heavy, in a background worker]
       |
       v
   (4) the model puts the result into flat buffers and fires a "ready" event
       |
       v
   (5) render hears the event and updates the picture on screen
       |
       +--> (6) triangle color is computed in parallel -> another event -> recolor
```

Three tricks keep this cycle responsive:

- **One recompute per frame.** While dragging, mouse events pour in by the dozen per
  second, but recompute runs no more than once per frame - intermediate positions are
  dropped.
- **Render never waits.** While the exact color is being computed in the background, the
  triangles are shown right away with an approximate one; the finished color arrives as a
  separate event and lands on top.
- **No unnecessary allocations.** Triangles do not live as objects but as long flat number
  arrays; both render and export read these arrays directly.

## Task map

| I want to change... | I look in... |
|---|---|
| drawing tool behavior | `src/ui/tools/` |
| the right-hand panel (shape tree, groups) | `src/ui/panel/` |
| how a shape becomes points | `src/domain/modifiers/` |
| the point-seeding algorithm / triangulation | `crates/pipeline/` |
| how a triangle's color is computed | `crates/color/` |
| rendering, camera, overlays | `src/preview/` |
| the save format / undo | `src/document/` |
| saving to disk / SVG, PDF, PNG export | `src/persistence/` |

## Details by layer

### Model (`src/document/`)

State is a single `DocumentData` object (`types.ts`), split exactly along this boundary:

- **Source** (saved, in history): `image`, `seed`, `seedSettings`, `colorSettings`, `stack`
  (the shape tree).
- **Derived** (recomputed, not saved): `points` and the flat render buffers -
  `renderPositions` (xyz per vertex), `renderColors` (rgb per triangle), `triangleCount`.

How an edit travels through the model:

- `store.ts` - the single mutable state object (`store.data()`).
- `commands/` - the only way to change it, akin to reducers. A command edits source in
  place and calls commit: `commit.ts` decides whether a recompute is needed
  (`commitStructural` for geometry edits) or a history step is enough (`commitViewOnly`,
  e.g. collapsing a folder).
- `commands/pipeline.ts` - the recompute (`evaluatePoints`). Works on an "at most one
  request in flight" principle: however many edits arrive, only one calculation is ever
  in flight to the worker at a time, but the latest one always runs to completion.
- `commands/recompute.ts` - lays the result out into flat buffers (`buildGeometry`) and
  applies the computed color (`applyColorGrid`).
- `signals.ts` - the event bus (on `ferrsign`). The model never renders anything; it just
  reports "points changed", "triangles changed", "the source was replaced wholesale", and
  subscribers - render, the panel, history - react.
- `history.ts` - undo/redo. A snapshot is just source, without even the image, so it is
  cheap; an entire drag gesture collapses into a single step.
- `selectors/` - reading the model from outside. Returns clones so nothing can corrupt
  state outside of commands; the exception is the flat buffers, which are returned by
  reference for speed.

The shape tree (`stack`) is single-level, like collections in Blender: an entry is either
a loose shape or a group with children. A group has "collapse" (view only) and "mute"
(exclude from computation). Order in the stack matters. Structural operations on the tree
live in `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domain (`src/domain/`)

Logic with no DOM and no three.js; the sole exception is `imageSource.ts`, which reads
pixels off a `<canvas>`. Two subtopics:

- `modifiers/` - how each shape becomes points and constraint edges (`ModifierResult`):
  `path.ts` (a polyline or a Catmull-Rom spline), `bezier.ts` (a Bezier curve with
  symmetric handles), `circle.ts`. Shared assembler: `result.ts`.
- Bridges to the native layer: for each WASM crate there is a "facade + worker + client"
  trio. Heavy computation runs in Web Workers, data crosses the boundary as transferable
  arrays, with no copying.

Small pieces: `rng.ts` (deterministic PRNG), `colorGrid.ts` (spatial color lookup),
`groupColor.ts` (a group's color is derived from its name - rename it and it repaints).

### Render (`src/preview/`)

Listens to model events strictly one way, with no back-reference into the model. World
coordinates match image coordinates (Y down), the camera is orthographic.

- `preview.ts` - the coordinator: one scene, one renderer, a set of layers.
- Layers own their own three.js objects: `triangleLayer.ts` (triangles; reuses buffers
  instead of recreating them every frame), `imageLayer.ts` (the source picture),
  `pointLayer.ts` (seed points), `overlayLayer.ts` (editing overlays: selection, handles,
  the draft shape).
- `receiving.ts` - the bridge "model events -> layer calls". This is also where the
  optimization lives: on a "recolored" event only colors update, on a "rebuilt" event both
  positions and colors do.
- `viewport.ts` - camera and screen<->image coordinate conversion (zoom, pan).

### UI (`src/ui/`)

Imperative DOM/canvas with no framework; panels rebuild their own DOM on events. UI state
is never changed directly - only through commands.

- `tools.ts` (`ToolController`) - a finite state machine over "select / draw / drag"
  modes; catches input on the canvas.
- `tools/` - tool implementations: drafts of the shapes being drawn (`*Draft.ts`) and
  `dragSession.ts` - dragging a point; this is where "one recompute per frame" and
  collapsing a gesture into a single undo step live.
- `panel/` - the right-hand panel: the shape tree with groups and drag-and-drop
  (`stackView.ts`, `dnd.ts`).
- The rest - the tool palette, selection and highlighting, hotkeys, toasts.

### Native layer (`crates/`)

Two independent crates; each caches the loaded image itself, so it does not have to be
resent on every call.

- `crates/pipeline/` - geometry: `sobel.rs` (an edge-density map of the picture: sharp
  transitions get denser points), `seeding.rs` (point placement via Bridson's algorithm
  with a variable radius), `triangulate.rs` (constrained Delaunay triangulation, the
  `spade` crate), `contours.rs` (tracing the picture's contours into editable shapes,
  Canny).
- `crates/color/` - color: samples the color under each triangle (average or median) and
  builds a spatial grid for fast lookup. Runs in the color worker.

The parts critical to determinism - the PRNG, seeding, sampling - deliberately match the
former TS implementation bit for bit: one seed yields the same picture on any run.

## Build

- `npm run build:wasm` - for each crate: cargo -> wasm-bindgen (`--target web`) -> wasm-opt
  (`-Oz`). The glue lands in `src/generated/` (gitignored), the `.wasm` is copied to
  `dist/` and fetched at runtime.
- `npm run build` = `build:wasm`, then `rollup -c`. `npm run dev` adds watch (`-w`).
- Deployment is static (GitHub Pages), no backend.

## Summary

The app stores only source: the user edits it through the UI, the model runs it through a
background Rust/WASM pipeline into flat buffers, and render just reflects those buffers.
Everything else follows from this one split.
