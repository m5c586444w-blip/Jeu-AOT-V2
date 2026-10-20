"""Chargement d'une boîte de blocs d'un monde Minecraft Java 1.18+ vers un tableau dense d'identifiants d'états.
Les états sont réduits aux propriétés utiles à la géométrie (escaliers, dalles, portes, trappes). Registre persistant (etats.json).
Aucune dépendance au jeu ; aucune texture lue."""
import os, json, io, struct, zlib
import numpy as np
import nbtlib

_DIR = os.path.dirname(os.path.abspath(__file__))
REG_PATH = os.path.join(_DIR, "etats.json")
AIR_NAMES = {"minecraft:air", "minecraft:cave_air", "minecraft:void_air"}

class Registre:
    """id 0 = air. Clé d'état = nom[propriétés utiles]."""
    def __init__(self, path=REG_PATH):
        self.path = path
        self.cles = json.load(open(path)) if os.path.exists(path) else ["minecraft:air"]
        self.index = {k: i for i, k in enumerate(self.cles)}
    def id(self, cle):
        i = self.index.get(cle)
        if i is None:
            i = len(self.cles); self.cles.append(cle); self.index[cle] = i
        return i
    def sauver(self):
        tmp = self.path + ".tmp%d" % os.getpid()
        json.dump(self.cles, open(tmp, "w")); os.replace(tmp, self.path)

def cle_etat(name, props):
    n = name.replace("minecraft:", "")
    keep = None
    if n.endswith("_stairs"): keep = ("facing", "half", "shape")
    elif n.endswith("_slab"): keep = ("type",)
    elif n.endswith("_trapdoor"): keep = ("facing", "half", "open")
    elif n.endswith("_door"): keep = ("facing", "half", "hinge", "open")
    elif n.endswith("_log") or n.endswith("_wood") or n in ("hay_block", "bone_block", "bamboo_block", "basalt", "deepslate", "chain"): keep = ("axis",)
    if keep is None or not props: return n
    return n + "[" + ",".join("%s=%s" % (k, str(props[k])) for k in keep if k in props) + "]"

def _decompress(kind, data):
    if kind == 2: return zlib.decompress(data)
    if kind == 3: return data
    if kind == 1:
        import gzip; return gzip.decompress(data)
    raise NotImplementedError("compression %r" % kind)

def _chunks_of_region(path, filtre=None):
    """filtre(lcx, lcz) -> bool : ne décompresse que les chunks acceptés."""
    raw = open(path, "rb").read()
    if len(raw) < 8192: return
    for i in range(1024):
        entry = struct.unpack(">I", raw[4 * i:4 * i + 4])[0]
        off, cnt = entry >> 8, entry & 0xFF
        if off == 0 or cnt == 0: continue
        if filtre is not None and not filtre(i % 32, i // 32): continue
        pos = off * 4096
        length, kind = struct.unpack(">IB", raw[pos:pos + 5])
        data = _decompress(kind, raw[pos + 5:pos + 4 + length])
        yield i % 32, i // 32, nbtlib.File.parse(io.BytesIO(data))

def _indices(bs, n):
    if n == 1 or "data" not in bs: return np.zeros((16, 16, 16), dtype=np.uint16)
    longs = np.asarray(bs["data"], dtype=np.int64).astype(np.uint64)
    bits = max(4, (n - 1).bit_length()); per = 64 // bits
    mask = np.uint64((1 << bits) - 1)
    shifts = np.arange(per, dtype=np.uint64) * np.uint64(bits)
    vals = ((longs[:, None] >> shifts[None, :]) & mask).reshape(-1)[:4096]
    return vals.astype(np.uint16).reshape(16, 16, 16)

def charger_boite(region_dir, x0, x1, z0, z1, y0, y1, reg=None):
    """Blocs x in [x0,x1), z in [z0,z1), y in [y0,y1). Retour : tableau uint16 [y, z, x] d'ids d'état (0 = air)."""
    reg = reg or Registre()
    vol = np.zeros((y1 - y0, z1 - z0, x1 - x0), dtype=np.uint16)
    for rx in range(x0 // 512, (x1 - 1) // 512 + 1):
        for rz in range(z0 // 512, (z1 - 1) // 512 + 1):
            p = os.path.join(region_dir, "r.%d.%d.mca" % (rx, rz))
            if not os.path.exists(p): continue
            def _dans(lcx, lcz, rx=rx, rz=rz):
                bx, bz = rx * 512 + lcx * 16, rz * 512 + lcz * 16
                return not (bx + 16 <= x0 or bx >= x1 or bz + 16 <= z0 or bz >= z1)
            for lcx, lcz, root in _chunks_of_region(p, _dans):
                bx, bz = rx * 512 + lcx * 16, rz * 512 + lcz * 16
                for sec in root.get("sections", []):
                    sy = int(sec["Y"]) * 16
                    if sy + 16 <= y0 or sy >= y1: continue
                    bs = sec.get("block_states")
                    if bs is None: continue
                    pal = bs["palette"]
                    lut = np.zeros(len(pal), dtype=np.uint16)
                    for k, p_ in enumerate(pal):
                        nm = str(p_["Name"])
                        if nm in AIR_NAMES: lut[k] = 0; continue
                        props = {str(a): str(b) for a, b in p_["Properties"].items()} if "Properties" in p_ else {}
                        lut[k] = reg.id(cle_etat(nm, props))
                    blk = lut[_indices(bs, len(pal))]   # [y,z,x]
                    ya, yb = max(y0, sy), min(y1, sy + 16)
                    xa, xb = max(x0, bx), min(x1, bx + 16)
                    za, zb = max(z0, bz), min(z1, bz + 16)
                    vol[ya - y0:yb - y0, za - z0:zb - z0, xa - x0:xb - x0] = blk[ya - sy:yb - sy, za - bz:zb - bz, xa - bx:xb - bx]
    reg.sauver()
    return vol, reg
