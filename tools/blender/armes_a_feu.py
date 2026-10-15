"""Armes à poudre (fichier 10 : E-P07 fusil à poudre, E-P08 / V-02 canon anti-Titans sur chariot-canon).
Fusil : origine à la poignée (petit de crosse), canon vers -Y Blender (avant), longueur ~1,3 m.
Canon sur chariot-canon : origine au sol, entre les roues, bouche vers -Y Blender."""
import math

from common import boite, cone, cylindre, lancer, assembler, tore

R90 = math.pi / 2


def fusil():
    # Axe long = Y Blender ; le canon part vers l'avant (-Y). Origine à la poignée.
    boite("crosse", (0.04, 0.34, 0.11), (0, 0.22, -0.03), "bois", rot=(math.radians(-8), 0, 0))
    boite("fut", (0.045, 0.40, 0.05), (0, -0.28, -0.015), "bois")
    cylindre("canon", 0.014, 0.78, (0, -0.52, 0.015), "acier_sombre", rot=(R90, 0, 0), segments=10)
    boite("culasse", (0.04, 0.12, 0.06), (0, -0.02, 0.02), "acier_sombre")
    boite("chien", (0.012, 0.03, 0.05), (0, 0.05, 0.065), "acier_sombre", rot=(math.radians(25), 0, 0))
    boite("pontet", (0.01, 0.07, 0.01), (0, -0.04, -0.045), "acier_sombre")
    boite("sous_garde", (0.012, 0.012, 0.045), (0, -0.075, -0.03), "acier_sombre")
    cylindre("embouchoir", 0.018, 0.03, (0, -0.91, 0.015), "bronze", rot=(R90, 0, 0), segments=10)
    return assembler("fusil")


def canon_chariot():
    # Chariot-canon (V-02) : affût en bois à deux roues cerclées de fer, tube de bronze long de 2,2 m, flèche arrière.
    rayon_roue = 0.55
    for cote, x in (("g", -0.55), ("d", 0.55)):
        tore(f"roue_{cote}", rayon_roue - 0.04, 0.04, (x, 0, rayon_roue), "acier_sombre", rot=(0, R90, 0), seg_g=20, seg_p=5)
        cylindre(f"moyeu_{cote}", 0.07, 0.12, (x, 0, rayon_roue), "bois", rot=(0, R90, 0), segments=10)
        for k in range(4):
            a = k * math.pi / 4
            cylindre(f"rais_{cote}{k}", 0.015, 2 * (rayon_roue - 0.04), (x, 0, rayon_roue), "bois", rot=(a, 0, 0), segments=6)
    cylindre("essieu", 0.04, 1.30, (0, 0, rayon_roue), "bois", rot=(0, R90, 0), segments=10)
    boite("affut", (0.60, 1.40, 0.22), (0, -0.05, 0.75), "bois")
    boite("fleche", (0.14, 1.30, 0.12), (0, 1.00, 0.45), "bois", rot=(math.radians(-14), 0, 0))
    cylindre("tube", 0.17, 2.0, (0, -0.55, 1.02), "bronze", rot=(R90, 0, 0), segments=16)
    cylindre("bouche", 0.21, 0.16, (0, -1.54, 1.02), "bronze", rot=(R90, 0, 0), segments=16)
    cylindre("culasse", 0.20, 0.12, (0, 0.50, 1.02), "bronze", rot=(R90, 0, 0), segments=16)
    cone("bouton", 0.07, 0.03, 0.10, (0, 0.62, 1.02), "bronze", rot=(R90, 0, 0), segments=8)
    boite("coffre_munitions", (0.50, 0.40, 0.30), (0, 1.55, 0.35), "bois")
    return assembler("canon_chariot")


if __name__ == "__main__":
    lancer([("fusil.glb", fusil), ("canon_chariot.glb", canon_chariot)])
