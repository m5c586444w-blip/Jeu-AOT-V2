# Organisation du travail V4 — Lisez-moi

> Statut : **PROPOSÉ** (2026-10-17). Dépend de : `docs/v4/03_PLAN_DE_PRODUCTION.md` (jalons et critères), `04_REGISTRE_DES_DECISIONS.md` (décisions). Ces fichiers **détaillent** le plan : ils ne le remplacent pas. En cas de conflit, `04` puis `03` priment ; tout écart se règle par une demande de changement (`04` §4).
> Public : **la session de code (IA) qui reprend le projet à froid**, et Gabriel.

**Renvois dans ce dossier.** Un numéro seul (`02`, `03`, `04`, `05`…) désigne le document de même numéro de `docs/v4/` (`02_ARCHITECTURE`, `03_PLAN_DE_PRODUCTION`, `04_REGISTRE_DES_DECISIONS`, `05_SPIKES_RISQUES`…). Les fichiers de ce dossier sont toujours écrits `organisation/NN`. `26` et `27` sont dans `docs/spec/` ; `U00`–`U15` dans `docs/v4/univers/`.

## 1. Ce que cette IA doit avoir lu pour travailler

Le dossier d'univers (`docs/v4/univers/`) ne suffit pas et ne sert pas à s'organiser : c'est une **référence de lore** (qui sait quoi, quand, avec quelle source). L'organisation, elle, vit ici. Une session qui démarre lit **dans cet ordre** :

| # | Fichier | Pourquoi | Quand |
|---|---|---|---|
| 1 | `CLAUDE.md` (racine) | règles de travail, arrêts | toujours |
| 2 | `docs/PROGRESS.md` | état, jalon en cours, **PROCHAINE ACTION EXACTE** | toujours |
| 3 | `docs/v4/organisation/01_PROTOCOLE_DE_SESSION.md` | comment démarrer, travailler, clôturer | toujours |
| 4 | `docs/v4/organisation/02_TABLEAU_DES_TACHES.md` | la tâche à faire (une ligne = une tâche, avec critères) | toujours |
| 5 | `docs/v4/04_REGISTRE_DES_DECISIONS.md` | ce qui est figé, ce qui ne l'est pas | avant toute décision |
| 6 | `docs/v4/organisation/05_DEFINITION_DE_FINI_ET_REVUES.md` | ce que « terminé » veut dire | avant de clore une tâche |
| 7 | le document technique de la tâche (voir §2) | contexte précis | selon la tâche |

Tout le reste se lit **à la demande**, pas au démarrage.

## 2. Où trouver quoi

| Je dois… | Je lis |
|---|---|
| comprendre l'architecture, le déterminisme, les budgets de rendu | `02_ARCHITECTURE.md` (§4 déterminisme, §7 niveaux de détail, §8 chaîne de modèles) |
| connaître une règle de jeu | `docs/spec/26_MECANIQUES_THEORIQUES.md` (sept piliers), `27_MULTIJOUEUR_9_JOUEURS.md`, puis les spécifications `docs/spec/` |
| connaître un fait de lore et sa source | `docs/v4/univers/U00_LISEZ_MOI.md`, puis le fichier `U01` à `U12` voulu ; contradictions : `U15` §3 ; propositions de correction de données : `U14` |
| faire un modèle 3D, un décor, une texture | `organisation/03_PIPELINE_ASSETS_3D.md`, `organisation/04_POLITIQUE_DE_PROVENANCE.md`, `07_REFERENCES_VISUELLES.md` |
| faire un spike | `05_SPIKES_RISQUES.md` (protocole, PASS/FAIL, repli) |
| la voix | `06_COMMANDE_VOCALE.md` |
| écrire un rapport, un journal, une décision | `organisation/07_MODELES.md` |
| savoir ce que Gabriel doit faire ou décider | `organisation/08_ACTIONS_ET_DECISIONS_DE_GABRIEL.md` |
| copier un énoncé de session | `organisation/06_PROMPTS_DE_SESSION.md` |

## 3. Les rôles

| Rôle | Qui | Fait | Ne fait pas |
|---|---|---|---|
| **Propriétaire** | Gabriel | tranche les décisions, fournit ce qui n'existe que chez lui (fichiers de carte, mesures sur son PC, références visuelles), joue les séances d'essai | n'a pas à relire le code |
| **Direction** | session de conversation avec Gabriel | écrit les documents, audits et décisions ; prépare les tâches | n'écrit pas le code de production |
| **Session de code** | IA, une seule à la fois (piste unique) | prend une tâche du tableau, la fait, la vérifie, la commite, met à jour `PROGRESS.md` | ne rouvre pas une décision FIGÉE ; ne se relit pas elle-même |
| **Relecteur indépendant** | un sous-agent distinct de l'auteur | reçoit diff, critères et captures ; rend un verdict écrit | ne corrige pas : il juge |

## 4. Principes (ce qui évite les retours en arrière)

1. **Une tâche à la fois**, tirée de `02_TABLEAU_DES_TACHES.md`, dont toutes les dépendances sont faites.
2. **Un risque non mesuré ne se code pas** : il passe par un spike, avec un seuil PASS/FAIL et un repli écrits d'avance.
3. **Pas de critère sans commande ni mesure.**
4. **Rien n'est déclaré réussi sans la sortie réelle de la commande, collée.**
5. **Une décision FIGÉE ne se rouvre pas** en cours de jalon : demande de changement, traitée entre deux jalons.
6. **Une session décide et journalise** ; elle ne pose pas de question à Gabriel pour une affaire qui a un défaut écrit. Elle s'arrête seulement dans les cas de `01_PROTOCOLE_DE_SESSION.md` §7.
7. **Ce qui demande le PC de Gabriel est marqué `G`** et regroupé en séances : la session prépare tout (exécutable, scène, fiche de mesure), Gabriel lance et renvoie un fichier.

## 5. Les trois lieux de travail

| Code | Lieu | Ce qu'on y fait | Limites |
|---|---|---|---|
| `N` | **Nuage** (session de code, Linux, sans GPU) | simulation, données, réseau en test, scripts Blender (`bpy`), outils, documents | pas de jugement de fluidité ni d'image (rendu logiciel) ; Godot et .NET à installer (S0) |
| `G` | **PC de Gabriel** (Windows x64, RTX 3050 d'après lui ; carte exacte à relever) | mesures de fluidité, essais de voix, ressenti du combattant, lancement des exécutables de test | la session ne dispose pas d'un terminal sur ce PC : elle **dépose** un fichier, Gabriel lance, **renvoie** le résultat |
| `H` | **Décision ou fourniture de Gabriel** | choix, fichiers, références | — |

Le pont vers le PC permet de **lire et écrire des fichiers** dans les dossiers que Gabriel autorise ; il ne permet pas d'y lancer un programme.

## 6. Contenu de ce dossier

| Fichier | Contient |
|---|---|
| `00_LISEZ_MOI.md` | ce fichier : ordre de lecture, rôles, principes, lieux de travail |
| `01_PROTOCOLE_DE_SESSION.md` | démarrer, choisir la tâche, boucle de travail, commits, fichiers d'état, arrêts, clôture, reprise |
| `02_TABLEAU_DES_TACHES.md` | toutes les tâches (lot P, M0 à M11, spikes S0 à S7, réserve), avec critères et dépendances |
| `03_PIPELINE_ASSETS_3D.md` | chaîne des modèles 3D, voie « création au projet » et voie « carte voxel », échelle, budgets, spike S7, droits |
| `04_POLITIQUE_DE_PROVENANCE.md` | d'où viennent les contraintes, ce qui existe par catégorie (3D, images, sons, événements), options A / B / C, registre d'assets |
| `05_DEFINITION_DE_FINI_ET_REVUES.md` | ce que « fait » veut dire, revue indépendante, lecture des captures, preuves |
| `06_PROMPTS_DE_SESSION.md` | énoncés à copier-coller (démarrage, reprise, tâche, relecture, délégation, kits, retours, direction, S7) |
| `07_MODELES.md` | modèles de fiche de jalon, rapport, spike, journal, décision, dette, avancement, avis de revue |
| `08_ACTIONS_ET_DECISIONS_DE_GABRIEL.md` | ce que Gabriel décide ou fournit, avec défauts ; séances sur son PC |
| `annexes/controle_tableau.py` | contrôle automatique du tableau des tâches |
| `annexes/essai_voxel_synthetique.py` | essai de maillage sur une scène aléatoire (aucune carte réelle) ; relançable : `python3 -I annexes/essai_voxel_synthetique.py <sortie.glb>` (numpy et trimesh requis) |

## 7. État au 2026-10-17

- Ancien dépôt gelé en référence ; tâche automatique A en pause (D-192) ; une seule piste.
- Rien de V4 n'est codé. Le plan de jalons est `03` ; ce dossier fournit le détail.
- Dossier d'univers fait (D-193). Dossier d'organisation écrit (D-194). Décisions en attente de Gabriel : `08_ACTIONS_ET_DECISIONS_DE_GABRIEL.md` ; la plus structurante est la **provenance** (`04_POLITIQUE_DE_PROVENANCE.md`).
- Le tableau des tâches se contrôle par `annexes/controle_tableau.py` (colonnes, identifiants uniques, dépendances existantes, cycles, aucune tâche `G` sans kit `N`).
- Rien n'a été converti d'une carte voxel. L'essai de maillage est synthétique.
