"""Tenues par institution (fichier 10 §9 ; ERRATA_V3 §4 ; chantier C10, tranche 2).
Pièces d'habillement RIGIDES ajustées autour du corps de base MakeHuman (docs/art/assets/derives/humain.glb : 1,66 m, axe Y haut,
origine aux pieds, +Z avant, +X côté gauche du porteur). Aucun skinning : chaque pièce est un nœud glTF nommé d'après l'os de humain.glb
qu'elle suit (spine_02, pelvis, upperarm_l, thigh_r, head…), géométrie exprimée dans la pose de repos (aucune transformation de nœud) ;
le chargeur rattache le nœud à l'os du même nom. Deux niveaux de détail par tenue : LOD0 (<= 8 000 triangles) et LOD1 (<= 2 000).
Couleurs : A (créations), sauf la cape verte d'expédition (E-P11, C). Aucune ressource tierce.
Le décalque d'emblème (emblemes.py) n'est pas fusionné : la tenue porte en extras l'identifiant, l'os, la position et la largeur."""
import math
import sys

import common
from common import definir_couleur, scene_vide
from emblemes import EMBLEMES
from geo import anneau_h, anneaux_chemin, bande, boite_g, groupe, tube

BUDGET_TENUE = 8000
BUDGET_LOD1 = 2000

# Profil du torse du corps de base (y, cx, cz, rx, rz), relevé sur humain.glb (demi-largeur et demi-profondeur par tranche).
TORSE = [
    (1.44, 0.020, 0.020, 0.075, 0.070),
    (1.40, 0.010, 0.020, 0.130, 0.085),
    (1.35, 0.000, 0.010, 0.180, 0.080),
    (1.30, 0.000, 0.022, 0.182, 0.097),
    (1.20, 0.000, 0.045, 0.154, 0.108),
    (1.10, 0.000, 0.048, 0.128, 0.092),
    (1.00, 0.000, 0.046, 0.136, 0.092),
    (0.95, 0.000, 0.037, 0.146, 0.099),
    (0.90, 0.000, 0.020, 0.155, 0.110),
    (0.85, 0.000, 0.011, 0.172, 0.107),
    (0.80, 0.000, 0.017, 0.181, 0.102),
]
Y_BASSIN = 0.80

# Jambe (centre, rayon) du côté gauche (+X), de la hanche à la cheville ; sol du pied à y = 0.
JAMBE = [
    ((0.104, 0.80, 0.030), 0.092),
    ((0.106, 0.70, 0.045), 0.082),
    ((0.130, 0.55, 0.042), 0.070),
    ((0.142, 0.475, 0.037), 0.066),
    ((0.152, 0.40, 0.012), 0.066),
    ((0.165, 0.25, 0.008), 0.056),
    ((0.175, 0.10, 0.010), 0.050),
]
# Bras gauche : épaule, coude, poignet (le bras est en A-pose).
BRAS = [((0.125, 1.365, 0.020), 0.066), ((0.17, 1.32, 0.020), 0.064), ((0.331, 1.14, 0.020), 0.050), ((0.430, 1.04, 0.120), 0.040)]


def interp(prof, y):
    """Profil interpolé linéairement à la hauteur y (profil trié du haut vers le bas)."""
    if y >= prof[0][0]:
        return prof[0][1:]
    for a, b in zip(prof, prof[1:]):
        if b[0] <= y <= a[0]:
            t = (a[0] - y) / (a[0] - b[0])
            return tuple(a[k] + (b[k] - a[k]) * t for k in range(1, 5))
    return prof[-1][1:]


def profil_manteau(ease, hem):
    """Prolonge le torse sous le bassin en jupe évasée jusqu'à l'ourlet `hem` (hauteur y)."""
    prof = [(y, cx, cz, rx, rz) for (y, cx, cz, rx, rz) in TORSE]
    for y in (0.70, 0.60, 0.50, 0.40, 0.30):
        if y >= hem - 1e-9:
            d = Y_BASSIN - y
            prof.append((y, 0.0, 0.03, 0.181 + 0.045 * d / 0.1 * 0.5, 0.102 + 0.03 * d / 0.1 * 0.5))
    return prof


def ys_entre(haut, bas, n):
    return [round(haut + (bas - haut) * i / n, 4) for i in range(n + 1)]


def anneaux_torse(prof, ys, ease, n):
    res = []
    for y in ys:
        cx, cz, rx, rz = interp(prof, y)
        res.append(anneau_h(y, cx, cz, rx + ease, rz + ease, n, p=3.0))
    return res


def jambe_chemin(cote, ease, y_haut, y_bas):
    pts = [((p[0] * cote, p[1], p[2]), r + ease) for p, r in JAMBE]
    out = []
    for p, r in pts:
        if y_bas - 1e-9 <= p[1] <= y_haut + 1e-9:
            out.append((p, r))
    return out


def jambe_interp(y):
    """Centre et rayon de la jambe gauche à la hauteur y (interpolation sur JAMBE)."""
    for (p0, r0), (p1, r1) in zip(JAMBE, JAMBE[1:]):
        if p1[1] <= y <= p0[1]:
            t = (p0[1] - y) / (p0[1] - p1[1])
            return (tuple(p0[k] + (p1[k] - p0[k]) * t for k in range(3)), r0 + (r1 - r0) * t)
    return JAMBE[-1]


def bras_chemin(cote, ease, i0, i1):
    return [((p[0] * cote, p[1], p[2]), r + ease) for p, r in BRAS[i0:i1 + 1]]


def front_z(prof, y, ease):
    cx, cz, rx, rz = interp(prof, y)
    return cz + rz + ease


def fabriquer(spec, lod):
    hi = lod == 0
    n = 20 if hi else 8  # segments par anneau
    n_limb = 16 if hi else 7
    ease = spec["ease"]
    hem = spec["hem"]
    cotes = (("l", 1.0), ("r", -1.0))
    for nom, couleur in spec["couleurs"].items():
        definir_couleur(nom, couleur, 0.0, 0.9)
    groupes = {}

    def ajouter(os_, obj):
        groupes.setdefault(os_, []).append(obj)

    # Torse : du col au bassin (spine_02), jupe sous le bassin (pelvis), col debout (neck_01).
    prof = profil_manteau(ease, hem)
    nb = 11 if hi else 6
    haut = ys_entre(1.44, Y_BASSIN, nb)
    ajouter("spine_02", tube("veste", anneaux_torse(prof, haut, ease, n), "veste"))
    if hem < Y_BASSIN - 0.01:
        bas = ys_entre(Y_BASSIN, hem, 4 if hi else 2)
        ajouter("pelvis", tube("jupe", anneaux_torse(prof, bas, ease, n), "veste"))
    col = [anneau_h(1.44, 0.02, 0.02, 0.080 + ease * 0.4, 0.075 + ease * 0.4, n), anneau_h(1.49, 0.02, 0.025, 0.074 + ease * 0.4, 0.069 + ease * 0.4, n)]
    ajouter("neck_01", tube("col", col, "veste"))

    # Manches (upperarm / lowerarm) et poignets.
    for s, c in cotes:
        rb = anneaux_chemin(bras_chemin(c, ease, 0, 3), n_limb)  # anneaux de toute la chaîne : l'anneau du coude est commun
        ajouter(f"upperarm_{s}", tube(f"manche_haut_{s}", rb[0:3], "veste"))
        ajouter(f"lowerarm_{s}", tube(f"manche_bas_{s}", rb[2:4], "veste"))
        if hi:
            poignet = [((BRAS[3][0][0] * c, BRAS[3][0][1], BRAS[3][0][2]), BRAS[3][1] + ease + 0.006), ((BRAS[3][0][0] * c - 0.012 * c, BRAS[3][0][1] + 0.025, BRAS[3][0][2] - 0.02), BRAS[3][1] + ease + 0.006)]
            ajouter(f"lowerarm_{s}", tube(f"poignet_{s}", anneaux_chemin(poignet, n_limb), "cuir"))

    # Pantalon et bottes (thigh / calf / foot).
    for s, c in cotes:
        chaine = jambe_chemin(c, 0.012, 0.90, 0.10)
        rj = anneaux_chemin(chaine, n_limb)
        k_genou = [e[0][1] for e in chaine].index(0.475)
        ajouter(f"thigh_{s}", tube(f"pantalon_haut_{s}", rj[:k_genou + 1], "pantalon"))
        ajouter(f"calf_{s}", tube(f"pantalon_bas_{s}", rj[k_genou:], "pantalon"))
        tige = [((0.152 * c, 0.40, 0.012), 0.080), ((0.165 * c, 0.25, 0.008), 0.068), ((0.175 * c, 0.06, 0.010), 0.064)]
        ajouter(f"calf_{s}", tube(f"botte_tige_{s}", anneaux_chemin(tige, n_limb), "cuir", cap_haut=False, cap_bas=False))
        ajouter(f"foot_{s}", boite_g(f"botte_pied_{s}", (0.180 * c, 0.050, 0.090), (0.100, 0.100, 0.255), "cuir"))
        ajouter(f"foot_{s}", boite_g(f"botte_semelle_{s}", (0.180 * c, 0.010, 0.090), (0.108, 0.020, 0.270), "cuir"))
        if hi:
            ajouter(f"calf_{s}", tube(f"botte_revers_{s}", anneaux_chemin([((0.152 * c, 0.41, 0.012), 0.086), ((0.154 * c, 0.385, 0.012), 0.086)], n_limb), "cuir"))

    # Ceinture et boucle (pelvis).
    cx, cz, rx, rz = interp(prof, 0.94)
    ceinture = [anneau_h(0.97, cx, cz, rx + ease + 0.012, rz + ease + 0.012, n), anneau_h(0.90, 0.0, 0.016, interp(prof, 0.90)[2] + ease + 0.012, interp(prof, 0.90)[3] + ease + 0.012, n)]
    ajouter("pelvis", tube("ceinture", ceinture, "cuir"))
    fz = front_z(prof, 0.935, ease) + 0.012
    if hi:
        ajouter("pelvis", boite_g("boucle", (0.0, 0.935, fz), (0.050, 0.060, 0.014), "cuir"))
    if spec.get("cuisses"):
        for s, c in cotes:
            for k, y in enumerate((0.74, 0.64)):
                (jx, _jy, jz), r = jambe_interp(y)
                anneau = [anneau_h(y + 0.02, jx * c, jz, r + 0.020, r + 0.020, n_limb), anneau_h(y - 0.02, jx * c, jz, r + 0.020, r + 0.020, n_limb)]
                ajouter(f"thigh_{s}", tube(f"sangle_cuisse_{s}{k}", anneau, "cuir"))
    if spec.get("holsters"):
        for s, c in cotes:
            ajouter("pelvis", boite_g(f"etui_{s}", (0.215 * c, 0.86, 0.04), (0.060, 0.180, 0.100), "cuir"))
            if hi:
                ajouter("pelvis", boite_g(f"etui_rabat_{s}", (0.215 * c, 0.945, 0.04), (0.066, 0.030, 0.108), "cuir"))
    if spec.get("cartouchieres") and hi:
        for k, x in enumerate((-0.09, -0.03, 0.03, 0.09)):
            ajouter("pelvis", boite_g(f"cartouchiere{k}", (x, 0.935, fz + 0.012), (0.050, 0.070, 0.030), "cuir"))
    if spec.get("cartouchieres") and not hi:
        ajouter("pelvis", boite_g("cartouchieres", (0.0, 0.935, fz + 0.012), (0.20, 0.070, 0.030), "cuir"))

    # Sangles croisées (poitrine et dos) : harnais du Bataillon d'exploration, bandoulière, ceinturon d'officier.
    zf = front_z(prof, 1.20, ease) + 0.008
    zd = interp(prof, 1.20)[1] - interp(prof, 1.20)[3] - ease - 0.008
    if spec.get("sangles") == "croisees":
        for k, (x0, x1) in enumerate(((-0.10, 0.10), (0.10, -0.10))):
            ajouter("spine_02", bande(f"sangle_poitrine{k}", (x0, 1.36, zf - 0.020), (x1, 0.97, zf + 0.012), 0.040, 0.012, "cuir"))
            ajouter("spine_02", bande(f"sangle_dos{k}", (x0, 1.36, zd + 0.020), (x1, 0.97, zd - 0.012), 0.040, 0.012, "cuir"))
    elif spec.get("sangles") == "bandouliere":
        ajouter("spine_02", bande("bandouliere_poitrine", (-0.12, 1.37, zf - 0.020), (0.12, 0.97, zf + 0.012), 0.045, 0.012, "cuir"))
        ajouter("spine_02", bande("bandouliere_dos", (-0.12, 1.37, zd + 0.020), (0.12, 0.97, zd - 0.012), 0.045, 0.012, "cuir"))
    elif spec.get("sangles") == "ceinturon":
        ajouter("spine_02", bande("ceinturon_poitrine", (0.12, 1.37, zf - 0.020), (-0.10, 0.97, zf + 0.012), 0.040, 0.012, "cuir"))
        ajouter("spine_02", bande("ceinturon_dos", (0.12, 1.37, zd + 0.020), (-0.10, 0.97, zd - 0.012), 0.040, 0.012, "cuir"))
    if spec.get("sangles") == "croisees" and hi:
        for s, c in cotes:
            ajouter("spine_02", boite_g(f"boucle_epaule_{s}", (0.10 * c, 1.355, zf - 0.015), (0.030, 0.030, 0.016), "cuir"))

    # Épaulettes (clavicle).
    if spec.get("epaulettes"):
        for s, c in cotes:
            ajouter(f"clavicle_{s}", boite_g(f"epaulette_{s}", (0.185 * c, 1.355, 0.02), (0.095, 0.012, 0.060), "cuir", rz=-18.0 * c))

    # Boutons (veste).
    if hi and spec.get("boutons"):
        rangs = (0.0,) if spec["boutons"] == "simple" else (-0.045, 0.045)
        for r in rangs:
            for k, y in enumerate((1.34, 1.26, 1.18, 1.10, 1.02)):
                cx_, cz_, rx_, rz_ = interp(prof, y)
                ajouter("spine_02", boite_g(f"bouton_{k}_{int(r * 1000)}", (r, y, cz_ + rz_ + ease + 0.004), (0.018, 0.018, 0.010), "cuir"))

    # Sac à dos (soldat de Marley).
    if spec.get("sac"):
        ajouter("spine_02", boite_g("sac", (0.0, 1.10, -0.165), (0.30, 0.38, 0.13), "cuir"))
        if hi:
            ajouter("spine_02", boite_g("sac_rabat", (0.0, 1.27, -0.165), (0.32, 0.06, 0.15), "cuir"))
            ajouter("spine_02", boite_g("sac_couverture", (0.0, 0.88, -0.165), (0.34, 0.09, 0.09), "cuir"))

    # Cape et capuchon (spine_03).
    cape = spec.get("cape")
    pt_dos = interp(prof, 1.15)[1] - interp(prof, 1.15)[3] - ease
    z_dos = pt_dos
    if cape:
        mat_cape = "cape"
        base = [(1.42, 0.0, 0.0, 0.17, 0.12), (1.34, 0.0, -0.01, 0.255, 0.165), (1.15, 0.0, -0.02, 0.285, 0.195)]
        longueur = cape["longueur"]
        if longueur <= 0.85:
            base.append((longueur, 0.0, -0.03, 0.30, 0.205))
        else:
            base.extend([(0.85, 0.0, -0.03, 0.30, 0.205), (longueur, 0.0, -0.035, 0.32, 0.215)])
        base.sort(key=lambda e: -e[0])
        nn = 14 if hi else 7
        a0, a1 = math.radians(112), math.radians(248)
        anneaux = [anneau_h(y, cx, cz, rx, rz, nn, a0, a1, ferme=False) for (y, cx, cz, rx, rz) in base]
        ajouter("spine_03", tube("cape", anneaux, mat_cape, ferme=False))
        z_dos = base[2][2] - base[2][4] - 0.004
        if cape.get("capuchon"):
            hood = [(1.57, 0.0, 0.03, 0.085, 0.095), (1.50, 0.0, 0.02, 0.115, 0.12), (1.42, 0.0, 0.01, 0.15, 0.14), (1.36, 0.0, 0.0, 0.18, 0.15)]
            ann = [anneau_h(y, cx, cz, rx, rz, nn, math.radians(95), math.radians(265), ferme=False) for (y, cx, cz, rx, rz) in hood]
            ajouter("spine_03", tube("capuchon", ann, mat_cape, ferme=False))

    # Coiffe (head).
    coiffe = spec.get("coiffe")
    if coiffe:
        mat_c = spec["coiffe_mat"]
        if coiffe == "kepi":
            sect = [(1.690, 0.047, 0.098, 0.114), (1.668, 0.047, 0.096, 0.112), (1.640, 0.047, 0.090, 0.107), (1.610, 0.047, 0.088, 0.105)]
            ajouter("head", tube("kepi", [anneau_h(y, 0.0, cz, rx, rz, n) for (y, cz, rx, rz) in sect], mat_c, cap_haut=True))
            ajouter("head", boite_g("visiere", (0.0, 1.618, 0.165), (0.150, 0.008, 0.075), mat_c, ry=0.0))
        elif coiffe == "kepi_officier":
            sect = [(1.712, 0.047, 0.118, 0.130), (1.685, 0.047, 0.115, 0.126), (1.645, 0.047, 0.092, 0.110), (1.612, 0.047, 0.090, 0.108)]
            ajouter("head", tube("kepi", [anneau_h(y, 0.0, cz, rx, rz, n) for (y, cz, rx, rz) in sect], mat_c, cap_haut=True))
            ajouter("head", boite_g("visiere", (0.0, 1.610, 0.172), (0.160, 0.008, 0.085), mat_c))
        elif coiffe == "casque":
            sect = [(1.738, 0.047, 0.020, 0.025), (1.722, 0.047, 0.060, 0.070), (1.690, 0.047, 0.092, 0.104), (1.650, 0.047, 0.098, 0.112), (1.612, 0.047, 0.102, 0.118)]
            ajouter("head", tube("casque", [anneau_h(y, 0.0, cz, rx, rz, n) for (y, cz, rx, rz) in sect], mat_c, cap_haut=True))
            if hi:
                ajouter("head", tube("casque_bord", [anneau_h(1.616, 0.0, 0.047, 0.098, 0.114, n), anneau_h(1.606, 0.0, 0.047, 0.120, 0.140, n)], mat_c))

    # Extras (propriétés personnalisées glTF) : emblème porté, face, position et largeur.
    extras_par_os = {"spine_02": {"tenue_id": spec["id"], "lod": lod, "os_rigide": "spine_02"}}
    em = spec.get("emblem")
    if em:
        eid, face = em
        if face == "poitrine":
            y = 1.21
            pos = [round(0.075, 4), y, round(front_z(prof, y, ease) + 0.002, 4)]
            extras_par_os["spine_02"].update({"emblem_id": eid, "emblem_face": "poitrine", "emblem_os": "spine_02", "emblem_pos": pos, "emblem_largeur_m": 0.09, "emblem_rot_y_deg": 0.0})
        else:
            cle = "spine_03" if cape else "spine_02"
            y = 1.12
            if cape:
                pos = [0.0, y, round(z_dos - 0.002, 4)]
                largeur = 0.24
            else:
                pos = [0.0, y, round(interp(prof, y)[1] - interp(prof, y)[3] - ease - 0.002, 4)]
                largeur = 0.12
            extras_par_os.setdefault(cle, {"os_rigide": cle}).update({"emblem_id": eid, "emblem_face": "dos", "emblem_os": cle, "emblem_pos": pos, "emblem_largeur_m": largeur, "emblem_rot_y_deg": 180.0})
    resultat = []
    for os_ in sorted(groupes):
        resultat.append(groupe(os_, groupes[os_], extras_par_os.get(os_)))
    return resultat


# Spécifications : couleurs sRGB (A, sauf cape verte E-P11 : C), hem = ourlet (y), ease = aisance en mètres.
TENUES = [
    {
        "id": "bataillon_exploration", "ease": 0.016, "hem": 0.78,
        "couleurs": {"veste": "#7a5c3c", "pantalon": "#d9d4c4", "cuir": "#4a3320", "cape": "#3f5a35"},
        "sangles": "croisees", "cuisses": True, "cape": {"longueur": 0.62, "capuchon": True}, "emblem": ("emb_org_survey_corps", "dos"),
    },
    {
        "id": "garnison", "ease": 0.018, "hem": 0.74,
        "couleurs": {"veste": "#4d5346", "pantalon": "#5a5648", "cuir": "#3b2a1c", "cape": "#6b6a58"},
        "sangles": "bandouliere", "cuisses": True, "boutons": "simple", "cape": {"longueur": 0.92, "capuchon": True}, "emblem": ("emb_org_garrison", "poitrine"),
    },
    {
        "id": "police_militaire", "ease": 0.018, "hem": 0.66,
        "couleurs": {"veste": "#3a3d52", "pantalon": "#d6d2c6", "cuir": "#3a2b20", "coiffe": "#2f3140"},
        "sangles": "bandouliere", "boutons": "double", "coiffe": "kepi", "coiffe_mat": "coiffe", "emblem": ("emb_org_military_police", "poitrine"),
    },
    {
        "id": "corps_entrainement", "ease": 0.016, "hem": 0.78,
        "couleurs": {"veste": "#5a5030", "pantalon": "#6b6248", "cuir": "#3b2a1c", "coiffe": "#4a4228"},
        "cuisses": True, "boutons": "simple", "coiffe": "kepi", "coiffe_mat": "coiffe", "emblem": ("emb_org_training_corps", "poitrine"),
    },
    {
        "id": "police_interieure", "ease": 0.022, "hem": 0.44,
        "couleurs": {"veste": "#26272d", "pantalon": "#2a2a30", "cuir": "#1f1a17", "coiffe": "#26272d"},
        "holsters": True, "boutons": "double", "coiffe": "kepi_officier", "coiffe_mat": "coiffe", "emblem": ("emb_org_military_police", "poitrine"),
    },
    {
        "id": "marley_soldat", "ease": 0.018, "hem": 0.72,
        "couleurs": {"veste": "#4a4638", "pantalon": "#4a4a3c", "cuir": "#2e2118", "casque": "#3c3f3a"},
        "sangles": "bandouliere", "cartouchieres": True, "sac": True, "boutons": "simple", "coiffe": "casque", "coiffe_mat": "casque", "emblem": ("emb_fac_marley", "poitrine"),
    },
    {
        "id": "marley_officier", "ease": 0.022, "hem": 0.42,
        "couleurs": {"veste": "#46382f", "pantalon": "#2e2b28", "cuir": "#2a1d14", "coiffe": "#3a2d2d"},
        "sangles": "ceinturon", "epaulettes": True, "boutons": "double", "coiffe": "kepi_officier", "coiffe_mat": "coiffe", "emblem": ("emb_fac_marley", "poitrine"),
    },
]


def main():
    verifie = {e for t in TENUES for e in [t["emblem"][0]]}
    manque = verifie - set(EMBLEMES)
    if manque:
        raise SystemExit(f"emblèmes absents de emblemes.EMBLEMES : {sorted(manque)}")
    for spec in TENUES:
        for lod, budget in ((0, BUDGET_TENUE), (1, BUDGET_LOD1)):
            scene_vide()
            objs = fabriquer(spec, lod)
            common.exporter(objs[0], f"tenue_{spec['id']}_lod{lod}.glb", budget=budget, objets=objs, extras=True)
    sys.stdout.flush()


if __name__ == "__main__":
    main()
