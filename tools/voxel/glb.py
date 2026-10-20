"""Écriture et relecture de fichiers glTF 2.0 binaires (.glb), sans dépendance externe."""
import json, struct, os
import numpy as np

def _lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def quads_vers_prims(quads, org_block, y_origine, cell=0.5, uv_tuile=64.0):
    """quads int32[n,8] (demi-blocs, indices de grille) -> dict mat -> (pos, nor, uv, idx).
    org_block = (px0, pz0) coordonnée-bloc du coin de grille ; y_origine = coordonnée-bloc y du bas de grille.
    Les positions sont relatives à (cx0, ., cz0) fournis par l'appelant via org_block-cx0 ; l'uv utilise les coordonnées absolues."""
    prims = {}
    if len(quads) == 0: return prims
    for mat in np.unique(quads[:, 7]):
        Q = quads[quads[:, 7] == mat]
        n = len(Q)
        d = Q[:, 0]; side = Q[:, 1]; c = (Q[:, 2] + side).astype(np.float64)
        u0 = Q[:, 3].astype(np.float64); v0 = Q[:, 4].astype(np.float64); w = Q[:, 5].astype(np.float64); h = Q[:, 6].astype(np.float64)
        corners_u = np.stack([u0, u0 + w, u0 + w, u0], axis=1)
        corners_v = np.stack([v0, v0, v0 + h, v0 + h], axis=1)
        pos = np.zeros((n, 4, 3), dtype=np.float64)
        for dd in range(3):
            m = d == dd
            if not m.any(): continue
            ua, va = (dd + 1) % 3, (dd + 2) % 3
            pos[m, :, dd] = c[m, None]
            pos[m, :, ua] = corners_u[m]; pos[m, :, va] = corners_v[m]
        # ordre CCW vu de l'extérieur : côté + => (u,v) direct ; côté - => inversé
        neg = side == 0
        order = np.array([0, 1, 2, 3])
        pos[neg] = pos[neg][:, [0, 3, 2, 1], :]
        grid_x, grid_y, grid_z = pos[..., 0] * cell, pos[..., 1] * cell, pos[..., 2] * cell   # blocs depuis le coin de grille
        nor = np.zeros((n, 3), dtype=np.float32)
        for dd in range(3):
            m = d == dd
            nor[m, dd] = np.where(side[m] == 1, 1.0, -1.0)
        ax = grid_x + org_block[0]; ay = grid_y + y_origine; az = grid_z + org_block[1]       # coordonnées-bloc absolues
        P = np.stack([ax, ay, az], axis=-1)
        # uv : plan (x,z) pour les faces haut/bas, (z,y) pour axe x, (x,y) pour axe z ; en tuiles
        uv = np.zeros((n, 4, 2), dtype=np.float64)
        mx = d == 0; my = d == 1; mz = d == 2
        uv[mx, :, 0] = az[mx]; uv[mx, :, 1] = ay[mx]
        uv[my, :, 0] = ax[my]; uv[my, :, 1] = az[my]
        uv[mz, :, 0] = ax[mz]; uv[mz, :, 1] = ay[mz]
        uv /= uv_tuile
        idx = (np.arange(n, dtype=np.uint32) * 4)[:, None] + np.array([0, 1, 2, 0, 2, 3], dtype=np.uint32)[None, :]
        prims[int(mat)] = (P.reshape(-1, 3), np.repeat(nor, 4, axis=0), uv.reshape(-1, 2), idx.reshape(-1))
    return prims

def boites_vers_prims(boites, org_block, y_origine, uv_tuile=64.0):
    """Poteaux fins : boîtes (x,y0,z,hauteur,largeur,mat) en blocs du volume -> faces latérales et dessus (pas de dessous)."""
    prims = {}
    if len(boites) == 0: return prims
    for mat in np.unique(boites[:, 5]):
        B = boites[boites[:, 5] == mat]; n = len(B)
        x = B[:, 0] + 0.5 - B[:, 4] / 2 + org_block[0]; z = B[:, 2] + 0.5 - B[:, 4] / 2 + org_block[1]; y = B[:, 1] + y_origine
        hgt = B[:, 3]; wd = B[:, 4]
        verts = []; nors = []; uvs = []
        faces = [  # (normale, 4 sommets en (dx,dy,dz) de 0/1)
            ((0, 1, 0), [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)]),
            ((1, 0, 0), [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)]),
            ((-1, 0, 0), [(0, 0, 1), (0, 1, 1), (0, 1, 0), (0, 0, 0)]),
            ((0, 0, 1), [(1, 0, 1), (1, 1, 1), (0, 1, 1), (0, 0, 1)]),
            ((0, 0, -1), [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)]),
        ]
        for nrm, vs in faces:
            for (dx, dy, dz) in vs:
                verts.append(np.stack([x + dx * wd, y + dy * hgt, z + dz * wd], axis=1))
                nors.append(np.tile(np.array(nrm, dtype=np.float32), (n, 1)))
                uvs.append(np.stack([(x + dx * wd) / uv_tuile, (y + dy * hgt) / uv_tuile], axis=1))
        # empilage : (face, sommet, boîte) -> (boîte, face, sommet)
        V = np.stack(verts, axis=0).reshape(5, 4, n, 3).transpose(2, 0, 1, 3).reshape(-1, 3)
        N = np.stack(nors, axis=0).reshape(5, 4, n, 3).transpose(2, 0, 1, 3).reshape(-1, 3)
        U = np.stack(uvs, axis=0).reshape(5, 4, n, 2).transpose(2, 0, 1, 3).reshape(-1, 2)
        k = np.arange(n * 5, dtype=np.uint32) * 4
        idx = (k[:, None] + np.array([0, 1, 2, 0, 2, 3], dtype=np.uint32)[None, :]).reshape(-1)
        prims[int(mat)] = (V, N, U, idx)
    return prims

def fusionner(a, b):
    for m, (P, N, U, I) in b.items():
        if m in a:
            P0, N0, U0, I0 = a[m]
            a[m] = (np.concatenate([P0, P]), np.concatenate([N0, N]), np.concatenate([U0, U]), np.concatenate([I0, (I + len(P0)).astype(np.uint32)]))
        else: a[m] = (P, N, U, I)
    return a

def ecrire_glb(path, nom, translation, prims, materiaux, uri_texture, extras=None):
    """prims : dict indice_matériau -> (pos, nor, uv, idx) ; materiaux : liste [{famille, rgb, alpha}] indexée par indice-1."""
    bin_ = bytearray(); views = []; accs = []; primitives = []; mats_json = []; mat_map = {}
    def add_view(arr, target):
        b = arr.tobytes()
        while len(bin_) % 4: bin_.append(0)
        views.append({"buffer": 0, "byteOffset": len(bin_), "byteLength": len(b), "target": target}); bin_.extend(b)
        return len(views) - 1
    for mat in sorted(prims):
        P, N, U, I = prims[mat]
        P = P.astype(np.float32); N = N.astype(np.float32); U = U.astype(np.float32); I = I.astype(np.uint32)
        vp = add_view(P, 34962); vn = add_view(N, 34962); vu = add_view(U, 34962); vi = add_view(I, 34963)
        base = len(accs)
        accs.append({"bufferView": vp, "componentType": 5126, "count": len(P), "type": "VEC3", "min": [float(v) for v in P.min(0)], "max": [float(v) for v in P.max(0)]})
        accs.append({"bufferView": vn, "componentType": 5126, "count": len(N), "type": "VEC3"})
        accs.append({"bufferView": vu, "componentType": 5126, "count": len(U), "type": "VEC2"})
        accs.append({"bufferView": vi, "componentType": 5125, "count": len(I), "type": "SCALAR"})
        if mat not in mat_map:
            m = materiaux[mat - 1]; r, g, b = m["rgb"]
            f = [min(1.0, _lin(c) / 0.8) for c in (r, g, b)]
            md = {"name": m["famille"], "pbrMetallicRoughness": {"baseColorFactor": f + [m["alpha"]], "roughnessFactor": 0.92, "metallicFactor": 0.0,
                  "baseColorTexture": {"index": 0}}, "extras": {"famille": m["famille"], "couleur_srgb": [r, g, b]}}
            if m["alpha"] < 1.0: md["alphaMode"] = "BLEND"; md["doubleSided"] = True
            mat_map[mat] = len(mats_json); mats_json.append(md)
        primitives.append({"attributes": {"POSITION": base, "NORMAL": base + 1, "TEXCOORD_0": base + 2}, "indices": base + 3, "material": mat_map[mat], "mode": 4})
    while len(bin_) % 4: bin_.append(0)
    gltf = {"asset": {"version": "2.0", "generator": "murs-et-sang convertisseur voxel (creation du projet)"},
            "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"name": nom, "mesh": 0, "translation": [float(t) for t in translation]}],
            "meshes": [{"name": nom, "primitives": primitives}], "materials": mats_json,
            "textures": [{"sampler": 0, "source": 0}], "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
            "images": [{"uri": uri_texture}], "buffers": [{"byteLength": len(bin_)}], "bufferViews": views, "accessors": accs}
    if extras: gltf["extras"] = extras
    js = json.dumps(gltf, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942)); f.write(bytes(bin_))
    return total

def lire_glb(path):
    """Relecture indépendante : structure, bornes d'index, normales unitaires, orientation des triangles, dégénérés."""
    raw = open(path, "rb").read()
    magic, ver, total = struct.unpack("<III", raw[:12]); assert magic == 0x46546C67 and ver == 2 and total == len(raw), "en-tête glb invalide"
    ln, kind = struct.unpack("<II", raw[12:20]); assert kind == 0x4E4F534A
    gltf = json.loads(raw[20:20 + ln]); off = 20 + ln
    bl, bk = struct.unpack("<II", raw[off:off + 8]); assert bk == 0x004E4942
    binb = raw[off + 8:off + 8 + bl]
    def acc(i):
        a = gltf["accessors"][i]; v = gltf["bufferViews"][a["bufferView"]]
        dt = {5126: np.float32, 5125: np.uint32}[a["componentType"]]; nc = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]
        return np.frombuffer(binb, dtype=dt, count=a["count"] * nc, offset=v["byteOffset"]).reshape(-1, nc) if nc > 1 else np.frombuffer(binb, dtype=dt, count=a["count"], offset=v["byteOffset"])
    stats = {"triangles": 0, "sommets": 0, "primitives": 0, "dégénérés": 0, "orientation_incoherente": 0, "normales_non_unitaires": 0, "index_hors_borne": 0, "nan": 0, "octets": len(raw)}
    for mesh in gltf["meshes"]:
        for pr in mesh["primitives"]:
            P = acc(pr["attributes"]["POSITION"]); N = acc(pr["attributes"]["NORMAL"]); U = acc(pr["attributes"]["TEXCOORD_0"]); I = acc(pr["indices"])
            stats["primitives"] += 1; stats["sommets"] += len(P); stats["triangles"] += len(I) // 3
            if len(I) % 3: stats["index_hors_borne"] += 1
            if len(I) and I.max() >= len(P): stats["index_hors_borne"] += 1
            if not (np.isfinite(P).all() and np.isfinite(N).all() and np.isfinite(U).all()): stats["nan"] += 1
            L = np.linalg.norm(N, axis=1); stats["normales_non_unitaires"] += int((np.abs(L - 1) > 1e-4).sum())
            T = I.reshape(-1, 3); a, b, c = P[T[:, 0]].astype(np.float64), P[T[:, 1]].astype(np.float64), P[T[:, 2]].astype(np.float64)
            cr = np.cross(b - a, c - a); ar = np.linalg.norm(cr, axis=1)
            stats["dégénérés"] += int((ar < 1e-9).sum())
            ok = ar > 1e-9; dots = (cr[ok] / ar[ok, None] * N[T[ok, 0]]).sum(1)
            stats["orientation_incoherente"] += int((dots < 0.99).sum())
    return stats, gltf
