# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · **fr** · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Un éditeur dans le navigateur qui transforme une photo en image low-poly, composée de triangles. Il se distingue des générateurs habituels sur un point essentiel : par-dessus la grille générée, tu dessines toi-même des tracés directeurs, et les arêtes des triangles suivent ces tracés. Les contours importants - la ligne du menton, la monture des lunettes, une silhouette - restent nets, au lieu de se perdre dans une grille aléatoire.

**[OUVRIR L'ÉDITEUR](https://jango-git.github.io/tesselot/)**

![Capture d'écran](../image.png)

## Fonctionnalités

- **Tracés directeurs.** Tu dessines des lignes, des cercles et des courbes lissées par-dessus l'image - les triangles s'alignent le long d'eux. Ce n'est pas une opération ponctuelle mais des modificateurs : à tout moment, tu peux les déplacer, changer leur niveau de détail, les grouper.
- **Une grille qui s'adapte aux détails.** Là où il y a beaucoup de petits détails et de contours nets, les triangles sont plus fins ; sur des zones uniformes comme le ciel, ils sont plus grands. L'image devient détaillée là où c'est nécessaire, et sobre partout ailleurs.
- **Tracé automatique.** Pour ne pas partir d'une page blanche, clique sur "Tracer" : l'éditeur détecte les contours de l'image et les transforme en modificateurs éditables, réunis dans un groupe dédié.
- **Couleur des triangles.** Chaque triangle est rempli avec la couleur moyenne des pixels situés en dessous - ou la couleur médiane, si tu veux atténuer les valeurs extrêmes trop vives.
- **Export.** Vecteur (SVG, PDF) ou raster (PNG, JPG, WebP) jusqu'à 4096 pixels.
- **Projets.** Enregistre ton travail dans un fichier `.json` et reprends-le plus tard. La session en cours se restaure aussi automatiquement, même si tu as simplement fermé l'onglet.
- **Interface en 21 langues.** La langue est détectée à partir du navigateur, et se change dans la barre du haut.

## Sous le capot

Les points sont placés par échantillonnage sur disque de Poisson (algorithme de Bridson) à rayon variable - ce rayon est donné par une carte de contours Sobel, ce qui rend la grille plus dense le long des contours. La génération est déterministe : une même graine (seed) donne toujours la même grille. Tout le pipeline géométrique lourd - carte de contours, placement des points, triangulation - est réuni dans un module WASM écrit en Rust ; la couleur des triangles est calculée séparément, dans un Web Worker.

Si tu comptes lire le code source, commence par l'[aperçu de l'architecture](onboarding.fr.md).

## Développement

```sh
npm install
npm run dev    # serveur de développement sur http://localhost:3000
npm run build  # crée dist/bundle.js
```

## Licence

[MIT](../LICENSE)
</content>
