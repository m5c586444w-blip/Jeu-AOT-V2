import { describe, expect, it } from "vitest";
import { createBattle, stepBattle } from "../../../src/sim/tactical/battle";
import { companySetup } from "../../../src/sim/tactical/setup";
import type { BattleSetup, BattleState } from "../../../src/sim/tactical/types";
import type { World } from "../../../src/sim/strategic/world";
import { CUT_SHOWN_S, FigureDirector, SOLDIER_POSE, TICK_S, TITAN_ATTACK_SHOWN_S, TITAN_FALL_S, TITAN_POSE, TROOP_FIRE_SHOWN_S, TROOP_POSE } from "../../../src/render/tactical3d/battle/figureState";
import { R3_SOLDIER_POSES, R3_TITAN_POSES } from "../../../src/render/tactical3d/humanAnim";
import { LEGACY_CASES, w854 } from "../../sim/legacy-cases";

/**
 * CR3-07 : l'état montré par chaque figure correspond à l'état de la simulation, à chaque pas, sur trois batailles (expédition en
 * ville avec ordres, bataille de compagnie avec fantassins, artillerie et Titans, porteur ennemi et lances). Le test garde son
 * propre historique (coups qui partent, morts des Titans) et compare au directeur. La simulation n'est jamais modifiée : son
 * empreinte est la même avec et sans le directeur.
 */
const company = (): BattleSetup =>
  companySetup(w854, {
    map: "tmap_ville",
    seed: 4,
    soldiers: 60,
    allied: [{ kind: "fusilier", count: 40 }],
    enemy: [{ kind: "fusilier", count: 60 }, { kind: "assaut", count: 20 }],
    titans: [{ type: "ttype_grand_errant", count: 2 }, { type: "ttype_moyen_errant", count: 2 }],
    artillery: [{ id: "bat_e", piece: "art_marley_campagne", munition: "mun_shrapnel", side: "ennemi", count: 2 }],
  });

const legacy = (id: string): { world: World; setup: BattleSetup; orders: (typeof LEGACY_CASES)[number]["orders"] } => {
  const c = LEGACY_CASES.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c;
};

const BATTLES: { id: string; world: World; setup: BattleSetup; orders: (typeof LEGACY_CASES)[number]["orders"]; ticks: number }[] = [
  { ...legacy("ville-ordres"), id: "expédition en ville", ticks: 1600 },
  { id: "compagnie", world: w854, setup: company(), orders: [], ticks: 1200 },
  { ...legacy("porteur-ennemi-lances"), id: "porteur ennemi", ticks: 1400 },
];

function snapshot(st: BattleState): string {
  return JSON.stringify([st.tick, st.soldiers.map((s) => [s.x, s.y, s.z, s.mode]), st.titans.map((t) => [t.x, t.y, t.alive]), (st.troops ?? []).map((t) => [t.x, t.y, t.mode])]);
}

describe("états montrés = états de la simulation (R3.3, CR3-07)", () => {
  for (const b of BATTLES) {
    it(`${b.id} : à chaque pas, pour chaque soldat, fantassin et Titan`, () => {
      const bt = createBattle(b.world, b.setup);
      const ref = createBattle(b.world, b.setup);
      const dir = new FigureDirector();
      const counts = new Map<string, number>();
      const add = (k: string): void => void counts.set(k, (counts.get(k) ?? 0) + 1);
      // Historique propre au test.
      const prevCut = new Map<number, number>();
      const cutAt = new Map<number, number>();
      const prevCd = new Map<number, number>();
      const attackAt = new Map<number, number>();
      const deathAt = new Map<number, number>();
      let checked = 0;
      for (let k = 0; k < b.ticks && !bt.state.ended; k++) {
        const orders = b.orders.filter((o) => o.tick === bt.state.tick);
        stepBattle(bt, orders);
        stepBattle(ref, orders);
        const st = bt.state;
        dir.update(st);
        dir.update(st); // idempotent pour un même pas
        st.soldiers.forEach((s, i) => {
          if (s.cutCooldown > (prevCut.get(i) ?? Infinity) + 1e-9) cutAt.set(i, st.tick);
          prevCut.set(i, s.cutCooldown);
          const shown = dir.soldier(i).state;
          add(`soldat:${shown}`);
          checked++;
          if (s.mode === "fui") expect(shown).toBe("absent");
          else if (s.mode === "mort") expect(shown).toBe("mort");
          else if (s.mode === "saisi") expect(shown).toBe("saisi");
          else if ((st.tick - (cutAt.get(i) ?? -Infinity)) * TICK_S < CUT_SHOWN_S) expect(shown, `tick ${st.tick} soldat ${i}`).toBe("attaque");
          else if (s.mode === "vol") expect(shown).toBe(s.vz < -4 ? "chute" : "vol");
          else if (s.mode === "crochet") expect(shown).toBe("vol");
          else if (s.mode === "rail") expect(["accroche", "vol"]).toContain(shown);
          else expect(["garde", "marche", "course"]).toContain(shown);
        });
        for (const t of st.troops ?? []) {
          const shown = dir.troop(t.id).state;
          add(`fantassin:${shown}`);
          checked++;
          if (t.mode === "fui") expect(shown).toBe("absent");
          else if (t.mode === "mort") expect(shown).toBe("mort");
          else if (t.shot >= 0 && (st.tick - t.shot) * TICK_S < TROOP_FIRE_SHOWN_S) expect(shown).toBe("tir");
          else expect(["attente", "marche", "course"]).toContain(shown);
        }
        for (const t of st.titans) {
          if (t.attackCooldown > (prevCd.get(t.id) ?? Infinity) + 1e-9) attackAt.set(t.id, st.tick);
          prevCd.set(t.id, t.attackCooldown);
          if (!t.alive && !deathAt.has(t.id)) deathAt.set(t.id, st.tick);
          if (t.alive) deathAt.delete(t.id);
          const sh = dir.titan(t.id);
          add(`titan:${sh.state}`);
          checked++;
          if (!t.alive) {
            const since = (st.tick - (deathAt.get(t.id) as number)) * TICK_S;
            expect(sh.state, `tick ${st.tick} Titan ${t.id}`).toBe(since < TITAN_FALL_S ? "chute" : "mort");
            if (sh.state === "chute") expect(sh.since).toBeCloseTo(since, 6);
          } else if (t.grabbing !== null) expect(sh.state).toBe("saisie");
          else if ((st.tick - (attackAt.get(t.id) ?? -Infinity)) * TICK_S < TITAN_ATTACK_SHOWN_S) expect(sh.state).toBe("attaque");
          else if (t.legs > 0) expect(sh.state).toBe("rampe");
          else expect(["debout", "marche", "course"]).toContain(sh.state);
        }
      }
      // Lecture seule : la bataille lue par le directeur reste identique à la bataille témoin.
      expect(snapshot(bt.state)).toBe(snapshot(ref.state));
      console.log(`${b.id} : ${bt.state.tick} pas, ${checked} états vérifiés ; ${[...counts].sort().map(([k, n]) => `${k} ${n}`).join(", ")}`);
      expect(checked).toBeGreaterThan(1000);
    });
  }

  it("couverture : sur les trois batailles, on voit marche, course, chute, mort et attaque", () => {
    const seen = new Set<string>();
    for (const b of BATTLES) {
      const bt = createBattle(b.world, b.setup);
      const dir = new FigureDirector();
      for (let k = 0; k < b.ticks && !bt.state.ended; k++) {
        stepBattle(bt, b.orders.filter((o) => o.tick === bt.state.tick));
        dir.update(bt.state);
        bt.state.soldiers.forEach((_, i) => seen.add(`soldat:${dir.soldier(i).state}`));
        for (const t of bt.state.troops ?? []) seen.add(`fantassin:${dir.troop(t.id).state}`);
        for (const t of bt.state.titans) seen.add(`titan:${dir.titan(t.id).state}`);
      }
    }
    for (const k of ["soldat:marche", "soldat:chute", "soldat:mort", "soldat:attaque", "fantassin:marche", "fantassin:tir", "fantassin:mort", "titan:marche", "titan:attaque", "titan:chute", "titan:mort"]) expect(seen, k).toContain(k);
    console.log(`états vus : ${[...seen].sort().join(", ")}`);
  });

  it("chaque état montré a une pose du corps de base", () => {
    for (const p of Object.values(SOLDIER_POSE)) if (p !== null) expect([...R3_SOLDIER_POSES, "sol", "vol", "accroche"]).toContain(p);
    for (const p of Object.values(TROOP_POSE)) if (p !== null) expect(R3_SOLDIER_POSES).toContain(p);
    for (const p of Object.values(TITAN_POSE)) expect([...R3_TITAN_POSES, "saisie", "allonge"]).toContain(p);
  });
});
