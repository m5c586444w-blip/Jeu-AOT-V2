import type { Province } from "../data/schemas";
import { BRICK, diverging, OCHRE, sequential, STONE, UNKNOWN, VERDIGRIS } from "../render/palette";
import type { GameState } from "../sim/core/state";
import { capacity, provinceProduction } from "../sim/strategic/economy";
import type { World } from "../sim/strategic/world";
import { supplyAt, titanDensity } from "../sim/military/routes";
import { knownTitans, localLegitimacy } from "../sim/intel/intel";
import { toAbsoluteDay } from "../sim/core/time";

/** Les 10 overlays de la carte (F-STR-02). Ceux dont le système n'existe pas encore restent fermés, sans valeur inventée. */
export const OVERLAY_IDS = ["politique", "moral", "nourriture", "gaz", "titans", "population", "religion", "legitimite", "ravitaillement", "renseignement"] as const;
export type OverlayId = (typeof OVERLAY_IDS)[number];

/** Phase qui ouvrira le registre d'un overlay non encore alimenté (tous ouverts depuis P5). */
export const OVERLAY_PHASE: Partial<Record<OverlayId, string>> = {};

export function isAvailable(id: OverlayId): boolean {
  return !(id in OVERLAY_PHASE);
}

export interface OverlayResult {
  colors: Map<string, number>;
  /** Valeur brute par province (affichée dans la légende et le dossier). */
  values: Map<string, number>;
  /** Échelle de la légende : [libellé, couleur] du plus bas au plus haut. */
  legend: { label: string; color: number }[];
}

const CONTROL_COLOR: Record<string, number> = { paradis: VERDIGRIS, titans: BRICK, perdu: STONE };

/** Calcule un overlay à partir de l'état de simulation (mêmes fonctions que le tick, donc explicables). */
export function computeOverlay(id: OverlayId, world: World, state: GameState, fmt: (n: number) => string, label: (k: string) => string): OverlayResult | null {
  const st = state.strategic;
  if (!st || !isAvailable(id)) return null;
  const colors = new Map<string, number>();
  const values = new Map<string, number>();
  const provinces: readonly Province[] = world.provinces.filter((p) => p.kind !== "segment");
  const scale = (tint: number, max: number, unit: (n: number) => string): OverlayResult["legend"] =>
    [0, 0.25, 0.5, 0.75, 1].map((k) => ({ label: unit(max * k), color: sequential(tint, k) }));

  switch (id) {
    case "politique": {
      for (const p of provinces) {
        const c = st.provinces[p.id]?.control ?? "titans";
        values.set(p.id, c === "paradis" ? 1 : 0);
        colors.set(p.id, CONTROL_COLOR[c] ?? UNKNOWN);
      }
      return { colors, values, legend: Object.entries(CONTROL_COLOR).map(([k, color]) => ({ label: label(`control.${k}`), color })) };
    }
    case "moral": {
      for (const p of provinces) {
        const ps = st.provinces[p.id];
        if (!ps || ps.control !== "paradis" || ps.population <= 0) continue;
        values.set(p.id, ps.morale);
        colors.set(p.id, diverging((ps.morale - 50) / 50));
      }
      return { colors, values, legend: [0, 25, 50, 75, 100].map((m) => ({ label: fmt(m), color: diverging((m - 50) / 50) })) };
    }
    case "nourriture":
    case "gaz": {
      const r = id === "nourriture" ? "food" : "gas";
      for (const p of provinces) {
        const v = id === "nourriture" ? provinceProduction(world, st, state.date, p.id, r).value : gasHolding(world, state, p.id);
        if (v > 0) values.set(p.id, v);
      }
      const max = Math.max(1, ...values.values());
      for (const [pid, v] of values) colors.set(pid, sequential(id === "nourriture" ? OCHRE : VERDIGRIS, v / max));
      return { colors, values, legend: scale(id === "nourriture" ? OCHRE : VERDIGRIS, max, fmt) };
    }
    case "titans": {
      // Brouillard de guerre (P5, F-INT-01) : on montre ce que l'on sait, daté ; une province jamais observée reste inconnue.
      const today = toAbsoluteDay(state.date);
      for (const p of provinces) {
        const k = state.intel ? knownTitans(state.intel, p.id, today) : { value: titanDensity(world, p.id, st), age: 0 };
        if (!k) continue;
        values.set(p.id, k.value);
        colors.set(p.id, sequential(BRICK, k.value));
      }
      return { colors, values, legend: state.intel ? [...scale(BRICK, 1, (n) => fmt(n)), { label: label("overlay.unknown"), color: UNKNOWN }] : scale(BRICK, 1, (n) => fmt(n)) };
    }
    case "renseignement": {
      // Âge de l'information (F-INT-01) : à jour sur le territoire tenu, vieillissante ailleurs, inconnue jamais vue.
      if (!state.intel) return null;
      const today = toAbsoluteDay(state.date);
      for (const p of provinces) {
        const k = knownTitans(state.intel, p.id, today);
        if (!k) continue;
        values.set(p.id, k.age);
        colors.set(p.id, k.age <= 1 ? VERDIGRIS : sequential(OCHRE, Math.min(1, k.age / 120)));
      }
      return { colors, values, legend: [{ label: label("overlay.renseignement.fresh"), color: VERDIGRIS }, ...[30, 60, 120].map((d) => ({ label: label("overlay.renseignement.days").replace("{n}", fmt(d)), color: sequential(OCHRE, d / 120) })), { label: label("overlay.unknown"), color: UNKNOWN }] };
    }
    case "religion": {
      // Influence du Culte des Murs (02 §5), par province, en données A.
      if (!state.intel) return null;
      for (const p of provinces) {
        const v = state.intel.cult[p.id] ?? 0;
        if (v <= 0 || st.provinces[p.id]?.control !== "paradis") continue;
        values.set(p.id, Math.round(v));
        colors.set(p.id, sequential(0x5b4a6b, v / 100));
      }
      return { colors, values, legend: scale(0x5b4a6b, 100, fmt) };
    }
    case "legitimite": {
      // Légitimité perçue localement : nationale, moral, stabilité, Culte (fiche « pourquoi ? » dans le dossier de province).
      if (!state.politics) return null;
      for (const p of provinces) {
        const ps = st.provinces[p.id];
        if (!ps || ps.control !== "paradis" || ps.population <= 0) continue;
        const v = localLegitimacy(world, state.politics, st, state.intel, p.id).value;
        values.set(p.id, Math.round(v));
        colors.set(p.id, diverging((v - 50) / 50));
      }
      return { colors, values, legend: [0, 25, 50, 75, 100].map((m) => ({ label: fmt(m), color: diverging((m - 50) / 50) })) };
    }
    case "ravitaillement": {
      // F-STR-13 : distance à la source la plus proche (mur tenu ou dépôt) ; vert-de-gris dans le rayon.
      if (!world.military) return null;
      for (const p of provinces) {
        const s = supplyAt(world, st, state.military, p.id);
        values.set(p.id, Math.round(s.km));
        colors.set(p.id, s.inSupply ? VERDIGRIS : sequential(BRICK, Math.min(1, s.km / 250)));
      }
      return { colors, values, legend: [{ label: label("overlay.ravitaillement.in"), color: VERDIGRIS }, ...[50, 125, 250].map((km) => ({ label: `${fmt(km)} km`, color: sequential(BRICK, km / 250) }))] };
    }
    case "population": {
      for (const p of provinces) {
        const n = st.provinces[p.id]?.population ?? 0;
        if (n > 0) values.set(p.id, n);
      }
      const max = Math.max(1, ...values.values());
      for (const [pid, v] of values) colors.set(pid, sequential(0x3a352d, v / max));
      return { colors, values, legend: scale(0x3a352d, max, fmt) };
    }
    default:
      return null;
  }
}

/** Capacité de stockage de gaz d'une province (dépôts, fabriques) : où se trouve la ressource critique de l'ODM. */
function gasHolding(world: World, state: GameState, provinceId: string): number {
  const st = state.strategic;
  const ps = st?.provinces[provinceId];
  if (!st || !ps || ps.control !== "paradis") return 0;
  const single = { ...st, provinces: { [provinceId]: ps } };
  const onlyThis = { ...world, provinces: world.provinces.filter((p) => p.id === provinceId) };
  return capacity(onlyThis, single, "gas").value;
}
