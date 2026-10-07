// npm run assets:fetch -- polyhaven [-- --verifier] — R1d : textures d'environnement de Poly Haven (CC0), décision de
// l'utilisateur (sol, pierre, toits ; 12 fichiers au plus, 1024 × 1024, WebP).
// - Pour chaque matière de POLYHAVEN_TEXTURES et chaque carte (couleur, relief) : URL et empreinte md5 du JPG 1K officiel lues
//   à l'API (api.polyhaven.com), JPG téléchargé de dl.polyhaven.org, empreinte vérifiée, puis converti en WebP par
//   l'encodeur de Chromium (qualité 0,9, sans conversion de couleur : les normales restent exactes).
// - Manifeste : usage « texture_environnement », URL et md5 du JPG source, licence CC0, auteur lu à l'API, servi au rendu.
// - --verifier : refait chaque conversion et la compare au fichier du dépôt (même empreinte attendue).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright-core";
import { ManifestSchema, writeAttributions } from "./assetsCheck";
import type { Manifest, ManifestEntry } from "./assetsCheck";
import { POLYHAVEN_MAPS, POLYHAVEN_TEXTURES, polyhavenFile } from "./assetsSources";

const ROOT = "docs/art/assets";
const verify = process.argv.includes("--verifier");
const manifestPath = join(ROOT, "manifest.json");
const today = new Date().toISOString().slice(0, 10);
const manifest: Manifest = ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
const byFile = new Map(manifest.fichiers.map((e) => [e.fichier, e] as const));
const curl = (url: string): Buffer => execFileSync("curl", ["-sSfL", "--max-time", "120", url], { maxBuffer: 64 * 1024 * 1024 });
const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
const md5 = (b: Buffer): string => createHash("md5").update(b).digest("hex");

interface ApiFile {
  url: string;
  md5: string;
}
const browser = await chromium.launch({ executablePath: process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
/** JPG → WebP 1024 × 1024 (qualité 0,9) par l'encodeur de Chromium, image décodée sans conversion de couleur. */
async function toWebp(jpg: Buffer): Promise<Buffer> {
  const b64 = await page.evaluate(async (src) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${src}`)).blob();
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const c = new OffscreenCanvas(1024, 1024);
    const g = c.getContext("2d");
    if (!g) throw new Error("pas de contexte 2D");
    g.drawImage(bmp, 0, 0, 1024, 1024);
    const out = await c.convertToBlob({ type: "image/webp", quality: 0.9 });
    const bytes = new Uint8Array(await out.arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, jpg.toString("base64"));
  return Buffer.from(b64, "base64");
}

let failures = 0;
let count = 0;
try {
  for (const t of POLYHAVEN_TEXTURES) {
    const files = JSON.parse(curl(`https://api.polyhaven.com/files/${t.id}`).toString("utf8")) as Record<string, Record<string, Record<string, ApiFile>>>;
    const info = JSON.parse(curl(`https://api.polyhaven.com/info/${t.id}`).toString("utf8")) as { authors?: Record<string, string> };
    const auteur = `${Object.keys(info.authors ?? {}).join(", ") || "Poly Haven"} (Poly Haven)`;
    for (const m of POLYHAVEN_MAPS) {
      const src = files[m.api]?.["1k"]?.["jpg"];
      if (!src) throw new Error(`${t.id} : carte ${m.api} 1K JPG absente de l'API`);
      const jpg = curl(src.url);
      if (md5(jpg) !== src.md5) throw new Error(`${t.id} ${m.api} : md5 ${md5(jpg)} ≠ API ${src.md5}`);
      const webp = await toWebp(jpg);
      const fichier = polyhavenFile(t.id, m.suffixe);
      const path = join(ROOT, fichier);
      const sha = sha256(webp);
      count++;
      if (verify) {
        const ok = existsSync(path) && sha256(readFileSync(path)) === sha && byFile.get(fichier)?.sha256 === sha;
        if (!ok) failures++;
        console.log(`  ${ok ? "OK" : "KO"}  ${fichier} : reconverti ${sha.slice(0, 12)}…, dépôt ${existsSync(path) ? sha256(readFileSync(path)).slice(0, 12) : "absent"}…`);
        continue;
      }
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, webp);
      const old = byFile.get(fichier);
      const entry: ManifestEntry = {
        fichier,
        nom: `Poly Haven, ${t.nom} (${m.nom}), 1K, converti en WebP`,
        url: src.url,
        licence: "CC0-1.0",
        date: old && old.sha256 === sha ? old.date : today,
        auteur,
        sha256: sha,
        usage: "texture_environnement",
        md5_source: src.md5,
        execution: true,
      };
      byFile.set(fichier, entry);
      console.log(`  OK  ${fichier}  ${jpg.length} → ${webp.length} octets  ${sha.slice(0, 12)}…`);
    }
  }
} finally {
  await browser.close();
}
if (verify) {
  if (failures > 0) {
    console.error(`assets:fetch polyhaven --verifier : ${failures} fichier(s) différent(s) sur ${count}.`);
    process.exit(1);
  }
  console.log(`assets:fetch polyhaven --verifier : ${count} fichiers reconvertis, identiques.`);
} else {
  manifest.fichiers = [...byFile.values()].sort((a, b) => a.fichier.localeCompare(b.fichier));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeAttributions("docs/ASSETS_LICENSES.md", manifest);
  console.log(`assets:fetch polyhaven : ${count} fichiers ; manifeste : ${manifest.fichiers.length} entrées.`);
}
