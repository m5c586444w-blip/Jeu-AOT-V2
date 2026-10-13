// P9.1/P9.3 : le menu principal reflète data/campagnes et data/balance/difficulty.json (sans les charger) ; la divergence
// avertie liste les successeurs canon d'un choix non historique.
import { describe, expect, it } from "vitest";
import { campaignDataFromFiles, campaignScenarioId } from "../../src/campaign/campaign";
import { readDataFiles } from "../../src/data/loadNode";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import { CAMPAIGNS, campaignScenario, DEFAULT_DIFFICULTY, DIFFICULTIES } from "../../src/ui/mainMenu";
import { divergenceNotice } from "../../src/ui/divergence";

const camp = campaignDataFromFiles(readDataFiles("data"));

describe("menu des campagnes", () => {
  it("liste des campagnes identique aux données", () => {
    expect(CAMPAIGNS.map((c) => ({ id: c.id, year: c.year, emblem: c.emblem, nations: [...c.nations] }))).toEqual(camp.campaigns.map((c) => ({ id: c.id, year: c.year, emblem: c.emblem, nations: c.nations })));
  });
  it("difficultés et défaut identiques aux données ; même identifiant de scénario", () => {
    expect([...DIFFICULTIES]).toEqual(camp.difficulty?.levels.map((l) => l.id));
    expect(DEFAULT_DIFFICULTY).toBe(camp.difficulty?.default);
    for (const c of CAMPAIGNS) for (const d of DIFFICULTIES) expect(campaignScenario(c.id, d)).toBe(campaignScenarioId(c.id, d));
  });
});

describe("divergence avertie (12 §3)", () => {
  const world = loadWorld("data", "scn_camp_grondement__normal");
  const s = createInitialState(5, world);
  const e59 = world.chronicle?.events.get("evt_854_rumbling");
  it("un choix non historique liste la suite canon, les morts liées et l'écart", () => {
    if (!e59) throw new Error("E59 absent");
    const c = e59.choices.find((x) => !x.historical);
    if (!c) throw new Error("choix divergent absent");
    const n = divergenceNotice(world, s, e59, c);
    expect(n?.d).toBeGreaterThan(0);
    expect(n?.events).toContain("evt.854.heaven_earth_battle");
    expect(n?.people.some((p) => /Hange/.test(p))).toBe(true);
  });
  it("le choix historique ne demande rien", () => {
    const h = e59?.choices.find((x) => x.historical);
    expect(e59 && h ? divergenceNotice(world, s, e59, h) : "absent").toBeNull();
  });
});
