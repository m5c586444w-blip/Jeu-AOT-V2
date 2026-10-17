# 03 — Pipeline des assets 3D

> Statut : **PROPOSÉ** (2026-10-17). Dépend de : `docs/v4/02_ARCHITECTURE.md` §7–8 (niveaux de détail, chaîne de modèles), `04_REGISTRE_DES_DECISIONS.md` (V4-D09, D16, D17 et la proposition V4-D23 de ce fichier), `organisation/04_POLITIQUE_DE_PROVENANCE.md` (ce qui est permis d'entrer), `05_SPIKES_RISQUES.md` (S2, S6) et le spike S7 défini ici.
> Étiquettes : `[C]` canon rapporté par une source (jamais « canon du projet », voir `U14` R-1/R-2) · `[A]` choix de la direction, modifiable · `[?]` à mesurer.
> Les chiffres de l'essai synthétique (§5) ont été **mesurés le 2026-10-17** et relancés à l'identique depuis `annexes/essai_voxel_synthetique.py` ; aucun chiffre sur une vraie carte n'existe encore.

## 1. Deux voies

| Voie | Contenu | Outil | Statut |
|---|---|---|---|
| **A — Création au projet** | personnages, tenues, Titans, accessoires, emblèmes, kits de décor | scripts Blender (`bpy`) versionnés → `.glb` → Godot (V4-D16) | PROPOSÉ (reprise de la chaîne de l'ancien dépôt) |
| **B — Décors depuis une carte voxel** | quartiers et villes d'une carte fournie par Gabriel (un monde Minecraft) | convertisseur Python (`tools/voxel/`) → `.glb` par morceaux + grille pour `Sim` | **PROPOSÉ — V4-D23**, jugé par le spike S7 |

Les deux voies aboutissent au même endroit : des `.glb` avec manifeste, respectant les budgets, importés par Godot sans fenêtre, et — pour les décors — une grille de navigation lue par `Sim`.

**Règle d'entrée.** La voie B part **toujours d'un fichier de monde** fourni par Gabriel, jamais d'une photo, d'une capture ni d'une vidéo (consigne de Gabriel, 2026-10-17). Une image peut servir de référence d'ambiance, hors du dépôt, jamais d'entrée de conversion.

## 2. Règles communes aux deux voies

| # | Règle | Détail |
|---|---|---|
| 1 | Format | glTF 2.0 binaire (`.glb`), un fichier par objet ou par morceau de décor |
| 2 | Unité et axes | 1 unité = 1 mètre ; Blender calcule en Z vers le haut, glTF en Y vers le haut : l'option de l'exportateur qui fait la conversion est vérifiée et notée en S6 `[?]` |
| 3 | Échelle de référence | humain adulte ≈ 1,7 m `[A]` ; les trois Murs ≈ 50 m de haut, valeur rapportée par la page communautaire (non officielle) https://attackontitan.fandom.com/wiki/Walls et reprise dans `U03` §2.1 — `[C]` au sens « rapporté par la source », pas canon du projet |
| 4 | Nommage | `famille_objet_variante_Ln.glb` (`L0` à `L3`), ex. `soldat_garnison_tenue_L1.glb` ; morceaux de décor : `decor_<lieu>_x<i>_z<j>_Ln.glb` |
| 5 | Manifeste | une entrée **par fichier** au registre d'assets (`organisation/04` §5) : identifiant, origine (`creation-projet` · `tiers-<licence>` · `fournie-par-gabriel`), script ou source (URL exacte), empreinte SHA-256, licence, auteur, date, usage (privé), triangles, niveau. `Tools assets-check` échoue si une entrée manque ou est incomplète |
| 6 | Budgets | `02` §7 (L0 à L3), `[?]` jusqu'à S2. **Écart à noter** : `02` §7 donne « soldat L0 ≤ 25 000 triangles », l'ancien `CLAUDE.md` donnait « soldat LOD0 ≤ 8 000, LOD1 ≤ 2 000, LOD2 ≤ 400, accessoire ≤ 1 500 ». Les deux sont des hypothèses ; **la valeur mesurée en S2 remplace les deux** |
| 7 | Niveaux de détail | L0 à L3 produits **par script**, pas à la main ; un test compte les triangles par niveau |
| 8 | Textures | créées par le projet (voie A) ; voie B : matériaux du projet, jamais les textures du jeu d'origine (§6) ; une texture 1024 par famille `[A]` (reprise de l'ancien `CLAUDE.md`) |
| 9 | Tests | `dotnet test --filter Budgets` (triangles, noms d'os, noms d'animations) ; `Tools assets-check` ; planche de revue lue avec ≥ 3 défauts listés (`05_DEFINITION_DE_FINI` §4) |
| 10 | Fichiers fournis | un fichier que Gabriel dépose est un **original** : copie de travail, original intact, empreinte consignée avant toute opération |

## 3. Voie A — création au projet (rappel)

1. Un script `tools/blender/<famille>.py` pilote `bpy` sans fenêtre et produit le `.glb` ; la sortie est identique d'une exécution à l'autre (empreinte du fichier comparée).
2. Squelette partagé par famille (soldat, Titan) ; animations nommées (liste en M8-02 et M8-06) ; tenues skinnées sur le squelette ; décalques d'emblèmes posés depuis `data/emblems` (une définition → SVG, texture, décalque, M8-07).
3. Corps de base : MakeHuman, **si la politique de provenance le permet** (S6-b relève la licence sur la page officielle et consigne l'URL) ; sinon corps modélisé au projet.
4. Tâches : S6-a à S6-g (spike), puis M8-01 à M8-13. Le détail du squelette, des animations et des tenues est établi en M8 d'après S6, pas avant.

## 4. Voie B — décors depuis une carte voxel

### 4.1 Entrée

| Format possible | Origine | Lecteur testé le 2026-10-17 |
|---|---|---|
| Monde Java (dossier avec fichiers de régions `.mca`) | Minecraft Java | `anvil-parser2` 0.10.6 et `nbtlib` 2.0.4 : **installés et importés** dans le nuage (`pip`, 0 erreur) ; **lecture d'un vrai monde non testée** (versions récentes du format de chunk : à vérifier sur le fichier réel) |
| Schéma Litematica (`.litematic`) | mod d'édition | `litemapy` 0.11.0b0 (version bêta) : installé et importé ; lecture non testée |
| Schéma `.schem` / `.schematic` | WorldEdit et dérivés | via `nbtlib` ; lecture non testée |
| Export Mineways ou équivalent (maillage déjà fait) | outil externe | hors de cette fiche : un maillage déjà fait est traité comme une voie A d'import, sans la chaîne E1–E6 |
| Monde Bedrock (LevelDB) | Minecraft Bedrock | **non testé**, plus difficile à lire ; demander à Gabriel d'exporter en Java ou en schéma si possible |

Rien n'est installé durablement : le spike installe dans un environnement de travail et consigne les versions.

### 4.2 Chaîne E0–E10

| Étape | Rôle | Sortie | Contrôle |
|---|---|---|---|
| E0 Réception | copie de l'original, SHA-256, métadonnées (auteur, accord, version du jeu) | fiche de réception | original intact (empreinte inchangée à la fin) |
| E1 Lecture | monde → volume (palette + indices par région) | tableau 3D | une région relue = la même après aller-retour |
| E2 Inventaire | emprise, hauteurs, nombre de blocs par type, régions occupées | tableau dans `S7.md` | types non reconnus listés |
| E3 Matériaux | table « bloc → matériau du projet » (une ligne par type présent) | `data/voxel/materiaux.json` | un test échoue si un bloc présent n'a pas de ligne |
| E4 Nettoyage | écarter air, lumière, entités ; traiter les blocs non cubiques (escaliers, dalles, vitres, feuillage, portes) | volume nettoyé | décompte avant/après consigné |
| E5 Maillage | suppression des faces cachées, puis fusion de faces voisines de même matériau (« greedy meshing »), par morceaux de 64 × 64 | quads par morceau | triangles par morceau : médiane, maximum, total |
| E6 UV et matériaux | coordonnées de texture qui se répètent selon la taille du quad ; un matériau par famille (pierre, bois, toit, terre, eau…) | primitives par matériau | aucun étirement visible sur la planche |
| E7 Export | un `.glb` par morceau ; niveaux de détail par réduction de résolution (voxels regroupés 2 × 2 × 2) ou simplification | `decor_*_Ln.glb` | relecture : normales conformes ≥ 0,999, aucun trou |
| E8 Grille pour `Sim` | hauteur et occupation par cellule, murs, obstacles | fichier de données lu par `Data` | chemin entre deux points ne traverse aucun bloc plein (S7-f) |
| E9 Import Godot | scène de morceaux, visibilité par distance, lumière et atmosphère du projet | scène chargée sans fenêtre | temps de chargement et mémoire relevés |
| E10 Contrôle | budgets, provenance, planche de revue | rapport | `assets-check` code 0 ; captures décrites avec ≥ 3 défauts |

Choix `[A]` pour E6 : un matériau par famille avec texture qui se répète, parce que la fusion de faces fait des quads de tailles variées qui ne rentrent pas dans un atlas. Alternative écartée à ce stade : tableau de textures dans un nuanceur sur mesure (plus fin, plus long à écrire). À reconsidérer en S7 si l'aspect est trop uniforme.

### 4.3 Deux modes

| | **Mode 1 — conversion directe** | **Mode 2 — plan masse** |
|---|---|---|
| Principe | chaque bloc de la carte devient géométrie (E1–E10) | on extrait l'emprise, les hauteurs, les toits, les rues et les remparts, puis on **reconstruit** avec les kits du projet (M8-09) |
| Fidélité à la carte | exacte (volumes, proportions, détails posés par l'auteur) | fidèle au plan, pas aux détails de chaque bloc |
| Aspect | cubique par nature ; l'objectif « réaliste sombre » (V4-D09) demande un habillage (matériaux, normales, détails) | proche du style du jeu, car fait avec ses kits |
| Coût de travail | chaîne E0–E10, puis réglages d'aspect | extraction + écriture/ajustement des kits ; plus de travail artistique |
| Triangles | dépend du rapport de fusion **réel** (inconnu) | maîtrisés par les kits |
| Droits | dérive directement du travail de l'auteur de la carte | dérive du plan (disposition) seulement : à apprécier (§6) |
| Navigation pour `Sim` | grille exacte tirée des blocs | grille tirée du plan |

Recommandation `[A]` : **ne pas choisir avant S7**. S7 fait les deux modes sur **le même quartier** et mesure ; Gabriel tranche sur chiffres et sur images, pas sur le principe.

### 4.4 Échelle : procédure de calibrage

Une carte construite par un joueur est rarement à l'échelle 1 bloc = 1 m. Procédure (S7-b) :
1. Mesurer en blocs : hauteur des remparts, hauteur d'une porte, largeur d'une rue.
2. Calculer `s = 50 m / hauteur_du_rempart_en_blocs` (le 50 m étant la valeur rapportée au §2, règle 3) puis la hauteur de porte résultante `s × hauteur_porte_en_blocs`.
3. Si la porte tombe entre 2 et 3 m : échelle uniforme `s` retenue. Sinon la carte est « réduite » (remparts et maisons ne sont pas à la même échelle) : **pas de mise à l'échelle non uniforme** ; on passe au mode 2 pour ce quartier, et on le consigne.

### 4.5 Ce que l'essai synthétique montre — et ne montre pas

Scène **aléatoire** de 512 × 64 × 512 voxels (boîtes de 5 à 14 de côté, hauteurs de 4 à 40, toits en gradins), générée par `annexes/essai_voxel_synthetique.py` ; elle ne reproduit aucune carte ni aucune image.

| Mesure (relancée le 2026-10-17) | Valeur |
|---|---|
| Voxels pleins | 4 276 448 sur 16 777 216 |
| Faces visibles (maillage naïf) | 1 753 396 soit 3 506 792 triangles |
| Quads après fusion | 73 714 soit 147 428 triangles |
| Rapport de fusion | 23,8 |
| Temps de maillage (cœur unique, Python + NumPy) | 4,9 s |
| Morceaux de 64 × 64 | 64 ; médiane 2 289 triangles, maximum 3 008 |
| Un morceau exporté en `.glb` puis relu | 99,2 Ko ; 4 576 sommets, 2 288 triangles ; normales conformes sur 100 % des triangles |

**Ce que cela établit** : la chaîne lecture du volume → fusion de faces → export `.glb` → relecture fonctionne dans le nuage, avec des orientations de faces correctes, en quelques secondes pour un volume de cette taille.
**Ce que cela n'établit pas** : (1) le rapport de fusion de 23,8 est **optimiste** (grandes faces planes lisses) ; une vraie ville, avec détails fins, escaliers, feuillage, en aura un bien plus faible, donc beaucoup plus de triangles ; (2) rien n'a été importé dans Godot ni mesuré sur GPU ; (3) l'aspect n'a pas été jugé ; (4) les blocs non cubiques et la lecture d'un vrai fichier ne sont pas traités.

### 4.6 Spike S7 (proposé, à ajouter à `05` si Gabriel confirme)

| Élément | Contenu |
|---|---|
| Question | une carte voxel fournie peut-elle devenir un décor jouable (visuellement acceptable, dans les budgets, avec navigation pour `Sim`) ? |
| Décision tranchée | V4-D23 : voie B retenue (mode 1, mode 2, ou aucun) |
| Où | nuage pour E0–E9 ; PC de Gabriel pour la mesure sur RTX 3050 |
| Action de Gabriel | fournir le fichier et ses réponses (`organisation/08` n° 9) ; lancer la mesure ; regarder la planche |
| Durée max `[A]` | 3 jours-session |
| Protocole | choisir **un quartier de 256 × 256 blocs** ; le convertir par les deux modes ; importer dans Godot ; mesurer triangles, appels de dessin, mémoire vidéo, temps de trame au préréglage Bas avec 400 unités ; produire une planche |
| PASS `[A]` | quartier au préréglage Bas ≤ 33 ms au 95ᵉ centile avec 400 unités, mémoire sous celle de la carte avec marge, navigation valide, aspect jugé acceptable par Gabriel. Les seuils définitifs sont **ceux de S2** une fois mesurés |
| FAIL → repli | réduction par niveaux de détail plus agressifs ; sinon mode 2 seul ; sinon voie A seule (kits du projet) |
| Livrable | `docs/v4/spikes/S7.md` + planche + tableau des deux modes |
| Tâches | S7-a à S7-j (`02_TABLEAU_DES_TACHES.md` §4.8) |

## 5. Interfaces avec le reste du projet

| Vers | Interface |
|---|---|
| `Sim` | seulement la **grille** (hauteur, occupation) lue par `Data` ; `Sim` ne lit jamais un `.glb` (R6) |
| `Data` | `data/voxel/materiaux.json`, `data/places/<id>.json` référence les morceaux du lieu |
| Godot | scènes de morceaux ; aucune logique de jeu dans les scripts d'import |
| Tests | budgets (`Budgets`), provenance (`assets-check`), navigation (S7-f), normales (E7) |
| M5-02, M10-01/02 | la grille de S7-f alimente la navigation propre et les cartes de bataille |
| M8-10 | intégration des décors voxel si S7 PASS |

## 6. Droits et provenance de la voie B (à décider par Gabriel)

Ce qui suit est une **information**, pas un avis juridique ; je ne suis pas juriste.

1. **L'auteur de la carte** détient en principe les droits sur sa construction. Un monde récupéré d'un site de partage, d'un dépôt ou d'un serveur n'est pas libre de droits par défaut. **Tu es seul à pouvoir dire** d'où vient le fichier et si l'auteur est d'accord ; je ne peux pas le vérifier. Le projet est privé, non commercial, jamais publié (ligne éditoriale), ce qui réduit l'exposition mais ne remplace pas l'accord de l'auteur.
2. **Les textures et assets de Minecraft** appartiennent à Mojang/Microsoft. Les « Minecraft Usage Guidelines » (https://www.minecraft.net/en-us/usage-guidelines, page lue le 2026-10-17 ; sans date de mise à jour affichée ; lecture faite par l'outil de lecture de page, **citations à revérifier sur la page**) disent notamment ne pas redistribuer les jeux « or any alterations of our games or game files » et se disent « very relaxed about things you create for yourself ». D'après cette lecture, la page **ne traite pas expressément** la conversion d'un monde vers un autre format ni les cartes faites par des joueurs.
3. **Choix du projet pour limiter l'exposition** : aucune texture ni aucun fichier de ressources du jeu n'est utilisé ; seule la **géométrie** est convertie, avec des matériaux créés par le projet (E3). La carte originale reste **hors du dépôt**.
4. **Où vivent les fichiers** : original dans `assets_user/cartes_voxel/` (dossier ignoré par git, comme `assets_user/illustrations/` dans l'ancien dépôt) ; `.glb` dérivés commités seulement si `organisation/04` l'autorise (option B : dépôt privé, entrée au registre avec auteur, accord et source).
5. **Sans accord de l'auteur** : mode 2 uniquement, avec des kits du projet ; le plan (disposition des rues et des bâtiments) est une donnée de disposition, mais la question reste à apprécier — la prudence est de demander.

## 7. Ce qu'une session qui reprend ce travail doit faire dans l'ordre

1. Lire `organisation/04` (ce qui est permis) et `02_TABLEAU_DES_TACHES.md` §4.7–4.8.
2. Ne rien convertir tant que S7-a (fichier, format, origine, accord) n'est pas `fait`.
3. Relancer `annexes/essai_voxel_synthetique.py` pour vérifier que l'outillage fonctionne dans l'environnement du jour (numpy et trimesh installés ; versions au journal).
4. Dérouler S7-b à S7-j sans sauter l'inventaire (E2) : c'est lui qui dit si l'échelle et les blocs sont exploitables.
