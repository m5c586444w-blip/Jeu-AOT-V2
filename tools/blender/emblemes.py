"""Décalques d'emblèmes : le tracé SVG de data/emblems/emblems.json (même définition que le rendu SVG de src/data/emblemSvg.ts)
est converti en maillage plat fin (champ, traits, accents : trois couches de 0,5 mm), sans aucune image ni texture.
Plaque de 0,09 m de côté, centrée à l'origine, face visible vers +Z (avant) ; le nœud porte l'identifiant `emb_…` (extras).
Le décalque est posé sur la tenue par le chargeur (extras `emblem_*` de la tenue : os, position, largeur)."""
import json
import math
import os
import re

import bpy
import bmesh

from common import _finir, definir_couleur, racine_depot, scene_vide
from geo import vb

TAILLE = 0.09  # mètres pour la vue 48 x 48
K = TAILLE / 48.0
EPAISSEUR_TRAIT = 1.7  # unités de la vue 48 x 48 (le SVG de l'interface trace à 2)
COUCHE = 0.0005  # écart de couche en mètres

# Contours du champ : copie de FIELD_PATH (src/data/emblemSvg.ts), tests/art/models.test.ts vérifie la couverture.
CHAMPS = {
    "rond": "M24 1a23 23 0 1 1 0 46 23 23 0 0 1 0-46Z",
    "ecu": "M6 3h36v24c0 9-8 16-18 20C14 43 6 36 6 27Z",
    "losange": "M24 1 46 24 24 47 2 24Z",
}

# Emblèmes portés par une tenue (identifiant -> fichier). Les autres emblèmes restent des données (SVG).
EMBLEMES = ["emb_org_survey_corps", "emb_org_garrison", "emb_org_military_police", "emb_org_training_corps", "emb_fac_marley"]

_JETON = re.compile(r"[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)")


def _arc(p0, rx, ry, phi, fa, fs, p1, pas):
    (x1, y1), (x2, y2) = p0, p1
    if rx == 0 or ry == 0 or p0 == p1:
        return [p1]
    rx, ry = abs(rx), abs(ry)
    cp, sp = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2
    den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2
    co = math.sqrt(max(0.0, num / den)) * (-1 if fa == fs else 1)
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    cx, cy = cp * cxp - sp * cyp + (x1 + x2) / 2, sp * cxp + cp * cyp + (y1 + y2) / 2
    th1 = math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx)
    th2 = math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx)
    dth = th2 - th1
    if not fs and dth > 0:
        dth -= 2 * math.pi
    if fs and dth < 0:
        dth += 2 * math.pi
    n = max(3, int(abs(dth) / (2 * math.pi) * pas))
    pts = []
    for i in range(1, n + 1):
        t = th1 + dth * i / n
        pts.append((cx + rx * math.cos(t) * cp - ry * math.sin(t) * sp, cy + rx * math.cos(t) * sp + ry * math.sin(t) * cp))
    pts[-1] = p1
    return pts


def _bezier(p0, p1, p2, p3, n):
    pts = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


def aplatir(d, pas_arc=24, pas_bez=6):
    """Tracé SVG (M L H V C S A Z, minuscules admises) -> liste de (points, fermé)."""
    jet = _JETON.findall(d)
    i = 0
    sous, cur, ferme = [], [], False
    p = (0.0, 0.0)
    debut = p
    cmd = ""
    derniere_c2 = None

    def nombre():
        nonlocal i
        v = float(jet[i])
        i += 1
        return v

    def fin_sous(f):
        nonlocal cur
        if len(cur) > 1 or f:
            sous.append((cur, f))
        cur = []

    while i < len(jet):
        if re.fullmatch(r"[A-Za-z]", jet[i]):
            cmd = jet[i]
            i += 1
            if cmd in "Zz":
                if cur:
                    fin_sous(True)
                p = debut
                continue
        rel = cmd.islower()
        c = cmd.upper()
        ox, oy = (p if rel else (0.0, 0.0))
        if c == "M":
            if cur:
                fin_sous(False)
            p = (ox + nombre(), oy + nombre())
            debut = p
            cur = [p]
            cmd = "l" if rel else "L"
            derniere_c2 = None
        elif c == "L":
            p = (ox + nombre(), oy + nombre())
            cur.append(p)
        elif c == "H":
            p = (ox + nombre(), p[1])
            cur.append(p)
        elif c == "V":
            p = (p[0], oy + nombre() if rel else nombre())
            cur.append(p)
        elif c in "CS":
            if c == "C":
                p1 = (ox + nombre(), oy + nombre())
            else:
                p1 = (2 * p[0] - derniere_c2[0], 2 * p[1] - derniere_c2[1]) if derniere_c2 else p
            p2 = (ox + nombre(), oy + nombre())
            p3 = (ox + nombre(), oy + nombre())
            cur.extend(_bezier(p, p1, p2, p3, pas_bez))
            derniere_c2 = p2
            p = p3
            continue
        elif c == "A":
            rx, ry, phi, fa, fs = nombre(), nombre(), nombre(), int(nombre()), int(nombre())
            q = (ox + nombre(), oy + nombre())
            cur.extend(_arc(p, rx, ry, phi, fa, fs, q, pas_arc))
            p = q
        derniere_c2 = None
    if cur:
        fin_sous(False)
    return sous


def _gl(pt, z):
    """Point de la vue 48 x 48 (y vers le bas) -> coordonnées glTF centrées (y vers le haut)."""
    return (round((pt[0] - 24) * K, 6), round((24 - pt[1]) * K, 6), z)


def _clip(sujet, clip):
    """Sutherland-Hodgman : polygone `sujet` découpé par le polygone convexe `clip` (listes de (x, y), coordonnées planes)."""
    aire = sum(clip[i][0] * clip[(i + 1) % len(clip)][1] - clip[(i + 1) % len(clip)][0] * clip[i][1] for i in range(len(clip)))
    c = clip if aire > 0 else list(reversed(clip))
    sortie = list(sujet)
    for i in range(len(c)):
        a, b = c[i], c[(i + 1) % len(c)]
        entree, sortie = sortie, []
        if not entree:
            break

        def dedans(p):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-12

        def inter(p, q):
            d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
            d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
            t = d1 / (d1 - d2)
            return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

        for j in range(len(entree)):
            p, q = entree[j], entree[(j + 1) % len(entree)]
            if dedans(q):
                if not dedans(p):
                    sortie.append(inter(p, q))
                sortie.append(q)
            elif dedans(p):
                sortie.append(inter(p, q))
    return sortie


def _remplir(bm, pts, z, clip=None):
    poly = pts[:-1] if len(pts) > 2 and pts[0] == pts[-1] else pts
    g = [_gl(q, z) for q in poly]
    if clip:
        g = [(round(x, 6), round(y, 6), z) for x, y in _clip([(p[0], p[1]) for p in g], clip)]
        if len(g) < 3:
            return
    aire = sum(g[i][0] * g[(i + 1) % len(g)][1] - g[(i + 1) % len(g)][0] * g[i][1] for i in range(len(g)))
    if aire < 0:
        g.reverse()
    vs = [bm.verts.new(vb(q)) for q in g]
    f = bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY", ngon_method="EAR_CLIP")


def _ruban(bm, pts, z, larg, clip=None):
    demi = larg * K / 2
    if len(pts) == 1 or all(q == pts[0] for q in pts):
        pts = [(pts[0][0] - 0.3, pts[0][1]), (pts[0][0] + 0.3, pts[0][1])]
    for a, b in zip(pts, pts[1:]):
        ga, gb = _gl(a, z), _gl(b, z)
        dx, dy = gb[0] - ga[0], gb[1] - ga[1]
        lon = math.hypot(dx, dy)
        if lon < 1e-9:
            continue
        ux, uy = dx / lon, dy / lon
        nx, ny = -uy * demi, ux * demi
        a2 = (ga[0] - ux * demi, ga[1] - uy * demi)
        b2 = (gb[0] + ux * demi, gb[1] + uy * demi)
        quad = [(a2[0] + nx, a2[1] + ny, z), (a2[0] - nx, a2[1] - ny, z), (b2[0] - nx, b2[1] - ny, z), (b2[0] + nx, b2[1] + ny, z)]
        if clip:
            poly = _clip([(q[0], q[1]) for q in quad], clip)
            if len(poly) < 3:
                continue
            quad = [(p[0], p[1], z) for p in poly]
        vs = [bm.verts.new(vb((round(q[0], 6), round(q[1], 6), z))) for q in quad]
        f = bm.faces.new(vs)
        if len(vs) > 4:
            bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY", ngon_method="EAR_CLIP")


def _objet(nom, bm, mat):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _finir(o, mat)


def emblemes():
    with open(os.path.join(racine_depot(), "data", "emblems", "emblems.json"), encoding="utf-8") as f:
        donnees = json.load(f)
    return {e["id"]: e for e in donnees["emblems"]}


def fabriquer(eid):
    e = emblemes()[eid]
    for nom, cle in (("emblem_champ", "field"), ("emblem_trait", "line"), ("emblem_accent", "accent")):
        definir_couleur(nom, e["colors"][cle], 0.0, 0.7)
    champ = aplatir(CHAMPS[e["field"]])[0][0]
    zone = [(p[0], p[1]) for p in (_gl(q, 0.0) for q in (champ[:-1] if champ[0] == champ[-1] else champ))]
    # Couche 0 : champ.
    bm = bmesh.new()
    _remplir(bm, champ, 0.0)
    objs = [_objet("champ", bm, "emblem_champ")]
    # Couche 1 : traits et aplats ; couche 2 : accents et liseré du champ.
    z1, z2 = COUCHE, 2 * COUCHE
    bt, ba = bmesh.new(), bmesh.new()
    for c in e["charges"]:
        for pts, ferme in aplatir(c["d"]):
            if c["role"] == "fill":
                _remplir(bt, pts, z1)
            elif c["role"] == "line":
                _ruban(bt, pts + ([pts[0]] if ferme else []), z1, EPAISSEUR_TRAIT, zone)
            else:
                _ruban(ba, pts + ([pts[0]] if ferme else []), z2, EPAISSEUR_TRAIT, zone)
    _ruban(ba, champ + [champ[0]], z2, 1.2)
    objs.append(_objet("traits", bt, "emblem_trait"))
    objs.append(_objet("accents", ba, "emblem_accent"))
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = eid
    o.data.name = eid
    for v in o.data.vertices:
        v.co.x, v.co.y, v.co.z = (round(c, 5) + 0.0 for c in v.co)
    o.data.update()
    o["emblem_id"] = eid
    o["emblem_canon"] = e["canon"]
    o["emblem_champ"] = e["field"]
    o["emblem_largeur_m"] = TAILLE
    return o


if __name__ == "__main__":
    import sys

    import common

    # Budget propre aux décalques : 1 500 triangles ; trois matériaux ; avec extras (identifiant de l'emblème).
    for eid in EMBLEMES:
        scene_vide()
        o = fabriquer(eid)
        common.exporter(o, f"decalque_{eid}.glb", budget=1500, extras=True)
    sys.stdout.flush()
