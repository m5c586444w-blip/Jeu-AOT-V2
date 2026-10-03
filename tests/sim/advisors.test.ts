import { describe, expect, it } from "vitest";
import { adviceFor } from "../../src/sim/politics/advisors";
import { pol, run, start, strat, world850 } from "./politics-helpers";

describe("conseillers (AC2-08, F-ADV-01, F-ADV-02)", () => {
  it("18 rôles ; un avis affiche une estimation biaisée (prudent : pessimiste ; ambitieux : optimiste)", () => {
    const s = start();
    expect(world850.politics?.roles).toHaveLength(18);
    const intendant = adviceFor(world850, pol(s), strat(s), s.date, "role_intendant");
    expect(intendant?.bias).toBe("exagere");
    expect(intendant?.shown).toBeLessThan(intendant?.real ?? 0);
    const tresorier = adviceFor(world850, pol(s), strat(s), s.date, "role_tresorier");
    expect(tresorier?.bias).toBe("gonfle");
    expect(tresorier?.shown).toBeGreaterThan(tresorier?.real ?? Infinity);
    expect(tresorier?.estimatedReliability).not.toBe(Math.round(tresorier?.reliability ?? 0));
    const diplomate = adviceFor(world850, pol(s), strat(s), s.date, "role_diplomate");
    expect(diplomate?.advisor).toBeNull();
  });
  it("propositions mensuelles « à signer », qui expirent", () => {
    const s = run(start(), { type: "AdvanceDays", n: 31 });
    const props = pol(s).proposals;
    expect(props.length).toBeGreaterThan(0);
    const proposalDays = world850.politics?.balance.advisors.proposal_days ?? 30;
    const later = run(s, { type: "AdvanceDays", n: proposalDays });
    expect(pol(later).proposals.some((p) => p.id === props[0]?.id)).toBe(false);
  });
  it("signer : le décret est pris ; refuser trois fois : démission", () => {
    let s = run(start(), { type: "AdvanceDays", n: 31 });
    const first = pol(s).proposals[0];
    if (!first) throw new Error();
    const signed = run(s, { type: "AcceptProposal", proposal: first.id });
    expect(pol(signed).laws.map((l) => l.id)).toContain(first.law);
    const advisor = first.advisor;
    for (let i = 0; i < 3; i++) {
      const prop = pol(s).proposals.find((p) => p.advisor === advisor);
      if (!prop) {
        s = run(s, { type: "AdvanceDays", n: 30 });
        i--;
        continue;
      }
      s = run(s, { type: "RejectProposal", proposal: prop.id });
    }
    expect(Object.values(pol(s).roles)).not.toContain(advisor);
    expect(strat(s).log.some((l) => l.key === "alert.resigned")).toBe(true);
  });
});
