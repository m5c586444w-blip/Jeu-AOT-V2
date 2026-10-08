import type { BattleState, KillSource } from "../../sim/tactical/types";

/** Ligne chiffrée du bilan de bataille : clé du libellé, valeur, clés et paramètres du « pourquoi ? » (une section par clé). */
export interface SummaryRow {
  key: string;
  value: number;
  why: string[];
  params?: Record<string, string | number>;
}

const SOURCES: readonly KillSource[] = ["lame", "lance", "porteur", "pur"];

/**
 * Lignes chiffrées du bilan (04 §5.12), tirées de l'état final de la bataille (R0.2e) :
 * - « Titans abattus » compte tous les Titans tués, avec leur cause (lame, lance de foudre, porteur allié) ;
 * - « Coupes réussies » compte les coupes qui ont porté, rapportées aux tentatives ;
 * - les lances de foudre ont leur ligne : un Titan tué aux lances, tirées du sol, ne coûte ni coupe ni gaz.
 */
export function battleSummary(st: BattleState): SummaryRow[] {
  const s = st.stats;
  const dead = st.soldiers.filter((x) => x.mode === "mort");
  const killed = Object.values(s.titansKilled).reduce((a, b) => a + b, 0);
  const by = s.killedBy ?? {};
  const causes = SOURCES.filter((k) => (by[k] ?? 0) > 0).map((k) => `tac.sum.by_${k}`);
  const spears = s.spears?.thrown ?? 0;
  const gas = Math.round(s.gasUsed);
  const rows: SummaryRow[] = [
    { key: "tac.sum.dead", value: dead.length, why: ["tac.sum.dead_why"] },
    { key: "tac.sum.napes", value: killed, why: ["tac.sum.napes_why", ...causes], params: { lame: by.lame ?? 0, lance: by.lance ?? 0, porteur: by.porteur ?? 0, pur: by.pur ?? 0 } },
    { key: "tac.sum.cuts", value: s.cutsLanded ?? 0, why: ["tac.sum.cuts_why"], params: { landed: s.cutsLanded ?? 0, tries: s.cuts } },
    { key: "tac.sum.limbs", value: s.limbs, why: ["tac.sum.limbs_why"] },
    { key: "tac.sum.dodges", value: s.dodges, why: ["tac.sum.dodges_why"] },
    { key: "tac.sum.rescues", value: s.rescues, why: ["tac.sum.rescues_why"] },
    { key: "tac.sum.blades", value: s.bladesBroken, why: ["tac.sum.blades_why"] },
    { key: "tac.sum.gas", value: gas, why: gas === 0 && spears > 0 ? ["tac.sum.gas_why", "tac.sum.gas_zero_spears"] : ["tac.sum.gas_why"] },
  ];
  const art = s.artillery;
  if (art && art.shots > 0) rows.push({ key: "tac.sum.shells", value: art.shots, why: ["tac.sum.shells_why"], params: { shots: art.shots, titans: art.titanHits, soldiers: art.soldierKills, friendly: art.friendlyKills, silenced: art.piecesSilenced } });
  if (spears > 0) rows.splice(3, 0, { key: "tac.sum.spears", value: s.spears?.hits ?? 0, why: ["tac.sum.spears_why"], params: { hits: s.spears?.hits ?? 0, thrown: spears } });
  return rows;
}
