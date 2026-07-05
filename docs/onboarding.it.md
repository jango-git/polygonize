# Tesselot - architettura

## Premessa

Tesselot è un editor da browser per immagini low-poly: l'utente disegna sopra l'immagine delle figure guida (**modificatori**: linee, curve, cerchi), e l'applicazione semina di punti lo spazio restante, triangola e colora. Cosa offre questo all'utente è spiegato nel README; questo documento riguarda la struttura del codice.

La cosa principale da capire prima di leggere il codice: la pipeline è completamente non distruttiva. Lo stato è rigidamente diviso in **source** - ciò che l'utente ha impostato (immagine, impostazioni, albero delle figure) - e **derived** - punti, triangolazione, colori. Nella persistenza e nella cronologia finisce solo il source; il derived viene ricalcolato da esso a ogni modifica e a ogni caricamento e non viene mai salvato.

Da questa separazione discende quasi tutta l'architettura rimanente: l'undo è economico (lo snapshot è solo il source), tutto è deterministico (un source dà sempre lo stesso derived), i calcoli pesanti sono spostati in background (il derived è costoso da calcolare), e i dati fluiscono rigorosamente in una sola direzione - dal source al derived, mai al contrario.

Per chi conosce il pattern, è simile al flusso di dati unidirezionale di Redux/Flux - stato unico, modifiche solo tramite comandi, gli abbonati reagiscono agli eventi - più uno strato di stato calcolato sopra, come computed/reselect.

## Cinque strati

| Strato | Cartella | Di cosa si occupa | Cosa conosce |
|---|---|---|---|
| **UI** | `src/ui/` | input: disegno, pannello, strumenti, scorciatoie | il modello (gli invia comandi) |
| **Modello** | `src/document/` | source + derived, cronologia, eventi | niente al di sopra di sé |
| **Dominio** | `src/domain/` | logica pura: come una figura diventa punti, ponti verso WASM | il modello lo invoca |
| **Rendering** | `src/preview/` | disegna l'immagine e i triangoli su three.js | ascolta solo il modello |
| **Nativo** | `crates/` | Rust->WASM: geometria pesante e colore | nulla, funzioni pure |

Ci sono anche alcune cartelle di supporto: `persistence/` (salvataggio ed esportazione), `settings/`, `i18n/`.

Regola del flusso: la UI modifica solo il modello, il rendering legge solo il modello, e i due non comunicano mai direttamente. A collegarli è il bus di eventi interno al modello - questo è il ciclo unidirezionale.

## Flusso dei dati

Lo scenario principale - "dal tratto del mouse ai triangoli ricolorati":

```
   utente               (1) la UI intercetta l'input
       |
       v
   (2) un comando modifica il SOURCE: aggiunge/sposta una figura
       |
       v
   (3) ricalcolo: source -> punti -> triangoli      [pesante, in un worker in background]
       |
       v
   (4) il modello scrive il risultato in buffer piatti e invia l'evento "pronto"
       |
       v
   (5) il rendering ascolta l'evento e aggiorna l'immagine a schermo
       |
       +--> (6) in parallelo si calcola il colore dei triangoli -> un altro evento -> ricolorazione
```

A rendere reattivo questo ciclo sono tre accorgimenti:

- **Un ricalcolo per frame.** Durante il trascinamento gli eventi del mouse arrivano a decine al secondo, ma il ricalcolo parte al massimo una volta per frame - le posizioni intermedie vengono scartate.
- **Il rendering non aspetta mai.** Mentre in background si calcola il colore preciso, i triangoli vengono mostrati subito con un colore approssimativo; il colore definitivo arriva con un evento separato e si sovrappone.
- **Nessuna allocazione superflua.** I triangoli non vivono come oggetti, ma come lunghi array piatti di numeri; sia il rendering sia l'esportazione leggono questi array direttamente.

## Mappa dei compiti

| Voglio modificare... | Guardo in... |
|---|---|
| il comportamento degli strumenti di disegno | `src/ui/tools/` |
| il pannello destro (albero delle figure, gruppi) | `src/ui/panel/` |
| come una figura diventa punti | `src/domain/modifiers/` |
| l'algoritmo di semina dei punti / la triangolazione | `crates/pipeline/` |
| come viene calcolato il colore di un triangolo | `crates/color/` |
| il rendering, la camera, gli overlay | `src/preview/` |
| il formato di salvataggio / l'undo | `src/document/` |
| il salvataggio su disco / l'esportazione SVG, PDF, PNG | `src/persistence/` |

## Dettagli per strato

### Modello (`src/document/`)

Lo stato è un unico oggetto `DocumentData` (`types.ts`), diviso esattamente lungo questo confine:

- **Source** (salvato, presente nella cronologia): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (l'albero delle figure).
- **Derived** (ricalcolato, non salvato): `points` e i buffer piatti di rendering - `renderPositions` (xyz per vertice), `renderColors` (rgb per triangolo), `triangleCount`.

Come una modifica attraversa il modello:

- `store.ts` - l'unico oggetto di stato mutabile (`store.data()`).
- `commands/` - l'unico modo per modificarlo, l'analogo dei reducer. Un comando corregge il source sul posto e invoca il commit: `commit.ts` decide se serve un ricalcolo (`commitStructural` per le modifiche alla geometria) o se basta registrare un passo nella cronologia (`commitViewOnly`, ad esempio comprimere una cartella).
- `commands/pipeline.ts` - il ricalcolo (`evaluatePoints`). Funziona secondo il principio "una sola richiesta in volo": per quante modifiche arrivino, al worker viene inviato un solo calcolo alla volta, ma l'ultimo viene sempre portato a termine.
- `commands/recompute.ts` - la distribuzione del risultato nei buffer piatti (`buildGeometry`) e l'applicazione del colore calcolato (`applyColorGrid`).
- `signals.ts` - il bus di eventi (basato su `ferrsign`). Il modello non renderizza nulla; comunica solo che "i punti sono cambiati", "i triangoli sono cambiati", "il source è stato sostituito interamente", e gli abbonati - il rendering, il pannello, la cronologia - reagiscono.
- `history.ts` - undo/redo. Lo snapshot è solo il source, senza nemmeno l'immagine, quindi è economico; un intero gesto di trascinamento collassa in un solo passo.
- `selectors/` - la lettura del modello verso l'esterno. Restituisce cloni, perché nessuno possa alterare lo stato al di fuori dei comandi; l'eccezione sono i buffer piatti, che vengono restituiti per riferimento per motivi di velocità.

L'albero delle figure (`stack`) è a un solo livello, come le collection in Blender: un elemento è o una figura libera, o un gruppo con figli. Un gruppo può essere "compresso" (solo a livello visivo) o "silenziato" (escluso dal calcolo). L'ordine nello stack è significativo. Le operazioni strutturali sull'albero sono in `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Dominio (`src/domain/`)

Logica priva di DOM e three.js; l'unica eccezione è `imageSource.ts`, che legge i pixel da un `<canvas>`. Due sottotemi:

- `modifiers/` - come ogni figura diventa punti e bordi vincolo (`ModifierResult`): `path.ts` (spezzata o spline di Catmull-Rom), `bezier.ts` (curva di Bezier con maniglie simmetriche), `circle.ts`. L'assemblatore comune è `result.ts`.
- Ponti verso lo strato nativo: per ogni crate WASM esiste una tripletta "facciata + worker + client". I calcoli pesanti vengono eseguiti in Web Worker, i dati attraversano il confine come array transferable, senza copia.

Dettagli minori: `rng.ts` (generatore di numeri pseudocasuali deterministico), `colorGrid.ts` (ricerca spaziale del colore), `groupColor.ts` (il colore di un gruppo deriva dal suo nome - rinomini, quindi ricolori).

### Rendering (`src/preview/`)

Ascolta gli eventi del modello rigorosamente in un'unica direzione, non c'è alcun riferimento inverso al modello. Le coordinate del mondo coincidono con quelle dell'immagine (Y verso il basso), la camera è ortografica.

- `preview.ts` - il coordinatore: una scena, un renderer, un insieme di layer.
- I layer possiedono i propri oggetti three.js: `triangleLayer.ts` (i triangoli; riutilizza i buffer invece di ricrearli a ogni frame), `imageLayer.ts` (l'immagine sorgente), `pointLayer.ts` (i punti di semina), `overlayLayer.ts` (gli overlay di editing: selezione, maniglie, bozza).
- `receiving.ts` - il ponte "eventi del modello -> chiamate ai layer". Qui c'è anche l'ottimizzazione: sull'evento "ricolorato" vengono aggiornati solo i colori, su "ricostruito" - sia le posizioni sia i colori.
- `viewport.ts` - la camera e la conversione delle coordinate schermo<->immagine (zoom, panoramica).

### UI (`src/ui/`)

DOM/canvas imperativo senza framework; i pannelli ricostruiscono il proprio DOM in risposta agli eventi. Lo stato della UI non viene mai modificato direttamente - solo tramite comandi.

- `tools.ts` (`ToolController`) - una macchina a stati per le modalità "selezione / disegno / trascinamento"; intercetta l'input sul canvas.
- `tools/` - l'implementazione degli strumenti: bozze delle figure in disegno (`*Draft.ts`) e `dragSession.ts` - il trascinamento di un punto; qui vivono "un ricalcolo per frame" e il collasso di un gesto in un solo passo di undo.
- `panel/` - il pannello destro: l'albero delle figure con gruppi e drag-and-drop (`stackView.ts`, `dnd.ts`).
- Il resto - la palette degli strumenti, selezione ed evidenziazione, scorciatoie, notifiche.

### Strato nativo (`crates/`)

Due crate indipendenti; ciascuno mette in cache l'immagine caricata al proprio interno, per non doverla ritrasmettere a ogni chiamata.

- `crates/pipeline/` - geometria: `sobel.rs` (mappa di densità basata sui bordi dell'immagine: dove il salto è netto, i punti sono più fitti), `seeding.rs` (distribuzione dei punti con il metodo di Bridson a raggio variabile), `triangulate.rs` (triangolazione di Delaunay vincolata, crate `spade`), `contours.rs` (tracciamento dei contorni dell'immagine in figure modificabili, Canny).
- `crates/color/` - colore: campiona il colore sotto ogni triangolo (media o mediana) e costruisce una griglia spaziale per la ricerca rapida. Funziona nel worker del colore.

Le parti critiche per il determinismo - il generatore pseudocasuale, la semina, il campionamento - coincidono intenzionalmente bit a bit con la precedente implementazione TS: lo stesso seed produce la stessa immagine a ogni esecuzione.

## Build

- `npm run build:wasm` - per ogni crate: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Il codice di collegamento viene messo in `src/generated/` (nel gitignore), il `.wasm` viene copiato in `dist/` e caricato a runtime.
- `npm run build` = `build:wasm`, poi `rollup -c`. `npm run dev` aggiunge il watch (`-w`).
- Il deploy è statico (GitHub Pages), senza backend.

## Conclusione

L'applicazione conserva solo il source: l'utente lo modifica tramite la UI, il modello lo fa passare attraverso la pipeline Rust/WASM in background verso buffer piatti, e il rendering si limita a riflettere questi buffer. Tutto il resto è una conseguenza di questa singola separazione.
