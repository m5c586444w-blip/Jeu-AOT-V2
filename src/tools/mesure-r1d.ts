// npm run mesure:r1d [-- bundle | scenes | teintes | anatomie | rapide | tout] — R1d : comparaison avant (fin de R1c, 3782acd) et après,
// mêmes conditions (constructions de production servies par vite preview, Chromium neuf par mesure, WebGL logiciel
// SwiftShader, 1366 × 768, jour, temps figé à t = 1 s).
// - bundle (CR1d-04) : bundle principal identique une fois les noms hachés normalisés, worker identique, three.js et
//   GLTFLoader hors du bundle principal, assets 3D (corps, textures) hors du JS.
// - scenes (CR1d-05, CR1d-06) : latence en deux instants — « prêt » (ville et repères simplifiés, `data-proto3d="pret"`) et
//   « corps » (corps détaillés, `data-corps3d="pret"`, instant noté dans la page) ; avant R1d, les deux sont confondus.
//   Cibles en qualité basse : scène tactique < 3 s, environnements < 8 s ; qualité moyenne et haute mesurées sans cible.
//   Temps d'image (rappels requestAnimationFrame comptés 6 s après 2 s de chauffe), appels, triangles, mémoire ; captures
//   appariées docs/screenshots/r1d-<scène>-avant.png, -apres.png, -comparaison.png, prises après les corps détaillés et les
//   textures de Poly Haven (instant « photos », `data-photo3d="pret"`).
// - teintes (CR1d-08) : mêmes vues qu'en R1b (a2b2f88) — scène tactique, suivi, E01, E02, E22, qualité moyenne — moyennes
//   CIELAB du bas de l'image (sans le ciel) : |Δb*| ≤ 2,5, ΔC* ≥ −2, ΔL10 (ombres) ≤ +8.
// - anatomie (CR1d-09) : corps de base de face, de dos, torses et bassins de près (`?proto3d=humain&vue=anatomie`), avant
//   (3782acd, avec la page de contrôle d'aujourd'hui) et après ; captures appariées docs/screenshots/r1d-anatomie-<vue>-*.png.
// - rapide : la seule scène tactique en qualité basse, état courant (mise au point).
// Ces chiffres mesurent le processeur (rendu logiciel) : ils bornent par le bas ; la mesure sur GPU réel reste à faire.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium. Résultats : console et docs/reports/R1d-mesures.json.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { preview } from "vite";

const BEFORE = "3782acd";
const R1B = "a2b2f88";
const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const mode = process.argv[2] ?? "tout";
const ROOT = process.cwd();
const OUT = "docs/screenshots";
const SIZE: [number, number] = [1366, 768];
const WARM_MS = 2000;
const MEASURE_S = 6;
const TACTICAL_MS = 3000;
const ENV_MS = 8000;
const COLD_MS = 8000;
/** Attente maximale d'un second temps (corps détaillés, textures de Poly Haven) en rendu logiciel. */
const SECOND_MS = 300000;
const results: Record<string, unknown> = { date: new Date().toISOString(), before: BEFORE, r1b: R1B };
const failures: string[] = [];
const check = (ok: boolean, label: string): void => {
  console.log(`  ${ok ? "OK" : "KO"}  ${label}`);
  if (!ok) failures.push(label);
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(text);
const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
const kB = (n: number): string => `${(n / 1024).toFixed(1)} Kio`;
const MB = (n: number): string => `${(n / 1048576).toFixed(2)} Mio`;
const s2 = (ms: number): string => `${(ms / 1000).toFixed(2)} s`;

type Target = "tactique" | "environnement" | "aucune";
interface SceneDef {
  id: string;
  query: string;
  cible: Target;
  label: string;
  /** Capture appariée avant/après. */
  capture: boolean;
}
const Q = "panneau=0&pause&t=1";
/** Latence en qualité basse (cibles), puis rendu en qualité moyenne et haute (captures, sans cible logicielle). */
const SCENES: SceneDef[] = [
  { id: "proto-bas", query: `proto3d&qualite=bas&${Q}`, cible: "tactique", label: "scène tactique, qualité basse", capture: true },
  { id: "E01-bas", query: `proto3d&env=E01&qualite=bas&${Q}`, cible: "environnement", label: "Shiganshina, qualité basse", capture: false },
  { id: "E02-bas", query: `proto3d&env=E02&qualite=bas&${Q}`, cible: "environnement", label: "Trost, qualité basse", capture: false },
  { id: "E13-bas", query: `proto3d&env=E13&qualite=bas&${Q}`, cible: "environnement", label: "campagne pure, qualité basse", capture: false },
  { id: "E14-bas", query: `proto3d&env=E14&qualite=bas&${Q}`, cible: "environnement", label: "forêt des Arbres Géants, qualité basse", capture: true },
  { id: "E19-titans-bas", query: `proto3d&env=E19&variante=titans&qualite=bas&${Q}`, cible: "environnement", label: "territoire, Titans nombreux, qualité basse", capture: false },
  { id: "E22-bas", query: `proto3d&env=E22&qualite=bas&${Q}`, cible: "environnement", label: "murs, qualité basse", capture: false },
  { id: "proto", query: `proto3d&qualite=moyen&${Q}`, cible: "aucune", label: "scène tactique (rue, 2 Titans, 20 soldats)", capture: true },
  { id: "proto-suivi", query: `proto3d&qualite=moyen&${Q}&cam=suivi1`, cible: "aucune", label: "scène tactique, suivi de l'escouade 1", capture: true },
  { id: "proto-haut", query: `proto3d&qualite=haut&${Q}`, cible: "aucune", label: "scène tactique, qualité haute", capture: true },
  { id: "E01", query: `proto3d&env=E01&qualite=moyen&${Q}`, cible: "aucune", label: "Shiganshina", capture: true },
  { id: "E02", query: `proto3d&env=E02&qualite=moyen&${Q}`, cible: "aucune", label: "Trost", capture: true },
  { id: "E07", query: `proto3d&env=E07&qualite=moyen&${Q}`, cible: "aucune", label: "Orvud", capture: true },
  { id: "E13", query: `proto3d&env=E13&qualite=moyen&${Q}`, cible: "aucune", label: "campagne pure", capture: true },
  { id: "E14", query: `proto3d&env=E14&qualite=moyen&${Q}`, cible: "aucune", label: "forêt des Arbres Géants", capture: true },
  { id: "E17", query: `proto3d&env=E17&qualite=moyen&${Q}`, cible: "aucune", label: "eaux, marais", capture: true },
  { id: "E19-titans", query: `proto3d&env=E19&variante=titans&qualite=moyen&${Q}`, cible: "aucune", label: "territoire des Titans, Titans nombreux", capture: true },
  { id: "E20", query: `proto3d&env=E20&qualite=moyen&${Q}`, cible: "aucune", label: "château d'Utgard", capture: true },
  { id: "E22", query: `proto3d&env=E22&qualite=moyen&${Q}`, cible: "aucune", label: "murs", capture: true },
  { id: "banc", query: "proto3d&env=banc", cible: "aucune", label: "banc d'échelle", capture: true },
];
/**
 * Vues de contrôle anatomique (CR1d-09). Corps en rang (homme, Titan de sexe 0,65, femme, corpulence lourde) ; de près : torses
 * (homme et Titan, femme et lourde), bassins.
 */
const ANATOMY_VIEWS: { id: string; query: string; label: string }[] = [
  { id: "face", query: "", label: "de face" },
  { id: "dos", query: "&dos", label: "de dos" },
  { id: "torses-hommes", query: "&recul=0.95&hauteur=1.22&x=-0.55", label: "torses, homme et Titan 0,65" },
  { id: "torses-femmes", query: "&recul=0.95&hauteur=1.15&x=0.55", label: "torses, femme et lourde" },
  { id: "bassins", query: "&recul=1.25&hauteur=0.86", label: "bassins, Titan 0,65 et femme" },
];
/** Vues de la mesure des teintes (CR1d-08) : mêmes adresses qu'en R1b. */
const TINT_VIEWS = ["proto", "proto-suivi", "E01", "E02", "E22"];

function build(cwd: string, outDir: string): void {
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { cwd, stdio: ["ignore", "ignore", "inherit"] });
}

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

const normalize = (s: string): string => s.replace(/([A-Za-z0-9_.]+)-[A-Za-z0-9_-]{8}\.(js|css)/g, "$1-#.$2");
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const GLTF_SIG = /KHR_materials_emissive_strength|KHR_mesh_quantization/g;
const INLINE_ASSET = /Z2xURg|data:model\/gltf|data:image\/webp;base64,UklGR/g;

/** Arbre de travail d'un commit, construit (dist) ; supprimé à la fin. */
interface Built {
  wt: string;
  dist: string;
}
const trees: string[] = [];
function buildCommit(rev: string, overlay: string[] = []): Built {
  const base = mkdtempSync(join(tmpdir(), `r1d-${rev}-`));
  trees.push(base);
  const wt = join(base, "wt");
  execFileSync("git", ["worktree", "add", "--detach", wt, rev], { cwd: ROOT, stdio: "ignore" });
  symlinkSync(join(ROOT, "node_modules"), join(wt, "node_modules"));
  for (const f of overlay) copyFileSync(join(ROOT, f), join(wt, f));
  const dist = join(base, "dist");
  build(wt, dist);
  return { wt, dist };
}

function bundle(before: string, after: string): void {
  const mainOf = (out: string): string => /src="\.\/(assets\/index-[^"]+\.js)"/.exec(readFileSync(join(out, "index.html"), "utf8"))?.[1] ?? "";
  const workerOf = (out: string): string => readdirSync(join(out, "assets")).find((f) => /^sim\.worker-.*\.js$/.test(f)) ?? "";
  const mb = readFileSync(join(before, mainOf(before)));
  const ma = readFileSync(join(after, mainOf(after)));
  const wb = readFileSync(join(before, "assets", workerOf(before)));
  const wa = readFileSync(join(after, "assets", workerOf(after)));
  const text = ma.toString("utf8");
  console.log(`\n=== Bundle (avant ${BEFORE} contre l'état courant) ===`);
  console.log(`bundle principal avant : ${mainOf(before)}  ${mb.length} octets (${kB(gzipSync(mb).length)} gzip)`);
  console.log(`bundle principal après : ${mainOf(after)}  ${ma.length} octets (${kB(gzipSync(ma).length)} gzip)`);
  console.log(`worker avant : ${workerOf(before)}  sha256 ${sha(wb)}`);
  console.log(`worker après : ${workerOf(after)}  sha256 ${sha(wa)}`);
  check(ma.length === mb.length, `bundle principal : même taille (${mb.length} → ${ma.length} octets)`);
  check(normalize(text) === normalize(mb.toString("utf8")), "bundle principal : même contenu une fois les noms de morceaux hachés normalisés");
  check(sha(wa) === sha(wb), "worker de simulation identique à l'octet");
  check(count(text, /THREE\./g) === 0 && count(text, GLTF_SIG) === 0, "ni three.js ni GLTFLoader dans le bundle principal");
  const js = readdirSync(join(after, "assets")).filter((f) => f.endsWith(".js"));
  const lazy = (out: string): { file: string; bytes: number; gzip: number }[] =>
    readdirSync(join(out, "assets"))
      .filter((f) => f.endsWith(".js") && !f.startsWith("index-") && !f.startsWith("sim.worker"))
      .map((f) => {
        const b = readFileSync(join(out, "assets", f));
        return { file: f, bytes: b.length, gzip: gzipSync(b).length, three: count(b.toString("utf8"), /THREE\./g) };
      })
      .filter((c) => c.three > 0 || /^(entry|proto|envViewer|gallery|bench|humanViewer|bodies|post|GLTFLoader|lite)-/.test(c.file))
      .map(({ file, bytes, gzip }) => ({ file, bytes, gzip }));
  for (const [name, out] of [["avant", before], ["après", after]] as const) {
    const l = lazy(out);
    console.log(`morceaux 3D à la demande, ${name} : ${l.length} morceaux, ${l.reduce((s, c) => s + c.bytes, 0)} octets (${kB(l.reduce((s, c) => s + c.gzip, 0))} gzip)`);
  }
  const inlined = js.filter((f) => count(readFileSync(join(after, "assets", f), "utf8"), INLINE_ASSET) > 0);
  check(inlined.length === 0, `aucun modèle ni texture d'asset inclus dans le JS (${inlined.join(", ") || "aucun"})`);
  const dir3d = join(after, "assets3d");
  const served = existsSync(dir3d) ? walk(dir3d).sort() : [];
  const total = served.reduce((s, f) => s + statSync(join(dir3d, f)).size, 0);
  console.log(`assets 3D (dist/assets3d/) : ${served.length} fichiers, ${MB(total)}`);
  for (const f of served) console.log(`  assets3d/${f}  ${statSync(join(dir3d, f)).size} octets`);
  const manifest = JSON.parse(readFileSync("docs/art/assets/manifest.json", "utf8")) as { fichiers: { fichier: string; execution?: boolean }[] };
  const wanted = manifest.fichiers.filter((e) => e.execution).map((e) => e.fichier).sort();
  check(JSON.stringify(served) === JSON.stringify(wanted), `assets 3D servis = fichiers « execution » du manifeste (${wanted.length})`);
  const refDir = join(ROOT, "docs/art/reference");
  const refs = existsSync(refDir) ? readdirSync(refDir).filter((f) => f !== "README.md") : [];
  const refHashes = new Set(refs.map((f) => sha(readFileSync(join(refDir, f)))));
  const leaked = walk(after).filter((f) => refHashes.has(sha(readFileSync(join(after, f)))));
  check(leaked.length === 0, `aucune image de référence dans dist (${leaked.length})`);
  results["bundle"] = { before: { main: mainOf(before), bytes: mb.length }, after: { main: mainOf(after), bytes: ma.length }, assets3d: served, assets3dBytes: total };
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

async function rssOf(browser: Browser): Promise<number> {
  try {
    const b = await browser.newBrowserCDPSession();
    const info = (await b.send("SystemInfo.getProcessInfo")) as { processInfo: { id: number }[] };
    let kb = 0;
    for (const p of info.processInfo) {
      const status = existsSync(`/proc/${p.id}/status`) ? readFileSync(`/proc/${p.id}/status`, "utf8") : "";
      kb += Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
    }
    return kb / 1024;
  } catch {
    return -1;
  }
}

interface Row {
  scene: string;
  version: "avant" | "apres" | "r1b";
  pretMs: number;
  corpsMs: number | null;
  corpsEtat: string;
  /** Instant des textures de Poly Haven (R1d.5) depuis la navigation ; `null` sans objet (avant R1d.5). */
  photosMs: number | null;
  photosEtat: string;
  timings: Record<string, number> | null;
  msParImage: number;
  appels: number;
  triangles: number;
  programmes: number;
  rssMo: number;
  erreurs: string[];
}

interface Probe {
  hold(h: boolean): void;
  frame(): Promise<void>;
  stats?: () => { calls: number; triangles: number; programs?: number };
  timings?: Record<string, number>;
}

async function scene(url: string, s: SceneDef, version: Row["version"], file: string | null): Promise<Row> {
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
    // Second temps (R1d) : corps détaillés, si la page en a (sinon, pas de marque `corps3d`).
    let corpsMs: number | null = null;
    let corpsEtat = "sans objet";
    const progressive = await page.evaluate(() => {
      const w = window as unknown as Record<string, Probe | undefined>;
      const t = (w["__proto3d"] ?? w["__env3d"])?.timings;
      // Second temps : pages de R1d seulement (leur sonde a « pret ») ; en R1c, `corps` était la durée de façonnage des corps.
      return t !== undefined && "pret" in t && "corps" in t;
    });
    const hasBodies = /^proto|E19-titans|banc/.test(s.id);
    if (progressive && hasBodies && s.id !== "banc") {
      // Délai borné : un second temps bloqué est noté (contrôle en échec), sans arrêter toute la mesure.
      const ok = await page.waitForFunction(() => ["pret", "primitives", "repli"].includes(document.documentElement.dataset["corps3d"] ?? ""), undefined, { timeout: SECOND_MS, polling: 100 }).then(
        () => true,
        () => false,
      );
      corpsEtat = ok ? ((await page.evaluate(() => document.documentElement.dataset["corps3d"] ?? "")) ?? "") : `délai de ${SECOND_MS / 1000} s dépassé`;
      const err = await page.evaluate(() => document.documentElement.dataset["corpsErreur"] ?? "");
      if (err) errors.push(`corps : ${err}`);
      corpsMs = await page.evaluate(() => {
        const w = window as unknown as Record<string, Probe | undefined>;
        return (w["__proto3d"] ?? w["__env3d"])?.timings?.["corps"] ?? 0;
      });
    } else if (hasBodies) {
      corpsMs = pretMs;
      corpsEtat = "avec la première image";
    }
    // Textures de Poly Haven (R1d.5), posées après la première image : attendues avant la mesure et la capture.
    let photosMs: number | null = null;
    let photosEtat = "sans objet";
    const withPhotos = await page.evaluate(() => {
      const w = window as unknown as Record<string, Probe | undefined>;
      const t = (w["__proto3d"] ?? w["__env3d"])?.timings;
      return t !== undefined && "photos" in t;
    });
    if (withPhotos) {
      const ok = await page.waitForFunction(() => ["pret", "repli", "procedurales"].includes(document.documentElement.dataset["photo3d"] ?? ""), undefined, { timeout: SECOND_MS, polling: 100 }).then(
        () => true,
        () => false,
      );
      photosEtat = ok ? await page.evaluate(() => document.documentElement.dataset["photo3d"] ?? "") : `délai de ${SECOND_MS / 1000} s dépassé`;
      photosMs = await page.evaluate(() => {
        const w = window as unknown as Record<string, Probe | undefined>;
        return (w["__proto3d"] ?? w["__env3d"])?.timings?.["photos"] ?? 0;
      });
    }
    await page.waitForTimeout(WARM_MS);
    const f = await countFrames(page, MEASURE_S);
    const info = await page.evaluate(() => {
      const w = window as unknown as Record<string, Probe | undefined>;
      const p = w["__proto3d"] ?? w["__env3d"] ?? w["__banc3d"];
      const st = p?.stats?.();
      return { calls: st?.calls ?? 0, triangles: st?.triangles ?? 0, programs: st?.programs ?? 0, timings: p?.timings ?? null };
    });
    const rss = await rssOf(browser);
    if (file) {
      await page.evaluate(async () => {
        const w = window as unknown as Record<string, Probe | undefined>;
        const p = w["__proto3d"] ?? w["__env3d"] ?? w["__banc3d"];
        if (p) {
          p.hold(true);
          await p.frame();
        }
      });
      await page.screenshot({ path: file, timeout: 900000 });
    }
    const row: Row = { scene: s.id, version, pretMs, corpsMs, corpsEtat, photosMs, photosEtat, timings: info.timings, msParImage: f.ms / Math.max(1, f.frames), appels: info.calls, triangles: info.triangles, programmes: info.programs, rssMo: rss, erreurs: errors };
    console.log(
      `${s.id.padEnd(15)} ${version.padEnd(5)} prêt ${s2(pretMs).padStart(8)}${corpsMs !== null ? ` · corps ${corpsMs > 0 ? s2(corpsMs) : corpsEtat} (${corpsEtat})` : ""}${photosMs !== null ? ` · photos ${photosMs > 0 ? s2(photosMs) : photosEtat}` : ""} · ${row.msParImage.toFixed(0).padStart(5)} ms/image · ${row.appels} appels · ${(row.triangles / 1e6).toFixed(2)} M triangles${row.programmes ? ` · ${row.programmes} programmes` : ""} · RSS ${rss.toFixed(0)} Mo${errors.length ? ` · ${errors.length} erreur(s) : ${errors.slice(0, 2).join(" | ")}` : ""}`,
    );
    return row;
  } finally {
    await browser.close();
  }
}

async function coldGame(url: string, version: string): Promise<number> {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await newPage(browser, []);
    await page.goto(`${url}?dossiers=0`);
    await page.waitForFunction(() => document.documentElement.dataset["ready"] === "true", undefined, { timeout: 600000, polling: 50 });
    const ms = await page.evaluate(() => performance.now());
    console.log(`jeu             ${version.padEnd(5)} chargement à froid (carte stratégique prête) : ${s2(ms)}`);
    return ms;
  } finally {
    await browser.close();
  }
}

async function sideBySide(browser: Browser, s: SceneDef, left: string, right: string, out: string, labels: [string, string]): Promise<void> {
  const [w, h] = [SIZE[0] / 2, SIZE[1] / 2];
  const img = (f: string): string => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  const page = await browser.newPage({ viewport: { width: SIZE[0], height: h + 28 } });
  await page.setContent(
    `<html><body style="margin:0;background:#1d1a16;color:#e8e0d0;font:14px sans-serif"><div style="display:flex">` +
      `<figure style="margin:0;width:${w}px"><figcaption style="height:28px;line-height:28px;padding-left:8px">${labels[0]} — ${s.label}</figcaption><img src="${img(left)}" width="${w}" height="${h}"></figure>` +
      `<figure style="margin:0;width:${w}px"><figcaption style="height:28px;line-height:28px;padding-left:8px">${labels[1]} — ${s.label}</figcaption><img src="${img(right)}" width="${w}" height="${h}"></figure>` +
      `</div></body></html>`,
  );
  await page.screenshot({ path: out });
  await page.close();
}

interface Lab {
  L: number;
  a: number;
  b: number;
  C: number;
  L10: number;
}
/** Moyennes CIELAB du bas de l'image (65 % inférieurs : ville et sol, sans le ciel) ; L10 = 10e centile de L* (ombres). */
async function labOf(browser: Browser, file: string): Promise<Lab> {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
  });
  await page.goto("about:blank");
  const data = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  const r = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    g.drawImage(img, 0, 0);
    const y0 = Math.floor(img.height * 0.35);
    const d = g.getImageData(0, y0, img.width, img.height - y0).data;
    const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const f3 = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    let L = 0;
    let A = 0;
    let B = 0;
    let C = 0;
    let n = 0;
    const Ls: number[] = [];
    for (let i = 0; i < d.length; i += 16) {
      const R = lin((d[i] ?? 0) / 255);
      const G = lin((d[i + 1] ?? 0) / 255);
      const Bl = lin((d[i + 2] ?? 0) / 255);
      const X = (0.4124 * R + 0.3576 * G + 0.1805 * Bl) / 0.95047;
      const Y = 0.2126 * R + 0.7152 * G + 0.0722 * Bl;
      const Z = (0.0193 * R + 0.1192 * G + 0.9505 * Bl) / 1.08883;
      const l = 116 * f3(Y) - 16;
      const a = 500 * (f3(X) - f3(Y));
      const bb = 200 * (f3(Y) - f3(Z));
      L += l;
      A += a;
      B += bb;
      C += Math.hypot(a, bb);
      n++;
      Ls.push(l);
    }
    Ls.sort((x, y) => x - y);
    return { L: L / n, a: A / n, b: B / n, C: C / n, L10: Ls[Math.floor(n * 0.1)] ?? 0 };
  }, data);
  await page.close();
  return r;
}

const serve = async (b: Built, port: number): Promise<{ url: string; close(): Promise<void> }> => {
  const s = await preview({ root: b.wt, build: { outDir: b.dist }, preview: { port, strictPort: false }, logLevel: "error" });
  return { url: s.resolvedUrls?.local[0] ?? "", close: () => new Promise<void>((res) => s.httpServer.close(() => res())) };
};

try {
  mkdirSync(OUT, { recursive: true });
  const outNow = mkdtempSync(join(tmpdir(), "r1d-now-"));
  trees.push(outNow);
  build(ROOT, outNow);
  const now: Built = { wt: ROOT, dist: outNow };
  const before = mode === "rapide" || mode === "teintes" || mode === "anatomie" ? null : buildCommit(BEFORE);
  if (before && (mode === "bundle" || mode === "tout")) bundle(before.dist, now.dist);
  if (mode === "scenes" || mode === "tout" || mode === "rapide") {
    const sNow = await serve(now, 4196);
    const sBefore = before ? await serve(before, 4195) : null;
    try {
      console.log(`\n=== Scènes (constructions de production ; WebGL logiciel ; ${SIZE[0]} × ${SIZE[1]} ; navigateur neuf par mesure) ===`);
      if (mode !== "rapide" && sBefore) {
        const g = [await coldGame(sBefore.url, "avant"), await coldGame(sNow.url, "apres")];
        results["jeu"] = g;
        check((g[1] ?? Infinity) < COLD_MS, `jeu : chargement à froid ${s2(g[1] ?? 0)} < 8 s`);
      }
      const rows: Row[] = [];
      const probe = await chromium.launch({ executablePath });
      for (const s of mode === "rapide" ? SCENES.filter((x) => x.id === "proto-bas") : SCENES) {
        const fb = `${OUT}/r1d-${s.id}-avant.png`;
        const fa = `${OUT}/r1d-${s.id}-apres.png`;
        const b = sBefore ? await scene(sBefore.url, s, "avant", s.capture ? fb : null) : null;
        const a = await scene(sNow.url, s, "apres", mode !== "rapide" && s.capture ? fa : null);
        if (b) rows.push(b);
        rows.push(a);
        if (b && s.capture && mode !== "rapide") await sideBySide(probe, s, fb, fa, `${OUT}/r1d-${s.id}-comparaison.png`, [`avant (${BEFORE}, R1c)`, "après (R1d)"]);
        check(a.erreurs.length === 0, `${s.id} après : aucune erreur de page`);
        if (s.cible === "tactique") check(a.pretMs < TACTICAL_MS, `${s.id} après : « prêt » ${s2(a.pretMs)} < 3 s${b ? ` (avant : ${s2(b.pretMs)})` : ""}`);
        if (s.cible === "environnement") check(a.pretMs < ENV_MS, `${s.id} après : « prêt » ${s2(a.pretMs)} < 8 s${b ? ` (avant : ${s2(b.pretMs)})` : ""}`);
        if (a.corpsMs !== null && a.corpsEtat !== "avec la première image") check(a.corpsEtat === "pret", `${s.id} après : corps détaillés affichés (${a.corpsEtat}, ${a.corpsMs > 0 ? s2(a.corpsMs) : "—"})`);
        if (a.photosMs !== null) check(a.photosEtat === "pret", `${s.id} après : textures de Poly Haven posées (${a.photosEtat}, ${a.photosMs > 0 ? s2(a.photosMs) : "—"})`);
      }
      await probe.close();
      results["scenes"] = rows;
      if (sBefore) {
        console.log("\nrésumé (avant R1c → après R1d) :");
        for (const s of SCENES) {
          const b = rows.find((r) => r.scene === s.id && r.version === "avant");
          const a = rows.find((r) => r.scene === s.id && r.version === "apres");
          if (!a || !b) continue;
          const corps = a.corpsMs !== null ? ` · corps ${b.corpsMs !== null ? s2(b.corpsMs) : "—"} → ${a.corpsMs > 0 ? s2(a.corpsMs) : a.corpsEtat}` : "";
          console.log(`  ${s.id.padEnd(15)} prêt ${s2(b.pretMs)} → ${s2(a.pretMs)}${corps} · temps d'image ${b.msParImage.toFixed(0)} → ${a.msParImage.toFixed(0)} ms · RSS ${b.rssMo.toFixed(0)} → ${a.rssMo.toFixed(0)} Mo`);
        }
      }
    } finally {
      await sNow.close();
      await sBefore?.close();
    }
  }
  if (mode === "anatomie" || mode === "tout") {
    // CR1d-09 : page de contrôle d'aujourd'hui sur les deux versions du corps de base (avant : `.glb` et façonnage de R1c).
    const old = buildCommit(BEFORE, ["src/render/tactical3d/humanViewer.ts"]);
    const sOld = await serve(old, 4199);
    const sNow = await serve(now, 4200);
    const probe = await chromium.launch({ executablePath });
    try {
      console.log(`\n=== Anatomie (avant ${BEFORE} contre R1d ; ?proto3d=humain&vue=anatomie) ===`);
      for (const v of ANATOMY_VIEWS) {
        const files: [string, string] = [`${OUT}/r1d-anatomie-${v.id}-avant.png`, `${OUT}/r1d-anatomie-${v.id}-apres.png`];
        for (const [k, url] of [sOld.url, sNow.url].entries()) {
          const errors: string[] = [];
          const page = await newPage(probe, errors);
          await page.goto(`${url}?proto3d=humain&vue=anatomie${v.query}`);
          await page.waitForFunction(() => ["pret", "sans-webgl"].includes(document.documentElement.dataset["proto3d"] ?? ""), undefined, { timeout: 900000, polling: 100 });
          await page.screenshot({ path: files[k] as string, timeout: 900000 });
          await page.close();
          check(errors.length === 0, `anatomie ${v.id} ${k === 0 ? "avant" : "après"} : aucune erreur de page${errors.length ? ` (${errors.slice(0, 2).join(" | ")})` : ""}`);
        }
        await sideBySide(probe, { id: v.id, query: v.query, cible: "aucune", label: v.label, capture: true }, files[0], files[1], `${OUT}/r1d-anatomie-${v.id}-comparaison.png`, [`avant (${BEFORE}, R1c)`, "après (R1d)"]);
        console.log(`  ${v.id.padEnd(14)} ${files[1]}`);
      }
    } finally {
      await probe.close();
      await sOld.close();
      await sNow.close();
    }
  }
  if (mode === "teintes" || mode === "tout") {
    // CR1d-08 : mêmes vues qu'en R1b, qualité moyenne, après les corps détaillés.
    const r1b = buildCommit(R1B);
    const sR = await serve(r1b, 4197);
    const sNow = await serve(now, 4198);
    const probe = await chromium.launch({ executablePath });
    try {
      console.log(`\n=== Teintes (R1b ${R1B} contre R1d ; bas de l'image, 65 % inférieurs ; jour, qualité moyenne) ===`);
      const tints: Record<string, { r1b: Lab; r1d: Lab }> = {};
      for (const id of TINT_VIEWS) {
        const s = SCENES.find((x) => x.id === id) as SceneDef;
        const fr = `${OUT}/r1d-teinte-${id}-r1b.png`;
        const fa = `${OUT}/r1d-teinte-${id}-r1d.png`;
        await scene(sR.url, s, "r1b", fr);
        await scene(sNow.url, s, "apres", fa);
        const r = await labOf(probe, fr);
        const a = await labOf(probe, fa);
        tints[id] = { r1b: r, r1d: a };
        const f = (x: Lab): string => `L* ${x.L.toFixed(1)}  a* ${x.a.toFixed(1)}  b* ${x.b.toFixed(1)}  C* ${x.C.toFixed(1)}  L10 ${x.L10.toFixed(1)}`;
        console.log(`  ${id.padEnd(12)} R1b : ${f(r)}`);
        console.log(`  ${"".padEnd(12)} R1d : ${f(a)}`);
        check(Math.abs(a.b - r.b) <= 2.5, `${id} : |Δb*| = ${Math.abs(a.b - r.b).toFixed(1)} ≤ 2,5`);
        check(a.C - r.C >= -2, `${id} : ΔC* = ${(a.C - r.C).toFixed(1)} ≥ −2`);
        check(a.L10 - r.L10 <= 8, `${id} : ΔL10 (ombres) = ${(a.L10 - r.L10).toFixed(1)} ≤ +8`);
      }
      results["teintes"] = tints;
    } finally {
      await probe.close();
      await sR.close();
      await sNow.close();
    }
  }
} finally {
  for (const t of trees) {
    const wt = join(t, "wt");
    if (existsSync(wt)) execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: ROOT, stdio: "ignore" });
    rmSync(t, { recursive: true, force: true });
  }
}
if (mode !== "rapide" && mode !== "anatomie") writeFileSync("docs/reports/R1d-mesures.json", `${JSON.stringify(results, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`mesure:r1d : ${failures.length} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("mesure:r1d : tous les contrôles passent.");
