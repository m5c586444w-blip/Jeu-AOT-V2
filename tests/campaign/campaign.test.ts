// P9 (CP9-04) : campagnes 845, 850, 854 et Grondement — chargement des 16 scénarios dérivés, base intacte, difficultés
// ordonnées, parties jouées jusqu'à leur fin par le joueur type, règles de fin, fenêtres de présence, déterminisme.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allCampaignScenarioIds, campaignDataFromFiles, campaignScenarioId, effectiveMods, findCampaign, parseCampaignScenarioId, sourceForScenario } from "../../src/campaign/campaign";
import { checkCampaigns } from "../../src/campaign/canon";
import type { RawCampaign } from "../../src/campaign/canon";
import { conditionHolds, evaluateOutcome, newTracker, observe, outcomeFor } from "../../src/campaign/outcome";
import { DIFFICULTY_IDS } from "../../src/data/campaignSchema";
import type { Campaign } from "../../src/data/campaignSchema";
import { loadRawDir } from "../../src/data/loadRaw";
import { readDataFiles } from "../../src/data/loadNode";
import { worldSourceFromFiles } from "../../src/data/worldSource";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import { buildWorld } from "../../src/sim/strategic/world";
import { playGame } from "../../src/tools/balance/game";
import fr from "../../src/i18n/fr.json";

const files = readDataFiles("data");
const camp = campaignDataFromFiles(files);
const source = worldSourceFromFiles(files).source;
if (!source) throw new Error("données invalides");
const campaign = (id: string): Campaign => {
  const c = findCampaign(camp, id);
  if (!c) throw new Error(id);
  return c;
};
const keys = fr as Record<string, string>;

describe("P9.1/P9.3 — données des campagnes", () => {
  it("quatre campagnes, quatre difficultés, aucune anomalie", () => {
    expect(camp.issues).toEqual([]);
    expect(camp.campaigns.map((c) => c.id)).toEqual(["c845", "c850", "c854", "cgrondement"]);
    expect(camp.difficulty?.levels.map((l) => l.id)).toEqual([...DIFFICULTY_IDS]);
    expect(camp.difficulty?.default).toBe("normal");
  });

  it("chaque clé de texte des campagnes et des difficultés existe en français", () => {
    const missing: string[] = [];
    for (const c of camp.campaigns) {
      for (const k of [c.name_key, c.summary_key, ...c.end.rules.map((r) => r.text_key), c.end.deadline.win.text_key, c.end.deadline.lose.text_key]) if (!keys[k]) missing.push(k);
    }
    for (const l of camp.difficulty?.levels ?? []) for (const k of [l.name_key, l.desc_key]) if (!keys[k]) missing.push(k);
    expect(missing).toEqual([]);
  });

  it("identifiants de scénario dérivés : aller-retour", () => {
    expect(campaignScenarioId("cgrondement", "breche")).toBe("scn_camp_grondement__breche");
    expect(parseCampaignScenarioId("scn_camp_845__recit")).toEqual({ campaign: "c845", difficulty: "recit" });
    expect(parseCampaignScenarioId("scn_854")).toBeNull();
    expect(parseCampaignScenarioId("scn_camp_845__facile")).toBeNull();
  });

  it("les 16 scénarios (campagne × difficulté) se chargent en monde", () => {
    const ids = allCampaignScenarioIds(camp);
    expect(ids).toHaveLength(16);
    for (const id of ids) {
      const w = buildWorld(sourceForScenario(source, camp, id), id);
      expect(w.scenario.id).toBe(id);
      expect(createInitialState(1, w).strategic).not.toBeNull();
    }
  });

  it("un scénario de base est rendu tel quel (empreintes de sim:selftest inchangées)", () => {
    for (const id of ["scn_sandbox_845", "scn_sandbox_850", "scn_854"]) expect(sourceForScenario(source, camp, id)).toBe(source);
  });

  it("difficultés ordonnées : vivres de départ et densité de Titans", () => {
    const food = DIFFICULTY_IDS.map((d) => createInitialState(1, loadWorld("data", campaignScenarioId("c845", d))).strategic?.stocks.food ?? 0);
    expect(food[0]).toBeGreaterThan(food[1] ?? 0);
    expect(food[1]).toBeGreaterThan(food[2] ?? 0);
    expect(food[2]).toBeGreaterThan(food[3] ?? 0);
    const titans = DIFFICULTY_IDS.map((d) => effectiveMods(camp, "c850", d).titan_density_mult);
    expect([...titans].sort((a, b) => a - b)).toEqual(titans);
    const threshold = DIFFICULTY_IDS.map((d) => effectiveMods(camp, "c854", d).score_threshold_delta);
    expect([...threshold].sort((a, b) => a - b)).toEqual(threshold);
  });
});

describe("P9.1 — parties jouées jusqu'à leur fin (Normal, joueur type)", () => {
  for (const c of ["c845", "c850", "c854", "cgrondement"]) {
    it(`${c} : une fin atteinte avant l'échéance + un pas`, () => {
      const id = campaignScenarioId(c, "normal");
      const world = loadWorld("data", id);
      const cp = campaign(c);
      const r = playGame(world, cp, effectiveMods(camp, c, "normal"), 7, "historique");
      expect(r.outcome.days).toBeLessThanOrEqual(cp.end.max_days + 3);
      expect(cp.end.factions).toContain(r.outcome.winner ?? cp.end.factions[0]);
      expect(["victoire", "defaite", "paix"]).toContain(outcomeFor(r.outcome, "fac_paradis"));
    }, 120000);
  }

  it("déterminisme : même graine et mêmes commandes, même empreinte (rejeu direct)", () => {
    const id = campaignScenarioId("c845", "normal");
    const world = loadWorld("data", id);
    const mods = effectiveMods(camp, "c845", "normal");
    const a = playGame(world, campaign("c845"), mods, 11, undefined, true);
    const b = playGame(world, campaign("c845"), mods, 11, undefined, true);
    expect(b.hash).toBe(a.hash);
    let s = createInitialState(11, world);
    for (const cmd of a.commands) s = applyCommand(s, cmd, undefined, world);
    expect(stateHash(s)).toBe(a.hash);
  }, 60000);
});

describe("P9.1 — règles de fin (hors simulation, D-155)", () => {
  it("famine : 45 jours sans vivres font perdre la campagne 845", () => {
    const world = loadWorld("data", campaignScenarioId("c845", "normal"));
    const s0 = createInitialState(3, world);
    const t = newTracker(s0);
    const st = s0.strategic;
    if (!st) throw new Error("état stratégique absent");
    const s = { ...s0, strategic: { ...st, stocks: { ...st.stocks, food: 0 } }, date: { ...s0.date, day: s0.date.day + 45 } };
    observe(t, s);
    const o = evaluateOutcome(world, campaign("c845"), { score_threshold_delta: 0 }, s, t);
    expect(o?.rule).toBe("famine");
    expect(o && outcomeFor(o, "fac_paradis")).toBe("defaite");
  });

  it("854 : l'île aux mains de Marley est une défaite de Paradis", () => {
    const world = loadWorld("data", campaignScenarioId("c854", "normal"));
    const s0 = createInitialState(3, world);
    const t = newTracker(s0);
    expect(evaluateOutcome(world, campaign("c854"), { score_threshold_delta: 0 }, s0, t)).toBeNull();
    const ns = s0.nations;
    if (!ns) throw new Error("monde des nations absent");
    const s = { ...s0, nations: { ...ns, control: { ...ns.control, wprov_paradis: "fac_marley" } } };
    expect(conditionHolds(world, s, t, { world_control: "wprov_paradis", by: ["fac_marley"] })).toBe(true);
    const o = evaluateOutcome(world, campaign("c854"), { score_threshold_delta: 0 }, s, t);
    expect(o?.winner).toBe("fac_marley");
    expect(o && outcomeFor(o, "fac_marley")).toBe("victoire");
  });

  it("à l'échéance, le score décide et la difficulté relève le seuil", () => {
    const world = loadWorld("data", campaignScenarioId("c850", "normal"));
    const s0 = createInitialState(3, world);
    const t = newTracker(s0);
    const cp = campaign("c850");
    const late = { ...s0, date: { ...s0.date, year: s0.date.year + 3 } };
    const easy = evaluateOutcome(world, cp, { score_threshold_delta: -1 }, late, t);
    const hard = evaluateOutcome(world, cp, { score_threshold_delta: 1 }, late, t);
    expect(easy?.rule).toBe(cp.end.deadline.win.id);
    expect(hard?.rule).toBe(cp.end.deadline.lose.id);
  });
});

describe("P9.1 — canon:check des campagnes (fenêtres de présence, 11 §3)", () => {
  const { raw } = loadRawDir("data");
  const list: RawCampaign[] = [];
  const dir = join("data", "campagnes");
  if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) for (const c of JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>[]) list.push({ file: join(dir, f), v: c });

  it("les campagnes livrées sont conformes", () => {
    expect(list).toHaveLength(4);
    expect(checkCampaigns(raw, list)).toEqual([]);
  });

  it("un joueur hors de sa fenêtre de présence est signalé", () => {
    const bad = structuredClone(list.find((c) => c.v["id"] === "cgrondement"));
    if (!bad) throw new Error("cgrondement");
    const sc = bad.v["scenario"] as { politics: { player: string } };
    sc.politics.player = "char_dot_pixis";
    const v = checkCampaigns(raw, [bad]);
    expect(v.some((x) => x.rule === "R12" && x.message.includes("char_dot_pixis"))).toBe(true);
  });
});
