# R1d — Latence en deux temps, teintes, corps sans détail anatomique, arbres et textures réalistes

> **Commit de départ : `3782acd`** (fin de R1c, arrêt : latence de la scène tactique en échec deux fois).
> `git diff 3782acd -- src/sim` doit rester vide, comme `git diff a2b2f88 -- src/sim`.
> **Une seule phase, puis arrêt** pour revue. R2 n'est pas lancée.

**Source.** Revue de R1c par l'utilisateur (2026-10-07), résumée :
1. **Latence** : options c + b de R1c.
   - « Prêt » = ville visible avec les soldats en repères simplifiés ; corps détaillés chargés ensuite ; les deux instants mesurés.
   - Qualité basse allégée, feuillage allégé en qualité basse (forêts).
   - La mesure sur GPU réel reste « à vérifier ». Pas de compression d'assets (jeu en local, jamais en ligne).
2. **Poly Haven** autorisé pour les **textures d'environnement** seulement (sol, pierre, toits) : 12 textures au plus, en 1K, WebP. Mettre à jour `CLAUDE.md` et `assets:check`. Accès réseau en Custom (polyhaven.com, api.polyhaven.com, dl.polyhaven.org).
3. **Districts** : tout reste `?` ou `A` paramétrable ; pas de portes de rivière ailleurs qu'à Shiganshina.
4. **Phase R1d** :
   - corriger les teintes blanchies et bleutées (D-88) ;
   - vérifier que le corps de base n'a aucun détail anatomique ;
   - réutiliser les arbres réalistes dans la scène tactique ;
   - remesurer, avec les sorties réelles collées et les captures avant/après revues (ligne 14).

## 1. Règles propres à la phase

### Latence (04 §9, D-90 précisé)

**Deux instants**, mesurés de la navigation :

| Instant | Définition |
|---|---|
| **prêt** | Première image de la ville, les soldats et les Titans en **repères simplifiés** : les figures en primitives de R1, sans corps de base. `data-proto3d="pret"` |
| **corps** | Première image avec les corps détaillés (corps de base MakeHuman), chargés et façonnés après « prêt » sans bloquer l'image. `data-corps3d="pret"` |

**Cibles, en rendu logiciel (WebGL sans GPU)** :
- scène tactique, « prêt » en **qualité basse** : < 3 s ;
- visionneuse d'environnement, « prêt » en qualité basse : < 8 s ;
- jeu (carte stratégique), à froid : < 8 s.

**Mesuré, sans cible logicielle** :
- l'instant « corps » ;
- les qualités moyenne et haute.

Leur mesure sur GPU réel reste **à vérifier** par l'utilisateur.

**Qualité basse allégée** :
- pas d'éclairage d'image (carte d'environnement) ;
- pas de cartes de relief (normales) ;
- pas de post-traitement, pas d'ombres portées ;
- ciel peint au lieu du ciel physique ;
- feuillage allégé : pas de cartes de feuilles, densité réduite dans les forêts.

Qualités moyenne et haute : inchangées, hors teintes (§ R1d.2).

### Textures Poly Haven (décision de l'utilisateur)
- **Portée** : textures d'environnement seulement (sol, pierre, toits). Aucun modèle, HDRI ou autre ressource Poly Haven ; les corps restent MakeHuman.
- **Format** : au plus **12 fichiers**, chacun en **1024 × 1024**, **WebP**.
  - Convertis depuis le JPG 1K officiel de Poly Haven, par l'encodeur WebP de Chromium (qualité 0,9).
  - Conversion déterministe : `npm run assets:fetch -- polyhaven -- --verifier` refait le fichier et le compare.
- **Manifeste** : `usage: "texture_environnement"`, URL `dl.polyhaven.org` du JPG source et son empreinte md5 (`md5_source`), licence CC0, auteur Poly Haven.
- **`npm run assets:check` échoue en plus** :
  - si une entrée Poly Haven n'a pas l'usage `texture_environnement`, ou l'inverse ;
  - si le fichier n'est pas un WebP de 1024 × 1024 ;
  - s'il y a plus de 12 textures d'environnement.
- **Pas de compression d'assets.**

### Inchangé
- `src/sim` intact.
- Bundle principal identique une fois les noms hachés normalisés ; worker identique à l'octet.
- Pas d'image de `docs/art/reference/` dans `dist`.
- Mêmes graines, mêmes scènes ; échelle à ±5 %.
- three.js et GLTFLoader à la demande seulement.

## 2. Tâches

Un commit par tâche, `npm run verify` avant chacun.

| # | Tâche | Contenu |
|---|---|---|
| R1d.0 | Règles | Ce plan ; `CLAUDE.md` (Poly Haven, latence en deux instants, arrêt R1d) ; `assets:check` : règles Poly Haven et tests sur fixtures |
| R1d.1 | Latence en deux temps, qualité basse allégée | Scène tactique : ville et repères simplifiés, puis corps détaillés façonnés par morceaux et échangés ; sonde des deux instants. Visionneuse : Titans en repères, puis corps détaillés. Qualité basse : sans éclairage d'image ni relief, ciel peint, feuillage allégé |
| R1d.2 | Teintes (D-88) | Éclairage d'image réglé : ciel désaturé et sol dans la carte d'environnement, intensité réduite, hémisphère rendue. Mesure CIELAB contre R1b |
| R1d.3 | Corps sans détail anatomique | Vérification : pas d'organes génitaux (groupe `helper-genital` exclu), pas de mamelons, entrejambe lisse. Entrejambe carénée dans le maillage de base et dans toutes ses cibles (`assets:build`) ; mamelons rabattus au façonnage sur la surface lissée de leur pourtour (précisé en R1d.3, D-94). Test et captures `vue=anatomie` de face et de dos (`npm run mesure:r1d -- anatomie`) |
| R1d.4 | Arbres réalistes dans la scène tactique | Végétation réaliste de R1c.4 (bois, massifs, cartes de feuilles) à la place des icosaèdres de R1 ; allégée en qualité basse |
| R1d.5 | Textures Poly Haven | 6 matières × (couleur + relief) = 12 fichiers WebP 1K. Matières : pavés, sol naturel, pierre de taille, pierre brute, tuiles, ardoise. Teinte du profil conservée, repli procédural si le chargement échoue |
| R1d.6 | Remesure et rapport | `npm run mesure:r1d` : avant (`3782acd`) contre après, mêmes conditions ; deux instants ; teintes ; poids. `smoke:r1b` complet (CR1b-06). Revue des captures, `docs/reports/R1d.md`, `PROGRESS.md`. **Arrêt** |

## 3. Critères

| # | Critère | Commande |
|---|---|---|
| CR1d-01 | `src/sim` inchangé | `git diff --stat a2b2f88 -- src/sim` : sortie vide |
| CR1d-02 | `npm run verify` au code 0 | `npm run verify` |
| CR1d-03 | `assets:check` au code 0 ; au code 1 pour : Poly Haven hors textures d'environnement, texture d'environnement hors Poly Haven, fichier autre que WebP 1024 × 1024, plus de 12 textures | `npm run assets:check` ; `npx vitest run tests/lint/assets-check.test.ts` |
| CR1d-04 | Bundle principal inchangé, worker identique, textures hors du JS | `npm run mesure:r1d -- bundle` |
| CR1d-05 | Scène tactique, qualité basse : « prêt » < 3 s ; instant « corps » mesuré ; moyenne et haute mesurées, sans cible logicielle | `npm run mesure:r1d` |
| CR1d-06 | Visionneuse, qualité basse : « prêt » < 8 s pour les environnements mesurés ; jeu < 8 s | `npm run mesure:r1d` |
| CR1d-07 | Qualité basse allégée : sans éclairage d'image, sans relief, sans post-traitement, ciel peint ; feuillage sans cartes de feuilles et densité réduite en forêt | `npx vitest run tests/render/tactical3d/r1d.test.ts` |
| CR1d-08 | **Teintes.** Mêmes vues et graines que R1b (`a2b2f88`), jour, qualité moyenne : scène tactique, suivi, E01, E02, E22. Moyennes CIELAB du bas de l'image : \|Δb*\| ≤ 2,5, ΔC* ≥ −2, ΔL10 (ombres) ≤ +8 | `npm run mesure:r1d -- teintes` |
| CR1d-09 | **Corps sans détail anatomique.** Aucune primitive ni cible génitale. Zones des mamelons et de l'entrejambe lissées : écart à la surface lissée < 1 mm pour l'homme, la femme et la corpulence lourde (et le Titan de sexe 0,65). Surface lissée (D-94) : mamelons, quadrique du pourtour et raccord harmonique ; entrejambe, plaque mince de la construction. Captures de face et de dos revues | `npx vitest run tests/render/tactical3d/humain.test.ts` ; `npm run mesure:r1d -- anatomie` (`r1d-anatomie-*.png`) |
| CR1d-10 | Scène tactique : arbres réalistes (bois séparé, massifs), plus d'icosaèdres de R1 | `r1d.test.ts` ; captures |
| CR1d-11 | Textures Poly Haven : 12 fichiers au plus, WebP 1K, manifeste, attribution ; intégrées à la ville et aux environnements, teinte du profil conservée ; repli procédural | `assets:check` ; `r1d.test.ts` ; captures |
| CR1d-12 | Distinction des rendus (CR1b-06) remesurée, seuils inchangés | `npm run smoke:r1b` |
| CR1d-13 | Captures avant/après revues (ligne 14) ; rapport, `PROGRESS.md` | `docs/reports/R1d.md` |

**Justification des seuils de CR1d-08.**
- L'écart à corriger est mesuré sur les captures de R1c contre R1b (`docs/reports/R1c.md`) : b* de −5 à −8, C* de −3 à −5, L10 (ombres) de +9 à +24.
- R1c a aussi corrigé des normales retournées (façades mieux éclairées) et ajouté l'occlusion ambiante, d'où une marge sur L* et sur les ombres.
- Un |Δb*| de 2,5 reste sous le seuil de distinction entre rendus de R1b (ΔE moyen 2,3 + marge).

## 4. Hors périmètre
- R2, `src/sim`, les données de jeu.
- La compression des assets.
- Toute ressource Poly Haven autre que les textures d'environnement (sol, pierre, toits) : façades enduites, colombages, briques et bois restent procéduraux.
- La mesure sur GPU réel (utilisateur).
- Les portes de rivière hors de Shiganshina.
