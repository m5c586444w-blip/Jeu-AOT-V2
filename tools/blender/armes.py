"""Armes de mêlée et explosives du dispositif ODM (fichier 10 : E-P03 paire de lames, E-P06 lance de foudre).
Origine à la poignée ; la lame/la pointe s'étend vers +Z Blender (+Y glTF)."""
import math

from common import boite, cone, cylindre, lancer, assembler, prisme_coin, sphere


def lame_odm():
    # Poignée en forme de manche à pontet (E-P03) : longueur 0,16 m, origine au milieu de la prise.
    cylindre("poignee", 0.016, 0.16, (0, 0, 0.0), "cuir", segments=10)
    boite("pontet", (0.014, 0.05, 0.012), (0, -0.034, -0.07), "acier_sombre")
    boite("garde", (0.05, 0.03, 0.012), (0, 0, 0.088), "acier_sombre")
    # Lame mince et rigide (acier ultra-dur) : profil en pointe, 0,85 m, 3 mm d'épaisseur.
    prisme_coin("lame", [(-0.022, 0.094), (0.022, 0.094), (0.02, 0.80), (0.0, 0.94), (-0.02, 0.80)], 0.003, "acier", y0=0.0)
    return assembler("lame_odm")


def lance_de_foudre():
    # Lance de foudre (E-P06) : hampe en acier à pointe conique, charge explosive cylindrique, poignée et crochet. Longueur ~1,6 m.
    cylindre("hampe", 0.014, 1.20, (0, 0, 0.60), "acier_sombre", segments=10)
    cylindre("charge", 0.045, 0.34, (0, 0, 1.25), "bronze", segments=12)
    cone("pointe", 0.045, 0.004, 0.22, (0, 0, 1.53), "acier", segments=12)
    cylindre("poignee", 0.02, 0.22, (0, 0, 0.0), "cuir", segments=10)
    boite("crochet", (0.012, 0.05, 0.03), (0, -0.03, 0.14), "acier_sombre")
    cylindre("culasse", 0.025, 0.06, (0, 0, -0.14), "acier_sombre", segments=10)
    return assembler("lance_de_foudre")


if __name__ == "__main__":
    lancer([("lame_odm.glb", lame_odm), ("lance_de_foudre.glb", lance_de_foudre)])
