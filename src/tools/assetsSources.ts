/**
 * Sources externes de R1c, épinglées sur un commit des dépôts officiels de MakeHuman (CC0, § C de `LICENSE.md` du dépôt
 * `makehumancommunity/makehuman` ; `LICENSE.ASSETS.md` de `makehumancommunity/mpfb2`). `npm run assets:fetch` les télécharge
 * dans `docs/art/assets/` et tient le manifeste ; `npm run assets:build` en tire le corps de base `.glb`.
 */
export const MAKEHUMAN_COMMIT = "a8bc2d54ff0ac92e78ff71431b1023eda42bf482";
export const MPFB2_COMMIT = "d0a32e57a7f915cb2f2b95410e2117648c7bbb7e";
const MH = `https://raw.githubusercontent.com/makehumancommunity/makehuman/${MAKEHUMAN_COMMIT}/makehuman/data`;
const MPFB = `https://raw.githubusercontent.com/makehumancommunity/mpfb2/${MPFB2_COMMIT}/src/mpfb/data`;

export const MH_AUTHOR = "MakeHuman Team : Data Collection AB, Joel Palmius, Jonas Hauquier ; cibles d'origine de Manuel Bastioni (CC0 depuis 2020)";

export interface SourceFile {
  /** Chemin dans `docs/art/assets/`. */
  fichier: string;
  url: string;
  nom: string;
}

const RACES = ["african", "asian", "caucasian"] as const;
const GENDERS = ["male", "female"] as const;
const AGES = ["young", "old"] as const;
const LEVELS = ["min", "average", "max"] as const;

/** Cibles de détail retenues (relatives au maillage de base), pour les Titans et les expressions. */
export const DETAIL_TARGETS = [
  "stomach/stomach-pregnant-incr",
  "stomach/stomach-pregnant-decr",
  "neck/neck-scale-vert-incr",
  "neck/neck-scale-vert-decr",
  "neck/neck-scale-horiz-incr",
  "arms/measure-upperarm-length-incr",
  "arms/measure-upperarm-length-decr",
  "arms/measure-lowerarm-length-incr",
  "arms/measure-lowerarm-length-decr",
  "legs/upperlegs-height-incr",
  "legs/upperlegs-height-decr",
  "legs/lowerlegs-height-incr",
  "legs/lowerlegs-height-decr",
  "torso/measure-napetowaist-dist-incr",
  "torso/measure-napetowaist-dist-decr",
  "torso/measure-shoulder-dist-incr",
  "torso/measure-shoulder-dist-decr",
  "hip/hip-scale-horiz-incr",
  "hip/hip-scale-horiz-decr",
  "head/head-fat-incr",
  "expression/units/caucasian/mouth-open",
  "expression/units/caucasian/mouth-corner-puller",
  "expression/units/caucasian/mouth-retraction",
  "expression/units/caucasian/mouth-depression",
  "expression/units/caucasian/eye-left-opened-up",
  "expression/units/caucasian/eye-right-opened-up",
  "expression/units/caucasian/eye-left-closure",
  "expression/units/caucasian/eye-right-closure",
  "expression/units/caucasian/eyebrows-left-inner-up",
  "expression/units/caucasian/eyebrows-right-inner-up",
] as const;

export function sourceFiles(): SourceFile[] {
  const out: SourceFile[] = [
    { fichier: "makehuman/base.obj", url: `${MH}/3dobjs/base.obj`, nom: "MakeHuman, maillage de base hm08" },
    { fichier: "makehuman/rig.game_engine.json", url: `${MPFB}/rigs/standard/rig.game_engine.json`, nom: "MakeHuman, squelette « game_engine » (MPFB2)" },
    { fichier: "makehuman/weights.game_engine.json", url: `${MPFB}/rigs/standard/weights.game_engine.json`, nom: "MakeHuman, poids du squelette « game_engine » (MPFB2)" },
    { fichier: "makehuman/default.mhskel", url: `${MH}/rigs/default.mhskel`, nom: "MakeHuman, squelette par défaut (articulations de la mâchoire)" },
    { fichier: "makehuman/default_weights.mhw", url: `${MH}/rigs/default_weights.mhw`, nom: "MakeHuman, poids du squelette par défaut (mâchoire)" },
    { fichier: "makehuman/eyes/high-poly.obj", url: `${MH}/eyes/high-poly/high-poly.obj`, nom: "MakeHuman, yeux haute définition (maillage)" },
    { fichier: "makehuman/eyes/high-poly.mhclo", url: `${MH}/eyes/high-poly/high-poly.mhclo`, nom: "MakeHuman, yeux haute définition (ajustement au corps)" },
    { fichier: "makehuman/eyes/brown_eye.png", url: `${MH}/eyes/materials/brown_eye.png`, nom: "MakeHuman, texture d'iris brun" },
  ];
  for (const r of RACES) for (const g of GENDERS) for (const a of AGES) out.push({ fichier: `makehuman/cibles/macrodetails/${r}-${g}-${a}.target.gz`, url: `${MPFB}/targets/macrodetails/${r}-${g}-${a}.target.gz`, nom: `MakeHuman, cible ${r}-${g}-${a}` });
  for (const g of GENDERS)
    for (const a of AGES)
      for (const m of LEVELS)
        for (const w of LEVELS) {
          const n = `universal-${g}-${a}-${m}muscle-${w}weight`;
          out.push({ fichier: `makehuman/cibles/macrodetails/${n}.target.gz`, url: `${MPFB}/targets/macrodetails/${n}.target.gz`, nom: `MakeHuman, cible ${n}` });
        }
  for (const d of DETAIL_TARGETS) out.push({ fichier: `makehuman/cibles/${d}.target.gz`, url: `${MPFB}/targets/${d}.target.gz`, nom: `MakeHuman, cible ${d.split("/").pop() ?? d}` });
  return out;
}
