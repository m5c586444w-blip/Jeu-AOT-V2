// npm run smoke:r0 -- <avant|apres> — contrôles et captures de la phase R0 (docs/phases/R0.md), dans un vrai navigateur.
// Lancé sur le commit d'avant R0, il produit les captures « avant » et la sortie en échec ; sur le code corrigé, les
// captures « après » et la sortie verte. Contrôles :
//   a. sous-titres : jamais deux lignes identiques à l'écran ;
//   b. aucune chaîne de développement hors debug (menu, HUD) ; Graine et Empreinte visibles en debug (F2) ;
//   c. légende « Calques » jamais recouverte par une fenêtre (registre, dossier de province, options) ;
//   d. atlas du monde : aucun nom de province qui en chevauche un autre ; moitié droite de la fenêtre occupée ;
//   e. bilan : capture (le décompte est vérifié par tests/sim/battle-summary.test.ts) ;
//   f. transformation : le porteur est dans le champ de la caméra quand l'éclair part ;
//   g. épilogue : aucune case « 0 » ;
//   3. zone de jeu ≥ 85 % de l'espace disponible (D-78), carte stratégique et bataille, 1366×768 et 3840×2160.
// Zone de jeu (D-78), sur une grille de 48 × 27 points par `elementFromPoint` :
//   - carte : espace disponible = fenêtre sous le bandeau ; zone de jeu = points où le canevas de la carte est au premier plan ;
//   - bataille : espace disponible = boîte de la scène ; zone de jeu = points où le canevas est au premier plan × part du sol.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createServer } from "vite";

const executablePath = process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium";
const tag = process.argv[2] === "apres" ? "apres" : "avant";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const isDriverNoise = (text: string): boolean => /GL Driver Message|GPU stall due to ReadPixels/.test(text);
const failures: string[] = [];
const expect = (cond: boolean, label: string): void => {
  if (cond) console.log(`  OK  ${label}`);
  else {
    failures.push(label);
    console.error(`  KO  ${label}`);
  }
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Part (0–1) des points de la boîte où le premier élément touché est `target`. */
async function share(page: Page, box: Box, target: string): Promise<number> {
  return page.evaluate(
    ({ box, target }) => {
      const t = document.querySelector(target);
      let hit = 0;
      let n = 0;
      for (let i = 0; i < 48; i++)
        for (let j = 0; j < 27; j++) {
          n++;
          if (document.elementFromPoint(box.x + ((i + 0.5) / 48) * box.w, box.y + ((j + 0.5) / 27) * box.h) === t) hit++;
        }
      return hit / n;
    },
    { box, target },
  );
}

async function rect(page: Page, sel: string): Promise<Box> {
  return page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
}

/** Part de la surface de la légende « Calques » recouverte par `win` (0 si la légende est masquée). */
async function legendCovered(page: Page, win: string): Promise<number> {
  return page.evaluate((win) => {
    const leg = document.querySelector<HTMLElement>(".calques");
    const w = document.querySelector(win);
    if (!leg || !w || leg.hidden || getComputedStyle(leg).display === "none" || getComputedStyle(leg).visibility === "hidden") return 0;
    const a = leg.getBoundingClientRect();
    const b = w.getBoundingClientRect();
    const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return a.width * a.height > 0 ? (ix * iy) / (a.width * a.height) : 0;
  }, win);
}

// fs.strict désactivé : lancé depuis un worktree dont node_modules est un lien, Vite doit pouvoir servir les polices.
/**
 * R0, item 2 : recouvrements (boîtes englobantes) des lignes de sous-titres avec les pastilles d'escouade, les flèches de bord
 * (marqueurs de la scène, via battleProbe) et le HUD de bataille (barre de titre, carnet, cartes d'escouade).
 */
async function subtitleOverlaps(page: Page): Promise<{ lines: number; hits: string[] }> {
  return page.evaluate(async () => {
    const path = "/src/ui/tactical/battleScreen.ts";
    const m = (await import(path)) as { battleProbe: { markers: (() => readonly { x0: number; y0: number; x1: number; y1: number }[]) | null } };
    const scene = document.querySelector(".bataille-scene")?.getBoundingClientRect();
    const boxes: { name: string; x0: number; y0: number; x1: number; y1: number }[] = [];
    if (scene) for (const b of m.battleProbe.markers?.() ?? []) boxes.push({ name: "marqueur", x0: b.x0 + scene.left, y0: b.y0 + scene.top, x1: b.x1 + scene.left, y1: b.y1 + scene.top });
    for (const sel of [".bataille-tete", ".bataille-carnet", ".bataille-escouades"]) {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      if (r) boxes.push({ name: sel, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
    }
    const lines = [...document.querySelectorAll(".sous-titres__ligne")].map((e) => e.getBoundingClientRect());
    const hits: string[] = [];
    for (const l of lines)
      for (const b of boxes) if (l.left < b.x1 && b.x0 < l.right && l.top < b.y1 && b.y0 < l.bottom) hits.push(b.name);
    return { lines: lines.length, hits };
  });
}

const server = await createServer({ server: { port: 5193, strictPort: false, fs: { strict: false } }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5193/";
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors: string[] = [];

try {
  for (const [w, h] of [[1366, 768], [3840, 2160]] as const) {
    const res = `${w}×${h}`;
    console.log(`[${res}]`);
    const suffix = w === 1366 ? "" : "-4k";
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript("window.__name = (f) => f;");
    // Relevé des textes dessinés sur l'atlas du monde (contrôle d) : boîte englobante de chaque appel à fillText.
    await page.addInitScript(() => {
      const boxes: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];
      Object.assign(window, { __atlasText: boxes });
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
        // Les pastilles chiffrées (nombre de Titans) ne sont pas des noms de province.
        if (this.canvas.classList.contains("atlas-monde") && !/^\d+$/.test(text)) {
          const m = this.measureText(text);
          const tf = this.getTransform();
          const width = m.width;
          const ascent = m.actualBoundingBoxAscent;
          const descent = m.actualBoundingBoxDescent;
          const left = this.textAlign === "center" ? x - width / 2 : this.textAlign === "right" || this.textAlign === "end" ? x - width : x;
          const p0 = tf.transformPoint(new DOMPoint(left, y - ascent));
          const p1 = tf.transformPoint(new DOMPoint(left + width, y + descent));
          boxes.push({ text, x0: Math.min(p0.x, p1.x), y0: Math.min(p0.y, p1.y), x1: Math.max(p0.x, p1.x), y1: Math.max(p0.y, p1.y) });
        }
        return maxWidth === undefined ? orig.call(this, text, x, y) : orig.call(this, text, x, y, maxWidth);
      };
    });
    page.on("console", (m) => {
      if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    const shot = async (name: string, sel?: string): Promise<void> => {
      const path = `${OUT}/r0-${tag}${suffix}-${name}.${w === 1366 ? "png" : "jpg"}`;
      const opts = w === 1366 ? { path } : { path, type: "jpeg" as const, quality: 60 };
      // Capture par rectangle : les fenêtres légèrement tournées ne sont jamais « stables » pour une capture d'élément.
      const clip = sel ? await rect(page, sel) : null;
      await page.screenshot(clip ? { ...opts, clip: { x: Math.max(0, clip.x), y: Math.max(0, clip.y), width: Math.min(clip.w, w - Math.max(0, clip.x)), height: Math.min(clip.h, h - Math.max(0, clip.y)) } } : opts);
    };

    // ——— b. Menu ———
    await page.goto(`${url}?menu=1`);
    await page.waitForSelector(".table-archives", { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    const menuText = await page.locator(".table-archives").innerText();
    expect(!/Registre de travail|phase de fondation/i.test(menuText), `b. menu : aucune chaîne de développement (« Registre de travail — phase de fondation » ${/Registre de travail/.test(menuText) ? "présent" : "absent"})`);
    if (w === 1366) await shot("menu");

    // ——— Carte stratégique : 3 (zone de jeu), b (HUD), c (légende) ———
    await page.goto(`${url}?scenario=scn_sandbox_850&dossiers=0`);
    await page.waitForSelector("html[data-ready='true']", { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const band = await rect(page, ".bandeau");
    const avail = { x: 0, y: band.y + band.h, w, h: h - (band.y + band.h) };
    const mapShare = await share(page, avail, ".carte canvas");
    const mapWindow = await share(page, { x: 0, y: 0, w, h }, ".carte canvas");
    console.log(`      3. carte stratégique, fenêtre entière (${w}×${h}, bandeau compris) : ${(100 * mapWindow).toFixed(1)} %`);
    expect(mapShare >= 0.85, `3. carte stratégique : zone de jeu ${(100 * mapShare).toFixed(1)} % de l'espace disponible (${Math.round(avail.w)}×${Math.round(avail.h)} px sous le bandeau ; ≥ 85 %)`);
    const hud = await page.locator(".bandeau").innerText();
    expect(!/Graine|Empreinte/.test(hud), `b. HUD hors debug : « Graine » ${/Graine/.test(hud) ? "visible" : "masquée"}, « Empreinte d'état » ${/Empreinte/.test(hud) ? "visible" : "masquée"}`);
    await page.keyboard.press("F2");
    await page.waitForTimeout(200);
    const hudDebug = await page.locator(".bandeau").innerText();
    expect(/Graine/.test(hudDebug) && /Empreinte/.test(hudDebug), "b. HUD en debug (F2) : Graine et Empreinte d'état affichées");
    await page.keyboard.press("F2");
    await page.waitForTimeout(200);
    await shot("carte");
    if (w === 1366) await shot("hud", ".bandeau");
    await page.locator('.bandeau__registre-bouton[data-panel="personnages"]').click();
    await page.waitForSelector('.registre-panneau[data-panel="personnages"]:not([hidden])');
    await page.waitForTimeout(200);
    const covReg = await legendCovered(page, ".registre-panneau:not([hidden])");
    expect(covReg === 0, `c. légende « Calques » recouverte par un registre ouvert : ${(100 * covReg).toFixed(0)} % de sa surface`);
    if (w === 1366) await shot("calques");
    await page.keyboard.press("Escape");
    const map = await rect(page, ".carte canvas");
    await page.mouse.click(map.x + map.w / 2, map.y + map.h / 2 + map.h * 0.235);
    await page.waitForSelector(".dossier:visible", { timeout: 10000 });
    const covDos = await legendCovered(page, ".dossier");
    expect(covDos === 0, `c. légende « Calques » recouverte par le dossier de province : ${(100 * covDos).toFixed(0)} %`);
    await page.keyboard.press("Escape");
    await page.keyboard.press("F9");
    await page.waitForSelector(".options:not([hidden])");
    const covOpt = await legendCovered(page, ".options");
    expect(covOpt === 0, `c. légende « Calques » recouverte par les options : ${(100 * covOpt).toFixed(0)} %`);
    await page.keyboard.press("F9");
    await page.waitForTimeout(200);
    const legendBack = await page.$eval(".calques", (e) => !(e as HTMLElement).hidden && getComputedStyle(e).display !== "none");
    expect(legendBack, "c. la légende revient quand les fenêtres sont fermées");

    // ——— g. Épilogue (850, premier jour) ———
    await page.locator('.bandeau__registre-bouton[data-panel="epilogue"]').click();
    await page.waitForSelector('.registre-panneau[data-panel="epilogue"]:not([hidden])');
    const zeros = await page.$$eval(".epilogue__chiffres tr", (trs) => trs.filter((tr) => tr.querySelector("td")?.textContent?.trim() === "0").map((tr) => tr.querySelector("th")?.textContent?.trim() ?? ""));
    expect(zeros.length === 0, `g. épilogue : ${zeros.length} case(s) à « 0 »${zeros.length ? ` (${zeros.join(", ")})` : ""}`);
    if (w === 1366) await shot("epilogue", ".registre-panneau:not([hidden])");
    await page.keyboard.press("Escape");

    // ——— Bataille d'essai (ville, 4 Titans, 36 hommes) : 3 (zone de jeu), a (sous-titres), e (bilan) ———
    await page.mouse.click(Math.round(w / 2), Math.round(h * 0.6));
    await page.keyboard.press("Escape");
    await page.locator('.bandeau__registre-bouton[data-panel="expeditions"]').click();
    await page.waitForSelector('.registre-panneau[data-panel="expeditions"]:not([hidden])');
    await page.selectOption('select[data-trial="map"]', "tmap_ville");
    await page.fill('input[data-trial="count"]', "4");
    await page.fill('input[data-trial="men"]', "36");
    await page.locator('[data-action="essai"]').click();
    await page.waitForSelector(".bataille canvas", { timeout: 30000 });
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"] ?? "-1") >= 0);
    await page.waitForTimeout(500);
    const scene = await rect(page, ".bataille-scene");
    const canvasShare = await share(page, scene, ".bataille-scene canvas");
    const cover = Number(await page.getAttribute(".bataille", "data-couverture"));
    const battleShare = canvasShare * cover;
    const battleWindow = (await share(page, { x: 0, y: 0, w, h }, ".bataille-scene canvas")) * cover;
    console.log(`      3. bataille, fenêtre entière (${w}×${h}, titre, carnet et cartes d'escouade compris) : ${(100 * battleWindow).toFixed(1)} %`);
    expect(battleShare >= 0.85, `3. bataille : zone de jeu ${(100 * battleShare).toFixed(1)} % de la scène (${Math.round(scene.w)}×${Math.round(scene.h)} px ; canevas au premier plan ${(100 * canvasShare).toFixed(1)} % × sol ${(100 * cover).toFixed(1)} % ; ≥ 85 %)`);
    // Hommes du joueur dans le champ à l'ouverture (relevé sur la capture « bataille » en appliquant la règle de CLAUDE.md).
    const inFrame = await page.evaluate(async () => {
      const path = "/src/ui/tactical/battleScreen.ts";
      const m = (await import(path)) as { battleProbe: { soldierOnScreen: ((i: number) => [number, number] | null) | null } };
      const r = document.querySelector(".bataille-scene")?.getBoundingClientRect();
      let seen = 0;
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const q = m.battleProbe.soldierOnScreen?.(i);
        if (q === undefined) break;
        if (!q || !r) continue;
        n++;
        if (q[0] >= 0 && q[1] >= 0 && q[0] <= r.width && q[1] <= r.height) seen++;
      }
      return { seen, n };
    });
    expect(inFrame.n > 0 && inFrame.seen / inFrame.n >= 0.9, `3. bataille : hommes du joueur dans le champ à l'ouverture ${inFrame.seen}/${inFrame.n} (≥ 90 %)`);
    await shot("bataille");
    await page.locator('.bataille-vitesse[data-speed="2"]').click();
    let maxDup = 0;
    let dupText = "";
    let seenLines = 0;
    const subHits = new Map<string, number>();
    for (let k = 0; k < 40; k++) {
      await page.waitForTimeout(250);
      const ov = await subtitleOverlaps(page);
      seenLines += ov.lines;
      for (const hname of ov.hits) subHits.set(hname, (subHits.get(hname) ?? 0) + 1);
      const lines = await page.locator(".sous-titres__ligne").allInnerTexts();
      const counts = new Map<string, number>();
      for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
      for (const [text, c] of counts)
        if (c > maxDup) {
          maxDup = c;
          dupText = text;
        }
      if (w === 1366 && k === 12) await shot("sous-titres");
    }
    expect(maxDup <= 1, `a. sous-titres : au plus ${maxDup} ligne(s) identique(s) à l'écran en 10 s de bataille${maxDup > 1 ? ` (« ${dupText} »)` : ""}`);
    expect(seenLines > 0 && subHits.size === 0, `2. sous-titres : ${seenLines} relevés de lignes en 10 s, recouvrements avec pastilles, flèches et HUD : ${subHits.size ? [...subHits].map(([k, v]) => `${k} ×${v}`).join(", ") : "aucun"}`);
    await page.waitForSelector(".bilan", { timeout: 300000 });
    if (w === 1366) {
      const bilan = (await page.locator(".bilan table").innerText()).replace(/\s+/g, " ");
      console.log(`      bilan : ${bilan}`);
      await shot("bilan", ".bilan");
    }
    await page.locator('.bataille [data-action="quitter"]').click();
    await page.waitForFunction(() => !document.querySelector(".bataille"));

    // ——— f. Transformation : essai de porteur (Cuirassé ennemi, forêt) ———
    if (w === 1366) {
      await page.locator('.bandeau__registre-bouton[data-panel="porteurs"]').click();
      await page.waitForSelector('.registre-panneau[data-panel="porteurs"]:not([hidden])');
      await page.selectOption('select[data-trial="shifter"]', "shifter_cuirasse");
      await page.selectOption('select[data-trial="side"]', "ennemi");
      await page.selectOption('select[data-trial="map"]', "tmap_foret");
      await page.locator('[data-action="essai-porteur"]').click();
      await page.waitForSelector(".bataille canvas", { timeout: 30000 });
      await page.locator('.bataille-vitesse[data-speed="0.25"]').click();
      await page.waitForFunction(() => document.querySelector<HTMLElement>(".bataille")?.dataset["porteurVisible"] !== undefined, undefined, { timeout: 90000 }).catch(() => undefined);
      await page.locator('.bataille-vitesse[data-speed="0"]').click();
      const fx = (await page.getAttribute(".bataille", "data-fx")) ?? "";
      const seen = (await page.getAttribute(".bataille", "data-porteur-visible")) ?? "non mesuré";
      expect(seen === "oui", `f. transformation : porteur et éclair dans le champ de la caméra : ${seen} (${fx})`);
      await shot("transformation");
      await page.locator('.bataille [data-action="quitter"]').click();
      await page.waitForFunction(() => !document.querySelector(".bataille"));
    }

    // ——— d. Atlas du monde, Marley en 854 ———
    await page.goto(`${url}?scenario=scn_854&faction=fac_marley&dossiers=0`);
    await page.waitForSelector("html[data-ready='true']", { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector(".atlas-monde")?.getAttribute("data-drawn") === "61");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const overlaps = await page.evaluate(() => {
      const all = (window as unknown as { __atlasText: { text: string; x0: number; y0: number; x1: number; y1: number }[] }).__atlasText;
      // Un même tracé peut être répété (survol) : on garde la dernière boîte de chaque texte.
      const last = new Map<string, (typeof all)[number]>();
      for (const b of all) last.set(b.text, b);
      const boxes = [...last.values()];
      const pairs: string[] = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          if (a && b && a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5) pairs.push(`${a.text} / ${b.text}`);
        }
      return { n: boxes.length, pairs };
    });
    expect(overlaps.n > 0 && overlaps.pairs.length === 0, `d. atlas du monde : ${overlaps.n} noms tracés, ${overlaps.pairs.length} chevauchement(s)${overlaps.pairs.length ? ` (${overlaps.pairs.slice(0, 4).join(" ; ")})` : ""}`);
    // Bande à droite de l'atlas, sur la hauteur de l'atlas : c'est là que la fenêtre était vide (revue de P8).
    const atlas = await rect(page, ".atlas-monde");
    const body = await rect(page, ".registre-panneau:not([hidden]) .registre-corps");
    const beside = { x: atlas.x + atlas.w, y: atlas.y, w: body.x + body.w - (atlas.x + atlas.w), h: Math.min(atlas.h, h - atlas.y) };
    const right = await page.evaluate((p) => {
      const containers = new Set([".registre-corps", ".table-guerre", ".table-guerre__dossier"].map((q) => document.querySelector(".registre-panneau:not([hidden]) " + q)));
      let filled = 0;
      let n = 0;
      for (let i = 0; i < 16; i++)
        for (let j = 0; j < 20; j++) {
          n++;
          const e = document.elementFromPoint(p.x + ((i + 0.5) / 16) * p.w, p.y + ((j + 0.5) / 20) * p.h);
          if (e && !containers.has(e) && e.closest(".registre-panneau:not([hidden]) .registre-corps")) filled++;
        }
      return filled / n;
    }, beside);
    expect(right >= 0.5, `d. atlas du monde : bande à droite de l'atlas occupée à ${(100 * right).toFixed(0)} % (≥ 50 %)`);
    await shot("atlas", ".registre-panneau:not([hidden])");
    await page.close();
  }
  expect(errors.length === 0, `0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:r0 (${tag}) : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log(`smoke:r0 (${tag}) : tout est conforme.`);
