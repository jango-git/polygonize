# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · **it** · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un editor di immagini low-poly che funziona nel browser. Carica una foto, regola la triangolazione, affina i bordi con i modificatori di forma ed esporta in SVG o PNG.

**[EDITOR](https://jango-git.github.io/polygonize/)**

![Schermata](../image.png)

## Funzionalità

- **Distribuzione intelligente dei punti** - Campionamento a disco di Poisson Bridson con raggio variabile guidato dal rilevamento dei bordi Sobel: i bordi ottengono un raggio minimo ridotto (triangoli densi), le aree piatte un raggio massimo ampio (triangoli radi). La generazione è completamente basata su un seme, così uno stesso seme riproduce la stessa mesh
- **Stack di modificatori** - Livelli non distruttivi di polilinee, cerchi e curve Catmull-Rom aggiungono spigoli di vincolo sopra la mesh di base; riordinali o raggruppali liberamente con il trascinamento
- **Campionamento del colore** - Colore medio o mediano dei pixel per triangolo; gradiente opzionale per vertice
- **Esportazione** - SVG o PDF vettoriali, oppure PNG, JPG o WebP rasterizzati fino a 4096px
- **Progetti** - Salva e ripristina il lavoro come `.json`; la sessione viene salvata automaticamente in localStorage
- **Interfaccia localizzata** - 21 lingue dell'interfaccia, rilevate automaticamente dal browser e selezionabili nella barra superiore

## Scorciatoie da tastiera

| Tasto   | Azione                          |
| ------- | ------------------------------- |
| `~`     | Cursore (selezione)             |
| `1`     | Strumento polilinea             |
| `2`     | Strumento curva Catmull-Rom     |
| `3`     | Strumento cerchio (centro e raggio) |
| `4`     | Strumento cerchio (3 punti)     |
| `Q`     | Inverti opacità sfondo          |
| `W`     | Inverti opacità punti           |
| `E`     | Inverti sovrapposizione spuntoni |
| `F`     | Adatta immagine alla vista      |
| `Space` | Applica percorso aperto         |
| `Esc`   | Annulla disegno / deseleziona   |

## Sviluppo

```sh
npm install
npm run dev    # server di sviluppo su http://localhost:3000
npm run build  # genera dist/bundle.js
```

## Licenza

[MIT](../LICENSE)
