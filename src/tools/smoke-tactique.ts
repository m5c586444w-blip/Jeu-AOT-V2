// npm run smoke:tactique — AC4-09, AC4-11, AC4-13 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/p4-*.
// Parcours : planche des figures (10 silhouettes, 8 soldats) ; bataille d'essai sur chacune des 4 cartes ; contrôles de l'écran
// (pause active, ordres en pause, vitesses, sélection, suivi, zoom, cartes d'escouade, carnet, fiches « pourquoi ? ») ;
// bilan ; 300 unités (temps JS par image) ; bataille liée à une expédition « jouée », validée puis reportée dans le registre.
// Navigateur : CHROMIUM_PATH ou /opt/pw-browsers/chromium. Le débit réel (60 FPS) dépend du GPU : non mesurable ici.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";
import fr from "../i18n/fr.json";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const failures: string[] = [];
const ok = (label: string): void => console.log(`  OK  ${label}`);
const expect = (cond: boolean, label: string): void => {
  if (cond) ok(label);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);
const MAPS: [string, string][] = [
  ["tmap_ville", "ville"],
  ["tmap_foret", "foret"],
  ["tmap_plaine", "plaine"],
  ["tmap_mur", "mur"],
];

/** Valeurs expliquées et aucune clé ni identifiant brut à l'écran de bataille (AC4-11). */
async function audit(page: Page, label: string): Promise<void> {
  const unexplained = await page.$$eval(".bataille .valeur", (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(".bataille .valeur").count();
  const visible = await page.locator(".bataille").innerText();
  const raw = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|sol|esc|ttype|tmap)_[a-z0-9_]+/g) ?? [])];
  expect(count > 0 && unexplained === 0 && raw.length === 0 && ids.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé ni identifiant brut${raw.length || ids.length ? ` (${[...raw, ...ids].slice(0, 5).join(", ")})` : ""}`);
}

const tick = async (page: Page): Promise<number> => Number(await page.getAttribute(".bataille", "data-tick"));

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 60000 });
  await page.keyboard.press("F2");
}

/** Ouvre le registre des expéditions s'il ne l'est pas. */
async function registry(page: Page): Promise<void> {
  if (!(await page.locator('.registre-panneau[data-panel="expeditions"]:not([hidden])').count())) await page.keyboard.press("KeyE");
  await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
}

/** Bataille d'essai depuis le registre. */
async function trial(page: Page, map: string, type: string, count: number, men: number): Promise<void> {
  await registry(page);
  await page.selectOption('select[data-trial="map"]', map);
  await page.selectOption('select[data-trial="type"]', type);
  await page.fill('input[data-trial="count"]', String(count));
  await page.fill('input[data-trial="men"]', String(men));
  await page.locator('[data-action="essai"]').click();
  await page.waitForSelector(".bataille canvas", { timeout: 30000 });
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"] ?? "-1") >= 0);
}

async function speed(page: Page, sp: string): Promise<void> {
  await page.locator(`.bataille-vitesse[data-speed="${sp}"]`).click();
}

async function close(page: Page): Promise<void> {
  await page.locator('.bataille [data-action="quitter"]').click();
  await page.waitForFunction(() => !document.querySelector(".bataille") && !document.body.dataset["tactique"]);
}

const server = await createServer({ server: { port: 5180, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5180/";
const browser = await chromium.launch({ executablePath });

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready='true']", { timeout: 60000 });
  await page.waitForTimeout(400);
  console.log("[scénario 850] 1366×768");

  // ——— Planche des figures (AC4-13) ———
  await page.evaluate(async () => {
    const path = "/src/ui/tactical/specimenSheet.ts";
    const m = (await import(path)) as { openSpecimenSheet: () => Promise<() => void> };
    const closeSheet = await m.openSpecimenSheet();
    (window as unknown as Record<string, unknown>)["closeSheet"] = closeSheet;
  });
  await page.waitForSelector(".planche[data-ready='true']");
  await page.waitForTimeout(300);
  const legends = await page.locator(".planche-legendes span:not(:empty)").count();
  expect((await page.locator(".planche canvas").count()) === 3 && legends === 10 + 8 + 7, `planche : 10 silhouettes de Titans, 8 types de soldats, 7 états et signaux (${legends} légendes)`);
  await page.locator(".planche").screenshot({ path: `${OUT}/p4-figures.png` });
  await page.evaluate(() => ((window as unknown as Record<string, () => void>)["closeSheet"] ?? (() => undefined))());

  // ——— Quatre cartes (AC4-13) ———
  for (const [id, short] of MAPS) {
    await trial(page, id, "ttype_moyen_errant", 3, 24);
    await speed(page, "2");
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"]) >= 120, undefined, { timeout: 30000 });
    await speed(page, "0");
    await page.waitForTimeout(200);
    const title = await page.locator(".bataille-titre").innerText();
    expect((await page.locator(".carte-escouade").count()) === 4 && (await page.locator(".carnet-lignes li").count()) >= 1, `carte ${title} : 4 cartes d'escouade, carnet tenu (${await tick(page)} pas)`);
    if (short === "ville") {
      // Revue de P4 (1) : les 4 cartes tiennent entières dans la barre, aucune n'est coupée au bord.
      const cut = await page.$$eval(".carte-escouade", (els) => {
        const bar = els[0]?.parentElement?.getBoundingClientRect();
        return bar ? els.filter((e) => e.getBoundingClientRect().right > bar.right + 0.5 || e.getBoundingClientRect().left < bar.left - 0.5).length : -1;
      });
      expect(cut === 0, `revue P4 : 4 cartes d'escouade entières dans la largeur (${cut} coupée(s))`);
      // Revue de P4 (3) : mesure de performance masquée hors mode debug, affichée par F2.
      const hiddenByDefault = await page.locator(".bataille-perf").isHidden();
      await page.keyboard.press("F2");
      const shownByF2 = await page.locator(".bataille-perf").isVisible();
      await page.keyboard.press("F2");
      expect(hiddenByDefault && shownByF2 && (await page.locator(".bataille-perf").isHidden()) && !(await page.locator(".debug-console:not([hidden])").count()), "revue P4 : « ms/image · unités » masqué hors debug ; F2 l'affiche puis le masque (sans ouvrir la console de la carte)");
    }
    await page.screenshot({ path: `${OUT}/p4-carte-${short}.png` });
    await close(page);
  }

  // ——— Contrôles de l'écran (AC4-11) ———
  await trial(page, "tmap_ville", "ttype_petit_errant", 2, 18);
  await audit(page, "écran de bataille");
  const t0 = await tick(page);
  await page.waitForTimeout(800);
  expect((await tick(page)) === t0, `pause active à l'ouverture : la bataille ne progresse pas (pas ${t0})`);
  // Ordre donné en pause : visible aussitôt, appliqué au pas suivant.
  await page.locator('.carte-escouade[data-squad="esc_01"] button[data-order="tenir"]').click();
  expect((await page.locator('.carte-escouade[data-squad="esc_01"] button[data-order="tenir"]').getAttribute("aria-pressed")) === "true" && (await tick(page)) === t0, "ordre « tenir » donné en pause (affiché sur la carte d'escouade, bataille toujours arrêtée)");
  await speed(page, "1");
  await page.waitForFunction((x) => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"]) > x + 20, t0, { timeout: 20000 });
  const logText = await page.locator(".carnet-lignes").innerText();
  expect(logText.includes("Ordre à l'escouade Escouade 01 : tenir la position"), "l'ordre est consigné au carnet de combat");
  // Vitesses : ×0,25 avance environ 8 fois moins vite que ×2.
  const rate = async (sp: string): Promise<number> => {
    await speed(page, sp);
    const a = await tick(page);
    await page.waitForTimeout(2000);
    return ((await tick(page)) - a) / 2;
  };
  const slow = await rate("0.25");
  const fast = await rate("2");
  expect(slow > 0 && fast > slow * 3, `vitesses : ${slow.toFixed(1)} pas/s à ×0,25, ${fast.toFixed(1)} pas/s à ×2`);
  await page.keyboard.press("Space");
  const tp = await tick(page);
  await page.waitForTimeout(600);
  const paused = (await tick(page)) === tp && (await page.locator('.bataille-vitesse[data-speed="0"]').getAttribute("aria-pressed")) === "true";
  expect(paused && (await page.locator('.registre-panneau[data-panel="expeditions"]').isVisible()) === true, "Espace : pause ; les raccourcis de la carte sont neutralisés pendant la bataille");
  await page.keyboard.press("KeyJ");
  expect(!(await page.locator('.registre-panneau[data-panel="journal"]:not([hidden])').count()), "touche J sans effet pendant la bataille");
  // Sélection d'un soldat : clic sur sa position projetée.
  const pos = await page.evaluate(async () => {
    const path = "/src/ui/tactical/battleScreen.ts";
    const m = (await import(path)) as { battleProbe: { soldierOnScreen: ((i: number) => [number, number] | null) | null } };
    // Premier soldat visible dans la scène (le cadrage « remplir l'écran » peut laisser des hommes hors champ).
    const scene = document.querySelector(".bataille-scene")?.getBoundingClientRect();
    for (let i = 0; i < 18; i++) {
      const p = m.battleProbe.soldierOnScreen?.(i);
      if (p && scene && p[0] > 20 && p[1] > 20 && p[0] < scene.width - 20 && p[1] < scene.height - 20) return { i, p };
    }
    return null;
  });
  const box = await page.locator(".bataille-scene").boundingBox();
  if (pos && box) {
    await page.mouse.click(box.x + pos.p[0], box.y + pos.p[1]);
    await page.waitForTimeout(150);
  }
  const sel = await page.getAttribute(".bataille", "data-selection");
  expect(!!sel && sel.startsWith("soldat:"), `sélection d'un soldat au clic (${sel ?? "aucune"}) ; la caméra le suit (${(await page.getAttribute(".bataille", "data-follow")) ?? "—"})`);
  // Caméras : suivi d'escouade, zoom molette.
  await page.locator('.carte-escouade[data-squad="esc_02"] button:has-text("suivre")').click();
  expect((await page.getAttribute(".bataille", "data-follow")) === "escouade:esc_02", "caméra : suivi de l'escouade 02");
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(100);
  const z1 = Number(await page.getAttribute(".bataille", "data-zoom"));
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(100);
  const z2 = Number(await page.getAttribute(".bataille", "data-zoom"));
  expect(z1 > 0 && z2 > 0 && z1 !== z2, `caméra : zoom à la molette (${z1} puis ${z2} px/m)`);
  // Fiche « pourquoi ? » d'une valeur de carte d'escouade.
  await page.locator(".carte-escouade .valeur >> nth=1").focus();
  await page.waitForTimeout(150);
  expect(await page.locator(".pourquoi").isVisible(), "fiche « pourquoi ? » sur le gaz d'une escouade");
  await audit(page, "écran de bataille en cours");
  await page.screenshot({ path: `${OUT}/p4-ecran-bataille.png` });
  await close(page);

  // ——— Bilan ———
  await trial(page, "tmap_plaine", "ttype_grand_errant", 1, 12);
  await speed(page, "2");
  await page.waitForSelector(".bilan", { timeout: 180000 });
  const rows = await page.locator(".bilan tr").count();
  const dead = Number((await page.locator(".bilan .valeur >> nth=0").innerText()).replace(/\D/g, ""));
  const dossiers = await page.locator(".bilan-morts li").count();
  expect(rows === 8 && dossiers === dead, `bilan : ${rows} lignes chiffrées, ${dead} morts, ${dossiers} dossiers de morts (${(await page.locator(".bilan h3").innerText()).toLowerCase()})`);
  await audit(page, "bilan");
  await page.screenshot({ path: `${OUT}/p4-bilan.png` });
  await page.locator('.bilan [data-action="valider"]').click();
  await page.waitForFunction(() => !document.querySelector(".bataille"));

  // ——— 300 unités : temps JS par image (AC4-09) ———
  await trial(page, "tmap_ville", "ttype_moyen_errant", 20, 280);
  // Revue de P4 (2) : vue d'ensemble lisible et cadrage qui remplit l'écran.
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".bataille")?.dataset["vue"] !== undefined);
  const vue0 = await page.getAttribute(".bataille", "data-vue");
  const past0 = Number(await page.getAttribute(".bataille", "data-pastilles"));
  const cover0 = Number(await page.getAttribute(".bataille", "data-couverture"));
  expect(vue0 === "ensemble" && past0 >= 40 && cover0 >= 0.9, `revue P4 : vue d'ensemble (${vue0}) avec ${past0} pastilles d'escouade et Titans agrandis ; le sol couvre ${Math.round(100 * cover0)} % de la scène (≥ 90 %)`);
  const scene = await page.locator(".bataille-scene").boundingBox();
  await page.screenshot({ path: `${OUT}/p4-vue-ensemble.png` });
  if (scene) await page.mouse.move(scene.x + scene.width / 2, scene.y + scene.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -200);
  await page.waitForTimeout(200);
  const vue1 = await page.getAttribute(".bataille", "data-vue");
  const zoom1 = await page.getAttribute(".bataille", "data-zoom");
  expect(vue1 === "detail" && (await page.getAttribute(".bataille", "data-pastilles")) === "0", `revue P4 : au-delà du seuil (${zoom1} px/m ≥ 4), figures détaillées, plus de pastilles`);
  await page.screenshot({ path: `${OUT}/p4-vue-detail.png` });
  await page.keyboard.press("F2");
  const scrollable = await page.$eval(".bataille-escouades", (e) => e.scrollWidth > e.clientWidth && getComputedStyle(e).overflowX === "auto");
  expect(scrollable, `revue P4 : ${await page.locator(".carte-escouade").count()} cartes d'escouade, barre à défilement horizontal`);
  await speed(page, "1");
  await page.waitForTimeout(12000);
  const p95 = Number(await page.getAttribute(".bataille", "data-js-p95"));
  const units = (await page.locator(".bataille-perf").innerText()).match(/(\d+) unités/)?.[1];
  expect(units === "300" && p95 > 0 && p95 < 8, `300 unités : temps JS par image p95 ${p95.toFixed(2)} ms < 8 ms (${units ?? "?"} unités, ${await tick(page)} pas, ${await page.getAttribute(".bataille", "data-frames")} images ; p95 par poste : ${await page.getAttribute(".bataille", "data-js-parts")})`);
  await page.screenshot({ path: `${OUT}/p4-300-unites.png` });
  await close(page);

  // ——— Bataille liée à une expédition « jouée » (AC4-10, F-EXP-18) ———
  await page.keyboard.press("Escape");
  await console_(page, "advance 120", "120");
  await registry(page);
  await page.locator("button[data-action='planifier']").click();
  await page.waitForSelector(".registre-panneau--lateral select[data-plan='cible']");
  await page.selectOption("select[data-plan='cible']", "prov_maria_est");
  await page.waitForTimeout(150);
  await page.locator("button[data-action='escouades']").click();
  await page.waitForTimeout(200);
  await page.locator("input[data-plan='jouer']").check();
  await page.waitForTimeout(200);
  expect((await page.locator(".registre-panneau").innerText()).includes("Résolution des engagements : jouée"), "planificateur : « jouer les engagements » coché");
  await page.locator("button[data-action='lancer']").click();
  await page.locator("[data-confirm='oui']").click();
  await page.waitForSelector(".exp-carte[data-exp]", { timeout: 10000 });
  let pending = false;
  for (let d = 0; d < 40 && !pending; d++) {
    await console_(page, "advance 1", "1");
    await registry(page);
    pending = (await page.locator(".exp-bataille[data-pending]").count()) > 0;
  }
  expect(pending, "contact : la campagne attend (bataille en attente dans le registre, boutons Jouer / Auto-résoudre)");
  if (pending) {
    const before = await page.locator(".exp-carte .exp-phase").innerText();
    await console_(page, "advance 3", "3");
    await registry(page);
    expect((await page.locator(".exp-bataille[data-pending]").count()) === 1 && (await page.locator(".exp-carte .exp-phase").innerText()) === before, "la campagne reste en pause tant que la bataille n'est pas résolue");
    await page.locator('.exp-bataille [data-action="jouer"]').click();
    await page.waitForSelector(".bataille canvas", { timeout: 30000 });
    const title = await page.locator(".bataille-titre").innerText();
    expect(title.startsWith("Expédition n°"), `écran de bataille lié : « ${title} »`);
    await page.locator(".carte-escouade button[data-order='couvrir'] >> nth=0").click();
    await speed(page, "2");
    await page.waitForTimeout(2500);
    await audit(page, "bataille liée");
    await page.screenshot({ path: `${OUT}/p4-bataille-liee.png` });
    await page.locator('.bataille [data-action="quitter"]').click();
    await page.waitForSelector(".bilan", { timeout: 60000 });
    await page.locator('.bilan [data-action="valider"]').click();
    await page.waitForFunction(() => !document.querySelector(".bataille"));
    await page.waitForFunction(() => document.querySelector(".exp-journal")?.textContent?.includes("Bataille jouée"), undefined, { timeout: 15000 }).catch(() => undefined);
    const journal = await page.locator(".exp-journal").first().innerText();
    expect(journal.includes("Bataille jouée") && !(await page.locator(".exp-bataille[data-pending]").count()), `bataille validée puis reportée dans la campagne : « ${journal.split("\n").find((l) => l.includes("Bataille jouée")) ?? "—"} »`);
  }

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.error(`smoke:tactique : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:tactique : tout est conforme.");
