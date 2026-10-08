/** Palette d'atlas (04 §1.2) : couleurs Paradis, appliquées comme aquarelle très diluée sur le papier. */
export const INK = 0x1c1a17;
export const PAPER = 0xe8dcc0;
export const PAPER_DARK = 0xcdbf9f;
export const STONE = 0x8a8577;
export const OCHRE = 0xb5873a;
export const VERDIGRIS = 0x4f6b5a;
export const BRICK = 0x8a3b2a;
export const UNKNOWN = 0x7b766b;
export const SEA = 0xc9c6b0;
/** Teintes des calques « religion » et « population » (déplacées de src/ui/overlays.ts : aucune couleur en dur dans src/ui, U1). */
export const PLUM = 0x5b4a6b;
export const INK_SOFT = 0x3a352d;

/** Teinte d'aquarelle par région (lavis de base, avant overlays). */
export const REGION_WASH: Record<string, number> = {
  outre_murs: 0xa49a7a,
  anneau_maria: 0x8fa07a,
  anneau_rose: 0xc29b62,
  interieur_sina: 0xb07a68,
  mur_maria: STONE,
  mur_rose: STONE,
  mur_sina: STONE,
};

export function mix(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ch = (c: number, s: number): number => (c >> s) & 0xff;
  const lerp = (s: number): number => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

/** Échelle séquentielle papier → teinte (overlays). */
export function sequential(tint: number, t: number): number {
  return mix(PAPER, tint, 0.15 + 0.85 * Math.max(0, Math.min(1, t)));
}

/** Échelle divergente brique ← papier → vert-de-gris (t dans [-1, 1]). */
export function diverging(t: number): number {
  return t < 0 ? mix(PAPER, BRICK, -t) : mix(PAPER, VERDIGRIS, t);
}
