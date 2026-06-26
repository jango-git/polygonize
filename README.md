# Polygonize

A browser-based low-poly image editor. Load a photo, tune the triangulation, refine edges with shape modifiers, export as SVG or PNG.

**[EDITOR](https://jango-git.github.io/polygonize/)**

![Screenshot](image.webp)

## Features

- **Smart point seeding** - Sobel edge detection places triangles where detail matters; tune density, edge attraction, and minimum spacing
- **Modifier stack** - Non-destructive polyline, circle, and Catmull-Rom curve layers add constraint edges on top of the base mesh; reorder or group them freely with drag-and-drop
- **Color sampling** - Average or median pixel color per triangle; optional per-vertex gradient
- **Export** - Scalable SVG or rasterized PNG up to 4096px
- **Projects** - Save and restore work as `.json`; session auto-saves to localStorage

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` | Polyline tool |
| `2` | Circle tool |
| `3` | Catmull-Rom curve tool |
| `Space` | Finish open path |
| `Esc` | Cancel drawing |
| `Q` | Toggle background image |
| `W` | Toggle point overlay |

## Development

```sh
npm install
npm run dev    # dev server on http://localhost:3000
npm run build  # outputs dist/bundle.js
```

## License

[MIT](LICENSE)
