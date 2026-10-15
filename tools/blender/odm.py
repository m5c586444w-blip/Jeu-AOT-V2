"""Dispositif ODM (fichier 10 : E-P01 ODM standard, E-P05 bouteilles de gaz).
Accessoire porté aux hanches : ceinture-support, deux boîtiers de crochets latéraux, deux bouteilles de gaz.
Origine au centre de la ceinture (niveau des hanches) ; largeur ~0,50 m. Axe avant = -Y Blender."""
import math

from common import boite, cylindre, lancer, assembler, cone, tore

R90 = math.pi / 2


def dispositif_odm():
    tore("ceinture", 0.17, 0.018, (0, 0.0, 0.0), "cuir", seg_g=20, seg_p=5)
    boite("plaque_dorsale", (0.26, 0.05, 0.10), (0, 0.17, 0.0), "acier_sombre")
    for cote, x in (("g", -1), ("d", 1)):
        boite(f"boitier_{cote}", (0.10, 0.20, 0.12), (x * 0.24, -0.02, -0.02), "acier_sombre")
        cylindre(f"lanceur_{cote}", 0.022, 0.22, (x * 0.24, -0.20, -0.02), "acier", rot=(R90, 0, 0), segments=10)
        cylindre(f"bouteille_{cote}", 0.04, 0.28, (x * 0.09, 0.20, -0.06), "bronze", rot=(0, math.radians(10 * x), 0), segments=12)
        cone(f"col_{cote}", 0.04, 0.015, 0.05, (x * 0.07, 0.20, 0.10), "bronze", rot=(0, math.radians(10 * x), 0), segments=12)
        boite(f"poignee_{cote}", (0.03, 0.04, 0.12), (x * 0.30, -0.02, -0.14), "cuir")
    return assembler("dispositif_odm")


if __name__ == "__main__":
    lancer([("dispositif_odm.glb", dispositif_odm)])
