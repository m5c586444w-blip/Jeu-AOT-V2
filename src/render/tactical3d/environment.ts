import type { EnvData } from "./envTypes";
import { generateCountryside, generateVillage } from "./envCountry";
import { generateCapital, generateDistrict } from "./envTown";
import { generateWallEnv } from "./envWall";
import { generateGiantForest, generateTerritory } from "./envNature";
import { profile, wallInScene, withVariant } from "./styles";
import type { Variant } from "./styles";

/**
 * Environnements de R1b : aiguillage pur d'un profil de style vers son générateur (`generateur` du profil), puis réglages
 * communs (état de la variante, brume, rayon, ancrages). Même graine et même variante = même environnement (test).
 */
export type EnvBody = Omit<EnvData, "id" | "seed" | "profile" | "variant" | "generator" | "radius" | "anchors" | "mist"> & Partial<Pick<EnvData, "radius" | "anchors" | "mist">>;

/** Niveau de ruine d'un état de variante. */
export function ruinOf(v: Variant | null): number {
  switch (v?.etat) {
    case "ravage":
      return 0.42;
    case "ruines_incendies":
      return 0.72;
    case "abandonne":
      return 0.22;
    default:
      return 0;
  }
}

type Builder = (env: { p: EnvData["profile"]; v: Variant | null; seed: number; ruin: number }) => EnvBody;

const BUILDERS: Partial<Record<EnvData["generator"], Builder>> = {
  district: ({ p, v, seed, ruin }) => generateDistrict(p, v, seed, ruin),
  capitale: ({ p, v, seed, ruin }) => generateCapital(p, v, seed, ruin),
  mur: ({ p, v, seed }) => generateWallEnv(p, v, seed),
  foret_geante: ({ p, v, seed }) => generateGiantForest(p, v, seed),
  territoire: ({ p, v, seed }) => generateTerritory(p, v, seed),
  campagne: ({ p, v, seed, ruin }) => generateCountryside(p, v, seed, { ruin, abandoned: v?.etat === "abandonne" }),
  village: ({ p, v, seed, ruin }) =>
    generateVillage(p, v, seed, { ruin, abandoned: v?.etat === "abandonne", radius: p.categorie === "abords" ? 190 : 150, chapel: true, suburb: p.id === "E26", ...(p.mur_visible.visible && p.mur_visible.distance_m !== null ? { wallDistance: p.mur_visible.distance_m } : {}) }),
};

export function supportedGenerators(): string[] {
  return Object.keys(BUILDERS);
}

export function generateEnvironment(id: string, seed: number, variantId: string | null = null): EnvData {
  const base = profile(id);
  const { profile: p, variant } = withVariant(base, variantId);
  const build = BUILDERS[p.generateur];
  if (!build) throw new Error(`générateur « ${p.generateur} » (${id}) pas encore disponible`);
  // Chaque variante a sa propre graine dérivée : Ragako, Dauper et Jinae ne sont pas le même village.
  const vseed = variant ? (seed ^ [...variant.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261)) >>> 0 : seed;
  const ruin = ruinOf(variant);
  const body = build({ p, v: variant, seed: vseed, ruin });
  const env: EnvData = {
    id,
    seed,
    profile: p,
    variant,
    generator: p.generateur,
    radius: body.radius ?? (body.terrain ? body.terrain.spec.size / 2 : 300),
    anchors: body.anchors ?? [],
    mist: body.mist ?? { density: p.terrain.eau === "marais" ? 0.6 : 0, top: 6 },
    ...body,
  };
  // Règle de visibilité du mur : jamais de mur dans une scène dont le profil l'exclut (campagne intérieure).
  if (!wallInScene(p) && env.wall) throw new Error(`${id} : un mur a été généré alors que le profil l'exclut`);
  return env;
}

/** Comptes d'un environnement (tests, rapport). */
export function envStats(e: EnvData): Record<string, number> {
  return {
    buildings: e.buildings.length,
    landmarks: e.landmarks.length,
    props: e.props.length,
    trees: e.terrain?.trees.length ?? 0,
    parcels: e.terrain?.parcels.length ?? 0,
    hedges: e.terrain?.hedges.length ?? 0,
    giants: e.giants.length,
    anchors: e.anchors.length,
    titans: e.titans.length,
    fires: e.fires.length,
    wall: e.wall ? 1 : 0,
  };
}
