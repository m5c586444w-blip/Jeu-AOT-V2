import type { MapData } from "../data/map";
import type { Province } from "../data/schemas";
import type { MapDynamic, MapProvince } from "../render/strategicMap";
import type { LabelSpec } from "../render/labels";
import type { GameState } from "../sim/core/state";
import { t } from "../i18n";

const MONDE = new Set(["I01", "R01", "S01", "S02", "S03", "S04"]);

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
export function buildLabels(map: MapData, provinces: readonly Province[]): LabelSpec[] {
  return provinces.flatMap((p): LabelSpec[] => {
    const geo = map.provinces[p.id];
    if (!geo) return [];
    const code = p.atlas_code ?? "";
    const style: LabelSpec["style"] = code === "I01" ? "capitale" : MONDE.has(code) ? "district" : p.kind === "outre" ? "outre" : "province";
    const minLod: LabelSpec["minLod"] = MONDE.has(code) ? "monde" : p.kind === "segment" ? "province" : "region";
    const at: [number, number] = code === "I01" ? [geo.anchor[0], geo.anchor[1] - 22] : geo.anchor;
    const specs: LabelSpec[] = [{ id: p.id, text: t(p.name_key), at, minLod, style }];
    // Taches blanches annotées « inexploré » (04 §3).
    if (p.visibility === "inexplore") specs.push({ id: `${p.id}:brume`, text: t("map.unexplored"), at: [geo.anchor[0], geo.anchor[1] + 16], minLod: "monde", style: "outre" });
    return specs;
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
