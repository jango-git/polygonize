# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · **es** · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un editor en el navegador que te permite convertir una foto en low-poly (una imagen compuesta de triángulos). Lo que lo diferencia de los generadores habituales es lo esencial: además de la malla generada de base, tú mismo puedes dibujar guías, y los bordes de los triángulos las seguirán. Por eso los contornos importantes - la línea de la barbilla, la montura de las gafas, una silueta - se mantienen nítidos en lugar de perderse en una malla aleatoria. El resultado final puedes guardarlo en vector (SVG, PDF) o en imagen (PNG, JPG, WebP).

**[ABRIR EL EDITOR](https://jango-git.github.io/polygonize/)**

![Captura de pantalla](../image.png)

## Qué puede hacer

- **Guías que tú mismo dibujas.** Trazas líneas, círculos, curvas suaves sobre la imagen, y los triángulos se alinean a lo largo de ellas. Son modificadores independientes encima de la imagen, así que en cualquier momento puedes moverlos, cambiar sus parámetros de detalle o agruparlos.
- **La malla se adapta a los detalles.** Donde hay muchos detalles finos y bordes marcados, los triángulos son más pequeños; en zonas uniformes como el cielo o el fondo, más grandes. La imagen sale detallada donde hace falta y tranquila en el resto. Y el resultado es reproducible de forma predecible: con los mismos ajustes la malla queda exactamente igual.
- **Trazado automático como punto de partida.** Para que no empieces desde cero, pulsa "Trazar imagen" - el editor encuentra por sí mismo los bordes de la imagen y los convierte en modificadores editables, reunidos en su propio grupo.
- **Color de los triángulos.** Cada triángulo se rellena con el color medio de los píxeles que tiene debajo, o con el mediano si quieres atenuar los valores extremos demasiado brillantes.
- **Exportación.** Vector (SVG, PDF) o ráster (PNG, JPG, WebP) hasta 4096 píxeles.
- **Proyectos.** Guarda tu trabajo en un archivo `.json` y vuelve a él más tarde. Y además la sesión actual se restaura sola, aunque solo hayas cerrado la pestaña.
- **Interfaz en 21 idiomas.** El idioma se detecta según el navegador y se cambia en la barra superior.

## Atajos de teclado

| Tecla   | Acción                                              |
| ------- | --------------------------------------------------- |
| `~`     | Cursor (selección)                                  |
| `1`     | Herramienta "Polilínea"                             |
| `2`     | Herramienta "Curva"                                 |
| `3`     | Círculo (centro y radio)                            |
| `4`     | Círculo (3 puntos)                                  |
| `Q`     | Invertir la opacidad del fondo                      |
| `W`     | Invertir la opacidad de los puntos                  |
| `E`     | Invertir la opacidad de los triángulos degenerados  |
| `F`     | Centrar la imagen                                   |
| `Space` | Finalizar el trazado abierto                        |
| `Esc`   | Cancelar el dibujo / deseleccionar                  |

## Bajo el capó

Para los curiosos: los puntos se distribuyen mediante muestreo por disco de Poisson (algoritmo de Bridson) con radio variable, definido por el mapa de bordes de Sobel, por eso a lo largo de los contornos la malla es más densa. La generación es determinista: el mismo seed produce siempre la misma malla.
Todo el pesado pipeline geométrico - el mapa de bordes, la distribución de puntos y la propia triangulación - está reunido en un módulo WASM escrito en Rust. El color de los triángulos se calcula aparte, en un Web Worker.

## Desarrollo

```sh
npm install
npm run dev    # servidor de desarrollo en http://localhost:3000
npm run build  # genera dist/bundle.js
```

## Licencia

[MIT](../LICENSE)
