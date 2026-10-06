// npm run mesure:r1b [-- bundle | fps | tout] — R1b, CR1b-03 et mesures sans GPU.
// - bundle : construit le commit de départ de R1b (b68fade) dans un arbre de travail temporaire, puis l'état courant.
//   • bundle principal : même taille, et même contenu une fois les noms de morceaux hachés normalisés (`nom-XXXXXXXX.js` →
//     `nom-#.js`, plan § 1) ; sha256 donnés pour mémoire ;
//   • worker de simulation identique à l'octet ;
//   • aucune signature three.js (« THREE. ») dans le bundle principal ;
//   • aucune image de docs/art/reference/ dans dist (ni par le nom, ni par le contenu) ;
//   • tailles des morceaux 3D chargés à la demande.
// - fps : sert la construction de production (vite preview) et ouvre, dans Chromium sans GPU (WebGL logiciel SwiftShader),
//   huit environnements représentatifs en qualités basse, moyenne et haute, à 1366 × 768. Mesures : images par seconde
//   (rappels requestAnimationFrame comptés 6 s après 3 s de chauffe), appels de dessin, triangles, instances, tuiles de
//   détail, géométries et textures en mémoire, temps de génération, de textures et d'assemblage, tas JS et RSS du navigateur.
//   Ces chiffres mesurent le processeur (rendu logiciel) : ils bornent par le bas, ils ne disent rien d'un vrai GPU.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium. Résultats : console et docs/reports/R1b-mesures.json.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { preview } from "vite";

const START = "b68fade";
const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const mode = process.argv[2] ?? "tout";
const ROOT = process.cwd();
const ENVS = ["E01", "E06", "E13", "E14", "E19", "E22", "E08", "E28"];
const QUALITIES = ["bas", "moyen", "haut"];
const SIZE: [number, number] = [1366, 768];
const WARM_MS = 3000;
const MEASURE_S = 6;
const results: Record<string, unknown> = { date: new Date().toISOString(), start: START };
const failures: string[] = [];
const check = (ok: boolean, label: string): void => {
  console.log(`  ${ok ? "OK" : "KO"}  ${label}`);
  if (!ok) failures.push(label);
};

const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
const kB = (n: number): string => `${(n / 1024).toFixed(1)} Kio`;

function build(cwd: string, outDir: string): void {
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { cwd, stdio: ["ignore", "ignore", "inherit"] });
}

/** Fichiers de `dist`, récursivement. */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

const normalize = (s: string): string => s.replace(/([A-Za-z0-9_.]+)-[A-Za-z0-9_-]{8}\.(js|css)/g, "$1-#.$2");

function bundle(): string {
  const base = mkdtempSync(join(tmpdir(), "r1b-base-"));
  const outBase = join(base, "dist");
  const outNow = mkdtempSync(join(tmpdir(), "r1b-now-"));
  try {
    execFileSync("git", ["worktree", "add", "--detach", join(base, "wt"), START], { cwd: ROOT, stdio: "ignore" });
    symlinkSync(join(ROOT, "node_modules"), join(base, "wt", "node_modules"));
    build(join(base, "wt"), outBase);
    build(ROOT, outNow);
    const mainOf = (out: string): string => /src="\.\/(assets\/index-[^"]+\.js)"/.exec(readFileSync(join(out, "index.html"), "utf8"))?.[1] ?? "";
    const workerOf = (out: string): string => readdirSync(join(out, "assets")).find((f) => /^sim\.worker-.*\.js$/.test(f)) ?? "";
    const mb = readFileSync(join(outBase, mainOf(outBase)));
    const ma = readFileSync(join(outNow, mainOf(outNow)));
    const wb = readFileSync(join(outBase, "assets", workerOf(outBase)));
    const wa = readFileSync(join(outNow, "assets", workerOf(outNow)));
    const threeMain = (ma.toString("utf8").match(/THREE\./g) ?? []).length;
    console.log(`\n=== Bundle (commit de départ ${START} contre l'état courant) ===`);
    console.log(`bundle principal avant : ${mainOf(outBase)}  ${mb.length} octets (${kB(gzipSync(mb).length)} gzip)  sha256 ${sha(mb)}`);
    console.log(`bundle principal après : ${mainOf(outNow)}  ${ma.length} octets (${kB(gzipSync(ma).length)} gzip)  sha256 ${sha(ma)}`);
    const nb = normalize(mb.toString("utf8"));
    const na = normalize(ma.toString("utf8"));
    console.log(`contenu normalisé (noms de morceaux hachés remplacés) : avant ${sha(Buffer.from(nb)).slice(0, 16)}…, après ${sha(Buffer.from(na)).slice(0, 16)}…`);
    console.log(`worker avant : ${workerOf(outBase)}  ${wb.length} octets  sha256 ${sha(wb)}`);
    console.log(`worker après : ${workerOf(outNow)}  ${wa.length} octets  sha256 ${sha(wa)}`);
    check(ma.length === mb.length, `bundle principal : même taille (${mb.length} → ${ma.length} octets)`);
    check(na === nb, "bundle principal : même contenu une fois les noms de morceaux hachés normalisés");
    check(sha(wa) === sha(wb), "worker de simulation identique à l'octet");
    check(threeMain === 0, `aucune signature three.js dans le bundle principal (${threeMain})`);
    // Images de référence : aucune dans dist, ni par le nom ni par le contenu.
    const refDir = join(ROOT, "docs/art/reference");
    const refs = existsSync(refDir) ? readdirSync(refDir).filter((f) => f !== "README.md") : [];
    const refHashes = new Set(refs.map((f) => sha(readFileSync(join(refDir, f)))));
    const files = walk(outNow);
    const byName = files.filter((f) => refs.some((r) => f.endsWith(r)));
    const byHash = files.filter((f) => refHashes.has(sha(readFileSync(join(outNow, f)))));
    const images = files.filter((f) => /\.(png|jpe?g|webp|gif|avif)$/i.test(f));
    console.log(`docs/art/reference : ${refs.length} image(s) ; dist : ${files.length} fichiers dont ${images.length} image(s) (${images.join(", ") || "aucune"})`);
    check(byName.length === 0 && byHash.length === 0, `aucune image de référence dans dist (nom : ${byName.length}, contenu : ${byHash.length})`);
    const lazy = readdirSync(join(outNow, "assets"))
      .filter((f) => /\.js$/.test(f))
      .map((f) => {
        const b = readFileSync(join(outNow, "assets", f));
        return { file: f, bytes: b.length, gzip: gzipSync(b).length, three: (b.toString("utf8").match(/THREE\./g) ?? []).length };
      })
      .filter((c) => c.three > 0 || /^(entry|proto|envViewer|gallery|bench)-/.test(c.file))
      .sort((a, b) => b.bytes - a.bytes);
    console.log("morceaux 3D chargés à la demande :");
    for (const c of lazy) console.log(`  assets/${c.file}  ${c.bytes} octets (${kB(c.gzip)} gzip), THREE. : ${c.three}`);
    results["bundle"] = {
      before: { main: mainOf(outBase), bytes: mb.length, sha256: sha(mb), worker: workerOf(outBase), workerSha256: sha(wb) },
      after: { main: mainOf(outNow), bytes: ma.length, sha256: sha(ma), worker: workerOf(outNow), workerSha256: sha(wa) },
      normalizedEqual: na === nb,
      threeInMain: threeMain,
      referenceImages: refs.length,
      distImages: images,
      lazy,
    };
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

interface Row {
  env: string;
  qualite: string;
  fps: number;
  images: number;
  pretMs: number;
  generationMs: number;
  texturesMs: number;
  assemblageMs: number;
  appels: number;
  triangles: number;
  instances: number;
  lods: number;
  geometries: number;
  textures: number;
  tasMo: number;
  rssMo: number;
  gpuMo: number;
}

async function run(url: string, env: string, qualite: string): Promise<Row> {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
    await page.addInitScript(() => {
      (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
    });
    const t0 = Date.now();
    await page.goto(`${url}?proto3d&env=${env}&qualite=${qualite}&panneau=0`);
    await page.waitForFunction(() => document.documentElement.dataset["proto3d"] === "pret", undefined, { timeout: 900000, polling: 100 });
    const pretMs = Date.now() - t0;
    await page.waitForTimeout(WARM_MS);
    const f = await countFrames(page, MEASURE_S);
    const info = await page.evaluate(() => ({ s: window.__env3d?.stats(), t: window.__env3d?.timings }));
    const mem = await memory(browser, page);
    const s = info.s;
    const t = info.t;
    const row: Row = {
      env,
      qualite,
      fps: f.fps,
      images: f.frames,
      pretMs,
      generationMs: t?.generate ?? 0,
      texturesMs: t?.textures ?? 0,
      assemblageMs: t?.build ?? 0,
      appels: s?.calls ?? 0,
      triangles: s?.triangles ?? 0,
      instances: s?.instances ?? 0,
      lods: s?.lods ?? 0,
      geometries: s?.geometries ?? 0,
      textures: s?.textures ?? 0,
      tasMo: mem.heapMB,
      rssMo: mem.rssMB,
      gpuMo: mem.gpuMB,
    };
    console.log(
      `${env} ${qualite.padEnd(5)} ${f.fps.toFixed(2).padStart(6)} img/s · prêt ${(pretMs / 1000).toFixed(1)} s (génération ${(row.generationMs / 1000).toFixed(2)} s, textures ${(row.texturesMs / 1000).toFixed(2)} s, assemblage ${(row.assemblageMs / 1000).toFixed(2)} s) · ${row.appels} appels · ${(row.triangles / 1e6).toFixed(2)} M triangles · ${row.instances} instances · ${row.lods} tuiles LOD · ${row.geometries} géométries, ${row.textures} textures · tas ${mem.heapMB.toFixed(0)} Mo · RSS ${mem.rssMB.toFixed(0)} Mo (GPU ${mem.gpuMB.toFixed(0)} Mo)`,
    );
    return row;
  } finally {
    await browser.close();
  }
}

let outDir = "";
if (mode === "bundle" || mode === "tout") outDir = bundle();
if (mode === "fps" || mode === "tout") {
  if (!outDir) {
    outDir = mkdtempSync(join(tmpdir(), "r1b-now-"));
    build(ROOT, outDir);
  }
  const server = await preview({ root: ROOT, build: { outDir }, preview: { port: 4184, strictPort: false }, logLevel: "error" });
  const url = server.resolvedUrls?.local[0] ?? "http://localhost:4184/";
  const probe = await chromium.launch({ executablePath });
  const gl = await (await probe.newPage()).evaluate(() => {
    const c = document.createElement("canvas").getContext("webgl2");
    const e = c?.getExtension("WEBGL_debug_renderer_info");
    return c ? String(c.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : c.RENDERER)) : "aucun WebGL 2";
  });
  await probe.close();
  console.log(`\n=== Environnements : images par seconde, coût, mémoire (construction de production, ${url}) ===`);
  console.log(`Chromium ${executablePath} ; WebGL : ${gl} ; ${SIZE[0]} × ${SIZE[1]} ; chauffe ${WARM_MS / 1000} s, mesure ${MEASURE_S} s ; vue principale, jour`);
  const rows: Row[] = [];
  for (const env of ENVS) for (const q of QUALITIES) rows.push(await run(url, env, q));
  results["webgl"] = gl;
  results["rows"] = rows;
  // Contrôles de cohérence de la qualité : plus d'instances en haute qu'en basse, partout où il y a de la végétation.
  for (const env of ENVS) {
    const lo = rows.find((r) => r.env === env && r.qualite === "bas");
    const hi = rows.find((r) => r.env === env && r.qualite === "haut");
    if (lo && hi) check(hi.instances >= lo.instances, `${env} : instances haute ${hi.instances} ≥ basse ${lo.instances}`);
  }
  await new Promise<void>((res) => server.httpServer.close(() => res()));
}
if (outDir) rmSync(outDir, { recursive: true, force: true });
writeFileSync("docs/reports/R1b-mesures.json", `${JSON.stringify(results, null, 2)}\n`);
console.log("\nrésultats : docs/reports/R1b-mesures.json");
if (failures.length > 0) {
  console.error(`mesure:r1b : ${failures.length} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("mesure:r1b : tous les contrôles passent.");
