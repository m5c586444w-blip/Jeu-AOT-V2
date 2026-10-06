# R1c — Bases CC0 : corps et animations, scènes réalistes

> **Commit de départ : `a2b2f88`** (fin de R1b, arrêt n° 1 : CR1b-06 en échec, voir `PROGRESS.md`). `git diff a2b2f88 -- src/sim` doit rester vide.
> **Source.** Consigne de l'utilisateur du 2026-10-06 (phase R1c), résumée :
> - lever la règle « aucun asset externe » pour les **corps de base** et les **animations** uniquement ;
> - sources autorisées : Kenney, Quaternius, KayKit, Poly Haven, MakeHuman (export CC0), Poly Pizza (CC0 ou CC-BY affiché) ;
> - **interdit** : tout modèle ou texture tiré de L'Attaque des Titans ou d'un fan, quelle que soit la licence ;
> - manifeste dans `docs/art/assets/` et `npm run assets:check` ;
> - intégration par `GLTFLoader` chargé à la demande ; soldats = base animée + équipement du projet ; Titans = base humaine déformée par les paramètres de R1b ;
> - comparaison avant/après (captures, fluidité, poids du bundle) et liste de ce qui ne marche pas ; `src/sim` intact ; arrêt pour revue ;
> - « Élimine toutes les sources non réalistes, tu les téléchargeras et implémenteras en jeu » ;
> - plus d'objectif moyen d'images par seconde, mais les contraintes de latence restent ;
> - « je veux des scènes et des environnements réalistes et travaillés » ;
> - étudier en détail la formation des districts, avec tout ce que l'on sait de l'animé ;
> - garder tout le reste du prompt R1b qui n'est pas contredit.

## 1. Règles propres à la phase

### Sources retenues
| Source | Statut | Raison |
|---|---|---|
| **MakeHuman** | **retenue** | Corps humains réalistes. Données sous CC0 (licence du dépôt `makehumancommunity/makehuman`, § C : maillage de base, cibles, poids, poses, textures). Dépôts officiels : `makehumancommunity/makehuman`, `makehumancommunity/mpfb2` |
| **Poly Haven** | **retenue** | Photos et scans réalistes, CC0. **Inaccessible** depuis l'environnement (refus de la politique réseau pour `polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org`, `cdn.polyhaven.com`) |
| Kenney, KayKit, Quaternius, Poly Pizza | **écartées** | Styles low-poly ou stylisés : non réalistes (consigne). Leurs sites sont aussi refusés par la politique réseau |

- **Portée.** La règle n'est levée que pour les corps de base et les animations (consigne, « uniquement »). Les textures d'environnement de Poly Haven ne sont donc **pas** utilisées sans accord explicite : question posée au rapport. Les environnements gagnent en réalisme par le rendu (ciel physique, éclairage d'image, occlusion ambiante, ombres douces, matériaux à relief) et par la géométrie, toujours procéduraux.
- **Animations.** Aucune source réaliste joignable n'en fournit : MakeHuman ne livre que des poses figées (`tpose.bvh`, `benchmark.bvh`, une image chacune). Les animations sont donc **écrites par le projet**, sur le squelette CC0 de MakeHuman.

### Fichiers externes
- Placés dans `docs/art/assets/`, chacun avec son entrée au manifeste `docs/art/assets/manifest.json` : nom, URL, licence, date, auteur, empreinte sha256, usage (`corps_de_base`, `animation`, `derive`).
- Les fichiers dérivés (le `.glb` produit par `npm run assets:build`) ont aussi leur entrée, avec la liste de leurs sources.
- Attribution dans `docs/ASSETS_LICENSES.md` (section R1c).
- `npm run assets:check` échoue :
  - si un fichier n'a pas d'entrée, ou si une entrée n'a pas de fichier ;
  - si la licence n'est ni CC0 ni CC-BY, ou si une entrée CC-BY n'est pas attribuée dans `ASSETS_LICENSES.md` ;
  - si l'URL n'est pas d'une source retenue (message distinct pour une source écartée, et pour une source interdite : œuvre ou fan) ;
  - si l'empreinte ne correspond pas au fichier.
- Servis au navigateur sous `/assets3d/…` (développement : intergiciel de Vite ; construction : copie dans `dist/assets3d/`). Le bundle principal ne change pas.

### Code
- three.js, `GLTFLoader` et tout le code de rendu restent dans `src/render/tactical3d`, chargés à la demande. Pas de `Math.random` (graine locale).
- Règles de R1b maintenues :
  - `git diff` de `src/sim` vide ;
  - bundle principal inchangé : même taille et même contenu une fois normalisés les noms de morceaux hachés ;
  - aucune image de `docs/art/reference/` dans `dist` ;
  - captures revues selon CLAUDE.md ligne 14 ;
  - mêmes graines, mêmes scènes ;
  - échelle à ±5 % ;
  - mur invisible en campagne intérieure.
- **Performance.** Plus d'objectif moyen d'images par seconde. Les contraintes de latence restent (04 §9) :
  - chargement à froid < 8 s ;
  - scène tactique < 3 s.

  Elles sont mesurées sans GPU (WebGL logiciel) ; la mesure sur GPU réel reste à faire par l'utilisateur.

## 2. Tâches

Un commit par tâche, `npm run verify` avant chacun.

| # | Tâche | Contenu |
|---|---|---|
| R1c.0 | Règles, manifeste, contrôle, sources | `CLAUDE.md` ; ce plan ; schéma du manifeste ; `npm run assets:check` (ajouté à `verify`) et son test (cas d'échec sur fixtures) ; `npm run assets:fetch` (sources officielles de MakeHuman, commits épinglés, empreintes) ; section R1c de `ASSETS_LICENSES.md`, générée depuis le manifeste |
| R1c.1 | Corps de base MakeHuman | `npm run assets:build` : maillage hm08, squelette `game_engine` (UE4, 53 os) plus une mâchoire, poids, yeux, dents, cibles macro (sexe, âge, musculature, corpulence), en `.glb` déterministe. Chargeur `GLTFLoader` à la demande ; corps paramétré : cibles, articulations recalées, proportions par os |
| R1c.2 | Soldats | Base animée (attente, marche, course, vol ODM, frappe, accroche) + équipement du projet : uniforme, harnais, appareil ODM, lames, cape. Prototype `/proto3d` et banc |
| R1c.3 | Titans | Base humaine déformée par les paramètres de `data/art/titans.json` (classes, variantes, spéciaux) ; peau, expressions (mâchoire), poses ; banc d'échelle à ±5 %, pieds au sol |
| R1c.4 | Rendu réaliste | Ciel physique, éclairage d'image (PMREM), occlusion ambiante, ombres douces, matériaux à relief, arbres plus réalistes, eau |
| R1c.5 | Districts selon l'animé | Étude des faits sourcés (§ 4) ; générateur de district revu ; paramètres `?` dans `data/art/` ; vues E07, E17, E20 recadrées (correctif proposé en fin de R1b) |
| R1c.6 | Comparaison et rapport | `npm run mesure:r1c` : avant (`a2b2f88`) et après, mêmes conditions (captures, temps d'image, latence de chargement, poids du bundle et des assets) ; `smoke:r1b` complet ; revue des captures ; ce qui ne marche pas ; `docs/reports/R1c.md`, `PROGRESS.md`. **Arrêt pour revue** |

## 3. Critères

| # | Critère | Commande |
|---|---|---|
| CR1c-01 | `src/sim` inchangé | `git diff --stat a2b2f88 -- src/sim` : sortie vide |
| CR1c-02 | `npm run verify` au code 0 | `npm run verify` |
| CR1c-03 | `assets:check` au code 0 sur le dépôt ; au code 1 pour chaque cas d'échec : fichier sans entrée, licence refusée, CC-BY non attribuée, source écartée, source interdite, empreinte fausse | `npm run assets:check` ; `npx vitest run tests/lint/assets-check.test.ts` |
| CR1c-04 | Bundle principal inchangé (critère R1b) ; `GLTFLoader` seulement dans un morceau chargé à la demande ; assets hors du bundle JS | `npm run mesure:r1c -- bundle` |
| CR1c-05 | Corps de base : maillage, 56 os, poids normalisés, cibles ; même graine, même corps (empreinte) ; le `.glb` se charge par `GLTFLoader` | `npx vitest run tests/render/tactical3d/humain.test.ts` |
| CR1c-06 | Soldats : corps animé, au moins 6 animations, équipement attaché aux os (suit la pose), 1,7 m à ±5 %, pieds au sol | tests ; captures |
| CR1c-07 | Titans : hauteurs à ±5 % (3 à 120 m), proportions mesurées conformes aux paramètres (tête, jambes, bras) à ±10 %, pieds au sol, toutes les poses | `npx vitest run tests/render/tactical3d/titans-r1c.test.ts tests/render/tactical3d/echelle.test.ts` ; banc |
| CR1c-08 | Districts : saillie, deux portes, route principale de porte à porte, éléments sourcés présents ; paramètres incertains marqués `?` | tests ; captures |
| CR1c-09 | Distinction des rendus (CR1b-06) remesurée : seuils inchangés | `npm run smoke:r1b` |
| CR1c-10 | Comparaison avant/après collée : captures appariées revues (ligne 14), temps d'image, latence (cibles 04 §9), poids | `npm run mesure:r1c` ; rapport |
| CR1c-11 | Rapport (14 §7), `PROGRESS.md`, liste de ce qui ne marche pas | `docs/reports/R1c.md` |

## 4. Formation des districts : faits et paramètres

Ordre des sources : ERRATA > 11 > 01 > 06 > partie B (`docs/art/STYLES.md`). Faits tirés de l'animé, marqués `C` seulement s'ils sont montrés ou dits à l'écran ; le reste est `A` ou `?` et paramétrable dans `data/art/`. Le détail et les sources sont à l'annexe du rapport.

## 5. Hors périmètre

- `src/sim`, les données de jeu, l'équilibrage, l'écran de bataille réel (R2).
- Toute texture d'environnement externe sans accord (§ 1).
- Les vêtements et coiffures externes (non couverts par « corps de base »).
