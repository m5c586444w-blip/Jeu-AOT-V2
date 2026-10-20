"""Pour un fichier de région : hauteur et bloc du dessus de chaque colonne (512x512). Écrit un .npz et un petit JSON de palette.
Usage : survol.py <r.X.Z.mca> <dossier_sortie>"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mca import iter_chunks, section_blocks
import numpy as np
path, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
m = re.search(r"r\.(-?\d+)\.(-?\d+)\.mca", path); rx, rz = int(m.group(1)), int(m.group(2))
pal_file = os.path.join(out, "palette.json")
names = json.load(open(pal_file)) if os.path.exists(pal_file) else ["minecraft:air"]
index = {n: i for i, n in enumerate(names)}
AIR = {"minecraft:air", "minecraft:cave_air", "minecraft:void_air"}
top_y = np.full((512, 512), -9999, dtype=np.int16)
top_id = np.zeros((512, 512), dtype=np.uint16)
for cx, cz, root in iter_chunks(path):
    secs = {}
    for sec in root.get("sections", []):
        r = section_blocks(sec)
        if r is None: continue
        pal, idx = r
        lut = np.zeros(len(pal), dtype=np.uint16)
        for k, n in enumerate(pal):
            if n in AIR: lut[k] = 0
            else:
                if n not in index: index[n] = len(names); names.append(n)
                lut[k] = index[n]
        secs[int(sec["Y"])] = lut[idx]  # [y,z,x]
    if not secs: continue
    ys = sorted(secs)
    vol = np.concatenate([secs[y] for y in ys], axis=0)           # (ny,16,16) du bas vers le haut
    nz = vol != 0
    any_ = nz.any(axis=0)
    rev = nz[::-1].argmax(axis=0)                                  # index depuis le haut
    ny = vol.shape[0]
    h = (ny - 1 - rev)
    ids = np.take_along_axis(vol, h[None, :, :], axis=0)[0]
    ytop = ys[0] * 16 + h
    ytop = np.where(any_, ytop, -9999)
    x0, z0 = cx * 16, cz * 16
    top_y[z0:z0 + 16, x0:x0 + 16] = ytop
    top_id[z0:z0 + 16, x0:x0 + 16] = np.where(any_, ids, 0)
json.dump(names, open(pal_file, "w"))
np.savez_compressed(os.path.join(out, "r.%d.%d.npz" % (rx, rz)), top_y=top_y, top_id=top_id)
print("ok", rx, rz, "ymin/ymax:", int(top_y[top_y > -9999].min()) if (top_y > -9999).any() else None, int(top_y.max()))
