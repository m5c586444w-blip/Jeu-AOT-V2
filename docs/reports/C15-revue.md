# Revue indépendante C15 (Trost, Karanes, Utopia, Krolva, camp d'entraînement, QG de la Garnison)

Relecteur : sous-agent distinct de l'auteur. Périmètre : `git diff d253fe8..HEAD` sur `src/tools/places`, `data/places`, `tests/places`, `docs/lore`. Aucune écriture hors de ce fichier.

**Verdict : ACCEPTÉ AVEC RÉSERVES** (aucun défaut bloquant ; un défaut de géométrie moyen à corriger).

## Vérifications rejouées
- `npx vitest run tests/places` : 7 fichiers, 86 tests passés. `npm run places:valider -- --sans-docs` : OK pour les 10 lieux N1 ; chiffres identiques à ceux du rapport (Trost -6,6 % / -3,3 % ; Karanes -4,8 % / +3,0 % ; Utopia -7,3 % / +14,6 % ; Krolva -6,3 % / +7,0 % ; camp -3,3 % ; QG +2,8 %).
- `git diff` : aucun fichier de `src/sim` ni de schéma (`src/data/placeSchema`) touché (les autres fichiers du diff relèvent d'autres chantiers).

## Contrôles demandés
1. **Canon** : conforme. Orientations (Trost sud, Karanes est, Utopia nord, Krolva ouest), mur Rose, deux portes par saillie, QG Garnison à Trost, départ des expéditions à Karanes (`expedition_base` du scénario relu), pas de porte de rivière. Camp : localisation `?` correctement déclarée. 2 500 soldats à Trost : présents dans `sandbox_845.json`.
2. **Étiquetage** : noms de rues, places, parcs, bâtiments en `A` ; portes extérieures de Trost et Karanes en `C` (atlas W05 et W03, noms d'atlas), noms de portes d'Utopia et Krolva en `A`. Créations consignées dans `creations.md`, Q14 à Q19 présentes. Aucun nom de personnage de l'œuvre ; expressions inspirées de l'Europe du début du XXe siècle.
3. **Populations** : lues via `simPopulations()` (`createInitialState` sur `scn_sandbox_845`), pas en dur ; les tests relisent la même source (seuls 34 783 pour Utopia et Krolva sont comparés à une valeur fixe, qui correspond bien à la simulation).
4. **CR1e-03/04** : réellement testés (écart ≤ 0,25, arbres/ha bâti ≥ 8, îlots de faubourg et parcs ≥ 20) par `checkPlace`, boucle non vide (zones, parcs ≥ 3 ou ≥ 1 vérifiés).
8. **src/sim et schéma intacts** : oui.

## Défauts
1. `src/tools/places/auteur/krolva.ts:117-118` — **moyenne**. Le Moulin à vent des Forges (position [935, 850], distance 1 264 m pour R = 990 m) et la Tannerie du Couchant ([-715, 740], coin à 1 050 m) sont **hors du mur**, alors que le plan les place dans des cases `c(17,7)` et `c(2,6)` rognées par le demi-cercle. Visible sur `docs/screenshots/c15-krolva-vue-ensemble.png` (bâtiment rouge isolé sous le rempart, point minuscule à droite) ; le rapport le note « à vérifier » sans le corriger. Corriger (cases intérieures) ou assumer et étiqueter comme moulin extra-muros.
2. `src/tools/places/auteur/karanes.ts:114` — **mineure**. Le coin des Dépôt et écuries des expéditions atteint 1 372 m pour R = 1 370 m (2 m dans le mur).
3. `src/tools/places/auteur/camp-entrainement.ts` (parcelles sud) — **mineure**. Deux parcelles (terrain ocre et pré) flottent hors du carré principal, sans rue ni lien (capture 3 du rapport). Idem `qg-garnison.ts:89` : corps de garde de la grille d'honneur ([-70,152]) isolé hors îlot, sans voie lisible (capture QG) ; `camp-entrainement.ts:104` (corps de garde, [-60,246]) hors îlot et place.
4. Tests — **mineure**. Aucun test ne vérifie qu'un bâtiment est dans l'enceinte ni qu'il est sur un îlot ou une place (le défaut 1 passe donc `rose2.test.ts`). `tests/places/rose.test.ts:77-80` et `rose2.test.ts` : `canon ∈ {A, C}` pour les bâtiments n'écarte rien ; la consignation dans `creations.md` ne teste que la présence de `| <id> : noms de rues`, pas les noms eux-mêmes. Aucun test existant n'a été affaibli (`rose.test.ts` créé en C15.1, aucune modification de test préexistant).
5. `docs/lore/questions-ouvertes.md:22` — **mineure**. Une ligne vide sépare Q13 de Q14 à Q19 : en Markdown, ces lignes sortent du tableau.
6. `docs/reports/C15.md:3` et `docs/phases/C15.md` (« sans commit ») — **mineure**. Obsolète : deux commits existent (`07dc0b4`, `5e4acb9`). Les dettes (captures complètes, `places:valider` avec docs KO) sont annoncées honnêtement.
7. Géométrie, rues sans issue — **non conclu, mineure**. Six extrémités libres par saillie dans mon script approximatif (probables bouts de rues au mur ; non vérifié visuellement).

## Captures ouvertes (6)
- Krolva : demi-ville en saillie, damier rouge, deux places claires, faubourg derrière le mur ; bâtiment isolé hors mur au sud (défaut 1).
- Camp : rectangle sans mur, champ de manœuvre ocre au nord, rangées de casernements ; parcelles flottantes au sud (défaut 3) ; camp petit dans le cadre.
- Utopia : même gabarit que Krolva, deux grandes places ocres près de la porte nord (est), faubourg en lamelles ; places claires « taches ».
- QG : place dallée, quartier général à cour carrée, casernements gris ; petit bâtiment isolé au premier plan (défaut 3) ; cour vide.
- Trost : demi-ville dense, faubourg et route, places blanches en « taches », horizon plat ; aucune anomalie de placement.
Défauts communs : sol plat, ciel blanc, mur uniforme. Captures complètes (portes, états) toujours à produire, comme déclaré.
