# 05 — Définition de « fini », preuves et revues

> Statut : **PROPOSÉ** (2026-10-17). Reprend `docs/v4/03_PLAN_DE_PRODUCTION.md` §6–7 et les règles de qualité du `CLAUDE.md`, en les rendant utilisables ligne à ligne.

## 1. Une tâche est « fait » quand (toutes les cases)

| # | Condition | Preuve attendue |
|---|---|---|
| 1 | Les commandes ou mesures de la colonne « Critère » ont été **exécutées** | sortie réelle collée dans le journal du jour (commande, code de sortie, fin de sortie) |
| 2 | `verify:rapide` est vert (`verify` complet pour une tâche qui clôt un jalon) | sortie collée |
| 3 | Un test existe pour ce qui a été écrit (ou la raison de son absence est écrite) | chemin du test |
| 4 | Aucune valeur d'équilibre en dur, aucun texte joueur en dur, aucune règle de déterminisme violée | `Tools` / analyse de code vert ; sinon exception justifiée dans le journal |
| 5 | Tout asset ajouté a son entrée au registre (`organisation/04` §5) | `Tools assets-check` code 0 |
| 6 | Une tâche `G` : fichier reçu, rangé dans `docs/v4/retours/<ID>/`, empreinte SHA-256 consignée ; une tâche `H` : réponse consignée mot pour mot dans `docs/DECISIONS.md` | chemin + empreinte, ou numéro `D-nnn` |
| 7 | Commit de fin de tâche poussé, `PROGRESS.md` à jour | `git log origin/<tronc> -1` collé |
| 8 | La colonne « État » du tableau passe à `fait AAAA-MM-JJ <commit>` | ligne modifiée dans le même commit |

Une tâche dont un critère échoue **deux fois** n'est pas « fait » : elle reçoit une ligne dans `docs/reports/dette.md` (quoi, où, gravité, tentative 1, tentative 2) et l'état `bloqué (dette)` ; on passe à une autre tâche (`01_PROTOCOLE` §7 règle 5).

## 2. Un jalon est « fait » quand

1. Toutes ses tâches sont `fait`, ou `bloqué (dette)` avec un repli de `05_SPIKES_RISQUES.md` qui le permet.
2. Les commandes de la colonne « Critères » du jalon (`03` §2) ont été exécutées, sortie collée dans `docs/v4/rapports/Mn.md` (150 lignes au plus, hors sorties collées).
3. Les critères visuels sont passés par §4 de ce fichier.
4. `04_REGISTRE_DES_DECISIONS.md` est à jour : décisions concernées FIGÉES, nouvelles décisions consignées.
5. Une **revue indépendante** (§3) a rendu un verdict écrit.
6. `docs/PROGRESS.md` donne l'état et la **PROCHAINE ACTION EXACTE**.
7. `docs/MORNING.md` dit à Gabriel ce qui a été fait, ce qu'il doit relire ou décider, et ce qu'on lui demande.

## 3. La revue indépendante

**Qui.** Un sous-agent **neuf**, jamais l'auteur du travail, jamais la session qui l'a commandé en le relisant elle-même. À chaque nouvelle revue, un sous-agent neuf. Le prompt est dans `06_PROMPTS_DE_SESSION.md` §4.

**Ce qu'il reçoit** (et rien d'autre) : l'énoncé de la tâche ou du jalon, les critères avec leurs commandes, le diff (`git diff <base>..<tête>`), les fichiers de tests, les captures éventuelles, la liste des décisions `D-nnn` et `V4-Dnn` concernées.

**Ce qu'il fait.**
1. Il relit le diff contre les critères, **ligne de critère par ligne de critère**.
2. Il **relance lui-même** au moins une commande de vérification par critère et colle la sortie.
3. Il cherche : critère non couvert par un test, test qui ne teste rien (assertion toujours vraie), valeur en dur, règle de déterminisme violée (`02_ARCHITECTURE` §4), asset sans entrée au registre, décision FIGÉE rouverte sans demande de changement, texte du rapport qui dit plus que la sortie collée.
4. Pour chaque capture : §4.
5. Il rend un verdict.

**Verdict** (fichier `docs/v4/revues/<Mn-nn ou Mn>-<date>.md`) :

| Verdict | Sens | Suite |
|---|---|---|
| **ACCEPTÉ** | tous les critères sont prouvés | la tâche ou le jalon est fait |
| **ACCEPTÉ AVEC RÉSERVES** | tous les critères prouvés, défauts mineurs listés | les réserves vont dans `dette.md` ; le travail avance |
| **REFUSÉ** | au moins un critère non prouvé ou faux | liste des critères en cause ; la session corrige puis nouvelle revue par un sous-agent neuf |

**Limites.** Il ne corrige pas, il juge. Un deuxième refus sur le même critère déclenche la règle de dette (§1). Son compte rendu n'est **pas une preuve** : la preuve est la sortie de commande qu'il colle et que la session peut relancer.

**Quand.** Fin de chaque jalon (liste de `03` §7 : R-D1, R-M0, M2, M5, M6, M7, M9, avant M11) ; en plus, sur toute tâche qui touche à : la sérialisation canonique ou l'empreinte, le générateur aléatoire, le protocole réseau, la gestion des secrets de trahison, le registre d'assets.

## 4. Lire une capture (critère visuel)

Règle du projet (reprise telle quelle de l'ancien `CLAUDE.md`) : **avant d'écrire OK sur un critère visuel**, ouvrir chaque capture avec l'outil de lecture d'image et écrire dans le rapport :

1. **Ce que je vois, en 3 lignes** (pas de formule générale : ce qui est réellement à l'image).
2. **Au moins 3 défauts possibles**, même jugés mineurs, choisis parmi : texte répété ; zone vide ; chevauchement ; élément absent ; valeur à 0 incohérente ou non branchée ; cadre d'interface manquant ; texte coupé ; contraste insuffisant ; proportion fausse (humain / Mur) ; étirement de texture ; trou dans un maillage ; ombre incohérente.
3. **Un verdict** : `OK`, `OK avec défauts` (liste), ou `KO`.

Règles :
- Capture vide, ou sans l'élément testé : critère **KO**.
- Un écran dont une valeur n'est pas branchée est un défaut, pas un « 0 ».
- Les captures en **rendu logiciel** (nuage) prouvent la **présence** des éléments et le fonctionnement de la chaîne ; elles ne prouvent ni la fluidité ni la qualité d'image. Ces deux jugements se font sur machine avec GPU (V4-D14) — le PC de Gabriel.
- Une capture jugée par l'auteur du travail est relue par un **second relecteur** (sous-agent neuf) quand le jalon est M7 ou M8.
- Les captures sont rangées dans `docs/v4/captures/<Mn-nn>/`, nom `AAAA-MM-JJ_<sujet>_<résolution>.png` ; poids raisonnable (pas de compression exigée par le projet, mais pas de capture > 2 Mo sans raison).

## 5. Coller une sortie de commande

Format minimal, dans le journal ou le rapport :

```
$ <commande exacte>
<début utile de la sortie>
[…]
<fin de la sortie : lignes de bilan>
code de sortie : N      (date et heure)
```

- Une sortie trop longue est tronquée **au milieu**, jamais en supprimant les lignes de bilan ni les échecs.
- Une sortie qui contient un échec n'est pas retouchée ; elle est collée telle quelle avec la suite.
- « Vert » sans sortie collée = non prouvé.

## 6. Ce qui ne compte pas comme preuve

1. Le compte rendu d'un sous-agent sans sortie de commande relançable.
2. Une mesure de fluidité en rendu logiciel.
3. Un chiffre « de mémoire » ou « attendu ».
4. Un test qui n'a jamais échoué : pour un nouveau test d'invariant, **montrer qu'il échoue sur un cas volontairement faux** (exemples : trace d'or altérée, fichier de données invalide, asset sans entrée).
5. Une capture non ouverte.

## 7. Gel d'un jalon : liste d'actions

1. Rapport `docs/v4/rapports/Mn.md` écrit.
2. `verify` complet collé.
3. Revue indépendante : verdict ACCEPTÉ ou ACCEPTÉ AVEC RÉSERVES.
4. `04` : statuts passés à FIGÉ pour les décisions closes par le jalon.
5. `PROGRESS.md` et `MORNING.md` à jour.
6. Commit `Mn : gel`, push, vérification du push.
7. Plus aucune demande de changement ne se traite avant le jalon suivant.
