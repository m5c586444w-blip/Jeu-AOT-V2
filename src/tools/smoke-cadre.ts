// npm run smoke:cadre — C1 (ERRATA_V3 §3) : le cadre d'interface unique (barre supérieure, alertes, menu de gestion, fil de notifications,
// bouton de réduction) est présent et non recouvert dans chaque mode, en 1366 × 768 et 3840 × 2160, dans un vrai navigateur (Chromium,
// serveur de dev Vite). Modes : carte, conseil, bataille (temps réel, depuis les expéditions), bataille cadre réduit puis réaffiché,
// options, tutoriel. Le mode « lieux » (route `?proto3d`, sans partie) n'est PAS intégré au cadre : il est vérifié pour être signalé
// comme tel (dette), pas pour passer. Captures : docs/screenshots/c1-*.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const failures: string[] = [];
const ok = (label: string): void => console.log(`  OK  ${label}`);
const ko = (label: string): void => {
  failures.push(label);
  console.error(`  KO  ${label}`);
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

interface FrameItem {
  selector: string;
  present: boolean;
  visible: boolean;
  covered: boolean;
  rect: [number, number, number, number];
}
interface FrameReport {
  reduced: boolean;
  items: FrameItem[];
  restore: { present: boolean; visible: boolean; covered: boolean };
}

/** Mesure dans la page : présence, visibilité (taille non nulle, dans la fenêtre) et recouvrement (élément au centre et aux quatre coins intérieurs). */
async function frame(page: Page): Promise<FrameReport> {
  return page.evaluate(() => {
    const measure = (selector: string): FrameItem => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return { selector, present: false, visible: false, covered: false, rect: [0, 0, 0, 0] };
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible = !el.hidden && style.display !== "none" && style.visibility !== "hidden" && r.width > 4 && r.height > 4 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      let covered = false;
      if (visible) {
        const pts: [number, number][] = [
          [r.left + r.width / 2, r.top + r.height / 2],
          [r.left + 3, r.top + 3],
          [r.right - 3, r.top + 3],
          [r.left + 3, r.bottom - 3],
          [r.right - 3, r.bottom - 3],
        ];
        covered = pts.some(([x, y]) => {
          if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
          const hit = document.elementFromPoint(x, y);
          return !hit || !(el === hit || el.contains(hit));
        });
      }
      return { selector, present: true, visible, covered, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
    };
    const restore = measure('[data-action="cadre"]');
    return {
      reduced: document.documentElement.dataset["cadre"] === "reduit",
      items: [".bandeau", ".bandeau__alerte", ".gestion", ".notifications"].map(measure),
      restore: { present: restore.present, visible: restore.visible, covered: restore.covered },
    };
  });
}

/** Éléments qui peuvent légitimement manquer : le fil sans nouvelle (masqué par lui-même), et, cadre réduit, les parties réduites. */
const REDUCIBLE = new Set([".bandeau__alerte", ".gestion"]);

/** Vrai quand le fil de notifications a des entrées : il doit alors être visible et non recouvert dans tous les modes. */
let feedFilled = false;

function judge(label: string, r: FrameReport): void {
  const problems: string[] = [];
  if (!r.restore.present || !r.restore.visible || r.restore.covered) problems.push("bouton de réduction/réaffichage absent, caché ou recouvert");
  for (const it of r.items) {
    if (it.selector === ".notifications" && it.present && !it.visible && !feedFilled) continue; // fil sans nouvelle : masqué par lui-même
    if (r.reduced && REDUCIBLE.has(it.selector) && !it.visible) continue; // réduit par le bouton explicite
    if (!it.present) problems.push(`${it.selector} absent`);
    else if (!it.visible) problems.push(`${it.selector} masqué`);
    else if (it.covered) problems.push(`${it.selector} recouvert`);
  }
  if (problems.length) ko(`${label} : ${problems.join(" ; ")}`);
  else ok(`${label} : cadre complet${r.reduced ? " (réduit par le bouton, réaffichable)" : ""} — ${r.items.map((i) => `${i.selector} ${i.rect.join("×")}`).join(" | ")}`);
}

async function shot(page: Page, name: string, size: string): Promise<void> {
  if (size === "3840") await page.screenshot({ path: `${OUT}/c1-${name}-${size}.jpg`, type: "jpeg", quality: 55 });
  else await page.screenshot({ path: `${OUT}/c1-${name}-${size}.png` });
}

async function check(page: Page, name: string, size: string, label: string): Promise<void> {
  await page.waitForTimeout(450);
  judge(`${label} (${size})`, await frame(page));
  await shot(page, name, size);
}

async function boot(browser: Browser, url: string, w: number, h: number, query: string, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript("window.__name = (f) => f;"); // tsx (esbuild) injecte `__name` dans les fonctions évaluées dans la page
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${w}: ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${w}: pageerror: ${e.message}`));
  await page.goto(`${url}${query}`);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.waitForTimeout(600);
  return page;
}

/** Fait avancer le temps jusqu'à la première notification, puis met en pause : le fil n'est plus vide. */
async function fillFeed(page: Page): Promise<void> {
  await page.keyboard.press("Digit5");
  const got = await page.waitForSelector(".notifications:not([hidden]) .notification", { timeout: 90000 }).then(() => true).catch(() => false);
  await page.keyboard.press("Space");
  feedFilled = got;
  if (!got) ko("fil de notifications resté vide : sa visibilité ne peut pas être prouvée");
  console.log(got ? "  --  fil de notifications rempli : sa présence est exigée dans tous les modes" : "  --  fil resté vide : sa visibilité n'est PAS vérifiée (limite)");
}

/** Bascule un registre par son bouton du menu de gestion et attend son état. */
async function togglePanel(page: Page, id: string, open: boolean): Promise<void> {
  const sel = `.registre-panneau[data-panel="${id}"]`;
  const isOpen = (await page.locator(`${sel}:not([hidden])`).count()) > 0;
  if (isOpen !== open) await page.locator(`[data-panel="${id}"]`).first().click();
  if (open) await page.waitForSelector(`${sel}:not([hidden])`, { timeout: 30000 });
  else await page.waitForFunction((s) => !document.querySelector(`${s}:not([hidden])`), sel, { timeout: 30000 });
}

/** Bataille de compagnie (temps réel) depuis le registre des expéditions. */
async function openBattle(page: Page): Promise<void> {
  if (!(await page.locator('.registre-panneau[data-panel="expeditions"]:not([hidden])').count())) await page.keyboard.press("KeyE");
  await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
  await page.selectOption('select[data-trial="map"]', "tmap_ville");
  await page.selectOption('select[data-trial="type"]', "ttype_grand_errant");
  await page.fill('input[data-trial="count"]', "2");
  await page.fill('input[data-trial="men"]', "24");
  await page.fill('input[data-trial="enemy"]', "0");
  await page.locator('[data-action="essai-compagnie"]').click();
  await page.waitForSelector(".bataille--rt", { timeout: 90000 });
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["frames"] ?? "0") >= 2, undefined, { timeout: 240000 });
  await togglePanel(page, "expeditions", false); // le registre des expéditions reste ouvert derrière la bataille : on le referme
}

async function closeBattle(page: Page): Promise<void> {
  await page.locator('.bataille [data-action="quitter"]').click();
  await page.waitForFunction(() => !document.querySelector(".bataille") && !document.body.dataset["tactique"], undefined, { timeout: 120000 });
}

const server = await createServer({ server: { port: 5190, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5190/";
const browser = await chromium.launch({ executablePath });
const errors: string[] = [];

try {
  for (const [w, h] of [
    [1366, 768],
    [3840, 2160],
  ] as const) {
    const size = String(w);
    console.log(`[cadre] ${w}×${h}`);
    // Pas d'ouverture automatique des dossiers d'événements : ils couvriraient les modes testés (ils ont leur propre vérification).
    const page = await boot(browser, url, w, h, "?dossiers=0", errors);

    await fillFeed(page);
    await check(page, "carte", size, "carte");

    // Conseil (registre) : fenêtre entre les deux barres.
    await togglePanel(page, "conseil", true);
    await check(page, "conseil", size, "conseil");
    await togglePanel(page, "conseil", false);

    // Options.
    await page.keyboard.press("F9");
    await page.waitForSelector(".options:not([hidden])");
    await check(page, "options", size, "options");
    await page.keyboard.press("F9");
    await page.waitForSelector(".options", { state: "hidden" });

    // Bataille temps réel : le cadre reste présent et non recouvert.
    await openBattle(page);
    await check(page, "bataille", size, "bataille");
    // Aucun bouton de la bataille (ordres, vitesses, fermer) ne doit être recouvert par le cadre (fil de notifications compris).
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".bataille button")]
        .filter((b) => b.offsetParent !== null)
        .filter((b) => {
          const r = b.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= window.innerHeight) return false;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && !b.contains(hit) && !hit.contains(b);
        })
        .map((b) => (b.textContent ?? "").trim().slice(0, 24)),
    );
    if (hidden.length) ko(`bataille (${size}) : boutons recouverts : ${hidden.join(", ")}`);
    else ok(`bataille (${size}) : aucun bouton de la bataille n'est recouvert par le cadre`);

    // Le menu de gestion fonctionne pendant la bataille : un registre s'ouvre au-dessus d'elle.
    await togglePanel(page, "chronique", true);
    const reg = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>(".registre-panneau:not([hidden])");
      if (!p) return false;
      const r = p.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 40);
      return !!hit && p.contains(hit);
    });
    if (reg) ok(`bataille (${size}) : un registre ouvert par le menu de gestion s'affiche au-dessus de la bataille`);
    else ko(`bataille (${size}) : le registre ouvert pendant la bataille est recouvert`);
    await check(page, "bataille-registre", size, "bataille + registre");
    await togglePanel(page, "chronique", false);

    // Réduction explicite du cadre, puis réaffichage.
    await page.locator('[data-action="cadre"]').click();
    await check(page, "bataille-reduit", size, "bataille, cadre réduit");
    await page.locator('[data-action="cadre"]').click();
    await check(page, "bataille-reaffiche", size, "bataille, cadre réaffiché");
    await closeBattle(page);
    await check(page, "retour-carte", size, "retour sur la carte");
    await page.close();

    // Tutoriel : nouvelle partie accompagnée.
    feedFilled = false;
    const tuto = await boot(browser, url, w, h, "?scenario=scn_sandbox_850&tutoriel=1", errors);
    await tuto.waitForSelector(".tuto", { timeout: 30000 });
    await check(tuto, "tutoriel", size, "tutoriel");
    await tuto.close();
  }

  // Lieux (route `?proto3d`) : hors cadre tant que C15 ne les intègre pas à la partie ; consigné, non compté comme réussite.
  const lieux = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await lieux.addInitScript("window.__name = (f) => f;");
  await lieux.goto(`${url}?proto3d`);
  await lieux.waitForTimeout(2500);
  const lf = await frame(lieux);
  const missing = lf.items.filter((i) => !i.present).map((i) => i.selector);
  console.log(`  --  lieux (route ?proto3d, hors partie) : cadre ${missing.length ? `ABSENT (${missing.join(", ")})` : "présent"} — dette connue, intégration prévue avec C15 (docs/reports/dette.md)`);
  await lieux.close();
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  console.error(`Erreurs navigateur (${errors.length}) :\n${errors.slice(0, 8).join("\n")}`);
  failures.push("erreurs de console");
}
if (failures.length) {
  console.error(`\nsmoke:cadre — ${failures.length} échec(s)`);
  process.exit(1);
}
console.log("\nsmoke:cadre — tous les modes testés présentent le cadre complet");
