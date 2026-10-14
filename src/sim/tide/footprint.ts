import type { TideBalance } from "../../data/balance";
import type { Pile } from "./types";

export const sizeOf = (p: Pick<Pile, "troops">): number => Object.values(p.troops).reduce((s, n) => s + n, 0);

/** Effectif des armes « lourdes » (artillerie, mortiers, mitrailleuses, dirigeables) : source de bruit et de fumée. */
export function heavyOf(p: Pick<Pile, "troops">, b: TideBalance): number {
  let n = 0;
  for (const [w, c] of Object.entries(p.troops)) if (b.weapons[w]?.heavy) n += c;
  return n;
}

/** Bruit « sans la taille » : 1 + bruit + fumée + artillerie (sert à l'attention des Titans, déjà proportionnelle à l'effectif). */
export function noiseFactor(p: Pile, b: TideBalance): number {
  const f = b.footprint;
  return 1 + f.noise_k * p.noise + f.smoke_k * p.smoke + f.artillery_k * Math.log2(1 + heavyOf(p, b));
}

/** Empreinte (spec 26 §3) : bruit, fumée, artillerie, plus un terme logarithmique de taille. Croît avec chacun. */
export function signature(p: Pile, b: TideBalance): number {
  return noiseFactor(p, b) + b.footprint.size_k * Math.log2(1 + sizeOf(p) / b.footprint.size_ref);
}
