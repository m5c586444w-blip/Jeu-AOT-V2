# 08 — Modèle de `CLAUDE.md` pour le dépôt V4

> Statut : **PROPOSÉ**. À copier à la racine du nouveau dépôt à la fin de S0 (ou dans `docs/v4/` de l'ancien dépôt tant que le nouveau n'existe pas). Il remplace, pour la V4, la section « Organisation du travail : deux sessions » de l'ancien `CLAUDE.md` : en V4 il n'y a plus qu'une piste de travail.
> Le bloc ci-dessous est le contenu du fichier. Les mots entre crochets `[…]` sont à compléter une fois la décision prise.

````markdown
# Murs et Sang V4 — mémoire de travail

> Projet personnel, non commercial, **privé** (Gabriel + amis invités, jamais publié).
> Ligne éditoriale : **réalisme, fidélité au lore, jouabilité**. Style : réaliste sombre, début du XXᵉ siècle.
> Source de vérité des décisions : `docs/v4/04_REGISTRE_DES_DECISIONS.md`. En cas de doute, il prime sur ce fichier.

## Lire d'abord
1. `docs/PROGRESS.md` : phase, tâche, dernier `verify`, **PROCHAINE ACTION EXACTE**.
2. `docs/v4/00_INDEX.md` : ordre de lecture.
3. Le jalon en cours : `docs/v4/03_PLAN_DE_PRODUCTION.md` (entrées, livrables, critères).

## Stack
- Godot [4.7.x, édition .NET — version exacte figée par S0] + C# ([version .NET figée par S0]).
- Solution : `Sim` (pure), `Data`, `Net`, `Voice`, `Tools`, tests `*.Tests`, projet Godot dans `game/`.
- Commandes : `dotnet build`, `dotnet test`, `Tools validate-data`, `Tools canon-check`, `Tools assets-check`, `Tools selftest`, **`verify`** (enchaîne tout). [noms exacts figés en M1]

## Règles de `Sim` (non négociables)
- Aucune référence à Godot, au réseau ou à la voix. Aucune horloge système, aucun `System.Random`, aucun parcours de `Dictionary`/`HashSet` sans tri, aucun multithread dans l'avancement d'un pas, pas de physique ni de navigation du moteur dans l'état partagé (`docs/v4/02_ARCHITECTURE.md` §4, R1–R9).
- Toute action du joueur est une **commande typée sérialisable** `{seat, tick, kind, payload}` ; `owner` est **toujours présent** sur toute entité commandable. Clavier, souris, voix et réseau produisent les mêmes commandes.
- Connaissance par faction, brouillard par siège ; jamais d'hypothèse « un seul joueur ».
- Valeurs d'équilibre `[A]` dans `data/`, jamais en dur.

## Lore et provenance
- La création est autorisée (enseignes, noms, lieux, apparences) : étiquette `A`, `creation: true`, raison consignée dans `docs/lore/creations.md`. Les faits canon `C` ne sont pas contredits (fichier 11 puis 01 des spécifications reprises).
- **Provenance : [texte de l'option choisie par Gabriel — `docs/v4/organisation/04_POLITIQUE_DE_PROVENANCE.md` §4 ; décision EN ATTENTE au 2026-10-17].** Tant qu'elle n'est pas écrite ici, la règle héritée s'applique à ce qui entre dans le dépôt : aucun fichier, modèle, texture, image, capture ou décalque de l'œuvre originale ou de fans ; formes construites d'après des descriptions écrites. Les références visuelles de Gabriel restent **hors dépôt** (`docs/v4/07_REFERENCES_VISUELLES.md`). Tout asset a une entrée au registre (`organisation/04` §5).
- Aucun CDN, aucune ressource payante, licences dans `docs/ASSETS_LICENSES.md`, provenance dans le manifeste d'assets.

## Travail
- **Une seule piste.** Un jalon `Mn` à la fois (`03`). Pas de fenêtres A/B, pas de verrou : si un second compte existe un jour, le protocole est à réécrire par une demande de changement.
- Tronc unique `[nom de la branche]` ; **un commit par tâche** ; `git pull --rebase` avant chaque push ; jamais de `--force`, jamais de suppression de branche.
- Un jalon commence par `docs/v4/jalons/Mn.md` (tâches, critères avec commandes, hors-périmètre) et finit par `docs/v4/rapports/Mn.md` (≤ 150 lignes, sorties réelles collées).
- **Terminé** = définition de `03` §6 : sortie réelle des commandes collée, captures décrites avec ≥ 3 défauts possibles, registre `04` à jour, revue indépendante (relecteur distinct de l'auteur), `PROGRESS.md` à jour.
- Une session **décide** et journalise (`docs/v4/04…`, section des décisions de la direction) ; elle n'attend pas Gabriel. Les décisions à valider vont dans `docs/MORNING.md`. Elle ne rouvre pas une décision FIGÉE (demande de changement entre deux jalons).
- Un risque non mesuré ne se code pas : il passe par un spike (`05`).

## Qualité
- **N'affirme jamais qu'un test est vert, ni qu'un critère passe, sans avoir collé la sortie réelle de la commande.** Un critère qui échoue deux fois : l'écrire dans le rapport et `docs/reports/dette.md`, puis passer à la suite.
- Critère visuel : ouvrir chaque capture, la décrire en 3 lignes et lister au moins 3 défauts possibles. Capture vide ou sans l'élément testé : critère KO.
- Un écran dont une valeur n'est pas branchée est un défaut, pas un « 0 ».
- Jamais de jugement de fluidité en rendu logiciel : fluidité = mesure sur GPU réel (PC de Gabriel). Interdit : optimiser pour le rendu logiciel.

## Interface
- **Un seul cadre d'interface** (barre supérieure, alertes, menu de gestion, fil de notifications, barre des joueurs), présent dans tous les modes. Pas d'entrée « Simulation de bataille » : la bataille se joue depuis la campagne.

## Arrêts
1. **Limite d'usage atteinte** : clôture propre (commit, `PROGRESS.md` avec la PROCHAINE ACTION EXACTE, push), arrêt.
2. **Action destructive** (force-push, suppression de branche ou de données) : interdite ; choisir l'alternative.
3. **Argent** : aucun achat, aucun paiement, aucun changement d'abonnement, aucune location de machine sans accord écrit de Gabriel.
4. **Une commande ne peut pas s'exécuter** après deux tentatives différentes : consigner, passer à une autre tâche.
5. **Contournement** : ne jamais contourner CAPTCHA, Cloudflare ou limite d'un service.
Toute autre difficulté : décider, journaliser, avancer.
````

## Notes pour la direction

- Le modèle est volontairement plus court que l'ancien `CLAUDE.md` : le détail vit dans `docs/v4/`, qui est lu dans l'ordre de `00_INDEX.md`.
- Les sessions automatiques (tâche programmée) sont **en pause** (décision de Gabriel du 2026-10-16). Leur reprise sur le nouveau dépôt est une décision séparée, à prendre après M0 : il faudra alors un environnement rattaché au nouveau dépôt, une fenêtre horaire et un budget d'usage.
