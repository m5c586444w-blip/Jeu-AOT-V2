# Plan de fonctionnalités — refonte (VALIDÉ par Gabriel le 2026-10-13, soir)

> Ligne éditoriale : **réalisme, fidélité au lore, jouabilité.** Mécaniques : `docs/spec/26_MECANIQUES_THEORIQUES.md` (validé le 2026-10-13). Multijoueur : `docs/spec/27_MULTIJOUEUR_9_JOUEURS.md` (à confirmer).
> Statut : plan **validé** par Gabriel « du moment que tout répond à mes attentes, toutes les villes et endroits créés et jouables » → ajout des chantiers **C15 à C18** (lieux). Multijoueur : **coopération** confirmée (spec 27), C13 débloqué après C3 et C9. Pas de mode « Simulation de bataille » dans le menu (décision définitive). Les plafonds de tours sont des estimations `[A]`.
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
| **C13** [A] | **Multijoueur réseau (27)** : conseil mixte, camps rivaux, trahison | 1 à 9 joueurs ; choix du camp selon le scénario (845 : Paradis ou Marley, plus de camps ensuite) avec limites d'équilibre ; conseil mixte joueurs + conseillers IA ; en bataille chacun dirige ses groupes, formations, escouades, et commande ses Titans jusqu'à l'époque charnière ≈ saison 4 ; trahison possible (coffre de secrets de l'hôte) | voir 27 §9 ; 9 clients headless, 10 min, 0 désynchronisation sur 10 graines ; reconnexion en bataille sans rupture d'empreinte ; `sim:balance` : aucun camp > 60 % de victoires sur 200 parties IA par scénario ; test : un secret de traître ne figure pas dans l'état partagé ; **D-168** : à ≥ 2 sièges humains par faction, `owner` explicite obligatoire sur toute entité commandable, démarrage refusé sinon (test) | C3, C9 | 350 |
| **C14** [A→B] | Anciennes phases P9 / P10 / PACK recadrées | Scénarios (factions jouables par scénario), IA, équilibrage, finitions, exécutable Windows | selon `docs/spec/18` §9–10 et 23 §6, **réécrits sur la base de la refonte** | C5–C9, C13, C15–C18 | 200 |
| **C15** [B] | **Lieux : mur Rose** (ex-LC-B) | Trost, Karanes, Utopia, Krolva, camp d'entraînement, quartier général : visibles, praticables, jouables depuis la carte | `npm run places:valider` code 0 ; `npm run smoke:r1b -- tout` code 0 ; captures relues | C1 | 250 |
| **C16** [B] | **Lieux : mur Sina** (ex-LC-C) | Mitras (capitale, château royal, cathédrale), Stohess, Orvud, Ehrmich, Yarckel, ville souterraine, chapelle Reiss | idem C15 | C15 | 250 |
| **C17** [B] | **Lieux : hors-murs** (ex-LC-D) | forêt des Arbres Géants, château d'Utgard, Ragako, Dauper, Jinae, ferme/campagne, fort du front, Wall Maria complet (mur et portes) | idem C15 | C15 | 250 |
| **C18** [B→A] | **Lieux : Marley, Hizuru, Alliés et couverture complète de l'atlas (06)** | Liberio, ports et villes de Marley, Hizuru, forces alliées ; toute province de l'atlas a un lieu jouable (fait main pour les lieux principaux, généré puis figé pour les lieux courants) | `places:valider` étendu : échoue si une province de l'atlas n'a pas de lieu jouable ; captures relues ; revue indépendante | C16, C17 | 300 |

## Règles propres à la refonte
1. **`src/sim` peut être modifié** par C3 à C8 (et C13 pour les prérequis). Les huit empreintes de référence changeront : chaque changement d'empreinte est **délibéré**, consigné dans `DECISIONS.md` avec sa raison, et le test de rejeu (C3) reste vert. `src/sim` reste pur : pas de DOM, pas de Pixi, pas de `Math.random`, pas de `Date.now`, pas de `any`.
2. **Un pilier = un module + des tests de signature** (la propriété qui rend le mécanisme unique doit être vérifiable par un test, pas seulement affichée).
3. **Pas d'écran sans donnée réelle** : un écran qui affiche 0 ou un texte répété pour une valeur non branchée est un défaut (critère visuel de `CLAUDE.md`).
4. **Données dans `/data`**, paramétrables ; toute valeur d'équilibre `[A]` est placée dans un fichier de données, pas dans le code.
5. **Pas d'entrée de menu « Simulation de bataille »** (décision définitive de Gabriel) ; la bataille se joue depuis la campagne.
5 bis. **Tout lieu de l'atlas est jouable** : les lieux principaux sont faits à la main (`data/places/<id>.json`), les lieux courants générés une fois puis figés ; un lieu non fait est une dette bloquante pour C18, pas un détail.
6. **Mesures de performance** : jamais « OK » sur du rendu logiciel pour une cible GPU ; on écrit « à vérifier sur le PC de Gabriel ».
7. **Coupes** : voir `PROTOCOLE.md` §8.

## Calendrier réaliste (estimation `[A]`, non mesurée)
- **B n'existe que mercredi 14, jeudi 15 et vendredi 16 octobre** (compte de Gabriel limité jusqu'au vendredi) : trois fenêtres de 8 h. Voie de B pendant ces trois jours, dans cet ordre : **C1 → C2 → C10 (outillage puis uniformes) → C15 → C11**. Le dernier jour, B termine par une clôture complète et une note de passage détaillée à A.
- **A** travaille toutes les nuits (00:00–08:00) ; après vendredi, **seule A** avance (voir `BUDGET.md`).
- Somme des plafonds : ≈ 3 300 tours. Rythme observé du 8 au 13 octobre : ≈ 1 750 tours (`docs/MORNING.md`). Ordre de grandeur : **plusieurs semaines**, pas quelques jours ; le jalon « tout fini jeudi » n'est **pas atteignable** et n'est pas visé. Jalon réaliste de jeudi soir : C0, C1, C2, C3 faits, outillage Blender et premiers uniformes, début de C4 et de C15.

## Jalons de revue indépendante (sous-agent distinct, verdict écrit)
Fin de C1 · fin de C4 · fin de C5 · fin de C9 · fin de C10 · fin de C13 · fin de C18 · avant C14.
