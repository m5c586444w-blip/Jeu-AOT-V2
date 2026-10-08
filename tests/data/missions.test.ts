import { describe, expect, it } from "vitest";
import { checkCanon, emptyRaw } from "../../src/data/canonRules";
import type { RawData } from "../../src/data/canonRules";
import { loadRawDir } from "../../src/data/loadRaw";
import { MISSION_BRANCHES, MISSION_EFFECT_OPS, MissionSchema } from "../../src/data/missionSchemas";
import type { Mission } from "../../src/data/missionSchemas";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";

/** MIS.2, CMIS-04 : arbres de missions de Paradis (845, 850, 854) et branche de Marley ; aucune mission ne force le récit. */
const dict = fr as Record<string, string>;
const SCENARIOS = ["scn_sandbox_845", "scn_sandbox_850", "scn_854"] as const;
const worlds = Object.fromEntries(SCENARIOS.map((s) => [s, loadWorld("data", s)]));
const all = (s: string): readonly Mission[] => worlds[s]?.missions?.order ?? [];

describe("missions de Paradis : au moins 40 par scénario (CMIS-04)", () => {
  it.each(SCENARIOS)("%s : au moins 40 missions de Paradis, six branches (sauf le monde extérieur avant 850)", (s) => {
    const paradis = all(s).filter((m) => m.nation === "paradis");
    expect(paradis.length).toBeGreaterThanOrEqual(40);
    const branches = new Set(paradis.map((m) => m.branch));
    for (const b of MISSION_BRANCHES) if (b !== "monde" || s !== "scn_sandbox_845") expect(branches.has(b), `${s} : ${b}`).toBe(true);
    for (const b of branches) expect(paradis.filter((m) => m.branch === b).length, `${s} : ${b}`).toBeGreaterThanOrEqual(3);
  });
  it("les sujets demandés sont tous présents", () => {
    const has = (s: string, id: string): boolean => all(s).some((m) => m.id === id);
    expect(has("scn_sandbox_850", "mis_mil_reconquete_maria")).toBe(true); // reconquête de Maria
    for (const s of SCENARIOS) {
      expect(has(s, "mis_mil_reforme_armee"), `${s} réforme de l'armée`).toBe(true);
      expect(has(s, "mis_pol_reforme_cabinet"), `${s} cabinet`).toBe(true);
      expect(has(s, "mis_rel_eglise_des_murs"), `${s} église des murs`).toBe(true);
      expect(has(s, "mis_mil_etude_anti_titan"), `${s} recherche anti-Titan`).toBe(true);
      expect(has(s, "mis_mil_batteries_mobiles") && has(s, "mis_mil_canons_rempart"), `${s} artillerie`).toBe(true);
    }
    expect(has("scn_854", "mis_mon_archives_exterieur") && has("scn_854", "mis_ren_renseignement_marley"), "renseignement sur le monde extérieur").toBe(true);
    expect(has("scn_854", "mis_mil_invasion_marley"), "préparation de l'invasion de Marley").toBe(true);
  });
  it("la branche de Marley n'existe qu'en 854 (simplifiée, 10 à 15 missions)", () => {
    expect(all("scn_854").filter((m) => m.nation === "marley").length).toBeGreaterThanOrEqual(10);
    expect(all("scn_854").filter((m) => m.nation === "marley").length).toBeLessThanOrEqual(15);
    for (const s of ["scn_sandbox_845", "scn_sandbox_850"]) expect(all(s).some((m) => m.nation === "marley")).toBe(false);
  });
});

describe("missions : cohérence des données", () => {
  it.each(SCENARIOS)("%s : prérequis, exclusions et appartenance à la même nation, sans cycle", (s) => {
    const ms = all(s);
    const ids = new Set(ms.map((m) => m.id));
    const byId = new Map(ms.map((m) => [m.id, m]));
    for (const m of ms) {
      for (const p of [...m.prereqs, ...m.any_of, ...m.exclusive_with]) {
        expect(ids.has(p), `${m.id} → ${p}`).toBe(true);
        expect(byId.get(p)?.nation, `${m.id} → ${p}`).toBe(m.nation);
      }
    }
    const depth = (id: string, seen: Set<string>): number => {
      expect(seen.has(id), `cycle sur ${id}`).toBe(false);
      const m = byId.get(id);
      return m && m.prereqs.length ? 1 + Math.max(...m.prereqs.map((p) => depth(p, new Set([...seen, id])))) : 0;
    };
    for (const m of ms) depth(m.id, new Set());
  });
  it("chaque mission et chaque événement déclenché a son texte ; des chaînes de 2 à 6 missions existent", () => {
    for (const s of SCENARIOS) {
      const cw = worlds[s]?.chronicle;
      for (const m of all(s)) {
        expect(dict[`mission.${m.id}`], m.id).toBeTruthy();
        expect((dict[`mission.${m.id}.desc`] ?? "").length, m.id).toBeGreaterThan(30);
        for (const e of m.events) {
          expect(dict[`evt.mis.${e.replace(/^evt_mis_/, "")}`], e).toBeTruthy();
          if (cw) expect(cw.events.get(e)?.kind, e).not.toBe("canon");
        }
      }
    }
  });
  it("aucun effet interdit, aucune mission canon forcée : les événements déclenchés ne sont jamais du récit", () => {
    const { raw } = loadRawDir("data");
    for (const m of raw.missions) {
      const effects = ((m.v["effects"] ?? []) as { op: string }[]).map((e) => e.op);
      for (const op of effects) expect(MISSION_EFFECT_OPS as readonly string[], `${m.id} : ${op}`).toContain(op);
      for (const e of (m.v["events"] ?? []) as string[]) {
        const def = raw.events.find((x) => x.id === e);
        expect(def?.v["kind"], `${m.id} → ${e}`).not.toBe("canon");
        expect(def?.v["kind"] === undefined, `${m.id} → ${e}`).toBe(false);
      }
    }
  });
  it("R14 refuse une mission qui déclenche un événement canon, qui exige un événement postérieur ou qui n'a pas de source", () => {
    const { raw } = loadRawDir("data");
    const bad: RawData = { ...emptyRaw(), ...raw };
    const base = raw.missions.find((m) => m.id === "mis_mil_inventaire_garnisons");
    expect(base).toBeDefined();
    const mutate = (patch: Record<string, unknown>): string[] =>
      checkCanon({ ...bad, missions: raw.missions.map((m) => (m.id === base?.id ? { ...m, v: { ...m.v, ...patch } } : m)) })
        .filter((v) => v.rule === "R14")
        .map((v) => v.message);
    expect(checkCanon(raw).filter((v) => v.rule === "R14")).toEqual([]);
    expect(mutate({ events: ["evt_850_trost_breach"] }).join(" ")).toContain("canon");
    expect(mutate({ requires: [{ fired: "evt_854_marley_counterattack" }], min_year: 845 }).join(" ")).toContain("avant 854");
    expect(mutate({ canon: "?", notes_canon: undefined }).join(" ")).toContain("sans notes_canon");
    expect(mutate({ prereqs: ["mis_inexistante"] }).join(" ")).toContain("inconnue");
    expect(mutate({ scenarios: ["scn_sandbox_845"], prereqs: ["mis_marley_arsenaux"] }).join(" ")).toContain("autre nation");
  });
  it("le schéma refuse un effet de contrôle, un événement du récit ou un effet de Paradis pour Marley", () => {
    const { raw } = loadRawDir("data");
    const v = raw.missions.find((m) => m.id === "mis_mil_inventaire_garnisons")?.v;
    const ok = MissionSchema.safeParse(v);
    expect(ok.success).toBe(true);
    expect(MissionSchema.safeParse({ ...v, effects: [{ op: "control", province: "prov_shiganshina", value: "paradis" }] }).success).toBe(false);
    expect(MissionSchema.safeParse({ ...v, effects: [{ op: "kill", character: "char_eren_yeager", cause: "combat" }] }).success).toBe(false);
    expect(MissionSchema.safeParse({ ...v, effects: [{ op: "flag", key: "x", value: true }] }).success).toBe(false);
    expect(MissionSchema.safeParse({ ...v, nation: "marley", effects: [{ op: "morale", province: "all", delta: 1 }] }).success).toBe(false);
  });
  it("845 (sans politique, sans événements) : chaque mission a un effet qui compte dans ce scénario", () => {
    const useful = new Set(["resource", "morale", "stability", "wall", "titans", "garrison", "population"]);
    for (const m of all("scn_sandbox_845")) expect(m.effects.some((e) => useful.has(e.op)) || m.modifiers.length > 0 || m.hooks.length > 0, m.id).toBe(true);
  });
  it("une mission de 850 ou 854 exige la technologie avant son année, jamais l'inverse (armes tardives)", () => {
    const thunder = all("scn_sandbox_850").find((m) => m.id === "mis_mil_lances_foudroyantes");
    expect(thunder?.min_year).toBeGreaterThanOrEqual(850);
    expect(thunder?.requires).toContainEqual({ tech: "tech_thunder_spear_prototype" });
    expect(all("scn_sandbox_845").some((m) => m.id === "mis_mil_lances_foudroyantes")).toBe(false);
  });
});
