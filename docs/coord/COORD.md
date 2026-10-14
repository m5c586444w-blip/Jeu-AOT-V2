# COORD — tableau de coordination A ↔ B

> Écrit **uniquement par la session qui détient le verrou** (`LOCK.json`). Protocole : `PROTOCOLE.md`. Plan détaillé : `PLAN_FONCTIONNALITES.md`.
> Statuts : `à faire` · `en cours` · `à revoir` (code fini, revue indépendante à faire) · `fait` · `bloqué` (raison obligatoire).

## 1. Tableau des chantiers

| ID | Chantier | Statut | Dernière session | Branche / commit | Dépend de | Note courte |
|---|---|---|---|---|---|---|
| C0 | Audit sans code de jeu | fait | A 2026-10-14 | tronc | — | à lancer en premier (A) |
| C1 | Cadre d'interface unique + `smoke:cadre` | à faire | — | tronc | — | bug : barre absente en bataille |
| C2 | Création de lore, emblèmes (licorne…), `canon:check` adapté | à faire | — | tronc | — | `A` + `creation: true` |
| C3 | Prérequis neutres multijoueur (rejeu, commandes, `owner`) | fait (socle) | A 2026-10-14 | tronc | — | |
| C4 | P3 Gaz/Ancrage + P4 Signal | à revoir→fait (modules purs, non branchés) | A 2026-10-14 | tronc | C3 | |
| C5 | P2 Marée + moteur de rencontres (§3 bis), Marley–Paradis | fait (module pur non branché) | A 2026-10-14 | tronc | C4 | |
| C6 | P1 Le Mur | fait (module pur non branché) | A 2026-10-14 | tronc | C3 | |
| C7 | P5 L'Horloge | fait (module pur non branché) | A 2026-10-14 | tronc | C3 | |
| C8 | P6 Vérité + P7 Registre | fait (modules purs non branchés) | A 2026-10-14 | tronc | C5 | |
| C9 | Intégration : piles, bataille jouable de bout en bout | en cours (C9.1 mur branché) | A 2026-10-14 | tronc | C1, C4, C5 | |
| C10 | Blender : outillage + lot 1 | à faire | — | tronc | C2 | `assets:blender` |
| C11 | Illustrations (STYLE, DEMANDES, évaluation) | à faire | — | tronc | C2 | voie 1 par défaut |
| C12 | Blender : lot 2 (Titans, bateaux, dirigeables) | à faire | — | tronc | C10 | coupable en premier |
| C13 | Multijoueur réseau (27) : conseil mixte, camps, trahison | à faire | — | tronc | C3, C9 | débloqué ; camps + trahison confirmés |
| C14 | P9 / P10 / PACK recadrés | à faire | — | tronc | C5–C9, C13, C15–C18 | ancienne feuille de route gelée |
| C15 | Lieux : mur Rose (ex-LC-B) | à faire | — | tronc | C1 | voie B |
| C16 | Lieux : mur Sina (ex-LC-C) | à faire | — | tronc | C15 | voie B |
| C17 | Lieux : hors-murs (ex-LC-D) | à faire | — | tronc | C15 | voie B |
| C18 | Lieux : Marley, Hizuru, Alliés, couverture de l'atlas | à faire | — | tronc | C16, C17 | « tout lieu jouable » |

Ordre conseillé : **A** : C0 → C3 → C4 → C6 → C5 … ; **B** (mercredi 14 → vendredi 16 seulement) : C1 → C2 → C10 (outillage, uniformes) → C15 → C11. Après vendredi, A reprend aussi les chantiers de la voie B. Chaque session prend la première tâche libre selon `PROTOCOLE.md` §5.

## 2. Boîte de passage (la plus récente en haut ; une entrée par clôture)

### [2026-10-14, nuit] A → B
- C0 fait (`docs/reports/C0-audit.md`, dette n° 71-80). verify de départ code 0, 728 tests. Bug cadre confirmé : `.bataille` fixed z-index recouvre le HUD (`screen.css:705`) → C1 pour B.
- A enchaîne sur **C3** (owner/siège, commandes sérialisables, rejeu) : fichiers `src/sim/armies`, `src/sim/tactical`. B ne touche pas à ces dossiers.
- C3 partiel commité (D-157) : `src/sim/core/seat.ts`, `src/sim/commands/`, `src/sim/knowledge/`, tests de rejeu. Reste : owner provinces/institutions, UI sur enveloppes, revue indépendante.
- C3 socle terminé et revu (`docs/reports/C3.md`, verify EXIT=0, 753 tests). Dette 81-84 = suite de C3/C13.
- C4 : `src/sim/gas/`, `src/sim/signal/` livrés (D-158, D-159), revue ACCEPTÉ AVEC RÉSERVES (dette 85-88), verify EXIT=0 794 tests. Branchement bataille/tick = C9.
- C6 : `src/sim/wall/` (D-160), revue ACCEPTÉ AVEC RÉSERVES, défauts 1-3,6,7 corrigés, reste dette 89-91 ; verify EXIT=0, 822 tests.
- C7 : `src/sim/clock/` livré (D-161), revue ACCEPTÉ AVEC RÉSERVES, correctifs appliqués, verify EXIT=0 889 tests, dette 92.
- C5 : `src/sim/tide/` livré (D-162), revue ACCEPTÉ AVEC RÉSERVES, correctifs appliqués, verify EXIT=0 963 tests, dette 93.
- C8 : `src/sim/truth/` (D-163) et `src/sim/registry/` (D-164) livrés, revue ACCEPTÉ AVEC RÉSERVES, correctifs appliqués, verify EXIT=0 1244 tests, dette 94.
- Les 7 piliers existent en modules purs NON branchés (gas, signal, wall, clock, tide, truth, registry) : le branchement = C9.
- C9.1 fait : P1 Mur branché derrière `GameState.pillars?.wall` + `EnableWall` (D-165), désactivé par défaut, empreintes inchangées, verify EXIT=0 1248 tests. Ordre suivant (docs/phases/C9.md) : registry, clock, truth, gas, signal, tide. Note : verify peut dépasser 11 min.
- PROCHAINE ACTION EXACTE (A) : C9.2 (registry) puis suite ; (ancien libellé) C9 (intégration) — `docs/phases/C9.md`, d'abord un `GameState.pillars?` optionnel + branchement tick pilier par pilier (un commit par pilier, empreintes changées justifiées en DECISIONS.md, test de rejeu vert). B : C1 (cadre d'interface) indépendant.

### [2026-10-13, soir] Direction (réponses de Gabriel) → A et B
- **Décisions** : plan **validé** ; **toutes les villes et tous les endroits doivent être créés et jouables** (C15 à C18 ajoutés) ; pas de mode « Simulation de bataille » dans le menu ; multijoueur = **coopération** (conseil mixte joueurs + conseillers IA, chaque joueur dirige ses groupes/formations/escouades en bataille) : voir `docs/spec/27` §10 ; **deux comptes distincts** (A = compte de la direction, limite hebdomadaire remise à zéro le **mardi** ; B = autre compte, disponible **jusqu'au vendredi 16 octobre inclus**).
- **Pour B** : trois fenêtres seulement (mercredi, jeudi, vendredi). Vendredi : clôture complète, note de passage détaillée pour A ; aucun chantier laissé « en cours » sans état exact. Ne pas viser « tout fini jeudi » : le plan n'est pas atteignable en trois jours (voir `PLAN_FONCTIONNALITES.md`).
- **Pour A** : après vendredi, vous reprenez seule la voie B (interface, assets, lieux, Blender, illustrations).
- **Compléments (2ᵉ message du soir)** : plafond de B levé (**100 %**, utilisation maximale) → mettre la note de passage à jour à **chaque fin de tâche** ; multijoueur : **choix du camp** (845 : Paradis ou Marley, plus de camps pour les scénarios tardifs, limites d'équilibre), **Titans commandés directement par leurs joueurs jusqu'à ≈ saison 4** (`[?]`), puis infanterie, et **trahison** possible (27 §4.2 à 4.4). Les réglages de pause, anti-triche, connexion et PC le plus faible ne changent pas.
- **Réseau** : Gabriel accepte d'ajouter les domaines de Perchance à la liste réseau de l'environnement (action de sa part) ; tant qu'un accès normal n'est pas constaté dans une session, voie 1 (il génère) ou voie 3 (Blender).


### [2026-10-13] Direction (conversation de Gabriel) → A et B — initialisation
- **État du dépôt** : tronc `claude/attack-on-titan-strategy-game-4ukom6`, R3 fusionnée, `verify` code 0, 719 tests (voir `PROGRESS.md`). P9 était la suite prévue : **elle est recadrée en C14**, ne pas la lancer telle quelle.
- **Nouvelles règles** : `docs/spec/ERRATA_V3.md` (création de lore autorisée, Blender, illustrations, arrêts révisés) et `docs/spec/26`, `27`. `CLAUDE.md` a été réécrit en conséquence.
- **PROCHAINE ACTION EXACTE (A, première nuit)** : `npm ci` ; `npm run verify` (coller la sortie) ; `npm run coord -- verrou prendre A "C0 audit"` ; écrire `docs/phases/C0.md` puis `docs/reports/C0-audit.md`.
- **Constat de départ à vérifier (pas à croire)** : en bataille, la barre supérieure et le menu de gestion de la carte sont remplacés par un en-tête propre à la bataille ; la bataille n'est atteignable que par Expéditions → essai ; rendu logiciel seulement (pas de GPU en session).
- **Points en attente de Gabriel (ne pas bloquer dessus)** : Q11 (mode « Simulation de bataille » depuis le menu) et Q12 (ordre de mise en œuvre) → ne pas ajouter l'entrée de menu ; suivre le tableau ci-dessus. Multijoueur (27 §10) → seulement les prérequis neutres (C3). Compte A/B et jour de remise à zéro : voir `BUDGET.md`.
- **Mesures GPU** de R2+ et R3 sur le PC de Gabriel (RTX 3050) : toujours à faire par lui (dettes n° 49 et 61) ; écrire « à vérifier » partout où l'on en dépend.

## 3. Questions de session à session (réponse attendue dans la boîte de passage suivante)
_(vide)_

## 4. Décisions en attente de Gabriel (reprises dans `MORNING.md`)
| # | Sujet | Défaut appliqué en attendant |
|---|---|---|
| MJ-a | Règle de pause, anti-triche, mode de connexion, PC le plus faible (27 §10 points 3 à 6) | défauts `[A]` du fichier 27 |
| NET | Ajouter `perchance.org`, `*.perchance.org` et `user.uploads.dev` (hébergement des images) au réseau de l'environnement (action de Gabriel) | voie 1 puis voie 3 tant que non fait |
| TIME | Après vendredi, ajouter une fenêtre à A (08:00–16:00) ? | non : A seule, de nuit |
