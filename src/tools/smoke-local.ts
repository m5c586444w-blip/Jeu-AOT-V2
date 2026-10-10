// npm run build && npm run smoke:local — P10.5 (CP10-06) : le build statique (`dist/`) se joue en local, sans réseau.
// Le build est servi par `vite preview` (comme `npm run jouer`) ; Chromium refuse toute requête hors de l'ordinateur et la note.
// Contrôles : aucune ressource externe dans dist/index.html et les feuilles de style ; menu, partie de 850 (temps, sauvegarde et
// rechargement par la console), manuel (F1), options d'accessibilité, scène tactique 3D chargée à la demande ; aucune requête
// sortante, aucun fichier manquant, aucune erreur de page. Captures P10 (1366×768) : docs/screenshots/p10-*.png.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { preview } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const DIST = "dist";
const OUT = "docs/screenshots";
const W = 1366;
const H = 768;
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

if (!existsSync(join(DIST, "index.html"))) {
  console.error("smoke:local : dist/index.html absent — lancer d'abord `npm run build`.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// ——— Contrôle statique : rien n'est chargé depuis un autre ordinateur ———
console.log("[build statique]");
const html = readFileSync(join(DIST, "index.html"), "utf8");
const externalAttr = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+/g)].map((m) => m[0]);
expect(externalAttr.length === 0, `index.html : aucune ressource externe (${externalAttr.join(", ") || "aucune"})`);
const cssFiles = readdirSync(join(DIST, "assets")).filter((f) => f.endsWith(".css"));
const cssExternal = cssFiles.filter((f) => /url\(\s*["']?(https?:)?\/\//.test(readFileSync(join(DIST, "assets", f), "utf8")) || /@import\s+url\(\s*["']?https?:/.test(readFileSync(join(DIST, "assets", f), "utf8")));
expect(cssExternal.length === 0, `feuilles de style : aucune police ni image distante (${cssFiles.length} fichier(s))`);

const server = await preview({ build: { outDir: DIST }, preview: { port: 4317, strictPort: false, host: "127.0.0.1" }, logLevel: "error" });
const url = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:4317/";
const browser: Browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const outgoing: string[] = [];
const missing: string[] = [];
const errors: string[] = [];

async function newPage(): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  // Hors réseau : seule la machine locale répond ; toute autre requête est refusée et comptée.
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === "data:" || u.protocol === "blob:" || u.hostname === "127.0.0.1" || u.hostname === "localhost") return route.continue();
    outgoing.push(u.href);
    return route.abort("internetdisconnected");
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    if (!outgoing.includes(r.url())) missing.push(`échec ${r.url()} (${r.failure()?.errorText ?? "?"})`);
  });
  return page;
}

async function consoleLine(page: Page, line: string, expectText: string): Promise<boolean> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  const ok = await page
    .waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  await page.keyboard.press("F2");
  await page.waitForTimeout(250);
  return ok;
}

try {
  // ——— Menu principal : scénarios, difficulté personnalisée ———
  console.log("[menu]");
  const menu = await newPage();
  await menu.goto(`${url}?menu=1`);
  await menu.waitForSelector(".menu-principal");
  await menu.evaluate(() => document.fonts.ready);
  await menu.locator('.menu-entree[data-entree="nouvelle"]').click();
  expect((await menu.locator(".menu-scenarios .chemise").count()) >= 4, "menu : quatre scénarios au moins");
  await menu.locator('.menu-difficulte__niveau[data-difficulte="personnalise"]').click();
  await menu.locator('input[data-perso="titans"]').fill("1.3");
  await menu.locator('input[data-perso="titans"]').dispatchEvent("input");
  await menu.waitForTimeout(300);
  expect(await menu.locator(".menu-difficulte__fine").isVisible(), "menu : réglages fins de la difficulté personnalisée");
  await menu.screenshot({ path: `${OUT}/p10-menu-personnalise.png` });
  // Manuel depuis le menu.
  await menu.locator('.menu-entree[data-entree="manuel"]').click();
  expect(await menu.locator(".manuel").isVisible(), "menu : entrée « Manuel » ouvre le manuel");
  await menu.keyboard.press("Escape");
  await menu.close();

  // ——— Partie de 850 : temps, sauvegarde, rechargement, manuel, accessibilité ———
  console.log("[partie 850]");
  const game = await newPage();
  await game.goto(`${url}?scenario=scn_sandbox_850&dossiers=0`);
  await game.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await game.evaluate(() => document.fonts.ready);
  await game.mouse.click(Math.round(W / 2), Math.round(H * 0.6));
  await game.keyboard.press("Escape");
  expect(await consoleLine(game, "advance 30", "+30 jours"), "partie : le temps avance (console « advance 30 »)");
  expect(await consoleLine(game, "save local", "sauvegardé dans « local »"), "partie : sauvegarde dans un créneau (IndexedDB du navigateur)");
  expect(await consoleLine(game, "load local", "« local » rechargé"), "partie : rechargement du créneau");
  await game.keyboard.press("F1");
  await game.waitForSelector(".manuel:not([hidden])");
  await game.locator('.manuel__onglet[data-section="registres"]').click();
  await game.waitForTimeout(250);
  expect((await game.locator(".manuel .options__touches tr").count()) >= 10, "manuel (F1) : registres et touches listés");
  await game.screenshot({ path: `${OUT}/p10-manuel.png` });
  await game.keyboard.press("Escape");
  expect(await game.locator(".manuel").isHidden(), "manuel : Échap le ferme");
  await game.keyboard.press("F9");
  await game.waitForSelector(".options:not([hidden])");
  for (const k of ["colorblind", "readingAid"]) await game.locator(`.options__acces input[data-setting="${k}"]`).check();
  await game.waitForTimeout(300);
  const attrs = await game.evaluate(() => [document.documentElement.dataset["daltonien"], document.documentElement.dataset["lecture"]]);
  expect(attrs[0] === "1" && attrs[1] === "aide", `options : palette pour daltoniens et aide à la lecture appliquées (${attrs.join(", ")})`);
  await game.locator(".options__acces").scrollIntoViewIfNeeded();
  await game.screenshot({ path: `${OUT}/p10-options-accessibilite.png` });
  await game.close();

  // ——— 854 avec la palette pour daltoniens (préférences gardées dans le navigateur) ———
  console.log("[854, palette pour daltoniens]");
  const world = await newPage();
  await world.addInitScript(() => localStorage.setItem("murs-et-sang:preferences", JSON.stringify({ colorblind: true })));
  await world.goto(`${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`);
  await world.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await world.mouse.click(Math.round(W / 2), Math.round(H * 0.6));
  await world.keyboard.press("Escape");
  await world.keyboard.press("KeyW");
  await world.waitForSelector('.registre-panneau[data-panel="monde"]:not([hidden])', { timeout: 30000 });
  await world.waitForTimeout(800);
  expect((await world.evaluate(() => document.documentElement.dataset["daltonien"])) === "1", "854 : préférence daltonien relue au lancement");
  await world.screenshot({ path: `${OUT}/p10-daltonien-monde.png` });
  await world.close();

  // ——— Scène tactique 3D, chargée à la demande depuis le build ———
  console.log("[scène tactique 3D]");
  const t3d = await newPage();
  const t0 = Date.now();
  await t3d.goto(`${url}?proto3d&qualite=bas`);
  const ready = await t3d
    .waitForFunction(() => ["pret", "sans-webgl"].includes(document.documentElement.dataset["proto3d"] ?? ""), undefined, { timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  const state = await t3d.evaluate(() => document.documentElement.dataset["proto3d"] ?? "");
  expect(ready && state === "pret", `scène 3D : « prêt » hors réseau (${state}, ${((Date.now() - t0) / 1000).toFixed(1)} s, rendu logiciel)`);
  await t3d.close();
} finally {
  await browser.close();
  await new Promise<void>((res) => server.httpServer.close(() => res()));
}

console.log("[réseau et erreurs]");
expect(outgoing.length === 0, `aucune requête sortante (${outgoing.length}${outgoing.length ? ` : ${outgoing.slice(0, 3).join(", ")}` : ""})`);
expect(missing.length === 0, `aucun fichier manquant (${missing.length}${missing.length ? ` : ${missing.slice(0, 3).join(", ")}` : ""})`);
expect(errors.length === 0, `aucune erreur de page (${errors.length}${errors.length ? ` : ${errors.slice(0, 3).join(" | ")}` : ""})`);
console.log(failures.length === 0 ? "smoke:local : OK" : `smoke:local : ${failures.length} échec(s)`);
process.exitCode = failures.length === 0 ? 0 : 1;
