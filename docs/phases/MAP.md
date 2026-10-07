# MAP — Carte stratégique réaliste (E-UX-2)

Prompt : `docs/spec/22_PLAN_V2_EXPERIENCE_DE_JEU.md` §4. Errata : `docs/spec/ERRATA_UX.md`. `src/sim` inchangé : la simulation garde son graphe (`data/map/paradis.json`, `data/geo/paradis.json`) ; le dessin est une ressource à part (`data/map/terrain/paradis.json`).

## Tâches
- **MAP.1** Terrain procédural déterministe, généré une fois et figé (`npm run map:terrain`, graine `paradis-v1`, version et empreinte dans le fichier) : côte [A] avec baies, caps et îlots ; relief ; fleuves vers la mer ; lacs ; forêts dont les Arbres Géants à l'emplacement de l'atlas (fichier 06) ; marais ; falaises. Les trois murs gardent leurs anneaux, légèrement déformés par le terrain.
- **MAP.2** Polygone réaliste par province (frontières sinueuses, contraintes par la côte et les murs) ; voisinage recalculé et comparé à `data/map` ; tout écart se corrige côté dessin.
- **MAP.3** Rendu Pixi : relief ombré, teintes par milieu, forêts, eau (profondeur, écume), fleuves, frontières, murs en relief (ombre, créneaux, segments abîmés), villes par taille, routes au moindre coût et ponts, brouillard en voile léger sans mention écrite.
- **MAP.4** Trois zooms (île, région, province) au détail croissant ; noms de murs courbés ; noms qui se masquent quand ils se chevauchent.
- **MAP.5** Calques existants en aplat transparent sur le relief ; infobulle de jeu (nom, état, population, garnison, ressource) ; clic : dossier.
- **MAP.6** Point d'ancrage et emplacement de pion par province, distincts du nom.
- **MAP.7** Première image de la carte < 3 s (rendu logiciel) ; terrain en une seule ressource chargée à la demande.

## Critères
| Id | Critère | Commande |
|---|---|---|
| CMAP-01 | verify code 0 | `npm run verify` |
| CMAP-02 | `src/sim` inchangé | `git diff origin/claude/attack-on-titan-strategy-game-4ukom6 --stat -- src/sim` vide |
| CMAP-03 | sim:selftest code 0 | `npm run sim:selftest` |
| CMAP-04 | voisinage dessiné = données | `npx vitest run tests/map` ; `npm run map:terrain -- --check` |
| CMAP-05 | aucune province illisible (aire minimale) | `npx vitest run tests/map` |
| CMAP-06 | terrain figé reproductible (même empreinte) | `npm run map:terrain -- --check` |
| CMAP-07 | smoke:map OK | `npm run smoke:map` |
| CMAP-08 | captures 1366×768 et 3840×2160, 3 zooms et 3 calques, lues une à une | `npm run captures:map` ; rapport § captures |

## Hors périmètre
Pions d'armées et de flottes (phase PA), refonte des panneaux (phase UI), lieux 3D (R1e, LC-B à LC-D).
