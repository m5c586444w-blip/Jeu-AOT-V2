# Phase PA — armées sur la carte, artillerie (Paradis et Marley), marine hors Paradis, succession

Sources : fichier 21 §7 (PA.1 à PA.9, CPA-01 à 10), amendement 23 §3.2, attentes 24 §2.1 ; lore : ERRATA > 11 > 01 > 02/03 > 10/12/13.
Branche `claude/v2-pa` (depuis `5cc4b66`). Plafond : 200 tours. `src/sim` et `data/` : ajouts seulement, déterministes, testés.

## PA.1 — Audit de l'existant (lecture du code, 2026-10-08)
| Domaine | Ce qui existe | Ce qui manque |
|---|---|---|
| Déplacements sur l'île | Expéditions du Corps (P3) : plan, itinéraire sur le graphe `data/geo` (km, portes obligatoires `crossingProblem`), vivres, gaz, chevaux, fatigue implicite, retour ; convois et dépôts ; pions de garnison fixes (MAP.6, emplacement `pawn` par province) | aucune **armée** : pas de pile avec général, effectif, moral, ravitaillement ; pas d'ordre de marche, de marche forcée, de fusion ou division, de retraite ; pas de relève de garnison |
| Rencontres | Expédition ↔ Titans : détection, évitement, engagement auto-résolu ou joué (P4, `ResolveBattle`) | aucune interception ni contact entre armées ; pas de choix « tactique ou rapide » hors expédition |
| Monde (P7) | `nations` : formations par province du monde (vitesse, rail), flottes (`form_cuirasses`, `form_croiseurs`, `form_transports`, Alliés, Hizuru), maîtrise des mers, blocus, embarquement et débarquement, front hebdomadaire, IA d'utilité avec journal | Paradis y est une seule province (`wprov_paradis`) : aucune flotte ni débarquement **sur les côtes de l'île** ; aucune zone maritime autour de l'île |
| Artillerie | Formations agrégées `form_artillerie` (Marley) et `form_canons_mur` (Paradis) au front du monde (multiplicateur) ; technologies `tech_wall_artillery` [C], `tech_mobile_cannon` [?], `tech_wall_artillery_network` [A], `tech_heavy_artillery` [A] ; réserve de poudre (`powder`) | aucune pièce ni munition en données (portée, cadence, dispersion, moral, entretien) ; aucune batterie dans la bataille tactique ; pas de contre-batterie ni de tir de barrage ; pas de siège |
| Lances foudroyantes | `thunderSpears` dans la bataille ; techs T-ANT-08/09 verrouillées par événement (fin 850, fichier 11) | rien dans les armées (unité U-P07 absente) |
| Brouillard | voile des provinces inexplorées (MAP) ; renseignement (P5) | portée de vue des armées ; ennemis cachés hors vue |
| Succession | `characterDies` : deuil, légitimité selon la notoriété, postes vacants → nominations ; le joueur (Zackly) exclu des listes | **rien** à la mort du chef (joueur) ni d'un général : pas de crise, de prétendants, de légitimité contestée → **PA.10** |
| Rythme | horloge temps réel, vitesses, pause ; pause automatique sur les alertes `pause: true` | alertes de contact, de débarquement et de succession |

## Ce que PA ajoute (tâches)
- **PA.2 Armées** (`src/sim/armies/`, couche `armies` facultative de l'état) : pile de régiments + un général (personnage ou titre générique), insigne,
  effectif, moral, ravitaillement, fatigue ; ordres journalisés (`ArmyMove`, `ArmyForcedMarch`, `ArmyMerge`, `ArmySplit`, `ArmyHalt`,
  `ArmyRetreat`, `ArmyGarrison`, `ArmyIntercept`, `ResolveEncounter`, `RaiseArmies`) ; trajet par le graphe (portes), vitesse selon terrain,
  vivres, gaz et poudre puisés dans les stocks en territoire tenu ; attrition des Titans hors des murs ; portée de vue ; interception sur une arête
  et contact dans une province → rencontre (pause automatique) résolue en bataille tactique ou par le calcul rapide ; retraite.
  **Marine** : zones maritimes autour de l'île, flottes de Marley, des Alliés et d'Hizuru seulement (aucune pour Paradis), escorte, blocus d'une
  côte, débarquement (menace jouable contre Paradis ; Marley jouable en 854).
- **PA.3 / PA.4 Artillerie** (`data/artillery/`) : Paradis (rempart [C], rail de Trost [C], campagne et mortier [?] paramétrables, boulets,
  mitraille, chaînes [?]) ; Marley (campagne, lourde, obusiers, côtière, navale des cuirassés et croiseurs ; obus, shrapnel, perforants) ; portée,
  cadence, dispersion, souffle, moral, entretien, munitions ; siège (usure des murs, barrage), contre-batterie. Aucune arme avant sa date.
- **PA.5 Bataille** : batteries dans `BattleSetup` (facultatif : les batailles existantes gardent leur hash), tir indirect avec dispersion, zone de
  danger, effets sur Titans (membres, ralentissement) et soldats (morts, stress), contre-batterie ; deux modèles simples par camp dans la scène.
- **PA.6 Données** : Zod, `canon` sur chaque entrée, `data:validate` ; règle `canon:check` « aucune arme anachronique ».
- **PA.7 IA** : armées de Paradis (couvrir les menaces, relever, intercepter) et de Marley (débarquer, marcher, assiéger), journal de raisonnement.
- **PA.8 Interface** : pions d'armées (insigne, effectif, moral, ravitaillement), trajet, ordre de mouvement au clic, liste des armées en marche,
  alerte de rencontre (choix), fiche d'artillerie ; style UI (`tokens.css`, `kit.ts`), aucune mention interne.
- **PA.9 Tests** : déterminisme (graine + commandes = hash), invasion amphibie jouable, siège avec artillerie ; `smoke:pa` et captures.
- **PA.10 Succession** : mort du chef ou d'un général clé → crise (prétendants classés par légitimité, délai, légitimité et stabilité
  touchées, loyauté des organisations), choix du successeur (`ChooseSuccessor`) ; armée sans général → commandement intérimaire.

## Critères d'acceptation
| Id | Critère | Commande |
|---|---|---|
| CPA-01 | verify code 0 | `timeout 1500 npm run verify` |
| CPA-02 | sim:selftest code 0 (direct = worker, armées comprises) | `npm run sim:selftest` |
| CPA-03 | canon:check code 0 ; aucune arme anachronique (règle R13) | `npm run canon:check` ; `npx vitest run tests/sim/artillery.test.ts` |
| CPA-04 | un ordre terrestre et un maritime fonctionnent | `npm run smoke:pa` ; `npx vitest run tests/sim/armies.test.ts` |
| CPA-05 | interception et rencontre (tactique ou rapide) | `npx vitest run tests/sim/armies.test.ts` ; `smoke:pa` |
| CPA-06 | artillerie des deux camps en bataille | `npx vitest run tests/sim/artillery.test.ts` ; capture de bataille |
| CPA-07 | IA des deux camps emploie déplacements et artillerie | `npx vitest run tests/sim/armies-ai.test.ts` |
| CPA-08 | données validées | `npm run data:validate` |
| CPA-09 | déterminisme (même graine + mêmes commandes = même hash) ; anciennes sauvegardes chargées | `tests/sim/armies.test.ts`, `tests/save` |
| CPA-10 | captures (≤ 12) lues une à une | `docs/reports/PA.md` § captures |

## Hors-périmètre
Combat tactique homme contre homme complet (R2+ : les armées humaines y figurent par leurs batteries et leurs Titans) ; refonte de la carte ou de
l'interface ; nouveau menu ; audio ; flotte jouable pour Paradis (interdite) ; modèles 3D détaillés des canons ; sous-phase ; nouvel outil de mesure.
