# Plan de fonctionnalités — refonte (PROPOSÉ, en attente de validation de Gabriel)

> Ligne éditoriale : **réalisme, fidélité au lore, jouabilité.** Mécaniques : `docs/spec/26_MECANIQUES_THEORIQUES.md` (validé le 2026-10-13). Multijoueur : `docs/spec/27_MULTIJOUEUR_9_JOUEURS.md` (à confirmer).
> Statut : les chantiers C0 à C12 reposent sur des documents validés ou sont des corrections ; **C13 (multijoueur réseau) reste bloqué** jusqu'à confirmation. Les plafonds de tours sont des estimations `[A]`.
> Chaque chantier commence par `docs/phases/<ID>.md` (tâches, critères d'acceptation avec commandes, hors-périmètre) et finit par `docs/reports/<ID>.md` (≤ 150 lignes, sorties réelles collées, captures relues).

## Constat de départ (audit du 2026-10-13, 1366 × 768, rendu logiciel)
- Le cadre d'interface (barre supérieure, menu de gestion) existe sur la carte, **disparaît en bataille**. → C1.
- La bataille en temps réel existe (400 unités, ordres, artillerie, caméra) mais **n'est joignable que par Expéditions → essai** ; le décor et les unités sont rudimentaires ; les Titans ne sont pas dérangeants (dette n° 69). → C9, C10, C12.
- Les systèmes de la simulation sont ceux de l'ancien plan (stratégique, tactique, expéditions) : **aucun des sept piliers de 26 n'existe encore** sous cette forme. → C4 à C8.
- 719 tests verts et `verify` code 0 : la base est saine, la refonte se fait **par-dessus**, en gardant les tests.

## Chantiers (ordre de priorité, voie conseillée entre crochets)

| ID | Chantier | Ce que le joueur voit à la fin | Critères d'acceptation (commandes) | Dép. | Plafond |
|---|---|---|---|---|---|
| **C0** [A] | Audit, sans code de jeu | Un état des lieux honnête : par pilier ce qui existe / manque / coût ; la bataille est-elle jouable de bout en bout ; liste de bugs | `docs/reports/C0-audit.md` (≤ 150 l.) ; chaque affirmation cite un fichier ou une sortie de commande ; bugs reproductibles listés dans `docs/reports/dette.md` | — | 40 |
| **C1** [B] | **Cadre d'interface unique** | Barre supérieure, alertes, menu de gestion, fil de notifications présents en carte, conseil, bataille, lieux, tutoriel, options (réductible par bouton, jamais perdu) | `npm run smoke:cadre` (à créer) code 0 en 1366 × 768 **et** 3840 × 2160, captures relues par sous-agent distinct ; `npm run verify` | — | 80 |
| **C2** [B] | Création de lore et emblèmes | Insignes dessinés par le projet (licorne de la Police militaire, ailes, Garnison, Corps d'entraînement, Marley…) ; mode auteur montre `A` | `npm run canon:check` accepte les créations `A` et rejette toute contradiction d'un fait `C` (tests dans `tests/`) ; `docs/lore/creations.md` ; `data/emblems/*.json` rendus en SVG | — | 60 |
| **C3** [A] | Prérequis neutres du multijoueur | Aucun changement visible ; la partie est rejouable à l'identique | test de rejeu (même journal → même empreinte, 3 exécutions) ; toute action du joueur = commande typée sérialisable ; `owner` (siège) sur piles, escouades, provinces, institutions ; connaissance par faction | — | 80 |
| **C4** [A] | **P3 Gaz et Ancrage + P4 Signal** | Combat ODM où l'ancrage, le gaz, les lames et les signaux décident ; brouillard de commandement à 3 niveaux ; doctrine programmable | tests de signature (`tests/sim/…`) ; `npm run sim:selftest` ; `npm run sim:tactical` ; coût stratégique du gaz visible au conseil | C3 | 200 |
| **C5** [A] | **P2 La Marée + moteur de rencontres (§3 bis)** | Les rencontres naissent des piles, empreintes, renseignement, visibilité, heure : Titans, mais aussi **Marley contre Paradis sans Titan** (fusils, mitrailleuses `[?]`, mortiers, artillerie, ODM anti-personnel, couverts, suppression, moral, munitions) | test « Marley–Paradis à densité de Titans nulle » ; `npm run sim:world` ; `npm run sim:balance` | C4 | 150 |
| **C6** [A] | **P1 Le Mur** | Pression = population / capacité de vivres ; brèche, évacuation, désengorgement systémique | tests de pression/brèche/évacuation ; `npm run sim:year` ; écran « Mur » | C3 | 120 |
| **C7** [A] | **P5 L'Horloge** | Horloge de 13 ans, identité secrète des porteurs, suspicion, extraction, ordres généraux et autonomie | tests des seuils ; `npm run sim:shifters` ; écran Porteurs | C3 | 120 |
| **C8** [A] | **P6 La Vérité + P7 Le Registre** | Dossiers à fiabilité A–D, trois actes, attracteurs de canon et divergences ; registre des morts, troupe nommée (~50–80) + générée | tests ; `npm run sim:events` ; écran Dossiers / Registre | C5 | 150 |
| **C9** [A→B] | **Intégration : armées en piles, bataille jouable de bout en bout** | Carte → rencontre → bataille 3D → retour à la campagne, sans bouton caché ; piles visibles sur la carte ; sans entrée de menu « Simulation de bataille » tant que Gabriel n'a pas précisé | script de parcours `smoke:bataille` (à créer) code 0 ; `smoke:cadre` code 0 ; captures relues | C1, C4, C5 | 250 |
| **C10** [B] | **Blender : outillage + lot 1** | Tenues et équipements de toutes les institutions de Paradis et de Marley, ODM, lames, lances de foudre, fusils, canons, chariots-canons ; insignes en décalque | `npm run assets:blender` ; `npm run assets:check` ; `tests/art/models.test.ts` ; planche `?proto3d=…` relue par sous-agent | C2 | 200 |
| **C11** [B] | **Illustrations** | Portraits, événements, écrans de chargement cohérents avec `docs/art/STYLE.md` | `docs/art/illustrations/DEMANDES.md` ; manifeste ; grille d'évaluation par sous-agent ; `assets:check` étendu | C2 | 100 |
| **C12** [B] | **Blender : lot 2** | Variantes de Titans plus dérangeantes (proportions, mouvement), bateaux de Marley, dirigeables | idem C10 + budgets de triangles | C10 | 150 |
| **C13** [A] | **Multijoueur réseau (27)** — **BLOQUÉ** | 2 à 9 joueurs, IA pour les sièges vides | voir 27 §9 ; 9 clients headless, 10 min, 0 désynchronisation sur 10 graines | confirmation + C3, C9 | 300 |
| **C14** [A→B] | Anciennes phases P9 / P10 / PACK recadrées | Scénarios, IA, équilibrage, finitions, exécutable Windows | selon `docs/spec/18` §9–10 et 23 §6, **réécrits sur la base de la refonte** | C5–C9 | 200 |

## Règles propres à la refonte
1. **`src/sim` peut être modifié** par C3 à C8 (et C13 pour les prérequis). Les huit empreintes de référence changeront : chaque changement d'empreinte est **délibéré**, consigné dans `DECISIONS.md` avec sa raison, et le test de rejeu (C3) reste vert. `src/sim` reste pur : pas de DOM, pas de Pixi, pas de `Math.random`, pas de `Date.now`, pas de `any`.
2. **Un pilier = un module + des tests de signature** (la propriété qui rend le mécanisme unique doit être vérifiable par un test, pas seulement affichée).
3. **Pas d'écran sans donnée réelle** : un écran qui affiche 0 ou un texte répété pour une valeur non branchée est un défaut (critère visuel de `CLAUDE.md`).
4. **Données dans `/data`**, paramétrables ; toute valeur d'équilibre `[A]` est placée dans un fichier de données, pas dans le code.
5. **Pas d'entrée de menu « Simulation de bataille »** (Q11 en attente) ; la bataille reste accessible depuis la campagne.
6. **Mesures de performance** : jamais « OK » sur du rendu logiciel pour une cible GPU ; on écrit « à vérifier sur le PC de Gabriel ».
7. **Coupes** : voir `PROTOCOLE.md` §8.

## Jalons de revue indépendante (sous-agent distinct, verdict écrit)
Fin de C1 · fin de C4 · fin de C5 · fin de C9 · fin de C10 · avant d'ouvrir C13 · avant C14.
