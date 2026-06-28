# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · **es** · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un editor de imágenes low-poly que funciona en el navegador. Carga una foto, ajusta la triangulación, refina los bordes con modificadores de forma y expórtala como SVG o PNG.

**[EDITOR](https://jango-git.github.io/polygonize/)**

![Captura de pantalla](../image.png)

## Características

- **Sembrado inteligente de puntos** - Muestreo por disco de Poisson de Bridson con radio variable guiado por la detección de bordes de Sobel: los bordes reciben un radio mínimo ajustado (triángulos densos) y las zonas planas un radio máximo holgado (triángulos dispersos). La generación es totalmente determinista, así que una misma semilla reproduce la misma malla
- **Pila de modificadores** - Capas no destructivas de polilínea, círculo y curva Catmull-Rom añaden aristas de restricción sobre la malla base; reordénalas o agrúpalas libremente arrastrando y soltando
- **Muestreo de color** - Color promedio o mediano de los píxeles por triángulo; degradado opcional por vértice
- **Exportación** - SVG o PDF vectorial, o PNG, JPG o WebP rasterizado hasta 4096px
- **Proyectos** - Guarda y restaura tu trabajo como `.json`; la sesión se guarda automáticamente en localStorage
- **Interfaz localizada** - 21 idiomas de interfaz, detectados automáticamente desde el navegador y conmutables en la barra superior

## Atajos de teclado

| Tecla   | Acción                          |
| ------- | ------------------------------- |
| `~`     | Cursor (seleccionar)            |
| `1`     | Herramienta de polilínea        |
| `2`     | Herramienta de curva Catmull-Rom |
| `3`     | Herramienta de círculo (centro y radio) |
| `4`     | Herramienta de círculo (3 puntos) |
| `Q`     | Alternar opacidad del fondo     |
| `W`     | Alternar opacidad de los puntos |
| `E`     | Alternar capa de picos          |
| `F`     | Ajustar imagen a la vista       |
| `Space` | Aplicar trazado abierto         |
| `Esc`   | Cancelar dibujo / deseleccionar |

## Desarrollo

```sh
npm install
npm run dev    # servidor de desarrollo en http://localhost:3000
npm run build  # genera dist/bundle.js
```

## Licencia

[MIT](../LICENSE)
