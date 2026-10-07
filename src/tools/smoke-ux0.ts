// npm run smoke:ux0 — UX0 (E-UX-1) dans un vrai navigateur (Chromium, serveur de dev Vite), 1366×768.
// Parcourt le menu, puis chaque scénario (845, 850, 854 côté Paradis et côté Marley) : bandeau, dossier de province et
// ses onglets, chaque registre et ses onglets, options. Le texte visible (innerText) ne doit contenir aucune mention
// interne (src/ui/leaks.ts) tant que le mode auteur est coupé ; avec F10, les statuts et codes réapparaissent.
// Captures : docs/screenshots/ux0-*.png (6 écrans).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import { findLeaks } from "../ui/leaks";

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
let screens = 0;

async function check(page: Page, name: string): Promise<void> {
  screens++;
  // Texte visible, plus les bulles « pourquoi ? » portées par des éléments visibles hors mode auteur.
  const text = await page.evaluate(() => {
    const why = [...document.querySelectorAll<HTMLElement>("[data-why]")].filter((e) => e.offsetParent !== null && !e.closest(".auteur-seul")).map((e) => e.dataset["why"] ?? "");
    return `${document.body.innerText}\n${why.join("\n")}`;
  });
  const leaks = findLeaks(text);
  expect(leaks.length === 0, `${name} : aucune mention interne${leaks.length ? ` — ${leaks.slice(0, 4).map((l) => `${l.pattern} « ${l.excerpt} »`).join(" ; ")}` : ""}`);
}

async function tabs(page: Page, scope: string, name: string): Promise<void> {
  const n = await page.locator(`${scope} .registre-onglet, ${scope} .dossier__onglet`).count();
  for (let i = 0; i < n; i++) {
    const b = page.locator(`${scope} .registre-onglet, ${scope} .dossier__onglet`).nth(i);
    if ((await b.count()) === 0) break;
    const label = (await b.innerText({ timeout: 3000 })).trim();
    await b.click();
    await page.waitForTimeout(120);
    await check(page, `${name} › ${label}`);
  }
}

async function game(page: Page, url: string, query: string, tag: string, shots: boolean): Promise<void> {
  await page.goto(`${url}?${query}`);
  await page.waitForSelector("html[data-ready='true'] .bandeau", { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // Dossiers d'événements ouverts d'eux-mêmes au départ : contrôlés, puis refermés.
  for (let i = 0; i < 4 && (await page.locator(".dossier-evenement:not([hidden])").count()); i++) {
    await check(page, `${tag} · dossier d'événement`);
    if (shots && i === 0) await page.screenshot({ path: `${OUT}/ux0-evenement.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  await check(page, `${tag} · bandeau et carte`);
  if (shots) await page.screenshot({ path: `${OUT}/ux0-hud.png` });
  const box = await page.locator(".carte canvas").first().boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + box.height * 0.235);
    if (await page.locator(".dossier:visible").count().then((n) => n > 0, () => false)) {
      await check(page, `${tag} · dossier de province`);
      if (shots) await page.screenshot({ path: `${OUT}/ux0-dossier-province.png` });
      await tabs(page, ".dossier", `${tag} · dossier de province`);
      await page.keyboard.press("Escape");
    }
  }
  const panels = await page.$$eval(".bandeau__registre-bouton", (bs) => bs.filter((b) => (b as HTMLElement).offsetParent !== null).map((b) => (b as HTMLElement).dataset["panel"] ?? ""));
  for (const id of panels) {
    await page.locator(`.bandeau__registre-bouton[data-panel="${id}"]`).click();
    await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
    await page.waitForTimeout(150);
    await check(page, `${tag} · registre ${id}`);
    await tabs(page, `.registre-panneau[data-panel="${id}"]`, `${tag} · registre ${id}`);
    if (shots && (id === "recherche" || id === "archives" || id === "chronique")) {
      await page.locator(`.registre-panneau[data-panel="${id}"] .registre-onglet`).first().click().catch(() => undefined);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT}/ux0-${id}.png` });
    }
  }
  await page.keyboard.press("F9");
  await page.waitForTimeout(150);
  await check(page, `${tag} · options`);
  await page.keyboard.press("F9");
}

const server = await createServer({ server: { port: 5191, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5191/";
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript("window.__name = (f) => f;");
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${url}?menu=1`);
  await page.waitForSelector(".table-archives", { timeout: 60000 });
  await check(page, "menu principal");
  await page.screenshot({ path: `${OUT}/ux0-menu.png` });

  await game(page, url, "scenario=scn_sandbox_845", "845", false);
  await game(page, url, "scenario=scn_sandbox_850", "850", true);
  await game(page, url, "scenario=scn_854&faction=fac_paradis&dossiers=0", "854 Paradis", false);
  await game(page, url, "scenario=scn_854&faction=fac_marley&dossiers=0", "854 Marley", false);

  // CUX0-03 : F10 fait apparaître statuts et codes (recherche), F10 les retire ; le choix est retenu.
  await page.goto(`${url}?scenario=scn_sandbox_850&dossiers=0`);
  await page.waitForSelector("html[data-ready='true'] .bandeau", { timeout: 120000 });
  await page.locator('.bandeau__registre-bouton[data-panel="recherche"]').click();
  await page.waitForSelector('.registre-panneau[data-panel="recherche"]:not([hidden])');
  const visibleAuthor = (): Promise<number> => page.$$eval(".auteur-seul", (es) => es.filter((e) => (e as HTMLElement).offsetParent !== null).length);
  const before = await visibleAuthor();
  const sheetsBefore = await page.locator(".planche").count();
  await page.keyboard.press("F10");
  await page.waitForTimeout(200);
  const after = await visibleAuthor();
  const sheetsAfter = await page.locator(".planche").count();
  const text = await page.evaluate(() => document.body.innerText);
  expect(before === 0 && after > 0 && findLeaks(text).length > 0, `F10 : mentions auteur visibles ${before} → ${after} (statuts, codes, années) ; planches ${sheetsBefore} → ${sheetsAfter}`);
  await page.screenshot({ path: `${OUT}/ux0-recherche-mode-auteur.png` });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("murs-et-sang:preferences") ?? "{}") as { authorMode?: boolean });
  await page.keyboard.press("F10");
  await page.waitForTimeout(200);
  expect(saved.authorMode === true && (await visibleAuthor()) === 0, "F10 de nouveau : mentions masquées ; préférence enregistrée");
  expect(errors.length === 0, `aucune erreur de page${errors.length ? ` — ${errors.slice(0, 3).join(" | ")}` : ""}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(`${screens} écrans contrôlés ; ${failures.length} échec(s).`);
process.exit(failures.length ? 1 : 0);
