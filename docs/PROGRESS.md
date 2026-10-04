# PROGRESSION

| Champ | Valeur |
|---|---|
| Phase | **P5 terminée** → P6 — Titans-porteurs et héritage (mode autonome borné jusqu'à P8) |
| Tâche | T6.1 (données, R11) et T6.2 (état v7, horloge, héritage, visions) faites → T6.3 combat des porteurs |
| Dernier `npm run verify` | 2026-10-04 (T6.2, commit 208d533) : code 0, 245 tests |
| Prochaine étape | T6.3 — unité porteur en bataille, 9 capacités, lances de foudre ; **arrêt de revue après P8** |

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

## Décision ouverte, pour la revue de P8 — R-gaz (D-62)
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
