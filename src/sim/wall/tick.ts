import type { WallBalance, WallLayout } from "../../data/balance";
import type { ProvinceState } from "../strategic/economy";
import { stepEvacuationHour } from "./breach";
import { stepDay, stepMonth } from "./pressure";
import { wallFromProvinces } from "./strategic";
import type { WallState } from "./types";

/** État initial du pilier P1 à partir des provinces et de la table de districts [A] (D-165). Pur. */
export function initWall(provinces: Record<string, ProvinceState>, layout: WallLayout): WallState {
  return wallFromProvinces(provinces, layout.districts);
}

/**
 * Pas de tick du pilier P1 : un jour (pression, rations, ordre, réfugiés), 24 heures d'évacuation si une évacuation
 * est en cours, et le contrôle de fin de mois quand `monthStart` est vrai. Pur, sans aléa ; ne modifie pas son entrée.
 */
export function tickWall(prev: WallState, b: WallBalance, monthStart: boolean): WallState {
  let s = stepDay(prev, b);
  if (s.evacuations.some((e) => !e.done)) for (let h = 0; h < 24; h++) s = stepEvacuationHour(s, b);
  if (monthStart) s = stepMonth(s, b);
  return s;
}
