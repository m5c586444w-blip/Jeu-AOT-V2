import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkAssets, classifySource, webpSize } from "../../src/tools/assetsCheck";
import type { ManifestEntry } from "../../src/tools/assetsCheck";

/**
 * `npm run assets:check` (R1c, CR1c-03) : le dépôt passe ; chaque cas d'échec de la consigne échoue, sur des fixtures
 * (fichier sans entrée, licence refusée, CC-BY sans attribution, source écartée, source interdite, empreinte fausse).
 */
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const sha = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");
const PH_URL = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/roof_slates_02/roof_slates_02_diff_1k.jpg";
/** En-tête WebP sans perte (VP8L) d'une image w × h : assez pour lire ses dimensions. */
function webp(w: number, h: number): Buffer {
  const b = Buffer.alloc(30);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(22, 4);
  b.write("WEBPVP8L", 8, "ascii");
  b.writeUInt32LE(10, 16);
  b[20] = 0x2f;
  b.writeUInt32LE(((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14), 21);
  return b;
}
const MH_URL = "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj";

function fixture(entries: Partial<ManifestEntry>[], files: Record<string, string | Buffer>, attributions = ""): { root: string; md: string } {
  const root = mkdtempSync(join(tmpdir(), "assets-"));
  dirs.push(root);
  for (const [f, content] of Object.entries(files)) {
    mkdirSync(join(root, f, ".."), { recursive: true });
    writeFileSync(join(root, f), content);
  }
  const fichiers = entries.map((e) => ({ nom: "Corps", url: MH_URL, licence: "CC0-1.0", date: "2026-10-06", auteur: "MakeHuman Team", sha256: sha(files[e.fichier ?? ""] ?? ""), usage: "corps_de_base", ...e }));
  writeFileSync(join(root, "manifest.json"), JSON.stringify({ version: 1, fichiers }));
  const md = join(root, "..", `${root.split("/").pop()}-LICENSES.md`);
  writeFileSync(md, attributions || entries.map((e) => `| \`${e.fichier}\` | ${e.nom ?? "Corps"} | ${e.auteur ?? "MakeHuman Team"} |`).join("\n"));
  dirs.push(md);
  return { root, md };
}

describe("assets:check (R1c)", () => {
  it("le dépôt passe : chaque fichier de docs/art/assets/ a son entrée, sa licence, sa source retenue et son empreinte", () => {
    const r = checkAssets("docs/art/assets", "docs/ASSETS_LICENSES.md");
    expect(r.errors).toEqual([]);
    expect(r.entries).toBeGreaterThan(50);
    expect(r.files).toBe(r.entries);
  });

  it("un cas valide minimal passe", () => {
    const f = fixture([{ fichier: "a/corps.obj" }], { "a/corps.obj": "v 0 0 0" });
    expect(checkAssets(f.root, f.md).errors).toEqual([]);
  });

  it("fichier sans entrée, entrée sans fichier : échec", () => {
    const f = fixture([{ fichier: "a.obj" }], { "a.obj": "x", "orphelin.glb": "y" });
    expect(checkAssets(f.root, f.md).errors.join("\n")).toMatch(/orphelin\.glb : fichier sans entrée/);
    const g = fixture([{ fichier: "absent.obj", sha256: sha("") }], {});
    expect(checkAssets(g.root, g.md).errors.join("\n")).toMatch(/absent\.obj : entrée sans fichier/);
  });

  it("licence autre que CC0 ou CC-BY : échec ; CC-BY sans attribution : échec ; CC-BY attribuée : passe", () => {
    const nc = fixture([{ fichier: "a.obj", licence: "CC-BY-NC-4.0" }], { "a.obj": "x" });
    expect(checkAssets(nc.root, nc.md).errors.join("\n")).toMatch(/licence « CC-BY-NC-4.0 » refusée/);
    const by = fixture([{ fichier: "a.obj", licence: "CC-BY-4.0", nom: "Rocher", auteur: "Jeanne" }], { "a.obj": "x" }, "| `a.obj` | sans le nom ni l'auteur |");
    expect(checkAssets(by.root, by.md).errors.join("\n")).toMatch(/sans attribution/);
    const ok = fixture([{ fichier: "a.obj", licence: "CC-BY-4.0", nom: "Rocher", auteur: "Jeanne" }], { "a.obj": "x" }, "| `a.obj` | Rocher | Jeanne |");
    expect(checkAssets(ok.root, ok.md).errors).toEqual([]);
  });

  it("source écartée (non réaliste), source interdite (œuvre ou fan), source inconnue : échec", () => {
    for (const [url, re] of [
      ["https://kenney.nl/assets/mini-characters", /source écartée \(Kenney/],
      ["https://quaternius.com/packs/ultimatemonsters.html", /source écartée \(Quaternius/],
      ["https://poly.pizza/m/abc", /source écartée \(Poly Pizza/],
      ["https://kaylousberg.itch.io/kaykit-adventurers", /source écartée \(KayKit/],
      ["https://sketchfab.com/3d-models/titan-123", /source interdite/],
      ["https://www.deviantart.com/fan/art/levi-mmd", /source interdite/],
      ["https://polyhaven.com/a/attack-on-titan-wall", /source interdite/],
      ["https://example.com/human.glb", /hors des sources retenues/],
    ] as const) {
      const f = fixture([{ fichier: "a.glb", url }], { "a.glb": "x" });
      expect(checkAssets(f.root, f.md).errors.join("\n"), url).toMatch(re);
    }
    expect(classifySource("https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sky_1k.hdr")).toEqual({ kind: "retenue", source: "Poly Haven" });
    expect(classifySource("https://github.com/someone/makehuman-fork/base.obj").kind).toBe("inconnue");
    expect(classifySource("https://example.com/x.glb", "Levi AOT model").kind).toBe("interdite");
  });

  it("empreinte fausse : échec ; dérivé sans source ou d'une source absente : échec", () => {
    const f = fixture([{ fichier: "a.obj", sha256: sha("autre") }], { "a.obj": "x" });
    expect(checkAssets(f.root, f.md).errors.join("\n")).toMatch(/empreinte sha256 différente/);
    const d = fixture([{ fichier: "b.glb", usage: "derive", derive_de: ["inexistant.obj"] }], { "b.glb": "y" });
    expect(checkAssets(d.root, d.md).errors.join("\n")).toMatch(/source « inexistant\.obj » absente/);
  });
});

describe("assets:check, textures Poly Haven (R1d)", () => {
  const tex = (n: number, e: Partial<ManifestEntry> = {}, content = webp(1024, 1024)): { entries: Partial<ManifestEntry>[]; files: Record<string, Buffer> } => {
    const files: Record<string, Buffer> = {};
    const entries: Partial<ManifestEntry>[] = [];
    for (let i = 0; i < n; i++) {
      const f = `polyhaven/t${i}.webp`;
      files[f] = content;
      entries.push({ fichier: f, nom: `Texture ${i}`, url: PH_URL, auteur: "Rob Tuytel (Poly Haven)", usage: "texture_environnement", ...e });
    }
    return { entries, files };
  };

  it("dimensions lues dans l'en-tête WebP ; un autre format n'est pas un WebP", () => {
    expect(webpSize(webp(1024, 1024))).toEqual({ width: 1024, height: 1024 });
    expect(webpSize(webp(2048, 512))).toEqual({ width: 2048, height: 512 });
    expect(webpSize(Buffer.from("\xff\xd8\xff\xe0 pas un webp, un jpeg".padEnd(40)))).toBeNull();
  });

  it("12 textures d'environnement WebP 1K de Poly Haven : passe", () => {
    const t = tex(12);
    const f = fixture(t.entries, t.files);
    expect(checkAssets(f.root, f.md).errors).toEqual([]);
  });

  it("plus de 12 textures, autre taille, autre format : échec", () => {
    const many = tex(13);
    const fm = fixture(many.entries, many.files);
    expect(checkAssets(fm.root, fm.md).errors.join("\n")).toMatch(/13 textures d'environnement \(au plus 12\)/);
    const big = tex(1, {}, webp(2048, 2048));
    const fb = fixture(big.entries, big.files);
    expect(checkAssets(fb.root, fb.md).errors.join("\n")).toMatch(/2048 × 2048 \(1024 × 1024 attendu\)/);
    const jpg = fixture([{ fichier: "polyhaven/t.jpg", url: PH_URL, usage: "texture_environnement" }], { "polyhaven/t.jpg": Buffer.from("\xff\xd8\xff jpeg".padEnd(40)) });
    expect(checkAssets(jpg.root, jpg.md).errors.join("\n")).toMatch(/autre que WebP/);
  });

  it("Poly Haven pour autre chose qu'une texture d'environnement, texture d'environnement hors de Poly Haven : échec", () => {
    const hdri = fixture([{ fichier: "ciel.hdr", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sky_1k.hdr", usage: "corps_de_base" }], { "ciel.hdr": "x" });
    expect(checkAssets(hdri.root, hdri.md).errors.join("\n")).toMatch(/Poly Haven n'est autorisé que pour les textures d'environnement/);
    const mh = fixture([{ fichier: "peau.webp", url: MH_URL, usage: "texture_environnement" }], { "peau.webp": webp(1024, 1024) });
    expect(checkAssets(mh.root, mh.md).errors.join("\n")).toMatch(/texture d'environnement hors de Poly Haven/);
  });
});
