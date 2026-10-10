import type { CustomDifficulty, DifficultyBalance, DifficultyId, DifficultySetting } from "../../data/endingSchemas";
import { RESOURCE_IDS } from "./resources";
import type { WorldSource } from "./world";

/**
 * Difficultés (P9.3, `data/balance/difficulty.json`) : appliquées une fois, à la construction du monde, sur une copie de la source.
 * « Normal » rend la source telle quelle (même objet) : le monde, donc toute empreinte, est inchangé.
 * - production de Paradis : multiplicateur de production du scénario, pour chaque ressource ;
 * - Titans : densité des provinces et du scénario (bornée à 1) ;
 * - IA ennemies : poids d'attaque de chaque personnalité (couche des nations) ;
 * - pertes : morts de base d'un engagement d'expédition ;
 * - moral et stabilité de départ : décalés (bornés à 0–100).
 * Une difficulté personnalisée (P10.1) porte directement ces six réglages.
 */
export function difficultyLevel(table: DifficultyBalance | undefined, id: DifficultyId): DifficultyBalance["niveaux"][number] | null {
  return table?.niveaux.find((l) => l.id === id) ?? null;
}

const unit = (v: number): number => Math.max(0, Math.min(1, v));
const pct = (v: number): number => Math.max(0, Math.min(100, v));

export function applyDifficulty(src: WorldSource, scenarioId: string, setting: DifficultySetting): WorldSource {
  if (setting === "normal") return src;
  const d: CustomDifficulty | null = typeof setting === "string" ? difficultyLevel(src.difficulty, setting) : setting;
  if (!d) return src;
  const scenarios = src.scenarios.map((sc) => {
    if (sc.id !== scenarioId) return sc;
    const pm: Partial<Record<(typeof RESOURCE_IDS)[number], number>> = {};
    for (const r of RESOURCE_IDS) pm[r] = (sc.production_mult[r] ?? 1) * d.production;
    const density = Object.fromEntries(Object.entries(sc.titan_density).map(([k, v]) => [k, unit(v * d.titans)]));
    return { ...sc, production_mult: pm, titan_density: density, morale: pct(sc.morale + d.moral), stability: pct(sc.stability + d.stabilite) };
  });
  const provinces = src.provinces.map((p) => ({ ...p, titan_density: unit(p.titan_density * d.titans) }));
  const out: WorldSource = { ...src, scenarios, provinces };
  if (src.worldBalance) {
    const personality = Object.fromEntries(Object.entries(src.worldBalance.ai.personality).map(([k, w]) => [k, { ...w, attack: w.attack * d.ia_attaque }]));
    out.worldBalance = { ...src.worldBalance, ai: { ...src.worldBalance.ai, personality } };
  }
  if (src.expeditions) out.expeditions = { ...src.expeditions, engagement: { ...src.expeditions.engagement, deaths_base: src.expeditions.engagement.deaths_base * d.pertes } };
  return out;
}
