# Images de référence (ambiance seulement)

Ce dossier peut recevoir un jour des images de référence (grilles d'ambiance, planches de couleurs).

- Elles servent **uniquement** à l'ambiance : matériaux, couleurs, silhouettes. Elles ne sont pas une source de lore (voir `docs/art/STYLES.md`, B0).
- Elles ne sont **jamais** :
  - intégrées au build ;
  - importées par le code ;
  - copiées comme texture ;
  - placées dans `public/`.
- Elles ne peuvent donc pas se retrouver dans `dist`. Toutes les textures du jeu sont dessinées par code (`src/render/tactical3d/textures.ts`).

## Contrôles
- `tests/lint/art-reference.test.ts` vérifie trois choses :
  - aucun fichier de `src/`, `public/` ou `index.html` ne cite ce dossier ;
  - `public/` ne contient aucune copie de ses fichiers (comparaison par empreinte) ;
  - si `dist` existe, il n'en contient aucune non plus.
- `npm run mesure:r1b -- bundle` refait le dernier contrôle juste après le build.
