// npm run smoke:p8 — revue par écran de P8 (AC8-01 à AC8-07) dans un vrai navigateur (Chromium, serveur de dev Vite).
// Chaque écran de 04 §5 est ouvert à 1366×768 et à 3840×2160, à l'échelle d'interface 100 % et 125 %, et passe la checklist
// 04 §2 par contrôles automatiques : polices du projet, aucune icône générique ni emoji, aucun « card + shadow + rounded »,
// texture sur deux niveaux au moins, valeurs expliquées, aucun texte factice ni clé brute, aucun débordement.
// S'y ajoutent : bandeau sur une ligne et alerte de la nation jouée (AC8-04), scène tactique (AC8-05), audio (AC8-06),
// récits (AC8-07). Captures : docs/screenshots/p8-*.png (1366×768, 100 %) et p8-4k-*.jpg (3840×2160, 125 %).
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
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
const PROJECT_FONTS = ["IM Fell English", "EB Garamond", "Special Elite", "UnifrakturMaguntia"];

interface Pass {
  w: number;
  h: number;
  scale: number;
  tag: string;
}
const PASSES: readonly Pass[] = [
  { w: 1366, h: 768, scale: 100, tag: "1366×768 · 100 %" },
  { w: 1366, h: 768, scale: 125, tag: "1366×768 · 125 %" },
  { w: 3840, h: 2160, scale: 100, tag: "3840×2160 · 100 %" },
  { w: 3840, h: 2160, scale: 125, tag: "3840×2160 · 125 %" },
];
const SHOT_4K = new Set(["menu", "hud", "archives", "bataille", "monde-marley"]);

/** Checklist 04 §2, mesurée dans la page sur la portée de l'écran. */
interface Checklist {
  fonts: string[];
  fontsLoaded: boolean;
  icons: string[];
  cardLook: string[];
  textureLevels: number;
  unexplained: number;
  values: number;
  placeholder: string[];
  hOverflow: boolean;
  outside: boolean;
  clipped: string[];
  minFont: number;
}

async function checklist(page: Page, scope: string): Promise<Checklist> {
  return page.evaluate(
    ({ scope, fonts }) => {
      const root = document.querySelector<HTMLElement>(scope);
      if (!root) throw new Error(`portée absente : ${scope}`);
      const all = [root, ...root.querySelectorAll<HTMLElement>("*")];
      const visible = (e: Element): boolean => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
      };
      const label = (e: Element): string => `${e.tagName.toLowerCase()}.${(e.getAttribute("class") ?? "").split(" ")[0] ?? ""}`;
      const badFonts = new Set<string>();
      const used = new Set<string>();
      let minFont = Infinity;
      const placeholder: string[] = [];
      const emoji = /\p{Extended_Pictographic}/u;
      for (const e of all) {
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0);
        if (!own || !visible(e) || e.closest("[aria-hidden='true'], .lecteur-seul, svg")) continue;
        const cs = getComputedStyle(e);
        const first = cs.fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
        if (!fonts.includes(first)) badFonts.add(`${label(e)} (${first})`);
        else used.add(first);
        minFont = Math.min(minFont, parseFloat(cs.fontSize));
        const txt = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join(" ");
        if (/lorem|ipsum|\bTODO\b|placeholder|\bundefined\b|\bNaN\b|\[object|\{[a-z_]+\}/i.test(txt) || emoji.test(txt)) placeholder.push(txt.trim().slice(0, 40));
      }
      // Icônes : uniquement nos SVG dessinés ; aucune police d'icônes ni bibliothèque.
      const icons = all.filter((e) => /\b(fa|fa-[a-z-]+|lucide|material-icons|bi-[a-z-]+|glyphicon)\b/.test(e.getAttribute("class") ?? "") || e.tagName === "I" && getComputedStyle(e, "::before").content !== "none" && getComputedStyle(e, "::before").content !== "normal").map(label);
      // « card + shadow + rounded » : coins arrondis (≥ 6 px) et ombre floue (> 1 px), le « look SaaS » proscrit.
      const cardLook = all
        .filter((e) => {
          const cs = getComputedStyle(e);
          if (cs.boxShadow === "none" || parseFloat(cs.borderTopLeftRadius) < 6 || cs.borderTopLeftRadius.endsWith("%")) return false;
          return cs.boxShadow.split(/,(?![^(]*\))/).some((sh) => (parseFloat((sh.replace(/rgba?\([^)]*\)/, "").trim().split(/\s+/)[2] ?? "0")) || 0) > 1);
        })
        .map(label);
      // Textures : fond, cadre, objet — éléments à image de fond (grain, fibres, hachures) sur la chaîne et dans la portée.
      const chain: Element[] = [];
      for (let p: Element | null = root.parentElement; p; p = p.parentElement) chain.push(p);
      const textured = [...chain, ...all].filter((e) => getComputedStyle(e).backgroundImage !== "none" || e.tagName === "CANVAS");
      const vals = root.querySelectorAll<HTMLElement>(".valeur");
      const r = root.getBoundingClientRect();
      // Texte coupé : bloc à débordement masqué dont le contenu dépasse (hors zones à défilement voulues).
      const clipped = all
        .filter((e) => {
          if (!visible(e) || e.tagName === "CANVAS" || e.tagName === "SELECT" || e.tagName === "INPUT" || e.closest(".lecteur-seul")) return false;
          const cs = getComputedStyle(e);
          if (!/hidden|clip/.test(cs.overflowX) || cs.textOverflow === "ellipsis") return false;
          return e.scrollWidth > e.clientWidth + 2 && (e.textContent ?? "").trim().length > 0;
        })
        .map(label);
      return {
        fonts: [...badFonts].slice(0, 6),
        fontsLoaded: [...used].every((f) => document.fonts.check(`16px "${f}"`)),
        icons,
        cardLook: cardLook.slice(0, 6),
        textureLevels: textured.length,
        unexplained: [...vals].filter((e) => !e.dataset["why"]).length,
        values: vals.length,
        placeholder: placeholder.slice(0, 4),
        hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        outside: r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1,
        clipped: [...new Set(clipped)].slice(0, 6),
        minFont: minFont === Infinity ? 0 : minFont,
      };
    },
    { scope, fonts: PROJECT_FONTS },
  );
}

/** Applique la checklist 04 §2 à un écran ; aucune clé ni identifiant brut visible. */
async function review(page: Page, pass: Pass, name: string, scope: string, opts: { minTexture?: number } = {}): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const c = await checklist(page, scope);
  const visible = await page.locator(scope).first().innerText();
  const raw = Object.keys(fr).filter((k) => k.includes(".") && visible.includes(k));
  const ids = [...new Set(visible.match(/\b(prov|char|org|str|evt|tech|secret|agent|rap|shifter|ttype|tmap|wprov|fac|form|scn)_[a-z0-9_]+/g) ?? [])];
  const minFont = 11 * (pass.scale / 100) - 0.6;
  const problems: string[] = [];
  if (c.fonts.length) problems.push(`polices hors projet : ${c.fonts.join(", ")}`);
  if (!c.fontsLoaded) problems.push("polices du projet non chargées");
  if (c.icons.length) problems.push(`icônes génériques : ${c.icons.join(", ")}`);
  if (c.cardLook.length) problems.push(`card + shadow + rounded : ${c.cardLook.join(", ")}`);
  if (c.textureLevels < (opts.minTexture ?? 2)) problems.push(`textures sur ${c.textureLevels} niveau(x)`);
  if (c.unexplained) problems.push(`${c.unexplained} valeur(s) sans « pourquoi ? »`);
  if (c.placeholder.length || raw.length || ids.length) problems.push(`texte factice ou brut : ${[...c.placeholder, ...raw, ...ids].slice(0, 4).join(" | ")}`);
  if (c.hOverflow || c.outside) problems.push("débordement hors de la fenêtre");
  if (c.clipped.length) problems.push(`texte coupé : ${c.clipped.join(", ")}`);
  if (c.minFont < minFont) problems.push(`corps minimal ${c.minFont} px < ${minFont.toFixed(1)} px`);
  expect(problems.length === 0, `${name} [${pass.tag}] : checklist 04 §2 (${c.values} valeurs expliquées, textures sur ${c.textureLevels} niveaux, corps ≥ ${c.minFont} px)${problems.length ? ` — ${problems.join(" ; ")}` : ""}`);
}

async function shot(page: Page, pass: Pass, name: string, scope?: string): Promise<void> {
  if (pass.w === 1366 && pass.scale === 100) {
    if (scope) await page.locator(scope).first().screenshot({ path: `${OUT}/p8-${name}.png` });
    else await page.screenshot({ path: `${OUT}/p8-${name}.png` });
  } else if (pass.w === 3840 && pass.scale === 125 && SHOT_4K.has(name)) await page.screenshot({ path: `${OUT}/p8-4k-${name}.jpg`, type: "jpeg", quality: 60 });
}

async function console_(page: Page, line: string, expectText: string): Promise<void> {
  await page.keyboard.press("F2");
  await page.locator(".debug-console input").fill(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(".debug-console__log")?.textContent?.includes(s), expectText, { timeout: 120000 });
  await page.keyboard.press("F2");
}

async function openPanel(page: Page, id: string): Promise<void> {
  if (await page.locator(".options:not([hidden])").count()) await page.keyboard.press("F9");
  await page.locator(`.bandeau__registre-bouton[data-panel="${id}"]`).click();
  await page.waitForSelector(`.registre-panneau[data-panel="${id}"]:not([hidden])`);
  await page.waitForTimeout(150);
}

async function newPage(browser: Browser, pass: Pass, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: pass.w, height: pass.h } });
  // tsx nomme les fonctions locales par `__name(...)` : on le définit dans la page pour les `evaluate`.
  await page.addInitScript("window.__name = (f) => f;");
  await page.addInitScript((scale) => {
    try {
      localStorage.setItem("murs-et-sang:preferences", JSON.stringify({ locale: "fr", uiScale: scale, volMaster: 70, volMusic: 60, volSfx: 80, subtitles: true }));
    } catch {
      // Stockage indisponible : préférences par défaut.
    }
  }, pass.scale);
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !isDriverNoise(m.text())) errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

const server = await createServer({ server: { port: 5186, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5186/";
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const first = PASSES[0] as Pass;

try {
  // AC8-06 (statique) : aucune dépendance d'icônes ni fichier son.
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  expect(!deps.some((d) => /lucide|fontawesome|heroicons|material-icons|feather|bootstrap-icons|howler|tone/.test(d)), `aucune bibliothèque d'icônes ni de sons parmi ${deps.length} dépendances`);

  for (const pass of PASSES) {
    console.log(`[passe ${pass.tag}]`);
    const errors: string[] = [];

    // ——— 1–2. Menu principal ; choix du scénario et de la nation ———
    const menu = await newPage(browser, pass, errors);
    await menu.goto(`${url}?menu=1`);
    await menu.waitForSelector(".table-archives", { timeout: 60000 });
    await menu.evaluate(() => document.fonts.ready);
    const covers = await menu.locator(".chemise[data-scenario]").count();
    const stamp = await menu.locator(".dossier-maitre__tampon").innerText();
    const rectButtons = await menu.$$eval(".table-archives button", (bs) => bs.filter((b) => !b.classList.contains("chemise")).length);
    expect(covers === 3 && stamp.length > 0 && rectButtons === 0, `menu : table d'archives, tampon « ${stamp} », ${covers} chemises de scénario, aucun bouton rectangulaire générique`);
    await review(menu, pass, "menu principal", ".table-archives");
    await shot(menu, pass, "menu");
    await menu.locator('.chemise[data-scenario="scn_854"]').click();
    await menu.waitForSelector(".choix-nation-menu:not([hidden])");
    const blasons = await menu.locator(".choix-nation-menu .chemise__couverture svg").count();
    expect(blasons === 2, `choix de la nation : ${blasons} dossiers à blason dessiné (Paradis, Marley)`);
    await review(menu, pass, "choix du scénario et de la nation", ".table-archives");
    await shot(menu, pass, "choix-nation");
    await menu.locator('.chemise--nation[data-nation="fac_paradis"]').click();
    await menu.waitForSelector("html[data-ready='true'] .bandeau", { timeout: 90000 });
    expect(new URL(menu.url()).searchParams.get("faction") === "fac_paradis", "le dossier de Paradis ouvre le scénario 854 côté Paradis");
    await menu.close();

    // ——— 3–9, 13–15. Partie de 850 : HUD, dossier de province, fiche, cabinet, expéditions, renseignement, recherche… ———
    const page = await newPage(browser, pass, errors);
    await page.goto(`${url}?scenario=scn_sandbox_850&dossiers=0`);
    await page.waitForSelector("html[data-ready='true']", { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.click(Math.round(pass.w / 2), Math.round(pass.h * 0.6));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // HUD (AC8-04) : registres sur une seule ligne, tous visibles.
    const tops = await page.$$eval(".bandeau__registre-bouton", (bs) => bs.filter((b) => (b as HTMLElement).offsetParent !== null).map((b) => Math.round(b.getBoundingClientRect().top)));
    const bandH = await page.$eval(".bandeau", (b) => b.getBoundingClientRect().height);
    expect(tops.length === 14 && Math.max(...tops) - Math.min(...tops) <= 2, `bandeau : ${tops.length} registres sur une seule ligne (hauteur du bandeau ${Math.round(bandH)} px)`);
    await review(page, pass, "HUD stratégique", ".bandeau");
    await shot(page, pass, "hud");

    // Dossier de province (clic sur Trost, comme smoke:map).
    const box = await page.locator(".carte canvas").first().boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + box.height * 0.235);
    await page.waitForSelector(".dossier:visible", { timeout: 10000 });
    expect((await page.locator(".dossier__titre").innerText()) === "Trost", "dossier de province : Trost");
    await review(page, pass, "dossier de province", ".dossier");
    await shot(page, pass, "dossier-province");
    await page.keyboard.press("Escape");

    const panels: [string, string][] = [
      ["personnages", "personnages"],
      ["cabinet", "cabinet"],
      ["expeditions", "expeditions"],
      ["renseignement", "renseignement"],
      ["recherche", "recherche"],
      ["gazette", "gazette"],
      ["archives", "archives"],
      ["epilogue", "epilogue"],
    ];
    for (const [id, name] of panels) {
      await openPanel(page, id);
      const band = await page.$eval(".bandeau", (b) => b.getBoundingClientRect().bottom);
      const top = await page.$eval(".registre-panneau:not([hidden])", (p) => p.getBoundingClientRect().top);
      if (top < band - 2) expect(false, `${name} : le registre chevauche le bandeau (${Math.round(top)} < ${Math.round(band)})`);
      await review(page, pass, `registre ${name}`, ".registre-panneau:not([hidden])");
      await shot(page, pass, name);
      if (id === "personnages") {
        await page.locator(".registre-panneau .lien-dossier").first().click();
        await page.waitForSelector(".fiche-nom");
        const portrait = await page.locator(".fiche-portrait svg").count();
        expect(portrait === 1, "fiche de personnage : portrait gravé procédural");
        await review(page, pass, "fiche de personnage", ".registre-panneau:not([hidden])");
        await shot(page, pass, "fiche-personnage");
      }
      if (id === "gazette") {
        const masthead = await page.locator(".gazette__titre").innerText();
        const arts = await page.locator(".gazette__article").count();
        expect(masthead === fr["narr.paradis.masthead"] && arts >= 1, `Gazette de Paradis : « ${masthead} », ${arts} article(s) tirés de l'état`);
      }
      if (id === "archives") {
        const stamps = await page.locator(".fiche-archive .tampon-mini").allInnerTexts();
        const kinds = new Set(stamps.map((s) => s.trim()));
        expect(stamps.length >= 20 && kinds.size >= 2, `archives : ${stamps.length} fiches tamponnées (${[...kinds].join(", ")})`);
      }
      if (id === "epilogue") expect((await page.locator(".epilogue__chiffres .valeur").count()) >= 5, "épilogue : statistiques expliquées");
    }
    await page.keyboard.press("Escape");

    // Options (F9) : son, volumes, sous-titres.
    await page.keyboard.press("F9");
    await page.waitForSelector(".options:not([hidden])");
    const sliders = await page.locator(".options__curseur").count();
    await page.locator('.options__curseur[data-setting="volMusic"]').fill("35");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("murs-et-sang:preferences") ?? "{}") as { volMusic?: number });
    expect(sliders === 3 && saved.volMusic === 35, `options : ${sliders} volumes (maître, musique, effets), musique réglée à 35 % et conservée`);
    await review(page, pass, "options", ".options");
    await shot(page, pass, "options", ".options");
    await page.keyboard.press("F9");

    // Audio (AC8-06) : moteur démarré au premier geste, couche calme en paix, notes jouées, papier au clic.
    await page.waitForTimeout(900);
    const mood0 = await page.getAttribute("html", "data-audio");
    const notes0 = Number(await page.getAttribute("html", "data-audio-notes"));
    const sfx0 = Number(await page.getAttribute("html", "data-audio-sfx"));
    expect(mood0 === "calme" && notes0 > 0 && sfx0 > 0, `audio : humeur « ${mood0} » en paix, ${notes0} notes de musique, ${sfx0} effets d'interface (papier, tampon)`);

    // ——— 11–12. Scène tactique et bilan (bataille d'essai, ville) ———
    if (pass.scale === 100 || pass.w === 3840) {
      await openPanel(page, "expeditions");
      await page.selectOption('select[data-trial="map"]', "tmap_ville");
      await page.fill('input[data-trial="count"]', "4");
      await page.fill('input[data-trial="men"]', "36");
      await page.locator('[data-action="essai"]').click();
      await page.waitForSelector(".bataille canvas", { timeout: 30000 });
      await page.locator('.bataille-vitesse[data-speed="2"]').click();
      await page.waitForFunction(() => Number(document.querySelector<HTMLElement>(".bataille")?.dataset["tick"]) >= 240, undefined, { timeout: 60000 });
      const fx = (await page.getAttribute(".bataille", "data-fx")) ?? "";
      const roofs = Number(/toits (\d+)/.exec(fx)?.[1] ?? 0);
      const mood1 = await page.getAttribute("html", "data-audio");
      const cues = await page.evaluate(() => Number(document.documentElement.dataset["audioSfx"]));
      const subtitles = await page.locator(".sous-titres__ligne").count();
      expect(roofs >= 6, `scène tactique : bâtiments irréguliers (${roofs} variantes de toit) — ${fx}`);
      expect(mood1 === "combat" && cues > sfx0, `audio en bataille : couche « ${mood1} », ${cues - sfx0} effets de bataille ; ${subtitles} sous-titre(s) à l'écran`);
      await review(page, pass, "interface tactique", ".bataille");
      await shot(page, pass, "bataille");
      await page.waitForSelector(".bilan", { timeout: 240000 });
      const fx2 = (await page.getAttribute(".bataille", "data-fx")) ?? "";
      const steam = Number(/vapeur (\d+)/.exec(fx2)?.[1] ?? 0);
      const killed = await page.locator(".bilan").innerText();
      expect(steam >= 1 || !/Titans abattus\s*0/.test(killed), `vapeur des Titans abattus : ${steam} nuage(s) au bilan`);
      const letters = await page.locator(".bilan .lettre").count();
      const telegram = await page.locator(".bilan").innerText();
      expect(telegram.length > 50, `rapport post-bataille : télégramme, liste des morts, ${letters} lettre(s) aux familles`);
      await review(page, pass, "rapport post-bataille", ".bilan");
      await shot(page, pass, "bilan");
      await page.locator('.bataille [data-action="quitter"]').click();
      await page.waitForFunction(() => !document.querySelector(".bataille"));
    }

    // Porteur (AC8-05) : éclair de transformation, une fois.
    if (pass === first) {
      await openPanel(page, "porteurs");
      await page.selectOption('select[data-trial="shifter"]', "shifter_cuirasse");
      await page.selectOption('select[data-trial="side"]', "ennemi");
      await page.selectOption('select[data-trial="map"]', "tmap_foret");
      await page.locator('[data-action="essai-porteur"]').click();
      await page.waitForSelector(".bataille canvas", { timeout: 30000 });
      await page.locator('.bataille-vitesse[data-speed="2"]').click();
      await page.waitForFunction(() => Number(/éclairs (\d+)/.exec(document.querySelector<HTMLElement>(".bataille")?.dataset["fx"] ?? "")?.[1] ?? 0) >= 1, undefined, { timeout: 90000 }).catch(() => undefined);
      const fx = (await page.getAttribute(".bataille", "data-fx")) ?? "";
      const flashes = Number(/éclairs (\d+)/.exec(fx)?.[1] ?? 0);
      const sub = Number(await page.getAttribute("html", "data-audio-captions"));
      expect(flashes >= 1, `transformation visible : ${flashes} éclair(s) — ${fx}`);
      expect(sub >= 1, `sous-titres des sons importants : ${sub} affiché(s) depuis l'ouverture`);
      await page.screenshot({ path: `${OUT}/p8-transformation.png` });
      await page.locator('.bataille [data-action="quitter"]').click();
      await page.waitForFunction(() => !document.querySelector(".bataille"));
    }
    await page.close();

    // ——— Marley en 854 : atlas, chancellerie, Gazette de propagande, alerte de la nation jouée (AC8-04) ———
    if (pass === first || (pass.w === 3840 && pass.scale === 125)) {
      const m = await newPage(browser, pass, errors);
      await m.goto(`${url}?scenario=scn_854&faction=fac_marley&dossiers=0`);
      await m.waitForSelector("html[data-ready='true']", { timeout: 90000 });
      await m.waitForFunction(() => document.querySelector(".atlas-monde")?.getAttribute("data-drawn") === "61");
      await m.evaluate(() => document.fonts.ready);
      await m.keyboard.press("Escape");
      await console_(m, "advance 7", "7");
      // Un acte diplomatique (garantie à Hizuru) entre au journal du monde : la ligne d'alerte de Marley le reprend.
      await m.keyboard.press("KeyD");
      await m.waitForSelector('.registre-panneau[data-panel="diplomatie"]:not([hidden])');
      await m.locator('[data-action="garantie"]').click();
      await m.waitForTimeout(400);
      const alert = await m.locator(".bandeau__alerte").innerText();
      const mtops = await m.$$eval(".bandeau__registre-bouton", (bs) => bs.filter((b) => (b as HTMLElement).offsetParent !== null).map((b) => Math.round(b.getBoundingClientRect().top)));
      expect(alert.length > 0 && alert !== fr["hud.no_alert"] && mtops.length === 8 && Math.max(...mtops) - Math.min(...mtops) <= 2, `Marley : alerte de la nation jouée « ${alert.slice(0, 70)} » ; ${mtops.length} registres sur une ligne`);
      await m.keyboard.press("KeyW");
      await m.waitForSelector('.registre-panneau[data-panel="monde"]:not([hidden])');
      expect((await m.getAttribute(".registre-panneau:not([hidden])", "data-bloc")) === "marley", "esthétique de Marley sur la table de guerre");
      await review(m, pass, "table de guerre (Marley)", ".registre-panneau:not([hidden])");
      await shot(m, pass, "monde-marley");
      await m.keyboard.press("KeyD");
      await m.waitForSelector('.registre-panneau[data-panel="diplomatie"]:not([hidden])');
      expect((await m.locator(".fiche-nation__blason svg").count()) === 3, "chancellerie : 3 fiches de nation à blason dessiné");
      await review(m, pass, "chancellerie (Marley)", ".registre-panneau:not([hidden])");
      await shot(m, pass, "chancellerie-marley");
      await m.keyboard.press("KeyN");
      await m.waitForSelector('.registre-panneau[data-panel="gazette"]:not([hidden])');
      const mast = await m.locator(".gazette__titre").innerText();
      expect(mast === fr["narr.marley.masthead"], `Gazette de Marley (propagande) : « ${mast} »`);
      await review(m, pass, "Gazette (Marley)", ".registre-panneau:not([hidden])");
      await shot(m, pass, "gazette-marley");
      await m.close();
    }
    expect(errors.length === 0, `[${pass.tag}] 0 erreur console${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`smoke:p8 : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("smoke:p8 : tout est conforme.");
