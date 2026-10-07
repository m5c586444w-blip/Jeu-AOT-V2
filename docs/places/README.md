# Lieux (R1e)

Un dossier par lieu N1 (`docs/places/<id>/`), produit depuis les données :

| Fichier | Source | Commande |
|---|---|---|
| `plan.svg` (plan coté), `mur-coupe.svg`, `porte-<porte>-elevation-*.svg` | `data/places/<id>.json`, `data/places/_murs.json` | `npm run places:regenerer -- <id>` (`--svg` : plans seulement) |
| `vue-ensemble.png`, `vue-<point de vue>.png`, `etat-<état>.png`, `porte-<porte>-<vue>.png` (7 vues par porte) | rendu 3D (Chromium, WebGL logiciel) | `npm run places:captures -- <id>` |
| `inspirations.md` (emprunts au monde réel, une ligne chacun), `lore.md` (canon, adaptation, incertain, sources) | écrits à la main | — |

- Plan d'auteur : `src/tools/places/auteur/<id>.ts` (rues, îlots, gabarits, repères, portes, eau, végétation), écrit dans
  `data/places/<id>.json`. Le rendu ne lit que le JSON validé (`npm run places:valider`).
- Statuts : `[C]` établi (manga, databooks, guides officiels), `[A]` adaptation assumée, `[?]` incertain et paramétrable
  (`docs/lore/questions-ouvertes.md`).
- Visionneuse : `?proto3d&lieu=<id>` (`&etat=`, `&vue=`, `&lumiere=`, `&qualite=`).
