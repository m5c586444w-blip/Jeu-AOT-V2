import { describe, expect, it } from "vitest";
import { groupFeed } from "../../src/ui/notifications";
import type { FeedEntry } from "../../src/ui/notifications";

// U9 : fil regroupé et trié — un groupe par jour (le plus récent d'abord), les alertes graves en tête de leur jour,
// les textes identiques fusionnés avec leur nombre.
const e = (day: number, seq: number, text: string, grave = false, place: string | null = null): FeedEntry => ({ day, seq, key: "log.x", text, grave, place });

describe("fil de notifications (U9)", () => {
  it("groupes par jour, du plus récent au plus ancien", () => {
    const g = groupFeed([e(10, 1, "a"), e(12, 2, "b"), e(11, 3, "c")]);
    expect(g.map((x) => x.day)).toEqual([12, 11, 10]);
  });

  it("dans un jour : graves d'abord, puis les plus récentes ; doublons fusionnés", () => {
    const g = groupFeed([e(5, 1, "convoi"), e(5, 2, "rupture", true), e(5, 3, "convoi"), e(5, 4, "décret")]);
    const items = g[0]?.items ?? [];
    expect(items.map((i) => i.text)).toEqual(["rupture", "décret", "convoi"]);
    expect(items.find((i) => i.text === "convoi")?.count).toBe(2);
  });

  it("nombre de groupes borné ; le lieu est conservé", () => {
    const g = groupFeed(Array.from({ length: 10 }, (_, i) => e(i, i, `t${i}`, false, i === 9 ? "prov_trost" : null)), 3);
    expect(g).toHaveLength(3);
    expect(g[0]?.items[0]?.place).toBe("prov_trost");
  });
});
