"""Conversion du bloc central du monde (24 régions) en tuiles .glb à trois niveaux de détail.
LOD0 : chunks 64x64 blocs, demi-blocs (escaliers, dalles), poteaux fins, coque extérieure (intérieurs fermés supprimés).
LOD1 : chunks 128x128 blocs, cellules de 2 blocs. LOD2 : une tuile par région (512x512), cellules de 8 blocs.
Usage : ville.py <dossier_export> X.Z [X.Z ...]   (régions ; ex. -2.-3)"""
import sys, os, time, json, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from numba import njit
from monde import charger_boite
from maillage import Materiaux, tables_etats, mailler_volume, controle_aire, poteaux, exterieur, mailler, compiler_grille
from glb import quads_vers_prims, boites_vers_prims, fusionner, ecrire_glb, lire_glb

REG = os.environ.get("MS_REGIONS")   # dossier region/ de la COPIE de travail du monde (jamais l'original)
if not REG: sys.exit("définir MS_REGIONS = dossier region/ d'une copie du monde")
SURV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "survol")
YA, YB = -44, 252
APRON = 8
TEX = "../textures/bruit_materiaux.png"

@njit(cache=True)
def reduire2(g):
    """Réduction par 2 dans les trois axes. Cellule pleine si >= 4 des 8 voxels sont non vides ; matériau = le plus fréquent
    parmi les voxels non vides de la couche haute de la cellule (sinon de la couche basse) : la face visible du dessus garde sa couleur. g[y,z,x] uint8."""
    Y, Z, X = g.shape
    out = np.zeros((Y // 2, Z // 2, X // 2), dtype=np.uint8)
    vals = np.zeros(4, dtype=np.uint8)
    for y in range(Y // 2):
        for z in range(Z // 2):
            for x in range(X // 2):
                tot = 0
                for dy in range(2):
                    for dz in range(2):
                        for dx in range(2):
                            if g[2 * y + dy, 2 * z + dz, 2 * x + dx] != 0: tot += 1
                if tot < 4: continue
                n = 0
                for dy in (1, 0):
                    for dz in range(2):
                        for dx in range(2):
                            v = g[2 * y + dy, 2 * z + dz, 2 * x + dx]
                            if v != 0:
                                vals[n] = v; n += 1
                    if n > 0: break
                best = 0; bc = 0
                for a in range(n):
                    c = 0
                    for b in range(n):
                        if vals[b] == vals[a]: c += 1
                    if c > bc: bc = c; best = vals[a]
                out[y, z, x] = best
    return out

PLANTES = {"short_grass", "tall_grass", "fern", "large_fern", "grass"}

def convertir_feuillage(vol, occ, plante, id_feuillage):
    """Les herbes hautes posées sur le sol restent un décor ignoré ; celles qui flottent (canopée des arbres de cette carte, faite de
    short_grass / tall_grass sur des branches en dalles) deviennent des cubes de feuillage."""
    is_plant = plante[vol]
    full = occ[vol] == 0xFF
    below_full = np.zeros_like(full); below_full[1:] = full[:-1]
    sol = is_plant & below_full
    below_sol = np.zeros_like(sol); below_sol[1:] = sol[:-1]
    flottante = is_plant & ~sol & ~(is_plant & below_sol)
    out = vol.copy(); out[flottante] = id_feuillage
    return out, int(flottante.sum())

def mailler_cubes(g, transp, noyau, cell, origine_block, y_origine_block, nom, sortie, mats, tile_origin):
    """g[y,z,x] uint8 (cellules), noyau = ((x0,x1),(z0,z1)) en cellules ; écrit un glb et retourne ses statistiques."""
    gg = np.ascontiguousarray(g.transpose(2, 0, 1))          # [x,y,z]
    X, Y, Z = gg.shape
    ext = np.ones(gg.shape, dtype=np.uint8)
    lo = np.array([noyau[0][0], 0, noyau[1][0]], dtype=np.int64); hi = np.array([noyau[0][1], Y, noyau[1][1]], dtype=np.int64)
    cap = 300000
    while True:
        out = np.zeros((cap, 8), dtype=np.int32); n = mailler(gg, transp, ext, lo, hi, cap, out)
        if n <= cap: break
        cap = int(n * 1.2) + 1000
    q = out[:n]
    ok, aref, aq = controle_aire(gg, transp, ext, lo, hi, q)
    prims = quads_vers_prims(q, (origine_block[0] - tile_origin[0], origine_block[1] - tile_origin[1]), y_origine_block, cell)
    return q, prims, ok

def ecrire_et_controler(chemin, nom, tile_origin, prims, mats, info):
    ecrire_glb(chemin, nom, (tile_origin[0], 0, tile_origin[1]), prims, mats.liste, TEX)
    st, _ = lire_glb(chemin)
    sha = hashlib.sha256(open(chemin, "rb").read()).hexdigest()
    bad = st["dégénérés"] + st["orientation_incoherente"] + st["normales_non_unitaires"] + st["index_hors_borne"] + st["nan"]
    ymin = min(float(p[0][:, 1].min()) for p in prims.values()); ymax = max(float(p[0][:, 1].max()) for p in prims.values())
    xmin = min(float(p[0][:, 0].min()) for p in prims.values()) + tile_origin[0]; xmax = max(float(p[0][:, 0].max()) for p in prims.values()) + tile_origin[0]
    zmin = min(float(p[0][:, 2].min()) for p in prims.values()) + tile_origin[1]; zmax = max(float(p[0][:, 2].max()) for p in prims.values()) + tile_origin[1]
    info.update({"fichier": os.path.relpath(chemin, os.path.dirname(os.path.dirname(chemin))), "triangles": st["triangles"], "sommets": st["sommets"], "primitives": st["primitives"],
                 "octets": st["octets"], "sha256": sha, "controle_geometrie_ko": bad, "bbox_blocs": [xmin, ymin, zmin, xmax, ymax, zmax]})
    return info

def traiter_region(rx, rz, sortie, mats):
    t0 = time.time()
    x0, z0 = rx * 512, rz * 512
    vol, reg = charger_boite(REG, x0 - APRON, x0 + 512 + APRON, z0 - APRON, z0 + 512 + APRON, YA, YB)
    id_f = reg.id("projet:feuillage_plante"); reg.sauver()
    occ, mat, thin, ferme = tables_etats(reg.cles, mats); mats.sauver(); transp = mats.transp()
    plante = np.array([c.split("[")[0].replace("minecraft:", "") in PLANTES for c in reg.cles], dtype=bool)
    vol, nfeuille = convertir_feuillage(vol, occ, plante, id_f)
    E = exterieur(vol, occ, ferme)
    f_surv = os.path.join(SURV, "r.%d.%d.npz" % (rx, rz))
    if not os.path.exists(f_surv):
        sys.exit("manque %s : lancer d'abord survol.py sur cette région (voir README, étape 1)" % f_surv)
    surv = np.load(f_surv)["top_y"]
    tiles = []
    # ---------------- LOD0 ----------------
    for j in range(8):
        for i in range(8):
            ty = surv[j * 64:(j + 1) * 64, i * 64:(i + 1) * 64]; ty = ty[ty > -9999]
            if len(ty) == 0: continue
            sl_z = slice(APRON - 1 + 64 * j, APRON - 1 + 64 * j + 66); sl_x = slice(APRON - 1 + 64 * i, APRON - 1 + 64 * i + 66)
            ya = max(0, int(ty.min()) - 12 - YA); yb = min(YB - YA, int(ty.max()) + 4 - YA)
            sub = np.ascontiguousarray(vol[ya:yb, sl_z, sl_x]); Es = np.ascontiguousarray(E[ya:yb, sl_z, sl_x])
            if not (occ[sub] != 0).any() and not (thin[sub] != 0).any(): continue
            quads, grid, ext, lo, hi = mailler_volume(sub, occ, mat, transp, ((1, 65), (1, 65)), Es)
            ok, aref, aq = controle_aire(grid, transp, ext, lo, hi, quads)
            ox, oz = x0 + 64 * i, z0 + 64 * j
            prims = quads_vers_prims(quads, (-1, -1), YA + ya, 0.5)
            bl = poteaux(sub[:, 1:65, 1:65], thin, mat)
            if len(bl):
                keep = Es[:, 1:65, 1:65][bl[:, 1].astype(int), bl[:, 2].astype(int), bl[:, 0].astype(int)] | (Es[:, 1:65, 1:65][np.minimum(bl[:, 1].astype(int) + 1, Es.shape[0] - 1), bl[:, 2].astype(int), bl[:, 0].astype(int)])
                bl = bl[keep]
            fusionner(prims, boites_vers_prims(bl, (0, 0), YA + ya))
            if not prims: continue
            cx, cz = ox // 64, oz // 64
            nom = "c0_%d_%d" % (cx, cz)
            info = ecrire_et_controler(os.path.join(sortie, "lod0", nom + ".glb"), nom, (ox, oz), prims, mats, {"lod": 0, "cx": cx, "cz": cz, "taille_blocs": 64, "aire_conservee": ok, "poteaux": int(len(bl))})
            tiles.append(info)
    # ---------------- LOD1 / LOD2 : cellules de 2 et 8 blocs ----------------
    filled = (np.unpackbits(occ[:, None], axis=1).sum(axis=1) >= 4)         # >= 4 demi-cubes occupés sur 8
    matfull = np.where(filled[vol], mat[vol], 0).astype(np.uint8)
    g2 = reduire2(matfull)                                              # cellules de 2 blocs, avec apron de 8 blocs = 4 cellules
    g4 = reduire2(g2); g8 = reduire2(g4)                                # 4 blocs puis 8 blocs (apron = 1 cellule)
    # LOD1 : chunks de 128 blocs = 64 cellules de 2 ; apron en cellules : 4
    for j in range(4):
        for i in range(4):
            sl_z = slice(4 - 1 + 64 * j, 4 - 1 + 64 * j + 66); sl_x = slice(4 - 1 + 64 * i, 4 - 1 + 64 * i + 66)
            sub = g2[:, sl_z, sl_x]
            nzy = np.nonzero((sub != 0).any(axis=(1, 2)))[0]
            if len(nzy) == 0: continue
            ya = max(0, nzy.min() - 1); yb = min(sub.shape[0], nzy.max() + 2)
            sub = np.ascontiguousarray(sub[ya:yb])
            ox, oz = x0 + 128 * i, z0 + 128 * j
            q, prims, ok = mailler_cubes(sub, transp, ((1, 65), (1, 65)), 2.0, (ox - 2, oz - 2), YA + 2 * ya, None, sortie, mats, (ox, oz))
            if not prims: continue
            cx, cz = ox // 128, oz // 128; nom = "c1_%d_%d" % (cx, cz)
            tiles.append(ecrire_et_controler(os.path.join(sortie, "lod1", nom + ".glb"), nom, (ox, oz), prims, mats, {"lod": 1, "cx": cx, "cz": cz, "taille_blocs": 128, "aire_conservee": ok}))
    # LOD2 : une tuile par région (512 blocs = 64 cellules de 8) ; apron : 1 cellule
    sub = g8[:, 0:66, 0:66]
    nzy = np.nonzero((sub != 0).any(axis=(1, 2)))[0]
    if len(nzy):
        ya = max(0, nzy.min() - 1); yb = min(sub.shape[0], nzy.max() + 2); sub = np.ascontiguousarray(sub[ya:yb])
        q, prims, ok = mailler_cubes(sub, transp, ((1, 65), (1, 65)), 8.0, (x0 - 8, z0 - 8), YA + 8 * ya, None, sortie, mats, (x0, z0))
        if prims:
            nom = "c2_%d_%d" % (rx, rz)
            tiles.append(ecrire_et_controler(os.path.join(sortie, "lod2", nom + ".glb"), nom, (x0, z0), prims, mats, {"lod": 2, "cx": rx, "cz": rz, "taille_blocs": 512, "aire_conservee": ok}))
    print("région", rx, rz, "tuiles", len(tiles), "triangles LOD0/1/2", [sum(t["triangles"] for t in tiles if t["lod"] == l) for l in range(3)], "%.0fs" % (time.time() - t0), flush=True)
    return tiles

if __name__ == "__main__":
    sortie = sys.argv[1]
    for l in range(3): os.makedirs(os.path.join(sortie, "lod%d" % l), exist_ok=True)
    os.makedirs(os.path.join(sortie, "parts"), exist_ok=True)
    mats = Materiaux(); tot = []
    for a in sys.argv[2:]:
        rx, rz = map(int, a.split("."))
        tot += traiter_region(rx, rz, sortie, mats)
        json.dump(tot, open(os.path.join(sortie, "parts", "part_%d.json" % os.getpid()), "w"))
