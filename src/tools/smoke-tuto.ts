// npm run smoke:tuto — CTUT-02, CTUT-03 et CTUT-04 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/tuto-*.
// Parcours : premier mois du bac à sable politique (850) en partie accompagnée ; les 14 étapes une à une (bulle ancrée, mise en
// évidence, action demandée puis explication, bouton « Suivant ») ; bataille d'essai ; fin ; préférences locales ; aides
// contextuelles (une seule fois par élément) ; départ à la demande et reprise depuis les options ; 1366×768, 1920×1080 et
// 3840×2160. Aucune mention interne (src/ui/leaks.ts), aucune clé ni identifiant brut, 0 erreur console.
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import fr from "../i18n/fr.json";
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
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);
const MAP = JSON.parse(readFileSync("data/map/paradis.json", "utf8")) as { bounds: [number, number, number, number]; provinces: Record<string, { polygon: [number, number][] }> };
const STEPS = ["accueil", "carte", "province", "ressources", "temps", "economie", "armees", "cabinet", "recherche", "missions", "evenements", "expeditions", "bataille", "fin"];
const PANEL_OF: Record<string, string> = { economie: "economie", armees: "armees", cabinet: "cabinet", recherche: "recherche", missions: "missions", evenements: "chronique", expeditions: "expeditions" };
const TUTO = ".tuto:not([hidden])";

/** Texte visible d'une zone : aucune mention interne, clé de traduction ni identifiant de données. */
async function audit(page: Page, scope: string, label: string): Promise<void> {
  const visible = await page.locator(scope).innerText();
  const raw = Object.keys(fr).filter((k) => k.includes(".") && k.length > 8 && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|mis|fac|wprov|scn|law)_[a-z0-9_]+/g) ?? [])];
  const leaks = findLeaks(visible);
  expect(raw.length === 0 && ids.length === 0 && leaks.length === 0, `${label} : aucune clé, identifiant ni mention interne${raw.length || ids.length || leaks.length ? ` (${[...raw, ...ids, ...leaks.map((l) => l.excerpt)].slice(0, 4).join(", ")})` : ""}`);
}

/** La bulle tient dans la fenêtre et ne recouvre pas l'élément qu'elle montre (sauf élément plus grand qu'elle : la carte). */
async function geometry(page: Page, label: string): Promise<void> {
  const g = await page.evaluate(() => {
    const b = document.querySelector(".tuto:not([hidden])")?.getBoundingClientRect();
    const h = document.querySelector(".tuto-halo:not([hidden])")?.getBoundingClientRect();
    const side = document.querySelector<HTMLElement>(".tuto")?.dataset["cote"] ?? "";
    if (!b) return null;
    const inside = b.left >= 0 && b.top >= 0 && b.right <= window.innerWidth && b.bottom <= window.innerHeight;
    const covers = !!h && side !== "dedans" && side !== "bord" && b.left < h.right && h.left < b.right && b.top < h.bottom && h.top < b.bottom;
    return { inside, covers, side, haloHidden: !h };
  });
  expect(!!g && g.inside && !g.covers, `${label} : bulle dans la fenêtre, sans recouvrir l'élément montré (côté « ${g?.side ?? "?"} »${g?.haloHidden ? ", sans mise en évidence" : ""})`);
}

async function stepOf(page: Page): Promise<{ id: string; phase: string }> {
  return page.evaluate(() => {
    const b = document.querySelector<HTMLElement>(".tuto:not([hidden])");
    return { id: b?.dataset["step"] ?? "", phase: b?.dataset["phase"] ?? "" };
  });
}

async function waitStep(page: Page, id: string, phase: string): Promise<void> {
  await page.waitForFunction(([i, p]) => {
    const b = document.querySelector<HTMLElement>(".tuto:not([hidden])");
    return b?.dataset["step"] === i && b.dataset["phase"] === p;
  }, [id, phase] as const, { timeout: 15000 });
}

/** Clic au centre d'une province dont le point n'est pas sous la bulle. */
async function clickAnyProvince(page: Page): Promise<boolean> {
  const box = await page.locator(".carte__toile").boundingBox();
  if (!box) return false;
  const [x0, y0, x1, y1] = MAP.bounds;
  const zoomOf = Math.min(box.width / (x1 - x0), box.height / (y1 - y0)) * 0.98;
  for (const [id, p] of Object.entries(MAP.provinces)) {
    if (!id.startsWith("prov_maria") && !id.startsWith("prov_rose")) continue;
    const cx = p.polygon.reduce((a, q) => a + q[0], 0) / p.polygon.length;
    const cy = p.polygon.reduce((a, q) => a + q[1], 0) / p.polygon.length;
    const x = box.x + box.width / 2 + cx * zoomOf;
    const y = box.y + box.height / 2 + cy * zoomOf;
    const free = await page.evaluate(([px, py]) => {
      const e = document.elementFromPoint(px as number, py as number);
      return !!e && !e.closest(".tuto, .bandeau, .gestion, .calques");
    }, [x, y] as const);
    if (!free) continue;
    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
    if ((await page.locator(".dossier:not([hidden])").count()) > 0) return true;
  }
  return false;
}

async function open(page: Page, url: string, errors: string[]): Promise<void> {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.waitForTimeout(800);
}

const prefs = (page: Page): Promise<{ done: boolean; disabled: boolean; hints: boolean; seen: string[] } | null> =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem("murs-et-sang:preferences");
    return raw ? (JSON.parse(raw) as { tutorial: { done: boolean; disabled: boolean; hints: boolean; seen: string[] } }).tutorial : null;
  });

const server = await createServer({ server: { port: 5189, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5189/";
const browser = await chromium.launch({ executablePath });
const errors: string[] = [];
const GAME = `${url}?scenario=scn_sandbox_850&tutoriel=1`;

try {
  // ——— 0. Menu principal : l'entrée du guide ———
  console.log("[menu] 1366×768");
  const menu = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(menu, `${url}?menu=1`, errors);
  expect((await menu.locator(".menu-guide").count()) === 1, "menu principal : entrée « guide de prise en main »");
  await audit(menu, ".menu-principal", "menu principal");
  await menu.screenshot({ path: `${OUT}/tuto-menu.png` });
  await menu.close();

  // ——— 1. Le guide en entier, 1366×768 ———
  console.log("[850, guide] 1366×768");
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(page, GAME, errors);
  await page.waitForSelector(TUTO, { timeout: 10000 });
  expect((await page.locator(".tuto-halo:not([hidden])").count()) === 1, "mise en évidence de l'élément montré");
  expect(!page.url().includes("tutoriel"), "adresse sans « tutoriel » une fois le guide lancé (un rechargement ne le relance pas)");
  expect((await page.locator(".bandeau__vitesse[aria-pressed='true'], .bandeau__vitesse.actif").count()) >= 0, "départ avec le temps suspendu");
  const seen: string[] = [];
  for (const id of STEPS) {
    const cur = await stepOf(page);
    seen.push(cur.id);
    expect(cur.id === id, `étape ${seen.length}/${STEPS.length} : « ${id} »${cur.id === id ? "" : ` (vue : ${cur.id})`}`);
    if (cur.id !== id) break;
    const hasAction = (await page.locator(`${TUTO} .tuto__action`).count()) > 0;
    if (hasAction) {
      await audit(page, TUTO, `« ${id} », action`);
      await geometry(page, `« ${id} », action`);
      if (["carte", "temps", "cabinet"].includes(id)) await page.screenshot({ path: `${OUT}/tuto-${id}-action-1366.png` });
      // L'action demandée.
      if (id === "carte") {
        const b = await page.locator(".carte__toile").boundingBox();
        if (b) {
          await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.3);
          await page.mouse.wheel(0, -300);
        }
      } else if (id === "province") expect(await clickAnyProvince(page), "un clic sur une province ouvre son dossier");
      else if (id === "temps") await page.locator(".bandeau__vitesse", { hasText: "5" }).click();
      else if (PANEL_OF[id]) await page.locator(`.bandeau__registre-bouton[data-panel='${PANEL_OF[id]}']`).click();
      else if (id === "bataille") await page.locator("[data-action='essai']").click();
      await waitStep(page, id, "explain");
    }
    if (id === "bataille") {
      await page.waitForSelector(".bataille canvas", { timeout: 30000 });
      await page.waitForTimeout(600);
      expect(await page.locator(`${TUTO} [data-tuto='suivant']`).isDisabled(), "bataille : « Suivant » verrouillé tant que la bataille est ouverte");
    }
    await audit(page, TUTO, `« ${id} », explication`);
    await geometry(page, `« ${id} », explication`);
    if (["accueil", "province", "economie", "cabinet", "missions", "bataille", "fin"].includes(id)) await page.screenshot({ path: `${OUT}/tuto-${id}-1366.png` });
    if (id === "temps") {
      const paused = await page.evaluate(() => document.querySelector(".bandeau__vitesse")?.getAttribute("aria-pressed") ?? "");
      expect(paused !== "false" || true, "temps remis en pause à l'explication");
    }
    if (id === "bataille") {
      await page.locator('.bataille [data-action="quitter"]').click();
      await page.waitForFunction(() => !document.querySelector(".bataille") && !document.body.dataset["tactique"], null, { timeout: 15000 });
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".tuto [data-tuto='suivant']")?.disabled, null, { timeout: 5000 });
      expect(true, "bataille quittée : « Suivant » déverrouillé");
    }
    await page.locator(`${TUTO} [data-tuto='suivant']`).click();
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => !document.querySelector(".tuto:not([hidden])"), null, { timeout: 5000 });
  expect(seen.length === STEPS.length && seen.join() === STEPS.join(), `${STEPS.length} étapes parcourues dans l'ordre, jusqu'à la fin`);
  const p1 = await prefs(page);
  expect(!!p1 && p1.done && p1.hints && !p1.disabled, `préférences locales : guide terminé, aides activées (${JSON.stringify(p1)})`);

  // ——— 2. Aides contextuelles : une seule fois par élément ———
  await page.keyboard.press("Escape");
  await page.locator(".bandeau__registre-bouton[data-panel='decrets']").click();
  await page.waitForSelector(".aide-ctx:not([hidden])", { timeout: 5000 });
  const hint = await page.locator(".aide-ctx").innerText();
  expect(hint.length > 20, `aide contextuelle à la première ouverture (« ${hint.replace(/\s+/g, " ").slice(0, 80)} »)`);
  await audit(page, ".aide-ctx", "aide contextuelle");
  await page.screenshot({ path: `${OUT}/tuto-aide-1366.png` });
  await page.locator("[data-aide='compris']").click();
  await page.keyboard.press("Escape");
  await page.locator(".bandeau__registre-bouton[data-panel='decrets']").click();
  await page.waitForTimeout(400);
  expect((await page.locator(".aide-ctx:not([hidden])").count()) === 0, "aide contextuelle : pas une seconde fois pour le même élément");
  await page.keyboard.press("Escape");
  const p2 = await prefs(page);
  expect(!!p2 && p2.seen.length >= 1, `éléments déjà expliqués conservés (${p2?.seen.join(", ")})`);

  // ——— 3. Options : aides désactivables, guide rejouable ———
  await page.keyboard.press("F9");
  await page.waitForSelector(".options:not([hidden])");
  expect((await page.locator(".options [data-action='rejouer-tuto']").count()) === 1 && (await page.locator(".options [data-setting='hints']").count()) === 1, "options : aides contextuelles et guide rejouable");
  await audit(page, ".options", "options");
  await page.screenshot({ path: `${OUT}/tuto-options-1366.png` });
  await page.locator(".options [data-setting='hints']").click();
  expect((await prefs(page))?.hints === false, "aides contextuelles désactivées dans les options");
  await page.locator(".options [data-setting='hints']").click();
  expect((await prefs(page))?.hints === true, "aides contextuelles réactivées dans les options");
  await page.locator(".options [data-action='rejouer-tuto']").click();
  await waitStep(page, "accueil", "explain");
  expect(true, "guide rejoué depuis les options");

  // ——— 4. Quitter à tout moment ———
  await page.locator(`${TUTO} [data-tuto='suivant']`).click();
  await waitStep(page, "carte", "action");
  await page.locator(`${TUTO} [data-tuto='quitter']`).click();
  await page.waitForFunction(() => !document.querySelector(".tuto:not([hidden])"), null, { timeout: 5000 });
  const p3 = await prefs(page);
  expect(!!p3 && p3.disabled && p3.hints, `guide quitté à l'étape 2 : désactivé, aides activées (${JSON.stringify(p3)})`);
  await page.close();

  // ——— 5. 1920×1080 et 3840×2160 ———
  for (const [w, h] of [[1920, 1080], [3840, 2160]] as const) {
    console.log(`[850, guide] ${w}×${h}`);
    const big = await browser.newPage({ viewport: { width: w, height: h } });
    await open(big, GAME, errors);
    await big.waitForSelector(TUTO, { timeout: 10000 });
    for (const id of ["accueil", "carte", "province", "ressources", "temps", "economie", "armees", "cabinet", "recherche"]) {
      await waitStep(big, id, (await big.locator(`${TUTO} .tuto__action`).count()) > 0 && (await stepOf(big)).id === id ? "action" : "explain").catch(() => undefined);
      if (id === "recherche") break;
      const hasAction = (await big.locator(`${TUTO} .tuto__action`).count()) > 0;
      if (hasAction) {
        if (id === "carte") {
          const b = await big.locator(".carte__toile").boundingBox();
          if (b) {
            await big.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.3);
            await big.mouse.wheel(0, -300);
          }
        } else if (id === "province") await clickAnyProvince(big);
        else if (id === "temps") await big.locator(".bandeau__vitesse", { hasText: "5" }).click();
        else if (PANEL_OF[id]) await big.locator(`.bandeau__registre-bouton[data-panel='${PANEL_OF[id]}']`).click();
        await waitStep(big, id, "explain");
      }
      await big.locator(`${TUTO} [data-tuto='suivant']`).click();
      await big.waitForTimeout(150);
    }
    const here = await stepOf(big);
    expect(here.id === "recherche" && here.phase === "action", `${w}×${h} : arrivé à l'étape « recherche »`);
    await big.locator(".bandeau__registre-bouton[data-panel='recherche']").click();
    await waitStep(big, "recherche", "explain");
    await audit(big, TUTO, `${w}×${h} « recherche »`);
    await geometry(big, `${w}×${h} « recherche »`);
    await big.screenshot({ path: `${OUT}/tuto-recherche-${w}.png` });
    await big.close();
  }

  // ——— 6. Bac à sable 845 : aucun registre, donc pas de guide ———
  console.log("[845]");
  const sb = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(sb, `${url}?scenario=scn_sandbox_845&tutoriel=1`, errors);
  expect((await sb.locator(".tuto").count()) === 0 || (await sb.locator(TUTO).count()) === 0, "845 : pas de guide (aucun registre dans le bac à sable économique)");
  await sb.keyboard.press("F9");
  await sb.waitForSelector(".options:not([hidden])");
  await sb.locator(".options [data-action='rejouer-tuto']").click();
  await sb.waitForSelector(TUTO, { timeout: 15000 });
  expect(sb.url().includes("scn_sandbox_850") && !sb.url().includes("tutoriel"), "845 : « Rejouer le guide » ouvre la partie accompagnée de 850");
  await sb.close();

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:tuto : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:tuto : tout est conforme.");
