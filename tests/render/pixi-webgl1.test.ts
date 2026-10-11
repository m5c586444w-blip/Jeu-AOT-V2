import { describe, expect, it } from "vitest";
import { guardContext } from "../../src/render/pixiCompat";

/** Dette n° 47 : en WebGL 1, un nom de paramètre de texture inconnu (constante de WebGL 2 absente) est ignoré. */
describe("garde WebGL 1 de Pixi", () => {
  it("ignore texParameteri / texParameterf sans nom de paramètre ; laisse passer les autres", () => {
    const calls: [number, number, number][] = [];
    const gl = {
      texParameteri: (t: number, p: number, v: number) => calls.push([t, p, v]),
      texParameterf: (t: number, p: number, v: number) => calls.push([t, p, v]),
    };
    expect(guardContext(gl)).toBe(true);
    const g = gl as unknown as { texParameteri: (t: number, p: number | undefined, v: number) => void; texParameterf: (t: number, p: number | undefined, v: number) => void };
    g.texParameteri(3553, undefined, 0);
    g.texParameteri(3553, 10241, 9729);
    g.texParameterf(3553, undefined, 1);
    expect(calls).toEqual([[3553, 10241, 9729]]);
    expect(guardContext(null)).toBe(false);
    expect(guardContext({})).toBe(false);
  });
});
