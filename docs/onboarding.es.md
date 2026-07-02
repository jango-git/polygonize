# Polygonize - arquitectura

## Prólogo

Polygonize es un editor de imágenes low-poly en el navegador: el usuario dibuja sobre la imagen figuras guía (**modificadores**: líneas, curvas, círculos), y la aplicación siembra puntos en el resto del espacio, triangula y colorea. Lo que esto le aporta al usuario está en el README; este documento trata sobre cómo está construido el código.

Lo principal que hay que entender antes de leer el código: el pipeline es completamente no destructivo. El estado está estrictamente dividido en **source** - lo que define el usuario (imagen, ajustes, árbol de figuras) - y **derived** - puntos, triangulación, colores. Solo el source se almacena y entra en el historial; el derived se recalcula por completo a partir de él en cada cambio y en cada carga, y nunca se guarda.

De esta división se desprende casi toda la demás arquitectura: el deshacer es barato (la instantánea es solo el source), todo es determinista (un mismo source siempre produce el mismo derived), los cálculos pesados se delegan a segundo plano (el derived es costoso de calcular), y los datos fluyen estrictamente en una sola dirección - del source al derived, nunca al revés.

De lo conocido, esto se parece al flujo de datos unidireccional de Redux/Flux - un estado único, cambios solo a través de comandos, los suscriptores reaccionan a eventos - más una capa de estado calculado por encima, como computed/reselect.

## Cinco capas

| Capa | Carpeta | De qué se encarga | Qué conoce |
|---|---|---|---|
| **UI** | `src/ui/` | entrada: dibujo, panel, herramientas, atajos de teclado | el modelo (le envía comandos) |
| **Modelo** | `src/document/` | source + derived, historial, eventos | nada por encima de sí mismo |
| **Dominio** | `src/domain/` | lógica pura: cómo una figura se convierte en puntos, puentes hacia WASM | el modelo lo invoca |
| **Render** | `src/preview/` | dibuja la imagen y los triángulos con three.js | solo escucha al modelo |
| **Nativo** | `crates/` | Rust->WASM: geometría y color pesados | nada, funciones puras |

Hay además varias carpetas auxiliares: `persistence/` (guardado y exportación), `settings/`, `i18n/`.

Regla de flujo: la UI solo modifica el modelo, el render solo lee el modelo, entre ellos no se comunican directamente. Los conecta un bus de eventos dentro del modelo - eso es precisamente el ciclo unidireccional.

## Flujo de datos

El escenario principal - "de un trazo del ratón a los triángulos recoloreados":

```
   usuario              (1) la UI captura la entrada
       |
       v
   (2) un comando modifica el SOURCE: añade o mueve una figura
       |
       v
   (3) recalculo: source -> puntos -> triángulos      [pesado, en un worker en segundo plano]
       |
       v
   (4) el modelo coloca el resultado en buffers planos y emite el evento "listo"
       |
       v
   (5) el render escucha el evento y actualiza la imagen en pantalla
       |
       +--> (6) en paralelo se calcula el color de los triángulos -> otro evento más -> se recolorea
```

Tres técnicas hacen que este ciclo sea ágil:

- **Un recalculo por fotograma.** Al arrastrar, los eventos del ratón llegan a decenas por segundo, pero el recalculo no se lanza más de una vez por fotograma - las posiciones intermedias se descartan.
- **El render nunca espera.** Mientras en segundo plano se calcula el color exacto, los triángulos se muestran de inmediato con un color aproximado; el color definitivo llega como un evento aparte y se aplica encima.
- **Sin asignaciones de memoria innecesarias.** Los triángulos no existen como objetos, sino como arreglos planos de números; tanto el render como la exportación leen esos arreglos directamente.

## Mapa de tareas

| Quiero cambiar... | Miro en... |
|---|---|
| el comportamiento de las herramientas de dibujo | `src/ui/tools/` |
| el panel derecho (árbol de figuras, grupos) | `src/ui/panel/` |
| cómo una figura se convierte en puntos | `src/domain/modifiers/` |
| el algoritmo de siembra de puntos / la triangulación | `crates/pipeline/` |
| cómo se calcula el color de un triángulo | `crates/color/` |
| el dibujado, la cámara, las superposiciones | `src/preview/` |
| el formato de guardado / deshacer | `src/document/` |
| el guardado en disco / exportación a SVG, PDF, PNG | `src/persistence/` |

## Detalles por capa

### Modelo (`src/document/`)

El estado es un único objeto `DocumentData` (`types.ts`), dividido exactamente por esta frontera:

- **Source** (se guarda, está en el historial): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (árbol de figuras).
- **Derived** (se recalcula, no se guarda): `points` y los buffers planos de render - `renderPositions` (xyz por vértice), `renderColors` (rgb por triángulo), `triangleCount`.

Cómo atraviesa el modelo un cambio:

- `store.ts` - el único objeto de estado mutable (`store.data()`).
- `commands/` - la única forma de modificarlo, análogo a los reducers. Un comando modifica el source in situ y llama a un commit: `commit.ts` decide si hace falta un recalculo (`commitStructural` para cambios de geometría) o basta con registrar un paso de historial (`commitViewOnly`, por ejemplo colapsar una carpeta).
- `commands/pipeline.ts` - el recalculo (`evaluatePoints`). Funciona con el principio de "una sola solicitud en vuelo": por muchos cambios que lleguen, al worker solo va un cálculo a la vez, pero el último siempre se lleva hasta el final.
- `commands/recompute.ts` - la distribución del resultado en los buffers planos (`buildGeometry`) y la aplicación del color calculado (`applyColorGrid`).
- `signals.ts` - el bus de eventos (sobre `ferrsign`). El modelo no dibuja nada; solo informa de que "los puntos cambiaron", "los triángulos cambiaron", "el source se reemplazó por completo", y los suscriptores - el render, el panel, el historial - reaccionan.
- `history.ts` - deshacer/rehacer. Una instantánea es solo el source, ni siquiera incluye la imagen, así que es barata; un gesto completo de arrastre se colapsa en un solo paso.
- `selectors/` - lectura del modelo hacia afuera. Devuelve copias para que nadie corrompa el estado por fuera de los comandos; la excepción son los buffers planos, que se devuelven por referencia por razones de rendimiento.

El árbol de figuras (`stack`) es de un solo nivel, como las colecciones en Blender: un elemento es o bien una figura suelta o bien un grupo con hijos. Un grupo puede "colapsarse" (solo la vista) o "silenciarse" (excluirse del cálculo). El orden en la pila es significativo. Las operaciones estructurales sobre el árbol están en `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Dominio (`src/domain/`)

Lógica sin DOM ni three.js; la única excepción es `imageSource.ts`, que lee los píxeles desde un `<canvas>`. Dos subtemas:

- `modifiers/` - cómo cada figura se convierte en puntos y aristas de restricción (`ModifierResult`): `path.ts` (polilínea o spline de Catmull-Rom), `bezier.ts` (curva de Bezier con manijas simétricas), `circle.ts`. El ensamblador común es `result.ts`.
- Puentes hacia la capa nativa: para cada crate de WASM hay un trío "fachada + worker + cliente". Los cálculos pesados van a Web Workers, los datos cruzan la frontera como arreglos transferibles, sin copia.

Detalles menores: `rng.ts` (GPSA determinista), `colorGrid.ts` (búsqueda espacial de color), `groupColor.ts` (el color del grupo se deriva de su nombre - lo renombraste, así que se recoloreó).

### Render (`src/preview/`)

Escucha los eventos del modelo estrictamente en una sola dirección, no hay referencia inversa hacia el modelo. Las coordenadas del mundo coinciden con las coordenadas de la imagen (Y hacia abajo), la cámara es ortográfica.

- `preview.ts` - el coordinador: una escena, un renderer, un conjunto de capas.
- Las capas poseen sus propios objetos de three.js: `triangleLayer.ts` (triángulos; reutiliza los buffers en lugar de recrearlos en cada fotograma), `imageLayer.ts` (la imagen original), `pointLayer.ts` (puntos de siembra), `overlayLayer.ts` (superposiciones de edición: selección, manijas, borrador).
- `receiving.ts` - el puente "eventos del modelo -> llamadas a las capas". Aquí también está la optimización: ante el evento "recoloreado" solo se actualizan los colores, ante "reconstruido" se actualizan tanto las posiciones como los colores.
- `viewport.ts` - la cámara y la conversión de coordenadas pantalla<->imagen (zoom, panorámica).

### UI (`src/ui/`)

DOM/canvas imperativo sin framework; los paneles reconstruyen su DOM en respuesta a eventos. El estado de la UI nunca se modifica directamente, solo a través de comandos.

- `tools.ts` (`ToolController`) - una máquina de estados con los modos "selección / dibujo / arrastre"; captura la entrada en el lienzo.
- `tools/` - la implementación de las herramientas: borradores de las figuras que se dibujan (`*Draft.ts`) y `dragSession.ts` - el arrastre de un punto; aquí viven el "un recalculo por fotograma" y el colapso de un gesto en un solo paso de deshacer.
- `panel/` - el panel derecho: el árbol de figuras con grupos y arrastrar-y-soltar (`stackView.ts`, `dnd.ts`).
- El resto - la paleta de herramientas, la selección y el resaltado, los atajos de teclado, las notificaciones.

### Capa nativa (`crates/`)

Dos crates independientes; cada uno cachea la imagen cargada internamente, para no reenviarla en cada llamada.

- `crates/pipeline/` - geometría: `sobel.rs` (mapa de densidad según los bordes de la imagen: donde hay un cambio brusco, los puntos son más densos), `seeding.rs` (distribución de puntos por el método de Bridson con radio variable), `triangulate.rs` (triangulación de Delaunay con restricciones, crate `spade`), `contours.rs` (trazado de contornos de la imagen a figuras editables, Canny).
- `crates/color/` - color: muestrea el color bajo cada triángulo (promedio o mediana) y construye una malla espacial para búsquedas rápidas. Funciona en el worker de color.

Las partes críticas para el determinismo - el GPSA, la siembra, el muestreo - coinciden deliberadamente bit a bit con la antigua implementación en TS: una misma seed produce siempre la misma imagen en cualquier ejecución.

## Compilación

- `npm run build:wasm` - para cada crate: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). El código de enlace se coloca en `src/generated/` (en gitignore), el `.wasm` se copia a `dist/` y se carga en tiempo de ejecución.
- `npm run build` = `build:wasm`, luego `rollup -c`. `npm run dev` añade watch (`-w`).
- El despliegue es estático (GitHub Pages), sin backend.

## Resumen

La aplicación solo almacena el source: el usuario lo modifica a través de la UI, el modelo lo hace pasar por el pipeline de Rust/WASM en segundo plano hacia los buffers planos, y el render simplemente refleja esos buffers. Todo lo demás es consecuencia de esta única división.
