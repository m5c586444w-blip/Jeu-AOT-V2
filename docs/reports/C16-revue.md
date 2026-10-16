# Revue indépendante C16 (Stohess, Orvud, Ehrmich, Yarckel, Mitras, ville souterraine, chapelle Reiss)

Relecteur : sous-agent distinct de l'auteur. Périmètre : commit `aacffa0` (tranche 1) et fichiers non commités (tranche 2 : `ville-souterraine`, `chapelle-reiss`, `sina2.test.ts`, `auteur/index.ts`, `rose-enceinte.test.ts`, lore). Seul ce fichier est écrit ; script de contrôle dans le scratchpad, hors dépôt.

**Verdict : ACCEPTÉ AVEC RÉSERVES** (aucun défaut bloquant ; une étiquette de canon à corriger, quelques tests de géométrie manquants, rapport en partie obsolète).

## Vérifications rejouées
- `npx vitest run tests/places` : 10 fichiers, 160 tests passés. `npm run places:valider -- --sans-docs` : OK, 17 lieux N1 + 1 plan figé ; chiffres identiques au rapport (ex. ville souterraine 34 783 hab. ÷ 260, écart +6,5 % ; chapelle +4,2 % ; Mitras +2,0 % ; Yarckel faubourg +7,0 %).
- `src/sim` et `src/data` : `git diff aacffa0^ --stat -- src/sim src/data` vide, `git status` sans modification dans ces dossiers. Schéma intact.

## Contrôles demandés
1. **Canon** : conforme pour les orientations (nord Orvud, est Stohess, sud Ehrmich, ouest Yarckel, Mitras centre), deux portes par district, pas de porte de rivière, 850 Stohess et Orvud en `C` (étendue `A`), Mitras = capitale avec Cabinet, cathédrale, tribunal et Police militaire (1 000 soldats lus du scénario), ville souterraine = marché noir sous Mitras. Aucun secret du récit révélé ; la crypte n'est pas modélisée. Réserve : défaut 1.
2. **Étiquetage** : rues, places, parcs, quartiers, portes extérieures en `A` ; créations consignées (`creations.md`, 3 lignes tranche 1 + 2 lignes tranche 2) ; Q20 à Q27 contiguës. Le schéma de lieu n'a pas de champ `creation` ni `raison` par entrée : la raison est dans `creations.md` et `sources` (conforme à ce que C15 avait accepté). Les ~700 noms de rues, bâtiments, parcs et quartiers relus à la main ne contiennent aucun nom propre de l'œuvre ni de fan. « Chapelle de la famille Reiss » et « Cathédrale des Murs » (identifiant de POI) sont des noms de fait canon, assumés. Les tests `INTERDIT` (liste courte de personnages) ne détecteraient pas Zeke, Reiner, Annie, Hange, Pieck, Falco, etc. (défaut 4).
3. **Populations** : lues via `simPopulations()` ; parts ≤ 1 ; `prov_ville_souterraine` (34 783) distincte de `prov_mitras` (95 652), le test `not.toBe("prov_mitras")` et `zones: []` écartent le double compte ; chapelle : `prov_domaine_reiss` = 0 donc effectif `?` de 38, `province: null`, déclaré. Seules les valeurs de contrôle des tests sont fixes.
4. **CR1e-03/04** : réellement testés (`checkPlace` ; écart ≤ 0,25 ; arbres/ha bâti ≥ 8 ; parcs ≥ 20 ; boucles non vides : zones, `parcs.length` ≥ 3 ou 5). Aucun test préexistant affaibli (`rose-enceinte.test.ts` : deux ids ajoutés seulement). Réserve : la ville souterraine atteint CR1e-04 grâce à des arbres (13/ha) que la fiche E08 (« arbres 0 ») exclut : écart signalé honnêtement (Q26).
5. **Géométrie** (script indépendant : 5 coins + centre de chaque bâtiment dans une parcelle ; chevauchements ; bouts de rues libres ; parcelles loin de toute rue) : aucune anomalie sur Orvud, Ehrmich, Yarckel, Mitras, ville souterraine, chapelle. Stohess : la Grue du canal a 2 coins sur 5 hors parcelle (défaut 3). Seuls bouts libres : les quatre extrémités des routes d'accès par saillie (normal). Aucune parcelle flottante.
6. **Honnêteté du rapport** : dettes (captures complètes, voûte, crypte, `places:valider` avec docs KO) bien annoncées ; défauts visuels des captures sincères. Réserves : défauts 5 et 6.
7. **src/sim et schéma** : intacts (voir plus haut).

## Captures ouvertes (4 sur 7)
- Stohess : demi-ville en saillie, damier dense de toits rouges, deux places claires, faubourg et route derrière le mur ; canal invisible à cette échelle ; sol plat, ciel blanc.
- Mitras : carré de ville plat, flèche de la cathédrale au nord-est, deux places claires, parcs verts, quartiers gris (nord-ouest) et rouges ; très lointaine, château indistinct, damier monotone.
- Ville souterraine : damier irrégulier de toits sombres, grands carrés ocre et crème (cours) très visibles, place du marché noir au centre-nord ; sol extérieur vert et ciel blanc : rien ne dit « sous terre » (reconnu par l'auteur, dette).
- Chapelle Reiss : domaine carré entouré de bois uniformes, enclos central avec parvis clair, clocher ; petit dans le cadre, chemin de ronde orange trop net, allée du sud masquée.
Défauts communs : sol plat, horizon rectiligne, ciel blanc, places pâles en « taches », cadre d'interface non montré (rendu du lieu seul).

## Défauts
1. `src/tools/places/auteur/chapelle-reiss.ts:88` — **moyenne**. Le bâtiment de surface « Chapelle de la famille Reiss » est étiqueté `canon: "C"` avec archétype chapelle de pierre à clocher, alors que l'atlas (I07, T13) et la fiche E23 décrivent une chapelle **souterraine** : la surface est une création `A` ; seul le nom du fait est `C`. À passer en `A` (ou `?`) avec le nom de fait en `reperes_canon`. Même remarque sur `place.canon: "C"` du lieu dont la localisation est `?` (acceptable car déclarée).
2. `docs/places/mitras/lore.md:13` — **mineure**. « Ville souterraine, chapelle Reiss : autres lieux (tranches suivantes), non posés ici » est obsolète depuis la tranche 2.
3. `src/tools/places/auteur/stohess.ts:119` — **mineure**. Grue du canal : 2 coins sur 5 hors de toute parcelle (bâtiment à cheval sur le quai). Le rapport affirme « aucune anomalie » pour la tranche 1 ; le test permanent de tranche 1 ne vérifie que le centre dans le périmètre (`rose-enceinte.test.ts`), alors que `sina2.test.ts` contrôle les coins pour la tranche 2 seulement. Étendre ce contrôle aux cinq lieux de la tranche 1.
4. `tests/places/sina.test.ts:17` et `tests/places/sina2.test.ts:14` — **mineure**. Liste `INTERDIT` incomplète, et celle de `sina.test.ts` omet Frieda, Fritz, Historia, Ymir, Grisha (présents seulement dans `sina2`). Aucun nom fautif trouvé à la relecture manuelle.
5. `docs/reports/C16.md:3` et `:66` — **mineure**. « Pas de commit » : faux pour la tranche 1 (`aacffa0`). Même défaut que C15 (revue, défaut 6). Il manque aussi la mention que `places:valider` avec docs est KO jusqu'à production des PNG complets (déjà en dette, à rappeler en tête).
6. `tests/places/sina2.test.ts` (« plus petite que Mitras ») — **mineure**. Compare `etendue_m` (1 900 contre 3 000) : n'établit pas que la ville souterraine est « sous » Mitras, le schéma n'ayant pas de relation spatiale. Assertion non vide mais faible ; à documenter comme telle.
7. `docs/places/ville-souterraine/vue-ensemble.png` — **mineure**. Capture sans voûte ni roche (sol prairie, ciel blanc) : rend le lieu peu crédible ; dette 2 déjà annoncée. Pas de cadre d'interface exigé ici (rendu de lieu).

## Conclusion
Tranche 1 et tranche 2 respectent le canon C, l'étiquetage A, les mesures CR1e-03/04 et la provenance des noms. Corriger l'étiquette de la chapelle (1), et mettre à jour `mitras/lore.md` et la mention « pas de commit » (2, 5) ; le reste est de la dette visuelle déjà déclarée.
