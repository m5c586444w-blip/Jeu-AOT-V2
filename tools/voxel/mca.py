"""Lecteur minimal de fichiers de régions Minecraft Java (.mca), format de chunk 1.18+ (DataVersion >= 2825).
Aucune dépendance au jeu. Usage en module : from mca import iter_chunks, section_blocks."""
import io, struct, zlib, gzip
import numpy as np
import nbtlib

def _decompress(kind, data):
    if kind == 2: return zlib.decompress(data)
    if kind == 1: return gzip.decompress(data)
    if kind == 3: return data
    if kind == 4:
        import lz4.block
        # format lz4 de Minecraft : blocs lz4 encadrés ("LZ4Block") ; non géré ici
        raise NotImplementedError("compression LZ4 non gérée")
    raise ValueError("compression inconnue %r" % kind)

def iter_chunks(path):
    """Produit (cx, cz, racine NBT) pour chaque chunk présent d'un fichier de région."""
    with open(path, "rb") as f:
        raw = f.read()
    if len(raw) < 8192: return
    for i in range(1024):
        entry = struct.unpack(">I", raw[4 * i:4 * i + 4])[0]
        off, cnt = entry >> 8, entry & 0xFF
        if off == 0 or cnt == 0: continue
        pos = off * 4096
        length, kind = struct.unpack(">IB", raw[pos:pos + 5])
        data = _decompress(kind, raw[pos + 5:pos + 4 + length])
        root = nbtlib.File.parse(io.BytesIO(data))
        yield i % 32, i // 32, root

def section_blocks(section):
    """Renvoie (palette:list[str], idx:ndarray uint16 de forme (16,16,16) indexée [y,z,x]) ou None si section vide."""
    bs = section.get("block_states")
    if bs is None: return None
    palette = [str(p["Name"]) for p in bs["palette"]]
    n = len(palette)
    if n == 1 or "data" not in bs:
        return palette, np.zeros((16, 16, 16), dtype=np.uint16)
    longs = np.asarray(bs["data"], dtype=np.int64).astype(np.uint64)
    bits = max(4, (n - 1).bit_length())
    per = 64 // bits
    mask = np.uint64((1 << bits) - 1)
    shifts = (np.arange(per, dtype=np.uint64) * np.uint64(bits))
    vals = ((longs[:, None] >> shifts[None, :]) & mask).reshape(-1)[:4096]
    return palette, vals.astype(np.uint16).reshape(16, 16, 16)
