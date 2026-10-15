"""Outils communs des scripts Blender (ERRATA_V3 §4, chantier C10).

Convention : on construit en axes Blender (Z haut, -Y avant), en mètres, puis l'export glTF convertit en axe Y haut.
Aucune ressource tierce : toutes les formes sont des primitives assemblées par code d'après les descriptions du fichier 10.
Export déterministe : pas d'horodatage, ordre fixe des objets, matériaux nommés, aucune image.
"""
import math
import os
import sys

import bpy

# Budgets (CLAUDE.md) : accessoire <= 1 500 triangles, <= 4 matériaux.
BUDGET_ACCESSOIRE = 1500
MAX_MATERIAUX = 4

COULEURS = {
    "acier": (0.62, 0.64, 0.68, 1.0),
    "acier_sombre": (0.18, 0.19, 0.21, 1.0),
    "bois": (0.36, 0.23, 0.12, 1.0),
    "cuir": (0.28, 0.16, 0.09, 1.0),
    "bronze": (0.55, 0.38, 0.17, 1.0),
    "toile": (0.55, 0.50, 0.38, 1.0),
}


def racine_depot():
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def sortie_dir():
    return os.path.join(racine_depot(), "docs", "art", "assets", "projet")


def scene_vide():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.meshes, bpy.data.materials):
        for bloc in list(coll):
            coll.remove(bloc)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def materiau(nom):
    """Matériau nommé (couleur de base uniquement, métallique/rugosité fixes) ; réutilisé s'il existe."""
    m = bpy.data.materials.get(nom)
    if m is not None:
        return m
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = COULEURS[nom]
    bsdf.inputs["Metallic"].default_value = 0.9 if nom.startswith(("acier", "bronze")) else 0.0
    bsdf.inputs["Roughness"].default_value = 0.4 if nom.startswith("acier") else 0.8
    return m


def _finir(obj, mat):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.clear()
    obj.data.materials.append(materiau(mat))
    obj.select_set(False)
    return obj


def boite(nom, dims, pos, mat, rot=(0.0, 0.0, 0.0)):
    """Parallélépipède de dimensions (x, y, z) centré en pos (mètres)."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, rotation=rot)
    o = bpy.context.active_object
    o.name = nom
    o.scale = dims
    return _finir(o, mat)


def cylindre(nom, rayon, longueur, pos, mat, rot=(0.0, 0.0, 0.0), segments=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=rayon, depth=longueur, location=pos, rotation=rot)
    o = bpy.context.active_object
    o.name = nom
    return _finir(o, mat)


def cone(nom, rayon_bas, rayon_haut, longueur, pos, mat, rot=(0.0, 0.0, 0.0), segments=12):
    bpy.ops.mesh.primitive_cone_add(vertices=segments, radius1=rayon_bas, radius2=rayon_haut, depth=longueur, location=pos, rotation=rot)
    o = bpy.context.active_object
    o.name = nom
    return _finir(o, mat)


def sphere(nom, rayon, pos, mat, segments=12, anneaux=8):
    """Attention : une sphère UV rend l'ordre des indices glTF non déterministe (constaté sur bpy 5.2.2) ; préférer cone/cylindre."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=anneaux, radius=rayon, location=pos)
    o = bpy.context.active_object
    o.name = nom
    return _finir(o, mat)


def tore(nom, grand_rayon, petit_rayon, pos, mat, rot=(0.0, 0.0, 0.0), seg_g=16, seg_p=6):
    bpy.ops.mesh.primitive_torus_add(major_radius=grand_rayon, minor_radius=petit_rayon, major_segments=seg_g, minor_segments=seg_p, location=pos, rotation=rot)
    o = bpy.context.active_object
    o.name = nom
    return _finir(o, mat)


def prisme_coin(nom, points_xz, epaisseur, mat, y0=0.0):
    """Extrusion d'un polygone du plan XZ (liste de (x, z)) sur l'épaisseur donnée en Y, centrée sur y0."""
    import bmesh

    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    bas = [bm.verts.new((x, y0 - epaisseur / 2, z)) for x, z in points_xz]
    haut = [bm.verts.new((x, y0 + epaisseur / 2, z)) for x, z in points_xz]
    bm.faces.new(bas)
    bm.faces.new(list(reversed(haut)))
    n = len(points_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bas[j], bas[i], haut[i], haut[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(o)
    return _finir(o, mat)


def assembler(nom):
    """Joint tous les objets de la scène en un seul maillage nommé (une primitive glTF par matériau)."""
    objs = sorted([o for o in bpy.context.scene.objects if o.type == "MESH"], key=lambda o: o.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = nom
    o.data.name = nom
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Quantification à 0,01 mm : élimine le bruit flottant des primitives pivotées (export déterministe).
    for v in o.data.vertices:
        v.co.x, v.co.y, v.co.z = (round(c, 5) + 0.0 for c in v.co)
    o.data.update()
    return o


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def dimensions(obj):
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def exporter(obj, fichier):
    """Exporte l'objet en .glb (axe Y haut, mètres, sans image, sans animation) dans docs/art/assets/projet/."""
    n = triangles(obj)
    nm = len({s.material.name for s in obj.material_slots if s.material})
    if n > BUDGET_ACCESSOIRE:
        raise SystemExit(f"{fichier} : {n} triangles > budget {BUDGET_ACCESSOIRE}")
    if nm > MAX_MATERIAUX:
        raise SystemExit(f"{fichier} : {nm} matériaux > {MAX_MATERIAUX}")
    os.makedirs(sortie_dir(), exist_ok=True)
    chemin = os.path.join(sortie_dir(), fichier)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_image_format="NONE",
        export_extras=False,
    )
    (x0, x1), (y0, y1), (z0, z1) = dimensions(obj)
    print(f"OK {fichier} : {n} triangles, {nm} matériaux, X[{x0:.3f},{x1:.3f}] Y[{y0:.3f},{y1:.3f}] Z[{z0:.3f},{z1:.3f}] (axes Blender)")
    return chemin


def lancer(fabriques):
    """fabriques : liste de (fichier.glb, fonction qui construit la scène et renvoie l'objet assemblé)."""
    for fichier, fabrique in fabriques:
        scene_vide()
        exporter(fabrique(), fichier)
    sys.stdout.flush()
