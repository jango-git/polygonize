# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · **fr** · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un éditeur d'images low-poly qui fonctionne dans le navigateur. Chargez une photo, ajustez la triangulation, affinez les contours avec des modificateurs de forme, puis exportez en SVG ou PNG.

**[ÉDITEUR](https://jango-git.github.io/polygonize/)**

![Capture d'écran](../image.png)

## Fonctionnalités

- **Placement intelligent des points** - Échantillonnage par disque de Poisson Bridson à rayon variable piloté par la détection de contours Sobel : les contours reçoivent un rayon minimal serré (triangles denses), les zones plates un rayon maximal lâche (triangles épars). La génération est entièrement déterministe : une graine donnée reproduit toujours le même maillage
- **Pile de modificateurs** - Des calques non destructifs de polyligne, de cercle et de courbe Catmull-Rom ajoutent des arêtes de contrainte par-dessus le maillage de base ; réordonnez-les ou regroupez-les librement par glisser-déposer
- **Échantillonnage des couleurs** - Couleur moyenne ou médiane des pixels par triangle ; dégradé optionnel par sommet
- **Export** - SVG ou PDF vectoriel, ou PNG, JPG ou WebP rasterisé jusqu'à 4096 px
- **Projets** - Enregistrez et restaurez votre travail au format `.json` ; la session est sauvegardée automatiquement dans le localStorage
- **Interface localisée** - 21 langues d'interface, détectées automatiquement depuis le navigateur et interchangeables dans la barre supérieure

## Raccourcis clavier

| Touche  | Action                          |
| ------- | ------------------------------- |
| `~`     | Curseur (sélection)             |
| `1`     | Outil polyligne                 |
| `2`     | Outil courbe Catmull-Rom        |
| `3`     | Outil cercle (centre et rayon)  |
| `4`     | Outil cercle (3 points)         |
| `Q`     | Inverser l'opacité de l'arrière-plan |
| `W`     | Inverser l'opacité des points   |
| `E`     | Inverser la surcouche de pics   |
| `F`     | Ajuster l'image à la vue        |
| `Space` | Appliquer le tracé ouvert       |
| `Esc`   | Annuler le tracé / désélectionner |

## Développement

```sh
npm install
npm run dev    # serveur de développement sur http://localhost:3000
npm run build  # produit dist/bundle.js
```

## Licence

[MIT](../LICENSE)
