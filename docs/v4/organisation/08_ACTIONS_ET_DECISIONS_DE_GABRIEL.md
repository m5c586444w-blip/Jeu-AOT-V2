# 08 — Ce que Gabriel doit faire ou décider

> Statut : **PROPOSÉ** (2026-10-17). Une seule liste, numérotée ; les numéros sont cités par `02_TABLEAU_DES_TACHES.md`. Pour chaque point : ce qu'on te demande, **le défaut appliqué si tu ne réponds pas** (quand il existe), ce qui est bloqué sans toi.
> Ton temps est le goulot : tout ce qui peut être fait sans toi l'est ; ce qui demande ton PC est regroupé en séances (§3).

## 1. Le minimum pour démarrer

Une seule réponse débloque un travail utile **tout de suite** : le n° 5 (dérogation). Sans elle, rien ne démarre avant que tu aies relu `01` et `04`.

## 2. Décisions

| # | Question | Défaut si pas de réponse | Bloque sans ta réponse |
|---|---|---|---|
| 1 | **R-D1** : relire `docs/v4/01_CAHIER_DES_CHARGES.md` et `04_REGISTRE_DES_DECISIONS.md` et répondre au point 5 de `04` : (a) dépôt, (b) Titans commandés par leurs joueurs jusqu'à ≈ saison 4, (c) classement MoSCoW de `01` §6, (d) modes reprise fidèle / refonte de `03` §4, (e) anti-triche et connexion des amis | défauts du tableau de `04` §5 appliqués après sept jours de silence, ce fait consigné | M0-01 puis tout ce qui en dépend (hors lot P, S0, S1, S4 si n° 5 accordé) |
| 2 | **Provenance** : choisir A, B ou C (`04_POLITIQUE_DE_PROVENANCE.md` §4). Question liée : peut-on utiliser **tes** fichiers et références (une carte de fan, par exemple) ? | **A pour ce qui entre dans le dépôt**, références hors dépôt admises (`organisation/04` §7) | M0-02, S7-b et suivantes, M8-10, M8-11 |
| 4 | **Dépôt V4** : tu crées un dépôt privé `Murs-et-Sang-V4` et le rattaches à l'environnement, ou on reste dans ce dépôt (dossier `docs/v4/` et `v4/`) | on reste dans ce dépôt | M0-06 (forme finale), pas le reste |
| 5 | **Dérogation** : lot P, S0, S1, S4 peuvent démarrer avant R-D1 (`02` §2). Ils ne figent rien et ne dépendent d'aucune de tes réponses | — (il faut ton accord) | démarrage immédiat du travail |
| 6 | **Sessions automatiques** : la tâche A est en pause (D-192). On réfléchit à la remettre après M0, quand le protocole a fait ses preuves ? | reste en pause | rien |
| 7 | **Seuils des spikes** : confirmer ou corriger les valeurs `[A]` de `docs/v4/05_SPIKES_RISQUES.md` : S2 (33 ms au 95ᵉ centile, 400 unités), S3 (90 %, 1,5 s), S5 (3,5/5). Le seuil de jouabilité définitif sera de toute façon fixé par toi **à la lecture des chiffres de S2** | valeurs de `docs/v4/05_SPIKES_RISQUES.md` | rien avant la lecture de S2 |
| 10 | **Mode des décors voxel** (conversion directe ou plan masse) | décidé après S7, sur chiffres et images | M8-10 |
| 11 | **Voie des illustrations et portraits** (`CLAUDE.md` de l'ancien dépôt, voies 1 à 3) : (1) tu génères sur perchance.org d'après des fiches de demandes que j'écris, (2) pilotage automatique du site si accessible sans défi anti-robot, (3) rendus stylisés Blender | rendus Blender (3) | M10-08 |
| 12 | **Références visuelles** : veux-tu faire des séances de référence (`07_REFERENCES_VISUELLES.md` §2) où tu me montres des images dans la conversation pour que j'écrive des fiches ? Les images ne sont pas versées au dépôt | pas de séance | amélioration des fiches seulement |

(Les numéros 3, 8 et 9 sont dans le §3 : ce sont des fournitures, pas des décisions.)

## 3. Fournitures et actions sur ton PC

| # | Ce que tu fournis ou fais | Pourquoi | Durée estimée (non mesurée) | Défaut / alternative |
|---|---|---|---|---|
| 3 | **Ta carte graphique** : nom exact, mémoire vidéo, version du pilote, processeur, mémoire vive (un petit programme de relevé te sera donné : M0-04) | S2 et tous les budgets (la RTX 3050 existe avec 4 à 8 Go de mémoire vidéo selon les versions : `02` §7) | 2 minutes | tu peux aussi me les écrire |
| 8 | **Pont de fichiers** : autoriser un dossier de ton PC (par exemple un dossier « Murs-et-Sang-retours » sur le Bureau) pour que je dépose les kits et reçoive les résultats ; sinon tout passe par pièces jointes dans la conversation | tâches `G` | 2 minutes | pièces jointes |
| 9 | **Carte voxel (S7)** : (a) le **fichier** du monde (ou le dossier du monde compressé) ; (b) le **format** : monde Java, Bedrock, schéma `.litematic` ou `.schem`, et la version du jeu ; (c) l'**origine** : site, auteur, et si l'auteur est d'accord pour une utilisation privée dans ce jeu ; (d) le **pack de ressources** ou les mods utilisés pour la construction, s'il y en a | S7 ; jamais à partir d'une photo | 5 minutes pour les réponses | sans (c), voir `organisation/03` §6 : mode plan masse seulement |

### Séances sur ton PC (regroupées)

Chaque séance est précédée d'un kit que je prépare et d'une fiche de 5 lignes (`07_MODELES.md` §9). **Tu ne lances rien que je n'aie pas décrit.** Les durées sont des estimations non mesurées.

| Séance | Tâches | Contenu | Durée estimée |
|---|---|---|---|
| G1 — premiers essais | M0-04, S0-d, S1-e | relever le matériel, lancer l'exécutable de S0, lancer celui de S1, renvoyer deux fichiers | 15 min |
| G2 — mesures graphiques | S2-c | lancer la scène de mesure pour Bas et Moyen, renvoyer les fichiers | 30 min |
| G3 — ressenti du combattant | S5-c | jouer 15 minutes, noter réactivité / précision / plaisir de 1 à 5 | 30 min |
| G4 — voix | S3-e | dire 100 phrases en pièce calme, puis avec le son du jeu | 45 min |
| G5 — modèles | S6-f | regarder la planche du soldat et dire si le niveau convient | 10 min |
| G6 — décor voxel | S7-i | lancer la mesure sur le quartier de test | 20 min |
| G7 — bataille | M5-12 | lancer la mesure de 400 unités | 15 min |
| G8 — présentation | M7-14, M7-16 | lancer le parcours et les captures, mesurer la fluidité | 45 min |
| G9 — voix en jeu | M9-08 | refaire l'essai vocal avec le jeu | 45 min |
| G10 — partie à 9 | M11-06, M11-07 | session de 30 minutes à 9 joueurs réels, mesure finale | 1 h 30 + tes amis |

## 4. Comment tu me renvoies un résultat

1. **Par le pont** (n° 8) : tu déposes le fichier dans le dossier convenu ; je le lis, je le range dans `docs/v4/retours/<ID>/` et je note son empreinte SHA-256.
2. **Sinon** : tu joins le fichier à la conversation ; même rangement.
3. Je ne modifie jamais l'original, je travaille sur une copie.
4. Si un fichier est illisible, je le dis et je te demande de recommencer ; je ne devine pas.

Ce que je ne peux pas faire : lancer un programme sur ton PC. Le pont me permet de **lire et d'écrire des fichiers** dans les dossiers que tu autorises, rien d'autre.

## 5. Ce qui n'a pas besoin de toi

Lot P (traces d'or, schémas, inventaire), S0 à S1 côté nuage, S4, S3 côté préparation, M1 à M5 côté simulation, tout le travail Blender, les tests, les rapports, les revues. Tu relis `docs/MORNING.md` quand tu veux ; il dit ce qui est fait, ce qui attend ta décision (avec le défaut), ce qui attend ton PC.
