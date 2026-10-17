# 01 — Protocole de session (piste unique)

> Statut : **PROPOSÉ**. Remplace pour la V4 `docs/coord/PROTOCOLE.md` (fenêtres A/B, verrou, battement), qui n'est pas repris : il n'y a plus qu'une piste (`03` §1, point 5). Si un second compte de session revient, ce fichier est à réécrire par demande de changement.
> Une **session** = une exécution de l'IA de code sur le dépôt, de son démarrage à sa clôture.

## 1. Vue d'ensemble

```
démarrage (§2) → choix de la tâche (§3) → boucle de travail (§4) → [tâche suivante | arrêt (§7)] → clôture (§8)
```
Une session fait **une à plusieurs tâches** du tableau. Une tâche est calibrée pour tenir dans une session (taille S, M ou L de `02_TABLEAU_DES_TACHES.md` ; une tâche XL est découpée avant d'être prise). Aucune session ne laisse le dépôt dans un état rouge.

## 2. Démarrage (dans cet ordre, sans en sauter)

1. **Synchroniser** : `git fetch origin`, `git status`, se placer sur le tronc, `git pull --rebase`. Si l'arbre de travail contient des modifications non commitées : lire `git diff --stat` et le dernier journal avant de toucher à quoi que ce soit (§9).
2. **Lire** dans l'ordre de `00_LISEZ_MOI.md` §1 : `CLAUDE.md`, `docs/PROGRESS.md`, ce fichier, le tableau des tâches, `04`.
3. **Relever l'environnement** et l'écrire dans le journal du jour : lieu (`N` nuage ou autre), `dotnet --version`, `godot --version` (si installé), `python3 --version`, présence de `bpy` (`python3 -c "import bpy"`), espace disque, nombre de cœurs. Un outil absent n'est pas une panne : c'est la tâche S0 ou une installation (`pip install` et le registre de paquets .NET passent normalement ; tout autre réseau est supposé fermé).
4. **Vérifier l'état** : une fois M1 faite, lancer `verify` (en arrière-plan si la commande dépasse la limite de l'outil) et coller la sortie dans le journal. **Rouge → le réparer d'abord** ; c'est la première tâche de la session.
5. **Choisir la tâche** (§3) et l'annoncer dans le journal : identifiant, but, critères, fichiers qu'elle touchera.

## 3. Choisir la tâche

Règles, par ordre :

1. **La PROCHAINE ACTION EXACTE de `PROGRESS.md`**, si elle existe et si ses dépendances sont faites.
2. Sinon, la tâche de plus petit numéro dans le jalon courant dont : état `à faire` ; toutes les dépendances `fait` ; le lieu (`N`) est celui de la session.
3. **Préférer** une tâche `N` qui prépare une séance `G` ou une décision `H` (kit de test, fiche de mesure, question formulée) : le temps de Gabriel est le goulot.
4. **Ne pas commencer un jalon** dont les entrées ne sont pas remplies, sauf les tâches marquées « dérogation » (lot P et spikes S0, S1, S4 : elles ne dépendent d'aucune réponse de Gabriel).
5. Si toutes les tâches restantes sont `G` ou `H` : écrire le kit (programme de test, consignes de séance), le déposer, ajouter l'entrée dans `docs/MORNING.md` (« à faire par toi »), mettre la PROCHAINE ACTION EXACTE à jour et **terminer proprement** (§8). Ne pas inventer de travail pour combler.

Une tâche **absente du tableau** n'est pas commencée : elle est d'abord ajoutée au tableau (ligne complète, critères avec commande), avec une ligne dans le journal expliquant pourquoi.

## 4. Boucle de travail

1. **Ouvrir ou créer** `docs/v4/jalons/Mn.md` (modèle : `07_MODELES.md` §1) : tâches du jalon, critères avec commandes, hors-périmètre. Une page au plus.
2. **Plan court** de la tâche dans le journal (5 lignes au plus).
3. **Petits pas** : écrire le test avant ou avec le code. Aucune valeur d'équilibre en dur (`data/`). Aucun texte joueur en dur (clés de traduction).
4. **Travail lourd** : le confier à un sous-agent neuf avec un énoncé **complet** (but, fichiers, critères, interdits) ; ne jamais te faire relire par toi-même ; la relecture est un autre sous-agent (`organisation/05` §3).
5. **Vérifier** : exécuter les commandes de la colonne « Critères » ; **coller la sortie réelle** dans le rapport ou le journal. Critère visuel : voir `organisation/05` §4.
6. **Commit** (§5), mise à jour de `PROGRESS.md` (§6).
7. **Tâche suivante** ou arrêt (§7).

**Au plus toutes les 45 minutes de travail effectif : commit et push**, même en WIP, si la vérification rapide est verte. Un travail non poussé n'existe pas pour la session suivante.

## 5. Commits

| Règle | Détail |
|---|---|
| Un commit par tâche | message en français : `Mn-nn : titre court` ; corps : ce qui change, **sortie des commandes de vérification** (résumée), limites |
| WIP | autorisé en cours de tâche, préfixe `WIP Mn-nn :` ; la tâche n'est « fait » qu'au commit final vert |
| Attribution | les lignes d'attribution demandées par l'environnement terminent le message |
| Synchronisation | `git pull --rebase` avant chaque `git push` ; vérifier que le push est arrivé (`git status -sb`, `git log origin/<tronc> -1`) |
| Interdits | `--force`, suppression de branche, réécriture d'historique publié, commit de binaire lourd hors de `docs/art/assets/` ou `assets/` |
| Gros fichiers | un fichier > 5 Mo n'est commité qu'avec une ligne dans `docs/v4/rapports/` justifiant sa présence et son entrée au registre d'assets |

## 6. Fichiers d'état

| Fichier | Contenu | Mis à jour |
|---|---|---|
| `docs/PROGRESS.md` | jalon, tâche, dernier `verify` (date, code, nombre de tests), **PROCHAINE ACTION EXACTE** | à chaque tâche et à la clôture |
| `docs/v4/journal/AAAA-MM-JJ.md` | chronologie de la session : environnement, plan, commandes et sorties, décisions | en continu |
| `docs/v4/jalons/Mn.md` | fiche du jalon | à l'ouverture, puis à chaque tâche faite |
| `docs/v4/rapports/Mn.md` | rapport de fin de jalon (≤ 150 lignes, sorties réelles collées, captures décrites) | à la fin du jalon |
| `docs/v4/spikes/Sn.md` | rapport de spike : verdict PASS/FAIL daté, chiffres, repli éventuel | à la fin du spike |
| `docs/reports/dette.md` | critère échoué deux fois, défaut accepté, avec raison | quand cela arrive |
| `docs/DECISIONS.md` | décisions `D-nnn` (une ligne de contexte, le choix, l'alternative écartée, la preuve, la réversibilité) | à chaque décision |
| `docs/v4/04_REGISTRE_DES_DECISIONS.md` | statut des décisions V4 (FIGÉ / PROPOSÉ / PAR SPIKE) | quand un spike ou une revue tranche |
| `docs/MORNING.md` | ce que Gabriel doit lire, décider, faire | à chaque clôture |
| `docs/v4/registre_assets.md` (ou `.json`) | registre de provenance des assets tiers | à l'entrée de tout asset (`organisation/04`) |

La **PROCHAINE ACTION EXACTE** est une phrase qu'une session sans mémoire peut exécuter : identifiant de tâche, commande à lancer en premier, fichier à ouvrir. Pas « continuer M2 ».

## 7. Quand s'arrêter, quand demander

**S'arrêter proprement (clôture §8)** dans ces cas seulement :

1. **Limite d'usage atteinte ou proche.**
2. **Action destructive** demandée par la tâche (force-push, suppression de branche ou de données) : interdite ; choisir l'alternative.
3. **Argent** : aucun achat, aucun paiement, aucun changement d'abonnement, aucune location de machine sans accord écrit de Gabriel.
4. **Contournement** : ne jamais contourner CAPTCHA, Cloudflare ou limite d'un service.
5. **Une commande ne peut pas s'exécuter après deux tentatives différentes** : consigner (journal + dette), passer à une autre tâche ; s'il n'y en a pas, clôturer.
6. **Toutes les tâches restantes sont `G` ou `H`** (§3, règle 5).

**Demander à Gabriel** (par `docs/MORNING.md`, ou en direct si la session est interactive) : seulement quand la décision change le résultat **et** n'a pas de défaut écrit. Une décision qui a un défaut écrit dans `04` (registre), `organisation/08` ou une fiche : prendre le défaut, journaliser, avancer. Une décision irréversible qui peut raisonnablement aller dans les deux sens : préparer le travail, exposer le choix, s'arrêter là.

## 8. Clôture (à suivre à la lettre)

1. Commiter le travail en cours (WIP si la tâche n'est pas finie).
2. `verify` (ou `verify:rapide` + tests ciblés si la limite d'usage presse) ; coller la sortie dans le journal.
3. Mettre à jour `PROGRESS.md` : phase, dernière tâche, dernier `verify`, **PROCHAINE ACTION EXACTE**.
4. Mettre à jour `docs/MORNING.md` : fait, à valider par Gabriel, à faire par Gabriel, dettes.
5. Finir le journal du jour (environnement, tâches, commandes, échecs).
6. `git pull --rebase`, `git push`, **vérifier que le push est arrivé**.
7. Ne pas terminer le tour avant ces sept étapes.

## 9. Reprise après une interruption

Si la session précédente s'est arrêtée au milieu d'une tâche :

1. `git status` et `git log -5` : que reste-t-il de non commité ? Le dernier commit est-il vert ?
2. Lire le dernier journal jusqu'à la dernière ligne ; **ne pas se fier aveuglément** à `PROGRESS.md` (il peut être en retard d'une tâche).
3. Relancer `verify` ; s'il est rouge, identifier si la cause est le travail en cours (le terminer ou le défaire **par un nouveau commit**, jamais par réécriture) ou l'environnement.
4. Écrire dans le journal : « reprise : état constaté, décision ».

## 10. Sous-agents

- **Délégation** : tout travail lourd ou parallélisable (portage d'un module, génération d'un lot de modèles, écriture de tests) peut être confié à un sous-agent neuf. Énoncé obligatoire : but, fichiers à lire, fichiers à écrire, critères avec commandes, interdits (provenance, déterminisme, valeurs en dur), format du compte rendu.
- **Relecture** : toujours un sous-agent **différent de l'auteur**, qui reçoit le diff, les critères et les captures, et rend un verdict écrit (`organisation/05` §3). Jamais d'auto-relecture.
- **Preuves** : le compte rendu d'un sous-agent n'est pas une preuve ; la session relance elle-même les commandes de vérification.

## 11. Usage et taille des tâches

- Les tailles de `02` sont des **estimations non mesurées**. À la fin de M1, la session recalcule les tailles à partir de l'usage réellement consommé par tâche (journal) et met à jour le tableau.
- Une tâche qui dépasse une session est **découpée** : on ajoute des lignes au tableau (même jalon, numérotation `Mn-nn.a`, `Mn-nn.b`), jamais on ne laisse une tâche « presque finie » sans PROCHAINE ACTION EXACTE.
- En cas de limite d'usage imprévue : clôture immédiate (§8), même en WIP.

## 12. Sécurité et hygiène

- Aucun secret dans le dépôt (jetons, clés, adresses privées de joueurs).
- Aucune donnée personnelle de Gabriel ou de ses amis dans les journaux ni dans les captures.
- L'audio de la commande vocale n'est ni enregistré ni envoyé par défaut (`V4-D21`).
- Les fichiers que Gabriel dépose (cartes, références) sont des **originaux** : la session travaille sur une copie et renvoie le résultat ; elle ne modifie pas l'original.
- Tout paquet installé (pip, NuGet, npm) est consigné dans le journal avec sa version ; aucun paquet payant.
