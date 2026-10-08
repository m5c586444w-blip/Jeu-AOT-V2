# PROGRESSION

| Champ | Valeur |
|---|---|
| Phase | **MAP terminée et fusionnée (PR n° 2, D-106).** Prochaine phase : UI (fichier 22 §5). Direction autonome depuis le 2026-10-08 (D-107). |
| Tâche | Reprise de MAP : fusion de la branche principale, revue des captures par sous-agent, correctif du panneau en 4K |
| Dernier `npm run verify` | 2026-10-08 : code 0 ; tests 510/510 (81 fichiers, `docs/reports/MAP-verify-fusion.log`) |
| Prochaine étape | PROCHAINE ACTION EXACTE : écrire `docs/phases/UI.md` puis exécuter UI sur `claude/v2-ui` (critères CUI-01 à 09) ; compte rendu dans `docs/MORNING.md` |

## Revue de fin de R1e (2026-10-08) — décision de l'utilisateur
- R1e terminée et acceptée. Prochaine phase : MAP (PR n° 2). LC-B en attente.
- CR1e-07 laissé en dette (n° 9), à reprendre en R2.
- Pas de feu vert pour LC-B, LC-C ni LC-D pour l'instant : placées en semaine 4 (fichier 24, N3).

## R1e terminée — arrêt de revue (2026-10-08)
- **Raison de l'arrêt** : fin de R1e (pilote Shiganshina) : revue de l'utilisateur (objectif et CLAUDE.md, arrêt 5).
- **Critères** (`docs/reports/R1e.md` § a) : 9 OK, 2 acceptés par l'utilisateur (CR1e-05 à 0,50, CR1e-10 : D-103),
  CR1e-07 en dette (deux échecs, 845-avant / 850-reprise ΔE 3,4 ; fichier 24 §4).
- **Sorties** : `verify` code 0 (493/493) ; `places:valider` code 0 (4 lieux N1, 1 N2) ; `smoke:r1b -- tout` 513 OK, code 0 ;
  portes : toutes les paires ≥ 6 (Shiganshina 85, min. 14,0) ; deltas de 100 lieux 104,6 Kio ; `src/sim` : 0 ligne de diff.
- **Revue des captures** (`docs/reports/R1e-revue-captures.md`, 154 captures) : correctifs faits pendant la revue (D-105) :
  sol recoupé en grille (axes des districts en herbe), places dégagées devant les portes et pont retiré du mur (cinq vues
  de porte sans porte), `fetchPlace` (village jamais affiché). Nouvelles dettes n° 11 (rayures des champs) et 12.
- **À trancher par l'utilisateur** : suite LC-B → LC-D comme prévu, ou installation du plan V2 (fichier 24 : lieux en
  semaine 4, niveau N3) ; pistes de CR1e-07 (dette n° 9).

## Reprise (2026-10-07) — décisions de l'utilisateur
- « Accepter 0,5 pour le moment » (CR1e-05) ; « garder tout, c'est du bon boulot » (CR1e-10 : correctif 8 gardé). D-103.
- Noms des districts de Maria repris du fichier 24 §3 (Quinta au nord, districts est et ouest, tous `?`). D-104.

## Feuille de route (consigne de l'utilisateur, 2026-10-07 ; `docs/phases/R1e-consigne.md`)
| Ordre | Phase | Contenu | Arrêt |
|---|---|---|---|
| 1 | **R1e** | Correctifs de R1d, système de lieux, mémoire des lieux, mur Maria : Shiganshina à la main et trois autres districts | **oui** (pilote) |
| 2 | LC-B | Mur Rose : Trost, Karanes, Utopia, Krolva, camp d'entraînement, quartier général | non |
| 3 | LC-C | Mur Sina : Mitras, Stohess, Orvud, Ehrmich, Yarckel, ville souterraine, chapelle Reiss | non |
| 4 | LC-D | Hors-murs : forêt des Arbres Géants, Utgard, Ragako, Dauper, Jinae, ferme, Liberio, fort du front, port | **oui** |
| 5 | R2 | 3D branchée sur la vraie bataille (exception `map.ts`) | selon le fichier 18 |
| 6 | T1 | Titans réalistes (prompt à écrire après R2) | — |
| 7 | R3 → P10 | inchangées | selon le fichier 18 |

Règles : plus de sous-phase inventée (hors-périmètre → `docs/reports/dette.md`) ; plus de nouvel outil de mesure ; rapports ≤ 150 lignes ; arrêts : fin de R1e, de LC-D, de R4, de P9 (et arrêts 1 à 4).

## Arrêt obligatoire n° 1 — CR1e-05 en échec deux fois (2026-10-07) — levé par l'utilisateur (D-103)
- **Critère** (plan R1e §2) : parement vu de face sur le banc (120 m × 50 m) ; autocorrélation normalisée de la luminance des
  colonnes (6 à 46 m de haut), décalages de 2 à 30 m : maximum < 0,35 ; le témoin de R1d doit dépasser 0,35.
- **Premier essai** (captures complètes du banc, `npx vitest run tests/places/murs.test.ts`) :
  ```
  parement R1e : max 0.689 à 2.1 m ; témoin R1d : max 1.001 à 9.9 m
  AssertionError: expected 0.6886860769154525 to be less than 0.35
  ```
  Cause mesurée : la variance des colonnes venait de plaques larges (teinte des panneaux de 7,3 m, masques des appareils), d'où
  une forte corrélation dès 2 m.
- **Correctif (un seul)** (`src/render/tactical3d/parement.ts`) : coulures en bandes verticales étroites (0,55 m) tirées une à
  une (présence, intensité, longueur), teinte des panneaux réduite de moitié.
- **Second essai** (même commande) :
  ```
  parement R1e : max 0.501 à 19.9 m ; témoin R1d : max 1.001 à 9.9 m
  ```
  Courbe complète (diagnostic, même image) : `1 m 0.18 | 2 m 0.26 | 3 m 0.24 | 4 m 0.15 | 6 m 0.15 | 8 m 0.31 | 10 m 0.15 |
  12 m 0.21 | 15 m 0.09 | 18 m 0.06 | 20 m 0.48 | 22 m 0.11 | 25 m 0.07 | 30 m 0.04` (témoin R1d : 0,95 à 10 et 20 m).
  Tout est sous 0,35 sauf **un pic isolé à 20 m** : une vraie répétition, de cause non établie.
  - Le hachage des bandes n'est pas périodique en double précision (corrélation −0,09 à 35 bandes = 19,25 m).
  - Les photos de Poly Haven (2 m et 2,5 m) donneraient aussi un pic à 10 m (0,15 seulement).
  - La coordonnée le long du mur est continue (`wall3d.ts`).
- **Décision demandée** :
  - (a) autoriser un troisième essai : isoler la composante de 20 m (rendu de face appareil par appareil, photos et coulures
    séparées), la supprimer, puis remesurer ;
  - (b) ou accepter CR1e-05 en l'état (0,50 ; témoin 1,00) et poursuivre ;
  - (c) ou redéfinir la mesure.
- **État des autres tâches de R1e** (rien n'est perdu ; tout est commité, voir le journal git) :
  - R1e.2 (correctifs 1 à 8) : fait ; planches `docs/screenshots/r1e-correctifs-1.png` à `-8.png` ; `smoke:r0 -- apres` : code 0.
    `smoke:r1b` : premier passage arrêté au banc d'échelle (attente des photos, corrigée) ; second passage interrompu pour le
    correctif de parement : à relancer.
  - R1e.3 (murs et portes) : banc capturé ; CR1e-06 (7 vues par porte, ΔE ≥ 6, extérieure ≠ intérieure) : test vert.
  - R1e.4 (Shiganshina), R1e.5 (trois districts), R1e.6 (mémoire, village N2) : faits dans le code et validés hors captures
    (population ÷ densité : écarts de −8,5 % à +7,9 % ; arbres ≥ 23 par ha bâti) ; captures des lieux à faire.
  - R1e.7 (captures, rapport) : à faire après la décision.
- **Second point à trancher : CR1e-10 et le correctif 8.** `npm run mesure:r1d -- bundle` (`docs/reports/R1e-bundle.log`) :
  `KO bundle principal : même taille (902588 → 902798 octets)`. Les 210 octets viennent du correctif 8 (cadrage des éclairs de
  transformation, `src/render/tactical/framing.ts`, rendu 2D du bundle principal : `boltsInFrame`). Le correctif 8 est demandé
  par la consigne (§6) et touche forcément le bundle principal : « bundle principal inchangé » ne peut pas tenir avec lui.
  Les autres contrôles passent (worker identique à l'octet, ni three.js ni GLTFLoader dans le bundle, aucun asset dans le JS).
- **`npm run verify`** (`docs/reports/R1e-verify-arret.log`, `R1e-verify-suite.log`) : typecheck et lint au code 0 ; tests
  `Test Files 1 failed | 77 passed (78)`, `Tests 1 failed | 492 passed (493)` — le seul échec est CR1e-05 ; ensuite, lancés un à
  un : `data:validate`, `assets:check` (102 entrées), `canon:check`, `sim:selftest`, `build` au code 0. `src/sim` inchangé
  depuis `497be52` (0 ligne de diff).

## R1e.1 (2026-10-07)
- Schéma `src/data/placeSchema.ts` (lieux N1, murailles, plans figés N2) ; `data/places/_murs.json` (hauteur 50 m [C], le reste [?] avec plage).
- Rendu : `src/render/tactical3d/places/` (mise en place déterministe, pièces instanciées par archétype, tronçons de 64 m, sol, eau, murailles) ; visionneuse `?proto3d&lieu=<id>` ; plans servis sous `/places3d/` (hors bundle).
- Outils : `places:valider`, `places:captures`, `places:regenerer` ; tests `tests/places/systeme.test.ts` (14).

## R1e ouverte (2026-10-07)
- Consigne copiée mot pour mot (`docs/phases/R1e-consigne.md`) ; fichiers prérequis lus en entier (06, 11, ERRATA, rapport R1d).
- Recherche de lore : aucune source officielle pour les noms des trois autres districts de Maria ni pour l'épaisseur des murs → `?` (`docs/lore/questions-ouvertes.md`, Q1–Q10).
- Population de la simulation (scénario 845) : Shiganshina 60 870 habitants → saillie d'environ 1,2 km de rayon à 280 hab/ha (cœur ancien dense).

## R1d terminée — arrêt obligatoire (2026-10-07)
- **Raison de l'arrêt** : fin de R1d, revue de l'utilisateur (CLAUDE.md, arrêt 5).
- **Critères** (`docs/reports/R1d.md` § a) : 12 sur 13 OK.
  - CR1d-08 (teintes) : échec au premier passage (E22, ΔL10 +9,0) ; corrigé une fois (D-97) ; OK au second.
  - **CR1d-12 (distinction des rendus) : KO, premier échec.** E07–E21 : ΔE couleur moyenne 2,1 pour 2,3 ; 206 paires sur 207 passent. Cause mesurée : la correction des teintes (R1d.2) rapproche Orvud et la ville-usine (5,1 en R1c ; les photos n'y sont pour rien). Pas de correctif : choix artistique pour E21 (rapport § i, question 1).
- **Résultats clés** :
  - scène tactique en qualité basse : « prêt » 1,99 s (6,16 s en R1c), « corps » 8,62 s ;
  - environnements en qualité basse : « prêt » de 1,64 à 3,60 s ;
  - jeu : 2,60 s ;
  - corps sans mamelons ni organes génitaux (écart à la surface lissée 0,00 mm et < 0,5 mm) ;
  - arbres réalistes dans la scène tactique ; 12 textures de Poly Haven.
- **Décisions attendues** (rapport § i) : E07–E21 ; mesure sur GPU réel ; étendue des textures en photo ; rendu des corps.

## R1d.6 : remesure et rapport (2026-10-07)
- `npm run mesure:r1d` : essai 1 KO (CR1d-08, E22) ; correctif `HEMI_WITH_ENV` 0,85 (D-97) ; essai 2 : tous les contrôles passent.
- Mesure fiabilisée : second temps attendu seulement sur les pages de R1d, attente bornée, erreur du second temps notée (D-97).
- `npm run smoke:r1b` : 1 contrôle en échec (E07–E21). Journaux gardés sous les noms de R1d ; captures de R1b remises à leur état de R1b.

## R1d.5 : textures de Poly Haven (2026-10-07)
- 12 fichiers (`docs/art/assets/polyhaven/`), manifeste et attributions ; `assets:check` : 102 entrées (D-96).
- Posées après les corps détaillés, teinte du profil conservée, repli procédural ; « prêt » en qualité basse : 2,01 s (`mesure:r1d -- rapide`).
- Tests : `tests/render/tactical3d/r1d.test.ts` (CR1d-11).

## R1d.4 : arbres réalistes dans la scène tactique (2026-10-07)
- Arbres de la place et des abords rendus par `buildVegetation` (bois, massifs, cartes de feuilles), plus d'icosaèdres (D-95).
- Mêmes tirages qu'en R1 : le reste de la ville est inchangé. Qualité basse : sans cartes de feuilles.
- Test : `tests/render/tactical3d/r1d.test.ts` (CR1d-10) ; captures à la remesure (R1d.6).

## R1d.3 : corps sans détail anatomique (2026-10-07)
- **Organes génitaux** : aucun (groupe « helper-genital » de MakeHuman non repris) ; entrejambe carénée dans le corps de référence et ses 51 cibles.
- **Mamelons et aréoles** : rabattus au façonnage sur la surface lissée de leur pourtour ; pointe du sein arrondie (« breast-point-decr »).
- **Mesure** (D-94) : écart à la surface lissée, homme, Titan 0,65, femme, lourde. Avant (R1c) : mamelons 3,3 à 26,3 mm, entrejambe 8,6 à 14,6 mm. Après : 0,00 mm et < 0,5 mm (test `humain.test.ts`, < 1 mm).
- **Captures** : `npm run mesure:r1d -- anatomie`, `docs/screenshots/r1d-anatomie-*` (face, dos, torses, bassins ; avant et après), revues au rapport.

## R1d ouverte (2026-10-07)
- **Revue de R1c par l'utilisateur** (D-91) :
  - latence : options c + b, sans compression d'assets ;
  - Poly Haven pour les textures d'environnement seulement (12 au plus, 1K, WebP) ;
  - districts gardés en `?` et `A`.
- **Réseau** : Poly Haven joignable depuis la session (`api.polyhaven.com` et `dl.polyhaven.org` : fichier 1K téléchargé, empreinte md5 conforme à l'API).
- **Plan** : `docs/phases/R1d.md` (7 tâches, critères CR1d-01 à CR1d-13). Arrêt en fin de phase ; R2 non lancée.

## R1c terminée — arrêt obligatoire (2026-10-07)
- **Raisons de l'arrêt** (CLAUDE.md) :
  - arrêt 5 : fin de R1c, revue de l'utilisateur ;
  - arrêt 1 : un critère échoue deux fois. La latence de la scène tactique (04 §9, cible 3 s, CR1c-10) échoue aux deux passages de `npm run mesure:r1c` : **10,25 s**, puis **8,91 s** après le correctif. Elle était de 2,53 s avant R1c (rendu logiciel SwiftShader, 1366 × 768, qualité moyenne).
- **Correctif tenté (un seul)** : carte d'environnement à 64 texels par face au lieu de 256. Gain : 1,3 s sur la scène complète, et 2,7 s sur une configuration légère (D-90). Insuffisant.
- **Cause** (`docs/reports/R1c-latence-mise-au-point.log`) :
  - ≈ 3,2 s de JavaScript, dont le façonnage de 20 corps (0,8 s) et l'attente de compilation des shaders ;
  - ≈ 5,7 s de GPU logiciel pour la première image : 35 programmes, peau, relief, éclairage d'image, ombres douces, occlusion ambiante.
  - Seule une configuration sans carte d'environnement, avec les figures de R1, en qualité basse, passe sous 3 s (2,2 s).
- **Décision attendue** (rapport § i) :
  - a. juger la latence sur un vrai GPU ;
  - b. qualité basse allégée ;
  - c. chargement progressif ;
  - d. compression des assets (en plus de a, b ou c).
- **Autres résultats** :
  - bundle principal identique une fois les noms hachés normalisés (902 588 octets), worker identique à l'octet ;
  - GLTFLoader à la demande ; assets 3D de 6,17 Mio hors du JS ;
  - jeu (carte stratégique) chargé en 2,19 s ;
  - E13 à 8,17 s et E14 à 26,68 s, au-dessus de la cible de 8 s ;
  - 15 scènes capturées avant et après, revues (§ e) ; défauts listés (§ f).
- **Pas fait, en attente de la décision** : `smoke:r1b` complet (CR1b-06), qui serait refait si le rendu change.

## R1c.5 : districts d'après l'animé (2026-10-06)
- Étude des faits : `docs/reports/R1c-annexe-districts.md` (9 faits, statut `C`/`A`/`?`, sources, limites de la recherche) ; D-89.
- Générateur : rue principale droite et pavée de porte à porte, sans maison dessus ; Shiganshina : voie d'eau par deux portes de rivière (herse), barques et pontons côté porte intérieure, ponts, poste de la Garnison ; Trost : variante `850_rocher`.
- Paramètres `?` : `porte_eau_largeur_m`, `porte_eau_hauteur_m` (`data/art/murs.json`).
- Vues recadrées : E07 (repères), E17 (rivière et mares), E20 (château). Visionneuse : vue libre `&oeil=x,y,z&cible=x,y,z`.
- Tests `districts-r1c.test.ts` (5) ; `environnements.test.ts` et `murs.test.ts` mis à jour (canal de E01, portes d'eau).

## R1c.4 : rendu réaliste (2026-10-06)
- Ciel physique (Preetham, nuages calculés) en plein jour ; dôme peint à l'aube, au crépuscule, la nuit, sous terre. Éclairage d'image dosé (D-88).
- `post.ts` : occlusion ambiante (GTAO, depuis la profondeur du rendu) et sortie, en qualité moyenne et haute ; visionneuse d'environnements (y compris planches), prototype, page des corps. Ombres douces (rayon PCF).
- `meshTrees.ts` : arbres réalistes (massifs, bois, cartes de feuillage) ; haies et voûte des Arbres Géants habillées de feuilles.
- Relief : normales tirées des textures (murs, façades, toits, pavés), détail du sol, rides de l'eau animées, grain de peau, étoffe des uniformes. Normales des pièces assemblées corrigées.
- Tests `rendu-r1c.test.ts` (6).

## R1c.3 : Titans (2026-10-06)
- `humanTitan.ts` : corps de base déformé par `data/art/titans.json` (longueurs, largeurs, épaisseurs, corpulence, ventre, expressions par cibles de visage, cheveux) ; marque de nuque sur l'os du cou ; vapeur partagée avec R1 (`titanSteam`). Facteurs résolus puis vérifiés sur le corps façonné (D-87).
- Corps de base : nouveaux déformeurs (avant-bras, pieds, carrure, bassin, profondeur, largeur du crâne, épaisseurs) ; yeux réparés (atlas lu sans retournement, cornée retirée) ; coude donné depuis le bras tendu ; corps couchés basculés d'un bloc.
- `bodies.ts` : `makeTitan`, `titanFactory` ; prototype, banc d'échelle, visionneuse d'environnements et galerie les utilisent (repli R1 : `?corps=primitives`). Planches `?proto3d=humain&planche=titans|poses`.
- Tests `titans-r1c.test.ts` (6) : hauteurs à ±5 % (3–120 m), tête, jambes, bras à ±10 %, pieds au sol à 0,5 %, corps couchés, articulations, mâchoire, nuque, vapeur, déterminisme, repli.

## R1c.2 : soldats (2026-10-06)
- `humanAnim.ts` : poses écrites par le projet sur le squelette CC0 (rotations « monde » empilées os par os) ; soldats : attente, marche, course, garde au sol, vol, accroche, frappe ; Titans : marche, course, debout, saisie, abattu, allongé, buste. Pieds posés par la semelle (24 points de peau).
- `humanSoldier.ts` : forme tirée de la graine (30 % de femmes), uniforme par région du corps (veste, pantalon, bottes lissées), sangles qui épousent la peau, col et revers sur les coutures, réservoir, lanceurs, fourreaux, lames et cape portés par les os ; cheveux peints et coque. `bodies.ts` : corps MakeHuman, repli R1 (`?corps=primitives` ou échec du chargement).
- Éclairage : carte d'environnement PMREM tirée du ciel (reflets des métaux), sauf sous terre.
- Tests `soldats-r1c.test.ts` (5) : pieds à ±2 cm, 1,7 m à ±5 %, équipement sur les os, poses animées, déterminisme.

## R1c.1 : corps de base (2026-10-06)
- `npm run assets:build` : `docs/art/assets/derives/humain.glb` (5,9 Mo), déterministe (`-- --verifier` : reconstruit et identique). 12 primitives, 56 os (squelette « game_engine » + mâchoire + yeux), 50 cibles éparses avec le déplacement des articulations.
- Servi sous `/assets3d/` (intergiciel en développement, copie dans `dist/assets3d/`) ; chargé par `GLTFLoader` importé à la demande. Bundle principal : même nom haché qu'au départ.
- Corps façonné en 10 à 60 ms : cibles cuites, normales sans couture, proportions par chaîne d'os, hauteur exacte, pieds au sol. Page de contrôle `?proto3d=humain`.

## R1c ouverte (2026-10-06)
- **Décision de l'utilisateur.** Règle « aucun asset externe » levée pour les corps de base et les animations ; sources non réalistes écartées ; plus d'objectif moyen d'images par seconde, latence maintenue ; scènes et environnements réalistes ; formation des districts d'après l'animé. Arrêt pour revue en fin de phase. Plan : `docs/phases/R1c.md`.
- **R1b.** La consigne R1c passe à la suite ; le correctif de vues proposé à l'arrêt de R1b (E07, E17, E20) est repris en R1c.5, et la distinction des rendus (CR1b-06) sera remesurée.
- **Réseau.** La politique réseau de l'environnement refuse `polyhaven.com` (et `api.`, `dl.`, `cdn.`), `quaternius.com`, `kenney.nl`, `poly.pizza`, `static.makehumancommunity.org`. Les dépôts GitHub officiels de MakeHuman sont joignables : c'est la seule source utilisée.
- **Animations.** Aucune source réaliste joignable n'en fournit (MakeHuman : poses figées seulement) : elles seront écrites par le projet sur le squelette CC0.

## R1b, arrêt obligatoire n° 1 : CR1b-06 échoue une deuxième fois (2026-10-06)
- **Raison de l'arrêt (CLAUDE.md, arrêt 1).** Le critère CR1b-06 (distinction des rendus hors écran) a échoué une première fois au lot 1 (Trost–Stohess, corrigé), et il échoue de nouveau au premier passage du lot 2. Je m'arrête sans tenter un second correctif.
- **Mesure en échec** (`npm run smoke:r1b -- lot2`, code 1 ; `docs/reports/R1b-smoke-lot2-essai1-KO.log`, `R1b-distances-rendus-lot2.log`) :
  ```
    KO  lot 2 E17–E20 : ΔE couleur moyenne 1.2 ≥ 2,3
    KO  lot 2 E17–E20 : ΔE grille 3.0 ≥ 5
    KO  lot 2 E04–E07 : ΔE grille 4.8 ≥ 5
  smoke:r1b : 3 contrôle(s) en échec.
  ```
  Les 169 autres paires du lot 2 passent les deux seuils (171 paires). Toutes les planches se chargent sans erreur de page.
- **Cause.**
  - E17 (marais) et E20 (château d'Utgard) : les deux vues principales montrent surtout une prairie verte sous un ciel gris. Le château n'occupe qu'une petite part du cadre ; l'eau du marais aussi, depuis que le marais a été relevé de 0,3 m (moins de mares).
  - E04 et E07 (districts) : même gabarit de vue d'ensemble, deux villes de teintes voisines.
- **Correctif proposé, non appliqué** (j'attends l'accord) :
  - E20 : vue principale plus proche et plus basse, le château et son donjon au centre (pierre et ardoise sombres dans le cadre) ;
  - E17 : vue principale cadrée sur la rivière et les mares (l'eau et les roseaux dans le tiers bas) ;
  - E04–E07 : composer la vue principale de E07 sur ses repères de profil, comme pour Trost–Stohess au lot 1.
- **Lot 2 livré par ailleurs.**
  - 11 générateurs nouveaux (`envMore.ts`) : souterrain (E08), ville agricole (E10), forêt (E15), montagne (E16), eaux (E17), côte (E18), château (E20), usine et cavernes de glace (E21), crypte (E23), camps (E24, fort avancé ; E25), glacis (E29). Lisière d'Arbres Géants pour E28 (`addGiantEdge`).
  - Maillages nouveaux : voûtes de roche et crypte (`meshCave.ts`), château, donjon, halle à sheds, autel (`meshBuildings.ts`), cristaux lumineux, écume et embruns.
  - Éclairage souterrain : jour par les puits seulement, ambiance forte, lanternes et bougies toujours allumées (D-86).
  - Tests : déterminisme du lot 2 (données et empreinte de géométrie, variantes comprises) et contenu de chaque environnement (`environnements.test.ts`).
- **Teintes des textures corrigées (défaut trouvé en cours de lot 2, D-86).** `shade()` écrivait des composantes linéaires dans un canevas sRGB : sols et façades assombris deux fois, sur tous les environnements. Les planches du lot 1 (`docs/screenshots/r1b-E01.png`…) datent d'avant cette correction ; elles et leurs distances de rendu sont à refaire au `smoke:r1b` complet.
- **Contrôles passés.**
  - `git diff --stat b68fade -- src/sim` : sortie vide.
  - `npm run verify` : code 0, 65 fichiers, 399 tests.
  - Bundle principal : `index-*.js` 902,58 kB (taille de `b68fade`) ; worker `sim.worker-BDqA4b1U.js`, même nom haché qu'au départ.
- **Pas encore fait.** `npm run mesure:r1b` (outil écrit : `src/tools/mesure-r1b.ts`), revue ligne 14 des planches du lot 2, galerie complète, rapport `docs/reports/R1b.md`.

## R1b, lot 1 livré (2026-10-06)
- **Environnements.** E01 Shiganshina, E02 Trost, E05 Stohess, E06 Mitras, E11 village agricole, E13 campagne pure, E14 forêt des Arbres Géants, E19 territoire des Titans, E22 murs. Tous sont générés depuis `data/art/styles.json`, sans teinte dans le code.
- **Planches.** Une par environnement, jour et crépuscule : `docs/screenshots/r1b-E*.png`. S'y ajoutent les variantes (845, 850, 851, clairière, lisière, Ragako 850, mur endommagé, Titans nombreux), le cycle, la météo, les ruines et incendies, le banc d'échelle.
- **Mesures** (`npm run smoke:r1b -- lot1`, code 0) :
  - distance entre profils ≥ 1 pour les 36 paires (minimum 1,83, E11–E13) ;
  - rendus hors écran : ΔE moyen minimum 4,2 (seuil 2,3), ΔE grille minimum 8,3 (seuil 5) ;
  - banc : soldat 1,68 m, Titans de 3 à 120 m et mur de 50 m conformes à ±5 %.
- **Un critère en échec au premier passage, corrigé (pas d'arrêt : un seul échec).** ΔE grille Trost–Stohess à 4,7 (< 5) : même cadrage pour les deux districts. Vue principale composée sur les repères du profil, puis 15,1 au second passage.
- **Bundle principal.** 902 588 octets, identique à `b68fade` une fois normalisés les noms de morceaux hachés (critère précisé au § 1 du plan) ; worker identique à l'octet.

## R1b ouverte (2026-10-06)
- **Décision de l'utilisateur.** RENDU = 3D. Phase R1b : environnements, échelle et fidélité.
- **Plan.** `docs/phases/R1b.md` : 11 tâches, critères CR1b-01 à CR1b-16, seuils de distinction justifiés (§ 4).
- **Bundle principal identique à l'octet** (sha256 `b452fe27…`, 902 588 octets).
  - Les données de rendu (`data/art/`) sont exclues des globs des Archives et du worker.
  - La galerie s'ouvre par une page de redirection statique.
- **Arrêt obligatoire en fin de phase.** L'utilisateur indiquera RENDU = 3D ou 2.5D.

## R0, critère f rouvert — corrigé (2026-10-06), arrêt demandé
- **Constat.** La tête du porteur était coupée par la barre de titre, et le contrôle testait un point à mi-corps.
- **Correctif.** Le cadrage garde la figure DESSINÉE (hauteur agrandie en vue d'ensemble, tête comprise) avec une marge haute de 10 px, réduite jusqu'à 2 px seulement si le sol tomberait sous 85 %. Les éclairs sont à l'échelle du Titan (D-85).
- **Preuves.**
  - Test de boîte englobante des tracés réels : rouge contre l'ancien cadrage (tête à −0,2 et −2,0 px), vert après (16/16).
  - `smoke:r0 -- apres` : code 0, boîte Pixi de la figure dans la scène, sous la barre de titre.
  - Capture recapturée et revue (rapport R0 § g).
- **Arrêt** demandé par l'utilisateur après ce commit.

## Règles mises à jour (2026-10-06, consigne de l'utilisateur, CLAUDE.md)
- **Arrêts de revue obligatoires** : fin de P4, P8, R1, **R2**, R3, **R4**, R7, **R8** et **P9** (R2, R4, R8 et P9 ajoutés).
- **three.js** n'est utilisé que dans `src/render/tactical3d` ; la règle ESLint est déjà en place (`tests/lint/sim-purity.test.ts`).
- **Relecture des captures** (CLAUDE.md, ligne 14) : toujours en vigueur (description en 3 lignes, au moins 3 défauts possibles).
- **Exception connue** : pendant R2 seulement, `src/sim/tactical/map.ts` peut recevoir une extension additive (voir le prompt R2). Aucun autre fichier de `src/sim`.

## R1 terminée (2026-10-06) — arrêt obligatoire, décision de l'utilisateur attendue
- **Rapport.** `docs/reports/R1.md` : CR1-01 à CR1-10 OK. CR1-03 avec un écart signalé : three.js est absent du bundle principal, mais celui-ci grossit de 416 octets (routage et lien F2).
- **Prototype.** Page `/proto3d` ou `?proto3d`, ouverte depuis la console F2 :
  - ville irrégulière par graine ;
  - jour, crépuscule, nuit ;
  - deux Titans de 5 m et 15 m, trois poses chacun, marque de nuque ;
  - 20 soldats avec câbles et gaz, 300 instanciés ;
  - caméras libre et de suivi d'escouade, qualité basse, moyenne, haute ;
  - repli 2D sans WebGL, three.js non téléchargé dans ce cas.
- **Mesures** (WebGL logiciel, 1366×768) :
  - rue : 2D 12,8 img/s ; 3D 4,8 (basse), 2,0 (moyenne), 1,6 (haute) ;
  - 300 unités : 2D 9,1 ; 3D 13,1 (basse) ;
  - 3840×2160 mesuré aussi. Pas de GPU réel.
- **Recommandation** (§ g) : RENDU = 3D pour la seule bataille, à trois conditions : 2D gardé en repli, effort sur les figures et la stylisation, mesure sur GPU réel. Variante hybride si les machines sans GPU priment.
- **À trancher avant R2** : la ville irrégulière n'existe qu'au rendu ; les cartes de la simulation restent des grilles. Les faire concorder demande de changer `src/sim`.
- **Toujours en attente depuis R0** : critère f rouvert (marge de cadrage haute de l'écran de bataille 2D, test de boîte englobante du porteur), interrompu par R1 avant tout commit.

## R0 terminée (2026-10-06) — arrêt demandé
- **Rapport.** `docs/reports/R0.md` : CR0-01 à CR0-07 OK, critère f OK. Chaque capture « après » y est revue selon CLAUDE.md ligne 14 (description, au moins 3 défauts possibles).
- **Décision de l'utilisateur sur l'arrêt du critère f, appliquée** (un commit chacun) :
  - cadrage testé par tableau (8 scénarios, flèches de bord, D-80) ;
  - sous-titres placés hors des pastilles, des flèches et du HUD ;
  - preuve que le plafond du pas de temps ne change aucun hash ;
  - incident git documenté (`R0-incident-git.md`) ;
  - délai d'AC3-06 relevé (D-79).
- **À arbitrer.**
  - Zone de jeu, fenêtre entière : la bataille fait 55 % à 1366 et 84 % en 4K, contre 85 % visés sur la vue seule.
  - En 4K, les pastilles et les flèches gardent une taille fixe.
  - Les sous-titres peuvent couvrir un corps de Titan.
  - Sur l'atlas, des noms recouvrent encore des taches de province.

## Arrêt levé (2026-10-06) — R0.2f (transformation visible) en échec pour la 3e fois : correctif décidé par l'utilisateur, appliqué
- **Historique du critère f** (`smoke:r0`, « porteur et éclair dans le champ de la caméra ») :
  1. KO pendant la mise au point (`r0-apres-1`) : porteur hors champ ;
  2. KO à nouveau (`r0-apres-2`) : corps sous les sous-titres, mesure prise avant que le corps existe ;
  3. OK sur les commits 2bd1325 et 1360f79 (batteries `final-r0` et `final-r0c`) ;
  4. **KO dans la batterie finale** (`docs/reports/R0-smoke-apres.log`).
- **Cause du dernier échec : régression introduite par 0333fc2.**
  - En relisant la capture « bataille » (nouvelle règle de CLAUDE.md), j'ai trouvé un défaut : aucun homme du joueur dans le champ à l'ouverture (0/36).
  - Le correctif (ResizeObserver, hommes prioritaires au cadrage) remet 36/36 hommes dans le champ.
  - Mais dans l'essai de porteur, les hommes sont au sud et le Cuirassé au nord : la priorité donnée aux hommes rogne le nord, et le porteur sort du champ (capture `r0-apres-transformation.png`).
- **Défaut supplémentaire relevé sur cette capture** : les sous-titres de bataille, déplacés en bas à gauche par R0.2f, couvrent la pastille de l'escouade 1.
- **Correctif proposé, non appliqué** :
  - dans `frame()`, traiter les porteurs (points `reach`, pieds et tête) comme les hommes du joueur, en « à voir absolument » : l'échelle ne dépasse pas celle qui contient hommes et porteurs, et le cadre est ramené sur cette emprise ;
  - placer les sous-titres de bataille en haut à gauche de la scène, à l'écart des pastilles d'escouade et du point d'apparition des porteurs (nord, centre).
- **État des autres critères** (batterie finale, code 0333fc2) :
  - `verify` : code 0 (306 tests) ;
  - `sim:tactical --realisme` : R-gaz OK pour les 4 classes, R-nuit OK ;
  - `sim:expeditions` : 31,9 % ;
  - `smoke:map` : 26/26 ; `smoke:politique` : 30/30 ; `smoke:tactique` : 32/32 (sol 96 % au lieu de 100 % pour le banc de 300 unités, seuil 90 %) ; `smoke:p8` : 139/139 ;
  - `smoke:r0` : tout OK sauf f.

## P8 terminée (2026-10-04) — arrêt de revue
- Rapport : `docs/reports/P8.md` ; AC8-01 à AC8-08 OK ; AC8-09 (60 FPS) **non vérifié : GPU réel requis**.
- Raison de l'arrêt : CLAUDE.md, arrêt 5, revue de l'utilisateur à la fin de P8. Elle demande une revue visuelle humaine (« sans template look ») et une écoute de la musique de synthèse.
- À trancher : R-gaz (D-62, ci-dessous).
- Mise au point de `smoke:p8` : trois lancements de l'outil neuf avant la batterie, détaillés au rapport § e. La batterie officielle est passée au premier essai.

## P7 terminée (2026-10-04)
- Rapport : `docs/reports/P7.md` ; AC7-01 à AC7-10 OK, aucun échec de critère.
- Reporté à P8 : esthétiques de Marley et d'Hizuru, dossier de choix illustré, alerte du bandeau pour Marley. À P9 : invasion amphibie par l'IA, E43–E52 jouables, Grondement.

## P6 terminée (2026-10-04)
- Rapport : `docs/reports/P6.md` ; AC6-01 à AC6-10 OK. Deux critères ont échoué une fois chacun par erreur de test (smoke:p6, smoke:politique), puis passé : aucun arrêt.
- Reporté à P8 : transformation animée (éclair, vapeur) et figure dédiée des porteurs en bataille.

## Arrêt levé (2026-10-04) — AC5-03 / AC5-10 : `smoke:p5` en échec deux fois
- **Levé** : l'utilisateur a fixé l'objectif « P5 à P8 terminées » juste après la proposition de correction ; correction appliquée (dossier fermé avant l'envoi de la commande).
- **1er passage** (`docs/reports/P5-smoke-p5-essai1-KO.log`) : erreur du test. Un événement générique (« Mariage de notables », survenu le 1er jour) précède E09 : le test lisait ce dossier-là (3 lignes de coûts au lieu de ≥ 4), puis rouvrait la mauvaise ligne de la chronique.
- **2e passage** (`docs/reports/P5-smoke-p5-essai2-KO.log`, après correction du test) : le test attend en vain le dossier E09. **Défaut réel du jeu**, diagnostiqué hors commande officielle :
  - signer un dossier exécute la commande, et la commande rafraîchit l'écran, ce qui **ouvre déjà le dossier suivant** (E09) ;
  - le gestionnaire ferme ensuite « le » dossier, **après** la commande : il referme donc le suivant, qui est marqué « présenté » et ne se rouvre plus de lui-même. Il reste accessible par la chronique.
- **Correction proposée** (non appliquée) : dans `src/ui/eventDossier.ts`, fermer le dossier **avant** d'envoyer la commande (`this.close()` puis `dispatch`), pour que le rafraîchissement ouvre le suivant sans qu'il soit refermé. Le test est déjà corrigé (dossiers précédents réglés jusqu'à E09, ligne E09 ciblée dans la chronique).
- Tout le reste de P5 est fait et vérifié hors navigateur (tests unitaires : événements, recherche, renseignement, calques ; `sim:selftest`, `sim:expeditions` inchangé). Restent T5.9 (`sim:events`, contrôles) et T5.10 (rapport).

## Revue de P4 (2026-10-04) — validée, correctifs appliqués
- Cartes d'escouade coupées : fait (D-63).
- Vue d'ensemble : pastilles d'escouade et Titans agrandis sous 4 px/m, cadrage qui remplit l'écran : fait (D-63).
- « ms/image · unités » visible seulement en debug (F2) : fait (D-63).
- Sens du calibrage de l'auto-résolution et contrôle de réalisme indépendant : D-62 et `npm run sim:tactical -- --realisme`.
- **60 FPS : non vérifié, GPU réel requis** (pas de poste local chez l'utilisateur). Ne bloque pas.

## Reporté à P8 (décision de l'utilisateur, revue de P4)
- Grille de bâtiments trop régulière (ville en caisses alignées).
- Occlusion décor/unités : les unités sont toujours dessinées par-dessus bâtiments et arbres.
- Vapeur des Titans abattus : aujourd'hui une ellipse et des bouffées fixes, sans animation.

## Décision prise (revue de P8, 2026-10-05) — R-gaz (D-62) : options (c) + (a), appliquée en R0 (D-77)
- Constat (`docs/reports/P4-revue-realisme.log`) :
  - gaz par homme et par bataille : 2,4 u contre un petit Titan, 5,7 u contre un moyen, 10,6 u contre un grand, pour une plage de [3, 8] u (02 §15) ;
  - jouer contre un grand Titan coûte environ deux fois le gaz de l'auto-résolution.
- Options :
  - (a) accepter la dépendance à la classe et lire [3, 8] u comme un combat type, contre un Titan moyen ;
  - (b) recalibrer le combat tactique : moins de passes contre les grands Titans, létalité compensée ; il faut alors refaire AC4-08 ;
  - (c) faire suivre la menace au gaz de l'auto-résolution, pour supprimer l'écart entre jouer et auto-résoudre.
- Recommandation : (c), éventuellement avec (a). Rien n'est appliqué sans l'accord de l'utilisateur.

## Arrêt levé (2026-10-03) — critère AC2-11 en échec deux fois
- **Levé par l'utilisateur** : correction renforcée acceptée (D-48), appliquée et passée (`docs/reports/P2-smoke-politique.log`).
- Contrôle concerné : `smoke:politique`, « raisons d'un membre » (fiche « pourquoi ? » d'un vote au Cabinet). Sortie réelle : `docs/reports/P2-smoke-politique.log` (27 contrôles OK, 1 KO).
- 1er passage : 2 KO (≥ 10 billes attendues alors que le Cabinet compte 8 votants ; survol d'un total au lieu d'un score). Test corrigé (commit 8eb61b1).
- 2e passage : 1 KO, « raisons d'un membre : 1 facteurs ».
- Diagnostic (non corrigé) : le premier membre lu est Dot Pixis, dont le vote n'a qu'un facteur non nul (intérêt d'organisation −0,2). La fiche masque volontairement la base nulle, donc une ligne est l'affichage correct. Le seuil « ≥ 2 facteurs » du test est faux pour ce membre ; le calcul et l'interface sont justes (vérifié hors navigateur : 2 à 4 facteurs selon le membre).
- Correction proposée : exiger ≥ 1 ligne et que la somme des lignes égale le score affiché, ou lire le membre qui a le plus de facteurs.
- Tout le reste de P2 est fait. Restent T2.10 (rapport `docs/reports/P2.md`) et un passage complet de `smoke:map` : le dernier passage a été coupé par ma limite de 200 s, tous ses contrôles exécutés étaient OK.

## Règle d'arrêt (mise à jour 2026-10-03)
- Arrêt pour revue utilisateur **uniquement après P4 et P8**.
- Fin des autres phases : rapport `docs/reports/Pn.md`, commit, mise à jour de ce fichier, puis phase suivante si tous les critères passent.
- Arrêts obligatoires maintenus : critère en échec deux fois ; fait de lore ambigu sans valeur `?` possible ; décision de design majeure non couverte ; commande impossible à lancer.

## Journal
- 2026-10-02 — P0 terminée (T0.1 → T0.15), rapport remis ; accord de l'utilisateur pour P1 le 2026-10-03.
- 2026-10-03 — P1 démarrée.
- 2026-10-03 — P1 terminée (T1.0 → T1.13) : tous les critères AC1-01 à AC1-17 passent ; un échec corrigé au premier passage (AC1-14, D-35).
- 2026-10-03 — P2 : T2.0 → T2.9 livrées ; arrêt obligatoire sur AC2-11 (contrôle en échec deux fois, cause dans le test).
- 2026-10-04 — AC2-11 révisé (D-48, accord de l'utilisateur) ; ville-usine : localisation ?, rattachement A (D-49, règle R7).
- 2026-10-04 — smoke:map : 1 échec (rapport canon du navigateur > 10 s), corrigé à la source ; passage complet OK → P1 validée.
- 2026-10-04 — P2 terminée : tous les critères AC2-01 à AC2-14 passent ; rapport `docs/reports/P2.md`.
- 2026-10-04 — P3 démarrée : plan `docs/phases/P3.md`.
- 2026-10-04 — P3 terminée : AC3-01 à AC3-15 passent (AC3-07, AC3-11 et AC3-15 au 2e passage) ; rapport `docs/reports/P3.md`.
- 2026-10-04 — P4 démarrée : plan `docs/phases/P4.md`.
- 2026-10-04 — P4 : T4.1 → T4.11 livrées ; erreur de procédure en T4.8 (commit 1d617bd poussé avec verify en échec, corrigé par 78276db ; garde-fou ajouté).
- 2026-10-04 — P4 terminée : AC4-01 à AC4-14 passent (AC4-09 navigateur au 2e passage) ; rapport `docs/reports/P4.md` ; **arrêt pour revue**.
- 2026-10-04 — Revue de P4 : validée par l'utilisateur ; correctifs D-62 et D-63 ; réalisme R-gaz KO (décision ouverte) ; R-nuit OK après correction du déploiement de nuit.
- 2026-10-04 — P5 démarrée : plan `docs/phases/P5.md`.
- 2026-10-04 — P5 : T5.0 → T5.8 livrées (données, état v6, moteurs, interfaces) ; **arrêt obligatoire** : `smoke:p5` en échec deux fois (1 : test ; 2 : défaut réel de fermeture du dossier suivant) ; correction proposée.
- 2026-10-04 — P5 terminée : AC5-01 à AC5-14 passent (AC5-02, AC5-14 au 2e passage ; AC5-03/AC5-10 après l'arrêt levé) ; rapport `docs/reports/P5.md`.
- 2026-10-04 — P6 démarrée : plan `docs/phases/P6.md`.

## Phase MAP (branche `claude/v2-map`, PR brouillon n° 2, nuit du 2026-10-07)
- Fait : MAP.1 à MAP.7 (terrain figé `data/map/terrain/paradis.json`, polygones et voisinage identiques aux données,
  rendu Pixi réaliste, infobulle, pions, image fine en worker). Rapport : `docs/reports/MAP.md`.
- Nuit : frontières sinueuses, noms de murs hors des pions, noms de lieux hors des bandes de murs et entiers à l'écran,
  noms de segments écrits dans leur mur (test `tests/map/labels.test.ts`), champs adoucis, calques à 0,64.
- Dernier verify (2026-10-08, ~00:30 UTC) : 509/510, seul échec CR1e-05 (arrêt R1e, hors MAP) ; suite de la chaîne code 0 (`MAP-verify*.log`).
- smoke:map OK ; `map:terrain -- --check` reproduit l'empreinte ; 12 captures 1366×768 et 4K lues.
- Prochaine étape : revue de la carte par l'utilisateur (arrêt de revue de fin de MAP, fichier 22 §4) ; ne pas fusionner sans accord.
- UX0 : PR n° 1 fusionnée (verify sur la branche fusionnée : seul CR1e-05 en échec ; R1b 3D seuls : 21/21).
