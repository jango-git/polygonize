# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · **fr** · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un éditeur dans le navigateur qui te permet de transformer une photo en low-poly (une image composée de triangles). Ce qui le distingue des générateurs ordinaires tient à l'essentiel : en plus du maillage généré de base, tu peux dessiner toi-même des guides, et les arêtes des triangles vont les suivre. Ainsi les contours importants - la ligne du menton, la monture des lunettes, une silhouette - restent nets au lieu de se perdre dans un maillage aléatoire. Le résultat final, tu peux l'enregistrer en vectoriel (SVG, PDF) ou en image (PNG, JPG, WebP).

**[OUVRIR L'ÉDITEUR](https://jango-git.github.io/polygonize/)**

![Capture d'écran](../image.png)

## Ce qu'il sait faire

- **Des guides que tu dessines toi-même.** Tu traces des lignes, des cercles, des courbes douces par-dessus l'image, et les triangles s'alignent le long de ceux-ci. Ce sont des modificateurs indépendants posés sur l'image, donc à tout moment tu peux les déplacer, changer leurs paramètres de détail ou les regrouper.
- **Le maillage s'adapte aux détails.** Là où il y a beaucoup de petits détails et de bords marqués, les triangles sont plus petits ; sur les zones uniformes comme le ciel ou l'arrière-plan, ils sont plus grands. L'image ressort détaillée là où il le faut, et calme partout ailleurs. Et le résultat est reproductible de façon prévisible : avec les mêmes réglages le maillage est exactement le même.
- **Tracé automatique pour démarrer.** Pour ne pas partir d'une page blanche, appuie sur "Tracer" - l'éditeur trouve lui-même les bords de l'image et les transforme en modificateurs éditables, rassemblés dans leur propre groupe.
- **Couleur des triangles.** Chaque triangle est rempli de la couleur moyenne des pixels qu'il recouvre, ou de la couleur médiane si tu veux atténuer les valeurs extrêmes trop vives.
- **Exportation.** Vectoriel (SVG, PDF) ou raster (PNG, JPG, WebP) jusqu'à 4096 pixels.
- **Projets.** Enregistre ton travail dans un fichier `.json` et reviens-y plus tard. Et de toute façon la session en cours se restaure d'elle-même, même si tu as simplement fermé l'onglet.
- **Interface en 21 langues.** La langue est détectée d'après le navigateur et se change dans la barre du haut.

## Raccourcis clavier

| Touche  | Action                               |
| ------- | ------------------------------------ |
| `~`     | Curseur (sélection)                  |
| `1`     | Outil polyligne                      |
| `2`     | Outil courbe Catmull-Rom             |
| `3`     | Outil plume Bézier                   |
| `4`     | Outil cercle (centre et rayon)       |
| `5`     | Outil cercle (3 points)              |
| `Q`     | Inverser l'opacité de l'arrière-plan |
| `W`     | Inverser l'opacité des points        |
| `E`     | Inverser la surcouche de pics        |
| `F`     | Ajuster l'image à la vue             |
| `Space` | Appliquer le tracé ouvert            |
| `Esc`   | Annuler le tracé / désélectionner    |

## Sous le capot

Pour les curieux : les points sont répartis par échantillonnage en disque de Poisson (algorithme de Bridson) à rayon variable, défini par la carte de bords de Sobel, c'est pourquoi le maillage est plus dense le long des contours. La génération est déterministe : le même seed produit toujours le même maillage.
Tout le lourd pipeline géométrique - la carte de bords, la répartition des points et la triangulation elle-même - est rassemblé dans un module WASM écrit en Rust. La couleur des triangles est calculée à part, dans un Web Worker.

## Développement

```sh
npm install
npm run dev    # serveur de développement sur http://localhost:3000
npm run build  # génère dist/bundle.js
```

## Licence

[MIT](../LICENSE)
