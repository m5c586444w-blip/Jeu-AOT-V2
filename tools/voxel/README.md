# tools/voxel — convertisseur d'un monde Minecraft Java en tuiles `.glb` (V4-D23, spike S7)

Entrée : le dossier `region/` d'**une copie de travail** du monde fourni par Gabriel (jamais l'original, jamais une photo).
Sortie : des `.glb` par morceaux et trois niveaux de détail, une table de matériaux, un index. **La géométrie dérivée n'est pas versée au dépôt** (elle est reproductible avec ces scripts) ; seuls les scripts et les statistiques (`docs/v4/spikes/S7.md`) le sont.

## Dépendances
`python3 -m pip install --break-system-packages numpy numba scipy nbtlib` (aucun paquet payant). Aucun fichier, texture ou modèle du jeu Minecraft n'est lu ni embarqué : seules les **données de blocs** du monde sont lues ; les couleurs (`materiaux.py`) et la texture de bruit (`texture.py`) sont créées par le projet.

## Utilisation (dans cet ordre)
```
# 1. relevé du dessus de chaque colonne, une fois par région (écrit tools/voxel/survol/r.X.Z.npz, ignoré par git)
python3 -I tools/voxel/survol.py "<copie>/region/r.X.Z.mca" tools/voxel/survol
# 2. texture de variation, une fois
python3 -I tools/voxel/texture.py <dossier_export>/textures/bruit_materiaux.png
# 3. conversion (X.Z = coordonnées de région ; écrit lod0/ lod1/ lod2/ et parts/ ; crée tools/voxel/mats.json et etats.json, ignorés par git)
MS_REGIONS="<copie>/region" python3 -I tools/voxel/ville.py <dossier_export> X.Z X.Z ...
# 4. index et vérification (taille, SHA-256, géométrie, aire) ; écrit index.json et materiaux.json ; code 0 si « erreurs : 0 »
python3 -I tools/voxel/index.py <dossier_export>
```
`survol.py` relève, par région, la hauteur et le bloc du dessus de chaque colonne : `ville.py` s'en sert (étape 1 obligatoire) et c'est aussi la grille pour `Sim`.
Le monde de Gabriel n'est jamais modifié : on travaille sur une copie du dossier `region/`. Les registres `mats.json` et `etats.json` sont partagés entre régions (identifiants stables) : ne pas les effacer entre deux lots d'un même export.

## Étapes (un module chacune)
| Module | Rôle |
|---|---|
| `mca.py`, `monde.py` | lecture des régions `.mca` (chunks 1.18+, sections `block_states`) ; volume `vol[y,z,x]` d'identifiants d'états ; registre persistant des états (`etats.json`) |
| `materiaux.py` | classe chaque état : ignoré / cube / dalle / escalier / poteau fin / eau / verre ; famille et couleur (créées par le projet) ; « ferme une pièce » (portes, trappes, vitres) |
| `maillage.py` | grille de demi-blocs (8 sous-voxels par bloc, dalles et escaliers exacts), maillage glouton (numba), règles de visibilité opaque/translucide, **contrôle de conservation d'aire** (aire des quads = aire des faces exposées comptée case par case), coque extérieure par remplissage (les intérieurs fermés sont supprimés), poteaux (barrières, murets) |
| `glb.py` | quads → primitives (une par matériau), écriture `.glb` (float32), **relecture indépendante** (en-tête, indices, NaN, normales, triangles dégénérés, orientation) |
| `ville.py` | boucle région par région : LOD0 (tuiles de 64 blocs, demi-blocs), LOD1 (128 blocs, cellules de 2), LOD2 (512 blocs, cellules de 8) ; feuillage des arbres ; `parts/part_<pid>.json` (statistiques par tuile) |

## Limites connues
Portes, trappes, vitres fines, panneaux, plantes posées au sol et autres décors fins sont **ignorés** (trous aux fenêtres et aux portes) ; l'herbe haute flottante (canopée des arbres de cette carte) devient un cube de feuillage. Les niveaux 1 et 2 sont des réductions (cellule pleine si ≥ 4 voxels sur 8). Échelle : 1 bloc = 1 unité (mètre par défaut) ; la carte n'est pas à une échelle unique (voir `docs/v4/spikes/S7.md`).
