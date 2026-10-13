import { BALANCE_FILES } from "../data/balance";
import type { BalanceName } from "../data/balance";
import { CampaignFileSchema, DIFFICULTY_IDS, DifficultyFileSchema, ScenarioModsSchema } from "../data/campaignSchema";
import type { BalancePatch, Campaign, DifficultyFile, DifficultyId, ScenarioMods } from "../data/campaignSchema";
import { EventDefSchema, ScenarioSchema } from "../data/schemas";
import type { EventDef, Scenario } from "../data/schemas";
import { jsonPath } from "../data/validate";
import type { DataIssue } from "../data/validate";
import type { WorldSource } from "../sim/strategic/world";

/**
 * Campagnes de P9 (D-154) : le scénario de base reste la référence de la simulation (tests, empreintes de `sim:selftest`) ;
 * une campagne en dérive un scénario `scn_camp_<campagne>__<difficulté>` au chargement du monde, avec ses événements propres,
 * la difficulté et les réglages de P9.5. Rien ne change dans `src/sim` : la source de monde transformée a la même forme.
 */

export interface CampaignData {
  campaigns: readonly Campaign[];
  difficulty: DifficultyFile | null;
  issues: DataIssue[];
}

/** Lit `/data/campagnes/*.json` et `/data/balance/difficulty.json` dans une table de fichiers déjà lus (Worker ou Node). */
export function campaignDataFromFiles(files: Readonly<Record<string, unknown>>): CampaignData {
  const campaigns: Campaign[] = [];
  const issues: DataIssue[] = [];
  let difficulty: DifficultyFile | null = null;
  for (const path of Object.keys(files).sort()) {
    const file = path.slice(1);
    if (path.startsWith("/data/campagnes/") && path.endsWith(".json")) {
      const res = CampaignFileSchema.safeParse(files[path]);
      if (res.success) campaigns.push(...res.data);
      else for (const i of res.error.issues) issues.push({ file, jsonPath: jsonPath(i.path), message: i.message });
    } else if (path === "/data/balance/difficulty.json") {
      const res = DifficultyFileSchema.safeParse(files[path]);
      if (res.success) difficulty = res.data;
      else for (const i of res.error.issues) issues.push({ file, jsonPath: jsonPath(i.path), message: i.message });
    }
  }
  const seen = new Set<string>();
  for (const c of campaigns) {
    if (seen.has(c.id)) issues.push({ file: "data/campagnes", jsonPath: "$", message: `campagne en double : ${c.id}` });
    seen.add(c.id);
  }
  if (campaigns.length > 0 && !difficulty) issues.push({ file: "data/balance/difficulty.json", jsonPath: "$", message: "difficultés absentes (P9.3)" });
  return { campaigns, difficulty, issues };
}

export const campaignScenarioId = (campaign: string, difficulty: DifficultyId): string => `scn_camp_${campaign.replace(/^c/, "")}__${difficulty}`;

export function parseCampaignScenarioId(id: string): { campaign: string; difficulty: DifficultyId } | null {
  const m = /^scn_camp_([a-z0-9]+)__([a-z]+)$/.exec(id);
  if (!m || !(DIFFICULTY_IDS as readonly string[]).includes(m[2] ?? "")) return null;
  return { campaign: `c${m[1] ?? ""}`, difficulty: m[2] as DifficultyId };
}

export function findCampaign(data: Pick<CampaignData, "campaigns">, id: string): Campaign | undefined {
  return data.campaigns.find((c) => c.id === id);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Fusion profonde : objets fusionnés clé à clé, tableaux et valeurs simples remplacés. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObj(base) || !isObj(patch)) return structuredClone(patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : structuredClone(v);
  return out as T;
}

/** Modificateurs effectifs : réglages de la campagne (P9.5), puis niveau (multiplicateurs multipliés, écarts additionnés). */
export function effectiveMods(data: CampaignData, campaign: string, difficulty: DifficultyId): ScenarioMods {
  const base = ScenarioModsSchema.parse({});
  const tuning = data.difficulty?.tuning.campaigns[campaign] ?? {};
  const level = data.difficulty?.levels.find((l) => l.id === difficulty)?.scenario ?? base;
  const out: ScenarioMods = { ...base };
  for (const k of Object.keys(base) as (keyof ScenarioMods)[]) {
    const a = tuning[k] ?? base[k];
    const b = level[k];
    out[k] = k.endsWith("_mult") ? a * b : a + b;
  }
  return out;
}

const BALANCE_KEY: Record<BalanceName, keyof WorldSource | null> = {
  economy: "economy",
  time: "time",
  politics: "politics",
  society: "society",
  expeditions: "expeditions",
  logistics: "logistics",
  tactical: "tactical",
  events: "eventsBalance",
  research: "research",
  intel: "intel",
  shifters: "shiftersBalance",
  world: "worldBalance",
  armies: "armiesBalance",
  missions: "missionsBalance",
  difficulty: null,
};

function applyBalancePatch(src: WorldSource, patch: BalancePatch, where: string): WorldSource {
  let out = src;
  for (const [name, p] of Object.entries(patch)) {
    const key = BALANCE_KEY[name as BalanceName];
    if (!key) throw new Error(`${where} : fichier d'équilibrage inconnu ou non modifiable « ${name} »`);
    const current = out[key];
    if (current === undefined) throw new Error(`${where} : data/balance/${name}.json absent`);
    const res = BALANCE_FILES[name as BalanceName].safeParse(deepMerge(current, p));
    if (!res.success) throw new Error(`${where} : réglage invalide pour ${name}.json : ${res.error.issues.map((i) => `${jsonPath(i.path)} ${i.message}`).join(" ; ")}`);
    out = { ...out, [key]: res.data };
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Scénario de campagne : correctif, identifiant dérivé, modificateurs de difficulté et de réglage. */
export function campaignScenario(src: WorldSource, campaign: Campaign, id: string, mods: ScenarioMods): Scenario {
  const base = src.scenarios.find((s) => s.id === campaign.base);
  if (!base) throw new Error(`campagne ${campaign.id} : scénario de base inconnu ${campaign.base}`);
  const merged = deepMerge<Record<string, unknown>>(structuredClone(base) as unknown as Record<string, unknown>, campaign.scenario);
  const res = ScenarioSchema.safeParse({ ...merged, id, name_key: campaign.name_key });
  if (!res.success) throw new Error(`campagne ${campaign.id} : scénario invalide : ${res.error.issues.map((i) => `${jsonPath(i.path)} ${i.message}`).join(" ; ")}`);
  const s = res.data;
  for (const [r, v] of Object.entries(s.stocks)) s.stocks[r as keyof typeof s.stocks] = Math.round(v * mods.stocks_mult);
  s.morale = clamp(s.morale + mods.morale_delta, 0, 100);
  s.stability = clamp(s.stability + mods.stability_delta, 0, 100);
  if (s.politics) {
    s.politics.legitimacy = clamp(s.politics.legitimacy + mods.legitimacy_delta, 0, 100);
    s.politics.political_capital = Math.max(0, Math.round(s.politics.political_capital * mods.capital_mult));
  }
  if (mods.titan_density_mult !== 1) {
    const dens: Record<string, number> = {};
    for (const p of src.provinces) {
      const d = s.titan_density[p.id] ?? p.titan_density;
      if (d > 0) dens[p.id] = clamp(Math.round(d * mods.titan_density_mult * 1000) / 1000, 0, 1);
    }
    s.titan_density = dens;
  }
  for (const g of Object.values(s.garrisons)) g.soldiers = Math.max(1, Math.round(g.soldiers * mods.garrison_mult));
  if (s.world) {
    const faction = new Map((src.formations ?? []).map((f) => [f.id, f.faction]));
    for (const list of Object.values(s.world.formations)) for (const f of list) if (faction.get(f.formation) !== "fac_paradis") f.count = Math.max(1, Math.round(f.count * mods.enemy_forces_mult));
    s.world.hizuru_lean = clamp(s.world.hizuru_lean + mods.hizuru_lean_delta, -100, 100);
  }
  return s;
}

/**
 * Source de monde d'un scénario : inchangée pour un scénario de base ; pour un scénario de campagne, scénario dérivé ajouté,
 * événements propres, armées et missions du scénario de base reprises, réglages et difficulté appliqués à l'équilibrage.
 */
export function sourceForScenario(src: WorldSource, data: CampaignData, scenarioId: string): WorldSource {
  const parsed = parseCampaignScenarioId(scenarioId);
  if (!parsed) return src;
  const campaign = findCampaign(data, parsed.campaign);
  const level = data.difficulty?.levels.find((l) => l.id === parsed.difficulty);
  if (!campaign || !level) throw new Error(`Scénario de campagne inconnu : ${scenarioId}`);
  const mods = effectiveMods(data, campaign.id, parsed.difficulty);
  const scenario = campaignScenario(src, campaign, scenarioId, mods);
  const events = new Map((src.events ?? []).map((e) => [e.id, e]));
  for (const raw of campaign.events) {
    const res = EventDefSchema.safeParse(raw);
    if (!res.success) throw new Error(`campagne ${campaign.id} : événement invalide ${String(raw["id"])} : ${res.error.issues.map((i) => `${jsonPath(i.path)} ${i.message}`).join(" ; ")}`);
    events.set(res.data.id, res.data as EventDef);
  }
  const armies = (src.armies ?? []).flatMap((a) => {
    if ((a.type !== "army" && a.type !== "fleet") || a.scenario !== campaign.base) return [a];
    const copy = structuredClone({ ...a, scenario: scenarioId });
    if (copy.type === "army" && copy.faction !== "fac_paradis") for (const r of copy.regiments) r.count = Math.max(1, Math.round(r.count * mods.enemy_forces_mult));
    return [a, copy];
  });
  const missions = (src.missions ?? []).map((m) => (m.scenarios.includes(campaign.base) ? { ...m, scenarios: [...m.scenarios, scenarioId] } : m));
  let out: WorldSource = { ...src, scenarios: [...src.scenarios, scenario], events: [...events.values()], armies, missions };
  out = applyBalancePatch(out, data.difficulty?.tuning.balance ?? {}, `réglages (campagne ${campaign.id})`);
  out = applyBalancePatch(out, level.balance, `difficulté ${level.id}`);
  return out;
}

/** Tous les scénarios de campagne (campagne × difficulté). */
export function allCampaignScenarioIds(data: Pick<CampaignData, "campaigns">): string[] {
  return data.campaigns.flatMap((c) => DIFFICULTY_IDS.map((d) => campaignScenarioId(c.id, d)));
}
