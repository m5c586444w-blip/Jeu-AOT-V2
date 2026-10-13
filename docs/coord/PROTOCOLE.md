# Protocole de coordination des deux sessions automatiques

> Décision de Gabriel, 2026-10-13. Ce protocole **remplace** la règle « une seule session de code à la fois » (D-130) par une règle vérifiable.
> Les deux sessions ne se parlent **jamais** en conversation : elles communiquent **uniquement par des fichiers versionnés** de ce dossier.

## 1. Fenêtres (heure de Paris, `Europe/Paris`)

| Session | Fenêtre | Pas de nouvelle tâche à partir de | Clôture obligatoire à partir de | Modèle conseillé |
|---|---|---|---|---|
| **A** (nuit) | 00:00 → 08:00 | 07:15 (T−45) | 07:40 (T−20) | le plus capable disponible |
| **B** (jour) | 08:00 → 16:00 | 15:15 (T−45) | 15:40 (T−20) | modèle intermédiaire ; plafond hebdomadaire de 75 % (`BUDGET.md`) |
| (libre) | 16:00 → 00:00 | — | — | Gabriel travaille ; aucune session automatique n'écrit |

- **Ne jamais deviner l'heure.** Commande unique : `npm run coord -- fenetre` (JSON : `session`, `minutesRestantes`, `phase`). Elle utilise le fuseau de Paris, heure d'été comprise. À relancer **avant chaque nouvelle tâche** et à chaque fin de tâche.
- `phase` = `travail` : on peut démarrer une tâche. `plus-de-nouvelle-tache` : on termine seulement la tâche en cours. `cloture` : on exécute la clôture (§6) immédiatement. `hors-fenetre` : la session **n'écrit rien** et s'arrête (sauf demande explicite de Gabriel dans le prompt).
- Une session qui se réveille dans la fenêtre de l'autre (déclenchement manuel, retard) applique ce même test : si `session` ≠ la sienne, elle s'arrête sans rien modifier.

## 2. Fichiers de coordination (seul moyen de communication)

| Fichier | Rôle | Qui écrit |
|---|---|---|
| `docs/coord/LOCK.json` | verrou : qui travaille, sur quoi, dernier battement | script `npm run coord` uniquement |
| `docs/coord/COORD.md` | tableau des chantiers, état, **boîte de passage A↔B**, questions pour la session suivante | la session qui détient le verrou |
| `docs/coord/BUDGET.md` | quotas, compteurs de B, interrupteur `B_AUTORISE` | B (compteurs), A (lecture), Gabriel (interrupteur) |
| `docs/coord/journal/AAAA-MM-JJ-A.md` / `-B.md` | journal de la session (un fichier par session et par jour : **jamais** de conflit de fusion) | la session concernée |
| `docs/PROGRESS.md` | « PROCHAINE ACTION EXACTE », dernier `verify` | la session qui clôture |
| `docs/DECISIONS.md` | décisions D-nnn (numéro suivant = dernier + 1, relu après `pull`) | la session qui décide |
| `docs/MORNING.md` | ce que Gabriel doit voir ou valider | la session qui clôture |

Une session lit **toujours** dans cet ordre au démarrage : `CLAUDE.md` → `docs/spec/ERRATA_V3.md` → ce protocole → `COORD.md` (surtout la boîte de passage) → `BUDGET.md` → `PROGRESS.md` → dernier journal de l'autre session.

## 3. Verrou

- Le verrou est `LOCK.json`, **partagé par git**. `npm run coord -- verrou prendre <A|B> "<chantier ou tâche>"` fait `git pull --rebase`, évalue, écrit, commit et `git push`. Si le push est refusé (l'autre session vient de pousser), le script récupère et réévalue (3 essais).
- **Tout démarrage est une instance neuve**, y compris un relais de la même lettre : si le verrou est détenu (même par « A » quand tu es « A ») avec un battement de moins de **75 min**, la réponse est `OCCUPE` (code 3) — une instance vivante travaille. On ne touche **à rien** de ce que ses commits modifient et on s'arrête (un relais ultérieur reprendra si besoin).
- **Battement** : `npm run coord -- verrou battement <A|B> ["<tâche en cours>"]` — **commit et push** un petit commit `coord: battement`. À faire **au moins toutes les 30 minutes**, avant et après chaque lancement de sous-agent, et à chaque changement de tâche. Réponse `PERDU` (code 3) : le verrou est passé à quelqu'un d'autre (par exemple après une longue pause) → commit ton travail s'il est vert, `git pull --rebase`, `git push`, puis **arrête-toi** sans modifier `COORD.md`. Réponse code 4 : réseau en échec, réessayer.
- **Péremption** : un verrou sans battement depuis **75 min** est périmé ; **30 min** si la fenêtre de son titulaire est terminée ; un verrou posé par Gabriel (`"proprietaire": "GABRIEL"`) est respecté **6 h**. Une session ne reprend jamais un verrou non périmé.
- **Libération** : `npm run coord -- verrou liberer <A|B>` dans le commit de clôture.
- Commit + push du code **au moins toutes les 45 minutes** de travail effectif (WIP sur le tronc si `verify` est vert, sinon l'état exact dans le journal).
- Gabriel peut bloquer les deux sessions en mettant `"proprietaire": "GABRIEL"` avec un `battement` récent (éditer `LOCK.json`, commit, push) quand il travaille lui-même sur le dépôt.

## 4. Branches et commits

- **Tronc unique : `claude/attack-on-titan-strategy-game-4ukom6`.** Premier geste d'une session : `git fetch origin && git checkout claude/attack-on-titan-strategy-game-4ukom6 && git pull --rebase`.
- Un chantier est une suite de **commits verts** sur le tronc ; un chantier trop gros pour rester vert est livré **derrière un drapeau de fonctionnalité** désactivé par défaut. Pas de branche longue, sauf expérience jetable nommée `claude/essai-<sujet>` (jamais fusionnée sans revue).
- **Un commit par tâche**. `npm run verify` **complet** (≈ 11 min en session cloud ; le lancer en arrière-plan : `nohup bash -c 'npm run verify > verify.log 2>&1; echo CODE=$? >> verify.log' &`, puis relever la sortie ; la commande Bash de l'outil est limitée à 10 min) avant le commit de fin de tâche et à la clôture ; commits intermédiaires : `npm run verify:rapide` + tests ciblés du module touché. **Sortie réelle collée** dans le rapport de la tâche. Jamais « vert » sans sortie collée.
- Le hook `Stop` de `.claude/settings.json` relance `npm run verify` à chaque fin de tour (timeout 600 s, peut expirer sur une machine lente) : ne pas s'en servir comme preuve, lancer le verify soi-même.
- Avant tout push : `git pull --rebase`. En cas de conflit : garder **les deux** modifications ; ne jamais `--force`, ne jamais supprimer une branche, ne jamais réécrire l'historique publié.
- Messages de commit en français : `Cn.m : <verbe> …`. Ajouter les lignes d'attribution demandées par l'environnement de la session.
- **Revue indépendante** (D-107, maintenue) : à la fin de chaque chantier et à chaque jalon indiqué dans `PLAN_FONCTIONNALITES.md`, un **sous-agent distinct** (jamais celui qui a écrit) relit `git diff <début>..HEAD`, les rapports et les captures, et rend un verdict écrit (`docs/reports/Cn-revue.md`). Une session ne se revoit pas elle-même.

## 5. Choix de la tâche

1. Lire `COORD.md` : la première tâche `à faire` dont les dépendances sont `fait`, **ou** la tâche `en cours` laissée par l'autre session avec une « PROCHAINE ACTION EXACTE ».
2. Une tâche déjà `en cours` par l'autre session se **reprend** (pas de doublon) en partant de sa note de passage.
3. Préférence de voie (non contraignante) : **A** = simulation, architecture, tests de propriétés, revues lourdes ; **B** = interface, assets, scripts Blender, illustrations, documentation, tests visuels. Si une voie est vide ou bloquée, l'autre session prend la tâche.
4. Plafond de tours par chantier : voir `PLAN_FONCTIONNALITES.md`. Dépassement de 20 % → on découpe ou on coupe (règle de coupe du §8), on journalise, on continue.

## 6. Clôture (à `phase = cloture`, ou dès que la limite d'usage approche)

Dans cet ordre, en moins de 15 minutes :
1. Terminer ou **mettre de côté proprement** la tâche en cours (`git stash` interdit : on commit en WIP si `verify` vert, sinon on décrit l'état exact dans le journal).
2. `npm run verify` ; coller la sortie dans le rapport.
3. Mettre à jour `COORD.md` (statuts, boîte de passage : **la PROCHAINE ACTION EXACTE**, fichiers touchés, commande qui échoue s'il y en a une), `docs/PROGRESS.md`, `docs/MORNING.md` (≤ 15 lignes), le journal du jour, et pour B les compteurs de `BUDGET.md`.
4. `npm run coord -- verrou liberer <A|B>`, commit, `git pull --rebase`, `git push`. Vérifier avec `git log origin/<tronc> -1` que le push est arrivé.
5. Arrêt. **Ne pas** terminer le tour avant cette séquence ; **ne pas** l'ignorer parce que la tâche « est presque finie ».

## 7. Limite d'usage (A et B)

- Si l'environnement signale une limite d'usage atteinte ou imminente : exécuter la clôture (§6) **tout de suite**, même au milieu d'une tâche.
- B applique en plus `BUDGET.md` : il lit `B_AUTORISE` au démarrage et à chaque fin de tâche ; s'il vaut `non`, ou si le compteur a atteint 75 % du plafond calibré, B exécute la clôture et s'arrête **sans** démarrer de tâche.
- Une session qui ne peut pas lire son usage réel le dit dans `BUDGET.md` (« mesure non disponible ») et applique le compteur de tours.

## 8. Arrêts, coupes, décisions

Voir `docs/spec/ERRATA_V3.md` §9. Les sessions **décident** (étiquette `[A]` si la décision est à confirmer, journal dans `DECISIONS.md`) et avancent ; elles n'attendent pas Gabriel. **Règle de coupe** si le temps manque (dans l'ordre) : détail naval 3D → Titans réalistes lot 2 (C12) → illustrations en voie 2 → variantes secondaires de tenues → … ; jamais le cadre d'interface (C1), jamais les tests, jamais le déterminisme.
Les questions pour Gabriel vont dans `docs/MORNING.md` ; les questions pour l'autre session dans la boîte de passage de `COORD.md`. Une session ne s'arrête **jamais** pour attendre une réponse.

## 9. Sécurité du dépôt

Interdits : `git push --force`, suppression de branche ou de fichier de données de Gabriel (`assets_user/`, sauvegardes), modification de `.git`, de `.claude/settings.json` et du hook `stop-verify.sh` sans décision écrite, achat ou changement d'abonnement, ajout d'un domaine à une liste d'autorisation, contournement de CAPTCHA/Cloudflare/limites d'un site.
