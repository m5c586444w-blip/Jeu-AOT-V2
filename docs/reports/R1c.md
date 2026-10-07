# Rapport R1c — bases CC0 (corps et animations), scènes réalistes, districts d'après l'animé

> Plan : `docs/phases/R1c.md`. Commit de départ : **`a2b2f88`** (fin de R1b).
> - **Mesures avant/après** (`npm run mesure:r1c`) : deux passages complets, l'état après étant celui de ce commit.
>   - essai 1 : `docs/reports/R1c-mesure-essai1-KO.log` et `R1c-mesures-essai1-KO.json` ;
>   - essai 2 : `docs/reports/R1c-mesure.log` et `R1c-mesures.json`.
> - **Batterie finale**, strictement séquentielle : `git diff`, `verify`, tests de R1c (`docs/reports/R1c-git-sim.log`, `R1c-verify.log`, `R1c-tests.log`).
> - **Captures appariées** : `docs/screenshots/r1c-<scène>-avant.png`, `-apres.png` et `-comparaison.png`, soit 15 scènes et 45 fichiers.
> - **Annexe** : formation des districts d'après l'animé, dans `docs/reports/R1c-annexe-districts.md`.
>
> **Arrêts obligatoires (deux raisons).**
> 1. **Fin de R1c** : revue de l'utilisateur (CLAUDE.md, arrêt 5).
> 2. **Un critère échoue deux fois** (arrêt 1). La latence de la scène tactique (cible 3 s, 04 §9) échoue aux deux passages : 10,25 s puis 8,91 s, contre 2,53 s avant R1c. Le correctif du premier échec gagne 1,3 s ; il ne suffit pas. Le détail est au § d. La décision revient à l'utilisateur (§ i).

## a. Critères

| # | Critère | Statut | Preuve |
|---|---|---|---|
| CR1c-01 | `src/sim` inchangé | **OK** | sortie vide ; données de jeu (`data` hors `data/art`) aussi inchangées (§ b1) |
| CR1c-02 | `npm run verify` au code 0 | **OK** | 71 fichiers, 433 tests, code 0 (§ b2) |
| CR1c-03 | `assets:check` : code 0 sur le dépôt, code 1 pour chaque cas d'échec | **OK** | 87 entrées, 87 fichiers ; 6 tests sur fixtures (§ b3) |
| CR1c-04 | Bundle principal inchangé ; GLTFLoader à la demande ; assets hors du JS | **OK** | même taille (902 588 octets) et même contenu normalisé ; worker identique à l'octet ; GLTFLoader dans `GLTFLoader-*.js` seulement ; aucun glTF dans le JS (§ c1) |
| CR1c-05 | Corps de base : maillage, 56 os, poids, cibles, empreinte, GLTFLoader | **OK** | `humain.test.ts`, 6 tests (§ b3) |
| CR1c-06 | Soldats : ≥ 6 animations, équipement aux os, 1,7 m ± 5 %, pieds au sol | **OK** | 7 animations ; `soldats-r1c.test.ts`, 5 tests ; captures `r1c-proto-*` (§ e) |
| CR1c-07 | Titans : hauteurs ± 5 %, proportions ± 10 %, pieds au sol, poses | **OK** | `titans-r1c.test.ts` (6) et `echelle.test.ts` (6) ; banc : de 2,95 à 15,06 m, Colossal 59,95 m, Titan-Mur 50,05 m, Rod Reiss 119,66 m (§ e) |
| CR1c-08 | Districts : saillie, deux portes, rue principale, éléments sourcés, `?` | **OK (tests) ; captures partielles** | `districts-r1c.test.ts`, 5 tests. Captures `r1c-E01`, `E02`, `E07` (vues principales) ; la voie d'eau de Shiganshina et le rocher de Trost n'y sont pas cadrés (§ e, § f) |
| CR1c-09 | Distinction des rendus (CR1b-06) remesurée | **Non vérifié** | `smoke:r1b` non lancé : la décision sur la latence (§ i) peut changer le rendu et rendrait la mesure caduque |
| CR1c-10 | Comparaison avant/après : captures revues, temps d'image, latence, poids | **KO (latence)** | Mesures et captures complètes (§ c, § e). Latences au-dessus des cibles : scène tactique (cible 3 s) en échec deux fois, 8,91 s ; E13 8,17 s et E14 26,68 s pour la cible de 8 s. Poids et bundle : OK |
| CR1c-11 | Rapport, `PROGRESS.md`, ce qui ne marche pas | **OK** | ce rapport ; § f |

## b. Sorties réelles

### b1. Simulation, données, imports (`docs/reports/R1c-git-sim.log`)
```
$ git diff --stat a2b2f88 -- src/sim
(fin de sortie ; code 0)

$ git diff --stat a2b2f88 -- data ':!data/art'
(fin de sortie ; code 0)

$ grep -rlE "from \"three" src | grep -v "^src/render/tactical3d/"
(fin de sortie)
```

### b2. `npm run verify` (`docs/reports/R1c-verify.log`, extrait)
```
 Test Files  71 passed (71)
      Tests  433 passed (433)
assets:check : 87 entrées, 87 fichiers ; licences, sources et empreintes conformes.
dist/assets/index-Bv_Xd8Ly.js                                     902.58 kB │ gzip: 275.35 kB
CODE 0
```
Au premier lancement de cette batterie, `verify` a échoué sur un seul test :
```
 FAIL  tests/lint/art-reference.test.ts > catalogue des styles et images de référence (R1b.0) > aucun fichier de src/, public/ ni index.html ne cite docs/art/reference
AssertionError: expected [ 'src/tools/mesure-r1c.ts' ] to deeply equal []
```
- **Cause.** L'outil de mesure de R1c contrôle, comme celui de R1b, que `dist` ne contient aucune image de référence. Il cite donc le dossier.
- **Correctif.** L'exception du test, qui ne visait que `mesure-r1b.ts`, couvre aussi `mesure-r1c.ts`. Ces deux outils Node ne sont jamais empaquetés.
- **Résultat.** Le second lancement est celui collé ci-dessus.

### b3. Tests de R1c (`docs/reports/R1c-tests.log`, `--reporter=verbose`)
```
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > le .glb se reconstruit à l'identique depuis les sources CC0 (npm run assets:build -- --verifier)
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > gabarit : 12 primitives (8 régions de peau, collant, dents, langue, yeux), 56 os, 50 cibles, poids normalisés
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > hauteur exacte, pieds au sol, pour des corps très différents
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > les cibles macro changent le corps ; les articulations les suivent ; même forme, même empreinte
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > proportions au repos : tête × 1,9, jambes × 0,66, bras × 0,8 (mesurées à ±5 %, avant mise à l'échelle)
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > mâchoire et yeux articulés : la mâchoire ouvre la bouche (dents du bas seulement), l'œil tourne sans la peau
 ✓ tests/render/tactical3d/soldats-r1c.test.ts > soldats sur le corps de base (R1c.2) > 7 animations ; pieds au sol à ±2 cm dans les poses au sol, à chaque instant
 ✓ tests/render/tactical3d/soldats-r1c.test.ts > soldats sur le corps de base (R1c.2) > hauteur : 1,7 m à ±5 % debout (banc) ; tailles tirées de la graine entre 1,58 et 1,86 m
 ✓ tests/render/tactical3d/soldats-r1c.test.ts > soldats sur le corps de base (R1c.2) > l'équipement est porté par les os : réservoir et lanceurs au bassin, fourreaux aux cuisses, lames aux mains, cape au haut du dos
 ✓ tests/render/tactical3d/soldats-r1c.test.ts > soldats sur le corps de base (R1c.2) > les poses bougent avec le temps ; vol et accroche quittent le sol
 ✓ tests/render/tactical3d/soldats-r1c.test.ts > soldats sur le corps de base (R1c.2) > même graine, même soldat ; graines différentes, soldats différents
 ✓ tests/render/tactical3d/titans-r1c.test.ts > Titans sur le corps de base (R1c.3) > hauteur debout mesurée à ±5 % : classes 3–15 m, variantes, Titan-Mur 50 m, Colossal 60 m, Rod Reiss 120 m
 ✓ tests/render/tactical3d/titans-r1c.test.ts > Titans sur le corps de base (R1c.3) > proportions mesurées au repos conformes aux paramètres à ±10 % : tête, jambes, bras, avant-bras
 ✓ tests/render/tactical3d/titans-r1c.test.ts > Titans sur le corps de base (R1c.3) > pieds au sol (±0,5 % de la hauteur), debout, en marche, en course, en buste, y compris sur un relief
 ✓ tests/render/tactical3d/titans-r1c.test.ts > Titans sur le corps de base (R1c.3) > corps couchés à plat : abattu et allongé touchent le sol ; Rod Reiss allongé plus long que haut
 ✓ tests/render/tactical3d/titans-r1c.test.ts > Titans sur le corps de base (R1c.3) > interface des Titans de R1 : 18 articulations portées par les os, mâchoire, marque de nuque au cou, vapeur
 ✓ tests/render/tactical3d/titans-r1c.test.ts > Titans sur le corps de base (R1c.3) > même graine, même Titan ; graines différentes, individus différents ; repli sur les figures de R1 sans gabarit
 ✓ tests/render/tactical3d/rendu-r1c.test.ts > rendu réaliste (R1c.4) > arbres : mêmes attributs partout, bois séparé, cartes de feuillage au niveau proche, géométries déterministes
 ✓ tests/render/tactical3d/rendu-r1c.test.ts > rendu réaliste (R1c.4) > houppier : normales unitaires, tournées vers l'extérieur du houppier (lumière de volume)
 ✓ tests/render/tactical3d/rendu-r1c.test.ts > rendu réaliste (R1c.4) > pièces assemblées : la normale suit la transformation (translation, échelle non uniforme), sans retournement
 ✓ tests/render/tactical3d/rendu-r1c.test.ts > rendu réaliste (R1c.4) > ciel physique (nuages calculés) le jour à l'air libre ; dôme peint à l'aube, au crépuscule, la nuit et sous terre
 ✓ tests/render/tactical3d/rendu-r1c.test.ts > rendu réaliste (R1c.4) > post-traitement : aucun en qualité basse ; occlusion ambiante en qualité moyenne et haute
 ✓ tests/render/tactical3d/rendu-r1c.test.ts > rendu réaliste (R1c.4) > végétation : bois non teinté par le feuillage ; cartes de feuillage seulement avec la texture de feuilles
 ✓ tests/render/tactical3d/districts-r1c.test.ts > districts d'après l'animé (R1c.5) > chaque district : saillie hors de la ligne du mur, porte extérieure à la pointe, porte intérieure dans la ligne principale
 ✓ tests/render/tactical3d/districts-r1c.test.ts > districts d'après l'animé (R1c.5) > rue principale pavée de porte à porte, sans maison dessus
 ✓ tests/render/tactical3d/districts-r1c.test.ts > districts d'après l'animé (R1c.5) > Shiganshina : voie d'eau par deux portes de rivière, barques d'évacuation côté porte intérieure, ponts, lit libre de maisons
 ✓ tests/render/tactical3d/districts-r1c.test.ts > districts d'après l'animé (R1c.5) > Trost 850 : la porte extérieure bouchée par le rocher ; les autres districts n'ont pas de voie d'eau
 ✓ tests/render/tactical3d/districts-r1c.test.ts > districts d'après l'animé (R1c.5) > dimensions incertaines marquées « ? » ; faits de l'animé notés dans les profils ; même graine, même district
 ✓ tests/lint/assets-check.test.ts > assets:check (R1c) > le dépôt passe : chaque fichier de docs/art/assets/ a son entrée, sa licence, sa source retenue et son empreinte
 ✓ tests/lint/assets-check.test.ts > assets:check (R1c) > un cas valide minimal passe
 ✓ tests/lint/assets-check.test.ts > assets:check (R1c) > fichier sans entrée, entrée sans fichier : échec
 ✓ tests/lint/assets-check.test.ts > assets:check (R1c) > licence autre que CC0 ou CC-BY : échec ; CC-BY sans attribution : échec ; CC-BY attribuée : passe
 ✓ tests/lint/assets-check.test.ts > assets:check (R1c) > source écartée (non réaliste), source interdite (œuvre ou fan), source inconnue : échec
 ✓ tests/lint/assets-check.test.ts > assets:check (R1c) > empreinte fausse : échec ; dérivé sans source ou d'une source absente : échec
 ✓ tests/render/tactical3d/echelle.test.ts > banc d'échelle (R1b.6) > soldat 1,7 m et mur 50 m, mesurés, à ±5 %
 ✓ tests/render/tactical3d/echelle.test.ts > banc d'échelle (R1b.6) > Titans : classes 3, 5, 8, 12, 15 m, variantes, Titan-Mur 50 m, Colossal 60 m, Titan de Rod Reiss 120 m — hauteur debout mesurée à ±5 %
 ✓ tests/render/tactical3d/echelle.test.ts > banc d'échelle (R1b.6) > hauteurs relatives à ±5 % : Titans / soldat, mur / Titans
 ✓ tests/render/tactical3d/echelle.test.ts > banc d'échelle (R1b.6) > pieds au contact du sol : debout, en marche, en course, posés sur un relief (sol à 37 m)
 ✓ tests/render/tactical3d/echelle.test.ts > banc d'échelle (R1b.6) > Titan de Rod Reiss allongé : à plat sur le sol, plus long que haut
 ✓ tests/render/tactical3d/echelle.test.ts > banc d'échelle (R1b.6) > données : soldat, classes et Titans spéciaux portent un statut canon
 Test Files  7 passed (7)
      Tests  40 passed (40)
CODE 0
```
(Lignes regroupées par fichier ; l'ordre d'exécution de Vitest les entremêle dans le journal.)

## c. Comparaison avant/après (`npm run mesure:r1c`, essai 2)

**Conditions.**
- Les deux constructions de production sont servies par `vite preview`. « Avant » est construit dans un arbre de travail temporaire au commit `a2b2f88`.
- Chaque scène est ouverte dans un Chromium neuf (cache vide), en WebGL logiciel : `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
- Fenêtre 1366 × 768, qualité moyenne sauf mention, jour, temps figé à t = 1 s.
- Prêt : de la navigation à « prêt » (première image rendue).
- Temps d'image : rappels `requestAnimationFrame` comptés 6 s après 2 s de chauffe.

**Ces chiffres mesurent un processeur qui émule le GPU.** Ils bornent par le bas ; la mesure sur un vrai GPU reste à faire (plan, § 1).

### c1. Bundle et poids (CR1c-04)
```
=== Bundle (commit de départ a2b2f88 contre l'état courant) ===
bundle principal avant : assets/index-C2a64iEC.js  902588 octets (266.8 Kio gzip)  sha256 0df641da4bd7f51a1d98dd57403031325fed713ae736a5f710fd6cbacfc6f84e
bundle principal après : assets/index-Bv_Xd8Ly.js  902588 octets (266.8 Kio gzip)  sha256 32335e58b6370e0ebe5dd657b9ff358510052fbac8fcbb82db490168298810b7
contenu normalisé (noms de morceaux hachés remplacés) : avant 83257ce2cb2f139a…, après 83257ce2cb2f139a…
worker avant : sim.worker-BDqA4b1U.js  620332 octets  sha256 f30d630d5356e51fb52913c9828c84a1c6951626b088c4b922bbd792537854be
worker après : sim.worker-BDqA4b1U.js  620332 octets  sha256 f30d630d5356e51fb52913c9828c84a1c6951626b088c4b922bbd792537854be
  OK  bundle principal : même taille (902588 → 902588 octets)
  OK  bundle principal : même contenu une fois les noms de morceaux hachés normalisés
  OK  worker de simulation identique à l'octet
  OK  aucune signature three.js dans le bundle principal (0)
  OK  aucune signature GLTFLoader dans le bundle principal (0)
morceaux 3D chargés à la demande, avant : 6 morceaux, 699840 octets (188.9 Kio gzip)
  assets/titan-DOAI98AB.js  588982 octets (147.1 Kio gzip), THREE. : 45, GLTFLoader : non
  assets/envViewer-GvoYyGE7.js  82067 octets (29.0 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/proto-CUnN29wN.js  15140 octets (6.3 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/entry-CBEZ-FGT.js  5223 octets (2.4 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/bench-DE7N72VI.js  5039 octets (2.5 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/gallery-BrXcDtw0.js  3389 octets (1.6 Kio gzip), THREE. : 0, GLTFLoader : non
morceaux 3D chargés à la demande, après : 9 morceaux, 978890 octets (269.1 Kio gzip)
  assets/bodies-D6keDjFj.js  752636 octets (195.1 Kio gzip), THREE. : 63, GLTFLoader : non
  assets/envViewer-CcVcyq-z.js  92296 octets (32.8 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/post-bUm-hArz.js  54770 octets (12.9 Kio gzip), THREE. : 2, GLTFLoader : non
  assets/GLTFLoader-DsVKX2D1.js  44303 octets (12.8 Kio gzip), THREE. : 25, GLTFLoader : oui
  assets/proto-CMjlxtXX.js  15896 octets (6.6 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/entry-CkW4H6Dq.js  5727 octets (2.6 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/bench-BjmyTzhG.js  5139 octets (2.5 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/humanViewer-Bzfnqgtg.js  4660 octets (2.2 Kio gzip), THREE. : 0, GLTFLoader : non
  assets/gallery-Ck9HVdPY.js  3463 octets (1.6 Kio gzip), THREE. : 0, GLTFLoader : non
  OK  GLTFLoader dans un morceau chargé à la demande (GLTFLoader-DsVKX2D1.js)
  OK  aucun modèle glTF inclus dans le JS (aucun)
assets 3D (dist/assets3d/) : 2 fichiers, 6.17 Mio (2.65 Mio gzip)
  assets3d/derives/humain.glb  5863048 octets (2.07 Mio gzip)
  assets3d/makehuman/eyes/brown_eye.png  610817 octets (0.58 Mio gzip)
  OK  assets 3D servis = fichiers « execution » du manifeste (derives/humain.glb, makehuman/eyes/brown_eye.png)
docs/art/assets (sources, dérivés et manifeste, hors construction) : 15.29 Mio
docs/art/reference : 0 image(s) ; dist : 69 fichiers dont 1 image(s) (assets3d/makehuman/eyes/brown_eye.png)
  OK  aucune image de référence dans dist (nom : 0, contenu : 0)
```
Bilan :
- **Code 3D à la demande** : +279 050 octets (+80,2 Kio gzip). Le gros morceau three.js, nommé `bodies-*` par Vite, grandit de 163 654 octets : `Sky`, `PMREMGenerator`, corps de base et animations. GLTFLoader (44 Kio) et le post-traitement (55 Kio) ont leur propre morceau.
- **Assets** : 6,17 Mio, téléchargés seulement par les pages qui affichent des corps.

### c2. Latence et temps d'image (cibles 04 §9 : chargement à froid < 8 s ; scène tactique < 3 s)
```
jeu      avant chargement à froid (carte stratégique prête) : 2.24 s
jeu      apres chargement à froid (carte stratégique prête) : 2.19 s
résumé (après / avant) :
  proto        prêt 2.53 → 8.91 s · temps d'image 465 → 1596 ms (× 3.43) · triangles 0.51 → 1.63 M · RSS 796 → 1004 Mo
  proto-suivi  prêt 2.45 → 8.74 s · temps d'image 431 → 1468 ms (× 3.40) · triangles 0.49 → 1.62 M · RSS 793 → 1012 Mo
  proto-bas    prêt 1.76 → 5.82 s · temps d'image 208 → 632 ms (× 3.05) · triangles 0.18 → 0.75 M · RSS 772 → 901 Mo
  proto-haut   prêt 3.05 → 9.19 s · temps d'image 585 → 1636 ms (× 2.80) · triangles 0.51 → 1.63 M · RSS 851 → 1065 Mo
  E01          prêt 2.71 → 6.29 s · temps d'image 382 → 1133 ms (× 2.97) · triangles 0.25 → 0.24 M · RSS 868 → 939 Mo
  E02          prêt 3.07 → 6.48 s · temps d'image 495 → 1369 ms (× 2.77) · triangles 0.27 → 0.27 M · RSS 882 → 966 Mo
  E07          prêt 2.66 → 6.39 s · temps d'image 423 → 1368 ms (× 3.23) · triangles 0.26 → 0.25 M · RSS 853 → 935 Mo
  E13          prêt 3.64 → 8.17 s · temps d'image 455 → 1690 ms (× 3.71) · triangles 1.30 → 4.91 M · RSS 806 → 879 Mo
  E14          prêt 4.81 → 26.68 s · temps d'image 1053 → 6110 ms (× 5.80) · triangles 1.26 → 3.17 M · RSS 934 → 925 Mo
  E17          prêt 2.13 → 4.54 s · temps d'image 286 → 916 ms (× 3.21) · triangles 0.44 → 0.41 M · RSS 770 → 841 Mo
  E19-titans   prêt 2.76 → 7.44 s · temps d'image 353 → 1054 ms (× 2.99) · triangles 1.17 → 1.27 M · RSS 864 → 976 Mo
  E20          prêt 2.24 → 6.84 s · temps d'image 241 → 1602 ms (× 6.66) · triangles 0.40 → 1.40 M · RSS 787 → 870 Mo
  E22          prêt 1.95 → 4.53 s · temps d'image 205 → 874 ms (× 4.27) · triangles 0.19 → 0.26 M · RSS 794 → 863 Mo
  banc         prêt 2.81 → 6.50 s · temps d'image 731 → 1131 ms (× 1.55) · triangles 0.00 → 0.00 M · RSS 822 → 899 Mo
  galerie      prêt 56.39 → 106.93 s · temps d'image 17 → 17 ms (× 1.00) · triangles 0.00 → 0.00 M · RSS 869 → 1126 Mo
```
Contrôles en échec (essai 2) :
```
  KO  proto après : scène tactique prête en 8.91 s < 3 s (avant : 2.53 s)
  KO  proto-suivi après : scène tactique prête en 8.74 s < 3 s (avant : 2.45 s)
  KO  proto-bas après : scène tactique prête en 5.82 s < 3 s (avant : 1.76 s)
  KO  proto-haut après : scène tactique prête en 9.19 s < 3 s (avant : 3.05 s)
  KO  E13 après : prête en 8.17 s < 8 s (avant : 3.64 s)
  KO  E14 après : prête en 26.68 s < 8 s (avant : 4.81 s)
mesure:r1c : 6 contrôle(s) en échec.
```
Lecture :
- **Jeu (carte stratégique).** Inchangé : 2,19 s pour une cible de 8 s. Son bundle est identique.
- **Scène tactique.** 3,5 fois plus lente à paraître ; aucune qualité ne passe sous 3 s.
- **Environnements.** 2 à 5,5 fois plus lents. E13 et E14 dépassent 8 s, cible retenue pour la visionneuse (§ g2).
- **Galerie et banc.** Pages de contrôle, sans cible : la galerie prenait déjà 56 s avant R1c.
- **Temps d'image.** 2,8 à 6,7 fois celui d'avant. Ce n'est plus un critère depuis la consigne de R1c ; il est donné pour mémoire.
- **Mémoire.** RSS de tout le navigateur au plus 1 126 Mo (galerie) ; scène tactique 1 004 à 1 065 Mo. Cible : < 2 Go.

### c3. Chargement à débit limité (10 Mbit/s, 40 ms, cache vide)
```
jeu      avant à 10 Mbit/s, 40 ms : prêt en 2.52 s ; transféré : JS 480.3 Kio, assets 3D 0.00 Mio, total 0.63 Mio
jeu      apres à 10 Mbit/s, 40 ms : prêt en 2.53 s ; transféré : JS 480.3 Kio, assets 3D 0.00 Mio, total 0.63 Mio
tactique avant à 10 Mbit/s, 40 ms : prêt en 3.15 s ; transféré : JS 492.6 Kio, assets 3D 0.00 Mio, total 0.52 Mio
tactique apres à 10 Mbit/s, 40 ms : prêt en 14.95 s ; transféré : JS 560.9 Kio, assets 3D 6.17 Mio, total 6.76 Mio
```
- **Assets non compressés.** Le corps de base et l'atlas des yeux (6,17 Mio) passent tels quels : `vite preview` ne les compresse pas.
- **Gain possible.** Le `.glb` tombe à 2,07 Mio en gzip, ce qui ferait gagner environ 2,8 s à ce débit (3,5 Mio de moins). La mise en place resterait au-dessus de 3 s (§ d).

## d. Latence de la scène tactique : analyse, correctif, second échec

**Essai 1 : 10,25 s** (`R1c-mesure-essai1-KO.log`, avant : 2,56 s).

**Mise au point** (`docs/reports/R1c-latence-mise-au-point.log`). L'outil de profil est temporaire. Chaque ligne vient d'une seule exécution, sur la construction de production.

1. **Le JavaScript tient en ≈ 3,9 s.** La sonde ajoutée à `window.__proto3d.timings` donne :

   | Étape | Temps |
   |---|---|
   | Entrée dans la page | 0,19 s |
   | Corps de base (chargement, préparation) | 0,16 s |
   | Ville et lumière | 0,30 s |
   | Titans | 0,27 s |
   | 20 soldats | 0,94 s |
   | Réglages | 0,11 s |
   | Première image (JavaScript) | 1,9 s, dont ≈ 1,2 s d'attente de compilation des shaders (`onFirstUse` de three.js) |

2. **Le processus GPU logiciel prend le reste.** Après la première image, le fil principal reste 6 à 8 s en code natif (« (program) »), sans aucun JavaScript, avant de rendre la main. C'est le processus GPU logiciel qui compile ses pipelines et dessine. La scène compte 35 programmes de shaders, contre 23 avec les figures de R1.
3. **Qui coûte quoi** (temps « prêt ») :

   | Variante | Prêt |
   |---|---|
   | Corps MakeHuman, jour | 10,46 s |
   | Corps MakeHuman, aube | 12,22 s |
   | Figures de R1, jour | 7,08 s |
   | Figures de R1, qualité basse, aube | 6,04 s |
   | Même chose, sans carte d'environnement | 2,20 s |

   La carte d'environnement coûtait donc à elle seule ≈ 3,8 s : filtrage PMREM de 256 texels par face, une vingtaine de passes plein écran. Les corps coûtent ≈ 3,4 s : façonnage et shaders à peau.

**Correctif (un seul, selon la règle d'arrêt).**
- **Changement.** Carte d'environnement à 64 texels par face (`ENV_MAP_SIZE`, `lighting.ts`).
- **Pourquoi c'est sans perte visible.** Le ciel est lisse, et la carte ne sert qu'aux reflets flous et à la lumière diffuse. Les captures d'après ne montrent pas de différence de reflets.
- **Gain** :

   | Variante | Avant correctif | Après correctif |
   |---|---|---|
   | Figures de R1, qualité basse, aube | 6,04 s | 3,34 s |
   | Scène complète | 10,46 s | 9,48 s |

**Essai 2 : 8,91 s** (qualité moyenne) ; 5,82 s en basse ; 9,19 s en haute. **Second échec : arrêt.**

**Pourquoi la cible n'est pas tenable sans renoncer au réalisme demandé** (mesures logicielles) :
- **JavaScript.** Il prend à lui seul ≈ 3,2 s à l'essai 2 (somme de la sonde) :
  - façonnage de 20 corps : ≈ 0,8 s ;
  - première image : ≈ 1,5 s, dont l'attente des shaders.
- **GPU logiciel.** S'y ajoutent ≈ 5,7 s pour la première image : 35 programmes, peau, cartes de relief, éclairage d'image, ombres douces, occlusion ambiante.
- **Seuls moyens repérés de descendre sous 3 s, en rendu logiciel** :
  - les figures de R1 ;
  - aucune carte d'environnement ;
  - la qualité basse.

  C'est exactement ce que la consigne de R1c a remplacé.

## e. Captures (CLAUDE.md ligne 14 : trois lignes, au moins trois défauts possibles)
Chaque scène a été ouverte avec l'outil de lecture d'image :
- la planche de comparaison (avant et après côte à côte, demi-taille) ;
- la capture « après » en pleine taille pour `proto`, `proto-suivi`, `E01`, `E14` et `banc`.

**Défaut commun aux villes et à la scène tactique.** Les façades perdent leurs teintes chaudes d'avant : elles passent à un blanc bleuté. Les ombres portées sont plus pâles. L'éclairage d'image du ciel ajoute une lumière froide partout.

**r1c-proto (avant / après)**
- Description :
  - vue plongeante sur la ville de R1 : façades, toits rouges et ardoises, place à fontaine ; les étals sont colorés après (noirs avant, normales corrigées en R1c.4) ;
  - le grand Titan (corps MakeHuman, peau claire) marche au centre, deux soldats accrochés par leurs câbles ;
  - le petit Titan, trapu, est dans le marché en bas à droite ; une escouade minuscule en bas à droite.
- Défauts possibles :
  1. façades délavées et bleutées, le crème et l'ocre d'avant ont disparu ;
  2. ombres portées plus pâles qu'avant ;
  3. arbres du prototype toujours en icosaèdres de R1 (les arbres réalistes ne servent qu'aux environnements) ;
  4. Titans nus et lisses, peau uniforme : lecture « mannequin » ;
  5. soldats de quelques pixels, coupés par le bord bas.

**r1c-proto-suivi**
- Description :
  - caméra de suivi derrière le grand Titan vu de dos, sur la rue pavée ;
  - deux soldats accrochés à ses épaules par des câbles, traînées de gaz ;
  - le petit Titan à gauche, étals et façades au fond, ciel clair.
- Défauts possibles :
  1. tête et marque de nuque du grand Titan coupées par le bord haut ;
  2. le Titan ne projette presque plus d'ombre sur la rue (ombre nette avant) ;
  3. dos et jambes d'un humain ordinaire, sans relief musculaire : peu lisible comme Titan ;
  4. arbre en icosaèdres à droite ;
  5. traînées de gaz en boudins blancs uniformes.

**r1c-proto-bas et r1c-proto-haut** (comparaisons)
- Description :
  - même vue, en qualité basse (sans occlusion ambiante) et haute (16 échantillons d'occlusion, ombres plus fines) ;
  - mêmes corps qu'en qualité moyenne ;
  - façades plus pâles qu'avant dans les deux.
- Défauts possibles :
  1. même délavement des façades ;
  2. la différence entre moyenne et haute est à peine visible à cette taille ;
  3. fontaine blanche saturée ;
  4. soldats illisibles.

**r1c-E01** (Shiganshina)
- Description :
  - vue d'ensemble depuis la saillie : maisons à toits rouges, clocher, deux places (l'une avec étals), rues et pelouses ;
  - le mur principal en arc au fond, la porte intérieure à droite ;
  - ciel bleu à cirrus.
- Défauts possibles :
  1. de grands îlots d'herbe vides : le district paraît clairsemé (maisons retirées pour la rue principale et la voie d'eau) ;
  2. la voie d'eau, les barques et les portes de rivière ne sont pas dans le cadre (un bout de canal au bord gauche) ;
  3. mur en surface grise à motif répété ;
  4. la rue principale droite ne ressort pas dans cette vue ;
  5. façades très blanches, contraste faible.

**r1c-E02** (Trost)
- Description :
  - depuis le chemin de ronde (rails et canon au premier plan) ;
  - maisons serrées à toits rouges et ardoises, place, église ;
  - mur et porte au fond, ciel bleu à nuages.
- Défauts possibles :
  1. dominante bleue sur les façades et le mur ;
  2. premier plan en large bande claire uniforme ;
  3. ombres des rues pâles ;
  4. le rocher (variante `850_rocher`) n'est pas dans cette vue.

**r1c-E07** (Orvud, vue recomposée en R1c.5)
- Description :
  - vue plus basse : église à flèche, tour carrée, place à fontaine ;
  - maisons à toits rouges et ardoises ;
  - mur et porte au fond.
- Défauts possibles :
  1. maisons coupées sur les bords ;
  2. le mur du fond, gris uniforme, occupe une large bande ;
  3. façades blanches sans usure ;
  4. place vide de figures et d'objets.

**r1c-E13** (campagne pure)
- Description :
  - champs jaunes et verts bordés de haies, bosquets et forêt au centre ;
  - fermes et mare bleue ;
  - ciel bleu à nuages calculés.
- Défauts possibles :
  1. arbres lointains en taches sombres sans silhouette ;
  2. brume blanche à l'horizon ;
  3. champs en aplats, sans sillons visibles ;
  4. 4,91 M triangles (contre 1,30 M) pour un gain peu visible à cette distance.

**r1c-E14** (forêt des Arbres Géants)
- Description :
  - troncs immenses à moignons de branches ;
  - houppiers verts couverts de feuilles (avant : masses noires) ;
  - rais de lumière et brume.
- Défauts possibles :
  1. voile laiteux uniforme, contraste faible ;
  2. bande sombre sur tout le bas de l'image (déjà présente avant) ;
  3. troncs à bandes horizontales (anneaux visibles) ;
  4. rais de lumière en plans à bords nets ;
  5. 26,68 s pour la première image, 6,1 s par image.

**r1c-E17** (eaux, marais ; vue recomposée en R1c.5)
- Description :
  - rivière large au premier plan à gauche, rides animées ;
  - mares, bosquet à droite, plaine herbeuse ;
  - ciel bleu.
- Défauts possibles :
  1. plaine uniforme, aucun roseau visible au premier plan ;
  2. motif des rides répété ;
  3. horizon blanc sans arrière-plan ;
  4. moitié droite vide.

**r1c-E19-titans** (territoire, Titans nombreux)
- Description :
  - steppe jaune, village en ruines ;
  - plusieurs Titans (corps humains) en marche ;
  - lisière d'arbres à l'horizon, ciel à nuages.
- Défauts possibles :
  1. Titans petits et pâles, peu lisibles sur le sol clair ;
  2. sol uniforme délavé ;
  3. ruines grises sans contraste ;
  4. premier plan vide.

**r1c-E20** (château d'Utgard ; vue recomposée en R1c.5)
- Description :
  - château rapproché et centré : enceinte, tours rondes à toits coniques, donjon crénelé ;
  - rochers et touffes d'herbe devant ;
  - forêt à droite, ciel bleu à nuages.
- Défauts possibles :
  1. pierre claire répétée, sans usure ;
  2. touffes d'herbe en éclats jaunes ;
  3. premier plan d'herbe uniforme ;
  4. temps d'image 6,7 fois celui d'avant.

**r1c-E22** (murs)
- Description :
  - mur de 50 m en perspective, porte et maison de garde ;
  - chemin, prairie, ombre du mur à son pied ;
  - ciel bleu.
- Défauts possibles :
  1. parement bleuté répété ;
  2. prairie vide ;
  3. contraste faible ;
  4. canons du chemin de ronde invisibles à cette distance.

**r1c-banc** (banc d'échelle)
- Description :
  - en haut : Colossal 59,95 m, Titan-Mur en buste 50,05 m derrière un pan de mur, Titan de Rod Reiss allongé 119,66 m ;
  - en bas : soldat 1,70 m et Titans mesurés à 2,95, 4,93, 8,01, 11,92 et 15,06 m, puis anormal (11,93 m), sentinelle, chasseur, nocturne ;
  - toise rayée et lignes de sol.
- Défauts possibles :
  1. étiquettes « sentinelle » et « chasseur » chevauchées, valeur de la sentinelle illisible ;
  2. le Titan-Mur est presque caché par le pan de mur ;
  3. le Colossal est un humain agrandi, sans muscles écorchés ;
  4. soldat minuscule devant la toise.

**r1c-galerie** (galerie des environnements)
- Description :
  - page « Galerie des environnements » : vignettes jour et crépuscule de chaque environnement ;
  - la capture montre la première rangée (Shiganshina, Trost, Stohess, Mitras) et le début de la deuxième ;
  - après : ciels bleus de jour.
- Défauts possibles :
  1. vignettes de crépuscule presque identiques avant et après (dôme peint) ;
  2. Mitras vue de très haut, grise ;
  3. « 56 vignettes rendues en 107 s » (56 s avant) ;
  4. seule la première rangée est dans le cadre.

## f. Ce qui ne marche pas
1. **Latence de la scène tactique** : 8,91 s pour une cible de 3 s (2,53 s avant R1c). En échec deux fois ; arrêt (§ d).
2. **Latence de deux environnements** : E13 à 8,17 s, E14 à 26,68 s, pour une cible de 8 s. Dans la forêt, les cartes de feuillage à découpe sont très coûteuses en rendu logiciel.
3. **Débit limité** : scène tactique en 14,95 s à 10 Mbit/s. Les 6,17 Mio d'assets ne sont pas compressés.
4. **Teintes** : façades blanchies et bleutées, ombres plus pâles dans les villes et la scène tactique (§ e). Le réglage de l'éclairage d'image (D-88) est à revoir.
5. **Arbres du prototype** : la scène tactique garde les arbres en icosaèdres de R1. Seuls les environnements ont les arbres réalistes.
6. **Shiganshina** : la rive est de la saillie est une prairie vide, et les ponts sont des dalles. La voie d'eau n'est cadrée dans aucune vue principale.
7. **Corps** :
   - Titans nus et lisses, peu lisibles comme Titans ;
   - plis sombres sur les cuisses dans la pose de saisie ;
   - marque de nuque visible sous certains angles ;
   - animations écrites par le projet, simples : aucune source réaliste joignable n'en fournit.
8. **Forêt des Arbres Géants** : voile laiteux, bande sombre en bas, troncs à bandes.
9. **Banc** : étiquettes chevauchées.
10. **Non mesuré** :
    - CR1b-06 (`smoke:r1b`, distinction des rendus), en attente depuis l'arrêt de R1b ;
    - toute mesure sur un vrai GPU.

## g. Affirmations, interprétations, éléments non confirmés (14 §7 d)

### g1. Affirmations sourcées dans les fichiers du projet
- **Murs et districts.** Trois murs concentriques ; quatre districts par mur, avancés hors du mur. Sources : 01 §3.1, 06, et la partie B de `docs/art/STYLES.md` (E01, saillie).
- **Portes de Shiganshina en 845.** Porte extérieure brisée par le Colossal, porte intérieure par le Cuirassé : 01 §1.
- **Hauteurs** :
  - classes de Titans de 3 à 15 m, Titan-Mur 50 m, Colossal 60 m, Titan de Rod Reiss 120 m : `data/art/titans.json`, avec leurs statuts canon (test `echelle.test.ts`) ;
  - soldat 1,7 m.
- **Latence** : chargement < 8 s, scènes tactiques < 3 s, mémoire < 2 Go (04 §9).
- **Faits de l'animé retenus pour les districts** (annexe, faits 1, 3, 4, 5, 6, 7, 8 ; extraits des pages citées) :
  - portes extérieure et intérieure ;
  - larges rues menant à la porte ;
  - portes de rivière et barques de Shiganshina ;
  - casernes ;
  - canons ;
  - rocher de Trost.

### g2. Interprétations ou adaptations (A)
- **Animations** écrites par le projet sur le squelette CC0 : MakeHuman ne fournit que des poses figées (plan § 1).
- **Paramètres de R1b lus sur un corps humain** : segments, largeur de tête, pieds, corpulence, expressions (D-87).
- **Rendu réaliste** (D-88) :
  - ciel physique le jour seulement ;
  - éclairage d'image dosé ;
  - occlusion ambiante depuis la profondeur ;
  - arbres procéduraux.
- **Districts** (D-89) :
  - tracé de la rue principale droite ;
  - tracé de la voie d'eau (`WATER_ROUTE`) ;
  - position du poste de la Garnison ;
  - forme du rocher ;
  - rôle d'appât des districts (fait 2).
- **Mesure de latence par type de page** (D-90) :
  - 3 s pour la scène tactique (prototype de R1) ;
  - 8 s pour la visionneuse d'un environnement ;
  - aucune cible pour les pages de contrôle (banc, galerie).
- **Carte d'environnement à 64 texels par face** (D-90).

### g3. Éléments non confirmés ou paramétrables (`?`)
- Dans `data/art/murs.json` :
  - `saillie_rayon_m` (380 m) ;
  - `porte_largeur_m` et `porte_hauteur_m` (12 et 18 m) ;
  - `porte_eau_largeur_m` et `porte_eau_hauteur_m` (14 et 11 m).
- Rails des canons tout autour du mur : dépend de l'année.
- Ascenseurs des murs : non confirmés, non rendus.
- Forme exacte des saillies, tracé réel de la voie d'eau, portes de rivière des autres districts : questions ouvertes de l'annexe.

## h. Dépendances, décisions, contrôle canon (14 §7 e, f)
- **Dépendances** : aucune ajoutée en R1c (`package.json` : seulement des scripts). `GLTFLoader`, `GTAOPass`, `OutputPass` et `Sky` viennent de `three/examples`, déjà présent depuis R1.
- **Données externes** : 86 fichiers CC0 tirés des dépôts officiels de MakeHuman (commits épinglés, `npm run assets:fetch`) et un dérivé, `humain.glb`. Ils sont dans le manifeste, et leur attribution dans `docs/ASSETS_LICENSES.md`.
- **DECISIONS.md** : D-87 (corps), D-88 (rendu), D-89 (districts), D-90 (mesure de la latence et carte d'environnement).
- **CANON_CHECK.md** : aucune entrée (aucune donnée de jeu touchée). Les faits de lore de R1c sont dans les profils de style et dans l'annexe des districts, avec leur statut.

## i. Questions à l'utilisateur
1. **Latence de la scène tactique** (décision nécessaire, arrêt 1). Options :
   - **a. Garder le réalisme, juger la latence sur un vrai GPU.** Les mesures logicielles restent des bornes basses. Il faut une mesure sur votre machine : ouvrir `/?proto3d` et lire le temps jusqu'à la première image.
   - **b. Qualité « basse » allégée**, sans éclairage d'image ni cartes de relief, avec des corps simplifiés. En rendu logiciel, cette configuration descend à ≈ 2,2 s avec les figures de R1 (mesure ponctuelle, § d). Moyenne et haute restent réalistes et lentes.
   - **c. Chargement progressif.** La ville paraît d'abord, les corps arrivent ensuite. La « première image » serait sous 3 s plus vite, mais incomplète ; il faut que vous acceptiez cette définition de « prêt ».
   - **d. En plus de a, b ou c** : compresser les assets (`.glb` de 5,9 à 2,1 Mio), utile surtout à faible débit.
2. **Textures d'environnement Poly Haven** (CC0, réalistes). La consigne ne lève la règle que pour les corps de base et les animations : je ne les ai pas utilisées. Faut-il les autoriser ? Le domaine est aussi refusé par la politique réseau de l'environnement ; il faudrait l'ouvrir.
3. **Districts** : les questions ouvertes de l'annexe (forme des saillies, voie d'eau, portes de rivière ailleurs).
4. **CR1b-06** : à remesurer (`smoke:r1b` complet) une fois le rendu arrêté.
