# Rapport R1d — latence en deux temps, teintes, corps sans détail anatomique, arbres et textures réalistes

> Plan : `docs/phases/R1d.md`. Commit de départ : **`3782acd`** (fin de R1c). Commits : R1d.0 `9ee67fd`, R1d.2 `1abb746`, R1d.1 `b882f9a`, R1d.3 `b5056e2`, R1d.4 `c1c14b4`, R1d.5 `fefc9d0`, R1d.6 (ce rapport).
> - **Mesure avant/après** (`npm run mesure:r1d`) : deux passages complets.
>   - essai 1 : `docs/reports/R1d-mesure-essai1-KO.log`, `R1d-mesures-essai1-KO.json` (CR1d-08 en échec sur E22) ;
>   - essai 2, après un correctif : `docs/reports/R1d-mesure.log`, `R1d-mesures.json` (tous les contrôles passent).
> - **Distinction des rendus** (`npm run smoke:r1b`) : `docs/reports/R1d-smoke-r1b.log`, `R1d-distances-rendus.log`, `R1d-smoke-r1b.json`. Les captures et journaux de R1b qu'il réécrit ont été remis à leur état de R1b (git) ; les deux planches utiles sont gardées sous `r1d-smoke-E07.png` et `r1d-smoke-E21.png`.
> - **Batterie finale**, strictement séquentielle (aucune mesure en même temps) : `R1d-git-sim.log`, `R1d-verify.log`, `R1d-tests.log`.
> - **Captures** : `docs/screenshots/r1d-<scène>-avant.png`, `-apres.png`, `-comparaison.png` (15 scènes), `r1d-anatomie-<vue>-*` (5 vues), `r1d-teinte-<vue>-r1b.png` et `-r1d.png` (5 vues).
>
> **Arrêt obligatoire : fin de R1d** (CLAUDE.md, arrêt 5). R2 n'est pas lancée.
> **Un critère en échec (une fois) : CR1d-12**, distinction des rendus, une paire sur 207 (E07–E21, ΔE couleur moyenne 2,1 pour 2,3). La cause est mesurée (§ d2) ; la corriger demande un choix de direction artistique pour E21, qui vous revient (§ i).

## a. Critères

| # | Critère | Statut | Preuve |
|---|---|---|---|
| CR1d-01 | `src/sim` inchangé | **OK** | sorties vides depuis `a2b2f88` et `3782acd` ; données de jeu inchangées ; three.js hors de `src/render/tactical3d` : aucun (§ b1) |
| CR1d-02 | `npm run verify` au code 0 | **OK** | 72 fichiers, 451 tests, code 0 (§ b2) |
| CR1d-03 | `assets:check` au code 0 ; code 1 pour Poly Haven hors textures d'environnement, l'inverse, autre que WebP 1024², plus de 12 | **OK** | 102 entrées, 102 fichiers ; 4 tests sur fixtures (§ b3) |
| CR1d-04 | Bundle principal inchangé, worker identique, textures hors du JS | **OK** | 902 588 octets avant et après, même contenu normalisé ; worker identique à l'octet ; aucun asset dans le JS ; 14 fichiers servis = fichiers « execution » du manifeste (§ c1) |
| CR1d-05 | Scène tactique, qualité basse : « prêt » < 3 s ; « corps » mesuré ; moyenne et haute mesurées | **OK** | « prêt » **1,99 s** (6,16 s avant) ; « corps » 8,62 s ; moyenne 6,59 s / 40,18 s ; haute 6,87 s / 41,46 s (§ c2) |
| CR1d-06 | Visionneuse, qualité basse : « prêt » < 8 s ; jeu < 8 s | **OK** | de 1,64 s (E22) à 3,60 s (E14, 9,47 s avant) ; jeu 2,60 s (§ c2) |
| CR1d-07 | Qualité basse allégée | **OK** | `r1d.test.ts`, 4 tests (§ b3) ; captures `r1d-proto-bas`, `r1d-E14-bas` (§ e) |
| CR1d-08 | Teintes contre R1b : \|Δb*\| ≤ 2,5, ΔC* ≥ −2, ΔL10 ≤ +8 | **OK (essai 2)** | essai 1 : E22 ΔL10 +9,0 (KO) ; correctif D-97 ; essai 2 : les 15 contrôles passent (§ c3) |
| CR1d-09 | Corps sans détail anatomique : aucune primitive ni cible génitale ; écart à la surface lissée < 1 mm ; captures revues | **OK** | `humain.test.ts`, 4 tests ; mamelons 0,00 mm, entrejambe < 0,5 mm (R1c : 3,3 à 26,3 mm et 8,6 à 14,6 mm) ; 5 vues revues (§ d1, § e) |
| CR1d-10 | Scène tactique : arbres réalistes, plus d'icosaèdres | **OK** | `r1d.test.ts`, 2 tests ; captures `r1d-proto-*` (§ e) |
| CR1d-11 | Textures Poly Haven : 12 fichiers, WebP 1K, manifeste, attribution, intégrées, teinte conservée, repli | **OK** | `assets:check`, `r1d.test.ts` (4 tests), `assets:fetch -- polyhaven -- --verifier` (12 fichiers identiques) ; instant « photos » mesuré sur toutes les scènes (§ c2) |
| CR1d-12 | Distinction des rendus (CR1b-06), seuils inchangés | **KO (premier échec)** | 206 paires sur 207 passent ; **E07–E21 : ΔE couleur moyenne 2,1 < 2,3** (grille 9,4 ≥ 5). Cause : la correction des teintes de R1d.2 (§ d2) |
| CR1d-13 | Captures revues (ligne 14), rapport, `PROGRESS.md` | **OK** | § e ; ce rapport |

## b. Sorties réelles

### b1. Simulation, données, imports (`docs/reports/R1d-git-sim.log`)
```
$ git diff --stat a2b2f88 -- src/sim
(fin de sortie ; code 0)

$ git diff --stat 3782acd -- src/sim
(fin de sortie ; code 0)

$ git diff --stat a2b2f88 -- data ':!data/art'
(fin de sortie ; code 0)

$ grep -rlE "from \"three" src | grep -v "^src/render/tactical3d/"
(fin de sortie)
```

### b2. `npm run verify` (`docs/reports/R1d-verify.log`, extrait)
```
 Test Files  72 passed (72)
      Tests  451 passed (451)
assets:check : 102 entrées, 102 fichiers ; licences, sources et empreintes conformes.
canon:check : « data » conforme (R1–R12, 592 entrées).
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée).
dist/assets/index-BXWZxVA8.js                                     902.58 kB │ gzip: 275.34 kB
CODE 0
```
Pendant la phase, le crochet de fin de tour a lancé un `verify` en même temps qu'une mesure. Deux tests lourds ont alors dépassé leur délai de 30 s (37 et 38 s), faute de processeur :
```
 FAIL  tests/render/tactical3d/environnements.test.ts > même graine = même environnement (R1b) > lot 1 (9 environnements) : … 
Error: Test timed out in 30000ms.
 FAIL  tests/render/tactical3d/murs.test.ts > règle de visibilité du mur (R1b.4) > aucun mur dans les scènes dont le profil l'exclut …
Error: Test timed out in 30000ms.
      Tests  2 failed | 449 passed (451)
```
- **Relancé seul** : 72 fichiers, 451 tests, code 0 (117 s).
- **Passage de mesure** : faussé par ce `verify` (jeu chargé en 4,00 s au lieu de 2,3 s). Il a été jeté et refait.

### b3. Tests de R1d (`docs/reports/R1d-tests.log`, `--reporter=verbose`)
```
 ✓ tests/lint/assets-check.test.ts > assets:check (R1c) > le dépôt passe : chaque fichier de docs/art/assets/ a son entrée, sa licence, sa source retenue et son empreinte
 ✓ tests/lint/assets-check.test.ts > assets:check, textures Poly Haven (R1d) > dimensions lues dans l'en-tête WebP ; un autre format n'est pas un WebP
 ✓ tests/lint/assets-check.test.ts > assets:check, textures Poly Haven (R1d) > 12 textures d'environnement WebP 1K de Poly Haven : passe
 ✓ tests/lint/assets-check.test.ts > assets:check, textures Poly Haven (R1d) > plus de 12 textures, autre taille, autre format : échec
 ✓ tests/lint/assets-check.test.ts > assets:check, textures Poly Haven (R1d) > Poly Haven pour autre chose qu'une texture d'environnement, texture d'environnement hors de Poly Haven : échec
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > le .glb se reconstruit à l'identique depuis les sources CC0 (npm run assets:build -- --verifier)
 ✓ tests/render/tactical3d/humain.test.ts > corps de base MakeHuman (R1c.1) > gabarit : 12 primitives (8 régions de peau, collant, dents, langue, yeux), 56 os, 51 cibles, poids normalisés
 ✓ tests/render/tactical3d/humain.test.ts > aucun détail anatomique (R1d, CR1d-09) > ni primitive, ni cible, ni sommet génital : le groupe « helper-genital » de MakeHuman n'est pas repris
 ✓ tests/render/tactical3d/humain.test.ts > aucun détail anatomique (R1d, CR1d-09) > zones lissées présentes : mamelons et entrejambe ; pointe du sein arrondie au façonnage (cible « breast-point-decr »)
 ✓ tests/render/tactical3d/humain.test.ts > aucun détail anatomique (R1d, CR1d-09) > écart à la surface lissée < 1 mm (mamelons et entrejambe) pour l'homme, le Titan 0,65, la femme et la corpulence lourde
 ✓ tests/render/tactical3d/humain.test.ts > aucun détail anatomique (R1d, CR1d-09) > la mesure voit les détails du corps de R1c (3782acd) : mamelons et entrejambe à plusieurs millimètres de la surface lissée
 ✓ tests/render/tactical3d/r1d.test.ts > qualité basse allégée (R1d, CR1d-07) > forêt des Arbres Géants et campagne : aucune carte de feuilles ni détail du sol en qualité basse ; présents en moyenne
 ✓ tests/render/tactical3d/r1d.test.ts > qualité basse allégée (R1d, CR1d-07) > forêt : moins d'arbres gardés en qualité basse qu'en moyenne (densité de la qualité)
 ✓ tests/render/tactical3d/r1d.test.ts > qualité basse allégée (R1d, CR1d-07) > à chaud : relief et cartes de feuilles retirés en qualité basse, rendus en la quittant
 ✓ tests/render/tactical3d/r1d.test.ts > qualité basse allégée (R1d, CR1d-07) > éclairage : en qualité basse, dôme peint au lieu du ciel physique, sans éclairage d'image ; retour au ciel physique ensuite
 ✓ tests/render/tactical3d/r1d.test.ts > arbres réalistes dans la scène tactique (R1d, CR1d-10) > un arbre de la ville prend les 22 tirages de R1 (le reste de la ville garde ses graines) ; place : feuillu ; abords : feuillus e…
 ✓ tests/render/tactical3d/r1d.test.ts > arbres réalistes dans la scène tactique (R1d, CR1d-10) > plus d'icosaèdres de R1 dans la ville : les arbres sont rendus par la végétation réaliste (bois séparé, massifs, cartes de…
 ✓ tests/render/tactical3d/r1d.test.ts > textures de Poly Haven (R1d, CR1d-11) > 12 fichiers : 6 matières (pavés, sol, pierre de taille, pierre brute, tuiles, ardoise) × (couleur, relief), au manifeste et servis au rendu
 ✓ tests/render/tactical3d/r1d.test.ts > textures de Poly Haven (R1d, CR1d-11) > environnement (Shiganshina) : toits, pavés, parement des murs et détail du sol passent aux photos ; teinte du profil conservée
 ✓ tests/render/tactical3d/r1d.test.ts > textures de Poly Haven (R1d, CR1d-11) > qualité basse : relief gardé à part (pas de carte de normales) ; repli : sans photos, rien ne change
 ✓ tests/render/tactical3d/r1d.test.ts > textures de Poly Haven (R1d, CR1d-11) > scène tactique : chaussée, toits de tuiles et d'ardoise, enceinte et champ étiquetés ; photos chargées après les corps détaillés
 Test Files  3 passed (3)
      Tests  30 passed (30)
CODE 0
```
(Extrait : 21 lignes sur 30 ; le journal complet liste aussi les 9 autres tests de `humain.test.ts` et `assets-check.test.ts`.)

Reconversion des textures (`npm run assets:fetch -- polyhaven -- --verifier`, avant le commit R1d.5) :
```
assets:fetch polyhaven --verifier : 12 fichiers reconvertis, identiques.
```

## c. Comparaison avant/après (`npm run mesure:r1d`, essai 2)
Conditions :
- constructions de production servies par `vite preview` ;
- un Chromium neuf par mesure, WebGL logiciel (SwiftShader), 1366 × 768 ;
- jour, image figée à t = 1 s.

Ces chiffres mesurent le processeur. La mesure sur un vrai GPU reste **à vérifier** par vous.

### c1. Bundle et poids (CR1d-04)
```
bundle principal avant : assets/index-Bv_Xd8Ly.js  902588 octets (266.8 Kio gzip)
bundle principal après : assets/index-BXWZxVA8.js  902588 octets (266.8 Kio gzip)
worker avant : sim.worker-BDqA4b1U.js  sha256 f30d630d5356e51fb52913c9828c84a1c6951626b088c4b922bbd792537854be
worker après : sim.worker-BDqA4b1U.js  sha256 f30d630d5356e51fb52913c9828c84a1c6951626b088c4b922bbd792537854be
  OK  bundle principal : même taille (902588 → 902588 octets)
  OK  bundle principal : même contenu une fois les noms de morceaux hachés normalisés
  OK  worker de simulation identique à l'octet
  OK  ni three.js ni GLTFLoader dans le bundle principal
morceaux 3D à la demande, avant : 9 morceaux, 978890 octets (269.1 Kio gzip)
morceaux 3D à la demande, après : 9 morceaux, 981079 octets (270.0 Kio gzip)
  OK  aucun modèle ni texture d'asset inclus dans le JS (aucun)
  OK  assets 3D servis = fichiers « execution » du manifeste (14)
  OK  aucune image de référence dans dist (0)
```
Les 12 textures WebP pèsent 4,27 Mio. Elles ne sont pas compressées davantage (décision de l'utilisateur).

### c2. Latence en deux temps (cibles en qualité basse : tactique < 3 s, environnements < 8 s ; jeu < 8 s)
```
jeu             avant chargement à froid (carte stratégique prête) : 2.59 s
jeu             apres chargement à froid (carte stratégique prête) : 2.60 s
  OK  jeu : chargement à froid 2.60 s < 8 s
proto-bas       apres prêt   1.99 s · corps 8.62 s (pret) · photos 10.78 s ·   356 ms/image · 695 appels · 0.76 M triangles · 21 programmes · RSS 1060 Mo
  OK  proto-bas après : « prêt » 1.99 s < 3 s (avant : 6.16 s)
résumé (avant R1c → après R1d) :
  proto-bas       prêt 6.16 s → 1.99 s · corps 6.16 s → 8.62 s · temps d'image 652 → 356 ms · RSS 916 → 1060 Mo
  E01-bas         prêt 4.18 s → 2.72 s · temps d'image 443 → 182 ms · RSS 819 → 862 Mo
  E02-bas         prêt 4.31 s → 2.58 s · temps d'image 608 → 246 ms · RSS 871 → 882 Mo
  E13-bas         prêt 5.09 s → 3.36 s · temps d'image 731 → 457 ms · RSS 768 → 784 Mo
  E14-bas         prêt 9.47 s → 3.60 s · temps d'image 2125 → 488 ms · RSS 868 → 885 Mo
  E19-titans-bas  prêt 5.41 s → 2.29 s · corps 5.41 s → 12.01 s · temps d'image 394 → 254 ms · RSS 855 → 1006 Mo
  E22-bas         prêt 2.81 s → 1.64 s · temps d'image 252 → 124 ms · RSS 755 → 794 Mo
  proto           prêt 10.06 s → 6.59 s · corps 10.06 s → 40.18 s · temps d'image 1670 → 1728 ms · RSS 999 → 1024 Mo
  proto-suivi     prêt 10.09 s → 7.33 s · corps 10.09 s → 42.39 s · temps d'image 1587 → 1739 ms · RSS 1028 → 1025 Mo
  proto-haut      prêt 10.34 s → 6.87 s · corps 10.34 s → 41.46 s · temps d'image 1760 → 1886 ms · RSS 1049 → 1089 Mo
  E01             prêt 6.90 s → 6.99 s · temps d'image 1201 → 1196 ms · RSS 936 → 1006 Mo
  E02             prêt 7.44 s → 7.28 s · temps d'image 1495 → 1503 ms · RSS 971 → 997 Mo
  E07             prêt 6.81 s → 6.77 s · temps d'image 1473 → 1567 ms · RSS 933 → 977 Mo
  E13             prêt 8.78 s → 8.86 s · temps d'image 1778 → 1817 ms · RSS 878 → 931 Mo
  E14             prêt 28.25 s → 28.52 s · temps d'image 6160 → 6185 ms · RSS 919 → 981 Mo
  E17             prêt 4.98 s → 4.89 s · temps d'image 999 → 1005 ms · RSS 840 → 899 Mo
  E19-titans      prêt 8.32 s → 6.18 s · corps 8.32 s → 55.36 s · temps d'image 1199 → 1244 ms · RSS 996 → 1013 Mo
  E20             prêt 7.37 s → 7.35 s · temps d'image 1623 → 1711 ms · RSS 868 → 918 Mo
  E22             prêt 5.07 s → 5.13 s · temps d'image 916 → 972 ms · RSS 863 → 949 Mo
  banc            prêt 7.05 s → 9.03 s · corps 7.05 s → 9.03 s · temps d'image 1169 → 1180 ms · RSS 897 → 1041 Mo
```
Instants « photos » (textures de Poly Haven posées), après R1d :
- qualité basse : de 2,37 s (E22) à 13,44 s (E19 avec Titans) ;
- qualité moyenne : de 8,95 s (E22) à 66,40 s (E14) ;
- scène tactique : 48,72 s.

Lecture :
- **« Prêt » en qualité basse : toutes les cibles passent.** En R1c, la qualité basse de la scène tactique donnait sa première image en 6,16 s.
- **Qualités moyenne et haute** : « prêt » 6,6 à 7,3 s pour la scène tactique, environnements inchangés. « Corps » à 40-42 s : en rendu logiciel, chaque image coûte 1,7 s, et le façonnage par morceaux laisse passer des images entre deux morceaux. Sans cible logicielle (décision de l'utilisateur) : à vérifier sur GPU.
- **Banc d'échelle** : 7,05 → 9,03 s. C'est une page de contrôle, sans cible ; elle façonne d'emblée tous ses corps.

### c3. Teintes (CR1d-08)
Essai 1 (`R1d-mesure-essai1-KO.log`), avant le correctif D-97 :
```
  E22          R1b : L* 48.6  a* -6.6  b* 15.2  C* 16.9  L10 24.3
               R1d : L* 54.1  a* -6.6  b* 13.4  C* 15.5  L10 33.3
  KO  E22 : ΔL10 (ombres) = 9.0 ≤ +8
mesure:r1d : 1 contrôle(s) en échec.
```
Essai 2 (`R1d-mesure.log`) :
```
  proto        R1b : L* 55.4  a* 0.8  b* 12.2  C* 12.6  L10 28.4
               R1d : L* 58.1  a* 0.8  b* 10.8  C* 11.5  L10 33.3
  OK  proto : |Δb*| = 1.4 ≤ 2,5
  OK  proto : ΔC* = -1.1 ≥ −2
  OK  proto : ΔL10 (ombres) = 4.9 ≤ +8
  proto-suivi  R1b : L* 57.9  a* 0.6  b* 12.4  C* 12.6  L10 35.0
               R1d : L* 56.0  a* -1.5  b* 12.9  C* 14.1  L10 32.5
  OK  proto-suivi : |Δb*| = 0.5 ≤ 2,5
  OK  proto-suivi : ΔC* = 1.5 ≥ −2
  OK  proto-suivi : ΔL10 (ombres) = -2.6 ≤ +8
  E01          R1b : L* 34.7  a* 2.4  b* 12.9  C* 15.4  L10 13.1
               R1d : L* 42.1  a* 1.1  b* 11.6  C* 13.7  L10 17.8
  OK  E01 : |Δb*| = 1.4 ≤ 2,5
  OK  E01 : ΔC* = -1.6 ≥ −2
  OK  E01 : ΔL10 (ombres) = 4.7 ≤ +8
  E02          R1b : L* 41.0  a* 4.4  b* 10.2  C* 12.7  L10 13.1
               R1d : L* 45.9  a* 4.7  b* 8.8  C* 11.7  L10 17.8
  OK  E02 : |Δb*| = 1.4 ≤ 2,5
  OK  E02 : ΔC* = -1.0 ≥ −2
  OK  E02 : ΔL10 (ombres) = 4.7 ≤ +8
  E22          R1b : L* 48.6  a* -6.6  b* 15.2  C* 16.9  L10 24.3
               R1d : L* 53.1  a* -6.5  b* 13.4  C* 15.4  L10 31.5
  OK  E22 : |Δb*| = 1.8 ≤ 2,5
  OK  E22 : ΔC* = -1.5 ≥ −2
  OK  E22 : ΔL10 (ombres) = 7.2 ≤ +8
mesure:r1d : tous les contrôles passent.
exit 0
```
- **Rappel (R1c, contre R1b)** : b* de −5 à −8, L10 de +9 à +24.
- **R1d, contre R1b** : b* de −1,8 à +0,5, L10 de −2,6 à +7,2. Le bleuissement est corrigé ; les ombres restent un peu plus claires qu'en R1b (occlusion ambiante et normales corrigées de R1c).
- **Correctif de l'essai 1** (D-97), après une mise au point mesurée sur les cinq vues : `HEMI_WITH_ENV` de 0,95 à 0,85.

## d. Points mesurés à part

### d1. Corps sans détail anatomique (CR1d-09, D-94)
Écart à la surface lissée, corps au repos (mm). Les valeurs de R1c sont mesurées sur le `.glb` de `3782acd` (test : au-dessus de 5 mm).

| Corps | Mamelons R1c → R1d | Entrejambe R1c → R1d |
|---|---|---|
| homme | 3,26 → 0,00 | 9,35 → < 0,5 |
| Titan de sexe 0,65 | 11,27 → 0,00 | 8,63 → < 0,5 |
| femme | 26,29 → 0,00 | 14,59 → < 0,5 |
| lourde | 23,98 → 0,00 | 13,21 → < 0,5 |

- **Organes génitaux** : jamais repris (aide « helper-genital » exclue du `.glb`). L'entrejambe est carénée à la construction.
- **Mamelons et aréoles** : rabattus au façonnage sur la quadrique de leur pourtour, avec un raccord harmonique.
- **Essais écartés**, vus de près : plaque mince (pointe ou creux), quadrique seule (plateaux ovales cernés d'un pli), normales adoucies au-delà de la zone (sein aplati).
- La valeur « mamelons 0,00 mm » est vraie **par construction** : la surface lissée est celle sur laquelle on rabat. Le contrôle prouve que le rabattement tient sur tous les corps, et le test sur le corps de R1c prouve que la mesure voit un mamelon. Le rendu se juge sur les captures (§ e).

### d2. Distinction des rendus : E07–E21 (CR1d-12, premier échec)
```
  KO  lot 2 E07–E21 : ΔE couleur moyenne 2.1 ≥ 2,3
smoke:r1b : 1 contrôle(s) en échec.
  E07–E21 | 2.1 | 9.4 | 4.8          (ΔE moyen jour | ΔE grille jour | ΔE moyen crépuscule)
  minimum lot 1 : ΔE moyen 4.2, ΔE grille 11.0 (36 paires)
  minimum lot 2 : ΔE moyen 2.1, ΔE grille 6.7 (171 paires)
```
Mesure ciblée, même méthode que `smoke:r1b` (vue principale, jour, 256 × 144) :

| Version | E07 (L*, a*, b*) | E21 (L*, a*, b*) | ΔE |
|---|---|---|---|
| R1b (`a2b2f88`, autres cadrages) | 54,8 · 1,7 · 5,7 | 47,3 · 2,5 · 6,9 | 7,6 |
| R1c (`3782acd`) | 60,2 · 0,3 · 0,4 | 55,8 · 1,3 · 2,8 | 5,1 |
| R1d, textures procédurales | 53,3 · 1,4 · 3,3 | 52,3 · 1,8 · 4,9 | 1,9 |
| R1d, photos posées | 54,0 · 1,5 · 3,3 | 52,6 · 1,9 · 4,9 | 2,15 |

- **Cause** : la correction des teintes (R1d.2), que vous avez demandée.
  - En R1c, Orvud se distinguait surtout par son blanc bleuté (b* 0,4), le défaut corrigé ; il passe à b* 3,3.
  - E21 bouge moins. Les deux villes partagent le même ciel physique de jour depuis R1c (en R1b, E21 avait un ciel gris de fumée).
  - Les photos n'y sont pour rien : sans elles, l'écart est plus petit.
- **La grille (structure) les distingue nettement** : 9,4 pour un seuil de 5.
- **Pas de correctif tenté** : rapprocher ou écarter ces deux villes est un choix de direction artistique pour E21 (§ i, question 1).
- **Remarque d'outil** : `smoke:r1b` mesure juste après « prêt », sans attendre les photos. Le résultat dépend donc de leur arrivée. Proposition : attendre `data-photo3d` comme le fait `mesure:r1d` (non appliqué, pour ne pas changer l'outil après coup).

## e. Captures (CLAUDE.md ligne 14 : trois lignes, au moins trois défauts possibles)
Chaque capture a été ouverte avec l'outil de lecture d'image : les planches de comparaison, et en pleine taille `r1d-proto-apres`, `r1d-proto-suivi-apres`, les 5 `r1d-teinte-*-r1d` et les 2 planches `r1d-smoke-*`.

**r1d-proto (avant / après), qualité moyenne**
- Description :
  - vue plongeante sur la ville de R1 ; façades crème et ocres d'avant revenues (blanc bleuté en R1c) ; toits rouges et ardoises ;
  - arbres de la place réalistes : tronc, houppier en massifs et cartes de feuilles, vert soutenu. Avant : boules pâles d'icosaèdres ;
  - grand Titan (corps détaillé, peau chaude) au centre avec deux soldats à ses câbles ; petit Titan dans le marché ; escouade en bas à droite.
- Défauts possibles :
  1. arbres très sombres et saturés, presque noirs à l'ombre, à côté des façades claires ;
  2. bords des cartes de feuilles dentelés en silhouette (test alpha) ;
  3. la chaussée en photo ne se distingue presque pas du procédural à cette distance ;
  4. soldats de quelques pixels, coupés par le bord bas ;
  5. mur d'enceinte au fond plat et uniforme.

**r1d-proto-suivi**
- Description :
  - caméra derrière le grand Titan vu de dos, sur la rue pavée ; pavés en photo, irréguliers et nuancés (avant : grille régulière de galets ronds) ;
  - deux soldats accrochés, traînées de gaz ; petit Titan à gauche ;
  - à droite, un arbre réaliste devant les façades ; au premier plan, un massif de feuilles.
- Défauts possibles :
  1. un massif de feuilles au premier plan, en bas à droite, cache un coin de l'image (arbre tout près de la caméra) ;
  2. marque rouge de nuque du Titan coupée par le bord haut ;
  3. traînées de gaz en boudins blancs uniformes ;
  4. pas visible : les dalles de la place restent procédurales, à côté des pavés en photo ;
  5. Titan nu et lisse, lecture « mannequin ».

**r1d-proto-bas** (comparaison)
- Description :
  - même vue en qualité basse allégée ; arbres en massifs pleins, sans cartes de feuilles ;
  - ciel peint, sans éclairage d'image ; façades crème ;
  - ombres portées absentes (qualité basse) ; l'ensemble reste lisible.
- Défauts possibles :
  1. massifs d'arbres très lisses, presque des boules ;
  2. sans ombres portées, les Titans semblent posés sur le sol ;
  3. contraste plus faible qu'en qualité moyenne ;
  4. bord haut du mur d'enceinte dans la brume, sans détail.

**r1d-proto-haut** (comparaison)
- Description :
  - qualité haute, mêmes changements qu'en moyenne ;
  - teintes chaudes, arbres réalistes ;
  - ombres portées nettes sur la place.
- Défauts possibles :
  1. presque identique à la moyenne à cette distance ;
  2. arbres sombres ;
  3. soldats coupés au bas de l'image ;
  4. aucun gain visible des textures en photo à cette distance.

**r1d-E01 (Shiganshina)**
- Description :
  - vue de la saillie : mur courbe, porte, ville en réseau de rues, place et église ;
  - après : teintes plus chaudes, mur gris en pierre de taille en photo (blocs à la taille du profil) ;
  - prairies vertes entre les rues ; toits rouges plus sombres.
- Défauts possibles :
  1. répétition visible du motif du parement sur la longueur du mur ;
  2. bandes vertes des îlots de taille uniforme, peu naturelles ;
  3. toits rouges presque tous identiques ;
  4. ciel très pâle au-dessus du mur.

**r1d-E02 (Trost)**
- Description :
  - vue depuis le chemin de ronde : rails et canon au premier plan, ville dense ;
  - après : parement du mur en pierre, ombres plus marquées dans les rues, toits rouges et ardoises ;
  - mur du fond plus chaud, moins blanc.
- Défauts possibles :
  1. chemin de ronde au premier plan très clair, presque sans texture ;
  2. rues en contrebas sombres, peu lisibles ;
  3. bord gauche du mur coupé net à la jonction des pans ;
  4. pas visible : le rocher de Trost (vue de 850 seulement).

**r1d-E07 (Orvud)**
- Description :
  - église à clocher pointu au centre, place pavée, maisons à toits rouges et ardoises ;
  - après : église et façades grises plus sombres, mur du fond en pierre de taille brun-gris ;
  - ombres portées plus franches.
- Défauts possibles :
  1. mur en photo très uniforme, motif répété ;
  2. bord droit : un pan de mur clair coupé net (fin du tracé) ;
  3. église plus sombre qu'avant, contraste faible avec la place ;
  4. ardoises bleues et ardoise en photo presque indiscernables à distance.

**r1d-E13 (campagne pure)**
- Description :
  - champs jaunes et verts, haies, bois, ferme rouge au loin, étang ;
  - presque identique avant et après, un peu plus chaud ;
  - grain du sol (photo) invisible à cette distance.
- Défauts possibles :
  1. aucun changement lisible des photos ;
  2. arbres du bois en rangs trop réguliers ;
  3. horizon flou, plat ;
  4. haies en traits fins uniformes.

**r1d-E14 et r1d-E14-bas (forêt des Arbres Géants)**
- Description :
  - troncs géants, branches horizontales, voûte, rayons de lumière dans la brume ;
  - après, en moyenne : voûte plus sombre, troncs plus contrastés, ambiance plus fermée ;
  - en basse : massifs pleins, sans cartes de feuilles, densité réduite.
- Défauts possibles :
  1. voûte très sombre, presque noire en haut de l'image (moyenne) ;
  2. bandes dans la brume ;
  3. bande sombre au bas de l'image (sol coupé) ;
  4. en basse : massifs en polyèdres lisses, peu crédibles de près.

**r1d-E17 (eaux, marais)**
- Description :
  - rivière et mares, prairie, bosquet ;
  - après : grain fin du sol (photo) visible au premier plan ; eau un peu plus sombre ;
  - ciel pâle.
- Défauts possibles :
  1. grain du sol répété, en grille, au premier plan ;
  2. eau moins bleue, plus terne ;
  3. tache sombre d'un buisson isolée au centre ;
  4. horizon vide.

**r1d-E19-titans (territoire des Titans)**
- Description :
  - plaine, village en ruine, Titans détaillés à divers endroits ;
  - après : sol avec grain en photo, teintes plus chaudes ; Titans au corps de base ;
  - ciel bleu, nuages.
- Défauts possibles :
  1. grain du sol répété en motif régulier au premier plan ;
  2. Titans petits et clairsemés, peu lisibles ;
  3. plaine très uniforme, sans relief marqué ;
  4. village gris, peu distinct de loin.

**r1d-E20 (château d'Utgard)**
- Description :
  - château à tours coniques et donjon, murs gris, forêt à droite ;
  - après : pierre plus sombre et brune, herbe plus foncée au grain fin ;
  - toits coniques en ardoise inchangés (procéduraux, hors des toitures de bâtiments).
- Défauts possibles :
  1. murs du château plus sombres, contraste réduit avec les tours ;
  2. grain de l'herbe répété ;
  3. touffes jaunes au premier plan peu crédibles ;
  4. pas en photo : la pierre des tours, en façades procédurales.

**r1d-E22 (murs)**
- Description :
  - mur Rose de profil, porte et poste de garde, ombre portée sur la prairie ;
  - après : parement en photo (blocs gris, pierre nuancée), ombre portée plus sombre ;
  - chemin de terre en diagonale.
- Défauts possibles :
  1. motif du parement répété, en mosaïque régulière sur 50 m de haut ;
  2. haut du mur plat, sans couronnement lisible ;
  3. prairie uniforme ;
  4. poste de garde minuscule à côté de la porte.

**r1d-banc (banc d'échelle)**
- Description :
  - toise rayée, classes de Titans de 3 à 15 m, variantes, soldat ;
  - en haut : Colossal, Titan-Mur, Titan de Rod Reiss allongé ;
  - avant et après presque identiques.
- Défauts possibles :
  1. étiquettes qui se chevauchent (« sentinelle », « chasseur ») ;
  2. soldat d'1,7 m presque invisible ;
  3. sol uniforme sans texture ;
  4. Titan de Rod Reiss coupé dans la vue haute.

**r1d-anatomie-face, -dos, -torses-hommes, -torses-femmes, -bassins** (avant R1c / après R1d)
- Description :
  - quatre corps nus en rang (homme, Titan de sexe 0,65, femme, corpulence lourde), de face et de dos, puis de près ;
  - avant : mamelons nets sur le Titan, la femme et la lourde ; après : aucun mamelon ni aréole, la poitrine garde sa forme ;
  - aucun organe génital, ni avant ni après ; entrejambe lisse ; peau plus chaude après (teintes D-92 et D-97).
- Défauts possibles :
  1. lourde : léger pli arrondi sous le sein (forme du corps), visible de près ;
  2. Titan 0,65 : légère tache plus claire, lisse, à l'emplacement du mamelon ;
  3. sillon interfessier visible de dos (forme du corps de MakeHuman, gardée) ;
  4. lignes des pectoraux de l'homme un peu dures ;
  5. bras qui se croisent devant les torses voisins, et cadrage qui coupe les corps.

**r1d-teinte-proto, -proto-suivi, -E01, -E02, -E22 (R1d)**
- Description :
  - mêmes vues que la mesure de R1b, jour, qualité moyenne, avec corps détaillés et photos ;
  - façades crème, toits rouges, ombres franches ;
  - ciel bleu physique ; pavés et parements en photo.
- Défauts possibles :
  1. ombres encore un peu plus claires qu'en R1b (ΔL10 jusqu'à +7,2) ;
  2. parement des murs répété ;
  3. arbre au premier plan de la vue de suivi ;
  4. chemin de ronde de Trost très clair.

**r1d-smoke-E07 et r1d-smoke-E21** (planches de `smoke:r1b`, jour et crépuscule, deux vues)
- Description :
  - E07 : Orvud, église, toits rouges, mur en saillie ; E21 : ville-usine en brique, cheminées, toits sombres ;
  - les deux sous le même ciel bleu de jour ;
  - crépuscule chaud, fenêtres éclairées.
- Défauts possibles :
  1. ciel identique dans les deux vues principales : la couleur moyenne se rapproche (§ d2) ;
  2. E21 sans fumée ni brume industrielle, contrairement à R1b ;
  3. vue seconde de E21 : rue de brique répétitive ;
  4. E07 : place claire et surexposée au centre de la vue principale.

## f. Ce qui ne marche pas
1. **CR1d-12** : E07–E21, ΔE couleur moyenne 2,1 pour 2,3 (§ d2). Premier échec ; pas de correctif tenté (choix artistique, § i).
2. **« Corps » en qualité moyenne ou haute** : 40 s environ en rendu logiciel (9 s en basse). À vérifier sur GPU.
3. **Textures en photo** :
   - peu visibles aux distances des vues principales ;
   - motif répété sur les grands murs et sur le grain du sol ;
   - façades, colombages, briques et bois restent procéduraux (hors périmètre).
4. **Arbres de la scène tactique** : vert très sombre ; un arbre près de la caméra de suivi masque un coin.
5. **Ombres** : encore plus claires qu'en R1b, dans les bornes.
6. **Forêt des Arbres Géants** : voûte très sombre, bandes de brume, bande sombre en bas ; « prêt » 28,5 s en qualité moyenne (sans cible).
7. **Outil `smoke:r1b`** : n'attend pas les photos (§ d2).
8. **Non mesuré** : toute mesure sur un vrai GPU.

## g. Affirmations, interprétations, éléments non confirmés (14 §7 d)

### g1. Affirmations sourcées dans les fichiers du projet
- **Décisions de l'utilisateur** (revue de R1c), reprises dans `CLAUDE.md` et `docs/phases/R1d.md` § 1 :
  - latence en deux temps et qualité basse allégée ;
  - Poly Haven pour les textures d'environnement seulement (12 au plus, 1K, WebP) ;
  - pas de compression d'assets ;
  - districts en `?` et `A`, pas de portes de rivière ailleurs qu'à Shiganshina.
- **Latence** : chargement < 8 s, scène tactique < 3 s (04 §9).
- **Licences** : MakeHuman (CC0, dépôts officiels, commits épinglés) ; Poly Haven (CC0, auteur lu à l'API : Rob Tuytel). Manifeste et `docs/ASSETS_LICENSES.md`.

### g2. Interprétations ou adaptations (A)
- **« Aucun détail anatomique »** : sans organes génitaux, mamelons ni aréoles ; la forme du corps (seins, fesses, sillon) est gardée (D-94).
- **Mesures de la surface lissée** : quadrique du pourtour et raccord harmonique pour les mamelons ; opérateur de construction pour l'entrejambe (D-94).
- **Arbres de la ville** : un tiers de fruitiers aux abords, sommet à la hauteur de R1 (D-95).
- **Choix des six textures de Poly Haven et leur échelle** ; parement des murs à la taille des blocs du profil (D-96).
- **Teinte du profil conservée** par la moyenne linéaire (D-96).
- **Ombres de jour** : `HEMI_WITH_ENV` 0,85 (D-97).

### g3. Éléments non confirmés ou paramétrables (`?`)
- `block` des murs (`data/art/murs.json`) : il règle aussi l'échelle du parement en photo.
- Formes des saillies, tracé de la voie d'eau de Shiganshina : inchangés, toujours `?` / `A`.
- Atmosphère industrielle d'E21 (fumée, brume) : non représentée ; à décider (§ i).

## h. Dépendances, décisions, contrôle canon (14 §7 e, f)
- **Dépendances** : aucune ajoutée (`package.json` : scripts seulement). La conversion WebP utilise le Chromium déjà présent (playwright-core).
- **Données externes** :
  - 3 cibles MakeHuman ajoutées (`breast-point-decr`, `nipple-size-decr`, `nipple-point-decr`), et le `.glb` dérivé refait ;
  - 12 textures de Poly Haven ;
  - manifeste : 102 entrées.
- **DECISIONS.md** :
  - D-91 (revue de R1c) ;
  - D-92 (teintes) ;
  - D-93 (latence en deux temps) ;
  - D-94 (corps sans détail anatomique) ;
  - D-95 (arbres de la scène tactique) ;
  - D-96 (textures de Poly Haven) ;
  - D-97 (ombres de jour et mesure fiabilisée).
- **CANON_CHECK.md** : aucune entrée (aucune donnée de jeu touchée).

## i. Questions à l'utilisateur
1. **CR1d-12, E07–E21** (ΔE couleur moyenne 2,1 pour 2,3). Options :
   - **a.** donner à E21 une atmosphère industrielle : fumée des cheminées, ciel plus gris, comme en R1b (`A`, paramétrable) ;
   - **b.** assombrir ou rougir la palette d'E21 (`data/art/styles.json`) ;
   - **c.** recadrer la vue principale d'E21 (cheminées, entrée des cavernes) ;
   - **d.** juger que deux villes sous le même ciel de jour peuvent être proches en couleur moyenne, la grille (9,4) les distinguant ; dans ce cas, le seuil de couleur moyenne ne s'appliquerait plus aux paires d'une même catégorie.
2. **Mesure sur GPU réel** : « prêt » et « corps » en qualité moyenne et haute. Ouvrir `/?proto3d` et lire `window.__proto3d.timings` (ou le panneau).
3. **Textures de Poly Haven** : l'effet est net de près (pavés de la vue de suivi), faible de loin. Faut-il les étendre ? Les 12 fichiers sont atteints : les étendre voudrait dire en remplacer.
4. **Corps** : le rendu sans mamelons, et avec la forme du corps gardée, vous convient-il ?
