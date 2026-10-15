// npm run smoke:bataille — C9 : parcours carte → rencontre → bataille (temps réel) → bilan → retour à la carte, dans un vrai navigateur
// (Chromium, serveur de dev Vite) + captures docs/screenshots/c9-*. Le cadre d'interface (C1) doit rester présent à chaque étape ;
// en 1366×768. Débit réel (GPU) : « à vérifier » sur le PC de Gabriel (rendu logiciel ici).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import fr from "../i18n/fr.json";

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
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

async function audit(page: Page, scope: string, label: string): Promise<void> {
  const unexplained = await page.$$eval(`${scope} .valeur`, (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(`${scope} .valeur`).count();
  const visible = await page.locator(scope).innerText();
  const raw = [...Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k)), ...(visible.match(/\b(tac|battle|army|armies|narr|art|mun|rgt|ship|sea)\.[a-z_]+(\.[a-z_]+)*/g) ?? [])];
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|rap|shifter|ttype|tmap|wprov|fac|form|army|flt|rgt|art|mun|ship|sea|enc)_[a-z0-9_]+/g) ?? [])];
  expect(unexplained === 0 && raw.length === 0 && ids.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé ni identifiant brut${raw.length || ids.length ? ` (${[...raw, ...ids].slice(0, 5).join(", ")})` : ""}`);
}

async function consoleLine(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 300000 });
  await page.keyboard.press("F2");
}

/** Ouvre un registre par sa touche s'il n'est pas déjà ouvert (la touche le refermerait). */
async function panel(page: Page, key: string, id: string): Promise<void> {
  if ((await page.locator(`.registre-panneau[data-panel="${id}"]:not([hidden])`).count()) === 0) await page.keyboard.press(key);
  await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
}

async function open(page: Page, url: string, errors: string[]): Promise<void> {
  await page.addInitScript("window.__name = (f) => f;");
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.waitForTimeout(800);
}

const server = await createServer({ server: { port: 5187, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5187/";
const browser = await chromium.launch({ executablePath });
const errors: string[] = [];

/** Le cadre unique : barre supérieure et menu de gestion visibles et dans la fenêtre (C1). */
async function frame(page: Page, label: string): Promise<void> {
  const r = await page.evaluate(() => {
    const m = (sel: string): { ok: boolean; top: number; bottom: number } => {
      const e = document.querySelector(sel) as HTMLElement | null;
      if (!e) return { ok: false, top: 0, bottom: 0 };
      const b = e.getBoundingClientRect();
      return { ok: b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden", top: b.top, bottom: b.bottom };
    };
    return { bandeau: m(".bandeau"), gestion: m(".gestion"), h: window.innerHeight };
  });
  expect(r.bandeau.ok && r.gestion.ok && r.bandeau.top >= 0 && r.gestion.bottom <= r.h + 1, `${label} : cadre présent (barre supérieure et menu de gestion dans la fenêtre)`);
}

try {
  console.log("[854, Paradis] 1366×768");
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(page, `${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`, errors);
  await frame(page, "carte");
  await page.screenshot({ path: `${OUT}/c9-carte.png` });

  // Guerre contre Marley, interception en marche forcée jusqu'au contact.
  await panel(page, "KeyD", "diplomatie");
  await page.locator('.fiche-nation[data-nation="fac_marley"]').click();
  await page.locator('[data-action="guerre"]').click();
  await page.locator('[data-confirm="oui"]').click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await consoleLine(page, "advance 5", "5");
  await panel(page, "KeyS", "armees");
  await page.locator('.registre-panneau [data-army="army_854_sud"]').click();
  await page.waitForTimeout(200);
  const targets = await page.locator('select[data-target="army_854_sud"] option').count();
  expect(targets >= 1, `ennemi en vue à intercepter : ${targets}`);
  await page.locator('[data-action="intercepter"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-action="forcee"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  let contact = false;
  for (let i = 0; i < 16 && !contact; i++) {
    await consoleLine(page, "advance 10", "10");
    contact = (await page.locator(".armee__rencontre").count()) > 0;
  }
  expect(contact, "contact : la rencontre s'affiche dans le registre des armées");
  await frame(page, "rencontre");
  await page.screenshot({ path: `${OUT}/c9-rencontre.png` });

  // Bataille.
  await page.locator('.armee__rencontre [data-action="jouer"]').click();
  await page.waitForSelector("body[data-tactique='1']", { timeout: 60000 });
  await page.locator('[data-speed="2"]').click();
  await page.waitForTimeout(8000);
  await frame(page, "bataille");
  const inBattle = await page.evaluate(() => {
    const e = document.querySelector(".bataille") as HTMLElement | null;
    if (!e) return false;
    const b = e.getBoundingClientRect();
    const band = (document.querySelector(".bandeau") as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
    const man = (document.querySelector(".gestion") as HTMLElement | null)?.getBoundingClientRect().top ?? window.innerHeight;
    return b.top >= band - 1 && b.bottom <= man + 1;
  });
  expect(inBattle, "bataille bornée entre la barre supérieure et le menu de gestion");
  await page.screenshot({ path: `${OUT}/c9-bataille.png` });

  // Bilan, validation, retour à la carte avec rencontre résolue.
  await page.locator('[data-action="quitter"]').click();
  await page.waitForSelector(".bilan", { timeout: 120000 });
  await frame(page, "bilan");
  await audit(page, ".bilan", "bilan de bataille");
  await page.screenshot({ path: `${OUT}/c9-bilan.png` });
  await page.locator('.bilan [data-action="valider"]').click();
  await page.waitForTimeout(800);
  // Le registre est fermé pendant la bataille : on le rouvre (touche S) et la rencontre ne doit plus y figurer.
  await panel(page, "KeyS", "armees");
  expect((await page.locator(".armee__rencontre:visible").count()) === 0, "rencontre résolue après la bataille (ordres rejoués par la simulation) : absente du registre rouvert");
  await page.keyboard.press("Escape");
  expect((await page.locator("body[data-tactique='1']").count()) === 0 && (await page.locator(".carte__toile").count()) === 1, "retour à la carte (bataille fermée)");
  await frame(page, "retour carte");
  await page.screenshot({ path: `${OUT}/c9-retour.png` });
  await page.close();

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:bataille : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:bataille : tout est conforme.");
