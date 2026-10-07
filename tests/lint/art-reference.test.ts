import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R1b.0 — La partie B du catalogue est enregistrée sans modification dans `docs/art/STYLES.md`, et les images de
 * `docs/art/reference/` ne servent qu'à l'ambiance : jamais citées par le code, jamais copiées dans `public/` ni `dist`.
 */
const PART_B_SHA256 = "c8fb8c17112a25245ec66a722d1d2fa5e892de658265baefd6009dc4fc1060d7";
const REF_DIR = "docs/art/reference";

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("catalogue des styles et images de référence (R1b.0)", () => {
  it("la partie B est recopiée sans modification (empreinte du texte entre les marqueurs)", () => {
    const md = readFileSync("docs/art/STYLES.md", "utf8");
    const m = /<!-- PARTIE B : début \(texte de l'utilisateur, non modifié\) -->\n([\s\S]*)\n<!-- PARTIE B : fin -->/.exec(md);
    expect(m, "marqueurs de la partie B").not.toBeNull();
    const body = m?.[1] ?? "";
    expect(body.startsWith("## B0. Corrections apportées à la grille de référence")).toBe(true);
    expect(createHash("sha256").update(body, "utf8").digest("hex")).toBe(PART_B_SHA256);
  });

  it("aucun fichier de src/, public/ ni index.html ne cite docs/art/reference", () => {
    // Seules exceptions : les outils Node de mesure (jamais empaquetés), qui lisent ce dossier pour vérifier que dist n'en contient rien.
    const tools = new Set(["mesure-r1b.ts", "mesure-r1c.ts", "mesure-r1d.ts"].map((f) => join("src", "tools", f)));
    const sources = [...files("src"), ...files("public"), "index.html", "vite.config.ts"].filter((p) => !tools.has(p));
    const offenders = sources.filter((p) => /art\/reference/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("aucune copie d'une image de référence dans public/ ni dans dist/ (comparaison par empreinte)", () => {
    const refs = new Set(files(REF_DIR).filter((p) => !p.endsWith("README.md")).map(sha));
    const shipped = [...files("public"), ...files("dist")];
    expect(shipped.filter((p) => refs.has(sha(p)))).toEqual([]);
    // Le dossier de référence n'est pas sous public/ : Vite ne le copie jamais tel quel.
    expect(REF_DIR.startsWith("public/")).toBe(false);
  });
});
