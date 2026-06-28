# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · **de** · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Ein browserbasierter Low-Poly-Bildeditor. Lade ein Foto, stimme die Triangulation ab, verfeinere Kanten mit Formmodifikatoren und exportiere als SVG oder PNG.

**[EDITOR](https://jango-git.github.io/polygonize/)**

![Screenshot](../image.png)

## Funktionen

- **Intelligente Punktverteilung** - Bridson Poisson-Disk-Sampling mit variablem Radius, gesteuert durch Sobel-Kantenerkennung: Kanten erhalten einen kleinen Mindestradius (dichte Dreiecke), flache Bereiche einen großen Maximalradius (spärliche Dreiecke). Die Erzeugung ist vollständig seed-basiert, sodass ein bestimmter Seed dasselbe Mesh reproduziert
- **Modifikator-Stapel** - Nicht-destruktive Ebenen aus Polylinien, Kreisen und Catmull-Rom-Kurven fügen dem Basis-Mesh Zwangskanten hinzu; ordne sie per Drag-and-Drop frei neu an oder gruppiere sie
- **Farbabtastung** - Durchschnittliche oder mittlere Pixelfarbe pro Dreieck; optionaler Verlauf pro Eckpunkt
- **Export** - Vektorbasiert als SVG oder PDF oder gerastert als PNG, JPG oder WebP bis zu 4096 px
- **Projekte** - Arbeit als `.json` speichern und wiederherstellen; die Sitzung wird automatisch in localStorage gespeichert
- **Lokalisierte Oberfläche** - 21 Oberflächensprachen, automatisch aus dem Browser erkannt und in der oberen Leiste umschaltbar

## Tastenkürzel

| Taste   | Aktion                          |
| ------- | ------------------------------- |
| `~`     | Cursor (auswählen)              |
| `1`     | Polylinien-Werkzeug             |
| `2`     | Catmull-Rom-Kurvenwerkzeug      |
| `3`     | Kreis-Werkzeug (Mittelpunkt & Radius) |
| `4`     | Kreis-Werkzeug (3 Punkte)       |
| `Q`     | Hintergrund-Deckkraft umschalten |
| `W`     | Punkt-Deckkraft umschalten      |
| `E`     | Spitzen-Überlagerung umschalten |
| `F`     | Bild an Ansicht anpassen        |
| `Space` | Offenen Pfad anwenden           |
| `Esc`   | Zeichnen abbrechen / Auswahl aufheben |

## Entwicklung

```sh
npm install
npm run dev    # Dev-Server unter http://localhost:3000
npm run build  # erzeugt dist/bundle.js
```

## Lizenz

[MIT](../LICENSE)
