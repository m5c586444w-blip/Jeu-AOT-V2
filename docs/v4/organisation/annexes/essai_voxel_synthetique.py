"""Test de chaîne voxel -> maillage fusionné -> glb, sur une scène SYNTHÉTIQUE de blocs aléatoires.
Ne reproduit aucune carte ni aucune image : sert seulement à vérifier l'outillage et à mesurer des ordres de grandeur."""
import sys, time
import numpy as np
import trimesh

rng = np.random.default_rng(7)
W = D = 512
H = 64
vol = np.zeros((W, H, D), dtype=np.uint8)  # axes x, y, z ; 0 = air
vol[:, 0:2, :] = 1                         # sol
# boîtes aléatoires (matériaux 2 à 6), hauteurs 4 à 40
for _ in range(2600):
    w, d = rng.integers(5, 14), rng.integers(5, 14)
    x, z = rng.integers(0, W - w), rng.integers(0, D - d)
    h = rng.integers(4, 40)
    vol[x:x + w, 2:2 + h, z:z + d] = rng.integers(2, 7)
    # toit en gradins
    for k in range(min(w, d) // 2):
        vol[x + k:x + w - k, 2 + h + k, z + k:z + d - k] = 4 if k < 6 else 3

solid = vol != 0
print("voxels pleins:", int(solid.sum()), "sur", vol.size)

AXES = [(1, 2), (2, 0), (0, 1)]  # (u, v) cyclique pour chaque axe a : e_u x e_v = +e_a


def face_masks(a, sign):
    """Renvoie une liste de (indice de tranche, masque 2D [u, v] de matériaux) pour les faces visibles."""
    out = []
    n = vol.shape[a]
    sl = [slice(None)] * 3
    for i in range(n):
        sl[a] = i
        cur = vol[tuple(sl)]
        j = i + sign
        if 0 <= j < n:
            sl[a] = j
            nb = vol[tuple(sl)]
        else:
            nb = np.zeros_like(cur)
        m = np.where((cur != 0) & (nb == 0), cur, 0).astype(np.uint8)
        if m.any():
            u, v = AXES[a]
            # m est indexé par les deux axes restants dans l'ordre croissant des axes ; on veut [u, v]
            rest = [ax for ax in range(3) if ax != a]
            if rest != [u, v]:
                m = m.T
            out.append((i, m))
    return out


def greedy(mask):
    rows, cols = mask.shape
    open_, quads = {}, []
    for r in range(rows + 1):
        cur = set()
        if r < rows:
            row = mask[r]
            if row.any():
                ch = np.flatnonzero(np.diff(row.astype(np.int16), prepend=-1, append=-1) != 0)
                for a0, b0 in zip(ch[:-1], ch[1:]):
                    v = int(row[a0])
                    if v:
                        cur.add((int(a0), int(b0), v))
        for key in list(open_):
            if key not in cur:
                quads.append((open_.pop(key), r, key[0], key[1], key[2]))
        for key in cur:
            open_.setdefault(key, r)
    return quads


t0 = time.time()
naive_faces = 0
quads_all = []  # (axis, sign, slice, u0, u1, v0, v1, mat)
for a in range(3):
    for sign in (1, -1):
        for i, m in face_masks(a, sign):
            naive_faces += int((m != 0).sum())
            for (u0, u1, v0, v1, mat) in greedy(m):
                quads_all.append((a, sign, i, u0, u1, v0, v1, mat))
print("faces visibles (naïf) :", naive_faces, "=> triangles", 2 * naive_faces)
print("quads après fusion    :", len(quads_all), "=> triangles", 2 * len(quads_all),
      "| rapport", round(naive_faces / len(quads_all), 1))
print("temps de maillage     : %.1f s" % (time.time() - t0))

q = np.array(quads_all, dtype=np.int32)

# répartition par blocs de 64 (x, z) pour juger du découpage en morceaux
def xz_of(a, sl, u0, u1, v0, v1):
    # renvoie l'abscisse x et la profondeur z du coin (u0, v0)
    ax = {0: sl, 1: v0, 2: u0}[a]
    az = {0: v0, 1: sl, 2: 0}[a]
    if a == 0:
        return sl, v0
    if a == 1:
        return v0, u0
    return u0, sl

cx, cz = [], []
for row in q:
    x, z = xz_of(*[int(row[k]) for k in (0, 2, 3, 4, 5, 6)])
    cx.append(x // 64); cz.append(z // 64)
cx, cz = np.array(cx), np.array(cz)
cnt = np.zeros((W // 64, D // 64), dtype=np.int64)
np.add.at(cnt, (cx, cz), 2)  # triangles
print("morceaux 64x64 : %d ; triangles/morceau médiane %d, max %d, total %d" % (
    cnt.size, int(np.median(cnt)), int(cnt.max()), int(cnt.sum())))

# export d'UN morceau en glb (matériaux = couleurs de sommet), puis relecture
COL = {1: (92, 84, 70), 2: (128, 124, 116), 3: (150, 132, 104), 4: (120, 70, 52), 5: (70, 90, 110), 6: (84, 64, 44)}
sel = (cx == 3) & (cz == 3)
verts, faces, cols, expn = [], [], [], []
for row in q[sel]:
    a, sign, sl, u0, u1, v0, v1, mat = [int(k) for k in row]
    u, v = AXES[a]
    plane = sl + (1 if sign > 0 else 0)
    corners = []
    for (cu, cv) in ((u0, v0), (u1, v0), (u1, v1), (u0, v1)):
        p = [0, 0, 0]; p[a] = plane; p[u] = cu; p[v] = cv
        corners.append(p)
    base = len(verts)
    verts.extend(corners)
    tri = [(0, 1, 2), (0, 2, 3)] if sign > 0 else [(0, 2, 1), (0, 3, 2)]
    for t in tri:
        faces.append([base + t[0], base + t[1], base + t[2]])
        e = [0, 0, 0]; e[a] = sign; expn.append(e)
    cols.extend([COL.get(mat, (200, 0, 200)) + (255,)] * 4)
mesh = trimesh.Trimesh(vertices=np.array(verts, dtype=np.float32), faces=np.array(faces), process=False)
mesh.visual.vertex_colors = np.array(cols, dtype=np.uint8)
out = sys.argv[1] if len(sys.argv) > 1 else "morceau_test.glb"
mesh.export(out)
import os
back = trimesh.load(out)
g = list(back.geometry.values())[0] if hasattr(back, "geometry") else back
back_n = g.face_normals
print("glb exporté : %.1f Ko ; relu : %d sommets, %d triangles" % (os.path.getsize(out) / 1024, len(g.vertices), len(g.faces)))
dots = (np.array(expn) * back_n).sum(axis=1)
print('normales conformes au sens attendu : %.4f des triangles' % float((dots > 0.99).mean()))
