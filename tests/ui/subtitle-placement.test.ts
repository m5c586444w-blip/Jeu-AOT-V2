import { describe, expect, it } from "vitest";
import { cornerRect, placeSubtitles } from "../../src/ui/tactical/subtitlePlacement";
import type { Corner, Rect } from "../../src/ui/tactical/subtitlePlacement";

/** R0, item 2 : les sous-titres de bataille ne recouvrent ni pastille d'escouade ni flèche de bord, à 1366×768 et en 4K. */
const SCENES: Record<string, Rect> = {
  "1366×768": { x0: 0, y0: 43, x1: 1014, y1: 631 },
  "3840×2160": { x0: 0, y0: 43, x1: 3488, y1: 2047 },
};
const SIZE = { w: 300, h: 60 };
const box = (cx: number, cy: number, r = 13): Rect => ({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r });
const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("placement des sous-titres de bataille (R0, item 2)", () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    const tl = cornerRect(scene, SIZE.w, SIZE.h, "haut-gauche", 12);
    const tr = cornerRect(scene, SIZE.w, SIZE.h, "haut-droit", 12);
    const bl = cornerRect(scene, SIZE.w, SIZE.h, "bas-gauche", 12);
    const cases: [string, Rect[], Corner][] = [
      ["aucun marqueur : haut gauche", [], "haut-gauche"],
      ["pastilles au sud (ouverture d'une bataille) : haut gauche", [box(53, scene.y1 - 70), box(250, scene.y1 - 70)], "haut-gauche"],
      ["flèche de bord en haut à gauche : haut droit", [box(tl.x0 + 20, tl.y0 + 20, 9)], "haut-droit"],
      ["marqueurs dans les deux coins hauts : bas gauche", [box(tl.x0 + 20, tl.y0 + 20), box(tr.x1 - 20, tr.y0 + 20)], "bas-gauche"],
      ["trois coins occupés : bas droit", [box(tl.x0 + 20, tl.y0 + 20), box(tr.x1 - 20, tr.y0 + 20), box(bl.x0 + 20, bl.y1 - 20)], "bas-droit"],
    ];
    it.each(cases)(`${name} — %s`, (_c, markers, want) => {
      const p = placeSubtitles(scene, SIZE, markers);
      expect(p.corner).toBe(want);
      for (const m of markers) expect(overlaps(p.rect, m)).toBe(false);
      // Toujours dans la scène : jamais sur le bandeau de titre, le carnet ou les cartes d'escouade (hors de la scène).
      expect(p.rect.x0 >= scene.x0 && p.rect.x1 <= scene.x1 && p.rect.y0 >= scene.y0 && p.rect.y1 <= scene.y1).toBe(true);
    });
  }

  it("tous les coins occupés : le coin le moins recouvert", () => {
    const scene = SCENES["1366×768"] as Rect;
    const corners = (["haut-gauche", "haut-droit", "bas-gauche", "bas-droit"] as const).map((c) => cornerRect(scene, SIZE.w, SIZE.h, c, 12));
    const markers = corners.map((r, i) => box(r.x0 + 20, r.y0 + 20, i === 2 ? 4 : 14));
    expect(placeSubtitles(scene, SIZE, markers).corner).toBe("bas-gauche");
  });
});
