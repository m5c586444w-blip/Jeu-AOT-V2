"""Texture de variation procédurale (création du projet) : 64 x 64 blocs par tuile (alignée sur les chunks de 64), 4 x 4 pixels par bloc, ton moyen 0,8, graine fixe."""
import numpy as np
from PIL import Image
def fabriquer(path, graine=20261018):
    rng = np.random.default_rng(graine)
    bloc = np.clip(rng.normal(0.80, 0.045, (64, 64)), 0.66, 0.92)
    img = np.repeat(np.repeat(bloc, 4, axis=0), 4, axis=1) + rng.normal(0, 0.012, (256, 256))
    v = np.clip(img * 255, 0, 255).astype(np.uint8)
    Image.fromarray(np.stack([v, v, v], axis=-1)).save(path)
    return float(img.mean())
if __name__ == "__main__":
    import sys; print("moyenne", fabriquer(sys.argv[1]))
