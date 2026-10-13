# C0 — Audit sans code de jeu (lecture seule)

Date : 2026-10-13. Méthode : lecture de `docs/phases/C0.md`, `CLAUDE.md`, `docs/spec/26`, `docs/coord/PLAN_FONCTIONNALITES.md`, puis `grep`, `wc`, `ls` et lecture ciblée de `src/`. Aucun test, aucun `verify`, aucune capture n'a été lancé : tout ce qui suit est **lu dans le code**, pas mesuré à l'exécution. « Tour » = unité de coût du plan (§ plafonds de `PLAN_FONCTIONNALITES.md`) ; les coûts ci-dessous sont des estimations `[A]` de l'auditeur, non mesurées.

Taille : `src/sim` ≈ 14 500 lignes (`wc -l src/sim/*/*.ts`, dont `armies.ts` 1 298, `expedition.ts` 667, `shifters.ts` tactique 642) ; `src/ui/tactical/rtBattleScreen.ts` 966 lignes ; 111 fichiers `*.test.ts` (`find tests -name "*.test.ts" | wc -l`). `git diff --stat -- src data` : vide.

## 1. Piliers de la spec 26

Constat général : le code est celui de l'ancien plan (expéditions, armées en piles, tactique, politique). Aucun module nommé d'après un pilier n'existe (`ls src/sim/*` : ai, armies, characters, core, events, intel, military, missions, politics, research, shifters, strategic, tactical, world). Les greps `pression`, `densit`, `anchor`, `signal`, `heritage`, `reliab`, `divergence` trouvent des mécanismes **voisins**, cités ci-dessous.

### P1 — Le Mur (spec 26 §2)
| Existe | Manque | Coût |
|---|---|---|
| Intégrité de segment et siège : `siege.breached` quand `wall_structure < capture_below_structure` (`src/sim/armies/armies.ts:1205-1229`, alerte `alert.wall_breach`). Compteur `pressure` par province côté armées = pression d'occupation, **pas** la pression démographique (`armies.ts:1254`, `state.ts:157`). Économie par province (`src/sim/strategic/economy.ts`, 380 l.). | `pression = population / capacité_alimentaire` : aucune occurrence de « capacité alimentaire » (`grep -rEil "capacit.*alimentaire" src/sim` vide). Aucun état de district intact/brèche/abandonné/reconquis, aucune évacuation (`grep évacu` vide), aucun désengorgement systémique, aucune propagation par réfugiés, aucun écran « Mur ». | ≈ 120 (plafond C6) |

### P2 — La Marée (§3, §3 bis)
| Existe | Manque | Coût |
|---|---|---|
| Densité de Titans **par province, statique** par scénario (`src/sim/military/routes.ts:150-152`, `titanDensity`) ; taux de contact d'expédition `contactRate` (`expedition.ts:61-63`) ; attrition des armées selon la densité (`armies.ts:1038-1041`). Rencontres d'armées (`state.armies.encounters`, `armies.ts`) y compris armée contre armée sans Titan (`tests/sim/rt-campaign.test.ts:44`). | Pas de grille de cellules, pas de diffusion, pas d'attraction par le bruit, pas de repeuplement (la densité ne bouge pas avec les combats). Pas de modèle d'attention/`focus` (`grep -rn focus src/sim` vide). Pas de comportements marcheur/anormal/immobile/saturation (non vérifié dans `titans/` des données). Le moteur de rencontres général (§3 bis) n'est que partiel : rencontre = proximité de piles, sans empreinte/visibilité/heure (non vérifié en détail). | ≈ 150-200 (plafond C5) |

### P3 — Gaz et Ancrage (§4)
| Existe | Manque | Coût |
|---|---|---|
| ODM par ancrages : `pickAnchor`, `anchorPoint` (`src/sim/tactical/odm.ts:25-47`), `anchorsNear` (`map.ts`), « pas d'ODM sans ancrage » (`odm.ts:34`) ; gaz et lames dans `troops.ts`, `battle.ts`, `types.ts` ; logistique du gaz (`src/sim/military/logistics.ts`) ; artillerie (`artillery.ts`, 150 l.). | Suppression d'ancrages par destruction/incendie (non vérifié), carte d'ancrage avant bataille, cône d'ouverture/fenêtre de coupe, ponction du stock stratégique de gaz par bataille et dépôts-objectifs (à confirmer dans `logistics.ts`, non vérifié), coût de l'ODM sous le feu humain, lances de foudre comme doctrine. | ≈ 100 (C4, avec P4) |

### P4 — Le Signal (§5)
| Existe | Manque | Coût |
|---|---|---|
| Fusées rouge/vert/noir (`src/sim/military/vocabulary.ts:24`), `SignalEntry` (`military/state.ts:106`), `BattleSignal` en tactique (`tactical/types.ts:296`, `signals` l.376) ; brouillard daté du renseignement stratégique (`src/sim/intel/intel.ts:16`). | Objets signal avec rayon/météo, relais, erreurs, fantômes d'information, trois niveaux de brouillard de commandement, doctrine programmable (table de règles ; `grep doctrine` ne trouve que la doctrine du Culte, `intel.ts:339-343`, et `expedition.ts`), ordres descendant la chaîne avec délai. | ≈ 100 (C4) |

### P5 — L'Horloge (§6)
| Existe | Manque | Coût |
|---|---|---|
| Horloge de 13 ans et héritage (`src/sim/shifters/shifters.ts:16,27,37,87-136` : `yearsLeft`, `InheritanceKind`, `inheritCosts`), modèles de combat des porteurs (`src/sim/tactical/shifters.ts`, 642 l.), visions peu fiables (`intel.ts:50`). | Identité secrète et suspicion (`grep -ri suspicion src/sim` vide), démasquage, extraction, ordres généraux et autonomie (`grep autonomy|autonomie` vide), contrôle par volonté/stress/liens, arbitrage de roster pour Marley. Invariant des Neuf : non vérifié. | ≈ 120 (C7) |

### P6 — La Vérité (§7)
| Existe | Manque | Coût |
|---|---|---|
| Moteur d'événements avec `divergence` et `branch` (`src/sim/events/engine.ts:27,37-62,94,308`), chronique, rapports d'espions bruités et fiabilité de l'agent (`intel.ts:237`), anti-fuite UI (`src/ui/leaks.ts`), pré-brief avec fiabilité d'estimation (`military/plan.ts:202-214`). | Fiabilité A-D par fait et par faction, dossier de preuves avec contradictions, actes I/II/III qui changent les règles, attracteurs de canon (seul `world/ai.ts` contient « attracteur », sans rapport avec les événements). | ≈ 100 (C8) |

### P7 — Le Registre (§8)
| Existe | Manque | Coût |
|---|---|---|
| Dossier de mort, deuil des proches, deuil politique (`src/sim/politics/characters.ts:10,84-120`, `DeathRecord`), relations entre personnages (`politics/state.ts`), succession d'armée (`src/sim/armies/succession.ts`). | Troupe nommée (~50-80) + générée tracée par identifiant, mort de chaque soldat en dossier (le dossier existe pour les personnages), registre consultable avec stèle, effet sur recrutement/opinion. | ≈ 80 (C8) |

Pré-requis multijoueur (C3) : `grep -rlw "owner\|seat" src/sim` ne trouve que `world/ai.ts`, `nations.ts`, `war.ts` (pertinence non vérifiée) ; `Math.random`/`Date.now` : aucune occurrence dans `src/sim` (grep vide, pureté respectée).

## 2. La bataille est-elle jouable de bout en bout ?

**Oui pour les rencontres d'armées et les batailles de compagnie (temps réel), avec un accès caché derrière un registre ; partiel pour le reste.**

Chemin d'accès actuel (lu dans le code) :
1. La simulation crée une rencontre dans `state.armies.encounters` (`src/sim/armies/armies.ts`). `src/ui/gameScreen.ts:298-305` détecte `pendingEncounter(state)` et ouvre d'office le registre « armées » (`registers.open("armees")`).
2. `src/ui/panels/armiesPanel.ts:391-421` : section d'alerte avec trois issues : `auto`, `jouer` (affiché si `canPlay`, `src/sim/armies/armies.ts:552`), `repli`. Le bouton jouer appelle `play` (`armiesPanel.ts:424-433`) -> `ctx.playBattle(setup, ..., true, rt)`.
3. `playBattle` (`gameScreen.ts:215-229`) suspend la carte (`map.setSuspended(true)`), met `inBattle` (le temps stratégique ne s'écoule pas : `gameScreen.ts:398`) et ouvre `openRtBattleScreen` (temps réel) si `realtime`, sinon `openBattleScreen` (P4, 2D, `src/ui/tactical/battleScreen.ts`, 519 l.).
4. Fin : `rtBattleScreen.ts:771-791` : « Valider/Fermer » ou « terminer en automatique » (l'IA mène jusqu'au bout avec les ordres donnés) ; les ordres reviennent par `ResolveEncounter` avec `rt: true` (`armiesPanel.ts:432`, validé par `src/sim/core/commands.ts:137,184-187`). Rejeu : `tests/sim/rt-campaign.test.ts` (4 cas : `it(` aux lignes 44, 61, 80, 91), non exécuté ici.

Autres accès (tous via registres, jamais un bouton de carte) :
- Expéditions : `expeditionsPanel.ts:159` -> `playBattle(p.setup, title, true)` **sans** `realtime` : écran P4 2D, pas le temps réel.
- « Bataille d'essai » : `expeditionsPanel.ts:211` (2D) et `expeditionsPanel.ts:239` (compagnie, temps réel) ; essai de porteur : `shiftersPanel.ts:195` (2D). Ce sont des bacs à sable, pas une bataille de campagne.
- Le menu principal ne contient aucune entrée « Simulation de bataille » (`grep -rniE "simulation de bataille" src data` vide ; seule mention : `docs/spec/ERRATA_V3.md:71`, qui l'exclut).

Limites : (a) nécessite de savoir ouvrir le registre des armées (ouverture automatique à la rencontre seulement, `gameScreen.ts:302`) ; (b) pas de lancement depuis la carte ni retour visible sur la carte (C9) ; (c) deux écrans de bataille parallèles (`battleScreen.ts` 519 l., `rtBattleScreen.ts` 966 l.) ; (d) bilan : dettes n° 46, 48, 52, 62 de `docs/reports/dette.md`. Jouabilité réelle, performance et lisibilité : **non vérifié** (aucune exécution, aucun GPU).

## 3. Constat « la barre supérieure et le menu de gestion sont remplacés par un en-tête propre à la bataille »

**Confirmé par lecture, avec une nuance : ils ne sont pas retirés du DOM, ils sont recouverts.**

- Barre supérieure = `<header class="bandeau">` (`src/ui/hud.ts:60`) ; menu de gestion = `<nav class="gestion">` (`hud.ts:61`) ; ils sont dans la grille `.ecran` (`src/ui/styles/screen.css:5`), à `z-index: var(--z-hud)` = 10 (`screen.css:16`, `tokens.css:156`).
- La bataille crée sa propre racine `<section class="bataille bataille--rt">` (`src/ui/tactical/rtBattleScreen.ts:85`) avec son propre `<header class="bataille-tete">` (titre, chrono, vitesses, caméra, options : `rtBattleScreen.ts:91-103`), la scène, un carnet latéral `<aside>` et un pied d'escouades `<footer>` (`rtBattleScreen.ts:94-96,114-116`), attachée à `document.body` (`rtBattleScreen.ts:117`). Même schéma en 2D : `battleScreen.ts:91`.
- `screen.css:705-713` : `.bataille { position: fixed; inset: 0; z-index: calc(var(--z-fenetre) + 2) }` = 27, au-dessus du HUD (10) : plein écran opaque (`background: var(--fond-profond)`). Grille propre `screen.css:740` : `"tete tete" / "scene carnet" / "escouades escouades"`.
- Résultat : alertes, ressources, menu de gestion, fil de notifications et barre des joueurs sont **invisibles et inaccessibles** pendant la bataille. Les registres (z 25) sont aussi couverts (commentaire `screen.css:709`). Le seul retour est la fin de bataille (`finish`, `rtBattleScreen.ts:772-779` : `root.remove()`).
- Aggravant : `document.body.dataset["tactique"]` désactive les touches globales (`gameScreen.ts:366-367`) ; les `--gestion-h`/`--bandeau-h` restent calculés pour des éléments cachés (`hud.ts:149`).
- Le cadre unique d'ERRATA_V3 §3 n'existe donc pas ; `smoke:cadre` n'existe pas non plus (`grep '"smoke:cadre"' package.json` vide ; `package.json` liste smoke:map, politique, expedition, tactique, p5-p8, r0-r3, chr, ux0, pa, mis, tuto).
- Non vérifié : le même défaut pour les lieux 3D (`/proto3d`, `src/main.ts:18-19`, route séparée sans HUD), le conseil, les options (modales z 45-60) et le tutoriel.

## 4. Bugs et incohérences constatés

| # | Constat | Fichier:ligne |
|---|---|---|
| B1 | La bataille recouvre la barre supérieure et le menu de gestion (cf. §3) | `src/ui/styles/screen.css:705-713`, `src/ui/tactical/rtBattleScreen.ts:85-117` |
| B2 | Les expéditions jouées en bataille passent par l'écran 2D P4, pas le temps réel (`realtime` omis) | `src/ui/panels/expeditionsPanel.ts:159` |
| B3 | Deux écrans de bataille dupliqués (2D 519 l. et temps réel 966 l.) : touches, options, bilan à maintenir deux fois | `src/ui/tactical/battleScreen.ts`, `rtBattleScreen.ts`, choix à `gameScreen.ts:223` |
| B4 | « Terminer en automatique » boucle sans rendre la main : `while (!bt.state.ended) stepBattle(...)` ; durée sur 400 unités non mesurée, risque de gel de l'interface | `src/ui/tactical/rtBattleScreen.ts:788-790` |
| B5 | `perf.hidden` évalué une seule fois à la création : la console de débogage ouverte ensuite ne l'affiche pas, sauf par la touche | `src/ui/tactical/rtBattleScreen.ts:99` (touche : l.619) |
| B6 | Accès aux batailles de campagne uniquement par l'ouverture automatique du registre des armées ; fermé par le joueur, `lastArmyPrompt` empêche la réouverture pour la même rencontre (lecture : ouverture seulement si `prompt !== lastArmyPrompt`) ; réouverture manuelle seulement par la touche/bouton « armées » | `src/ui/gameScreen.ts:302-305` |
| B7 | Libellés de bacs à sable (« Bataille d'essai », compagnie, porteur) accessibles depuis les registres Expéditions/Porteurs : contournent la ligne « la bataille se joue depuis la campagne » (ERRATA_V3 §3 / règle 5 du plan) | `expeditionsPanel.ts:211,239`, `shiftersPanel.ts:195` |
| B8 | Pression d'occupation (`armies.pressure`) homonyme de la pression du pilier P1 : risque de confusion lors de C6 | `src/sim/armies/state.ts:157`, `armies.ts:1254` |
| B9 | Densité de Titans statique : tuer des Titans ou faire du bruit ne la modifie pas (écart direct avec spec 26 §3 « effets stratégiques ») | `src/sim/military/routes.ts:150-152` |
| B10 | Champ `owner`/siège absent des entités de bataille et d'armée (`grep -w owner` : 0 fichier dans `sim/armies`, `sim/tactical`) : bloque C3/C13 | `src/sim/armies/state.ts`, `src/sim/tactical/types.ts` |

Déjà connus et non répétés : dette n° 46-62 (R2+/R3), n° 62 (pas de sélection/ordre souris en 3D).

## 5. Limites de l'audit
Pas d'exécution (verify en cours dans une autre session), pas de capture, pas de GPU. Les coûts sont des estimations. Les points marqués « non vérifié » exigent une lecture complémentaire (`src/sim/tactical/map.ts`, `logistics.ts`, `data/titan_types/`).
