# 04 — Registre des décisions V4

> Statut : **PROPOSÉ** (relu et gelé à la sortie de M0, voir `03_PLAN_DE_PRODUCTION.md`).
> Dépend de : `01_CAHIER_DES_CHARGES.md`. Utilisé par : tous les autres documents V4.
> Étiquettes : `[C]` fait canon du lore · `[A]` choix de la direction, modifiable · `[?]` inconnu, à lever par un spike (`05_SPIKES_RISQUES.md`).
> Statuts : **FIGÉ** (décidé par Gabriel ou repris d'une règle déjà en vigueur) · **PROPOSÉ** (défaut de la direction, Gabriel peut le refuser jusqu'à la revue R-D1) · **PAR SPIKE** (tranché par une mesure, pas par une opinion).

## 0. Règle anti-retour (la raison d'être de ce registre)

1. Une décision **FIGÉE** ne se rouvre pas pendant un jalon. Elle ne change que par une *demande de changement* écrite (section 3), traitée **entre** deux jalons, jamais au milieu.
2. Tout ce qui est incertain est ramené à un **spike** chronométré avec un seuil réussite/échec **avant** d'écrire le code qui en dépend. Un spike échoué déclenche son repli déjà écrit, pas une discussion.
3. Une seule revue humaine large : **R-D1** (Gabriel relit les documents 01 et 04, corrige en une passe). Ensuite tout est gelé jusqu'à la fin de M0, puis jalon par jalon.

## 1. Décisions de Gabriel (2026-10-16)

| ID | Décision | Statut | Source |
|---|---|---|---|
| V4-D01 | Refonte **intégrale du code** : le jeu est reconstruit de zéro. Les spécifications, les données JSON et les modèles `.glb` du dépôt actuel sont réutilisés (voir `03`, section 3). | FIGÉ | réponse du 2026-10-16 |
| V4-D02 | Moteur : **Godot** (édition .NET, C#). Version stable constatée le 2026-10-16 : **4.7.2** (publiée le 18 août 2026), édition .NET proposée sur la page de téléchargement officielle. Version exacte à figer à la fin de S0. | FIGÉ (moteur) · PAR SPIKE (version) | réponse du 2026-10-16 ; godotengine.org/download/windows |
| V4-D08 | Machine minimale : **RTX 3050**, qualité réglable. Les gros modèles sont réservés aux réglages élevés et aux plans rapprochés. | FIGÉ | réponse du 2026-10-16 |
| V4-D09 | Style : **réaliste sombre, début du XXᵉ siècle** (matières lourdes, lumière naturelle, palette désaturée). | FIGÉ | réponse du 2026-10-16 |
| V4-D10 | Expérience de bataille : le joueur est **à la fois commandant** (niveau stratégique, placement des escouades) **et combattant** (il joue un soldat et dirige sa section) ; les IA à côté se commandent **à la voix**. | FIGÉ (principe) · PAR SPIKE (voix : S3) | réponse du 2026-10-16 |
| V4-D18 | Pas de longues phases de retour en arrière : tout est structuré en jalons à critères vérifiables, spikes d'abord, décisions gelées (section 0). | FIGÉ | réponse du 2026-10-16 |

## 2. Décisions reprises du projet actuel (inchangées)

| ID | Décision | Statut | Source |
|---|---|---|---|
| V4-D11 | **Provenance** : aucun fichier, modèle, texture, image ou capture de l'œuvre ou d'un fan dans le dépôt, aucun décalque. Les formes sont construites d'après des descriptions écrites. Les références visuelles personnelles de Gabriel restent **hors dépôt**. | FIGÉ | `CLAUDE.md`, D-167 |
| V4-D12 | **Lore** : la création est autorisée (enseignes, noms, lieux, apparences) ; une création est `A` avec `creation: true` et une raison ; les faits canon `C` (fichier 11, puis 01) ne sont jamais contredits. Les prénoms « Ilse » et « Frieda » sont autorisés. | FIGÉ | `ERRATA_V3.md` §2, D-167 |
| V4-D13 | **Règles de jeu** : `docs/spec/26_MECANIQUES_THEORIQUES.md` (sept piliers) et `27_MULTIJOUEUR_9_JOUEURS.md` (coopération, camps, trahison, `owner` obligatoire à plusieurs sièges par faction, D-168) restent la source des règles. Toute règle de ces fichiers que V4 modifie est notée dans `03` (colonne « Écart »). | FIGÉ | D-157, D-168 |
| V4-D19 | Toute action du joueur est une **commande typée et sérialisable** portant un siège (`owner`) ; connaissance par faction, brouillard par siège ; pas d'hypothèse « un seul joueur ». | FIGÉ | `CLAUDE.md`, D-168 |

## 3. Décisions de la direction proposées (à relire en R-D1)

| ID | Décision | Raison | Statut |
|---|---|---|---|
| V4-D03 | **Un seul langage, C#.** GDScript n'est utilisé que pour de petits scripts d'éditeur, jamais pour la simulation ni le réseau. | Un seul langage typé pour tout ce qui doit être testé ; évite la frontière entre deux langages. | PROPOSÉ |
| V4-D04 | **La simulation est une bibliothèque .NET pure** (`Sim`), sans aucune référence à Godot : pas de nœud, pas de physique du moteur, pas de temps système, pas d'aléa du système. Elle se teste avec `dotnet test`, sans moteur et sans GPU, donc dans les sessions de code en nuage. | Reproduit l'architecture actuelle (`src/sim` pure, 173 fichiers de tests) qui a permis d'avancer sans GPU. | PROPOSÉ |
| V4-D05 | **Données = les JSON du dépôt actuel**, validés par un schéma (conversion des schémas Zod en JSON Schema, une fois, dans l'ancien dépôt) et chargés par la bibliothèque `Data`. Aucune valeur d'équilibre `[A]` en dur dans le code. | Les 27 dossiers de `data/` (lieux : 2,1 Mo ; carte : 1 Mo) sont indépendants du langage. | PROPOSÉ |
| V4-D06 | **Déterminisme** (règles dans `02`, section 4) : générateur pseudo-aléatoire maison à graine injectée, pas de `System.Random`, pas d'horloge système, pas de dictionnaires parcourus sans ordre fixe, trigonométrie par tables, une seule version de l'exécutable et **Windows x64 uniquement** pour une même partie, empreinte d'état comparée régulièrement. | Lockstep à 9 joueurs (27). | PROPOSÉ · validé par S1 |
| V4-D07 | **Réseau** : lockstep déterministe, hôte séquenceur, étoile (27 §1–2) ; transport **UDP via ENet** (inclus dans Godot) à la place de WebSocket, avec WebSocket en repli. | Pas de serveur Node embarqué à maintenir ; ENet est le transport par défaut du multijoueur de Godot. Hypothèse à confirmer. | PAR SPIKE (S4) |
| V4-D14 | **Tests** : `dotnet test` pour `Sim`, `Data`, `Net` (dans le nuage) ; tests de scène et de captures par Godot en ligne de commande, **sur une machine avec GPU** (le PC de Gabriel ou un PC loué), jamais en rendu logiciel pour juger la fluidité. | Règle actuelle : « à vérifier sur le PC de Gabriel ». | PROPOSÉ |
| V4-D15 | **Dépôt** : un **nouveau dépôt privé** (`Murs-et-Sang-V4`) créé par Gabriel ; l'ancien dépôt est figé et sert de référence (lecture seule : spécifications, données, tests comme description du comportement). Tronc unique, un commit par tâche. | Évite de mélanger deux bases de code ; l'ancien dépôt reste intact. | PROPOSÉ · action de Gabriel requise |
| V4-D16 | **Chaîne de modèles** : Blender (scripts `bpy`) → glTF 2.0 → import Godot. Les 24 `.glb` actuels servent de prototypes ; ils n'ont **pas de squelette** : le rigging est un lot à part (M8). Corps de base : MakeHuman (CC0) comme prévu dans `CLAUDE.md`. | Chaîne déjà éprouvée dans l'ancien dépôt. | PROPOSÉ |
| V4-D17 | **Budgets de départ** (triangles, appels de dessin, nombre d'unités visibles) : valeurs `[?]` données dans `02` section 7, **mesurées puis remplacées** en S2 sur RTX 3050. Aucun objectif d'images par seconde avant cette mesure. | Règle actuelle (R1c) : pas d'objectif sans mesure sur GPU réel. | PAR SPIKE (S2) |
| V4-D20 | **Sauvegarde et rejeu** : journal de commandes + instantané périodique + empreinte d'état ; une partie se rejoue à l'identique à partir de sa graine et de son journal. | Prérequis du lockstep et de la reconnexion (27). | PROPOSÉ |
| V4-D21 | **Commande vocale** : fonctionnement **hors ligne**, grammaire fermée, appui-pour-parler, repli obligatoire au clavier et au menu radial, l'audio ne quitte jamais le PC (détail : `06`). | Latence, coût, vie privée, accessibilité. | PROPOSÉ · faisabilité PAR SPIKE (S3) |
| V4-D22 | **`owner` toujours présent** sur toute entité commandable (armées, flottes, escouades, sections, provinces, institutions). Plus de champ facultatif, plus de migration de sauvegardes. Vérifié au chargement de la partie. | Il n'y a pas de sauvegarde à conserver en V4 ; cela satisfait D-168 sans condition de « plusieurs sièges par faction ». | PROPOSÉ |

## 4. Demande de changement (modèle)

```
ID de la décision :
Demandé par / date :
Ce qui change :
Pourquoi maintenant (ce qui a été mesuré ou découvert) :
Documents et jalons touchés :
Coût estimé (jalons à refaire) :
Décision (Gabriel) : accepté / refusé / reporté à la fin du jalon
```
Une demande acceptée est traitée **à la fin du jalon en cours**, et le registre est mis à jour avant tout nouveau code qui en dépend.

## 5. Points à trancher par Gabriel (liste unique, pour R-D1)

| # | Question | Défaut si pas de réponse |
|---|---|---|
| 1 | Nouveau dépôt privé `Murs-et-Sang-V4` (V4-D15) : tu le crées, ou je prépare le contenu dans l'ancien dépôt sous `docs/v4/` en attendant ? | Contenu dans `docs/v4/` de l'ancien dépôt jusqu'à création du nouveau |
| 2 | Titans commandés par leurs joueurs jusqu'à ≈ saison 4 (27 §4.3) : conservé tel quel en V4 ? | Oui |
| 3 | Classement MoSCoW des possibilités nouvelles (`01`, section 6) | Défaut proposé dans le tableau |
| 4 | Mode « Reprise fidèle » ou « Refonte » pour chaque module (`03`, section 4) | Défaut proposé dans le tableau |
| 5 | Anti-triche et mode de connexion des amis (`27` §10 points 4 et 5) | Aucune anti-triche en V1 ; connexion au choix de l'hôte (réseau privé virtuel ou redirection de port) |
