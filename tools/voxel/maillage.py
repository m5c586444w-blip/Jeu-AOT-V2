"""Du bloc au maillage : tables d'états, grille à demi-bloc, fusion gloutonne des faces (numba), contrôle d'aire.
Entrées : tableau d'ids d'état [y,z,x] ; sorties : quads (axe, côté, tranche, u0, v0, largeur, hauteur, matériau) en demi-blocs.
Aucune texture ni valeur issue du jeu d'origine."""
import os, sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from numba import njit
from materiaux import classer, bloque_air

MATS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mats.json")

class Materiaux:
    """Table persistante famille -> indice (1..255), couleur sRGB, alpha."""
    def __init__(self, path=MATS_PATH):
        self.path = path
        self.liste = json.load(open(path)) if os.path.exists(path) else []
        self.index = {m["famille"]: i + 1 for i, m in enumerate(self.liste)}
    def id(self, fam, rgb, alpha):
        i = self.index.get(fam)
        if i is None:
            # plusieurs processus partagent la table : verrou, relecture du fichier (les ajouts ne font que prolonger la liste), puis ajout
            import fcntl
            with open(self.path + ".lock", "w") as lk:
                fcntl.flock(lk, fcntl.LOCK_EX)
                if os.path.exists(self.path):
                    disque = json.load(open(self.path))
                    if len(disque) > len(self.liste):
                        assert [m["famille"] for m in disque[:len(self.liste)]] == [m["famille"] for m in self.liste], "tables de matériaux divergentes"
                        self.liste = disque
                        self.index = {m["famille"]: k + 1 for k, m in enumerate(self.liste)}
                i = self.index.get(fam)
                if i is None:
                    if len(self.liste) >= 250: raise RuntimeError("trop de matériaux")
                    self.liste.append({"famille": fam, "rgb": list(rgb), "alpha": alpha}); i = len(self.liste); self.index[fam] = i
                    tmp = self.path + ".tmp%d" % os.getpid()
                    json.dump(self.liste, open(tmp, "w"), indent=0); os.replace(tmp, self.path)
        return i
    def sauver(self): pass
    def transp(self):
        t = np.zeros(256, dtype=np.uint8)
        for i, m in enumerate(self.liste): t[i + 1] = 1 if m["alpha"] < 1.0 else 0
        return t

_DIRS = {"east": (1, 0), "west": (-1, 0), "south": (0, 1), "north": (0, -1)}

def _props(cle):
    m = re.match(r"^([^\[]+)\[(.*)\]$", cle)
    if not m: return cle, {}
    return m.group(1), dict(kv.split("=") for kv in m.group(2).split(",") if "=" in kv)

def masque_escalier(facing, half, shape):
    f = _DIRS.get(facing, (1, 0)); r = (-f[1], f[0])
    quads = {(cx, cz) for cx in (-1, 1) for cz in (-1, 1) if cx * f[0] + cz * f[1] > 0}
    if shape.startswith("outer") or shape.startswith("inner"):
        side = r if shape.endswith("right") else (-r[0], -r[1])
        if shape.startswith("outer"): quads = {(f[0] + side[0], f[1] + side[1])}
        else: quads.add((-f[0] + side[0], -f[1] + side[1]))
    base_y, haut_y = (0, 1) if half != "top" else (1, 0)
    m = 0
    for cx in (-1, 1):
        for cz in (-1, 1):
            sx, sz = (1 if cx > 0 else 0), (1 if cz > 0 else 0)
            m |= 1 << (base_y * 4 + sz * 2 + sx)
            if (cx, cz) in quads: m |= 1 << (haut_y * 4 + sz * 2 + sx)
    return m

def tables_etats(cles, mats):
    """Pour chaque état : masque d'occupation (8 demi-cubes), matériau, type de poteau fin (0 aucun, 1 clôture, 2 muret)."""
    n = len(cles)
    occ = np.zeros(n, dtype=np.uint8); mat = np.zeros(n, dtype=np.uint8); thin = np.zeros(n, dtype=np.uint8)
    ferme = np.zeros(n, dtype=np.uint8)
    for i, cle in enumerate(cles):
        if i == 0: continue
        kind, fam, rgb, alpha = classer(cle)
        if kind == 0:
            ferme[i] = 1 if bloque_air(cle) else 0
            continue
        nom, pr = _props(cle)
        mt = mats.id(fam, rgb, alpha); mat[i] = mt
        if kind in (1, 5, 6): occ[i] = 0xFF
        elif kind == 2: occ[i] = {"bottom": 0x0F, "top": 0xF0}.get(pr.get("type", "bottom"), 0xFF)
        elif kind == 3: occ[i] = masque_escalier(pr.get("facing", "east"), pr.get("half", "bottom"), pr.get("shape", "straight"))
        elif kind == 4: thin[i] = 1 if nom.endswith("fence") else 2
    return occ, mat, thin, ferme

@njit(cache=True)
def compiler_grille(vol, occ, mat, grid):
    H, Z, X = vol.shape
    for y in range(H):
        for z in range(Z):
            for x in range(X):
                s = vol[y, z, x]
                m = occ[s]
                if m == 0: continue
                mt = mat[s]
                for bit in range(8):
                    if (m >> bit) & 1:
                        grid[2 * x + (bit & 1), 2 * y + (bit >> 2), 2 * z + ((bit >> 1) & 1)] = mt

@njit(cache=True)
def _visible(grid, transp, ext, p0, p1, p2, d, sg):
    a = grid[p0, p1, p2]
    if a == 0: return 0
    q0, q1, q2 = p0, p1, p2
    if d == 0: q0 += sg
    elif d == 1: q1 += sg
    else: q2 += sg
    if q1 < 0: return 0                       # sous la boîte : considéré plein (on ne maille pas le dessous)
    if q0 < 0 or q2 < 0 or q0 >= grid.shape[0] or q1 >= grid.shape[1] or q2 >= grid.shape[2]:
        return a
    b = grid[q0, q1, q2]
    if b == 0:
        if ext[q0, q1, q2] != 0: return a
        return 0
    if transp[b] == 1 and transp[a] == 0: return a
    return 0

@njit(cache=True)
def mailler(grid, transp, ext, lo, hi, cap, out):
    """Fusion gloutonne. out[n] = (axe, côté, tranche, u0, v0, w, h, matériau). Retourne le nombre de quads (ou -n si cap dépassé)."""
    dims = grid.shape
    nq = 0
    p = np.zeros(3, dtype=np.int64)
    for d in range(3):
        ua = (d + 1) % 3; va = (d + 2) % 3
        mask = np.zeros((dims[ua], dims[va]), dtype=np.uint8)
        for side in range(2):
            sg = 1 if side == 1 else -1
            for s in range(lo[d], hi[d]):
                p[d] = s
                vide = True
                for u in range(lo[ua], hi[ua]):
                    p[ua] = u
                    for v in range(lo[va], hi[va]):
                        p[va] = v
                        c = _visible(grid, transp, ext, p[0], p[1], p[2], d, sg)
                        mask[u, v] = c
                        if c != 0: vide = False
                if vide: continue
                for v in range(lo[va], hi[va]):
                    u = lo[ua]
                    while u < hi[ua]:
                        c = mask[u, v]
                        if c == 0:
                            u += 1; continue
                        w = 1
                        while u + w < hi[ua] and mask[u + w, v] == c: w += 1
                        h = 1; ok = True
                        while v + h < hi[va] and ok:
                            for k in range(w):
                                if mask[u + k, v + h] != c:
                                    ok = False; break
                            if ok: h += 1
                        if nq < cap:
                            out[nq, 0] = d; out[nq, 1] = side; out[nq, 2] = s; out[nq, 3] = u; out[nq, 4] = v
                            out[nq, 5] = w; out[nq, 6] = h; out[nq, 7] = c
                        nq += 1
                        for dv in range(h):
                            for du in range(w): mask[u + du, v + dv] = 0
                        u += w
    return nq

@njit(cache=True)
def aire_visible(grid, transp, ext, lo, hi, nmat, res):
    """Aire de référence (cellules de face visibles, sans fusion) par matériau : sert au contrôle de conservation."""
    p = np.zeros(3, dtype=np.int64)
    for d in range(3):
        ua = (d + 1) % 3; va = (d + 2) % 3
        for side in range(2):
            sg = 1 if side == 1 else -1
            for s in range(lo[d], hi[d]):
                p[d] = s
                for u in range(lo[ua], hi[ua]):
                    p[ua] = u
                    for v in range(lo[va], hi[va]):
                        p[va] = v
                        c = _visible(grid, transp, ext, p[0], p[1], p[2], d, sg)
                        if c != 0: res[c] += 1

def exterieur(vol, occ, ferme):
    """Drapeau d'extérieur par bloc [y,z,x] : air relié au ciel (face haute) ou au bord latéral du volume par un chemin d'air.
    Les blocs pleins, translucides et les barrières (portes, volets, vitres fines) arrêtent le chemin ; les blocs partiels le laissent passer."""
    from scipy import ndimage
    barriere = (occ[vol] == 0xFF) | (ferme[vol] == 1)
    lab, n = ndimage.label(~barriere)
    touche = np.zeros(n + 1, dtype=bool)
    for face in (lab[-1], lab[:, 0], lab[:, -1], lab[:, :, 0], lab[:, :, -1]): touche[np.unique(face)] = True
    touche[0] = False
    return touche[lab] & ~barriere

def mailler_volume(vol, occ, mat, transp, noyau, ext_blocs=None):
    """vol [y,z,x] avec apron de 1 bloc ; noyau = ((x0,x1),(z0,z1)) en blocs du volume. Retourne (quads, grille, lo, hi)."""
    H, Z, X = vol.shape
    grid = np.zeros((2 * X, 2 * H, 2 * Z), dtype=np.uint8)
    compiler_grille(vol, occ, mat, grid)
    if ext_blocs is None: ext = np.ones(grid.shape, dtype=np.uint8)
    else: ext = np.repeat(np.repeat(np.repeat(ext_blocs.transpose(2, 0, 1), 2, axis=0), 2, axis=1), 2, axis=2).astype(np.uint8)
    (nx0, nx1), (nz0, nz1) = noyau
    lo = np.array([2 * nx0, 0, 2 * nz0], dtype=np.int64); hi = np.array([2 * nx1, 2 * H, 2 * nz1], dtype=np.int64)
    cap = 400000
    while True:
        out = np.zeros((cap, 8), dtype=np.int32)
        n = mailler(grid, transp, ext, lo, hi, cap, out)
        if n <= cap: return out[:n], grid, ext, lo, hi
        cap = int(n * 1.2) + 1000

def controle_aire(grid, transp, ext, lo, hi, quads):
    res = np.zeros(256, dtype=np.int64)
    aire_visible(grid, transp, ext, lo, hi, 256, res)
    aq = np.zeros(256, dtype=np.int64)
    if len(quads): np.add.at(aq, quads[:, 7], quads[:, 5].astype(np.int64) * quads[:, 6])
    return bool((res == aq).all()), int(res.sum()), int(aq.sum())

def poteaux(vol, thin, mat):
    """Poteaux fins (clôtures, murets) : séries verticales de même matériau -> boîtes (x, y0, z, hauteur, largeur, matériau) en blocs du volume."""
    H, Z, X = vol.shape
    t = thin[vol]; m = mat[vol]
    res = []
    ys, zs, xs = np.nonzero(t)
    if len(ys) == 0: return np.zeros((0, 6), dtype=np.float32)
    ordre = np.lexsort((ys, zs, xs))
    ys, zs, xs = ys[ordre], zs[ordre], xs[ordre]
    i = 0; n = len(ys)
    while i < n:
        j = i
        while j + 1 < n and xs[j + 1] == xs[i] and zs[j + 1] == zs[i] and ys[j + 1] == ys[j] + 1 and t[ys[j + 1], zs[i], xs[i]] == t[ys[i], zs[i], xs[i]] and m[ys[j + 1], zs[i], xs[i]] == m[ys[i], zs[i], xs[i]]: j += 1
        w = 0.25 if t[ys[i], zs[i], xs[i]] == 1 else 0.5
        res.append((xs[i], ys[i], zs[i], j - i + 1, w, m[ys[i], zs[i], xs[i]]))
        i = j + 1
    return np.array(res, dtype=np.float32)
