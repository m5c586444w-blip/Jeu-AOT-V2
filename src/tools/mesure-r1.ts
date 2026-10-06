// npm run mesure:r1 [-- bundle | fps | tout | figures] — R1, CR1-03, CR1-05, CR1-06, CR1-09 : mesures réelles, 3D (three.js) contre
// 2D actuel (Pixi).
// - figures : hauteurs mesurées (boîte englobante) des deux Titans et d'un soldat, dispersion des orientations sur les graines
//   1–200, largeurs de rues mesurées (graines 1, 2, 3, 42, 850). Rien n'est écrit dans R1-mesures.json.
// - bundle : construit le commit de départ de R1 (13c9f77) dans un arbre de travail temporaire, puis l'état courant ; tailles
//   brutes et gzip du bundle principal et des morceaux à la demande ; signatures de three.js (« THREE. ») par morceau.
// - fps : sert la construction de production (vite preview) et ouvre, dans le même Chromium sans GPU (WebGL logiciel
//   SwiftShader), la bataille 2D (rue : 2 Titans de 15 m et 20 hommes ; charge : 20 Titans et 280 hommes, soit 300 unités) et
//   le prototype 3D (rue, et vue de dessus des 300 soldats ; qualités basse, moyenne, haute), à 1366×768, 2560×1440 et
//   3840×2160. Mesures :
//   - images par seconde : rappels requestAnimationFrame comptés pendant 8 s, après 3 s de chauffe ;
//   - chargement : de la navigation à « prêt » (carte stratégique prête ; première image 3D), puis avec un débit limité à
//     10 Mbit/s et 40 ms ;
//   - mémoire : tas JS (CDP Performance.getMetrics) et RSS de tous les processus du navigateur (/proc, via SystemInfo).
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium. Résultats : console et docs/reports/R1-mesures.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { preview } from "vite";
import { measureHeight } from "../render/tactical3d/rig";
import { SOLDIER_HEIGHT_M, buildSoldier, soldierHeight, soldierMaterials } from "../render/tactical3d/soldier";
import { TITAN_LARGE, TITAN_SMALL, buildTitan } from "../render/tactical3d/titan";
import { generateTown, measuredStreetWidths, orientationSpreadDeg } from "../render/tactical3d/town";

const START = "13c9f77";
const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const mode = process.argv[2] ?? "tout";
const ROOT = process.cwd();
const SIZES: [number, number][] = [
  [1366, 768],
  [2560, 1440],
  [3840, 2160],
];
const WARM_MS = 3000;
const MEASURE_S = 8;
const results: Record<string, unknown> = { date: "", start: START };

interface Chunk {
  file: string;
  bytes: number;
  gzip: number;
  three: number;
}

function build(cwd: string, outDir: string): void {
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { cwd, stdio: ["ignore", "ignore", "inherit"] });
}

function chunks(outDir: string): { main: string; list: Chunk[] } {
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  const main = /src="\.\/(assets\/index-[^"]+\.js)"/.exec(html)?.[1] ?? "";
  const list = readdirSync(join(outDir, "assets"))
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => {
      const buf = readFileSync(join(outDir, "assets", f));
      return { file: `assets/${f}`, bytes: buf.length, gzip: gzipSync(buf).length, three: (buf.toString("utf8").match(/THREE\./g) ?? []).length };
    })
    .sort((a, b) => b.bytes - a.bytes);
  return { main, list };
}

const kB = (n: number): string => `${(n / 1024).toFixed(1)} Kio`;

function bundle(): string {
  const base = mkdtempSync(join(tmpdir(), "r1-base-"));
  const outBase = join(base, "dist");
  const outNow = mkdtempSync(join(tmpdir(), "r1-now-"));
  try {
    execFileSync("git", ["worktree", "add", "--detach", join(base, "wt"), START], { cwd: ROOT, stdio: "ignore" });
    symlinkSync(join(ROOT, "node_modules"), join(base, "wt", "node_modules"));
    build(join(base, "wt"), outBase);
    build(ROOT, outNow);
    const before = chunks(outBase);
    const after = chunks(outNow);
    const mb = before.list.find((c) => c.file === before.main);
    const ma = after.list.find((c) => c.file === after.main);
    const cssB = before.list.find((c) => /assets\/index-.*\.css/.test(c.file));
    const cssA = after.list.find((c) => /assets\/index-.*\.css/.test(c.file));
    const threeChunks = after.list.filter((c) => c.three > 0);
    const lazy = after.list.filter((c) => /assets\/(entry|proto)-/.test(c.file));
    console.log(`\n=== Bundle (commit de départ ${START} contre l'état courant) ===`);
    console.log(`bundle principal avant : ${before.main}  ${mb?.bytes ?? 0} octets (${kB(mb?.gzip ?? 0)} gzip), signatures THREE. : ${mb?.three ?? 0}`);
    console.log(`bundle principal après : ${after.main}  ${ma?.bytes ?? 0} octets (${kB(ma?.gzip ?? 0)} gzip), signatures THREE. : ${ma?.three ?? 0}`);
    console.log(`écart : ${(ma?.bytes ?? 0) - (mb?.bytes ?? 0)} octets bruts, ${(ma?.gzip ?? 0) - (mb?.gzip ?? 0)} octets gzip`);
    console.log(`CSS principal : ${cssB?.bytes ?? 0} → ${cssA?.bytes ?? 0} octets (${(cssA?.bytes ?? 0) - (cssB?.bytes ?? 0)})`);
    console.log("morceaux chargés à la demande par /proto3d :");
    for (const c of lazy) console.log(`  ${c.file}  ${c.bytes} octets (${kB(c.gzip)} gzip), THREE. : ${c.three}`);
    console.log(`morceaux contenant three.js : ${threeChunks.map((c) => c.file).join(", ") || "aucun"}`);
    const totalB = before.list.reduce((s, c) => s + c.bytes, 0);
    const totalA = after.list.reduce((s, c) => s + c.bytes, 0);
    console.log(`total JS + CSS de dist : ${totalB} → ${totalA} octets (+${totalA - totalB})`);
    const verdict = (ma?.three ?? 1) === 0 && threeChunks.every((c) => c.file !== after.main);
    console.log(`three.js hors du bundle principal : ${verdict ? "OUI" : "NON"}`);
    results["bundle"] = { before: { main: before.main, ...mb, css: cssB?.bytes }, after: { main: after.main, ...ma, css: cssA?.bytes }, lazy, threeChunks: threeChunks.map((c) => c.file), totalBefore: totalB, totalAfter: totalA, threeOutOfMain: verdict };
    return outNow;
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", join(base, "wt")], { cwd: ROOT, stdio: "ignore" });
    rmSync(base, { recursive: true, force: true });
  }
}

async function countFrames(page: Page, seconds: number): Promise<{ fps: number; frames: number; ms: number }> {
  const r = await page.evaluate(async (s) => {
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
  return { ...r, fps: (r.frames * 1000) / r.ms };
}

async function memory(browser: Browser, page: Page): Promise<{ heapMB: number; rssMB: number; gpuMB: number }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const m = await cdp.send("Performance.getMetrics");
  const heap = m.metrics.find((x) => x.name === "JSHeapUsedSize")?.value ?? 0;
  let rss = 0;
  let gpu = 0;
  try {
    const b = await browser.newBrowserCDPSession();
    const info = (await b.send("SystemInfo.getProcessInfo")) as { processInfo: { type: string; id: number }[] };
    for (const p of info.processInfo) {
      const status = existsSync(`/proc/${p.id}/status`) ? readFileSync(`/proc/${p.id}/status`, "utf8") : "";
      const kb = Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
      rss += kb;
      if (p.type === "GPU") gpu += kb;
    }
  } catch {
    rss = -1024;
  }
  return { heapMB: heap / 1048576, rssMB: rss / 1024, gpuMB: gpu / 1024 };
}

async function readyTime(page: Page, cond: string): Promise<number> {
  await page.waitForFunction(cond, undefined, { timeout: 240000, polling: 50 });
  return page.evaluate(() => performance.now());
}

async function open2d(page: Page, url: string): Promise<number> {
  await page.goto(`${url}?dossiers=0`);
  return readyTime(page, "document.documentElement.dataset.ready === 'true'");
}

async function trial(page: Page, type: string, count: number, men: number): Promise<void> {
  if (!(await page.locator('.registre-panneau[data-panel="expeditions"]:not([hidden])').count())) await page.keyboard.press("KeyE");
  await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
  await page.selectOption('select[data-trial="map"]', "tmap_ville");
  await page.selectOption('select[data-trial="type"]', type);
  await page.fill('input[data-trial="count"]', String(count));
  await page.fill('input[data-trial="men"]', String(men));
  await page.locator('[data-action="essai"]').click();
  await page.waitForSelector(".bataille canvas", { timeout: 60000 });
  await page.locator('.bataille-vitesse[data-speed="1"]').click();
}

interface Row {
  rendu: "2D" | "3D";
  scene: string;
  qualite: string;
  taille: string;
  fps: number;
  images: number;
  chargementMs: number;
  tasMo: number;
  rssMo: number;
  gpuMo: number;
  detail: string;
}

async function run(url: string, rendu: "2D" | "3D", scene: "rue" | "300", qualite: string, [w, h]: [number, number]): Promise<Row> {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript(() => {
      (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
    });
    let load = 0;
    let detail = "";
    if (rendu === "2D") {
      load = await open2d(page, url);
      await page.waitForTimeout(500);
      if (scene === "rue") await trial(page, "ttype_grand_errant", 2, 20);
      else await trial(page, "ttype_moyen_errant", 20, 280);
      detail = `${await page.getAttribute(".bataille", "data-vue")} · ${await page.locator(".carte-escouade").count()} escouades`;
    } else {
      await page.goto(`${url}?proto3d&qualite=${qualite}${scene === "300" ? "&cam=dessus" : ""}`);
      load = await readyTime(page, "document.documentElement.dataset.proto3d === 'pret'");
      detail = await page.evaluate(() => {
        const s = window.__proto3d?.stats();
        return s ? `${s.calls} appels, ${Math.round(s.triangles / 1000)} k triangles, ombres ${s.shadows ? "oui" : "non"}, MSAA ${s.antialias ? "oui" : "non"}, tampon ${s.width}×${s.height}` : "";
      });
    }
    await page.waitForTimeout(WARM_MS);
    const f = await countFrames(page, MEASURE_S);
    const mem = await memory(browser, page);
    const row: Row = { rendu, scene, qualite, taille: `${w}×${h}`, fps: f.fps, images: f.frames, chargementMs: load, tasMo: mem.heapMB, rssMo: mem.rssMB, gpuMo: mem.gpuMB, detail };
    console.log(`${rendu} ${scene.padEnd(4)} ${qualite.padEnd(6)} ${row.taille.padEnd(10)} ${f.fps.toFixed(2).padStart(6)} img/s (${f.frames} images en ${(f.ms / 1000).toFixed(1)} s) · prêt en ${(load / 1000).toFixed(2)} s · tas JS ${mem.heapMB.toFixed(1)} Mo · RSS navigateur ${mem.rssMB.toFixed(0)} Mo (dont GPU ${mem.gpuMB.toFixed(0)} Mo) · ${detail}`);
    return row;
  } finally {
    await browser.close();
  }
}

/** Chargement à débit limité (10 Mbit/s, 40 ms), cache vide : « prêt » et octets JS transférés. */
async function throttled(url: string, rendu: "2D" | "3D"): Promise<{ rendu: string; pretMs: number; jsOctets: number }> {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 });
    let ms = 0;
    if (rendu === "2D") ms = await open2d(page, url);
    else {
      await page.goto(`${url}?proto3d`);
      ms = await readyTime(page, "document.documentElement.dataset.proto3d === 'pret'");
    }
    const js = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => e.name.endsWith(".js")).reduce((s, e) => s + (e as PerformanceResourceTiming).encodedBodySize, 0));
    console.log(`${rendu} chargement à 10 Mbit/s, 40 ms : prêt en ${(ms / 1000).toFixed(2)} s ; JS transféré ${(js / 1024).toFixed(0)} Kio`);
    return { rendu, pretMs: ms, jsOctets: js };
  } finally {
    await browser.close();
  }
}

function figures(): void {
  const stat = (xs: number[]): string => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    return `min ${Math.min(...xs).toFixed(2)} · moyenne ${m.toFixed(2)} · max ${Math.max(...xs).toFixed(2)} · écart-type ${sd.toFixed(2)}`;
  };
  console.log("\n=== Figures (boîte englobante sommet par sommet, pose de marche, 8 instants) ===");
  const phases = [0, 0.2, 0.45, 0.7, 1, 1.3, 1.7, 2.1];
  const heights: Record<string, number[]> = {};
  for (const spec of [TITAN_SMALL, TITAN_LARGE]) {
    const t = buildTitan(spec, 850);
    heights[spec.id] = phases.map((ph) => {
      t.setPose("marche", ph);
      return measureHeight(t.body);
    });
    console.log(`Titan ${spec.id} (cible ${spec.height} m) : ${stat(heights[spec.id] ?? [])} m`);
  }
  const s = buildSoldier(7, soldierMaterials());
  s.setPose("sol", 0);
  const hs = soldierHeight(s);
  console.log(`soldat (cible ${SOLDIER_HEIGHT_M} m, pose au sol) : ${hs.toFixed(3)} m sans les lames ; ${measureHeight(s.group).toFixed(3)} m lames levées comprises`);
  const mean = (k: string): number => (heights[k] ?? []).reduce((a, b) => a + b, 0) / (heights[k]?.length ?? 1);
  console.log(`rapports : grand/petit ${(mean("grand") / mean("petit")).toFixed(3)} (cible 3) · petit/soldat ${(mean("petit") / hs).toFixed(3)} (cible ${(5 / 1.8).toFixed(3)}) · grand/soldat ${(mean("grand") / hs).toFixed(3)} (cible ${(15 / 1.8).toFixed(3)})`);
  console.log("\n=== Ville (D-82) ===");
  const spreads = Array.from({ length: 200 }, (_, i) => orientationSpreadDeg(generateTown(i + 1).buildings));
  console.log(`écart-type des orientations à 90° près, graines 1–200 : ${stat(spreads)} °`);
  for (const seed of [1, 2, 3, 42, 850]) {
    const town = generateTown(seed);
    console.log(`graine ${seed} : ${town.buildings.length} maisons ; largeurs de rues mesurées (${measuredStreetWidths(town).length} points) : ${stat(measuredStreetWidths(town))} m`);
  }
}

results["date"] = new Date().toISOString();
if (mode === "figures") {
  figures();
  process.exit(0);
}
let outDir = "";
if (mode === "bundle" || mode === "tout") outDir = bundle();
if (mode === "fps" || mode === "tout") {
  if (!outDir) {
    outDir = mkdtempSync(join(tmpdir(), "r1-now-"));
    build(ROOT, outDir);
  }
  const server = await preview({ root: ROOT, build: { outDir }, preview: { port: 4183, strictPort: false }, logLevel: "error" });
  const url = server.resolvedUrls?.local[0] ?? "http://localhost:4183/";
  const probeBrowser = await chromium.launch({ executablePath });
  const gl = await (await probeBrowser.newPage()).evaluate(() => {
    const c = document.createElement("canvas").getContext("webgl2");
    const e = c?.getExtension("WEBGL_debug_renderer_info");
    return c ? String(c.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : c.RENDERER)) : "aucun WebGL 2";
  });
  await probeBrowser.close();
  console.log(`\n=== Images par seconde, chargement, mémoire (construction de production, ${url}) ===`);
  console.log(`Chromium ${executablePath} ; WebGL : ${gl}`);
  console.log(`chauffe ${WARM_MS / 1000} s, mesure ${MEASURE_S} s ; RSS = somme des processus du navigateur`);
  const rows: Row[] = [];
  for (const size of SIZES) {
    rows.push(await run(url, "2D", "rue", "—", size));
    rows.push(await run(url, "2D", "300", "—", size));
    for (const q of ["bas", "moyen", "haut"]) {
      rows.push(await run(url, "3D", "rue", q, size));
      rows.push(await run(url, "3D", "300", q, size));
    }
  }
  console.log("\n=== Chargement à débit limité ===");
  const slow = [await throttled(url, "2D"), await throttled(url, "3D")];
  results["webgl"] = gl;
  results["rows"] = rows;
  results["throttled"] = slow;
  await new Promise<void>((res) => server.httpServer.close(() => res()));
}
if (outDir) rmSync(outDir, { recursive: true, force: true });
writeFileSync("docs/reports/R1-mesures.json", JSON.stringify(results, null, 2) + "\n");
console.log("\nrésultats : docs/reports/R1-mesures.json");
