import type { MapData } from "../data/map";
import type { TerrainData } from "../data/terrain";
import type { Province } from "../data/schemas";
import type { MapDynamic, MapProvince } from "../render/strategicMap";
import type { LabelSpec } from "../render/labels";
import type { GameState } from "../sim/core/state";
import { t } from "../i18n";

const MONDE = new Set(["I01", "R01", "S01", "S02", "S03", "S04"]);

/**
 * Géométrie de dessin (MAP) : les provinces, la côte et l'emprise de la carte réaliste remplacent celles du schéma
 * d'anneaux pour tout ce qui est tracé à l'écran (provinces, itinéraires, étiquettes, clics). La simulation garde
 * son graphe (data/geo) : rien ne change pour elle.
 */
export function drawingMap(map: MapData, terrain: TerrainData): MapData {
  const provinces: MapData["provinces"] = {};
  for (const [id, p] of Object.entries(map.provinces)) {
    const d = terrain.provinces[id];
    provinces[id] = d ? { ...p, polygon: d.polygon, anchor: d.anchor } : p;
  }
  return { ...map, bounds: terrain.bounds, coast: terrain.coast, provinces };
}

/** Assemble la géométrie (data/map) et les définitions validées (Worker) en modèle de rendu. */
export function buildMapProvinces(map: MapData, provinces: readonly Province[]): MapProvince[] {
  return provinces.flatMap((p) => {
    const geo = map.provinces[p.id];
    if (!geo) return [];
    return [{
      id: p.id,
      polygon: geo.polygon,
      anchor: geo.anchor,
      terrain: p.terrain,
      kind: p.kind,
      region: p.region,
      keyResource: p.key_resource,
      name: t(p.name_key),
      canon: p.canon,
      visibility: p.visibility,
    }];
  });
}

/** Toponymes et niveau de détail d'apparition (F-STR-01). */
export function buildLabels(map: MapData, provinces: readonly Province[], terrain?: TerrainData): LabelSpec[] {
  // Icônes posées sur la carte (villes, portes) : un nom au même point passe dessous.
  const icons = [...(terrain?.towns.map((tw) => tw.at) ?? []), ...(terrain?.gates.map((g) => g.at) ?? [])];
  const onIcon = (at: readonly number[]): boolean => icons.some(([x, y]) => Math.hypot(x - (at[0] ?? 0), y - (at[1] ?? 0)) < 4);
  return provinces.flatMap((p): LabelSpec[] => {
    const geo = map.provinces[p.id];
    if (!geo) return [];
    const code = p.atlas_code ?? "";
    const style: LabelSpec["style"] = code === "I01" ? "capitale" : MONDE.has(code) ? "district" : p.kind === "outre" ? "outre" : "province";
    const minLod: LabelSpec["minLod"] = MONDE.has(code) ? "monde" : p.kind === "segment" ? "province" : "region";
    const at: [number, number] = code === "I01" ? [geo.anchor[0], geo.anchor[1] - 22] : geo.anchor;
    // Plus de taches « inexploré » écrites sur la carte (E-UX-3) : l'inconnu est seulement voilé.
    if (p.kind === "segment" && !MONDE.has(code)) return [{ id: p.id, text: t(p.name_key), at: terrain ? onWallLine(terrain, at) : at, minLod, style, alongWall: true }];
    return [{ id: p.id, text: t(p.name_key), at, minLod, style, ...(code !== "I01" && onIcon(at) ? { offset: [0, style === "district" ? -19 : 15] as [number, number] } : {}) }];
  });
}

/** Ce qui change avec la partie : état des murs, garnisons, contrôle. */
export function mapDynamic(state: GameState): MapDynamic {
  const out: MapDynamic = { provinces: {} };
  for (const [id, ps] of Object.entries(state.strategic?.provinces ?? {})) {
    out.provinces[id] = { structure: ps.wall_structure, garrisonOrg: ps.garrison?.org ?? null, control: ps.control };
  }
  return out;
}

/** Point de la ligne médiane du mur le plus proche, au même relèvement : le nom d'un segment s'écrit dans sa bande. */
function onWallLine(terrain: TerrainData, [x, y]: readonly number[]): [number, number] {
  const r = Math.hypot(x ?? 0, y ?? 0);
  const b = (Math.atan2(x ?? 0, -(y ?? 0)) * 180) / Math.PI;
  let best = r;
  let gap = Infinity;
  for (const w of terrain.walls) {
    const i = Math.round((((b % 360) + 360) % 360) / (360 / w.line.length)) % w.line.length;
    const p = w.line[i];
    if (!p) continue;
    const rw = Math.hypot(p[0], p[1]);
    if (Math.abs(rw - r) < gap) [best, gap] = [rw, Math.abs(rw - r)];
  }
  const a = (b * Math.PI) / 180;
  return [best * Math.sin(a), -best * Math.cos(a)];
}
