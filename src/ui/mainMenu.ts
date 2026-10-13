import { t } from "../i18n";
import { emblem, icon } from "./icons";
import { KeyMap } from "./keymap";
import { OptionsPanel } from "./optionsPanel";
import { applyPaperTextures } from "./paper";
import { safeStorage } from "./gameScreen";
import { sharedAudio } from "./audio";
import { loadUserTracks, onUserTracks, syncLibrary, userTracks } from "./audioSetup";
import { applyUiScale, LAST_GAME_KEY, loadSettings, saveSettings, volumesOf } from "./settings";

/**
 * Menu principal (U8, phase UI ; campagnes en P9) : plein écran ; en fond, les murs au crépuscule (capture de la scène 3D du
 * projet, `public/menu/murs-crepuscule.jpg`) ; titre et quatre entrées à gauche (Nouvelle partie, Continuer, Options,
 * Quitter) ; à droite, les campagnes (845, 850, 854, Grondement), puis la difficulté, puis la nation pour 854. Les bacs à
 * sable (parties libres, sans fin) restent accessibles en une ligne sous la liste.
 */
export interface CampaignCover {
  id: string;
  year: number;
  emblem: string;
  nations: readonly string[];
}

/** Reflet léger de `data/campagnes` (vérifié par tests/campaign/menu.test.ts) : le menu ne charge pas les campagnes. */
export const CAMPAIGNS: readonly CampaignCover[] = [
  { id: "c845", year: 845, emblem: "fac_paradis", nations: ["fac_paradis"] },
  { id: "c850", year: 850, emblem: "fac_paradis", nations: ["fac_paradis"] },
  { id: "c854", year: 854, emblem: "fac_marley", nations: ["fac_paradis", "fac_marley"] },
  { id: "cgrondement", year: 854, emblem: "fac_paradis", nations: ["fac_paradis"] },
];

/** Difficultés de `data/balance/difficulty.json` (P9.3), dans l'ordre ; Normal par défaut. */
export const DIFFICULTIES = ["recit", "normal", "rude", "breche"] as const;
export const DEFAULT_DIFFICULTY = "normal";

/** Parties libres (bacs à sable, sans règle de fin). */
const FREE: readonly { id: string; year: number; nations: readonly string[] }[] = [
  { id: "scn_sandbox_845", year: 845, nations: [] },
  { id: "scn_sandbox_850", year: 850, nations: [] },
  { id: "scn_854", year: 854, nations: ["fac_paradis", "fac_marley"] },
];

/** Identifiant du scénario d'une campagne à une difficulté (même règle que src/campaign/campaign.ts). */
export const campaignScenario = (campaign: string, difficulty: string): string => `scn_camp_${campaign.replace(/^c/, "")}__${difficulty}`;

/** Libellé d'un scénario (bac à sable ou campagne) pour « Continuer ». */
export function scenarioLabel(id: string): string {
  const m = /^scn_camp_([a-z0-9]+)__([a-z]+)$/.exec(id);
  if (m) return `${t(`camp.c${m[1] ?? ""}`)} · ${t(`diff.${m[2] ?? ""}`)}`;
  return t(`scn.${id.replace(/^scn_/, "")}`);
}

/** Image de fond : rendu de la scène 3D de Shiganshina au crépuscule (D-110). */
export const MENU_BACKGROUND = "menu/murs-crepuscule.jpg";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function go(params: Record<string, string>): void {
  const q = new URLSearchParams(params);
  window.location.search = `?${q.toString()}`;
}

function lastGame(): Record<string, string> | null {
  try {
    const raw = safeStorage()?.getItem(LAST_GAME_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (v && typeof v === "object" && typeof (v as Record<string, unknown>)["scenario"] === "string") return v as Record<string, string>;
  } catch {
    // Stockage illisible : pas de partie à reprendre.
  }
  return null;
}

function entry(id: string, iconId: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", "menu-entree");
  b.type = "button";
  b.dataset["entree"] = id;
  b.innerHTML = icon(iconId, "ico ico--l");
  b.append(el("span", "menu-entree__libelle", label));
  b.addEventListener("click", onClick);
  return b;
}

export function mountMainMenu(app: HTMLElement, uiScale = 100): void {
  applyPaperTextures(document.documentElement);
  applyUiScale(uiScale);
  const root = el("main", "menu-principal");
  root.setAttribute("aria-label", t("menu.title"));
  const bg = el("img", "menu-principal__fond");
  bg.alt = "";
  bg.decoding = "async";
  bg.src = MENU_BACKGROUND;
  const veil = el("div", "menu-principal__voile");
  veil.setAttribute("aria-hidden", "true");

  // Colonne de gauche : titre, devise, quatre entrées.
  const col = el("section", "menu-principal__colonne");
  col.append(el("h1", "menu-principal__titre", t("app.title")), el("p", "menu-principal__devise", t("menu.tagline")));
  const nav = el("nav", "menu-principal__entrees");
  nav.setAttribute("aria-label", t("menu.title"));
  const panel = el("section", "menu-scenarios");
  panel.setAttribute("aria-label", t("menu.scenarios"));
  const last = lastGame();
  const cont = entry("continuer", "continuer", t("menu.continue"), () => {
    if (last) go(last);
  });
  cont.disabled = !last;
  cont.title = last ? t("menu.continue_why", { scenario: scenarioLabel(last["scenario"] ?? "") }) : t("menu.continue_none");
  const settings = loadSettings(safeStorage());
  // Musique du menu : classique rythmé (état « calme »), réglée par les mêmes préférences que la carte.
  const audio = sharedAudio(volumesOf(settings));
  audio.setMood("calme");
  audio.setAmbience("vent");
  syncLibrary(audio, settings);
  void loadUserTracks().then(() => syncLibrary(audio, loadSettings(safeStorage())));
  let options: OptionsPanel | null = null;
  onUserTracks(() => options?.sync(loadSettings(safeStorage())));
  const quitNote = el("p", "menu-principal__note");
  quitNote.hidden = true;
  nav.append(
    entry("nouvelle", "nouvelle", t("menu.new"), () => {
      panel.hidden = false;
      panel.querySelector<HTMLButtonElement>(".chemise")?.focus();
    }),
    cont,
    entry("options", "reglages", t("menu.options"), () => {
      options ??= new OptionsPanel(document.body, new KeyMap(safeStorage()), settings, (s) => {
        saveSettings(safeStorage(), s);
        audio.setVolumes(volumesOf(s));
        syncLibrary(audio, s);
        applyUiScale(s.uiScale);
        if (s.locale !== settings.locale) window.location.reload();
      }, userTracks, () => go({ scenario: "scn_sandbox_850", tutoriel: "1" }));
      options.toggle();
      audio.play(options.isOpen ? "ouvrir" : "fermer");
    }),
    entry("quitter", "quitter", t("menu.quit"), () => {
      // Un onglet ouvert par l'utilisateur ne peut pas être fermé par la page : on le dit.
      window.close();
      quitNote.textContent = t("menu.quit_note");
      quitNote.hidden = false;
    }),
  );
  col.append(nav, quitNote, el("p", "menu-principal__mention", t("app.notice")));

  // Panneau de droite : campagnes (illustration, année, titre, résumé), puis difficulté, puis nation pour 854.
  panel.append(el("h2", "menu-scenarios__titre", t("menu.scenarios")));
  const list = el("div", "menu-scenarios__liste");
  const levels = el("section", "choix-difficulte");
  levels.hidden = true;
  const nations = el("section", "choix-nation-menu");
  nations.hidden = true;
  const press = (scope: Element, sel: string, on: Element): void => {
    for (const o of scope.querySelectorAll(sel)) o.setAttribute("aria-pressed", String(o === on));
  };
  const chooseNation = (scenario: string, choices: readonly string[]): void => {
    nations.replaceChildren(el("h3", "menu-scenarios__sous-titre", t("world.choose_nation")));
    for (const f of choices) {
      const n = el("button", `chemise chemise--nation chemise--${f}`);
      n.type = "button";
      n.dataset["nation"] = f;
      const c = el("span", "chemise__couverture");
      c.innerHTML = emblem(f);
      const tx = el("span", "chemise__texte");
      tx.append(el("strong", "chemise__titre", t(`fac.${f.replace(/^fac_/, "")}`)), el("span", "chemise__resume", t(`menu.nation.${f}`)));
      n.append(c, tx);
      n.addEventListener("click", () => go({ scenario, faction: f }));
      nations.append(n);
    }
    nations.hidden = false;
    nations.querySelector<HTMLButtonElement>(".chemise")?.focus();
  };
  const start = (scenario: string, choices: readonly string[]): void => {
    if (choices.length > 1) chooseNation(scenario, choices);
    else go({ scenario });
  };
  for (const camp of CAMPAIGNS) {
    const b = el("button", "chemise");
    b.type = "button";
    b.dataset["campagne"] = camp.id;
    const cover = el("span", "chemise__couverture");
    cover.innerHTML = emblem(camp.emblem);
    const text = el("span", "chemise__texte");
    text.append(el("span", "chemise__annee", t("menu.year", { year: camp.year })), el("strong", "chemise__titre", t(`camp.${camp.id}`)), el("span", "chemise__resume", t(`camp.${camp.id}.summary`)));
    b.append(cover, text);
    b.addEventListener("click", () => {
      press(list, ".chemise", b);
      nations.hidden = true;
      levels.replaceChildren(el("h3", "menu-scenarios__sous-titre", t("menu.choose_difficulty")));
      const grid = el("div", "choix-difficulte__liste");
      for (const d of DIFFICULTIES) {
        const db = el("button", "difficulte");
        db.type = "button";
        db.dataset["difficulte"] = d;
        db.setAttribute("aria-pressed", String(d === DEFAULT_DIFFICULTY));
        db.append(el("span", "difficulte__nom", t(`diff.${d}`)), el("span", "difficulte__desc", t(`diff.${d}.desc`)));
        db.addEventListener("click", () => {
          press(grid, ".difficulte", db);
          start(campaignScenario(camp.id, d), camp.nations);
        });
        grid.append(db);
      }
      levels.append(grid);
      levels.hidden = false;
      grid.querySelector<HTMLButtonElement>(`[data-difficulte="${DEFAULT_DIFFICULTY}"]`)?.focus();
    });
    list.append(b);
  }
  // Parties libres : les bacs à sable de 845, 850 et 854 (aucune règle de fin).
  const free = el("p", "menu-libre");
  free.append(el("span", "", t("menu.free_play")));
  for (const sc of FREE) {
    const fb = el("button", "menu-libre__bouton", String(sc.year));
    fb.type = "button";
    fb.dataset["scenario"] = sc.id;
    fb.title = t(`scn.${sc.id.replace(/^scn_/, "")}`);
    fb.addEventListener("click", () => {
      levels.hidden = true;
      press(list, ".chemise", fb);
      start(sc.id, sc.nations);
    });
    free.append(fb);
  }
  // Partie accompagnée (TUT.1) : premier mois à Paradis, étapes courtes et bulles ancrées aux éléments à utiliser.
  const guide = el("button", "menu-guide");
  guide.type = "button";
  guide.dataset["entree"] = "guide";
  guide.append(el("strong", "menu-guide__titre", t("menu.tutorial")), el("span", "menu-guide__resume", t("menu.tutorial_why")));
  guide.addEventListener("click", () => go({ scenario: "scn_sandbox_850", tutoriel: "1" }));
  panel.append(list, levels, nations, free, guide);
  root.append(bg, veil, col, panel);
  app.append(root);
  document.title = t("app.title");
  document.documentElement.dataset["ready"] = "true";
}
