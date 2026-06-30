# <img src="logo.svg" alt="" height="28" align="absmiddle"> Polygonize

**en** · [zh-Hans](docs/README.zh-Hans.md) · [hi](docs/README.hi.md) · [es](docs/README.es.md) · [fr](docs/README.fr.md) · [bn](docs/README.bn.md) · [pt](docs/README.pt.md) · [ru](docs/README.ru.md) · [id](docs/README.id.md) · [de](docs/README.de.md) · [ja](docs/README.ja.md) · [tr](docs/README.tr.md) · [vi](docs/README.vi.md) · [ko](docs/README.ko.md) · [it](docs/README.it.md) · [pl](docs/README.pl.md) · [uk](docs/README.uk.md) · [uz](docs/README.uz.md) · [az](docs/README.az.md) · [kk](docs/README.kk.md) · [be](docs/README.be.md)

A browser-based editor that turns a photo into low-poly art (a picture built from triangles). What sets it apart from the usual generators is the thing that matters most: on top of the base generated mesh, you can draw your own guides, and the triangle edges follow along them. So the contours that count - a jawline, the frame of a pair of glasses, a silhouette - stay crisp instead of getting lost in a random mesh. Save the finished result as vector (SVG, PDF) or as an image (PNG, JPG, WebP).

**[OPEN EDITOR](https://jango-git.github.io/polygonize/)**

![Screenshot](image.png)

## What it can do

- **Guides you draw yourself.** Trace lines, circles, and smooth curves over the image - and the triangles fall into line along them. These are separate modifiers sitting on top of the picture, so at any moment you can move them, change their detail settings, or group them.
- **The mesh adapts to detail.** Where there is fine detail and sharp edges, the triangles are smaller; over flat stretches like sky or background, they are larger. The picture comes out detailed where it needs to be and calm everywhere else. And the result is predictably reproducible: with the same settings you get exactly the same mesh.
- **Auto-tracing as a starting point.** So you don't start from a blank slate, press "Trace image" - the editor finds the image's edges itself and turns them into editable modifiers, gathered in their own group.
- **Triangle color.** Each triangle is filled with the average color of the pixels beneath it - or the median, if you want to tame bright outliers.
- **Export.** Vector (SVG, PDF) or raster (PNG, JPG, WebP) up to 4096 pixels.
- **Projects.** Save your work to a `.json` file and come back to it later. And the current session restores itself anyway, even if you just closed the tab.
- **Interface in 21 languages.** The language is detected from your browser and switched in the top bar.

## Keyboard shortcuts

| Key     | Action                        |
| ------- | ----------------------------- |
| `~`     | Cursor (select)               |
| `1`     | Polyline tool                 |
| `2`     | Catmull-Rom curve tool        |
| `3`     | Bezier pen tool               |
| `4`     | Circle tool (center & radius) |
| `5`     | Circle tool (3 points)        |
| `Q`     | Flip background opacity       |
| `W`     | Flip point opacity            |
| `E`     | Flip spike overlay            |
| `F`     | Fit image to view             |
| `Space` | Apply open path               |
| `Esc`   | Cancel drawing / deselect     |

## Under the hood

For the curious: points are placed by Poisson-disk sampling (Bridson's algorithm) with a variable radius - set by a Sobel edge map, so the mesh is denser along contours. Generation is deterministic: the same seed yields the same mesh.
The whole heavy geometry pipeline - edge map, point placement, and the triangulation itself - is bundled into a WASM module written in Rust. Triangle color is computed separately, in a Web Worker.

## Development

```sh
npm install
npm run dev    # dev server on http://localhost:3000
npm run build  # outputs dist/bundle.js
```

## License

[MIT](LICENSE)
