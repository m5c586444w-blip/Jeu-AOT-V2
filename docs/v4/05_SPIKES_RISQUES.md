# 05 — Spikes de risque (jalon M0)

> Statut : **PROPOSÉ**. Dépend de : `04`, `02`, `03`. Un spike est une expérience **à durée limitée** dont le résultat tranche une décision de `04`. Les seuils sont des propositions `[A]` que Gabriel confirme en R-D1 ; une fois confirmés, ils ne se discutent plus : le résultat est PASS ou FAIL.
> Les durées sont des **estimations non mesurées** (en jours de travail d'une session).

## 1. Vue d'ensemble

| Spike | Question | Décision tranchée | Où s'exécute | Action de Gabriel | Durée max `[A]` |
|---|---|---|---|---|---|
| S0 | La chaîne Godot .NET se construit, se teste et s'exporte-t-elle ? | version Godot/.NET (V4-D02), V4-D14 | nuage + PC de Gabriel | lancer l'exécutable exporté | 0,5 j |
| S1 | La simulation C# est-elle identique d'une machine à l'autre ? | V4-D06, règle R4 | nuage (Linux) + PC de Gabriel (Windows) | lancer un exécutable de test, renvoyer le fichier d'empreintes | 1 j |
| S2 | Combien d'unités et quel niveau de détail sur une RTX 3050 ? | V4-D17, budgets de `02` §7 | **PC de Gabriel** (ou PC loué) | lancer la scène et renvoyer les mesures | 1–2 j |
| S3 | La commande vocale française est-elle assez fiable et rapide ? | V4-D21, M9, N02 | **PC de Gabriel** (micro) | dire 100 énoncés | 2 j |
| S4 | Le lockstep ENet tient-il à 9 clients avec latence et pertes ? | V4-D07 | nuage (Linux) | aucune | 2 j |
| S5 | Le combattant à la 3ᵉ personne est-il agréable à 20 Hz avec retard d'entrée ? | N01, forme du mode combattant | **PC de Gabriel** | jouer 15 minutes et noter | 2 j |
| S6 | Un soldat passe-t-il de Blender à Godot avec squelette, animations et niveaux de détail ? | V4-D16 | nuage (Blender) + PC de Gabriel (vérification visuelle) | regarder la planche | 2 j |

Ordre conseillé : S0, S1, S4 (dans le nuage, sans Gabriel) ; puis S6, S2, S5, S3 (qui demandent son PC).

## 2. Fiches

### S0 — Chaîne d'outils
- **Protocole** : installer Godot 4.7.x édition .NET et le SDK .NET exigé par sa documentation ; créer un projet vide avec une bibliothèque `Sim` et un test ; exécuter dans le nuage `dotnet build` et `dotnet test` ; importer le projet Godot en ligne de commande sans fenêtre ; produire un export Windows.
- **PASS** : `dotnet build`, `dotnet test` et l'import sans fenêtre réussissent dans le nuage ; l'exécutable exporté démarre sur le PC de Gabriel et affiche une valeur calculée par `Sim`.
- **FAIL → repli** : si l'export ne peut pas se faire dans le nuage, l'export se fait sur une machine Windows (PC de Gabriel ou PC loué) ; le reste de la chaîne dans le nuage est inchangé.
- **Livrable** : `docs/v4/spikes/S0.md` (versions exactes, sorties de commandes collées).

### S1 — Déterminisme
- **Protocole** : implémenter un mini-noyau (générateur maison, tables trigonométriques, 400 unités qui se déplacent et s'attaquent) ; l'exécuter 12 000 ticks (10 minutes à 20 Hz) avec 10 graines sur au moins deux systèmes (Linux x64 du nuage, Windows x64) ; comparer l'empreinte tous les 100 ticks.
- **PASS** : empreintes identiques sur toutes les machines et toutes les graines, avec la variante « double + tables ».
- **FAIL → repli** : passer l'état de bataille en **virgule fixe** (règle R4, variante), puis recommencer S1 ; si la virgule fixe échoue aussi, restreindre une partie à des machines identiques et le consigner.
- **Livrable** : `S1.md` + fichiers d'empreintes.

### S2 — Niveaux de détail et foules sur RTX 3050
- **Prérequis** : relever la carte exacte de Gabriel (nom, mémoire vidéo, pilote) et la mettre dans le rapport.
- **Protocole** : scène avec un lieu réel (données de `data/places`), 400 unités simulées dont 10 en L0, 60 en L1, le reste instancié (L2/L3), soleil avec ombres ; mesurer le temps de trame (médiane et 95ᵉ centile), la mémoire vidéo, le nombre d'appels de dessin aux préréglages Bas et Moyen à 1080p ; essayer la mise à l'échelle de l'image.
- **PASS `[A]`** : un préréglage Bas existe avec un temps de trame au 95ᵉ centile ≤ 33 ms (≈ 30 images par seconde) pour 400 unités, et la mémoire vidéo reste sous celle de la carte avec marge. **Le seuil de jouabilité définitif est fixé par Gabriel à la lecture des chiffres.**
- **FAIL → repli** : réduire le nombre d'unités en L0/L1, remplacer les ombres dynamiques par de la lumière cuite, descendre la résolution interne, plafonner les foules ; consigner les valeurs retenues dans `02` §7.
- **Livrable** : `S2.md` avec tableau de mesures ; budgets de `02` §7 remplacés.

### S3 — Commande vocale (voir `06`)
- **Protocole** : implémenter la grammaire d'essai (60 commandes, `06` §3) ; comparer au plus deux moteurs de reconnaissance locale ; Gabriel enregistre 100 énoncés dans une pièce calme puis avec le son du jeu actif ; mesurer le taux de commandes correctes, la latence entre la fin de la phrase et la commande, la charge processeur pendant que la scène de S2 tourne.
- **PASS `[A]`** : ≥ 90 % de commandes correctes, latence médiane ≤ 1,5 s, charge ≤ 1 cœur en moyenne, aucun ralentissement perceptible de la scène.
- **FAIL → repli** : la voix passe en option différée (N02 → Could) ; les ordres se donnent au menu radial et au clavier ; la grammaire est conservée pour une version ultérieure.
- **Livrable** : `S3.md` (résultats, moteur retenu ou abandon).

### S4 — Réseau lockstep
- **Protocole** : 9 clients sans interface contre un hôte, ENet ; perte de paquets (2 %) et latence (100 ms ± 50) simulées ; 10 minutes × 10 graines ; un client coupé puis réintégré.
- **PASS** : 0 désynchronisation ; réintégration < 10 s ; aucun blocage durable du lockstep.
- **FAIL → repli** : transport WebSocket (V4-D07) et nouvelle mesure ; si le calcul est le goulot (27 §2), appliquer le repli de 27 (réduire le nombre d'unités simulées au PC le plus faible).
- **Livrable** : `S4.md` (journal des 10 graines, empreintes).

### S5 — Ressenti du combattant
- **Protocole** : prototype minimal en 3ᵉ personne : mouvement ODM par ancrages, simulation à 20 Hz, retard d'entrée de 3 ticks, présentation interpolée ; Gabriel joue 15 minutes et note 1 à 5 : réactivité, précision, plaisir.
- **PASS `[A]`** : moyenne ≥ 3,5 sur 5 et aucun « injouable ».
- **FAIL → repli** : (1) augmenter la cadence de bataille ou réduire le retard d'entrée ; (2) à défaut, ODM **par ancrage désigné** (le joueur pointe un ancrage, la trajectoire est calculée dans `Sim`), moins nerveux mais compatible avec le lockstep.
- **Livrable** : `S5.md` (notes, choix).

### S6 — Chaîne de modèles
- **Protocole** : importer les 24 `.glb` actuels ; produire un squelette de soldat à partir d'une base MakeHuman (licence à vérifier avant usage) ; skinner une tenue ; animer marche, course, pose ODM ; générer les niveaux L0 à L3 ; importer dans Godot ; poser un décalque d'emblème ; relever triangles, temps d'import, mémoire.
- **PASS** : un soldat complet de Blender à Godot respecte les budgets de `02` §7 ; manifeste de provenance valide ; planche de revue relue.
- **FAIL → repli** : animation par pièces rigides pour L2/L3 ; réduire le nombre de familles de squelettes ; aucune ressource payante.
- **Livrable** : `S6.md` + planche.

## 3. Actions de Gabriel pendant M0 (récapitulatif)

1. R-D1 : relire `01` et `04`, corriger en une passe.
2. Créer le dépôt privé `Murs-et-Sang-V4` et le rattacher à l'environnement de Claude Code (ou me dire de rester dans l'ancien dépôt).
3. Donner le nom exact de sa carte graphique et sa mémoire vidéo (pour S2).
4. S0, S1 : lancer deux petits exécutables et renvoyer un fichier chacun.
5. S2, S3, S5, S6 : séances de test sur son PC (environ 1 à 2 heures cumulées par spike `[A]`).
