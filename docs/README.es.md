# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · **es** · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un editor en el navegador que convierte una fotografía en una imagen low-poly compuesta de triángulos. Se diferencia de los generadores comunes en lo esencial: sobre la malla generada, tú mismo dibujas guías, y los bordes de los triángulos las siguen. Los contornos importantes - la línea de la mandíbula, la montura de unas gafas, una silueta - permanecen nítidos en lugar de perderse en una malla aleatoria.

**[ABRIR EDITOR](https://jango-git.github.io/tesselot/)**

![Captura de pantalla](../image.png)

## Que puede hacer

- **Guías.** Dibujas líneas, círculos y curvas suaves sobre la imagen - los triángulos se alinean con ellas. No es una operación puntual, sino modificadores: en cualquier momento se pueden mover, ajustar su detalle o agrupar.
- **Una malla que se adapta a los detalles.** Donde hay muchos detalles y bordes marcados, los triángulos son más pequeños; en zonas uniformes como el cielo, más grandes. La imagen resulta detallada donde hace falta y tranquila en el resto.
- **Trazado automático.** Para no empezar desde cero, pulsa "Trazar": el editor encuentra los bordes de la imagen y los convierte en modificadores editables, agrupados en un grupo aparte.
- **Color de los triángulos.** Cada triángulo se rellena con el color promedio de los píxeles que hay debajo - o el color mediano, si se necesita atenuar valores atípicos muy brillantes.
- **Exportación.** Vector (SVG, PDF) o rasterizado (PNG, JPG, WebP) hasta 4096 píxeles.
- **Proyectos.** Guarda tu trabajo en un archivo `.json` y vuelve a él más tarde. La sesión actual también se restaura sola, incluso si simplemente cerraste la pestaña.
- **Interfaz en 21 idiomas.** El idioma se detecta por el navegador y se cambia en la barra superior.

## Por dentro

Los puntos se distribuyen mediante muestreo de disco de Poisson (algoritmo de Bridson) con radio variable - lo determina un mapa de bordes de Sobel, por lo que la malla es más densa a lo largo de los contornos. La generación es determinista: la misma semilla produce siempre la misma malla. Todo el pipeline geométrico pesado - el mapa de bordes, la distribución de puntos, la triangulación - está reunido en un módulo WASM escrito en Rust; el color de los triángulos se calcula por separado, en un Web Worker.

Si vas a leer el código fuente, empieza por la [descripción general de la arquitectura](onboarding.es.md).

## Desarrollo

```sh
npm install
npm run dev    # servidor de desarrollo en http://localhost:3000
npm run build  # genera dist/bundle.js
```

## Licencia

[MIT](../LICENSE)
