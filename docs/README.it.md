# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · **it** · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un editor nel browser che ti permette di trasformare una foto in low-poly (un'immagine composta da triangoli). Ciò che lo distingue dai soliti generatori è l'essenziale: oltre alla mesh generata di base, puoi disegnare tu stesso delle guide, e i bordi dei triangoli le seguiranno. Così i contorni importanti - la linea del mento, la montatura degli occhiali, una silhouette - restano nitidi invece di perdersi in una mesh casuale. Il risultato finale puoi salvarlo in vettoriale (SVG, PDF) o in immagine (PNG, JPG, WebP).

**[APRI L'EDITOR](https://jango-git.github.io/polygonize/)**

![Schermata](../image.png)

## Cosa sa fare

- **Guide che disegni tu stesso.** Tracci linee, cerchi, curve morbide sopra l'immagine, e i triangoli si allineano lungo di esse. Sono modificatori indipendenti sopra l'immagine, quindi in qualsiasi momento puoi spostarli, cambiare i loro parametri di dettaglio o raggrupparli.
- **La mesh si adatta ai dettagli.** Dove ci sono molti dettagli minuti e bordi marcati, i triangoli sono più piccoli; nelle zone uniformi come il cielo o lo sfondo, più grandi. L'immagine viene dettagliata dove serve e tranquilla nel resto. E il risultato è riproducibile in modo prevedibile: con le stesse impostazioni la mesh viene esattamente uguale.
- **Colore dei triangoli.** Ogni triangolo viene riempito con il colore medio dei pixel sottostanti, oppure con quello mediano, se vuoi attenuare i valori estremi troppo vivaci.
- **Esportazione.** Vettoriale (SVG, PDF) o raster (PNG, JPG, WebP) fino a 4096 pixel.
- **Progetti.** Salva il tuo lavoro in un file `.json` e tornaci più tardi. E comunque la sessione corrente si ripristina da sola, anche se hai semplicemente chiuso la scheda.
- **Interfaccia in 21 lingue.** La lingua viene rilevata dal browser e si cambia nella barra in alto.

## Scorciatoie da tastiera

| Tasto   | Azione                                             |
| ------- | -------------------------------------------------- |
| `~`     | Cursore (selezione)                                |
| `1`     | Strumento "Polilinea"                              |
| `2`     | Strumento "Curva"                                  |
| `3`     | Cerchio (centro e raggio)                          |
| `4`     | Cerchio (3 punti)                                  |
| `Q`     | Invertire l'opacità dello sfondo                   |
| `W`     | Invertire l'opacità dei punti                      |
| `E`     | Invertire l'opacità dei triangoli degeneri         |
| `F`     | Centrare l'immagine                                |
| `Space` | Completare il tracciato aperto                     |
| `Esc`   | Annullare il disegno / deselezionare               |

## Sotto il cofano

Per i curiosi: i punti vengono distribuiti tramite campionamento a disco di Poisson (algoritmo di Bridson) con raggio variabile, definito dalla mappa dei bordi di Sobel, ed è per questo che lungo i contorni la mesh è più densa. La generazione è deterministica: lo stesso seed produce sempre la stessa mesh.
Tutta la pesante pipeline geometrica - la mappa dei bordi, la distribuzione dei punti e la triangolazione stessa - è raccolta in un modulo WASM scritto in Rust. Il colore dei triangoli viene calcolato a parte, in un Web Worker.

## Sviluppo

```sh
npm install
npm run dev    # server di sviluppo su http://localhost:3000
npm run build  # genera dist/bundle.js
```

## Licenza

[MIT](../LICENSE)
