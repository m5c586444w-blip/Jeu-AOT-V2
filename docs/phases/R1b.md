# R1b — Environnements, échelle et fidélité (rendu 3D)

> **Commit de départ : `b68fade`.** `git diff b68fade -- src/sim` doit rester vide pendant toute la phase.
> **Source.** Consigne de l'utilisateur du 2026-10-06 : « RENDU = 3D », puis le prompt R1b et son annexe A.
> - La partie B de l'annexe est enregistrée sans modification dans `docs/art/STYLES.md`.
> - Le prototype de R1 (`/proto3d`) reste une scène de démonstration, sans lien avec la simulation.
> - R1b lui ajoute des environnements générés à partir de profils de style en données, une galerie de Titans à l'échelle, le cycle du jour, la météo, et la qualité « haute » (instanciation, niveaux de détail).
>
> **Mesures de base**, build du commit `b68fade` (`npx vite build`) :
>
> | Fichier | Taille (octets) | sha256 |
> |---|---|---|
> | `dist/assets/index-Ct0rCUm6.js` | 902 588 | `b452fe27…0f5cd5` |
> | `dist/assets/sim.worker-BDqA4b1U.js` | — | `f30d630d…37854be` |

## 1. Règles propres à la phase

### Code et dépendances
- three.js n'est importé que dans `src/render/tactical3d`. La règle ESLint et son test (`tests/lint/sim-purity.test.ts`) sont ceux de R1.
- `Math.random` est interdit dans ce dossier. Toute variation sort d'une graine locale (`rng.ts`).
- Aucun asset externe : géométries, matériaux et textures sont procéduraux (canvas dessiné par code).
- Aucune copie de design de l'œuvre. Les Titans spéciaux (Titan-Mur, Titan de Rod Reiss, Colossal) n'ont que des proportions génériques, à leur taille de lore.

### Bundle principal : identique à l'octet
- `dist/assets/index-*.js` doit garder le même sha256 qu'au build de `b68fade`.
- **Fichiers de `data/art/`.** Le navigateur des Archives (`src/ui/canonBrowser.ts`) et le worker de simulation chargent `/data/**` par `import.meta.glob`. Tout fichier ajouté sous `data/` changerait donc le bundle principal et le worker.
  - On exclut `/data/art/**` de ces deux globs. Le motif d'exclusion ne figure pas dans le code produit : le bundle principal et le worker restent identiques à l'octet (vérifié avant de commencer, sha256 ci-dessus).
  - Les profils sont lus par le seul morceau 3D chargé à la demande.
- **Galerie.** Ne pas toucher `src/main.ts` (bundle principal). La galerie s'ouvre à `/proto3d/galerie` par une page de redirection statique, `public/proto3d/galerie.html`, vers `?proto3d=galerie`. En développement, c'est un intergiciel de `vite.config.ts` qui assure la même redirection.

### Images de référence (`docs/art/reference/`)
- Elles ne servent qu'à l'ambiance.
- Elles ne sont jamais importées par le code, jamais copiées comme texture, jamais présentes dans `dist` (hors de `public/`).
- Un test et le contrôle de `npm run mesure:r1b -- bundle` le vérifient.

### Lore
- La partie B prime pour le style ; l'ordre ERRATA > 11 > 01 > 02/03 > 06… prime pour les faits.
- Chaque profil porte `canon` (`C`, `A` ou `?`). Toute valeur incertaine est un paramètre `?` dans `data/art/`.
- Épaisseur et teinte du mur sont des paramètres `?`, à valider par l'utilisateur.

### Captures
Chaque capture est revue selon CLAUDE.md ligne 14 : ouverture avec l'outil de lecture d'image, description en 3 lignes, au moins 3 défauts possibles. Une capture vide ou qui ne montre pas l'élément testé met le critère en échec (KO).

## 2. Tâches

Un commit par tâche, `npm run verify` avant chacun.

| # | Tâche | Contenu |
|---|---|---|
| R1b.0 | Plan | Ce fichier ; `docs/art/STYLES.md` (partie B sans modification, empreinte sha256 contrôlée par test) ; `docs/art/reference/README.md` et test d'exclusion. |
| R1b.1 | Profils de style en données | `data/art/styles.json` : un profil par environnement de la partie B (E01–E08, E10–E29, soit 28). Champs :<br>• disposition, bâtiments, toits, matériaux, densité, palette (6 teintes) ;<br>• accessoires, terrain, végétation, visibilité du mur, variantes, lot ;<br>• `canon` et notes.<br>`data/art/materiaux.json` : teintes de base des matériaux et des toits. `data/art/murs.json` : paramètres du mur. Schémas Zod (`src/data/artSchemas.ts`), contrôlés par `data:validate`. Exclusion de `/data/art/**` des globs. Distance entre profils (`styles.ts`). |
| R1b.2 | Terrain et campagne | Générateur pur (`terrain.ts`, `noise.ts`) :<br>• relief par bruit (collines), rivières, lacs ;<br>• routes de terre, champs en patchwork, haies, vergers ;<br>• forêts instanciées, villages à plan organique.<br>Scènes E11 (village, 3 variantes) et E13 (campagne pure). Visionneuse `?proto3d&env=E13`. Niveaux de détail et instanciation (arbres, haies, piquets, gerbes). |
| R1b.3 | Villes par profil | Le générateur de ville lit le profil :<br>• disposition organique, planifiée ou quadrillée ;<br>• hauteurs, toits, matériaux, densité, palette ;<br>• repères : église à clocher, cathédrale, palais, casernes, marché ;<br>• canaux et ponts.<br>Scènes E01, E02, E05, E06. Plus aucune teinte codée en dur dans le maillage de la ville. |
| R1b.4 | Murs | `wall.ts` : mur de 50 m (mesuré) ; porte massive ; chemin de ronde avec canons sur rails ; pierre à joints ; variante endommagée (brèche qui révèle l'intérieur) ; saillie de district (porte extérieure et porte intérieure). Épaisseur et teinte : `?`. Règle de visibilité et son test. Scène E22. |
| R1b.5 | Forêt géante, territoire des Titans | **E14** :<br>• troncs ≈ 80 m, voûte, brume, rayons de lumière, mousse ;<br>• points d'ancrage ;<br>• 3 variantes : dense, clairière, lisière.<br>**E19** : ruines, charrettes abandonnées, végétation envahissante, Titans nombreux. |
| R1b.6 | Galerie de Titans, banc d'échelle | `data/art/titans.json`. Un seul squelette (18 articulations), des paramètres par classe :<br>• classes 3, 5, 8, 12 et 15 m ;<br>• variantes : anormal, sentinelle, chasseur, meute, nocturne ;<br>• Titan-Mur 50 m (buste) ; Titan de Rod Reiss 120 m (allongé) ; Colossal 60 m.<br>Pieds en contact avec le sol. Banc d'échelle : soldat de 1,7 m, tous les Titans, un mur de 50 m, une toise. Tests à ±5 %. |
| R1b.7 | Cycle, météo, état | Aube, jour, crépuscule, nuit ; brume, pluie, neige d'hiver ; variante « ruines et incendies » (bâtiments effondrés, feux, fumées). Qualité « haute » : distances de détail, densité de végétation, particules, feux éclairants. |
| R1b.8 | Lot 1 livré | `npm run smoke:r1b -- lot1` : planches jour et crépuscule de E01, E02, E05, E06, E11, E13, E14, E19, E22 (`docs/screenshots/r1b-*`), revues ; galerie `/proto3d/galerie` ; distances entre profils et entre rendus hors écran. `PROGRESS.md`. Puis le lot 2, sans attendre. |
| R1b.9 | Lot 2 | E03, E04, E07, E08, E10, E12, E15, E16, E17, E18, E20, E21, E23, E24, E25, E26, E27, E28, E29 (générateurs et planches). |
| R1b.10 | Mesures et rapport | `npm run mesure:r1b` : bundle (sha256), images par seconde par environnement et par qualité, appels de dessin, triangles, instances, mémoire, sans GPU (WebGL logiciel). Liste de ce qui doit être mesuré sur un vrai GPU. `docs/reports/R1b.md`, `PROGRESS.md`. **Arrêt obligatoire.** |

## 3. Critères

| # | Critère | Commande |
|---|---|---|
| CR1b-01 | La simulation n'a pas changé | `git diff --stat b68fade -- src/sim` : sortie vide |
| CR1b-02 | `npm run verify` au code 0 | `npm run verify` |
| CR1b-03 | Bundle principal inchangé : même sha256 et même taille qu'au build de `b68fade` (worker de simulation aussi) ; aucune image de `docs/art/reference/` dans `dist` | `npm run mesure:r1b -- bundle` |
| CR1b-04 | three.js seulement dans `src/render/tactical3d` ; pas de `Math.random` | `npx vitest run tests/lint/sim-purity.test.ts` |
| CR1b-05 | 28 profils valides (un par environnement de la partie B), chacun avec `canon` ; les générateurs lisent le profil : changer une teinte, une part de toits ou la densité change le résultat ; aucune teinte codée en dur dans les fichiers de génération | `npm run data:validate` ; `npx vitest run tests/render/tactical3d/styles.test.ts` |
| CR1b-06 | Distinction mesurable, pour chaque paire d'un même lot :<br>• distance entre profils (palette, toits, matériaux, densité) au-dessus du seuil justifié au § 4 ;<br>• distance de couleur moyenne entre rendus hors écran au-dessus de son seuil.<br>Tableaux au rapport. | `npx vitest run tests/render/tactical3d/styles.test.ts` ; `npm run smoke:r1b` (rendus) |
| CR1b-07 | Échelle :<br>• hauteurs mesurées sur la géométrie à ±5 % : soldat 1,7 m ; Titans de 3, 5, 8, 12, 15, 50, 60 et 120 m ; mur de 50 m ;<br>• rapports entre eux à ±5 % ;<br>• pieds au contact du sol (marche comprise) | `npx vitest run tests/render/tactical3d/echelle.test.ts` |
| CR1b-08 | Le mur n'est pas visible en campagne intérieure :<br>• aucun mur dans les scènes de campagne ;<br>• au milieu d'un anneau (≥ 50 km d'un mur), son sommet est sous l'horizon ;<br>• il est présent près des districts adossés | `npx vitest run tests/render/tactical3d/murs.test.ts` |
| CR1b-09 | Même graine = même environnement (données et géométrie, empreinte) ; autre graine = autre environnement | `npx vitest run tests/render/tactical3d/environnements.test.ts` |
| CR1b-10 | Terrain, forêt géante, territoire : éléments présents et mesurés.<br>• Terrain : relief, rivière, lac, routes, champs, haies, vergers, arbres instanciés.<br>• Forêt : troncs de 80 m à ±10 %, voûte, points d'ancrage.<br>• Territoire : ruines, charrettes, végétation | `npx vitest run tests/render/tactical3d/terrain.test.ts tests/render/tactical3d/environnements.test.ts` |
| CR1b-11 | Mur : 50 m mesurés, porte, chemin de ronde, canons posés sur leurs rails, variante endommagée | `npx vitest run tests/render/tactical3d/murs.test.ts` |
| CR1b-12 | Aube, jour, crépuscule, nuit ; brume, pluie, neige ; ruines et incendies : captures revues | `npm run smoke:r1b` → `docs/screenshots/r1b-cycle-*`, `r1b-meteo-*` |
| CR1b-13 | Une planche jour et crépuscule par environnement, et une galerie qui les montre toutes ; chaque capture revue (ligne 14) | `npm run smoke:r1b` → `docs/screenshots/r1b-E*.png`, `r1b-galerie.png` |
| CR1b-14 | Qualité « haute » : instanciation et niveaux de détail effectifs ; appels de dessin, triangles et instances mesurés par qualité | `npm run mesure:r1b` ; `npx vitest run tests/render/tactical3d/environnements.test.ts` |
| CR1b-15 | Mesures sans GPU collées ; liste de ce qui doit être mesuré sur un vrai GPU | `npm run mesure:r1b` ; rapport |
| CR1b-16 | Rapport et `PROGRESS.md` | `docs/reports/R1b.md` |

## 4. Seuils de distinction (justification)

### Distance entre profils
Les quatre composantes sont ramenées chacune à un « écart nettement perceptible » :

| Composante | Calcul | Unité d'écart nettement perceptible |
|---|---|---|
| Palette `p` | Moyenne symétrique, sur les 6 teintes, de la distance ΔE76 (CIELAB) de chaque teinte à la plus proche de l'autre palette | ΔE = 10 : deux teintes côte à côte se distinguent sans effort (le seuil à peine perceptible est ΔE ≈ 2,3) |
| Toits `t` | Distance de variation totale entre les parts de toits (tuiles rouges, ardoise, chaume, plat, aucun) | 0,25 : un bâtiment sur quatre change de couverture |
| Matériaux `m` | Distance de variation totale entre les parts de matériaux | 0,25 |
| Densité `d` | Écart absolu de densité bâtie | 0,15 |

- **Distance.** D = (p/10 + t/0,25 + m/0,25 + d/0,15) / 4 : le nombre moyen d'écarts nettement perceptibles par composante.
- **Seuil.** D ≥ 1.
- **Contrôle empirique.** Il porte sur les parts réalisées (toits, matériaux, densité) de 5 graines par profil :
  - la distance entre deux profils doit dépasser deux fois la plus grande distance mesurée entre deux graines d'un même profil (bruit de génération) ;
  - le test rapporte les deux valeurs.

### Distance entre rendus hors écran
- **Mesure.** Rendu de la vue principale de chaque environnement, de jour, en 256 × 144 hors écran ; couleur moyenne en CIELAB.
- **Seuil.** Pour chaque paire, ΔE76 ≥ 2,3, le seuil d'écart à peine perceptible.
- **Seconde mesure.** La couleur moyenne seule ignore la mise en page. Le rapport donne donc aussi la moyenne des ΔE sur une grille de 4 × 4 cases. Seuil : 5.

## 5. Hors périmètre

- Toute modification de `src/sim`, des données de jeu ou de l'équilibrage. `data/art/` est une donnée de rendu, exclue du worker de simulation.
- Le branchement du rendu 3D sur l'écran de bataille réel, la concordance des cartes tactiques de la simulation avec les villes générées (R2).
- Le tampon « Interprété » dans les Archives pour E26–E29 (interface du bundle principal) : noté pour plus tard.
- Les styles prévus plus tard par la partie B : Marley, Hizuru, Alliés (P7/P8, avec leur propre fiche).
- Audio ; interface de jeu.
