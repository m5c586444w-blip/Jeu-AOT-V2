# 06 — Prompts de session (à copier-coller)

> Statut : **PROPOSÉ** (2026-10-17). Chaque prompt est **complet par lui-même** : une session sans mémoire doit pouvoir l'exécuter. Les chemins sont ceux du dépôt actuel (`docs/v4/…`) ; remplacer les `<…>`. Les prompts ne contiennent aucune règle qui ne soit pas ailleurs dans `docs/v4/organisation/` : en cas de désaccord, les fichiers priment.

## 1. Démarrer une session de code (cas normal)

```
Tu reprends le projet « Murs et Sang » (V4, Godot .NET). Piste unique.
1. Lis dans l'ordre : CLAUDE.md, docs/PROGRESS.md, docs/v4/organisation/00_LISEZ_MOI.md,
   01_PROTOCOLE_DE_SESSION.md, 05_DEFINITION_DE_FINI_ET_REVUES.md.
2. Suis le protocole §2 (démarrage) puis §3 (choix de la tâche) de 01_PROTOCOLE_DE_SESSION.md.
   La tâche est dans docs/v4/organisation/02_TABLEAU_DES_TACHES.md ; la PROCHAINE ACTION EXACTE
   de docs/PROGRESS.md passe avant tout.
3. Travaille tâche après tâche. Colle la sortie réelle de chaque commande de critère.
   Ne déclare rien réussi sans sortie collée.
4. Une décision qui a un défaut écrit : prends-le, journalise-le (docs/DECISIONS.md), avance.
   Une décision sans défaut écrit et qui change le résultat : écris-la dans docs/MORNING.md.
5. Arrête-toi uniquement dans les cas de 01_PROTOCOLE_DE_SESSION.md §7, et clôture comme au §8.
Rends compte en français, en peu de mots : ce qui est fait, ce qui reste, ce que Gabriel doit faire.
```

## 2. Reprendre après une interruption

```
La session précédente s'est arrêtée avant la fin. Suis docs/v4/organisation/01_PROTOCOLE_DE_SESSION.md §9.
Commence par : git status, git log -5, lecture du dernier fichier docs/v4/journal/*.md.
Ne te fie pas aveuglément à docs/PROGRESS.md. Écris dans le journal : « reprise : état constaté, décision ».
Ne réécris jamais l'historique ; défais un travail raté par un nouveau commit.
```

## 3. Donner une tâche précise

```
Tâche : <ID du tableau, par exemple M1-03>.
Lis la ligne correspondante dans docs/v4/organisation/02_TABLEAU_DES_TACHES.md (critère, dépendances, repli)
et les documents qu'elle cite. Vérifie que ses dépendances sont à « fait ».
Fais uniquement cette tâche. Si tu découvres un travail manquant, ajoute une ligne au tableau (nouvel ID, jamais
de renumérotation) et continue ta tâche.
Termine par : critère exécuté (sortie collée), commit « <ID> : <titre> », ligne du tableau passée à « fait », push.
```

## 4. Relecture indépendante (sous-agent neuf)

```
Tu es relecteur indépendant. Tu n'as pas écrit ce travail et tu ne le corriges pas : tu le juges.
Pièces fournies : <énoncé de la tâche ou du jalon>, <critères avec commandes>, <git diff base..tête>,
<fichiers de tests>, <captures>, <décisions concernées>.
Pour CHAQUE ligne de critère :
  1. relance au moins une commande de vérification toi-même et colle la sortie ;
  2. dis si le critère est prouvé (oui / non / partiellement) et pourquoi.
Cherche en plus : test qui ne teste rien ; valeur d'équilibre ou texte joueur en dur ; règle de déterminisme violée
(docs/v4/02_ARCHITECTURE.md §4) ; asset sans entrée au registre ; décision FIGÉE rouverte sans demande de changement ;
passage du rapport qui affirme plus que la sortie collée.
Pour chaque capture : ouvre-la avec l'outil de lecture d'image, décris-la en 3 lignes, liste ≥ 3 défauts possibles.
Verdict : ACCEPTÉ / ACCEPTÉ AVEC RÉSERVES / REFUSÉ (docs/v4/organisation/05_DEFINITION_DE_FINI_ET_REVUES.md §3).
Écris-le dans docs/v4/revues/<id>-<date>.md, avec la liste des critères en cause s'il y en a.
Ne te fie à aucun compte rendu de l'auteur : seules les sorties que tu as obtenues comptent.
```

## 5. Déléguer à un sous-agent (modèle d'énoncé)

```
Contexte : projet « Murs et Sang » V4 (Godot .NET), dépôt <chemin>. Règles : CLAUDE.md.
But : <une phrase>.
À lire d'abord : <fichiers>.
À écrire ou modifier : <fichiers, et seulement ceux-là>.
Critères (commandes à exécuter, sortie à coller) : <liste>.
Interdits : valeurs d'équilibre en dur ; texte joueur en dur ; System.Random, DateTime, Dictionary parcouru sans
tri dans Sim ; ressource de provenance non admise (docs/v4/organisation/04_POLITIQUE_DE_PROVENANCE.md) ;
toute modification hors des fichiers listés.
Rends : liste des fichiers changés, sorties des commandes, difficultés, ce que tu n'as pas pu vérifier.
```

## 6. Préparer un kit pour le PC de Gabriel (tâche `G`)

```
Prépare le kit de la tâche <ID N> pour la tâche <ID G> : un exécutable (ou un script lisible) qui ne lit et
n'écrit que dans son dossier, n'ouvre aucune connexion réseau, ne collecte aucune donnée personnelle, et écrit un
unique fichier de résultat nommé <nom exact>.
Fournis : le kit, une fiche de consignes de 5 lignes maximum (où le mettre, comment le lancer, combien de temps
ça dure, quel fichier renvoyer, où le déposer), la somme SHA-256 du kit, le résultat d'un essai dans le nuage.
Vérifie par recherche textuelle dans le code qu'il n'y a aucun appel réseau ; colle le résultat.
Ajoute dans docs/MORNING.md, section « À faire par toi », l'entrée correspondante.
```

## 7. Traiter un retour de Gabriel (fichier reçu)

```
Gabriel a renvoyé <nom du fichier> pour la tâche <ID G>.
Range-le dans docs/v4/retours/<ID G>/, calcule son SHA-256, consigne-le dans le journal.
Ne modifie jamais l'original. Analyse sur une copie. Compare aux seuils écrits dans la tâche d'analyse <ID N suivant>.
Écris le verdict dans le rapport du spike ou du jalon, avec les chiffres réels. Si les chiffres sont absents ou
illisibles, dis-le et demande un nouvel essai : ne devine pas.
```

## 8. Session « direction » (documents seulement)

```
Session de direction : tu écris et tu audites, tu n'écris pas le code de production.
Entrées : docs/v4/organisation/00_LISEZ_MOI.md, docs/v4/04_REGISTRE_DES_DECISIONS.md, docs/PROGRESS.md, docs/MORNING.md.
Pour toute affirmation de fait, donne la source avec l'URL exacte ou le chemin et la ligne du fichier. Distingue :
(1) ce qui est établi par une source, (2) ce qui est interprétation, (3) ce qui n'est pas confirmé.
Signale l'incertitude au lieu d'inventer. Les wikis communautaires sont étiquetés « non officiels ».
Chaque décision prise va dans docs/DECISIONS.md (D-nnn) ; ce qui attend Gabriel va dans docs/MORNING.md.
```

## 9. Spike S7 (carte voxel) — session dédiée

```
Tâche : S7 (docs/v4/organisation/02_TABLEAU_DES_TACHES.md §4.8, procédure dans 03_PIPELINE_ASSETS_3D.md §4).
Préalables à vérifier AVANT toute opération : S7-a est « fait » (fichier de monde reçu, format, origine, auteur,
accord) ET la décision de provenance M0-02 est enregistrée dans docs/DECISIONS.md. Sinon : arrête-toi et écris
ce qui manque dans docs/MORNING.md.
Entrée : uniquement le FICHIER de monde fourni. Jamais une photo, une capture ou une vidéo.
Original : copie hors dépôt (assets_user/cartes_voxel/), SHA-256 consigné, original intact à la fin (recalcule-le).
Matériaux : créés par le projet. Aucune texture ni aucun fichier de ressources du jeu d'origine.
Commence par E2 (inventaire) ; l'échelle se calibre avec la procédure du §4.4 avant tout maillage.
Fais les deux modes sur le même quartier de 256 × 256 blocs. Rapport : docs/v4/spikes/S7.md avec les chiffres réels
(le rapport de fusion de l'essai synthétique, 23,8, ne compte pas).
```
