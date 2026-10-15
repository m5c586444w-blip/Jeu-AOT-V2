# Revue indépendante C10 (outillage Blender + tenues)

Verdict : ACCEPTÉ AVEC RÉSERVES.

Contrôlé : `npx vitest run tests/art tests/render tests/lint/assets-check.test.ts` = 23 fichiers, 273 tests verts ; `npm run assets:check` = 126 entrées conformes ; `src/sim` inchangé (diff vide, commits et arbre) ; GLTFLoader uniquement en `import()` dans `src/render/tactical3d` (humanBase.ts:108,115 ; tenuesProjet.ts:90).

Capture c10-tenues.png : sept soldats debout en A-pose sur sol brun, ciel bleu ; têtes chauves, facettes visibles, écussons minuscules sur la poitrine, bottes brunes. Défauts : emblèmes illisibles à cette distance, pas de coiffure (têtes nues pour les deux premiers), formes anguleuses.

## Défauts
1. MOYENNE. src/tools/assetsCheck.ts:~158-164 : `script` n'est pas confiné au dépôt (`../x`, chemin absolu acceptés) et seule son existence est testée : n'importe quel fichier existant donne l'origine `creation-projet` sans qu'un script produise réellement le glb ; aucune contrainte de dossier (`projet/`). Le contrôle de nom « œuvre » ne passe qu'après l'existence du script.
2. MOYENNE. src/tools/assets-blender.ts:~86-125 : le critère C10 « échoue si l'empreinte d'un glb ne correspond plus à une régénération » n'est pas tenu : l'outil compare deux générations successives, puis réécrit silencieusement le manifeste. Pas de mode `--check` (dérive de version bpy non détectée) ; `pip install bpy` non épinglé.
3. MOYENNE. Arbre de travail non commité : 14 glb de tenue, décalque survey_corps, manifest.json, tenues.py, geo.py, tenuesProjet.ts, test render, capture. Le HEAD n'est pas cohérent avec ce qui a été vérifié. À commiter après le verify.
4. BASSE. Pas de LOD2 (≤ 400 ou imposteur, ERRATA_V3 §4.4) ni de skinning : dette déclarée dans C10.md, à planifier.
5. BASSE. tests/render/tenuesProjet.test.ts : `habiller` et `chargerTenue` ne sont pas testés (seulement fonctions pures) ; le test « exactement » est un test d'inclusion (`servi` ⊂ attendus), pas d'égalité. tests/art/models.test.ts : aucun test LOD1 < LOD0 ni même liste d'os entre LOD.
6. BASSE. tests/data/emblems.test.ts:~76-80 : les tracés relatifs ou à h/v sont ignorés (`continue`) sans compter ; un emblème entièrement ignoré passe sans rien vérifier.
7. BASSE (lore). Les couleurs de tenue sont étiquetées `A` seulement en commentaire (tenues.py:324) et dans la note du manifeste ; docs/lore/creations.md n'a aucune entrée pour les tenues (« tenue » : 0 occurrence), contrairement à la règle de CLAUDE.md (toute création consignée). Fichier 10 §9 ne fixe que les insignes : coloris et coupes sont bien des créations A.

## Points conformes
- Provenance : aucun fichier tiers ; nouvelles entrées sans URL, CC0, usage `modele_projet` réservé à l'origine projet ; sources interdites toujours refusées (tests).
- Déterminisme : aucun random/horloge dans tools/blender ; chaque script lancé deux fois, empreintes comparées.
- Budgets réellement mesurés sur les accesseurs d'indices (accessoires ≤ 1 500, LOD0 ≤ 8 000, LOD1 ≤ 2 000, 3 à 4 matériaux nommés) ; hauteur 1,5-2,0 m, origine aux pieds.
- Licorne portée par la Police militaire ; cape verte seule `C`.
