"""Fusionne les statistiques par tuile (parts/part_*.json) en un index.json et vérifie la sortie.
Usage : index.py <dossier_export>
Vérifie : chaque fichier existe, son SHA-256 et sa taille correspondent, aucune tuile en double, contrôles de géométrie à 0, aire conservée.
Sortie : <dossier_export>/index.json (tuiles, totaux par niveau, boîte englobante) et materiaux.json (familles, couleurs sRGB, alpha)."""
import sys, os, json, glob, hashlib

def main(sortie):
    tuiles = {}
    for f in sorted(glob.glob(os.path.join(sortie, "parts", "part_*.json"))):
        for t in json.load(open(f)):
            if t["fichier"] in tuiles: sys.exit("tuile en double : " + t["fichier"])
            tuiles[t["fichier"]] = t
    erreurs = []
    for nom, t in tuiles.items():
        p = os.path.join(sortie, nom)
        if not os.path.exists(p): erreurs.append("absent : " + nom); continue
        if os.path.getsize(p) != t["octets"]: erreurs.append("taille différente : " + nom)
        if hashlib.sha256(open(p, "rb").read()).hexdigest() != t["sha256"]: erreurs.append("empreinte différente : " + nom)
        if t["controle_geometrie_ko"] != 0: erreurs.append("géométrie KO : " + nom)
        if not t["aire_conservee"]: erreurs.append("aire non conservée : " + nom)
    sur_disque = {os.path.relpath(p, sortie) for l in range(3) for p in glob.glob(os.path.join(sortie, "lod%d" % l, "*.glb"))}
    for extra in sorted(sur_disque - set(tuiles)): erreurs.append("fichier sans statistique : " + extra)
    totaux = {}
    for l in range(3):
        ts = [t for t in tuiles.values() if t["lod"] == l]
        totaux["lod%d" % l] = {"tuiles": len(ts), "triangles": sum(t["triangles"] for t in ts), "octets": sum(t["octets"] for t in ts),
                               "taille_tuile_blocs": ts[0]["taille_blocs"] if ts else None}
    bb = [t["bbox_blocs"] for t in tuiles.values()]
    boite = [min(b[i] for b in bb) for i in range(3)] + [max(b[i] for b in bb) for i in range(3, 6)]
    mats = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "mats.json")))
    json.dump({"unite": "1 unité = 1 bloc", "axes": "x est, y haut, z sud ; main droite (identique à glTF), pas de miroir",
               "origine_nœud": "chaque .glb porte sa translation (coin de la tuile en blocs, y = 0 = hauteur Minecraft 0)",
               "totaux": totaux, "boite_blocs": boite, "tuiles": [tuiles[k] for k in sorted(tuiles)]},
              open(os.path.join(sortie, "index.json"), "w"), indent=1)
    json.dump(mats, open(os.path.join(sortie, "materiaux.json"), "w"), indent=1, ensure_ascii=False)
    print("tuiles", len(tuiles), json.dumps(totaux)); print("boîte (blocs)", boite)
    print("erreurs :", len(erreurs)); [print("  ", e) for e in erreurs[:20]]
    return len(erreurs)

if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1]) else 0)
