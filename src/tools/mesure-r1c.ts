// npm run mesure:r1c [-- bundle | scenes | debit | tout] — R1c, CR1c-04 et CR1c-10 : comparaison avant/après, mêmes conditions.
// « Avant » : commit de départ de R1c (a2b2f88), construit dans un arbre de travail temporaire ; « après » : l'état courant.
// - bundle : bundle principal (même taille, même contenu une fois les noms de morceaux hachés normalisés), worker identique à
//   l'octet, aucune signature three.js ni GLTFLoader dans le bundle principal ; GLTFLoader dans un morceau chargé à la demande ;
//   assets 3D copiés dans dist/assets3d/ (ceux du manifeste marqués `execution`), aucun inclus dans le JS ; aucune image de
//   docs/art/reference/ dans dist ; tailles des morceaux 3D avant et après.
// - scenes : les deux constructions servies (vite preview), chaque scène ouverte dans un Chromium neuf (cache vide), sans GPU
//   (WebGL logiciel SwiftShader), 1366 × 768, qualité moyenne, jour, temps figé à t = 1 s. Mesures :
//   • latence : de la navigation à « prêt » (première image rendue), cibles 04 §9 : scène tactique < 3 s, chargement à froid < 8 s ;
//   • temps d'image : rappels requestAnimationFrame comptés 6 s après 2 s de chauffe (la boucle redessine à chaque rappel) ;
//   • appels de dessin, triangles, tas JS, RSS du navigateur ;
//   • captures appariées : docs/screenshots/r1c-<scène>-avant.png, -apres.png et -comparaison.png (côte à côte, demi-taille).
// - debit : jeu (carte stratégique) et scène tactique à 10 Mbit/s et 40 ms, cache vide : « prêt » et octets transférés.
// Ces chiffres mesurent le processeur (rendu logiciel) : ils bornent par le bas, ils ne disent rien d'un vrai GPU.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium. Résultats : console et docs/reports/R1c-mesures.json.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { preview } from "vite";

const START = "a2b2f88";
const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const mode = process.argv[2] ?? "tout";
const ROOT = process.cwd();
const OUT = "docs/screenshots";
const SIZE: [number, number] = [1366, 768];
const WARM_MS = 2000;
const MEASURE_S = 6;
const TACTICAL_MS = 3000;
const COLD_MS = 8000;
const results: Record<string, unknown> = { date: new Date().toISOString(), start: START };
const failures: string[] = [];
const check = (ok: boolean, label: string): void => {
  console.log(`  ${ok ? "OK" : "KO"}  ${label}`);
  if (!ok) failures.push(label);
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(text);

const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
const kB = (n: number): string => `${(n / 1024).toFixed(1)} Kio`;
const MB = (n: number): string => `${(n / 1048576).toFixed(2)} Mio`;

/**
 * Scènes comparées : même adresse avant et après. Cible de latence (04 §9) :
 * - « tactique » : le prototype de R1 (rue, 2 Titans, 20 soldats), cible de 3 s ;
 * - « environnement » : visionneuse d'un environnement, cible de 8 s (chargement à froid) ;
 * - « outil » : pages de contrôle (banc d'échelle, galerie de toutes les classes de Titans), mesurées sans cible.
 */
type Target = "tactique" | "environnement" | "outil";
const SCENES: { id: string; query: string; cible: Target; label: string }[] = [
  { id: "proto", query: "proto3d&qualite=moyen&panneau=0&pause&t=1", cible: "tactique", label: "scène tactique (rue, 2 Titans, 20 soldats)" },
  { id: "proto-suivi", query: "proto3d&qualite=moyen&panneau=0&pause&t=1&cam=suivi1", cible: "tactique", label: "scène tactique, suivi de l'escouade 1" },
  { id: "proto-bas", query: "proto3d&qualite=bas&panneau=0&pause&t=1", cible: "tactique", label: "scène tactique, qualité basse" },
  { id: "proto-haut", query: "proto3d&qualite=haut&panneau=0&pause&t=1", cible: "tactique", label: "scène tactique, qualité haute" },
  { id: "E01", query: "proto3d&env=E01&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "Shiganshina" },
  { id: "E02", query: "proto3d&env=E02&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "Trost" },
  { id: "E07", query: "proto3d&env=E07&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "Orvud" },
  { id: "E13", query: "proto3d&env=E13&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "campagne pure" },
  { id: "E14", query: "proto3d&env=E14&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "forêt des Arbres Géants" },
  { id: "E17", query: "proto3d&env=E17&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "eaux, marais" },
  { id: "E19-titans", query: "proto3d&env=E19&variante=titans&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "territoire des Titans, Titans nombreux" },
  { id: "E20", query: "proto3d&env=E20&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "château d'Utgard" },
  { id: "E22", query: "proto3d&env=E22&qualite=moyen&panneau=0&pause&t=1", cible: "environnement", label: "murs" },
  { id: "banc", query: "proto3d&env=banc", cible: "outil", label: "banc d'échelle" },
  { id: "galerie", query: "proto3d=galerie", cible: "outil", label: "galerie des environnements (vignettes jour et crépuscule)" },
];

function build(cwd: string, outDir: string): void {
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { cwd, stdio: ["ignore", "ignore", "inherit"] });
}

/** Fichiers d'un dossier, récursivement. */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

const normalize = (s: string): string => s.replace(/([A-Za-z0-9_.]+)-[A-Za-z0-9_-]{8}\.(js|css)/g, "$1-#.$2");
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
/** Signature de GLTFLoader : noms d'extensions glTF qu'il est seul à porter. */
const GLTF_SIG = /KHR_materials_emissive_strength|KHR_mesh_quantization/g;
/** Données glTF incluses dans du JS : « glTF » en base64, ou adresse de données. */
const GLB_INLINE = /Z2xURg|data:model\/gltf/g;

interface Chunk {
  file: string;
  bytes: number;
  gzip: number;
  three: number;
  gltf: number;
}

function chunks(out: string): Chunk[] {
  return readdirSync(join(out, "assets"))
    .filter((f) => /\.js$/.test(f))
    .map((f) => {
      const b = readFileSync(join(out, "assets", f));
      const s = b.toString("utf8");
      return { file: f, bytes: b.length, gzip: gzipSync(b).length, three: count(s, /THREE\./g), gltf: count(s, GLTF_SIG) };
    });
}

function bundle(outBefore: string, outAfter: string): void {
  const mainOf = (out: string): string => /src="\.\/(assets\/index-[^"]+\.js)"/.exec(readFileSync(join(out, "index.html"), "utf8"))?.[1] ?? "";
  const workerOf = (out: string): string => readdirSync(join(out, "assets")).find((f) => /^sim\.worker-.*\.js$/.test(f)) ?? "";
  const mb = readFileSync(join(outBefore, mainOf(outBefore)));
  const ma = readFileSync(join(outAfter, mainOf(outAfter)));
  const wb = readFileSync(join(outBefore, "assets", workerOf(outBefore)));
  const wa = readFileSync(join(outAfter, "assets", workerOf(outAfter)));
  const mainText = ma.toString("utf8");
  console.log(`\n=== Bundle (commit de départ ${START} contre l'état courant) ===`);
  console.log(`bundle principal avant : ${mainOf(outBefore)}  ${mb.length} octets (${kB(gzipSync(mb).length)} gzip)  sha256 ${sha(mb)}`);
  console.log(`bundle principal après : ${mainOf(outAfter)}  ${ma.length} octets (${kB(gzipSync(ma).length)} gzip)  sha256 ${sha(ma)}`);
  const nb = normalize(mb.toString("utf8"));
  const na = normalize(mainText);
  console.log(`contenu normalisé (noms de morceaux hachés remplacés) : avant ${sha(Buffer.from(nb)).slice(0, 16)}…, après ${sha(Buffer.from(na)).slice(0, 16)}…`);
  console.log(`worker avant : ${workerOf(outBefore)}  ${wb.length} octets  sha256 ${sha(wb)}`);
  console.log(`worker après : ${workerOf(outAfter)}  ${wa.length} octets  sha256 ${sha(wa)}`);
  check(ma.length === mb.length, `bundle principal : même taille (${mb.length} → ${ma.length} octets)`);
  check(na === nb, "bundle principal : même contenu une fois les noms de morceaux hachés normalisés");
  check(sha(wa) === sha(wb), "worker de simulation identique à l'octet");
  check(count(mainText, /THREE\./g) === 0, `aucune signature three.js dans le bundle principal (${count(mainText, /THREE\./g)})`);
  check(count(mainText, GLTF_SIG) === 0, `aucune signature GLTFLoader dans le bundle principal (${count(mainText, GLTF_SIG)})`);

  // Morceaux chargés à la demande : ceux qui portent three.js ou GLTFLoader, et les points d'entrée des pages 3D.
  const is3d = (c: Chunk): boolean => c.three > 0 || c.gltf > 0 || /^(entry|proto|envViewer|gallery|bench|humanViewer|bodies)-/.test(c.file);
  const before = chunks(outBefore).filter(is3d).sort((a, b) => b.bytes - a.bytes);
  const after = chunks(outAfter).filter(is3d).sort((a, b) => b.bytes - a.bytes);
  const sum = (cs: Chunk[], k: "bytes" | "gzip"): number => cs.reduce((s, c) => s + c[k], 0);
  for (const [name, cs] of [["avant", before], ["après", after]] as const) {
    console.log(`morceaux 3D chargés à la demande, ${name} : ${cs.length} morceaux, ${sum(cs, "bytes")} octets (${kB(sum(cs, "gzip"))} gzip)`);
    for (const c of cs) console.log(`  assets/${c.file}  ${c.bytes} octets (${kB(c.gzip)} gzip), THREE. : ${c.three}, GLTFLoader : ${c.gltf > 0 ? "oui" : "non"}`);
  }
  const gltfChunks = after.filter((c) => c.gltf > 0);
  check(gltfChunks.length > 0 && !gltfChunks.some((c) => c.file === mainOf(outAfter).replace("assets/", "")), `GLTFLoader dans un morceau chargé à la demande (${gltfChunks.map((c) => c.file).join(", ")})`);
  const inlined = chunks(outAfter).filter((c) => count(readFileSync(join(outAfter, "assets", c.file), "utf8"), GLB_INLINE) > 0);
  check(inlined.length === 0, `aucun modèle glTF inclus dans le JS (${inlined.map((c) => c.file).join(", ") || "aucun"})`);

  // Assets 3D : ceux du manifeste marqués `execution`, copiés dans dist/assets3d/.
  const manifest = JSON.parse(readFileSync("docs/art/assets/manifest.json", "utf8")) as { fichiers: { fichier: string; execution?: boolean }[] };
  const wanted = manifest.fichiers.filter((e) => e.execution).map((e) => e.fichier).sort();
  const dir3d = join(outAfter, "assets3d");
  const served = existsSync(dir3d) ? walk(dir3d).sort() : [];
  const assets = served.map((f) => {
    const b = readFileSync(join(dir3d, f));
    return { file: f, bytes: b.length, gzip: gzipSync(b).length, same: sha(b) === sha(readFileSync(join("docs/art/assets", f))) };
  });
  console.log(`assets 3D (dist/assets3d/) : ${assets.length} fichiers, ${MB(assets.reduce((s, a) => s + a.bytes, 0))} (${MB(assets.reduce((s, a) => s + a.gzip, 0))} gzip)`);
  for (const a of assets) console.log(`  assets3d/${a.file}  ${a.bytes} octets (${MB(a.gzip)} gzip)${a.same ? "" : " — DIFFÈRE de docs/art/assets"}`);
  check(JSON.stringify(served) === JSON.stringify(wanted) && assets.every((a) => a.same), `assets 3D servis = fichiers « execution » du manifeste (${wanted.join(", ")})`);
  const allAssets = walk("docs/art/assets").reduce((s, f) => s + statSync(join("docs/art/assets", f)).size, 0);
  console.log(`docs/art/assets (sources, dérivés et manifeste, hors construction) : ${MB(allAssets)}`);

  // Images de référence : aucune dans dist, ni par le nom ni par le contenu.
  const refDir = join(ROOT, "docs/art/reference");
  const refs = existsSync(refDir) ? readdirSync(refDir).filter((f) => f !== "README.md") : [];
  const refHashes = new Set(refs.map((f) => sha(readFileSync(join(refDir, f)))));
  const files = walk(outAfter);
  const byName = files.filter((f) => refs.some((r) => f.endsWith(r)));
  const byHash = files.filter((f) => refHashes.has(sha(readFileSync(join(outAfter, f)))));
  const images = files.filter((f) => /\.(png|jpe?g|webp|gif|avif)$/i.test(f));
  console.log(`docs/art/reference : ${refs.length} image(s) ; dist : ${files.length} fichiers dont ${images.length} image(s) (${images.join(", ") || "aucune"})`);
  check(byName.length === 0 && byHash.length === 0, `aucune image de référence dans dist (nom : ${byName.length}, contenu : ${byHash.length})`);
  results["bundle"] = {
    before: { main: mainOf(outBefore), bytes: mb.length, sha256: sha(mb), worker: workerOf(outBefore), workerSha256: sha(wb), lazy: before },
    after: { main: mainOf(outAfter), bytes: ma.length, sha256: sha(ma), worker: workerOf(outAfter), workerSha256: sha(wa), lazy: after },
    normalizedEqual: na === nb,
    assets3d: assets,
    docsArtAssetsBytes: allAssets,
    distImages: images,
  };
}

async function newPage(browser: Browser, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
  await page.addInitScript(() => {
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
  });
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

async function countFrames(page: Page, seconds: number): Promise<{ frames: number; ms: number }> {
  return page.evaluate(async (s) => {
    let n = 0;
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const f = (): void => {
        n++;
        if (performance.now() - t0 < s * 1000) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    return { frames: n, ms: performance.now() - t0 };
  }, seconds);
}

async function memory(browser: Browser, page: Page): Promise<{ heapMB: number; rssMB: number }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const m = await cdp.send("Performance.getMetrics");
  const heap = m.metrics.find((x) => x.name === "JSHeapUsedSize")?.value ?? 0;
  let rss = 0;
  try {
    const b = await browser.newBrowserCDPSession();
    const info = (await b.send("SystemInfo.getProcessInfo")) as { processInfo: { type: string; id: number }[] };
    for (const p of info.processInfo) {
      const status = existsSync(`/proc/${p.id}/status`) ? readFileSync(`/proc/${p.id}/status`, "utf8") : "";
      rss += Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
    }
  } catch {
    rss = -1024;
  }
  return { heapMB: heap / 1048576, rssMB: rss / 1024 };
}

interface Row {
  scene: string;
  version: "avant" | "apres";
  pretMs: number;
  msParImage: number;
  images: number;
  appels: number;
  triangles: number;
  programmes: number;
  timings: Record<string, number> | null;
  tasMo: number;
  rssMo: number;
  erreurs: string[];
}

/** Sonde commune des pages 3D qui savent geler l'image (prototype, visionneuse, banc). */
interface Holdable {
  hold(h: boolean): void;
  frame(): Promise<void>;
  stats?: () => { calls: number; triangles: number; programs?: number };
  timings?: Record<string, number>;
}

async function scene(url: string, s: (typeof SCENES)[number], version: "avant" | "apres"): Promise<Row> {
  const browser = await chromium.launch({ executablePath });
  const errors: string[] = [];
  try {
    const page = await newPage(browser, errors);
    // R1e : `env=E01` charge désormais le lieu Shiganshina ; ces mesures portent sur la scène générée de R1b (`scene=r1b`).
    await page.goto(`${url}?${s.query}&scene=r1b`);
    await page.waitForFunction(() => ["pret", "sans-webgl"].includes(document.documentElement.dataset["proto3d"] ?? ""), undefined, { timeout: 900000, polling: 50 });
    const pretMs = await page.evaluate(() => performance.now());
    const state = await page.evaluate(() => document.documentElement.dataset["proto3d"] ?? "");
    if (state !== "pret") errors.push(`page en repli : ${state}`);
    await page.waitForTimeout(WARM_MS);
    const f = await countFrames(page, MEASURE_S);
    const info = await page.evaluate(() => {
      const w = window as unknown as Record<string, Holdable | undefined>;
      const p = w["__proto3d"] ?? w["__env3d"] ?? w["__banc3d"];
      const st = p?.stats?.();
      return { calls: st?.calls ?? 0, triangles: st?.triangles ?? 0, programs: st?.programs ?? 0, timings: p?.timings ?? null };
    });
    const mem = await memory(browser, page);
    // Image figée pour la capture (même temps d'animation avant et après).
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, Holdable | undefined>;
      const p = w["__proto3d"] ?? w["__env3d"] ?? w["__banc3d"];
      if (p) {
        p.hold(true);
        await p.frame();
      }
    });
    await page.screenshot({ path: `${OUT}/r1c-${s.id}-${version}.png`, timeout: 900000 });
    const row: Row = {
      scene: s.id,
      version,
      pretMs,
      msParImage: f.ms / Math.max(1, f.frames),
      images: f.frames,
      appels: info.calls,
      triangles: info.triangles,
      programmes: info.programs,
      timings: info.timings,
      tasMo: mem.heapMB,
      rssMo: mem.rssMB,
      erreurs: errors,
    };
    const t = row.timings ? ` (${Object.entries(row.timings).map(([k, v]) => `${k} ${(v / 1000).toFixed(2)} s`).join(", ")})` : "";
    console.log(
      `${s.id.padEnd(12)} ${version.padEnd(5)} prêt ${(pretMs / 1000).toFixed(2).padStart(6)} s${t} · ${row.msParImage.toFixed(0).padStart(5)} ms/image (${f.frames} images en ${(f.ms / 1000).toFixed(1)} s) · ${row.appels} appels · ${(row.triangles / 1e6).toFixed(2)} M triangles${row.programmes ? ` · ${row.programmes} programmes` : ""} · tas ${mem.heapMB.toFixed(0)} Mo · RSS ${mem.rssMB.toFixed(0)} Mo${errors.length ? ` · ${errors.length} erreur(s) : ${errors.slice(0, 2).join(" | ")}` : ""}`,
    );
    return row;
  } finally {
    await browser.close();
  }
}

/** Planche côte à côte (chaque capture à demi-taille), légendée. */
async function sideBySide(browser: Browser, s: (typeof SCENES)[number]): Promise<void> {
  const [w, h] = [SIZE[0] / 2, SIZE[1] / 2];
  const img = (v: string): string => `data:image/png;base64,${readFileSync(`${OUT}/r1c-${s.id}-${v}.png`).toString("base64")}`;
  const page = await browser.newPage({ viewport: { width: SIZE[0], height: h + 28 } });
  await page.setContent(
    `<html><body style="margin:0;background:#1d1a16;color:#e8e0d0;font:14px sans-serif"><div style="display:flex">` +
      `<figure style="margin:0;width:${w}px"><figcaption style="height:28px;line-height:28px;padding-left:8px">avant (${START}) — ${s.label}</figcaption><img src="${img("avant")}" width="${w}" height="${h}"></figure>` +
      `<figure style="margin:0;width:${w}px"><figcaption style="height:28px;line-height:28px;padding-left:8px">après (R1c) — ${s.label}</figcaption><img src="${img("apres")}" width="${w}" height="${h}"></figure>` +
      `</div></body></html>`,
  );
  await page.screenshot({ path: `${OUT}/r1c-${s.id}-comparaison.png` });
  await page.close();
}

/** Chargement à débit limité (10 Mbit/s, 40 ms), cache vide : « prêt » et octets transférés (JS, assets 3D). */
async function throttled(url: string, what: "jeu" | "tactique", version: "avant" | "apres"): Promise<Record<string, unknown>> {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
    await page.addInitScript(() => {
      (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 });
    if (what === "jeu") {
      await page.goto(`${url}?dossiers=0`);
      await page.waitForFunction(() => document.documentElement.dataset["ready"] === "true", undefined, { timeout: 600000, polling: 50 });
    } else {
      await page.goto(`${url}?proto3d&qualite=moyen&panneau=0&pause&t=1`);
      await page.waitForFunction(() => document.documentElement.dataset["proto3d"] === "pret", undefined, { timeout: 900000, polling: 50 });
    }
    const ms = await page.evaluate(() => performance.now());
    const bytes = await page.evaluate(() => {
      const rs = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const sum = (f: (e: PerformanceResourceTiming) => boolean): number => rs.filter(f).reduce((s, e) => s + e.transferSize, 0);
      return { js: sum((e) => e.name.endsWith(".js")), assets3d: sum((e) => e.name.includes("/assets3d/")), total: sum(() => true) };
    });
    console.log(
      `${what.padEnd(8)} ${version.padEnd(5)} à 10 Mbit/s, 40 ms : prêt en ${(ms / 1000).toFixed(2)} s ; transféré : JS ${kB(bytes.js)}, assets 3D ${MB(bytes.assets3d)}, total ${MB(bytes.total)}`,
    );
    return { what, version, pretMs: ms, ...bytes };
  } finally {
    await browser.close();
  }
}

/** Jeu (carte stratégique), cache vide, sans limite de débit. */
async function coldGame(url: string, version: "avant" | "apres"): Promise<Record<string, unknown>> {
  const browser = await chromium.launch({ executablePath });
  try {
    const errors: string[] = [];
    const page = await newPage(browser, errors);
    await page.goto(`${url}?dossiers=0`);
    await page.waitForFunction(() => document.documentElement.dataset["ready"] === "true", undefined, { timeout: 600000, polling: 50 });
    const ms = await page.evaluate(() => performance.now());
    console.log(`jeu      ${version.padEnd(5)} chargement à froid (carte stratégique prête) : ${(ms / 1000).toFixed(2)} s`);
    return { version, pretMs: ms, erreurs: errors };
  } finally {
    await browser.close();
  }
}

const base = mkdtempSync(join(tmpdir(), "r1c-base-"));
const wt = join(base, "wt");
const outBefore = join(base, "dist");
const outAfter = mkdtempSync(join(tmpdir(), "r1c-now-"));
try {
  execFileSync("git", ["worktree", "add", "--detach", wt, START], { cwd: ROOT, stdio: "ignore" });
  symlinkSync(join(ROOT, "node_modules"), join(wt, "node_modules"));
  build(wt, outBefore);
  build(ROOT, outAfter);
  if (mode === "bundle" || mode === "tout") bundle(outBefore, outAfter);
  if (mode === "scenes" || mode === "debit" || mode === "tout") {
    mkdirSync(OUT, { recursive: true });
    const sBefore = await preview({ root: wt, build: { outDir: outBefore }, preview: { port: 4185, strictPort: false }, logLevel: "error" });
    const sAfter = await preview({ root: ROOT, build: { outDir: outAfter }, preview: { port: 4186, strictPort: false }, logLevel: "error" });
    const urls = { avant: sBefore.resolvedUrls?.local[0] ?? "", apres: sAfter.resolvedUrls?.local[0] ?? "" };
    try {
      const probe = await chromium.launch({ executablePath });
      const gl = await (await probe.newPage()).evaluate(() => {
        const c = document.createElement("canvas").getContext("webgl2");
        const e = c?.getExtension("WEBGL_debug_renderer_info");
        return c ? String(c.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : c.RENDERER)) : "aucun WebGL 2";
      });
      results["webgl"] = gl;
      if (mode === "scenes" || mode === "tout") {
        console.log(`\n=== Scènes avant/après (constructions de production ; ${urls.avant} et ${urls.apres}) ===`);
        console.log(`Chromium ${executablePath} ; WebGL : ${gl} ; ${SIZE[0]} × ${SIZE[1]} ; navigateur neuf par mesure ; chauffe ${WARM_MS / 1000} s, mesure ${MEASURE_S} s`);
        const games = [await coldGame(urls.avant, "avant"), await coldGame(urls.apres, "apres")];
        results["jeu"] = games;
        for (const g of games) check((g["pretMs"] as number) < COLD_MS, `jeu ${String(g["version"])} : chargement à froid ${((g["pretMs"] as number) / 1000).toFixed(2)} s < 8 s`);
        const rows: Row[] = [];
        for (const s of SCENES) {
          const before = await scene(urls.avant, s, "avant");
          const after = await scene(urls.apres, s, "apres");
          rows.push(before, after);
          await sideBySide(probe, s);
          check(after.erreurs.length === 0, `${s.id} après : aucune erreur de page`);
          if (s.cible === "tactique") check(after.pretMs < TACTICAL_MS, `${s.id} après : scène tactique prête en ${(after.pretMs / 1000).toFixed(2)} s < 3 s (avant : ${(before.pretMs / 1000).toFixed(2)} s)`);
          else if (s.cible === "environnement") check(after.pretMs < COLD_MS, `${s.id} après : prête en ${(after.pretMs / 1000).toFixed(2)} s < 8 s (avant : ${(before.pretMs / 1000).toFixed(2)} s)`);
          else console.log(`  --  ${s.id} : page de contrôle, sans cible ; prête en ${(after.pretMs / 1000).toFixed(2)} s (avant : ${(before.pretMs / 1000).toFixed(2)} s)`);
        }
        results["scenes"] = rows;
        console.log("\nrésumé (après / avant) :");
        for (const s of SCENES) {
          const b = rows.find((r) => r.scene === s.id && r.version === "avant");
          const a = rows.find((r) => r.scene === s.id && r.version === "apres");
          if (!a || !b) continue;
          console.log(
            `  ${s.id.padEnd(12)} prêt ${(b.pretMs / 1000).toFixed(2)} → ${(a.pretMs / 1000).toFixed(2)} s · temps d'image ${b.msParImage.toFixed(0)} → ${a.msParImage.toFixed(0)} ms (× ${(a.msParImage / b.msParImage).toFixed(2)}) · triangles ${(b.triangles / 1e6).toFixed(2)} → ${(a.triangles / 1e6).toFixed(2)} M · RSS ${b.rssMo.toFixed(0)} → ${a.rssMo.toFixed(0)} Mo`,
          );
        }
      }
      if (mode === "debit" || mode === "tout") {
        console.log("\n=== Chargement à débit limité (10 Mbit/s, 40 ms, cache vide) ===");
        const slow = [];
        for (const what of ["jeu", "tactique"] as const) for (const v of ["avant", "apres"] as const) slow.push(await throttled(urls[v], what, v));
        results["debit"] = slow;
      }
      await probe.close();
    } finally {
      await new Promise<void>((res) => sBefore.httpServer.close(() => res()));
      await new Promise<void>((res) => sAfter.httpServer.close(() => res()));
    }
  }
} finally {
  execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: ROOT, stdio: "ignore" });
  rmSync(base, { recursive: true, force: true });
  rmSync(outAfter, { recursive: true, force: true });
}
writeFileSync("docs/reports/R1c-mesures.json", `${JSON.stringify(results, null, 2)}\n`);
console.log("\nrésultats : docs/reports/R1c-mesures.json");
if (failures.length > 0) {
  console.error(`mesure:r1c : ${failures.length} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("mesure:r1c : tous les contrôles passent.");
