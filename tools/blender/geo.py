"""Géométrie procédurale en coordonnées glTF (+X = côté gauche du porteur, Y haut, Z avant), mètres.
Convertie en axes Blender (x, -z, y) à la création. Aucune primitive UV (export déterministe), aucune ressource tierce."""
import math

import bpy
import bmesh

from common import _finir


def vb(p):
    return (p[0], -p[2], p[1])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(a):
    n = math.sqrt(_dot(a, a)) or 1.0
    return (a[0] / n, a[1] / n, a[2] / n)


def _moy(pts):
    n = len(pts)
    return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n, sum(p[2] for p in pts) / n)


def _newell(verts, f):
    nx = ny = nz = 0.0
    for i in range(len(f)):
        a, b = verts[f[i]], verts[f[(i + 1) % len(f)]]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return (nx, ny, nz)


def volume_signe(verts, faces):
    v = 0.0
    for f in faces:
        for k in range(1, len(f) - 1):
            v += _dot(verts[f[0]], _cross(verts[f[k]], verts[f[k + 1]]))
    return v / 6.0


def piece(nom, verts, faces, mat, ferme=False):
    """Crée un objet (sommets en coordonnées glTF). `ferme` : corrige l'orientation par le volume signé."""
    if ferme and volume_signe(verts, faces) < 0:
        faces = [list(reversed(f)) for f in faces]
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    vs = [bm.verts.new(vb(p)) for p in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _finir(o, mat)


def boite_g(nom, c, d, mat, rz=0.0, ry=0.0):
    """Parallélépipède centré en c, dimensions d (x, y, z), rotations (degrés) autour de Z puis de Y."""
    hx, hy, hz = d[0] / 2, d[1] / 2, d[2] / 2
    az, ay = math.radians(rz), math.radians(ry)
    verts = []
    for i in range(8):
        x, y, z = (hx if i & 1 else -hx), (hy if i & 2 else -hy), (hz if i & 4 else -hz)
        x, y = x * math.cos(az) - y * math.sin(az), x * math.sin(az) + y * math.cos(az)
        x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
        verts.append((round(c[0] + x, 6), round(c[1] + y, 6), round(c[2] + z, 6)))
    faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    return piece(nom, verts, faces, mat, ferme=True)


def bande(nom, p0, p1, larg, ep, mat):
    """Sangle : boîte plate dans un plan Z constant, allant de p0 à p1 (x, y, z)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    lon = math.hypot(dx, dy)
    c = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2)
    return boite_g(nom, c, (larg, lon, ep), mat, rz=math.degrees(math.atan2(-dx, dy)))


def anneau_h(y, cx, cz, rx, rz, n, a0=0.0, a1=2 * math.pi, ferme=True, p=2.0):
    """Anneau horizontal (superellipse d'exposant p ; p = 2 : ellipse, p > 2 : plus carré, ajusté au buste) ;
    t = 0 vers l'avant (+Z), t croissant vers +X."""
    pts = []
    e = 2.0 / p
    for i in range(n if ferme else n + 1):
        t = a0 + (a1 - a0) * i / n
        s, c = math.sin(t), math.cos(t)
        pts.append((round(cx + rx * math.copysign(abs(s) ** e, s), 6), y, round(cz + rz * math.copysign(abs(c) ** e, c), 6)))
    return pts, (cx, y, cz)


def anneau_z(z, cx, cy, rx, ry, n, p=2.0):
    """Anneau dans un plan Z constant (loft le long de Z : pieds de botte), superellipse d'exposant p."""
    pts = []
    e = 2.0 / p
    for i in range(n):
        t = 2 * math.pi * i / n
        s, c = math.sin(t), math.cos(t)
        pts.append((round(cx + rx * math.copysign(abs(c) ** e, c), 6), round(cy + ry * math.copysign(abs(s) ** e, s), 6), z))
    return pts, (cx, cy, z)


def anneau_axe(c, d, ra, rb, n):
    ref = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (1.0, 0.0, 0.0)
    u = _norm(_cross(d, ref))
    v = _cross(d, u)
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        pts.append(tuple(round(c[k] + ra * math.cos(t) * u[k] + rb * math.sin(t) * v[k], 6) for k in range(3)))
    return pts, c


def anneaux_chemin(chemin, n):
    """chemin : liste de (point, rayon) ou (point, ra, rb) ; anneaux perpendiculaires à la trajectoire."""
    res = []
    for i, e in enumerate(chemin):
        p = e[0]
        ra = e[1]
        rb = e[2] if len(e) > 2 else e[1]
        avant = chemin[min(i + 1, len(chemin) - 1)][0]
        arriere = chemin[max(i - 1, 0)][0]
        d = _norm(_sub(avant, arriere))
        res.append(anneau_axe(p, d, ra, rb, n))
    return res


def tube(nom, anneaux, mat, ferme=True, cap_haut=False, cap_bas=False):
    """Surface lofée entre anneaux [(points, centre)] de même taille ; `ferme` : anneaux fermés (sinon arcs ouverts).
    Chaque face est orientée vers l'extérieur par rapport au centre d'anneau interpolé."""
    verts, idx = [], []
    for pts, _c in anneaux:
        idx.append(list(range(len(verts), len(verts) + len(pts))))
        verts.extend(pts)
    faces = []

    def orienter(f, dehors):
        return f if _dot(_newell(verts, f), dehors) >= 0 else list(reversed(f))

    for k in range(len(anneaux) - 1):
        a, b = idx[k], idx[k + 1]
        ca, cb = anneaux[k][1], anneaux[k + 1][1]
        cm = ((ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2)
        m = len(a)
        for i in range(m if ferme else m - 1):
            j = (i + 1) % m
            f = [a[i], a[j], b[j], b[i]]
            dehors = _sub(_moy([verts[q] for q in f]), cm)
            faces.append(orienter(f, dehors))
    if cap_haut:
        f = list(idx[0])
        faces.append(orienter(f, _sub(anneaux[0][1], anneaux[1][1])))
    if cap_bas:
        f = list(idx[-1])
        faces.append(orienter(f, _sub(anneaux[-1][1], anneaux[-2][1])))
    return piece(nom, verts, faces, mat)


def groupe(nom, objets, extras=None):
    """Joint les objets en un seul maillage nommé (un nœud glTF nommé d'après un os) ; `extras` : propriétés personnalisées."""
    objs = sorted(objets, key=lambda o: o.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = nom
    o.data.name = nom
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for v in o.data.vertices:
        v.co.x, v.co.y, v.co.z = (round(c, 5) + 0.0 for c in v.co)
    o.data.update()
    for k, val in (extras or {}).items():
        o[k] = val
    o.select_set(False)
    return o
