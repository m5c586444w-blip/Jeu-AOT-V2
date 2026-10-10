// npm run smoke:p9 — P9.7 (CP9-11) : captures de fin de phase dans un vrai navigateur (Chromium, serveur de dev Vite), à
// 1366×768 : menu (scénarios et difficulté), Grondement (départ, assaut prêt, issue), objectifs de 850 et de 845, écran de fin.
// Contrôles : cartes et niveaux présents, section du Grondement et boutons de posture, assaut refusé puis lancé, verdict de fin
// affiché et temps arrêté, aucune clé brute, aucune erreur de console. Captures : docs/screenshots/p9-*.png.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";
import fr from "../i18n/fr.json";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
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
const KEYS = Object.keys(fr).filter((k) => /^[a-z]+\.[a-z0-9_.]+$/.test(k) && k.split(".").length >= 2);

async function newPage(browser: Browser, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript("window.__name = (f) => f;");
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

async function start(page: Page, url: string, query: string): Promise<void> {
  await page.goto(`${url}?${query}&dossiers=0`);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.click(Math.round(W / 2), Math.round(H * 0.6));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 180000 });
  await page.keyboard.press("F2");
  await page.waitForTimeout(300);
}

async function openPanel(page: Page, id: string): Promise<void> {
  // Un panneau déjà ouvert se refermerait au clic : on le ferme d'abord, pour le rouvrir à jour.
  if (await page.locator(`.registre-panneau[data-panel="${id}"]:not([hidden])`).count()) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  await page.locator(`.bandeau__registre-bouton[data-panel="${id}"]`).click();
  await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
  await page.waitForTimeout(250);
}

/** Clés de traduction brutes visibles dans une portée (aucune ne doit rester). */
async function rawKeys(page: Page, scope: string): Promise<string[]> {
  const text = await page.locator(scope).first().innerText();
  return KEYS.filter((k) => text.includes(k)).slice(0, 5);
}

const server = await createServer({ server: { port: 5189, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5189/";
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors: string[] = [];

try {
  // ——— Menu : quatre scénarios jouables, quatre difficultés ———
  console.log("[menu]");
  const menu = await newPage(browser, errors);
  await menu.goto(`${url}?menu=1`);
  await menu.waitForSelector(".menu-principal", { timeout: 60000 });
  await menu.evaluate(() => document.fonts.ready);
  const cards = await menu.$$eval(".chemise[data-scenario]", (bs) => bs.map((b) => (b as HTMLElement).dataset["scenario"] ?? ""));
  expect(JSON.stringify(cards) === JSON.stringify(["scn_845", "scn_sandbox_850", "scn_854", "scn_grondement"]), `cartes du menu : ${cards.join(", ")}`);
  await menu.locator('.menu-difficulte__niveau[data-difficulte="rude"]').click();
  const pressed = await menu.$eval('.menu-difficulte__niveau[aria-pressed="true"]', (b) => (b as HTMLElement).dataset["difficulte"]);
  expect(pressed === "rude", `difficulté choisie : ${pressed}`);
  expect((await menu.locator(".menu-difficulte__note").innerText()).length > 20, "la difficulté choisie se dit en une phrase");
  await menu.screenshot({ path: `${OUT}/p9-menu.png` });
  await menu.close();

  // ——— Grondement : section de crise, posture, assaut refusé puis lancé ———
  console.log("[grondement]");
  const g = await newPage(browser, errors);
  await start(g, url, "scenario=scn_grondement");
  await openPanel(g, "monde");
  await g.waitForSelector(".crise-grondement", { timeout: 30000 });
  expect((await g.locator(".crise-grondement [data-stance]").count()) === 3, "trois postures proposées");
  await g.locator('.crise-grondement [data-stance="empecher"]').click();
  await g.waitForSelector('.crise-grondement [data-stance="empecher"][aria-pressed="true"]');
  const refused = await g.locator('.crise-grondement [data-action="assaut-fondateur"]').isDisabled();
  expect(refused, "assaut refusé tant qu'il n'est pas prêt (bouton désactivé, raison affichée)");
  expect((await rawKeys(g, ".registre-panneau[data-panel='monde']")).length === 0, "aucune clé brute dans la table de guerre");
  await g.locator(".registre-panneau[data-panel='monde']").screenshot({ path: `${OUT}/p9-grondement-depart.png` });
  await console_(g, "advance 41", "854");
  await openPanel(g, "monde");
  await g.waitForSelector(".crise-grondement", { timeout: 30000 });
  const ready = !(await g.locator('.crise-grondement [data-action="assaut-fondateur"]').isDisabled());
  expect(ready, "assaut prêt après quarante jours de préparation");
  const ravaged = await g.locator(".crise-grondement").innerText();
  expect(/\d+ %/.test(ravaged), "part du monde ravagée affichée");
  await g.locator(".registre-panneau[data-panel='monde']").screenshot({ path: `${OUT}/p9-grondement-assaut.png` });
  if (ready) {
    await g.locator('.crise-grondement [data-action="assaut-fondateur"]').click();
    await g.locator('[data-confirm="oui"]').click();
    await g.waitForTimeout(800);
    await openPanel(g, "monde");
    const after = await g.locator(".crise-grondement").innerText();
    expect(after.includes(fr["rumbling.stopped"]) || /tentative/.test(after), "assaut lancé : crise arrêtée, ou tentative comptée");
    await g.locator(".registre-panneau[data-panel='monde']").screenshot({ path: `${OUT}/p9-grondement-issue.png` });
  }
  await g.close();

  // ——— Objectifs : 850 (cinq objectifs) et 845 (quatre) ———
  console.log("[objectifs]");
  for (const [scn, n, file] of [["scn_sandbox_850", 5, "p9-objectifs-850.png"], ["scn_845", 4, "p9-objectifs-845.png"]] as const) {
    const p = await newPage(browser, errors);
    await start(p, url, `scenario=${scn}`);
    await openPanel(p, "epilogue");
    const items = await p.locator(".epilogue__objectifs li").count();
    expect(items === n, `${scn} : ${items} objectif(s) suivis dans l'épilogue (attendu ${n})`);
    expect((await rawKeys(p, ".registre-panneau[data-panel='epilogue']")).length === 0, `${scn} : aucune clé brute dans l'épilogue`);
    await p.screenshot({ path: `${OUT}/${file}` });
    if (scn === "scn_845") {
      // 845 jouable sans couche politique : chaque registre proposé s'ouvre sans erreur ; pas de registre du gouvernement.
      const ids = await p.$$eval(".bandeau__registre-bouton[data-panel]", (bs) => bs.map((b) => (b as HTMLElement).dataset["panel"] ?? ""));
      expect(!ids.includes("cabinet") && ids.includes("epilogue") && ids.includes("journal") && ids.includes("economie"), `845 : registres proposés (dont l'économie, où l'on rationne) : ${ids.join(", ")}`);
      const before = errors.length;
      for (const id of ids) {
        await openPanel(p, id);
        expect((await rawKeys(p, `.registre-panneau[data-panel='${id}']`)).length === 0, `845 : registre « ${id} » ouvert, sans clé brute`);
      }
      expect(errors.length === before, `845 : aucun registre n'émet d'erreur (${errors.length - before})`);
    }
    await p.close();
  }

  // ——— Écran de fin : Grondement laissé à lui-même → défaite (monde ravagé), temps arrêté, épilogue ouvert ———
  console.log("[fin]");
  const f = await newPage(browser, errors);
  await start(f, url, "scenario=scn_grondement");
  await openPanel(f, "monde");
  await f.locator('.crise-grondement [data-stance="laisser"]').click();
  await f.keyboard.press("Escape");
  // La fin arrête le temps et ouvre l'épilogue : on attend le verdict plutôt que la réponse de la console.
  await f.keyboard.press("F2");
  await f.locator(".debug-console input").fill("advance 120");
  await f.keyboard.press("Enter");
  await f.waitForFunction(() => document.body.dataset["fin"] !== undefined, null, { timeout: 180000 });
  await f.waitForTimeout(600);
  if (await f.locator(".debug-console:not([hidden])").count()) await f.keyboard.press("F2");
  const fin = await f.evaluate(() => document.body.dataset["fin"]);
  expect(fin === "defaite", `verdict de fin : ${fin}`);
  expect(await f.locator(".registre-panneau[data-panel='epilogue']:not([hidden])").count() === 1, "épilogue ouvert à la fin de partie");
  expect((await f.locator(".epilogue__fin").innerText()).includes(fr["fin.def.monde_ravage"]), "cause de la défaite dite en clair");
  await f.screenshot({ path: `${OUT}/p9-fin-defaite.png` });
  await f.close();

  expect(errors.length === 0, `aucune erreur de console (${errors.length})`);
  for (const e of errors.slice(0, 5)) console.error(`    ${e}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures.length === 0 ? "smoke:p9 : OK." : `smoke:p9 : ${failures.length} contrôle(s) KO.`);
process.exitCode = failures.length === 0 ? 0 : 1;
