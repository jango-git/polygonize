# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · **it** · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un editor da browser che trasforma una foto in un'immagine low-poly, composta da triangoli. Si distingue dai generatori comuni per una cosa fondamentale: sopra la griglia generata puoi disegnare tu stesso delle guide, e i lati dei triangoli le seguono. I contorni importanti - la linea del mento, la montatura degli occhiali, una silhouette - restano nitidi invece di perdersi in una griglia casuale.

**[APRI L'EDITOR](https://jango-git.github.io/polygonize/)**

![Screenshot](../image.png)

## Cosa sa fare

- **Guide.** Disegni linee, cerchi e curve morbide sopra l'immagine - i triangoli si allineano lungo di esse. Non è un'operazione una tantum, ma dei modificatori: in qualsiasi momento puoi spostarli, cambiarne il dettaglio, raggrupparli.
- **Una griglia che si adatta ai dettagli.** Dove ci sono molti dettagli e bordi netti, i triangoli sono più piccoli; nelle zone uniformi come il cielo, più grandi. L'immagine risulta dettagliata dove serve e tranquilla nel resto.
- **Tracciamento automatico.** Per non partire da zero, premi "Traccia contorni": l'editor troverà i bordi dell'immagine e li trasformerà in modificatori modificabili, raccolti in un gruppo separato.
- **Colore dei triangoli.** Ogni triangolo viene riempito con il colore medio dei pixel sottostanti - o con il colore mediano, se serve attenuare i valori estremi troppo vivaci.
- **Esportazione.** Vettoriale (SVG, PDF) o raster (PNG, JPG, WebP) fino a 4096 pixel.
- **Progetti.** Salva il lavoro in un file `.json` e torna a lavorarci più tardi. La sessione corrente si ripristina anche da sola, anche se hai semplicemente chiuso la scheda.
- **Interfaccia in 21 lingue.** La lingua viene rilevata dal browser e si cambia dalla barra superiore.

## Sotto il cofano

I punti vengono distribuiti con un campionamento a disco di Poisson (algoritmo di Bridson) a raggio variabile, definito da una mappa dei bordi di Sobel, per cui la griglia è più densa lungo i contorni. La generazione è deterministica: lo stesso seed produce sempre la stessa griglia. L'intera pipeline geometrica pesante - mappa dei bordi, distribuzione dei punti, triangolazione - è racchiusa in un modulo WASM scritto in Rust; il colore dei triangoli viene calcolato separatamente, in un Web Worker.

Se hai intenzione di leggere il codice sorgente, inizia dalla [panoramica dell'architettura](onboarding.it.md).

## Sviluppo

```sh
npm install
npm run dev    # server di sviluppo su http://localhost:3000
npm run build  # crea dist/bundle.js
```

## Licenza

[MIT](../LICENSE)
