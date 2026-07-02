# Polygonize - architecture

## Avant-propos

Polygonize est un éditeur d'images low-poly dans le navigateur : l'utilisateur dessine par-dessus l'image des formes directrices (les **modificateurs** : lignes, courbes, cercles), et l'application sème l'espace restant de points, triangule, puis colore. Ce que ça apporte à l'utilisateur est expliqué dans le README ; ce document, lui, porte sur la structure du code.

L'essentiel à comprendre avant de lire le code : le pipeline est entièrement non destructif. L'état est strictement séparé entre **source** - ce que l'utilisateur a défini (image, réglages, arbre de formes) - et **derived** - points, triangulation, couleurs. Seule la source est stockée et entre dans l'historique ; la partie derived est recalculée à partir d'elle à chaque modification et à chaque chargement, et n'est jamais sauvegardée.

Cette séparation entraîne presque toute l'architecture restante : l'annulation (undo) est bon marché (l'instantané ne contient que la source), tout est déterministe (une même source donne toujours le même derived), les calculs lourds sont déportés en arrière-plan (le derived coûte cher à calculer), et les données circulent strictement dans un seul sens - de la source vers le derived, jamais l'inverse.

Pour ceux qui connaissent déjà ce genre de motif, cela ressemble au flux de données unidirectionnel de Redux/Flux - un état unique, des modifications uniquement via des commandes, des abonnés qui réagissent aux événements - avec en plus une couche d'état calculé par-dessus, comme computed/reselect.

## Cinq couches

| Couche | Dossier | Responsabilité | Connaît |
|---|---|---|---|
| **UI** | `src/ui/` | saisie : dessin, panneau, outils, raccourcis clavier | le modèle (lui envoie des commandes) |
| **Modèle** | `src/document/` | source + derived, historique, événements | rien au-dessus de lui |
| **Domaine** | `src/domain/` | logique pure : comment une forme devient des points, ponts vers WASM | le modèle l'appelle |
| **Rendu** | `src/preview/` | dessine l'image et les triangles avec three.js | écoute seulement le modèle |
| **Natif** | `crates/` | Rust->WASM : géométrie et couleur lourdes | rien, fonctions pures |

Il existe aussi quelques dossiers auxiliaires : `persistence/` (sauvegarde et export), `settings/`, `i18n/`.

Règle de flux : l'UI ne modifie que le modèle, le rendu ne fait que le lire, ils ne communiquent jamais directement entre eux. C'est le bus d'événements interne au modèle qui les relie - c'est ça, la boucle unidirectionnelle.

## Flux de données

Le scénario principal - "d'un trait de souris jusqu'aux triangles recolorés" :

```
   utilisateur         (1) l'UI capte la saisie
       |
       v
   (2) une commande modifie la SOURCE : ajoute/déplace une forme
       |
       v
   (3) recalcul : source -> points -> triangles      [coûteux, dans un worker en arrière-plan]
       |
       v
   (4) le modèle place le résultat dans des buffers plats et émet un événement "prêt"
       |
       v
   (5) le rendu entend l'événement et met à jour l'image à l'écran
       |
       +--> (6) en parallèle, la couleur des triangles est calculée -> un autre événement -> recoloration
```

Trois techniques rendent cette boucle réactive :

- **Un seul recalcul par image (frame).** Lors d'un glisser, les événements souris arrivent par dizaines par seconde, mais le recalcul ne se déclenche pas plus d'une fois par frame - les positions intermédiaires sont abandonnées.
- **Le rendu n'attend jamais.** Pendant que la couleur exacte se calcule en arrière-plan, les triangles s'affichent immédiatement avec une couleur approximative ; la couleur définitive arrive ensuite via un événement séparé et vient se superposer.
- **Aucune allocation superflue.** Les triangles n'existent pas comme des objets mais comme de longs tableaux plats de nombres ; le rendu comme l'export lisent ces tableaux directement.

## Carte des tâches

| Je veux modifier... | Je regarde dans... |
|---|---|
| le comportement des outils de dessin | `src/ui/tools/` |
| le panneau de droite (arbre de formes, groupes) | `src/ui/panel/` |
| comment une forme devient des points | `src/domain/modifiers/` |
| l'algorithme de semis de points / la triangulation | `crates/pipeline/` |
| comment la couleur d'un triangle est calculée | `crates/color/` |
| le rendu, la caméra, les surcouches | `src/preview/` |
| le format de sauvegarde / l'annulation | `src/document/` |
| la sauvegarde sur disque / l'export SVG, PDF, PNG | `src/persistence/` |

## Détails par couche

### Modèle (`src/document/`)

L'état est un unique objet `DocumentData` (`types.ts`), découpé exactement selon cette frontière :

- **Source** (sauvegardée, présente dans l'historique) : `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (l'arbre de formes).
- **Derived** (recalculée, non sauvegardée) : `points` et les buffers plats de rendu - `renderPositions` (xyz par sommet), `renderColors` (rgb par triangle), `triangleCount`.

Comment une modification traverse le modèle :

- `store.ts` - l'unique objet d'état mutable (`store.data()`).
- `commands/` - le seul moyen de le modifier, l'équivalent des reducers. Une commande modifie la source sur place puis déclenche un commit : `commit.ts` décide s'il faut un recalcul (`commitStructural` pour les modifications de géométrie) ou s'il suffit d'enregistrer un pas d'historique (`commitViewOnly`, par exemple replier un dossier).
- `commands/pipeline.ts` - le recalcul (`evaluatePoints`). Fonctionne selon le principe "une seule requête en vol" : quel que soit le nombre de modifications reçues, un seul calcul est envoyé au worker à la fois, mais le dernier est toujours mené à terme.
- `commands/recompute.ts` - répartition du résultat dans les buffers plats (`buildGeometry`) et application de la couleur calculée (`applyColorGrid`).
- `signals.ts` - le bus d'événements (basé sur `ferrsign`). Le modèle ne dessine rien lui-même ; il se contente d'annoncer "les points ont changé", "les triangles ont changé", "la source a été entièrement remplacée", et les abonnés - rendu, panneau, historique - réagissent.
- `history.ts` - annuler/rétablir (undo/redo). Un instantané ne contient que la source, même sans l'image, ce qui le rend bon marché ; un geste de glisser entier se réduit à un seul pas.
- `selectors/` - l'accès en lecture au modèle depuis l'extérieur. Renvoie des clones, pour que personne n'altère l'état en dehors des commandes ; exception faite des buffers plats, renvoyés par référence pour la vitesse.

L'arbre de formes (`stack`) est à un seul niveau, comme les collections dans Blender : un élément est soit une forme libre, soit un groupe avec des enfants. Un groupe peut être "replié" (affichage seulement) ou "désactivé" (exclu du calcul). L'ordre dans la pile a un sens. Les opérations structurelles sur l'arbre sont dans `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domaine (`src/domain/`)

Logique sans DOM ni three.js ; seule exception, `imageSource.ts`, qui lit les pixels depuis un `<canvas>`. Deux grands sous-thèmes :

- `modifiers/` - comment chaque forme devient des points et des arêtes de contrainte (`ModifierResult`) : `path.ts` (ligne brisée ou spline de Catmull-Rom), `bezier.ts` (courbe de Bézier à poignées symétriques), `circle.ts`. L'assembleur commun est `result.ts`.
- Les ponts vers la couche native : chaque crate WASM dispose d'un trio "façade + worker + client". Les calculs lourds s'exécutent dans des Web Workers, les données traversent la frontière sous forme de tableaux transferable, sans copie.

Petits modules annexes : `rng.ts` (générateur pseudo-aléatoire déterministe), `colorGrid.ts` (recherche spatiale de couleur), `groupColor.ts` (la couleur d'un groupe découle de son nom - le renommer, c'est le recolorer).

### Rendu (`src/preview/`)

Écoute les événements du modèle dans un seul sens, sans référence retour vers le modèle. Les coordonnées du monde correspondent à celles de l'image (Y vers le bas), la caméra est orthographique.

- `preview.ts` - le coordinateur : une scène, un rendu, un ensemble de couches.
- Les couches possèdent leurs propres objets three.js : `triangleLayer.ts` (les triangles ; réutilise les buffers au lieu de les recréer à chaque frame), `imageLayer.ts` (l'image source), `pointLayer.ts` (les points de semis), `overlayLayer.ts` (surcouches d'édition : sélection, poignées, brouillon).
- `receiving.ts` - le pont "événements du modèle -> appels aux couches". C'est là que se trouve l'optimisation : sur l'événement "recoloré", seules les couleurs sont mises à jour ; sur "reconstruit", positions et couleurs le sont toutes les deux.
- `viewport.ts` - la caméra et la conversion de coordonnées écran<->image (zoom, panoramique).

### UI (`src/ui/`)

DOM/canvas impératif, sans framework ; les panneaux reconstruisent leur DOM sur événement. L'état de l'UI ne modifie jamais directement quoi que ce soit - uniquement via des commandes.

- `tools.ts` (`ToolController`) - une machine à états selon les modes "sélection / dessin / glisser" ; capte la saisie sur le canevas.
- `tools/` - implémentation des outils : brouillons des formes en cours de dessin (`*Draft.ts`) et `dragSession.ts` - le glisser d'un point ; c'est ici que vivent "un seul recalcul par frame" et le repli d'un geste en un seul pas d'annulation.
- `panel/` - le panneau de droite : l'arbre de formes avec groupes et glisser-déposer (`stackView.ts`, `dnd.ts`).
- Le reste - palette d'outils, sélection et surbrillance, raccourcis clavier, notifications toast.

### Couche native (`crates/`)

Deux crates indépendantes ; chacune met en cache l'image chargée de son côté, pour éviter de la retransmettre à chaque appel.

- `crates/pipeline/` - la géométrie : `sobel.rs` (carte de densité selon les bords de l'image : là où la transition est nette, les points sont plus denses), `seeding.rs` (placement des points par la méthode de Bridson à rayon variable), `triangulate.rs` (triangulation de Delaunay contrainte, crate `spade`), `contours.rs` (traçage des contours de l'image en formes éditables, Canny).
- `crates/color/` - la couleur : échantillonne la couleur sous chaque triangle (moyenne ou médiane) et construit une grille spatiale pour une recherche rapide. Fonctionne dans le worker de couleur.

Les parties critiques pour le déterminisme - générateur pseudo-aléatoire, semis, échantillonnage - correspondent volontairement bit à bit à l'ancienne implémentation TypeScript : un même seed donne toujours la même image, quelle que soit l'exécution.

## Compilation

- `npm run build:wasm` - pour chaque crate : cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Le code de liaison est placé dans `src/generated/` (dans le gitignore), le `.wasm` est copié dans `dist/` et chargé au runtime.
- `npm run build` = `build:wasm`, puis `rollup -c`. `npm run dev` ajoute le mode watch (`-w`).
- Le déploiement est statique (GitHub Pages), sans backend.

## En résumé

L'application ne stocke que la source : l'utilisateur la modifie via l'UI, le modèle la fait passer par le pipeline Rust/WASM en arrière-plan jusqu'à des buffers plats, et le rendu ne fait que refléter ces buffers. Tout le reste découle de cette seule séparation.
</content>
