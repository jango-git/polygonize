# Polygonize

**en** · [zh-Hans](docs/README.zh-Hans.md) · [hi](docs/README.hi.md) · [es](docs/README.es.md) · [fr](docs/README.fr.md) · [bn](docs/README.bn.md) · [pt](docs/README.pt.md) · [ru](docs/README.ru.md) · [id](docs/README.id.md) · [de](docs/README.de.md) · [ja](docs/README.ja.md) · [tr](docs/README.tr.md) · [vi](docs/README.vi.md) · [ko](docs/README.ko.md) · [it](docs/README.it.md) · [pl](docs/README.pl.md) · [uk](docs/README.uk.md) · [uz](docs/README.uz.md) · [az](docs/README.az.md) · [kk](docs/README.kk.md) · [be](docs/README.be.md)

A browser-based low-poly image editor. Load a photo, tune the triangulation, refine edges with shape modifiers, export as SVG or PNG.

**[EDITOR](https://jango-git.github.io/polygonize/)**

![Screenshot](image.png)

## Features

- **Smart point seeding** - Bridson Poisson disk sampling with variable radius driven by Sobel edge detection: edges get a tight minimum radius (dense triangles), flat areas get a loose maximum radius (sparse triangles). Generation is fully seeded, so a given seed reproduces the same mesh
- **Modifier stack** - Non-destructive polyline, circle, and Catmull-Rom curve layers add constraint edges on top of the base mesh; reorder or group them freely with drag-and-drop
- **Color sampling** - Average or median pixel color per triangle; optional per-vertex gradient
- **Export** - Vector SVG or PDF, or rasterized PNG, JPG, or WebP up to 4096px
- **Projects** - Save and restore work as `.json`; session auto-saves to localStorage
- **Localized UI** - 21 interface languages, auto-detected from the browser and switchable in the top bar

## Keyboard shortcuts

| Key     | Action                        |
| ------- | ----------------------------- |
| `~`     | Cursor (select)               |
| `1`     | Polyline tool                 |
| `2`     | Catmull-Rom curve tool        |
| `3`     | Circle tool (center & radius) |
| `4`     | Circle tool (3 points)        |
| `Q`     | Flip background opacity       |
| `W`     | Flip point opacity            |
| `E`     | Flip spike overlay            |
| `F`     | Fit image to view             |
| `Space` | Apply open path               |
| `Esc`   | Cancel drawing / deselect     |

## Development

```sh
npm install
npm run dev    # dev server on http://localhost:3000
npm run build  # outputs dist/bundle.js
```

## License

[MIT](LICENSE)
