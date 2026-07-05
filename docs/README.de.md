# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · **de** · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Ein Editor im Browser, mit dem du ein Foto in ein Low-Poly-Bild verwandelst (ein Bild, das aus Dreiecken zusammengesetzt ist). Von gewöhnlichen Generatoren unterscheidet er sich in einem entscheidenden Punkt: Zusätzlich zum automatisch erzeugten Grundnetz kannst du selbst Hilfslinien zeichnen, und die Dreieckskanten folgen ihnen. So bleiben wichtige Konturen - die Kinnlinie, ein Brillengestell, eine Silhouette - scharf und gehen nicht in einem zufälligen Netz unter. Das fertige Ergebnis speicherst du als Vektor (SVG, PDF) oder als Bild (PNG, JPG, WebP).

**[EDITOR ÖFFNEN](https://jango-git.github.io/tesselot/)**

![Bildschirmfoto](../image.png)

## Funktionen

- **Hilfslinien, die du selbst zeichnest.** Du ziehst Linien, Kreise und sanfte Kurven über das Bild - und die Dreiecke richten sich daran aus. Das sind eigenständige Modifikatoren über dem Bild, deshalb kannst du sie jederzeit verschieben, ihre Detailparameter anpassen oder sie gruppieren.
- **Das Netz passt sich den Details an.** Wo viele Feinheiten und scharfe Kanten sind, werden die Dreiecke kleiner; auf gleichmäßigen Flächen wie Himmel oder Hintergrund größer. So wird das Bild dort detailreich, wo es nötig ist, und ruhig im Rest. Dabei ist das Ergebnis vorhersagbar reproduzierbar: Mit denselben Einstellungen entsteht exakt dasselbe Netz.
- **Automatisches Nachzeichnen als Ausgangspunkt.** Damit du nicht bei null anfängst, klick auf "Bild nachzeichnen" - der Editor findet die Kanten des Bildes selbst und wandelt sie in bearbeitbare Modifikatoren um, gesammelt in einer eigenen Gruppe.
- **Farbe der Dreiecke.** Jedes Dreieck wird mit der Durchschnittsfarbe der darunterliegenden Pixel gefüllt - oder mit der Medianfarbe, wenn du grelle Ausreißer dämpfen willst.
- **Export.** Vektor (SVG, PDF) oder Raster (PNG, JPG, WebP) bis zu 4096 Pixel.
- **Projekte.** Speichere deine Arbeit in einer `.json`-Datei und kehre später dazu zurück. Aber auch die aktuelle Sitzung stellt sich von selbst wieder her, selbst wenn du den Tab einfach geschlossen hast.
- **Oberfläche in 21 Sprachen.** Die Sprache wird anhand des Browsers erkannt und lässt sich in der oberen Leiste umschalten.

## Unter der Haube

Die Punkte werden per Poisson-Disk-Sampling (Bridson-Algorithmus) mit variablem Radius gesetzt - diesen gibt eine Sobel-Kantenkarte vor, weshalb das Netz entlang der Konturen dichter ist. Die Erzeugung ist deterministisch: Derselbe Seed liefert dasselbe Netz. Die gesamte rechenintensive Geometrie-Pipeline - Kantenkarte, Punktverteilung, Triangulation - steckt in einem WASM-Modul in Rust; die Farbe der Dreiecke wird getrennt davon in einem Web Worker berechnet.

Wenn du vorhast, den Quellcode zu lesen, beginne mit dem [Architekturüberblick](onboarding.de.md).

## Entwicklung

```sh
npm install
npm run dev    # Entwicklungsserver auf http://localhost:3000
npm run build  # erzeugt dist/bundle.js
```

## Lizenz

[MIT](../LICENSE)
