# Tesselot - Architektur

## Vorwort

Tesselot ist ein Browser-Editor für Low-Poly-Bilder: Der Nutzer zeichnet über das Bild Hilfsformen (**Modifikatoren**: Linien, Kurven, Kreise), und die Anwendung sät den Rest der Fläche mit Punkten, trianguliert und färbt ein. Was das dem Nutzer bringt, steht im README; dieses Dokument beschreibt den Aufbau des Codes.

Das Wichtigste, das man vor dem Lesen des Codes verstehen sollte: Die Pipeline ist vollständig nicht-destruktiv. Der Zustand ist strikt aufgeteilt in **source** - das, was der Nutzer vorgibt (Bild, Einstellungen, Formenbaum) - und **derived** - Punkte, Triangulation, Farben. Gespeichert wird und in die History gelangt nur die source; die derived wird bei jeder Änderung und jedem Laden neu aus ihr berechnet und niemals gespeichert.

Aus dieser Trennung folgt fast die gesamte übrige Architektur: Undo ist billig (der Snapshot ist nur die source), alles ist deterministisch (eine source liefert immer dieselbe derived), aufwendige Berechnungen laufen im Hintergrund (derived ist teuer zu berechnen), und die Daten fließen strikt in eine Richtung - von source zu derived, niemals zurück.

Von bekannten Konzepten her ähnelt das dem unidirektionalen Datenfluss von Redux/Flux - ein einziger Zustand, Änderungen nur über Kommandos, Abonnenten reagieren auf Ereignisse - plus einer Schicht berechneten Zustands darüber, wie computed/reselect.

## Fünf Schichten

| Schicht | Ordner | Zuständigkeit | Kennt |
|---|---|---|---|
| **UI** | `src/ui/` | Eingabe: Zeichnen, Panel, Werkzeuge, Hotkeys | das Modell (sendet Kommandos) |
| **Modell** | `src/document/` | source + derived, History, Ereignisse | nichts oberhalb von sich selbst |
| **Domäne** | `src/domain/` | reine Logik: wie eine Form zu Punkten wird, Brücken zu WASM | wird vom Modell aufgerufen |
| **Rendering** | `src/preview/` | zeichnet Bild und Dreiecke mit three.js | hört nur auf das Modell |
| **Nativ** | `crates/` | Rust->WASM: aufwendige Geometrie und Farbe | nichts, reine Funktionen |

Es gibt noch ein paar Hilfsordner: `persistence/` (Speichern und Export), `settings/`, `i18n/`.

Die Flussregel: Das UI ändert nur das Modell, das Rendering liest nur das Modell, direkt kommunizieren sie nicht miteinander. Verbunden werden sie durch einen Ereignisbus innerhalb des Modells - das ist der unidirektionale Kreislauf.

## Datenfluss

Das Hauptszenario - "vom Mausstrich bis zu den neu eingefärbten Dreiecken":

```
   Nutzer               (1) UI fängt die Eingabe ab
       |
       v
   (2) Kommando ändert die SOURCE: Form hinzugefügt/verschoben
       |
       v
   (3) Neuberechnung: source -> Punkte -> Dreiecke      [aufwendig, im Hintergrund-Worker]
       |
       v
   (4) das Modell legt das Ergebnis in flache Puffer und sendet das Ereignis "fertig"
       |
       v
   (5) das Rendering hört das Ereignis und aktualisiert das Bild auf dem Bildschirm
       |
       +--> (6) parallel wird die Farbe der Dreiecke berechnet -> ein weiteres Ereignis -> Neueinfärbung
```

Reaktionsfähig macht diesen Kreislauf ein Dreiklang von Kniffen:

- **Eine Neuberechnung pro Frame.** Beim Ziehen mit der Maus kommen Dutzende Ereignisse pro Sekunde herein, aber die Neuberechnung läuft höchstens einmal pro Frame - Zwischenpositionen werden verworfen.
- **Das Rendering wartet nie.** Während die genaue Farbe im Hintergrund berechnet wird, werden die Dreiecke sofort mit einer Näherungsfarbe angezeigt; die fertige Farbe kommt als separates Ereignis und legt sich darüber.
- **Keine unnötigen Allokationen.** Dreiecke existieren nicht als Objekte, sondern als lange flache Zahlenarrays; sowohl das Rendering als auch der Export lesen diese Arrays direkt.

## Aufgabenkarte

| Ich möchte ändern... | Ich schaue in... |
|---|---|
| das Verhalten der Zeichenwerkzeuge | `src/ui/tools/` |
| das rechte Panel (Formenbaum, Gruppen) | `src/ui/panel/` |
| wie eine Form zu Punkten wird | `src/domain/modifiers/` |
| den Punktsaat-Algorithmus / die Triangulation | `crates/pipeline/` |
| wie die Farbe eines Dreiecks berechnet wird | `crates/color/` |
| Rendering, Kamera, Overlays | `src/preview/` |
| das Speicherformat / Undo | `src/document/` |
| Speichern auf Festplatte / SVG-, PDF-, PNG-Export | `src/persistence/` |

## Details zu den Schichten

### Modell (`src/document/`)

Der Zustand ist ein einzelnes Objekt `DocumentData` (`types.ts`), genau entlang dieser Grenze aufgeteilt:

- **Source** (wird gespeichert, ist in der History): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (der Formenbaum).
- **Derived** (wird neu berechnet, nicht gespeichert): `points` und die flachen Render-Puffer - `renderPositions` (xyz pro Vertex), `renderColors` (rgb pro Dreieck), `triangleCount`.

Wie eine Änderung das Modell durchläuft:

- `store.ts` - das einzige mutierbare Zustandsobjekt (`store.data()`).
- `commands/` - der einzige Weg, es zu ändern, ein Analogon zu Reducern. Ein Kommando bearbeitet die source direkt und ruft einen Commit auf: `commit.ts` entscheidet, ob eine Neuberechnung nötig ist (`commitStructural` für Geometrieänderungen) oder ob es genügt, einen History-Schritt zu erfassen (`commitViewOnly`, zum Beispiel beim Einklappen eines Ordners).
- `commands/pipeline.ts` - die Neuberechnung (`evaluatePoints`). Arbeitet nach dem Prinzip "eine Anfrage gleichzeitig in Flug": Egal wie viele Änderungen eintreffen, an den Worker geht immer nur eine Berechnung gleichzeitig, aber die letzte wird immer zu Ende geführt.
- `commands/recompute.ts` - Aufteilen des Ergebnisses in flache Puffer (`buildGeometry`) und Anwenden der berechneten Farbe (`applyColorGrid`).
- `signals.ts` - der Ereignisbus (auf Basis von `ferrsign`). Das Modell rendert selbst nichts; es meldet nur "Punkte geändert", "Dreiecke geändert", "source komplett ersetzt", und die Abonnenten - Rendering, Panel, History - reagieren darauf.
- `history.ts` - Undo/Redo. Ein Snapshot ist nur die source, sogar ohne das Bild, deshalb ist er billig; eine ganze Ziehgeste wird zu einem einzigen Schritt zusammengefasst.
- `selectors/` - Lesezugriff auf das Modell nach außen. Gibt Klone zurück, damit niemand den Zustand außerhalb der Kommandos verändert; Ausnahme sind die flachen Puffer, die aus Geschwindigkeitsgründen als Referenz zurückgegeben werden.

Der Formenbaum (`stack`) ist einstufig, wie Collections in Blender: ein Element ist entweder eine freie Form oder eine Gruppe mit Kindern. Eine Gruppe kann "eingeklappt" (nur Ansicht) und "stummgeschaltet" (aus der Berechnung ausgeschlossen) werden. Die Reihenfolge im Stack ist bedeutsam. Strukturelle Operationen am Baum liegen in `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domäne (`src/domain/`)

Logik ohne DOM und three.js; die einzige Ausnahme ist `imageSource.ts`, das Pixel von einem `<canvas>` liest. Zwei Unterthemen:

- `modifiers/` - wie jede Form zu Punkten und Constraint-Kanten (`ModifierResult`) wird: `path.ts` (Polylinie oder Catmull-Rom-Spline), `bezier.ts` (Bezierkurve mit symmetrischen Griffen), `circle.ts`. Gemeinsamer Sammler: `result.ts`.
- Brücken zur nativen Schicht: für jede WASM-Crate gibt es ein Trio aus "Fassade + Worker + Client". Aufwendige Berechnungen laufen in Web Workers, Daten überqueren die Grenze als transferierbare Arrays, ohne Kopieren.

Kleinigkeiten: `rng.ts` (deterministischer PRNG), `colorGrid.ts` (räumliche Farbsuche), `groupColor.ts` (die Gruppenfarbe wird aus ihrem Namen abgeleitet - umbenannt heißt umgefärbt).

### Rendering (`src/preview/`)

Hört strikt einseitig auf die Ereignisse des Modells, es gibt keine Rückreferenz ins Modell. Die Weltkoordinaten stimmen mit den Bildkoordinaten überein (Y nach unten), die Kamera ist orthografisch.

- `preview.ts` - der Koordinator: eine Szene, ein Renderer, eine Menge von Layern.
- Layer besitzen ihre eigenen three.js-Objekte: `triangleLayer.ts` (Dreiecke; nutzt Puffer wieder, statt sie bei jedem Frame neu zu erzeugen), `imageLayer.ts` (Ausgangsbild), `pointLayer.ts` (Saatpunkte), `overlayLayer.ts` (Bearbeitungsoverlays: Auswahl, Griffe, Entwurf).
- `receiving.ts` - die Brücke "Modellereignisse -> Layer-Aufrufe". Hier steckt auch die Optimierung: beim Ereignis "neu eingefärbt" werden nur die Farben aktualisiert, bei "neu aufgebaut" - sowohl Positionen als auch Farben.
- `viewport.ts` - Kamera und Umrechnung der Koordinaten Bildschirm<->Bild (Zoom, Schwenken).

### UI (`src/ui/`)

Imperatives DOM/Canvas ohne Framework; Panels bauen ihr DOM anhand von Ereignissen neu auf. Der UI-Zustand ändert das Modell nie direkt - nur über Kommandos.

- `tools.ts` (`ToolController`) - ein Zustandsautomat mit den Modi "Auswahl / Zeichnen / Ziehen"; fängt die Eingabe auf der Leinwand ab.
- `tools/` - die Umsetzung der Werkzeuge: Entwürfe der gezeichneten Formen (`*Draft.ts`) und `dragSession.ts` - das Ziehen eines Punktes; hier liegen "eine Neuberechnung pro Frame" und das Zusammenfassen einer Geste zu einem Undo-Schritt.
- `panel/` - das rechte Panel: der Formenbaum mit Gruppen und Drag-and-Drop (`stackView.ts`, `dnd.ts`).
- Der Rest - Werkzeugpalette, Auswahl und Hervorhebung, Hotkeys, Toasts.

### Native Schicht (`crates/`)

Zwei unabhängige Crates; jede cached das geladene Bild bei sich, um es nicht bei jedem Aufruf erneut zu übertragen.

- `crates/pipeline/` - Geometrie: `sobel.rs` (Dichtekarte anhand der Bildkanten: wo ein scharfer Übergang ist, sind die Punkte dichter), `seeding.rs` (Punktverteilung nach der Bridson-Methode mit variablem Radius), `triangulate.rs` (Delaunay-Triangulation mit Constraints, Crate `spade`), `contours.rs` (Nachzeichnen der Bildkonturen zu bearbeitbaren Formen, Canny).
- `crates/color/` - Farbe: sampelt die Farbe unter jedem Dreieck (Durchschnitt oder Median) und baut ein räumliches Gitter für die schnelle Suche. Läuft im Farb-Worker.

Die für den Determinismus kritischen Teile - PRNG, Saat, Sampling - stimmen absichtlich bit-genau mit der früheren TS-Implementierung überein: ein Seed liefert bei jedem Lauf dasselbe Bild.

## Build

- `npm run build:wasm` - für jede Crate: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Die Bindings werden in `src/generated/` abgelegt (in gitignore), die `.wasm`-Datei wird nach `dist/` kopiert und zur Laufzeit geladen.
- `npm run build` = `build:wasm`, dann `rollup -c`. `npm run dev` fügt Watch (`-w`) hinzu.
- Das Deployment ist statisch (GitHub Pages), ohne Backend.

## Fazit

Die Anwendung speichert nur die source: Der Nutzer bearbeitet sie über das UI, das Modell treibt sie durch die Hintergrund-Rust/WASM-Pipeline zu flachen Puffern, und das Rendering spiegelt nur diese Puffer wider. Alles Übrige ist eine Folge dieser einen Trennung.
