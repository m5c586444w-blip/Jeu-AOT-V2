import { describe, expect, it } from "vitest";
import { placeLabels } from "../../src/render/worldAtlas";
import type { LabelRequest } from "../../src/render/worldAtlas";

const overlap = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("atlas du monde : toponymes sans chevauchement (R0.2d)", () => {
  it("des provinces serrées : aucun nom n'en chevauche un autre ; la province choisie est toujours nommée", () => {
    // Grappe dense comparable au cœur de Marley : 12 provinces à 18 px les unes des autres, noms longs.
    const reqs: LabelRequest[] = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, cx: 200 + (i % 4) * 18, cy: 150 + Math.floor(i / 4) * 18, r: 12, w: 90 + (i % 3) * 20, h: 11, priority: i === 7 ? 3 : 2 }));
    const placed = placeLabels(reqs, 600, 400);
    const boxes = [...placed.values()].map((p) => p.box);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i] as never, boxes[j] as never), `${i}/${j}`).toBe(false);
    expect(placed.has("p7")).toBe(true);
    expect(placed.size).toBeGreaterThanOrEqual(6);
    for (const b of boxes) expect(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 600 && b.y1 <= 400).toBe(true);
  });

  it("déterministe : même entrée, même placement", () => {
    const reqs: LabelRequest[] = [
      { id: "a", cx: 50, cy: 50, r: 10, w: 40, h: 10, priority: 2 },
      { id: "b", cx: 60, cy: 52, r: 10, w: 40, h: 10, priority: 1 },
    ];
    expect([...placeLabels(reqs, 200, 200)]).toEqual([...placeLabels(reqs, 200, 200)]);
  });
});
