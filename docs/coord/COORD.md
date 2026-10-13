# COORD — tableau de coordination A ↔ B

> Écrit **uniquement par la session qui détient le verrou** (`LOCK.json`). Protocole : `PROTOCOLE.md`. Plan détaillé : `PLAN_FONCTIONNALITES.md`.
> Statuts : `à faire` · `en cours` · `à revoir` (code fini, revue indépendante à faire) · `fait` · `bloqué` (raison obligatoire).

## 1. Tableau des chantiers

| ID | Chantier | Statut | Dernière session | Branche / commit | Dépend de | Note courte |
|---|---|---|---|---|---|---|
| C0 | Audit sans code de jeu | à faire | — | tronc | — | à lancer en premier (A) |
| C1 | Cadre d'interface unique + `smoke:cadre` | à faire | — | tronc | — | bug : barre absente en bataille |
| C2 | Création de lore, emblèmes (licorne…), `canon:check` adapté | à faire | — | tronc | — | `A` + `creation: true` |
| C3 | Prérequis neutres multijoueur (rejeu, commandes, `owner`) | à faire | — | tronc | — | |
| C4 | P3 Gaz/Ancrage + P4 Signal | à faire | — | tronc | C3 | |
| C5 | P2 Marée + moteur de rencontres (§3 bis), Marley–Paradis | à faire | — | tronc | C4 | |
| C6 | P1 Le Mur | à faire | — | tronc | C3 | |
| C7 | P5 L'Horloge | à faire | — | tronc | C3 | |
| C8 | P6 Vérité + P7 Registre | à faire | — | tronc | C5 | |
| C9 | Intégration : piles, bataille jouable de bout en bout | à faire | — | tronc | C1, C4, C5 | |
| C10 | Blender : outillage + lot 1 | à faire | — | tronc | C2 | `assets:blender` |
| C11 | Illustrations (STYLE, DEMANDES, évaluation) | à faire | — | tronc | C2 | voie 1 par défaut |
| C12 | Blender : lot 2 (Titans, bateaux, dirigeables) | à faire | — | tronc | C10 | coupable en premier |
| C13 | Multijoueur réseau (27) | **bloqué** | — | — | confirmation de Gabriel | ne pas commencer |
| C14 | P9 / P10 / PACK recadrés | à faire | — | tronc | C5–C9 | ancienne feuille de route gelée |

Ordre conseillé la première semaine : **A** : C0 → C3 → C4 → C6 ; **B** : C1 → C2 → C10 (outillage) → C11 (STYLE, DEMANDES). Chaque session prend la première tâche libre selon `PROTOCOLE.md` §5.

## 2. Boîte de passage (la plus récente en haut ; une entrée par clôture)

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
| Q11 | Mode « Simulation de bataille » dans le menu principal | non implémenté |
| Q12 | Ordre de mise en œuvre (26 §11) | ordre du §1 |
| MJ | Multijoueur (27 §10 : modes, agenda caché, pause, anti-triche, connexion, PC le plus faible, IA sur sièges vides) | prérequis neutres seulement |
| ACC | Même compte ou deux comptes ; jour de remise à zéro hebdomadaire | `BUDGET.md` avec valeurs provisoires |
| NET | Domaines de Perchance à autoriser dans le réseau du cloud (voie 2 des illustrations) | voie 1 (Gabriel génère) puis voie 3 (rendus Blender) |
