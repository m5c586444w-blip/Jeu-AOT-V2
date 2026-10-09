// npm run smoke:mis — CMIS-05 et CMIS-06 dans un vrai navigateur (Chromium, serveur de dev Vite) + captures docs/screenshots/mis-*.
// Parcours : écran « Missions » de Paradis en 1366×768 et 3840×2160 (arbre, liens, nœuds), infobulle d'effet, lancement d'une
// mission (en cours, temps restant), accomplissement (pause, journal, frise), annulation ; branche de Marley jouée ; bac à
// sable 845. Aucune mention interne (src/ui/leaks.ts), aucune clé ni identifiant brut, 0 erreur console.
import { mkdirSync } from "node:fs";
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

async function audit(page: Page, scope: string, label: string): Promise<void> {
  const unexplained = await page.$$eval(`${scope} .valeur`, (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
  const count = await page.locator(`${scope} .valeur`).count();
  const visible = await page.locator(scope).innerText();
  const raw = Object.keys(fr).filter((k) => k.includes(".") && k.length > 8 && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|mis|fac|wprov|scn|law)_[a-z0-9_]+/g) ?? [])];
  const leaks = findLeaks(visible);
  expect(unexplained === 0 && raw.length === 0 && ids.length === 0 && leaks.length === 0, `${label} : ${count} valeurs, toutes expliquées ; aucune clé, identifiant ni mention interne${raw.length || ids.length || leaks.length ? ` (${[...raw, ...ids, ...leaks.map((l) => l.excerpt)].slice(0, 5).join(", ")})` : ""}`);
}

/** Texte coupé dans les planches (nom ou condition qui dépasse de sa boîte). */
async function clipped(page: Page, label: string): Promise<void> {
  const n = await page.$$eval(".planche h4, .planche .plan-probleme, .planche .registre-note", (els) => els.filter((e) => (e as HTMLElement).scrollHeight > (e as HTMLElement).clientHeight + 1 && getComputedStyle(e).webkitLineClamp === "none" && getComputedStyle(e).whiteSpace !== "nowrap").length);
  expect(n === 0, `${label} : aucun texte débordant des planches (${n})`);
}

async function consoleLine(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 300000 });
  await page.keyboard.press("F2");
}

async function panel(page: Page, key: string, id: string): Promise<void> {
  if ((await page.locator(`.registre-panneau[data-panel="${id}"]:not([hidden])`).count()) === 0) await page.keyboard.press(key);
  await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
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

const server = await createServer({ server: { port: 5187, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5187/";
const browser = await chromium.launch({ executablePath });
const errors: string[] = [];
const P = ".registre-panneau[data-panel='missions']";

try {
  // ——— 1. Écran « Missions » de Paradis, 1366×768 ———
  console.log("[854, Paradis] 1366×768");
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(page, `${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`, errors);
  expect((await page.locator(".bandeau__registre-bouton[data-panel='missions']").count()) === 1, "bandeau : registre « Missions » (touche Z)");
  await panel(page, "KeyZ", "missions");
  const branches = await page.locator(`${P} .registre-onglet[data-branche]`).count();
  const nodes = await page.locator(`${P} .planche[data-mission]`).count();
  const links = await page.locator(`${P} .arbre__lien`).count();
  expect(branches === 6, `6 branches (militaire, politique, économie, religion, renseignement, monde extérieur) : ${branches}`);
  expect(nodes >= 8 && links >= 6, `branche militaire : ${nodes} planches, ${links} liens`);
  expect((await page.locator(`${P} [data-mission='en-cours']`).count()) === 0, "aucune mission en cours au départ (texte d'attente)");
  await audit(page, P, "écran Missions 1366");
  await clipped(page, "1366");
  await page.screenshot({ path: `${OUT}/mis-ecran-1366.png` });

  // ——— 2. Infobulle d'effet ———
  const free = page.locator(`${P} .planche[data-etat='disponible']`).first();
  const freeId = (await free.getAttribute("data-mission")) ?? "";
  await free.hover();
  await page.waitForSelector(".pourquoi:not([hidden])", { timeout: 5000 });
  const tip = await page.locator(".pourquoi").innerText();
  expect(tip.toLowerCase().includes((fr["mission.effects"] ?? "Effets").toLowerCase()) && tip.toLowerCase().includes((fr["mission.cost"] ?? "Coût").toLowerCase()), `infobulle d'effet : coût, durée, effets (« ${tip.replace(/\s+/g, " ").slice(0, 110)}… »)`);
  expect(findLeaks(tip).length === 0 && !/\bmis_|\bevt_/.test(tip), "infobulle : aucune mention interne");
  await page.screenshot({ path: `${OUT}/mis-infobulle.png` });
  await page.mouse.move(5, 5);

  // ——— 3. Lancer une mission : en cours, temps restant ———
  const locked = await page.locator(`${P} .planche[data-etat='verrouillee'] .plan-probleme`).first().innerText();
  expect(locked.length > 8 && findLeaks(locked).length === 0, `mission verrouillée : raison en langage de jeu (« ${locked.replace(/\s+/g, " ")} »)`);
  await page.locator(`${P} .planche[data-mission="${freeId}"] [data-action="lancer-mission"]`).click();
  await page.waitForSelector(`${P} [data-mission='en-cours']`, { timeout: 10000 });
  const cur = await page.locator(`${P} .rech-tete`).innerText();
  expect(/mois/.test(cur) && cur.includes(fr["mission.current"] ?? "En cours"), `mission en cours avec temps restant (« ${cur.replace(/\s+/g, " ").slice(0, 120)} »)`);
  expect((await page.locator(`${P} .rech-tete [role='progressbar']`).count()) === 1, "barre d'avancement de la mission en cours");
  await audit(page, P, "mission en cours");
  await audit(page, ".notifications", "notifications après le lancement");
  await page.screenshot({ path: `${OUT}/mis-en-cours.png` });

  // ——— 4. Accomplissement : alerte, journal, frise ———
  await page.keyboard.press("Escape");
  await consoleLine(page, "advance 100", "100");
  await panel(page, "KeyZ", "missions");
  expect((await page.locator(`${P} .planche[data-etat='accomplie']`).count()) >= 1, "mission accomplie marquée dans l'arbre");
  await page.keyboard.press("Escape");
  await panel(page, "KeyJ", "journal");
  expect((await page.locator(".registre-panneau[data-panel='journal']").innerText()).includes("Mission accomplie"), "journal : « Mission accomplie »");
  await page.keyboard.press("Escape");
  await panel(page, "KeyH", "chronique");
  await page.locator(".registre-panneau[data-panel='chronique'] [data-tab='mission']").click();
  await page.waitForSelector(".chronique-liste li[data-event]", { timeout: 5000 });
  const marks = await page.locator(".frise__repere:not(.frise__repere--legende)").count();
  expect(marks >= 1, `frise : ${marks} repère(s) de mission sur l'axe`);
  await audit(page, ".registre-panneau[data-panel='chronique']", "frise des missions");
  await page.screenshot({ path: `${OUT}/mis-frise.png` });
  await page.keyboard.press("Escape");

  // ——— 5. Abandon ———
  await panel(page, "KeyZ", "missions");
  const next = page.locator(`${P} [data-action='lancer-mission']:not([disabled])`).first();
  if ((await next.count()) > 0) {
    await next.click();
    await page.waitForSelector(`${P} [data-mission='en-cours']`);
    await page.locator(`${P} [data-action='annuler-mission']`).click();
    await page.locator("[data-confirm='oui']").click();
    await page.waitForFunction(() => document.querySelectorAll(".registre-panneau[data-panel='missions'] [data-mission='en-cours']").length === 0, null, { timeout: 5000 });
    expect(true, "mission abandonnée : la place est libérée");
  } else expect(false, "une seconde mission est lançable");
  await page.close();

  // ——— 6. 3840×2160 ———
  console.log("[854, Paradis] 3840×2160");
  const big = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  await open(big, `${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`, errors);
  await panel(big, "KeyZ", "missions");
  await audit(big, P, "écran Missions 3840");
  await clipped(big, "3840");
  await big.screenshot({ path: `${OUT}/mis-ecran-3840.png` });
  await big.close();

  // ——— 7. Marley jouée : branche simplifiée ———
  console.log("[854, Marley]");
  const mar = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(mar, `${url}?scenario=scn_854&faction=fac_marley&dossiers=0`, errors);
  await panel(mar, "KeyZ", "missions");
  const mb = await mar.locator(`${P} .registre-onglet[data-branche]`).count();
  const mn = await mar.locator(`${P} .planche[data-mission]`).count();
  expect(mb >= 4 && mn >= 2, `Marley : ${mb} branches, ${mn} planches dans la première`);
  const txt = await mar.locator(P).innerText();
  expect(/Industrie|Hommes/.test(txt), "Marley : coûts en industrie et en hommes");
  await audit(mar, P, "missions de Marley");
  await mar.screenshot({ path: `${OUT}/mis-marley.png` });
  await mar.close();

  // ——— 8. Bac à sable 845 : aucun registre (pas de couche politique) ; les missions y agissent par la simulation seule ———
  console.log("[845]");
  const sb = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(sb, `${url}?scenario=scn_sandbox_845&dossiers=0`, errors);
  expect((await sb.locator(".bandeau__registre-bouton[data-panel='missions']").count()) === 0, "845 : pas de registres dans le bac à sable économique (les missions y sont couvertes par les tests de simulation)");
  await sb.close();

  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:mis : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:mis : tout est conforme.");
