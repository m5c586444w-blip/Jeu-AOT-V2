// npm run smoke:r1 — R1 (essai de rendu 3D) dans un vrai navigateur (Chromium, serveur de dev Vite) :
// - accès : la console F2 du jeu porte le lien vers /proto3d, qui se charge en WebGL 2 (SwiftShader ici) ;
// - réglages : lumière, qualité (ombres, résolution interne, MSAA), caméras (suivi d'escouade : la cible rejoint l'escouade et
//   la suit), poses, foule, raccourcis ;
// - CR1-07 : Chromium lancé sans WebGL (--disable-3d-apis) → message clair, retour au rendu 2D, three.js jamais demandé ;
// - CR1-08 : captures docs/screenshots/r1-* (jour, crépuscule, nuit, vue Titan, vue de dessus des 300 soldats, à 1366×768 et
//   3840×2160 ; planche des poses, suivi d'escouade, panneau, repli sans WebGL à 1366×768).
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(text);

async function newPage(browser: Browser, w: number, h: number, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
  });
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

const ready3d = (page: Page): Promise<unknown> => page.waitForFunction(() => document.documentElement.dataset["proto3d"] === "pret", undefined, { timeout: 300000 });
const stats = (page: Page): Promise<NonNullable<Window["__proto3d"]> extends { stats(): infer S } ? S : never> => page.evaluate(() => (window.__proto3d as NonNullable<Window["__proto3d"]>).stats());
const frames = async (page: Page, n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await page.evaluate(() => (window.__proto3d as NonNullable<Window["__proto3d"]>).frame());
};

const server = await createServer({ server: { port: 5186, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5186/";
const browser = await chromium.launch({ executablePath });

try {
  // ——— Accès depuis le jeu : console F2 ———
  console.log("[accès] 1366×768");
  const errors: string[] = [];
  const page = await newPage(browser, 1366, 768, errors);
  await page.goto(`${url}?dossiers=0`);
  await page.waitForSelector("html[data-ready='true']", { timeout: 60000 });
  await page.keyboard.press("F2");
  const link = page.locator(".debug-console a.debug-console__lien");
  expect((await link.isVisible()) && ((await link.getAttribute("href")) ?? "").includes("proto3d"), `console F2 : lien « ${await link.innerText()} » vers ${await link.getAttribute("href")}`);
  await link.click();
  await ready3d(page);
  const renderer = await page.evaluate(() => window.__proto3d?.renderer ?? "");
  expect((await page.locator("canvas[data-moteur='three']").count()) === 1 && (await page.getAttribute("html", "data-webgl")) === "webgl2", `page /proto3d chargée, WebGL 2 : ${renderer}`);

  // ——— Réglages ———
  console.log("[réglages] 1366×768");
  for (const l of ["crepuscule", "nuit", "jour"]) {
    await page.locator(`[data-groupe="lumiere"] button[data-choix="${l}"]`).click();
    expect((await page.getAttribute("html", "data-lumiere")) === l && (await page.locator(`[data-groupe="lumiere"] button[data-choix="${l}"]`).getAttribute("aria-pressed")) === "true", `lumière « ${l} »`);
  }
  await page.locator('[data-groupe="qualite"] button[data-choix="bas"]').click();
  await frames(page, 2);
  const sBas = await stats(page);
  // 1366 × 0,75 = 1024,5 : three.js arrondit à l'entier inférieur.
  expect(!sBas.shadows && !sBas.antialias && sBas.pixelRatio === 0.75 && sBas.width === Math.floor(1366 * 0.75), `qualité basse : sans ombres, sans MSAA, résolution interne 75 % (${sBas.width}×${sBas.height})`);
  await page.locator('[data-groupe="qualite"] button[data-choix="haut"]').click();
  await frames(page, 2);
  const sHaut = await stats(page);
  expect(sHaut.shadows && sHaut.antialias && sHaut.lamps === 8 && (await page.locator("canvas[data-moteur='three']").count()) === 1, `qualité haute : ombres, MSAA (moteur recréé, un seul canevas), 8 réverbères`);
  await page.locator('[data-groupe="qualite"] button[data-choix="moyen"]').click();
  await frames(page, 2);
  const sMoy = await stats(page);
  expect(sMoy.shadows && !sMoy.antialias && sMoy.pixelRatio === 1, `qualité moyenne : ombres, sans MSAA, 100 %`);
  // Suivi d'escouade : la cible rejoint le centre de l'escouade, puis la suit pendant qu'elle se balance.
  await page.locator('[data-groupe="escouade"] button[data-choix="1"]').click();
  await page.waitForTimeout(3000);
  const v1 = await page.evaluate(() => window.__proto3d?.view());
  await page.waitForTimeout(3000);
  const v2 = await page.evaluate(() => window.__proto3d?.view());
  const dist = (a?: [number, number, number], b?: [number, number, number]): number => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : Infinity);
  expect((await page.getAttribute("html", "data-camera")) === "suivi1" && dist(v2?.target, v2?.squadCenter) < 2.5 && dist(v1?.camera, v2?.camera) > 0.2, `suivi d'escouade 1 : cible à ${dist(v2?.target, v2?.squadCenter).toFixed(2)} m du centre de l'escouade, la caméra a suivi (${dist(v1?.camera, v2?.camera).toFixed(1)} m en 3 s)`);
  await page.keyboard.press("Digit4");
  await page.waitForTimeout(500);
  expect((await page.getAttribute("html", "data-camera")) === "suivi4", "touche 4 : suivi de l'escouade 4");
  for (const c of ["titan", "dessus", "planche", "libre"]) {
    await page.locator(`[data-groupe="camera"] button[data-choix="${c}"]`).click();
    expect((await page.getAttribute("html", "data-camera")) === c, `caméra « ${c} »`);
  }
  for (const [g, pose, which] of [["titan0", "saisie", 0], ["titan1", "abattu", 1]] as const) {
    await page.locator(`[data-groupe="${g}"] button[data-choix="${pose}"]`).click();
    expect((await page.evaluate((w) => window.__proto3d?.titanPoses[w], which)) === pose, `Titan ${which === 0 ? "de 5 m" : "de 15 m"} : pose « ${pose} »`);
  }
  await page.locator('[data-groupe="soldats"] button[data-choix="vol"]').click();
  expect((await page.evaluate(() => window.__proto3d?.soldierPose)) === "vol", "soldats : pose « vol » imposée");
  await page.locator('[data-groupe="foule"] button[data-choix="non"]').click();
  expect((await page.evaluate(() => window.__proto3d?.crowd)) === false, "foule de 300 masquée puis réaffichée");
  await page.locator('[data-groupe="foule"] button[data-choix="oui"]').click();
  await page.keyboard.press("KeyL");
  expect((await page.getAttribute("html", "data-lumiere")) === "crepuscule", "touche L : lumière suivante");
  await page.goto(`${url}?proto3d&sanswebgl`);
  await page.waitForFunction(() => document.documentElement.dataset["proto3d"] === "sans-webgl");
  expect((await page.locator("[data-action='retour-2d']").count()) === 1, "repli forcé (?sanswebgl) : message et bouton de retour");
  expect(errors.length === 0, `aucune erreur de console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
  await page.close();

  // ——— CR1-07 : navigateur sans WebGL ———
  console.log("[sans WebGL] Chromium --disable-3d-apis");
  const noGl = await chromium.launch({ executablePath, args: ["--disable-3d-apis", "--disable-webgl"] });
  try {
    const errs: string[] = [];
    const p = await newPage(noGl, 1366, 768, errs);
    const requests: string[] = [];
    p.on("request", (r) => requests.push(r.url()));
    await p.goto(`${url}?proto3d`);
    await p.waitForFunction(() => document.documentElement.dataset["proto3d"] === "sans-webgl", undefined, { timeout: 60000 });
    const title = await p.locator(".p3d-repli h1").innerText();
    const back = await p.getAttribute("[data-action='retour-2d']", "href");
    const threeAsked = requests.filter((r) => /\/three(\/|\.js|\?)|deps\/three|tactical3d\/proto\.ts/.test(r));
    expect(title.length > 0 && (await p.getAttribute("html", "data-webgl")) === "absent", `message clair : « ${title} » (WebGL : ${await p.getAttribute("html", "data-webgl")})`);
    expect(threeAsked.length === 0, `three.js et le prototype jamais demandés (${requests.length} requêtes, dont ${threeAsked.length} vers three.js)`);
    await p.screenshot({ path: `${OUT}/r1-sans-webgl-1366.png` });
    expect(back !== null && !back.includes("proto3d"), `bouton « Revenir au rendu 2D » → ${back}`);
    await p.locator("[data-action='retour-2d']").click();
    await p.waitForSelector("html[data-ready='true']", { timeout: 60000 });
    expect((await p.locator("canvas").count()) > 0, "retour : le jeu en rendu 2D (Pixi) se charge sans WebGL 2 dans la page");
  } finally {
    await noGl.close();
  }

  // ——— CR1-08 : captures ———
  const SHOTS: { name: string; q: string }[] = [
    { name: "jour", q: "lumiere=jour&poses=saisie,marche&t=0.9" },
    { name: "crepuscule", q: "lumiere=crepuscule&poses=marche,saisie&t=1.7" },
    { name: "nuit", q: "lumiere=nuit&poses=marche,abattu&t=2.4" },
    { name: "titan", q: "lumiere=jour&cam=titan&poses=marche,saisie&t=0.5" },
    { name: "dessus-300", q: "lumiere=jour&cam=dessus&t=0.3" },
  ];
  for (const [w, h, tag] of [
    [1366, 768, "1366"],
    [3840, 2160, "4k"],
  ] as const) {
    console.log(`[captures] ${w}×${h}`);
    for (const s of SHOTS) {
      const errs: string[] = [];
      const p = await newPage(browser, w, h, errs);
      await p.goto(`${url}?proto3d&qualite=haut&pause&panneau=0&${s.q}`);
      await ready3d(p);
      await frames(p, 2);
      const st = await stats(p);
      // En 4K logiciel, une image coûte plusieurs secondes : on gèle le dessin, la dernière image reste à l'écran.
      await p.evaluate(() => window.__proto3d?.hold(true));
      await p.screenshot({ path: `${OUT}/r1-${s.name}-${tag}.png`, timeout: 180000 });
      expect(st.width === w && st.height === h && errs.length === 0, `r1-${s.name}-${tag}.png : ${st.width}×${st.height}, ${st.calls} appels, ${Math.round(st.triangles / 1000)} k triangles${errs.length ? ` ; erreurs : ${errs.slice(0, 2).join(" | ")}` : ""}`);
      await p.close();
    }
  }
  console.log("[captures] compléments 1366×768");
  for (const [name, q, panel] of [
    ["planche", "lumiere=jour&cam=planche&t=0.4", false],
    ["suivi", "lumiere=jour&cam=suivi4&t=1.1", false],
    ["panneau", "lumiere=crepuscule&t=0.8", true],
  ] as const) {
    const errs: string[] = [];
    const p = await newPage(browser, 1366, 768, errs);
    await p.goto(`${url}?proto3d&qualite=haut&pause&${panel ? "" : "panneau=0&"}${q}`);
    await ready3d(p);
    await frames(p, 2);
    if (panel) await p.waitForTimeout(1500);
    await p.evaluate(() => window.__proto3d?.hold(true));
    await p.screenshot({ path: `${OUT}/r1-${name}-1366.png`, timeout: 180000 });
    expect(errs.length === 0, `r1-${name}-1366.png`);
    await p.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(failures.length === 0 ? "\nsmoke:r1 : tout est OK" : `\nsmoke:r1 : ${failures.length} échec(s)`);
process.exit(failures.length === 0 ? 0 : 1);
