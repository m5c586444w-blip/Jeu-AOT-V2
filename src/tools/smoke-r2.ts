// npm run smoke:r2 — R2+ (CR2-04, CR2-07 à CR2-10) dans un vrai navigateur (Chromium, serveur de dev Vite) + captures
// r2-*.png en 1366×768, 1920×1080 et 3840×2160. Par défaut, les captures vont dans docs/screenshots/.smoke/ (ignoré par
// git : un passage de contrôle ne réécrit pas les captures suivies) ; `npm run smoke:r2 -- --captures` les écrit dans
// docs/screenshots/ (passage final d'une phase) ; `R2_CAPTURES=<dossier>` choisit un autre dossier.
// Parcours : bataille de compagnie (≈ 340 unités : soldats, fantassins des deux camps, batteries, 4 Titans, porteur allié) en vue
// 3D ; sélection (clic, Alt + clic, rectangle, groupes), ordres (clic droit, file avec Maj, formation, ordre d'unité, attaque
// d'un Titan), pause active, caméra stratégique ↔ suivi (touche V), tir sur zone et cessez-le-feu, ordre général du porteur,
// violence sobre ; bataille de campagne (854 : contact d'armées) jouée en temps réel, bilan, rencontre reportée ; repli 2D sans
// WebGL 2 (three.js non téléchargé) ; three.js hors du bundle principal ; mesures (logiciel : à vérifier sur le PC de l'utilisateur).
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { createServer } from "vite";
import fr from "../i18n/fr.json";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const OUT = process.argv.includes("--captures") ? "docs/screenshots" : (process.env["R2_CAPTURES"] ?? "docs/screenshots/.smoke");
mkdirSync(OUT, { recursive: true });
console.log(`Captures : ${OUT}/${OUT === "docs/screenshots" ? " (suivies par git, option --captures)" : " (hors git)"}`);
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(text);
const MAP = JSON.parse(readFileSync("data/map/paradis.json", "utf8")) as { bounds: [number, number, number, number]; provinces: Record<string, { polygon: [number, number][] }> };
const measures: string[] = [];
/** `R2_PARTIES=3,5` : ne jouer que certaines parties (mise au point) ; par défaut, toutes. */
const parts = (process.env["R2_PARTIES"] ?? "1,2,3,4,5").split(",");
const part = (n: string): boolean => parts.includes(n);

type Probe = {
  view: { toScreen(x: number, y: number, z: number): [number, number] | null; pick(st: unknown, x: number, y: number): { kind: string; index: number } | null; camera: string; kind: string };
  bt: { state: { tick: number; titans: { alive: boolean; ally?: boolean; x: number; y: number }[]; soldiers: { squad: string; x: number; y: number; z: number; mode: string }[]; squads: { id: string; order: string; queue?: unknown[]; formation?: string }[]; batteries?: { id: string; side: string; zone?: unknown; hold?: boolean; shots: number }[]; impacts?: unknown[]; log: { key: string }[]; shifters?: { directive?: { objective: string; restraint: string; zone: unknown } }[] } };
  orders: () => { tick: number; squad: string; order: string; unit?: number; target?: number; queue?: boolean; x?: number }[];
};

async function open(page: Page, url: string, errors: string[], label = ""): Promise<void> {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${label}${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${label}pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready='true']", { timeout: 120000 });
  await page.waitForTimeout(600);
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

async function clickProvince(page: Page, id: string): Promise<void> {
  const box = await page.locator(".carte__toile").boundingBox();
  const poly = MAP.provinces[id]?.polygon;
  if (!box || !poly) throw new Error(`province ou carte absente : ${id}`);
  const [x0, y0, x1, y1] = MAP.bounds;
  const zoom = Math.min(box.width / (x1 - x0), box.height / (y1 - y0)) * 0.98;
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  await page.mouse.click(box.x + box.width / 2 + cx * zoom, box.y + box.height / 2 + cy * zoom);
  await page.waitForTimeout(300);
}

const ds = async (page: Page, key: string): Promise<string> => (await page.getAttribute(".bataille", `data-${key}`)) ?? "";
const num = async (page: Page, key: string): Promise<number> => Number(await ds(page, key));
const marks = async (page: Page): Promise<Record<string, [number, number]>> => JSON.parse((await ds(page, "reperes")) || "{}") as Record<string, [number, number]>;
async function sceneBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await page.locator(".bataille-scene").boundingBox();
  if (!b) throw new Error("scène absente");
  return b;
}
/** Évalue dans la page avec la sonde de l'écran temps réel (serveur de développement). */
async function probe<T>(page: Page, fn: (p: Probe) => T): Promise<T> {
  return (await page.evaluate(`(${fn.toString()})(window.__batailleRt)`)) as T;
}
async function frames(page: Page, n: number, timeout = 240000): Promise<void> {
  await page.waitForFunction((k) => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["frames"] ?? "0") >= k, n, { timeout });
}
async function runFor(page: Page, sp: string, ticks: number, timeout = 240000): Promise<void> {
  const t0 = await num(page, "tick");
  await page.locator(`.bataille-vitesse[data-speed="${sp}"]`).click();
  await page.waitForFunction((k) => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"] ?? "0") >= k || !!document.querySelector(".bilan"), t0 + ticks, { timeout });
  if (!(await page.locator(".bilan").count())) await page.locator('.bataille-vitesse[data-speed="0"]').click();
  await page.waitForTimeout(300);
}

/** Bataille de compagnie depuis le registre des expéditions ; renvoie le délai jusqu'à l'image « prête » (ms). */
async function company(page: Page, o: { map: string; count: number; men: number; enemy: number; shifter: boolean }): Promise<number> {
  if (!(await page.locator('.registre-panneau[data-panel="expeditions"]:not([hidden])').count())) await page.keyboard.press("KeyE");
  await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
  await page.selectOption('select[data-trial="map"]', o.map);
  await page.selectOption('select[data-trial="type"]', "ttype_grand_errant");
  await page.fill('input[data-trial="count"]', String(o.count));
  await page.fill('input[data-trial="men"]', String(o.men));
  await page.fill('input[data-trial="enemy"]', String(o.enemy));
  if ((await page.locator('input[data-trial="shifter"]').isChecked()) !== o.shifter) await page.locator('input[data-trial="shifter"]').click();
  const t0 = Date.now();
  await page.locator('[data-action="essai-compagnie"]').click();
  await page.waitForSelector(".bataille--rt", { timeout: 60000 });
  await frames(page, 2);
  return Date.now() - t0;
}

async function close(page: Page): Promise<void> {
  await page.locator('.bataille [data-action="quitter"]').click();
  await page.waitForFunction(() => !document.querySelector(".bataille") && !document.body.dataset["tactique"], undefined, { timeout: 120000 });
}

async function measure(page: Page, label: string, ready: number): Promise<void> {
  await runFor(page, "1", 60);
  const line = `${label} : prêt ${(ready / 1000).toFixed(1)} s · ${await ds(page, "unites")} unités · temps JS p95 ${await ds(page, "js-p95")} ms (${await ds(page, "js-parts")}) · ${await ds(page, "stats")}`;
  measures.push(line);
  console.log(`  ..  ${line}`);
}

const server = await createServer({ server: { port: 5187, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5187/";
const browser: Browser = await chromium.launch({ executablePath });
const errors: string[] = [];

try {
  // ——— 1. Bataille de compagnie en 3D, 1366×768 ———
  if (part("1")) {
  console.log("[850, essai de compagnie] 1366×768");
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  await open(page, `${url}?dossiers=0`, errors, "[compagnie 1366] ");
  expect(!requested.some((u) => /three|battle\/view3d/.test(u)), "carte stratégique : three.js et la vue 3D de bataille non chargés");
  const ready = await company(page, { map: "tmap_ville", count: 4, men: 120, enemy: 150, shifter: true });
  const units = await num(page, "unites");
  expect((await ds(page, "vue")) === "3d" && requested.some((u) => /three/.test(u)), `vue 3D chargée à la demande (three.js téléchargé à l'ouverture de la bataille), prête en ${(ready / 1000).toFixed(1)} s`);
  expect(units >= 100 && units <= 400 && (await num(page, "titans")) === 4, `compagnies : ${units} unités en scène (100 à 400), 4 Titans`);
  expect((await ds(page, "pause")) === "1" && (await page.locator(".rt-pause").isVisible()), "ouverture en pause active (bandeau « Pause — donnez vos ordres »)");
  await page.screenshot({ path: `${OUT}/r2-strategique-1366.png` });

  // Sélection : clic sur un homme (zoom sur son escouade), Alt + clic, rectangle, groupes.
  const box = await sceneBox(page);
  let m = await marks(page);
  const s3 = m["esc_03"];
  if (s3) {
    await page.mouse.move(box.x + s3[0], box.y + s3[1]);
    for (let i = 0; i < 18; i++) await page.mouse.wheel(0, -200);
    await page.waitForTimeout(800);
  }
  const target = await probe(page, (p) => {
    const i = p.bt.state.soldiers.findIndex((s) => s.squad === "esc_03" && s.mode !== "mort");
    const s = p.bt.state.soldiers[i];
    const xy = s ? p.view.toScreen(s.x, s.y, s.z + 0.9) : null;
    const hit = xy ? p.view.pick(p.bt.state, xy[0], xy[1]) : null;
    return { xy, hit, squad: hit && hit.kind === "soldat" ? p.bt.state.soldiers[hit.index]?.squad : null };
  });
  if (target.xy) await page.mouse.click(box.x + target.xy[0], box.y + target.xy[1]);
  await page.waitForTimeout(300);
  const clicked = await ds(page, "selection");
  expect(!!target.squad && clicked === target.squad, `clic sur un homme : son escouade est sélectionnée (« ${clicked} »)`);
  if (target.xy) {
    await page.keyboard.down("Alt");
    await page.mouse.click(box.x + target.xy[0], box.y + target.xy[1]);
    await page.keyboard.up("Alt");
  }
  await page.waitForTimeout(300);
  const single = await ds(page, "selection");
  expect(single === `soldat:${target.hit?.index ?? -1}`, `Alt + clic : un seul homme sélectionné (« ${single} »)`);
  await page.screenshot({ path: `${OUT}/r2-proche-1366.png` });
  if (s3) for (let i = 0; i < 18; i++) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(800);
  await runFor(page, "1", 2);
  m = await marks(page);
  const left = ["esc_01", "esc_02", "esc_03", "esc_04"].map((k) => m[k]).filter((p): p is [number, number] => !!p);
  if (left.length > 0) {
    const xs = left.map((p) => p[0]);
    const ys = left.map((p) => p[1]);
    await page.mouse.move(box.x + Math.min(...xs) - 18, box.y + Math.min(...ys) - 18);
    await page.mouse.down();
    await page.mouse.move(box.x + Math.max(...xs) + 18, box.y + Math.max(...ys) + 18, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
  const rect = (await ds(page, "selection")).split(",").filter(Boolean);
  expect(rect.length >= 3, `rectangle de sélection : ${rect.length} unités (${rect.join(", ")})`);
  await page.keyboard.press("Control+Digit1");
  await page.keyboard.press("Escape");
  const cleared = await ds(page, "selection");
  await page.keyboard.press("Digit1");
  await page.waitForTimeout(200);
  const recalled = await ds(page, "selection");
  expect(cleared === "" && recalled === rect.join(",") && (await ds(page, "groupes")).startsWith("1:"), `groupe numéroté : Ctrl + 1 enregistre, 1 rappelle (« ${recalled} »)`);

  // Ordres en pause : clic droit (se déplacer), Maj + clic droit (file), formation, ordre d'unité, attaque d'un Titan.
  const tick0 = await num(page, "tick");
  const n0 = await probe(page, (p) => p.orders().length);
  const centerX = box.x + box.width * 0.45;
  const centerY = box.y + box.height * 0.45;
  await page.mouse.click(centerX, centerY, { button: "right" });
  await page.waitForTimeout(200);
  const moved = await probe(page, (p) => p.orders().filter((o) => o.order === "deplacer").length);
  expect(moved >= rect.length && (await probe(page, (p) => p.orders().length)) === n0 + rect.length, `clic droit au sol : « se déplacer » pour chaque unité sélectionnée (${moved} ordres journalisés)`);
  await page.keyboard.down("Shift");
  await page.mouse.click(centerX + 120, centerY - 40, { button: "right" });
  await page.keyboard.up("Shift");
  await page.waitForTimeout(300);
  expect((await num(page, "file")) >= 1 && (await page.locator(".rt-file li").count()) >= 1, `Maj + clic droit : ordre mis en file (${await ds(page, "file")} en attente, panneau « File d'ordres »)`);
  await page.locator('.rt-formations [data-formation="colonne"]').click();
  await page.waitForTimeout(200);
  expect(await probe(page, (p) => p.orders().some((o) => o.order === "formation")), "formation « colonne » donnée (bouton)");
  await page.waitForTimeout(1000);
  expect((await num(page, "tick")) === tick0, `pause active : la bataille n'avance pas pendant les ordres (pas ${tick0})`);
  await runFor(page, "1", 60);
  const applied = await probe(page, (p) => ({ moving: p.bt.state.squads.filter((s) => s.order === "deplacer").length, log: p.bt.state.log.filter((l) => l.key === "battle.rt.move" || l.key === "battle.rt.queued" || l.key === "battle.rt.formation").length, col: p.bt.state.squads.filter((s) => s.formation === "colonne").length }));
  expect(applied.log >= 3 && applied.col >= 1, `ordres appliqués à la reprise (carnet : ${applied.log} lignes de marche, file, formation ; ${applied.moving} unités en marche)`);
  await page.locator(".rt-unite[data-squad='esc_06']").click();
  const unitPos = await probe(page, (p) => {
    const i = p.bt.state.soldiers.findIndex((s) => s.squad === "esc_06" && s.mode !== "mort");
    const s = p.bt.state.soldiers[i];
    return s ? p.view.toScreen(s.x, s.y, s.z + 0.9) : null;
  });
  if (unitPos) {
    await page.keyboard.down("Alt");
    await page.mouse.click(box.x + unitPos[0], box.y + unitPos[1]);
    await page.keyboard.up("Alt");
    await page.keyboard.press("KeyD");
    await page.mouse.click(centerX - 100, centerY + 30);
  }
  await page.waitForTimeout(200);
  expect(await probe(page, (p) => p.orders().some((o) => o.order === "deplacer" && o.unit !== undefined)), "ordre d'unité : un homme seul envoyé ailleurs (Alt + clic, D, clic)");
  await page.locator(".rt-unite[data-squad='esc_08']").click();
  m = await marks(page);
  const t0 = m["titan:0"];
  if (t0) await page.mouse.click(box.x + t0[0], box.y + t0[1], { button: "right" });
  await page.waitForTimeout(200);
  expect(await probe(page, (p) => p.orders().some((o) => o.squad === "esc_08" && o.order === "tuer" && o.target !== undefined)), "clic droit sur un Titan : « attaquer » ce Titan");

  // Caméra : stratégique ↔ suivi (touche V).
  await page.locator(".rt-unite[data-squad='esc_02']").click();
  await page.keyboard.press("KeyV");
  await runFor(page, "1", 10);
  expect((await ds(page, "camera")) === "suivi" && (await probe(page, (p) => p.view.camera)) === "suivi", "touche V : caméra de suivi à la troisième personne (escouade sélectionnée)");
  await page.screenshot({ path: `${OUT}/r2-suivi-1366.png` });
  await page.keyboard.press("KeyV");
  await page.waitForTimeout(300);
  expect((await ds(page, "camera")) === "strategique", "touche V : retour à la vue stratégique");

  // Artillerie : tir sur zone, puis cessez-le-feu.
  // Retour de la caméra de suivi : la vue est centrée sur ce qu'on suivait ; on recule à la molette, comme un joueur,
  // jusqu'à voir un Titan ennemi debout (sinon, la zone est désignée au sol, au centre de la vue).
  // Point visé : les pieds du Titan (au sol), pour que le clic tombe sur la carte et non au-delà de son bord (essai 1 de
  // la passe de correctifs : visée à mi-hauteur d'un Titan du bord nord, rayon hors de la carte, aucune zone).
  const foeTitan = async (): Promise<[number, number] | undefined> => {
    const feet = await probe(page, (p) => p.bt.state.titans.map((ti) => (ti.alive && !ti.ally ? p.view.toScreen(ti.x, ti.y, 0) : null)));
    return feet.find((v): v is [number, number] => v !== null && v[0] > 20 && v[1] > 20 && v[0] < box.width - 20 && v[1] < box.height - 20);
  };
  let t1 = await foeTitan();
  for (let i = 0; i < 8 && !t1; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(150);
    t1 = await foeTitan();
  }
  await page.locator('.rt-batterie [data-action="tir-zone"]').first().click();
  expect((await ds(page, "mode")) === "tir_zone", "tir sur zone : désignation au clic (curseur en croix)");
  await page.mouse.click(box.x + (t1 ? t1[0] : box.width / 2), box.y + (t1 ? t1[1] : box.height / 2));
  await page.waitForTimeout(200);
  await runFor(page, "4", 600);
  const art = await probe(page, (p) => {
    const b = (p.bt.state.batteries ?? []).find((x) => x.side === "allie");
    return { zone: !!b?.zone, shots: b?.shots ?? 0, impacts: (p.bt.state.impacts ?? []).length };
  });
  expect(art.zone && art.shots > 0 && art.impacts > 0, `batterie : zone imposée${art.zone ? "" : " (aucune)"} ${t1 ? "sur un Titan ennemi" : "au centre de la vue (aucun Titan ennemi à l'écran)"}, ${art.shots} coups, ${art.impacts} impacts récents`);
  await page.screenshot({ path: `${OUT}/r2-artillerie-1366.png` });
  await page.locator('.rt-batterie [data-action="cessez-feu"]').first().click();
  await runFor(page, "1", 5);
  expect(await probe(page, (p) => !!(p.bt.state.batteries ?? []).find((x) => x.side === "allie")?.hold), "cessez-le-feu : la batterie se tait");

  // Porteur allié : ordre général (objectif, retenue, zone), jamais piloté.
  if ((await page.locator(".rt-porteur").count()) > 0) {
    await page.selectOption('.rt-porteur select[data-directive="objective"]', "titans");
    await page.selectOption('.rt-porteur select[data-directive="restraint"]', "stricte");
    await page.locator('.rt-porteur [data-action="zone-porteur"]').click();
    await page.mouse.click(centerX, centerY - 60);
    await page.locator('.rt-porteur [data-action="ordre-porteur"]').click();
    await runFor(page, "1", 4);
    const d = await probe(page, (p) => p.bt.state.shifters?.[0]?.directive ?? null);
    const carnet = await page.locator(".rt-carnet").innerText();
    expect(!!d && d.objective === "titans" && d.restraint === "stricte" && !!d.zone && carnet.includes("reçoit ses ordres"), `porteur : objectif « les Titans », retenue stricte, zone ; ordre au carnet${d && d.objective === "titans" && d.restraint === "stricte" && !!d.zone && carnet.includes("reçoit ses ordres") ? "" : ` (consigne ${JSON.stringify(d)} ; carnet ${carnet.includes("reçoit ses ordres") ? "oui" : "non"})`}`);
  } else expect(false, "porteur allié présent dans la bataille de compagnie");

  // Violence : sobre (sans sang).
  await page.locator('[data-action="options-bataille"]').click();
  await page.selectOption('.rt-options select[data-rt-option="violence"]', "sobre");
  await page.keyboard.press("Escape");
  expect((await ds(page, "violence")) === "sobre", "option de violence : sobre (sans sang) ; réaliste par défaut");
  await measure(page, "1366×768, 3D qualité moyenne", ready);
  const raw = (await page.locator(".bataille").innerText()).match(/\b(battle|rt|tac|order|formation)\.[a-z_]+(\.[a-z_]+)*/g) ?? [];
  expect(raw.length === 0, `aucune clé brute à l'écran${raw.length ? ` (${raw.slice(0, 4).join(", ")})` : ""}`);
  await close(page);
  await page.close();
  }

  // ——— 2. Bataille de campagne : contact d'armées (854), jouée en temps réel, reportée ———
  if (part("2")) {
  console.log("[854, Paradis] contact d'armées, 1366×768");
  const c = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(c, `${url}?scenario=scn_854&faction=fac_paradis&dossiers=0`, errors, "[campagne 854] ");
  await panel(c, "KeyS", "armees");
  await c.locator('.registre-panneau [data-army="army_854_sud"]').click();
  await c.waitForTimeout(200);
  await c.locator('[data-action="choisir"]').click();
  await clickProvince(c, "prov_maria_sud_est");
  await c.locator('[data-action="marcher"]').click();
  await c.waitForTimeout(300);
  await c.keyboard.press("Escape");
  await consoleLine(c, "advance 6", "6");
  await panel(c, "KeyD", "diplomatie");
  await c.locator('.fiche-nation[data-nation="fac_marley"]').click();
  await c.locator('[data-action="guerre"]').click();
  await c.locator('[data-confirm="oui"]').click();
  await c.waitForTimeout(300);
  await c.keyboard.press("Escape");
  await consoleLine(c, "advance 5", "5");
  await panel(c, "KeyS", "armees");
  await c.locator('.registre-panneau [data-army="army_854_sud"]').click();
  await c.waitForTimeout(200);
  await c.locator('[data-action="intercepter"]').click();
  await c.waitForTimeout(200);
  await c.locator('[data-action="forcee"]').click();
  await c.waitForTimeout(200);
  await c.keyboard.press("Escape");
  let contact = false;
  for (let i = 0; i < 16 && !contact; i++) {
    await consoleLine(c, "advance 10", "10");
    contact = (await c.locator(".armee__rencontre").count()) > 0;
  }
  expect(contact, "contact d'armées : alerte et choix (auto, jouer, repli)");
  if (contact) {
    const kind = await c.locator(".armee__rencontre h3").first().innerText();
    await c.locator('.armee__rencontre [data-action="jouer"]').click();
    await c.waitForSelector(".bataille--rt", { timeout: 60000 });
    await frames(c, 2);
    const cu = await num(c, "unites");
    const cbox = await sceneBox(c);
    expect(cu >= 100 && cu <= 400, `« ${kind} » jouée sur l'écran temps réel : ${cu} unités (vue ${await ds(c, "vue")})`);
    await c.locator(".rt-unite").first().click();
    await c.mouse.click(cbox.x + cbox.width * 0.5, cbox.y + cbox.height * 0.4, { button: "right" });
    await c.waitForTimeout(200);
    const given = await num(c, "ordres");
    expect(given >= 1, `ordre donné pendant la bataille de campagne (${given} au journal)`);
    await runFor(c, "2", 300);
    await c.screenshot({ path: `${OUT}/r2-campagne-1366.png` });
    await c.locator('[data-action="quitter"]').click();
    await c.waitForSelector(".bilan", { timeout: 240000 });
    const bilan = await c.locator(".bilan").innerText();
    expect(bilan.includes(fr["tac.sum.troops_killed"]) && bilan.includes(fr["tac.sum.routs"]), "bilan : fantassins tombés de chaque camp, sections débandées");
    const unexplained = await c.$$eval(".bilan .valeur", (els) => els.filter((e) => !(e as HTMLElement).dataset["why"]).length);
    expect(unexplained === 0, "bilan : chaque valeur a son « pourquoi ? »");
    await c.locator(".bilan").screenshot({ path: `${OUT}/r2-bilan-1366.png` });
    await c.locator('.bilan [data-action="valider"]').click();
    await c.waitForTimeout(1200);
    const left2 = await c.locator(".armee__rencontre").count();
    expect(left2 === 0 && !(await c.locator(".bataille").count()), "rencontre reportée à la campagne (ordres rejoués par la simulation, dette n° 33)");
  }
  await c.close();
  }

  // ——— 3. Repli 2D sans WebGL 2 : message, three.js jamais téléchargé ———
  if (part("3")) {
  console.log("[850] sans WebGL 2, 1366×768");
  const p2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p2.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2") return null;
      return (orig as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const req2: string[] = [];
  p2.on("request", (r) => req2.push(r.url()));
  await open(p2, `${url}?dossiers=0`, errors, "[repli 2D] ");
  await company(p2, { map: "tmap_plaine", count: 3, men: 60, enemy: 90, shifter: false });
  const msg = await p2.locator(".rt-message").innerText();
  expect((await ds(p2, "vue")) === "2d" && (await ds(p2, "repli")) === "1" && msg.includes("WebGL"), `repli 2D avec message : « ${msg.slice(0, 90)} »`);
  expect(!req2.some((u) => /three|battle\/view3d/.test(u)), "repli 2D : three.js et la vue 3D jamais téléchargés");
  const b2 = await sceneBox(p2);
  await p2.locator(".rt-unite").first().click();
  await p2.mouse.click(b2.x + b2.width * 0.4, b2.y + b2.height * 0.3, { button: "right" });
  await runFor(p2, "2", 80);
  expect((await num(p2, "ordres")) >= 1 && (await num(p2, "frames")) > 5, "vue 2D : sélection, ordre, bataille qui avance");
  await p2.screenshot({ path: `${OUT}/r2-repli-2d-1366.png` });
  await close(p2);
  await p2.close();
  }

  // ——— 4. 1920×1080 et 3840×2160 : vues stratégique et suivi, mesures ———
  for (const [w, h] of part("4") ? ([[1920, 1080], [3840, 2160]] as const) : []) {
    console.log(`[850, essai de compagnie] ${w}×${h}`);
    const pg = await browser.newPage({ viewport: { width: w, height: h } });
    await open(pg, `${url}?dossiers=0`, errors, `[${w}] `);
    const r = await company(pg, { map: "tmap_ville", count: 4, men: 120, enemy: 150, shifter: true });
    await runFor(pg, "1", 20);
    await pg.screenshot({ path: `${OUT}/r2-strategique-${w}.png` });
    await pg.locator(".rt-unite[data-squad='esc_05']").click();
    await pg.keyboard.press("KeyV");
    await runFor(pg, "1", 10);
    await pg.screenshot({ path: `${OUT}/r2-suivi-${w}.png` });
    expect((await ds(pg, "camera")) === "suivi" && (await num(pg, "frames")) >= 4, `${w}×${h} : vues stratégique et suivi rendues (${await ds(pg, "frames")} images)`);
    await pg.keyboard.press("KeyV");
    await measure(pg, `${w}×${h}, 3D qualité moyenne`, r);
    await close(pg);
    await pg.close();
  }

  // ——— 5. three.js hors du bundle principal (dist/ de `npm run build`) ———
  if (!part("5")) console.log("(partie 5 non jouée)");
  else if (existsSync("dist/index.html")) {
    const html = readFileSync("dist/index.html", "utf8");
    const main = /src="(?:\.\/|\/)?(assets\/index-[^"]+\.js)"/.exec(html)?.[1] ?? "";
    const text = main ? readFileSync(`dist/${main}`, "utf8") : "";
    const chunks = readdirSync("dist/assets").filter((f) => f.endsWith(".js") && `assets/${f}` !== main);
    const view3d = chunks.find((f) => /view3d/.test(f));
    expect(!!main && (text.match(/THREE\./g) ?? []).length === 0 && !!view3d, `bundle principal ${main} sans three.js ; vue 3D de bataille en morceau à part (${view3d ?? "morceau introuvable"})`);
  } else expect(false, "dist/ absent : lancer `npm run build` avant smoke:r2");

  // Sans WebGL 2 simulé, Pixi passe en WebGL 1 et le pilote signale des paramètres de texture propres à WebGL 2 (avertissements
  // de Pixi, pas du jeu) : comptés à part (dette n° 47) ; toute autre erreur ou alerte fait échouer.
  const webgl1 = errors.filter((e) => e.startsWith("[repli 2D]") && /INVALID_ENUM: texParameter/.test(e));
  const others = errors.filter((e) => !webgl1.includes(e));
  if (webgl1.length) console.log(`  ..  repli 2D (WebGL 1 simulé) : ${webgl1.length} avertissements de Pixi « texParameter: invalid parameter name »`);
  expect(others.length === 0, `0 erreur console${others.length ? ` (${others.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

console.log("Mesures (rendu logiciel SwiftShader, sans GPU ; à vérifier sur le PC de l'utilisateur) :");
for (const l of measures) console.log(`  ${l}`);
if (failures.length) {
  console.error(`smoke:r2 : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:r2 : tout est conforme.");
