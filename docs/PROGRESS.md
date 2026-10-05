# PROGRESSION

| Champ | Valeur |
|---|---|
| Phase | **R0 — corrections après la revue de P8** — **ARRÊT** (CLAUDE.md, arrêt 1 : critère f en échec deux fois) : en attente de l'utilisateur |
| Tâche | R0.4 — batterie finale et rapport (rapport `docs/reports/R0.md` non rédigé) |
| Dernier `npm run verify` | 2026-10-05 : code 0, 306 tests (commit 0333fc2) |
| Prochaine étape | Décision de l'utilisateur sur le correctif proposé ci-dessous, puis rapport R0 |

## Arrêt (2026-10-05) — R0.2f (transformation visible) en échec pour la 3e fois
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
