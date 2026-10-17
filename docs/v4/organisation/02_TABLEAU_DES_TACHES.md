# 02 — Tableau des tâches

> Statut : **PROPOSÉ** (2026-10-17). Détaille `docs/v4/03_PLAN_DE_PRODUCTION.md` (jalons) et `05_SPIKES_RISQUES.md` (spikes). Une ligne = une tâche = un commit de fin. Les identifiants de ce tableau sont **stables** : on ajoute des lignes, on ne renumérote jamais.
> La session de code met à jour la colonne **État** (et seulement elle) à chaque tâche, voir `01_PROTOCOLE_DE_SESSION.md` §3 et §6.

## 1. Lire le tableau

| Colonne | Sens |
|---|---|
| **ID** | `P-nn` lot de préparation · `Mn-nn` jalon · `Sn-x` spike (lettre = étape) · `B-nn` réserve |
| **État** | `à faire` · `en cours` · `fait AAAA-MM-JJ <commit>` · `bloqué (cause)` · `en réserve` |
| **Lieu** | `N` nuage (la session seule) · `G` PC de Gabriel (il lance, renvoie un fichier) · `H` décision ou fourniture de Gabriel |
| **Taille** | `S` moins d'une demi-session · `M` une session · `L` jusqu'à deux sessions (à découper en `.a`/`.b` si ça dépasse). **Estimations non mesurées**, recalibrées à la fin de M1 (`01_PROTOCOLE` §11). Aucune tâche `XL` : une tâche trop grosse est découpée avant d'être prise. |
| **Dépend de** | tâches (ou décisions) à `fait` avant de commencer |
| **Critère** | la commande à exécuter ou la mesure à relever, avec ce qui compte comme réussite. Sortie réelle collée dans le journal ou le rapport. |
| **Repli** | ce qu'on fait si le critère échoue deux fois, quand c'est connu ; sinon règle générale : consigner dans `docs/reports/dette.md` et passer à une autre tâche |

**Contrôle du tableau.** Après toute modification : `python3 -I docs/v4/organisation/annexes/controle_tableau.py docs/v4/organisation/02_TABLEAU_DES_TACHES.md` doit afficher `problèmes: []`, `doublons: []` et `dépendances inconnues: []` (colonnes, états, lieux, tailles, identifiants, dépendances, cycles, kit `N` avant toute tâche `G`).

**Tâches `G`.** Une tâche `G` n'est jamais seule : elle est précédée d'une tâche `N` qui prépare le **kit** (exécutable ou scène, fiche de consignes, nom exact du fichier à renvoyer) et suivie d'une tâche `N` qui analyse le retour. La session dépose le kit, Gabriel le lance, le fichier renvoyé est rangé dans `docs/v4/retours/<ID>/` (modalités : `organisation/08_ACTIONS_ET_DECISIONS_DE_GABRIEL.md` §4).

**Renvois.** Dans ce dossier, un numéro seul (`02`, `03`, `04`, `05`…) désigne le document de même numéro de `docs/v4/` (`02_ARCHITECTURE`, `03_PLAN_DE_PRODUCTION`, `04_REGISTRE_DES_DECISIONS`, `05_SPIKES_RISQUES`…) ; les fichiers de ce dossier sont toujours écrits `organisation/NN` ; `26` et `27` sont dans `docs/spec/` ; `U00`–`U15` dans `docs/v4/univers/`.

**Forme des commandes.** Elles suivent `02_ARCHITECTURE.md` §9 (`dotnet build`, `dotnet test`, `Tools validate-data`, `Tools canon-check`, `Tools assets-check`, `Tools selftest`, `verify`). Leur forme exacte (chemin du projet, options, importation Godot sans fenêtre) est **figée en S0 et M1-02**. Jusqu'à M1, les critères disent « équivalent de … » et la session écrit la commande réellement utilisée dans le journal.

## 2. Dérogation proposée (à confirmer par Gabriel, `organisation/08` n° 5)

Le lot **P**, et les spikes **S0, S1, S4** peuvent démarrer **avant** la réponse R-D1 : ils ne dépendent d'aucune réponse de Gabriel, ne figent rien et ne produisent que des mesures ou des fichiers de référence. Tant que le dépôt V4 n'existe pas (`04` §5 n° 1, défaut), leurs sorties vivent dans `docs/v4/` de ce dépôt (`docs/v4/portage/`, `docs/v4/spikes/`, `docs/v4/retours/`) et sont déplacées par M0-06.

## 3. Lot P — Préparation (dérogation ; lieu `N`)

Objectif : produire, une fois, les références dont dépend le portage « reprise fidèle » (`03` §4) : traces d'or, schémas, comptes. Les outils sont **ajoutés** à l'ancien dépôt sans modifier `src/sim` ; ils vivent dans `tools/golden/`.

Remarque d'environnement : `npm run typecheck` échoue déjà dans `src/net/wsTransport.ts` (module `ws` absent des dépendances installées, constaté le 2026-10-17, sans rapport avec la V4). Une session ne confond pas cet échec avec une régression de son travail ; elle le note et passe par `npx vitest run <fichier>` pour les tests ciblés.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| P-01 | à faire | Outil d'export de traces d'or (`tools/golden/`) : exécute un module avec une graine et une suite de commandes fixes, écrit un JSON canonique (commandes, ticks, empreinte tous les N ticks, états décodés à des ticks choisis) | N | M | — | l'outil lancé deux fois sur le même module donne deux fichiers identiques (`cmp` code 0) ; son test Vitest passe (`npx vitest run tools/golden`) ; `git diff --stat src/sim` est vide | si l'empreinte du module est instable d'une exécution à l'autre, l'instabilité est la trouvaille : consigner (`dette.md`) et la corriger dans la fiche P-10 |
| P-02 | à faire | Traces d'or : `core`, `commands`, `knowledge` (≥ 3 suites de commandes, ≥ 3 graines, forks nommés du générateur, sérialisation) | N | M | P-01 | fichiers `docs/v4/portage/golden/core-*.json` ; `cmp` entre deux exécutions ; en-tête de chaque fichier : module, graine, nombre de ticks, nombre de commandes | — |
| P-03 | à faire | Traces d'or : `world`, `strategic` | N | M | P-01 | idem P-02 (`world-*.json`, `strategic-*.json`) | — |
| P-04 | à faire | Traces d'or : `politics`, `events`, `intel`, `missions`, `research`, `shifters` | N | L | P-01 | idem P-02, un jeu de fichiers par module ; `events` couvre les 6 fichiers de `data/events` | découper en `P-04.a` (politics, events, intel) et `P-04.b` (missions, research, shifters) |
| P-05 | à faire | Traces d'or : `military`, `armies` et une année 845 complète (équivalent de `sim:year`) | N | M | P-01 | idem P-02 ; la trace d'année va de 845-01-01 au dernier jour de 845 sans erreur ; nombre d'événements consigné | — |
| P-06 | à faire | Traces d'or : `Pillars/Wall`, `Clock`, `Truth`, `Registry`, `Tide` (états aux ticks des tests de signature) | N | L | P-01 | idem P-02 ; la liste des tests de signature de chaque pilier est recopiée dans l'en-tête de sa trace | découper par pilier |
| P-07 | à faire | Références **de comportement** pour `tactical`, `Pillars/Gas`, `Pillars/Signal` (REFONTE : pas de reprise fidèle) : une bataille type, ses événements et sa durée, à titre de non-régression conceptuelle | N | S | P-01 | un fichier `docs/v4/portage/refs_comportement/tactical.md` : scénario, graine, résumé chiffré (nombre d'unités, pertes, durée en ticks) tiré d'une exécution réelle collée | — |
| P-08 | à faire | Conversion **une fois** des schémas Zod en JSON Schema (`docs/v4/portage/schemas/`) | N | M | — | un validateur JSON Schema indépendant (Python `jsonschema`, version consignée) valide les JSON de `data/` : 0 erreur là où `npm run data:validate` ne signale rien ; ≥ 10 fichiers volontairement faux sont rejetés par les deux | si un schéma Zod ne se convertit pas (raffinements, transformations), la règle correspondante passe dans le code de `Data` (M1-07) et la liste est écrite en tête de `docs/v4/portage/schemas/README.md` |
| P-09 | à faire | Inventaire chiffré : dossiers et fichiers de `data/`, tests et lignes par module de `src/sim` | N | S | — | un fichier `docs/v4/portage/inventaire.md` généré par script ; les chiffres de `03` §3 (29 dossiers de données, 27 fichiers de lieux, 173 fichiers de tests) sont confirmés ou corrigés avec la sortie du script collée | — |
| P-10 | à faire | Fiche « ce que le C# doit reproduire » extraite de `src/sim/core` : algorithme du générateur et de ses forks, ordre et format de sérialisation, arrondis, tris, tailles d'entiers (le JavaScript calcule en `double` et en 32 bits pour les opérations bit à bit) | N | M | P-02 | `docs/v4/portage/fiche_core.md` ; un sous-agent distinct la relit contre le code et rend une liste d'oublis (verdict écrit) ; zéro oubli bloquant | — |
| P-11 | à faire | Référence d'équilibre : sortie de `sim:balance` de l'ancien dépôt (graines, nombre de parties, résultats par camp) | N | S | — | `docs/v4/portage/refs_comportement/balance.md` avec la commande et la sortie réelle collées | — |

## 4. M0 — Cadrage et spikes

Entrées du jalon : R-D1 faite (sauf dérogation §2) ; accès au PC de Gabriel. Livrables : `docs/v4/spikes/S0.md` à `S7.md` (S7 : voir §4.8), version Godot/.NET figée, dépôt, `CLAUDE.md`.

### 4.1 Décisions et mise en place

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M0-01 | à faire | **R-D1** : Gabriel relit `01` et `04` et répond au point 5 de `04` | H | — | — | réponses consignées dans `docs/DECISIONS.md` (D-nnn) ; `04` mis à jour, statuts FIGÉ ou changés | défauts de `04` §5 appliqués après sept jours de silence, ce fait consigné |
| M0-02 | à faire | Politique de **provenance** : Gabriel choisit A, B ou C (`04_POLITIQUE_DE_PROVENANCE.md`) | H | — | — | choix consigné dans `DECISIONS.md` ; `V4-D11` passe de « EN ATTENTE » à FIGÉ avec le texte retenu | défaut en l'absence de réponse : option A pour tout ce qui entre dans le dépôt (`organisation/04` §7) ; les tâches concernées restent `bloqué (provenance)` |
| M0-03 | à faire | Gabriel donne le nom exact de sa carte graphique, sa mémoire vidéo, la version du pilote, son processeur et sa mémoire vive | H | — | — | les cinq valeurs figurent dans `docs/v4/spikes/S2.md` | un utilitaire de relevé (kit M0-04) lui évite de les chercher |
| M0-04 | à faire | Kit de relevé matériel : petit exécutable (ou script PowerShell lisible) qui écrit un fichier texte avec ces valeurs, sans aucune donnée personnelle | N | S | — | le fichier de sortie d'un essai dans le nuage ne contient aucun nom d'utilisateur ni chemin personnel (`grep` sur le dossier de l'utilisateur) ; la fiche de consignes tient en 5 lignes | — |
| M0-05 | à faire | Gabriel accorde l'accès à un dossier de son PC (pont de fichiers) ou décide de tout passer par pièces jointes | H | — | — | une écriture et une lecture de test réussies dans le dossier convenu (`organisation/08` n° 8) | pièces jointes |
| M0-06 | à faire | Mise en place du dépôt V4 (structure de `02_ARCHITECTURE.md` §3) ou, par défaut, des dossiers `v4/` et `docs/v4/` dans ce dépôt ; déplacement de `docs/v4/portage/` | N | M | M0-01 | `git ls-files` montre l'arborescence ; `README.md` de la racine pointe vers `docs/v4/organisation/00_LISEZ_MOI.md` | — |
| M0-07 | à faire | `CLAUDE.md` de la V4 (modèle : `docs/v4/08_MODELE_CLAUDE_MD.md`, avec la politique de provenance de M0-02) | N | S | M0-02, M0-06 | `CLAUDE.md` ≤ 150 lignes ; chaque règle renvoie à un fichier ; relu par un sous-agent distinct (aucune règle de l'ancien `CLAUDE.md` reprise sans décision) | — |
| M0-08 | à faire | Fiche du jalon `docs/v4/jalons/M0.md` (modèle `07_MODELES.md` §1) | N | S | M0-06 | fichier existant ≤ 1 page, chaque tâche M0 y figure | — |

### 4.2 S0 — Chaîne d'outils (dérogation)

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| S0-a | à faire | Installer le SDK .NET et Godot 4.7.x édition .NET dans le nuage (versions exactes consignées) | N | S | — | `dotnet --version` et la version de Godot collées dans `S0.md` ; fichiers téléchargés ajoutés au journal avec leur origine | si le téléchargement de Godot est refusé par le réseau du nuage (deux tentatives), consigner et poursuivre avec `dotnet` seul : S0-b et suivants basculent sur le repli de `05` S0 |
| S0-b | à faire | Projet vide : bibliothèque `Sim` + un test + projet Godot ; `dotnet build` et `dotnet test` ; import du projet Godot en ligne de commande sans fenêtre | N | M | S0-a | trois codes de sortie 0 collés ; la commande d'import sans fenêtre est écrite telle qu'elle a fonctionné (`02_ARCHITECTURE` en dépend) | — |
| S0-c | à faire | Export Windows depuis le nuage (modèles d'export installés) et kit : exécutable qui affiche une valeur calculée par `Sim` | N | M | S0-b | un `.exe` produit ; sa taille et son empreinte SHA-256 consignées ; fiche de consignes (3 lignes) | repli de `05` S0 : export sur une machine Windows |
| S0-d | à faire | Gabriel lance l'exécutable et renvoie une capture ou le fichier de sortie | G | — | S0-c, M0-05 | le fichier de retour contient la valeur attendue (comparée à celle du nuage) | — |
| S0-e | à faire | Verdict S0 : version figée, `04` V4-D02 mis à jour, `docs/v4/spikes/S0.md` | N | S | S0-d | verdict PASS/FAIL daté ; version exacte de Godot et de .NET dans `04` | — |

### 4.3 S1 — Déterminisme (dérogation)

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| S1-a | à faire | Mini-noyau : générateur maison, tables sinus/cosinus, 400 unités qui se déplacent et s'attaquent, empreinte tous les 100 ticks | N | L | S0-b | `dotnet test` vert ; l'empreinte du tick 12 000 est identique sur 3 exécutions locales | — |
| S1-b | à faire | Variante virgule fixe du même noyau (pour le repli de R4) | N | M | S1-a | même sortie de test ; écart de temps par tick relevé entre les deux variantes | peut attendre un FAIL de S1-d |
| S1-c | à faire | Exécution Linux : 10 graines × 12 000 ticks, fichiers d'empreintes | N | S | S1-a | 10 fichiers ; relancer donne les mêmes fichiers (`cmp` code 0) | — |
| S1-d | à faire | Kit Windows : exécutable qui rejoue les mêmes 10 graines et écrit ses empreintes ; fiche | N | M | S1-c, S0-c | exécutable produit ; fiche de 3 lignes ; nom du fichier de retour fixé | — |
| S1-e | à faire | Gabriel lance l'exécutable et renvoie le fichier d'empreintes | G | — | S1-d, M0-05 | fichier reçu et rangé dans `docs/v4/retours/S1-e/` | — |
| S1-f | à faire | Comparaison et verdict : 10 graines × toutes les empreintes tous les 100 ticks | N | S | S1-e | **PASS** si toutes identiques (variante « double + tables ») ; **FAIL** → repli de `05` S1 (virgule fixe) et nouveau passage S1-c à S1-f ; `S1.md` ; V4-D06 mis à jour | — |

### 4.4 S2 — Niveaux de détail et foules sur RTX 3050

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| S2-a | à faire | Scène de mesure : un lieu réel de `data/places`, 400 unités simulées (10 L0, 60 L1, le reste instancié), soleil avec ombres, modèles provisoires ; préréglages Bas et Moyen ; compteur de trame, de mémoire vidéo et d'appels de dessin écrit dans un fichier | N | L | S0-c, P-08 | scène chargée sans erreur en import sans fenêtre ; le fichier de mesures est produit même en rendu logiciel (valeurs non retenues, seule la chaîne est testée) | — |
| S2-b | à faire | Kit de mesure : exécutable + fiche (lancer, attendre 3 minutes, renvoyer le fichier) pour chaque préréglage | N | S | S2-a, M0-04 | exécutable produit ; fiche de 5 lignes | — |
| S2-c | à faire | Gabriel lance les mesures sur son PC | G | — | S2-b, M0-03, M0-05 | fichiers reçus pour Bas et Moyen à 1080p, avec et sans mise à l'échelle de l'image | — |
| S2-d | à faire | Analyse : médiane et 95ᵉ centile du temps de trame, mémoire vidéo, appels de dessin ; budgets de `02` §7 remplacés par les valeurs mesurées | N | M | S2-c | **PASS `[A]`** : préréglage Bas ≤ 33 ms au 95ᵉ centile pour 400 unités, mémoire sous celle de la carte avec marge ; le seuil définitif est **fixé par Gabriel** à la lecture ; `S2.md` ; V4-D17 mis à jour | repli de `05` S2 |

### 4.5 S3 — Commande vocale

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| S3-a | à faire | Grammaire d'essai : 60 commandes (`06_COMMANDE_VOCALE.md` §3) et 100 énoncés à dire, fiche de lecture | N | M | — | fichier d'énoncés ; chaque énoncé est lié à une commande de la grammaire ; contrôle automatique : 100 énoncés, 60 commandes couvertes | — |
| S3-b | à faire | Choix d'au plus deux moteurs de reconnaissance **locale** en français (licence, taille, installation hors ligne, fonctionnement sous Windows) ; chaque affirmation sur un moteur est accompagnée de son URL de documentation | N | M | — | tableau dans `S3.md` : moteur, version, licence, taille, source (URL) ; ce qui n'a pas pu être vérifié est marqué `[?]` | — |
| S3-c | à faire | Banc d'essai : outil qui lit des fichiers audio, fait reconnaître, compare à la commande attendue, mesure la latence | N | L | S3-a, S3-b | essai sur des échantillons synthétiques ou libres de droits : l'outil produit un tableau (taux, latence) ; aucune voix de Gabriel n'est nécessaire à ce stade | — |
| S3-d | à faire | Kit d'enregistrement : programme qui présente les 100 énoncés, enregistre en pièces locales et renvoie les fichiers | N | M | S3-c, M0-04 | exécutable produit ; **aucun envoi réseau** (contrôle : le code n'ouvre aucune connexion, recherche textuelle consignée) | — |
| S3-e | à faire | Gabriel dit les 100 énoncés : pièce calme, puis avec le son du jeu actif | G | — | S3-d, M0-05 | deux jeux de fichiers reçus | — |
| S3-f | à faire | Analyse et verdict | N | M | S3-e | **PASS `[A]`** : ≥ 90 % de commandes correctes, latence médiane ≤ 1,5 s, charge ≤ 1 cœur en moyenne ; **FAIL** → N02 passe en « Could », ordres au menu radial et clavier ; V4-D21 mis à jour | repli de `05` S3 |

### 4.6 S4 — Réseau lockstep (dérogation)

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| S4-a | à faire | Hôte et client sans interface au-dessus du mini-noyau de S1, transport ENet | N | L | S1-a | 1 hôte + 1 client échangent 12 000 ticks, empreintes identiques | si ENet n'est pas disponible sans moteur, utiliser le moteur en mode sans fenêtre ; sinon WebSocket (repli de `05` S4) |
| S4-b | à faire | 9 clients, perte de paquets 2 % et latence 100 ms ± 50 simulées (par l'outil système si le nuage l'autorise ; sinon enveloppe de transport qui retarde et perd) | N | M | S4-a | la perte et la latence effectivement appliquées sont mesurées et collées | enveloppe de transport (les deux méthodes ne sont pas équivalentes : le noter) |
| S4-c | à faire | 10 graines × 10 minutes | N | M | S4-b | journal des 10 graines ; 0 désynchronisation | — |
| S4-d | à faire | Coupure d'un client puis réintégration (instantané + journal) | N | M | S4-c | réintégration < 10 s, aucun blocage durable | — |
| S4-e | à faire | Verdict S4 : `S4.md`, V4-D07 mis à jour | N | S | S4-d | **PASS** si 0 désynchronisation, réintégration < 10 s, pas de blocage durable ; sinon repli de `05` S4 | — |

### 4.7 S5 — Ressenti du combattant et S6 — Chaîne de modèles

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| S5-a | à faire | Prototype 3ᵉ personne : mouvement ODM par ancrages, simulation à 20 Hz, retard d'entrée de 3 ticks, présentation interpolée, sur modèle provisoire | N | L | S0-c, S1-f | prototype chargé sans erreur ; trajectoires de test reproductibles (`cmp`) | — |
| S5-b | à faire | Kit : exécutable + fiche de notation (réactivité, précision, plaisir, 1 à 5) | N | S | S5-a | exécutable produit ; fiche d'une page | — |
| S5-c | à faire | Gabriel joue 15 minutes et note | G | — | S5-b, M0-05 | fiche remplie reçue | — |
| S5-d | à faire | Verdict S5 : `S5.md` | N | S | S5-c | **PASS `[A]`** : moyenne ≥ 3,5/5 et aucun « injouable » ; **FAIL** → repli de `05` S5 (cadence, puis ancrage désigné) | — |
| S6-a | à faire | Importer les 24 `.glb` actuels dans Godot (sans fenêtre) | N | S | S0-b | 24 modèles chargés ; liste des triangles par modèle | — |
| S6-b | à faire | Base de corps : vérifier la licence et la source du corps de base (selon `organisation/04`), l'importer dans Blender (`bpy`) | N | M | S0-a, M0-02 | licence relevée sur la page officielle (URL consignée) ; fichier importé ; entrée au registre d'assets | si le dépôt n'est pas joignable (deux tentatives), modéliser un corps de base au projet |
| S6-c | à faire | Squelette de soldat, tenue skinnée, animations marche, course, pose ODM | N | L | S6-b | script `tools/blender/` versionné ; export `.glb` ; relecture dans Godot : os et animations nommés comme attendu | animation par pièces rigides pour L2/L3 (`05` S6) |
| S6-d | à faire | Niveaux L0 à L3, décalque d'emblème, relevés (triangles, temps d'import, mémoire) | N | M | S6-c | chaque niveau respecte `02` §7 (valeurs de S2 si connues) ; manifeste valide | — |
| S6-e | à faire | Planche de revue (images fixes) à regarder | N | S | S6-d | planche produite ; les captures sont ouvertes et décrites avec ≥ 3 défauts chacune (`05_DEFINITION_DE_FINI` §4) | — |
| S6-f | à faire | Gabriel regarde la planche et dit si le niveau de qualité convient | H | — | S6-e | réponse consignée | — |
| S6-g | à faire | Verdict S6 : `S6.md`, V4-D16 mis à jour | N | S | S6-f | **PASS** si un soldat complet va de Blender à Godot dans les budgets et avec manifeste valide | repli de `05` S6 |

### 4.8 S7 — Décors issus d'une carte voxel (proposé : V4-D23, `03_PIPELINE_ASSETS_3D.md`)

Le spike S7 n'est pas dans `05` tant que Gabriel n'a pas confirmé l'idée ; il est écrit ici pour être lancé dès que le fichier de carte est fourni. **Jamais à partir d'une photo ou d'une capture** : seulement du fichier de monde.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| S7-a | à faire | Gabriel fournit le fichier de la carte, son format, Java ou Bedrock, son origine et son auteur, et dit s'il a l'accord de l'auteur | H | — | — | fichier reçu dans `docs/v4/retours/S7-a/` **hors du dépôt public** (voir `organisation/04`) ; réponses aux quatre questions de `organisation/08` n° 9 | sans accord de l'auteur : option « plan masse » seulement (reconstruction avec les kits du projet) |
| S7-b | à faire | Inventaire du monde : emprise, hauteurs, nombre de blocs par type, régions occupées ; installation d'un lecteur de format (version consignée) | N | M | S7-a, M0-02 | tableau dans `S7.md` ; le lecteur relit au moins une région sans erreur ; types de blocs non reconnus listés | si le format n'est pas lisible, demander une exportation intermédiaire (liste dans `organisation/08`) |
| S7-c | à faire | Table « bloc → matériau du projet » : une ligne par type de bloc présent, matériau PBR **créé par le projet** (aucune texture d'origine) | N | M | S7-b, M0-02 | chaque type de bloc de l'inventaire a une ligne ; un test échoue si un bloc présent n'a pas de matériau | — |
| S7-d | à faire | Maillage fusionné par morceaux de 64 × 64 ; export `.glb` par morceau ; mesure des triangles réels | N | L | S7-c | tableau : triangles par morceau (médiane, maximum, total) et rapport de fusion **réel** (le 23,8 de l'essai synthétique n'est pas retenu) ; relecture d'un morceau : normales conformes ≥ 0,999 | si le rapport de fusion est faible, réduire par niveaux de détail ou passer au mode « plan masse » |
| S7-e | à faire | Mode « plan masse » : extraction de l'emprise des bâtiments, hauteurs, toits, rues, remparts en un fichier de plan | N | L | S7-b | fichier de plan pour **un quartier** de 256 × 256 blocs ; rendu de contrôle du plan | — |
| S7-f | à faire | Grille d'occupation et de hauteur pour `Sim` depuis la carte (navigation propre, R6) | N | M | S7-b | grille d'un quartier ; test : un chemin entre deux points ne traverse aucun bloc plein | — |
| S7-g | à faire | Import dans Godot (sans fenêtre), niveaux de détail par distance, lumière et atmosphère du projet | N | L | S7-d | scène du quartier chargée sans erreur ; temps de chargement relevé | — |
| S7-h | à faire | Kit de mesure sur RTX 3050 (même gabarit que S2-b) | N | S | S7-g, S2-b | exécutable et fiche | — |
| S7-i | à faire | Gabriel lance la mesure | G | — | S7-h | fichier reçu | — |
| S7-j | à faire | Comparaison des deux modes sur un même quartier et verdict ; recommandation à Gabriel | N | M | S7-i, S7-e | **PASS `[A]`** : un quartier de 256 × 256 blocs au préréglage Bas ≤ 33 ms au 95ᵉ centile avec 400 unités ; seuils définitifs fixés par Gabriel ; `S7.md` ; V4-D23 mis à jour | repli : mode « plan masse » seul |

### 4.9 Fin de M0

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M0-09 | à faire | Revue R-M0 : un sous-agent distinct relit les verdicts de spikes contre leurs sorties | N | S | S0-e, S1-f, S2-d, S3-f, S4-e, S5-d, S6-g | verdict écrit : chaque PASS/FAIL est justifié par une sortie collée | — |
| M0-10 | à faire | Gel de M0 : `04` — D06, D07, D17, D21 passés à FIGÉ ou repli activé ; version Godot et .NET figées ; `docs/v4/rapports/M0.md` (≤ 150 lignes) ; `PROGRESS.md` | N | S | M0-09 | `04` contient les nouveaux statuts ; rapport présent | — |

## 5. M1 — Squelette technique

Livrable : un projet qui compile, se teste, se rejoue (`03` M1).

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M1-01 | à faire | Solution .NET : projets `Sim`, `Data`, `Net`, `Voice`, `Tools` et leurs projets de tests, avertissements = erreurs | N | S | M0-10 | `dotnet build` code 0 ; `dotnet test` code 0 avec ≥ 1 test par projet | — |
| M1-02 | à faire | Scripts `verify` et `verify:rapide` ; la forme exacte de toutes les commandes est écrite dans `CLAUDE.md` | N | M | M1-01 | `verify` code 0 ; la sortie liste chaque étape (build, tests, données, canon, assets, selftest) | — |
| M1-03 | à faire | Générateur pseudo-aléatoire maison et forks nommés, d'après la fiche P-10 | N | M | M1-01, P-10 | `dotnet test --filter Golden.Rng` : les 1 000 premières valeurs de chaque fork reproduisent la trace d'or | si la reproduction exacte est impossible (arithmétique JavaScript), passer aux traces comparées par **valeurs décodées** et non par empreinte, noter la décision (`DECISIONS.md`) |
| M1-04 | à faire | Sérialisation canonique et empreinte d'état 64 bits (R7) | N | M | M1-03 | `dotnet test --filter Golden.Hash` vert ; deux ordres d'insertion différents donnent la même empreinte | idem M1-03 |
| M1-05 | à faire | Lanceur de traces d'or (`Tools golden <fichier>`) : rejoue, compare, signale le premier tick divergent | N | M | M1-04, P-02 | sur une trace volontairement altérée : code de sortie ≠ 0 et tick divergent indiqué ; sur la trace saine : code 0 | — |
| M1-06 | à faire | Noyau d'état, de tick et de commandes (`core`, `commands`) | N | L | M1-05 | première trace d'or `core` reproduite ; `Tools selftest` : 3 exécutions identiques (`cmp`) | — |
| M1-07 | à faire | `Data` : chargement typé et validation par les schémas de P-08 de tous les JSON de `data/` | N | L | M1-01, P-08 | `Tools validate-data` : 0 erreur ; les ≥ 10 fichiers faux de P-08 sont rejetés | règles non convertibles écrites en code (voir P-08) |
| M1-08 | à faire | Projet Godot qui charge un état de `Sim` et affiche une valeur | N | M | M1-06, S0-e | import sans fenêtre code 0 ; une scène de test écrit la valeur lue dans un fichier, comparée à celle du test .NET | — |
| M1-09 | à faire | Portage de `canon:check` et `assets:check` (`Tools canon-check`, `Tools assets-check`) et du registre de provenance (`organisation/04`) | N | L | M1-07, M0-02 | les deux commandes passent sur `data/` et les assets de départ ; un jeu de fichiers fautifs (≥ 6 cas : fait `C` contredit, création `A` mal déclarée, asset sans entrée, origine non admise, licence absente, empreinte fausse) est rejeté | — |
| M1-10 | à faire | Garde-fous de déterminisme dans `Sim` : analyse de code qui interdit `System.Random`, `DateTime`, `Stopwatch`, itération non ordonnée de `Dictionary`/`HashSet`, état statique mutable, multithread (R1–R3, R5, R9) | N | M | M1-01 | `dotnet build` échoue sur un fichier de test fautif pour chacune des 6 règles et réussit sur le dépôt | — |
| M1-11 | à faire | Recalcul des tailles du tableau d'après l'usage réel consigné au journal | N | S | M1-06 | tableau mis à jour (colonne Taille), écart moyen estimé/réel consigné | — |
| M1-12 | à faire | Rapport M1, revue indépendante, gel | N | S | M1-02 à M1-11 | `docs/v4/rapports/M1.md` ; verdict de relecture écrit ; `verify` collé | — |

## 6. M2 — Simulation stratégique

Mode REPRISE FIDÈLE pour tout (`03` §4). Chaque tâche de portage a le même critère de base : **la trace d'or du module est reproduite** (`Tools golden docs/v4/portage/golden/<module>-*.json` code 0) et `dotnet test --filter <Module>` est vert.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M2-01 | à faire | `knowledge` (connaissance par faction) avec `owner` obligatoire sur toute entité commandable (V4-D22) | N | M | M1-12 | trace d'or ; test : charger une entité sans `owner` échoue avec un message clair | — |
| M2-02 | à faire | `world` (carte, provinces, adjacences) | N | L | M2-01, P-03 | trace d'or ; les 126 provinces de l'atlas chargées | — |
| M2-03 | à faire | `strategic` | N | L | M2-02 | trace d'or | — |
| M2-04 | à faire | `politics` | N | M | M2-03, P-04 | trace d'or | — |
| M2-05 | à faire | `events` (les 6 fichiers de `data/events`) | N | M | M2-04 | trace d'or | — |
| M2-06 | à faire | `intel` | N | M | M2-04 | trace d'or | — |
| M2-07 | à faire | `missions` | N | M | M2-05 | trace d'or | — |
| M2-08 | à faire | `research` | N | M | M2-04 | trace d'or | — |
| M2-09 | à faire | `shifters` | N | M | M2-04 | trace d'or | — |
| M2-10 | à faire | Scénarios de campagne sans bataille de bout en bout | N | M | M2-05 à M2-09 | `Tools selftest` reproduit les empreintes de référence des scénarios `[?]` (si la reprise à l'identique est confirmée en M1-03/04) ; sinon comparaison par valeurs décodées | — |
| M2-11 | à faire | Rapport M2, revue de fin de M2 (`03` §7) par relecteur distinct, gel | N | S | M2-10 | `docs/v4/rapports/M2.md` ; verdict écrit | — |

## 7. M3 — Armées et campagne militaire

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M3-01 | à faire | `military` | N | L | M2-11, P-05 | trace d'or | — |
| M3-02 | à faire | `armies` (piles, rencontres, sièges, expéditions) | N | L | M3-01 | trace d'or | découper en `.a` (piles, expéditions) et `.b` (rencontres, sièges) |
| M3-03 | à faire | Interface rencontre → bataille : types `BattleRequest` / `BattleOutcome` et **résolution automatique** (placeholder) en attendant M5 | N | M | M3-02 | test : une rencontre produit une `BattleOutcome` appliquée à l'état, déterministe sur 10 graines | — |
| M3-04 | à faire | Année 845 complète | N | S | M3-03 | année simulée sans erreur ; trace d'année de P-05 reproduite | — |
| M3-05 | à faire | Rapport M3 et revue | N | S | M3-04 | `docs/v4/rapports/M3.md` ; verdict écrit | — |

## 8. M4 — Piliers de campagne

Activés par défaut en V4. Critère de base de chaque pilier : trace d'or reproduite **et** tests de signature portés avec lui.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M4-01 | à faire | `Pillars/Wall` | N | L | M3-05, P-06 | trace d'or ; tests de signature | — |
| M4-02 | à faire | `Pillars/Clock` | N | L | M4-01 | idem | — |
| M4-03 | à faire | `Pillars/Truth` | N | L | M4-01 | idem | — |
| M4-04 | à faire | `Pillars/Registry` | N | L | M4-01 | idem | — |
| M4-05 | à faire | `Pillars/Tide` | N | L | M4-01 | idem | — |
| M4-06 | à faire | Test « Marley–Paradis à densité de Titans nulle » | N | S | M4-05 | test vert (sortie collée) | — |
| M4-07 | à faire | `Tools balance` sans régression par rapport à P-11 | N | M | M4-05, P-11 | écart des résultats par camp ≤ seuil consigné `[A]` (valeur choisie et justifiée dans le rapport) | si l'écart dépasse le seuil : cause cherchée dans les traces, consignée |
| M4-08 | à faire | Rapport M4 et revue | N | S | M4-06, M4-07 | `docs/v4/rapports/M4.md` ; verdict écrit | — |

## 9. M5 — Bataille (simulation)

Mode REFONTE : la spécification est écrite et relue **avant** le code (`03` §4). Aucune physique ni navigation du moteur dans l'état partagé (R6).

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M5-01 | à faire | Spécification de la bataille V4 (`docs/v4/spec/bataille.md`) : états, ODM, gaz, ancrage, navigation, formations, ordres, commandes du combattant, brouillard par siège, interface `BattleRequest`/`BattleOutcome` | N | L | M3-05, S5-d, P-07 | chaque règle de `26` §4–5 est reprise ou écartée avec une raison ; relue par un sous-agent distinct (liste des ambiguïtés) | — |
| M5-02 | à faire | Navigation propre : grille et maillage de navigation, recherche de chemin déterministe | N | L | M5-01, S7-f si retenue | test : 1 000 chemins sur 3 cartes identiques sur 3 exécutions (`cmp`) | — |
| M5-03 | à faire | Ancrages et trajectoires ODM dans `Sim` | N | L | M5-02 | tests de trajectoire ; rejeu identique sur 10 graines | ancrage désigné (repli S5) |
| M5-04 | à faire | `Pillars/Gas` (consommation, recharge, pénuries) | N | M | M5-03 | tests de signature P3 | — |
| M5-05 | à faire | Lames, lance de foudre, dégâts, points faibles | N | M | M5-03 | tests de combat chiffrés | — |
| M5-06 | à faire | Commandes du combattant (déplacement, ancrer, tirer le câble, trancher, recharger) comme commandes typées sérialisables avec `owner` | N | M | M5-05 | test : une commande d'un siège non propriétaire est refusée (`seat.err.not_owner`) | — |
| M5-07 | à faire | Titans : comportement, perception, attaque, régénération selon `26` | N | L | M5-05 | tests de comportement sur 10 graines | — |
| M5-08 | à faire | Formations et ordres de commandant (placer, déplacer, attaquer, replier, tenir) | N | L | M5-02 | tests ; chaque ordre est une commande typée | — |
| M5-09 | à faire | `Pillars/Signal` (fusées, portée, brouillard par siège) | N | L | M5-08 | tests de signature P4 ; test : un siège ne voit pas ce que son brouillard cache | — |
| M5-10 | à faire | Escouades IA qui exécutent les ordres (cible de la commande vocale) | N | L | M5-08 | scénario de test : un ordre donné, l'escouade l'exécute et le journal le montre | — |
| M5-11 | à faire | Kit de mesure : bataille de 400 unités, temps par tick | N | S | M5-10, S2-b | exécutable et fiche | — |
| M5-12 | à faire | Gabriel lance la mesure sur son PC | G | — | M5-11 | fichier reçu | — |
| M5-13 | à faire | Analyse du temps par tick ; rejeu identique sur 10 minutes de bataille | N | M | M5-12 | temps par tick relevé et comparé au pas de 50 ms (20 Hz) ; rejeu : empreintes identiques sur 12 000 ticks | si le temps par tick dépasse le pas : profilage, puis repli de `27` |
| M5-14 | à faire | Rencontre campagne → vraie bataille (remplace la résolution automatique de M3-03) | N | M | M5-13 | `BattleOutcome` appliqué à l'état ; `Tools selftest` reproduit les empreintes d'une campagne avec bataille | conserver la résolution automatique en option de salon |
| M5-15 | à faire | Rapport M5 et revue de fin de M5 | N | S | M5-14 | `docs/v4/rapports/M5.md` ; verdict écrit | — |

## 10. M6 — Réseau

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M6-01 | à faire | Protocole (enveloppes de commandes, version de protocole, empreintes), repris de l'ancien `src/net` | N | M | M1-12, S4-e | tests d'aller-retour de chaque type de message | — |
| M6-02 | à faire | Hôte séquenceur et clients (ENet ou repli de S4) | N | L | M6-01 | 1 hôte + 3 clients, 5 minutes, 0 désynchronisation | — |
| M6-03 | à faire | Salon : sièges, choix du camp selon le scénario, limites d'équilibre | N | L | M6-02 | test : choix hors limites refusé | — |
| M6-04 | à faire | Votes (pause, paramètres) | N | M | M6-03 | tests des règles de vote de `27` | — |
| M6-05 | à faire | Conseil mixte joueurs + conseillers IA | N | L | M6-03 | scénario de test : un siège humain et un conseiller IA dans un même camp | — |
| M6-06 | à faire | Coffre de secrets pour la trahison | N | L | M6-05 | test : un secret de traître ne figure pas dans l'état partagé ; l'hôte peut le lire (noté dans la notice) | — |
| M6-07 | à faire | Instantanés et reconnexion en bataille | N | L | M6-02, M5-15 | reconnexion sans rupture d'empreinte | — |
| M6-08 | à faire | 9 clients sans interface, 10 minutes, 10 graines | N | M | M6-07 | 0 désynchronisation | — |
| M6-09 | à faire | `Tools balance` : 200 parties IA par scénario | N | M | M6-08 | aucun camp au-dessus de 60 % `[A]` | — |
| M6-10 | à faire | Rapport M6 et revue de fin de M6 | N | S | M6-09 | `docs/v4/rapports/M6.md` ; verdict écrit | — |

## 11. M7 — Présentation, tranche verticale

Critère du jalon : bataille jouable de bout en bout avec **modèles provisoires**. Les modèles définitifs viennent en M8.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M7-01 | à faire | Racine de scène unique avec le **cadre d'interface** (barre supérieure, alertes, menu de gestion, fil de notifications, barre des joueurs) monté une fois | N | L | M5-15, M1-08 | test sans fenêtre : 6 modes (carte, conseil, bataille, lieux, tutoriel, options) × 5 éléments du cadre présents ; code 0 | — |
| M7-02 | à faire | Pont `Sim` ↔ interface : l'interface ne reçoit que la vue du siège local | N | M | M7-01 | test .NET : l'interface ne peut pas lire une entité hors brouillard | — |
| M7-03 | à faire | Traduction : clés partout, aucun texte joueur en dur | N | M | M7-01 | analyse de code : 0 chaîne de texte joueur en dur dans `game/` | — |
| M7-04 | à faire | Carte de campagne (rendu) | N | L | M7-02 | scène chargée sans erreur ; 126 provinces affichées (comptage dans un test) | — |
| M7-05 | à faire | Écrans de gestion (provinces, institutions, conseil, recherche, expéditions, politique, registre des morts) | N | L | M7-04 | un écran par système ; test : chaque écran se charge | découper par écran |
| M7-06 | à faire | Alertes et fil de notifications branchés sur les événements de `Sim` | N | M | M7-05 | test : un événement de `Sim` produit une notification | — |
| M7-07 | à faire | Scène de bataille 3D : terrain d'une carte de bataille minimale, modèles provisoires, soleil | N | L | M7-02 | scène chargée ; 400 unités affichées en instances (comptage) | — |
| M7-08 | à faire | Caméra commandant, sélection, ordres souris/clavier, menu radial | N | L | M7-07 | scénario scripté : sélectionner, ordonner, vérifier la commande émise | — |
| M7-09 | à faire | Mode combattant : 3ᵉ personne, ODM, lames | N | L | M7-07, S5-d | scénario scripté : atteindre un ancrage et trancher | — |
| M7-10 | à faire | Passage commandant ↔ combattant (touche dédiée, carte réduite et radio) | N | M | M7-08, M7-09 | test : un siège ne peut prendre le contrôle que d'un soldat qui lui appartient | — |
| M7-11 | à faire | Retour de bataille vers la campagne (résultat appliqué à l'état) | N | M | M7-10 | test : état de campagne mis à jour, empreinte reproductible | — |
| M7-12 | à faire | Qualités Bas et Moyen, menu d'options | N | M | M7-07 | les deux préréglages se chargent ; réglages enregistrés | — |
| M7-13 | à faire | Script de parcours (équivalent de `smoke:bataille`) et script de captures du cadre (équivalent de `smoke:cadre`) en 1366 × 768 et 3840 × 2160 | N | M | M7-11 | scripts exécutés en rendu logiciel : chaîne OK, **images non jugées** ; fiche et kit pour G | — |
| M7-14 | à faire | Gabriel (ou le PC convenu) lance les scripts sur une machine avec GPU | G | — | M7-13 | fichiers et captures reçus | — |
| M7-15 | à faire | Lecture des captures par un **second relecteur** : chaque capture ouverte, décrite en 3 lignes, ≥ 3 défauts listés | N | M | M7-14 | rapport de relecture ; capture vide ou sans l'élément testé = critère KO | — |
| M7-16 | à faire | Fluidité mesurée par Gabriel sur RTX 3050 | G | — | M7-13, M7-14 | fichier de mesures reçu ; le seuil de S2 appliqué | — |
| M7-17 | à faire | Rapport M7 et revue de fin de M7 | N | S | M7-15, M7-16 | `docs/v4/rapports/M7.md` ; verdict écrit | — |

## 12. M8 — Modèles et animations

Peut s'intercaler dès M1 quand le travail Blender est plus léger (`03` §5). Politique de provenance : `organisation/04`.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M8-01 | à faire | Squelette de soldat partagé et conventions (noms d'os, noms d'animations) | N | M | S6-g | un modèle chargé dans Godot expose les noms attendus (test) | — |
| M8-02 | à faire | Animations du soldat : marche, course, tir de câble, vol, atterrissage, trancher, attente, blessé, mort | N | L | M8-01 | liste d'animations vérifiée par test ; planche | découper |
| M8-03 | à faire | Tenues par institution (liste tirée de `data/`) | N | L | M8-01 | une tenue par institution de la liste ; test de budgets | découper par institution |
| M8-04 | à faire | Accessoires : équipement ODM, lames, lance de foudre | N | M | M8-01 | ≤ 1 500 triangles chacun (budget à confirmer par S2) | — |
| M8-05 | à faire | Titans : squelette et ≥ 3 variantes, L0 à L3 | N | L | S6-g | budgets de `02` §7 respectés ; planche | — |
| M8-06 | à faire | Animations de Titans | N | L | M8-05 | liste d'animations vérifiée | — |
| M8-07 | à faire | Décalques d'emblèmes depuis `data/emblems` (une même définition → SVG, texture, décalque) | N | M | M8-03 | test : les 3 rendus d'un même emblème sont produits depuis la même définition | — |
| M8-08 | à faire | Niveaux de détail L0 à L3 de toutes les familles | N | L | M8-03, M8-05 | test de budgets vert ; sortie collée | — |
| M8-09 | à faire | Kits de décor (maisons, rues, remparts, murs de 50 m `C`) | N | L | S2-d | échelle vérifiée par test (hauteur du Mur, taille d'un humain) | — |
| M8-10 | à faire | Décors issus de la carte voxel, si S7 PASS | N | L | S7-j | scène d'un quartier au budget ; `assets-check` vert | repli : kits de M8-09 |
| M8-11 | à faire | Textures d'environnement (selon `organisation/04`) | N | M | M0-02 | registre d'assets à jour ; `assets-check` vert | textures créées par le projet |
| M8-12 | à faire | Test de budgets, contrôle de provenance, planche de revue relue | N | M | M8-08, M8-10 | `dotnet test --filter Budgets` vert ; `Tools assets-check` code 0 ; captures décrites avec ≥ 3 défauts | — |
| M8-13 | à faire | Rapport M8 et revue | N | S | M8-12 | `docs/v4/rapports/M8.md` ; verdict écrit | — |

## 13. M9 — Commande vocale

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M9-01 | à faire | Grammaire de production (60 commandes) : analyse du texte → commande typée | N | L | S3-f PASS, M5-15 | tests : 60 commandes × ≥ 3 formulations → la bonne commande | si S3 FAIL : tâche annulée, N02 en « Could » |
| M9-02 | à faire | Résolution des références (« la deuxième escouade », « ma section ») vers des entités possédées par le siège | N | M | M9-01 | test : un ordre visant une entité d'un autre siège est refusé | — |
| M9-03 | à faire | Intégration du moteur retenu, appui-pour-parler | N | L | M9-01 | scénario scripté sur fichiers audio d'essai : phrase → commande dans le journal | — |
| M9-04 | à faire | Retours visuels et sous-titres | N | M | M9-03 | capture lue par un relecteur (≥ 3 défauts listés) | — |
| M9-05 | à faire | Repli complet clavier / menu radial | N | M | M9-01 | table : chaque commande de la grammaire a un équivalent clavier/menu ; test qui la vérifie | — |
| M9-06 | à faire | Aucune capture audio conservée | N | S | M9-03 | test : après une session de test, aucun fichier audio dans les dossiers de données ; aucun accès réseau dans `Voice` | — |
| M9-07 | à faire | Kit et séance : 100 énoncés avec le jeu actif | N | S | M9-03 | kit et fiche | — |
| M9-08 | à faire | Gabriel dit les énoncés | G | — | M9-07 | fichiers reçus | — |
| M9-09 | à faire | Analyse : taux, latence, charge ; rapport M9, revue | N | M | M9-08 | ≥ 90 % de commandes correctes sur 60 commandes / 100 énoncés ; latence mesurée ; `docs/v4/rapports/M9.md` | — |

## 14. M10 — Contenu

Tous les lieux et toutes les villes doivent être jouables (exigence de Gabriel, 2026-10-13, reprise de l'ancien `CLAUDE.md`). Lieux principaux faits à la main, lieux courants générés une fois puis figés.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M10-01 | à faire | Chargement d'une scène de lieu depuis `data/places` | N | L | M7-17, M8-13 | 3 lieux de test chargés ; temps de chargement relevé | — |
| M10-02 | à faire | Carte de bataille générée depuis un lieu (N03) | N | L | M10-01, M5-15 | pour 5 lieux : une carte de bataille avec navigation valide, déterministe sur 3 exécutions | — |
| M10-03 | à faire | Lieux principaux faits à la main | N | L | M10-01 | liste des lieux principaux tirée des données ; chacun jouable | découper par région |
| M10-04 | à faire | Lieux courants générés puis figés | N | L | M10-02 | fichiers figés ; deux générations identiques | — |
| M10-05 | à faire | Couverture de l'atlas | N | M | M10-03, M10-04 | `Tools places-coverage` (équivalent de `places:couverture`) : 126 provinces, 0 lieu manquant | — |
| M10-06 | à faire | Scénarios (845 Paradis et Marley, et ceux de `data/`) | N | L | M6-10, M10-05 | chaque scénario se lance et se joue 10 minutes en test scripté | — |
| M10-07 | à faire | Événements (les 6 fichiers de `data/events`) en jeu | N | M | M10-06 | chaque événement a un déclencheur testé | — |
| M10-08 | à faire | Illustrations et portraits : voie choisie par Gabriel (`organisation/08` n° 11) | H | — | — | voie consignée | défaut : rendus stylisés Blender |
| M10-09 | à faire | Portraits et illustrations produits selon la voie | N | L | M10-08 | un portrait par personnage jouable ; évalués par un sous-agent distinct avec une grille écrite par M10-08 (l'ancien `CLAUDE.md` cite un `docs/art/STYLE.md` qui n'existe pas dans le dépôt : seul `docs/art/STYLES.md`, catalogue d'environnements, existe) | — |
| M10-10 | à faire | `Tools canon-check` sur tout le contenu | N | M | M10-07 | code 0 ; sortie collée | — |
| M10-11 | à faire | Tutoriel | N | M | M10-06 | scénario scripté de tutoriel jouable en test | — |
| M10-12 | à faire | Rapport M10 et revue | N | S | M10-05, M10-10 | `docs/v4/rapports/M10.md` ; verdict écrit | — |

## 15. M11 — Finition et paquet

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| M11-01 | à faire | Revue avant M11 (`03` §7) | N | S | M10-12, M9-09 | verdict écrit | — |
| M11-02 | à faire | Équilibrage | N | L | M11-01 | `Tools balance` : aucun camp au-dessus de 60 % `[A]` sur 200 parties IA par scénario | — |
| M11-03 | à faire | Accessibilité (tailles de texte, sous-titres, contraste, repli clavier) | N | M | M11-01 | liste de contrôle remplie ; captures lues | — |
| M11-04 | à faire | Réglages de qualité Bas, Moyen, Haut, Ultra | N | M | M7-12 | les quatre préréglages se chargent | — |
| M11-05 | à faire | Export Windows et notice d'installation | N | M | M11-04 | exécutable produit ; empreinte SHA-256 consignée | — |
| M11-06 | à faire | Session de 9 joueurs réels, 30 minutes | H | — | M11-05 | session sans plantage, journal et empreintes renvoyés | — |
| M11-07 | à faire | Mesure de fluidité finale sur RTX 3050 | G | — | M11-05 | fichier de mesures reçu | — |
| M11-08 | à faire | Rapport final et gel de la V1 jouable | N | S | M11-06, M11-07 | les sept critères de `01` §7 : commande ou mesure collée pour chacun | — |

## 16. Réserve (`en réserve` jusqu'à décision)

Possibilités nouvelles de `01` §6 classées « Should » ou « Could » : elles ne sont prises qu'après M11 ou si Gabriel les promeut.

| ID | État | Tâche | Lieu | Taille | Dépend de | Critère | Repli |
|---|---|---|---|---|---|---|---|
| B-01 | en réserve | N04 Titans à mouvement procédural | N | L | S6-g, M8-06 | à écrire à la promotion | — |
| B-02 | en réserve | N05 Dégâts visibles : brèches, bâtiments endommagés | N | L | M4-08, M7-17 | à écrire à la promotion | — |
| B-03 | en réserve | N06 Météo et cycle jour/nuit | N | M | S2-d | à écrire à la promotion | — |
| B-04 | en réserve | N07 Foules civiles et évacuation | N | L | S2-d | à écrire à la promotion | — |
| B-05 | en réserve | N08 Replay avec caméra cinématique | N | M | M7-17 | à écrire à la promotion | — |
| B-06 | en réserve | N09 Mode photo | N | S | M7-17 | à écrire à la promotion | — |
| B-07 | en réserve | N10 Manette | N | M | M7-17 | à écrire à la promotion | — |

## 17. Chemin critique (une seule piste)

```
P-01…P-11 ┐ (dérogation)
S0 ─ S1 ─ S4 (dérogation) ─┐
M0-01…05 (H) ──────────────┴→ S2 S3 S5 S6 (S7 si carte fournie) → M0-10
→ M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10 → M11
```
M8 peut s'intercaler dès M1 (travail Blender). Les tâches `H` et `G` sont regroupées dans `08_ACTIONS_ET_DECISIONS_DE_GABRIEL.md` pour ne lui demander qu'une séance à la fois.
