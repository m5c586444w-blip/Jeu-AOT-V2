# PROGRESSION

| Champ | Valeur |
|---|---|
| Phase | P4 — Combat tactique v1 : **terminée** ; **ARRÊT OBLIGATOIRE de revue** |
| Tâche | T4.11 — rapport `docs/reports/P4.md` (fait) |
| Dernier `npm run verify` | 2026-10-04 (fin de P4) : code 0, 195 tests — `docs/reports/P4-verify.log` |
| Prochaine étape | **Attendre la revue de l'utilisateur** (rapport P4, captures `docs/screenshots/p4-*`, points en fin de rapport). Ne pas démarrer P5 sans son accord. |

## ARRÊT EN COURS (2026-10-04) — revue de fin de P4 (règle : arrêts de revue après P4 et P8)
- Raison : fin de P4, revue obligatoire de l'utilisateur (fichier 14 §7).
- État : AC4-01 à AC4-14 passent. AC4-09 (partie navigateur) est passé au 2e passage ; 1er passage KO à 17,8 ms, conservé dans `docs/reports/P4-smoke-tactique-essai1-KO.log` (D-61).
- Non vérifiable ici : 60 FPS réels sur GPU (D-59), à confirmer par l'utilisateur.
- Questions posées en fin de `docs/reports/P4.md` :
  - performance sur son GPU ;
  - ressenti et échelle du combat ;
  - faiblesses visuelles à corriger maintenant ou plus tard.

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
