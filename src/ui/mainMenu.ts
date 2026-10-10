import { t } from "../i18n";
import { emblem, icon } from "./icons";
import { KeyMap } from "./keymap";
import { OptionsPanel } from "./optionsPanel";
import { applyPaperTextures } from "./paper";
import { safeStorage } from "./gameScreen";
import { sharedAudio } from "./audio";
import { loadUserTracks, onUserTracks, syncLibrary, userTracks } from "./audioSetup";
import { applyAccessibility, applyUiScale, LAST_GAME_KEY, loadSettings, saveSettings, volumesOf } from "./settings";
import { CUSTOM_DIFFICULTY_KEYS, DIFFICULTY_IDS } from "../data/endingSchemas";
import type { CustomDifficulty, DifficultyId } from "../data/endingSchemas";
import { customDifficultyParam, DEFAULT_CUSTOM, parseCustomDifficulty } from "./customDifficulty";

/**
 * Menu principal (U8, phase UI) : plein écran ; en fond, les murs au crépuscule (capture de la scène 3D du projet,
 * `public/menu/murs-crepuscule.jpg`) ; titre et quatre entrées à gauche (Nouvelle partie, Continuer, Options, Quitter) ;
 * choix du scénario dans un panneau à droite, puis choix de la nation pour 854.
 */
interface ScenarioCover {
  id: string;
  year: number;
  emblem: string;
  nations: readonly string[];
}

const SCENARIOS: readonly ScenarioCover[] = [
  { id: "scn_845", year: 845, emblem: "fac_paradis", nations: [] },
  { id: "scn_sandbox_850", year: 850, emblem: "fac_paradis", nations: [] },
  { id: "scn_854", year: 854, emblem: "fac_marley", nations: ["fac_paradis", "fac_marley"] },
  { id: "scn_grondement", year: 854, emblem: "fac_paradis", nations: [] },
];

/** Image de fond : rendu de la scène 3D de Shiganshina au crépuscule (D-110). */
export const MENU_BACKGROUND = "menu/murs-crepuscule.jpg";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Difficulté choisie au menu (P9.3), gardée pour la prochaine visite ; « normal » n'apparaît pas dans l'adresse. */
const DIFFICULTY_KEY = "murs-et-sang.difficulte";
/** Réglages de la difficulté personnalisée (P10.1), gardés d'une visite à l'autre. */
const CUSTOM_KEY = "murs-et-sang.difficulte-perso";
let difficulty: DifficultyId | "personnalise" = "normal";
let custom: CustomDifficulty = { ...DEFAULT_CUSTOM };

function go(params: Record<string, string>): void {
  const q = new URLSearchParams(params);
  if (difficulty !== "normal" && !q.has("tutoriel") && !q.has("reprendre")) {
    q.set("difficulte", difficulty);
    if (difficulty === "personnalise") q.set("dp", customDifficultyParam(custom));
  }
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
  applyAccessibility(loadSettings(safeStorage()));
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
  cont.title = last ? t("menu.continue_why", { scenario: t(`scn.${(last["scenario"] ?? "").replace(/^scn_/, "")}`) }) : t("menu.continue_none");
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
        applyAccessibility(s);
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

  // Panneau de droite : scénarios (illustration, année, titre, résumé), puis nations pour 854.
  panel.append(el("h2", "menu-scenarios__titre", t("menu.scenarios")));
  // Difficulté (P9.3) : quatre niveaux, expliqués en une ligne ; le choix vaut pour la partie lancée ensuite.
  const stored = safeStorage()?.getItem(DIFFICULTY_KEY) ?? "normal";
  difficulty = stored === "personnalise" ? "personnalise" : (DIFFICULTY_IDS as readonly string[]).includes(stored) ? (stored as DifficultyId) : "normal";
  custom = parseCustomDifficulty(safeStorage()?.getItem(CUSTOM_KEY) ?? null) ?? { ...DEFAULT_CUSTOM };
  const diff = el("div", "menu-difficulte");
  diff.setAttribute("role", "group");
  diff.setAttribute("aria-label", t("menu.difficulty"));
  const diffNote = el("p", "menu-difficulte__note", t(`diff.${difficulty}_why`));
  diff.append(el("span", "menu-difficulte__titre", t("menu.difficulty")));
  // Personnalisée (P10.1, F-ACC-08) : six curseurs, ouverts seulement quand ce choix est fait.
  const fine = el("fieldset", "menu-difficulte__fine");
  fine.append(el("legend", "", t("diff.custom_title")));
  for (const k of CUSTOM_DIFFICULTY_KEYS) {
    const offset = k === "moral" || k === "stabilite";
    const row = el("label", "menu-difficulte__curseur");
    const r = el("input", "options__curseur");
    r.type = "range";
    r.min = offset ? "-20" : "0.5";
    r.max = offset ? "20" : "1.5";
    r.step = offset ? "5" : "0.05";
    r.value = String(custom[k]);
    r.dataset["perso"] = k;
    const fmt = (v: number): string => (offset ? `${v > 0 ? "+" : ""}${v}` : `× ${v.toFixed(2)}`);
    const out = el("output", "options__valeur", fmt(custom[k]));
    r.addEventListener("input", () => {
      custom = { ...custom, [k]: Number(r.value) };
      out.textContent = fmt(custom[k]);
      safeStorage()?.setItem(CUSTOM_KEY, customDifficultyParam(custom));
    });
    row.append(el("span", "", t(`diff.custom_${k}`)), r, out);
    fine.append(row);
  }
  fine.hidden = difficulty !== "personnalise";
  for (const id of [...DIFFICULTY_IDS, "personnalise"] as const) {
    const b = el("button", "menu-difficulte__niveau", t(`diff.${id}`));
    b.type = "button";
    b.dataset["difficulte"] = id;
    b.setAttribute("aria-pressed", String(id === difficulty));
    b.addEventListener("click", () => {
      difficulty = id;
      safeStorage()?.setItem(DIFFICULTY_KEY, id);
      for (const o of diff.querySelectorAll("button")) o.setAttribute("aria-pressed", String(o === b));
      diffNote.textContent = t(`diff.${id}_why`);
      fine.hidden = id !== "personnalise";
    });
    diff.append(b);
  }
  panel.append(diff, diffNote, fine);
  const list = el("div", "menu-scenarios__liste");
  const nations = el("section", "choix-nation-menu");
  nations.hidden = true;
  for (const sc of SCENARIOS) {
    const b = el("button", "chemise");
    b.type = "button";
    b.dataset["scenario"] = sc.id;
    const cover = el("span", "chemise__couverture");
    cover.innerHTML = emblem(sc.emblem);
    const text = el("span", "chemise__texte");
    text.append(el("span", "chemise__annee", t("menu.year", { year: sc.year })), el("strong", "chemise__titre", t(`scn.${sc.id.replace(/^scn_/, "")}`)), el("span", "chemise__resume", t(`menu.summary.${sc.id}`)));
    b.append(cover, text);
    b.addEventListener("click", () => {
      for (const o of list.querySelectorAll(".chemise")) o.setAttribute("aria-pressed", String(o === b));
      if (sc.nations.length === 0) {
        go({ scenario: sc.id });
        return;
      }
      nations.replaceChildren(el("h3", "menu-scenarios__sous-titre", t("world.choose_nation")));
      for (const f of sc.nations) {
        const n = el("button", `chemise chemise--nation chemise--${f}`);
        n.type = "button";
        n.dataset["nation"] = f;
        const c = el("span", "chemise__couverture");
        c.innerHTML = emblem(f);
        const tx = el("span", "chemise__texte");
        tx.append(el("strong", "chemise__titre", t(`fac.${f.replace(/^fac_/, "")}`)), el("span", "chemise__resume", t(`menu.nation.${f}`)));
        n.append(c, tx);
        n.addEventListener("click", () => go({ scenario: sc.id, faction: f }));
        nations.append(n);
      }
      nations.hidden = false;
    });
    list.append(b);
  }
  // Partie accompagnée (TUT.1) : premier mois à Paradis, étapes courtes et bulles ancrées aux éléments à utiliser.
  const guide = el("button", "menu-guide");
  guide.type = "button";
  guide.dataset["entree"] = "guide";
  guide.append(el("strong", "menu-guide__titre", t("menu.tutorial")), el("span", "menu-guide__resume", t("menu.tutorial_why")));
  guide.addEventListener("click", () => go({ scenario: "scn_sandbox_850", tutoriel: "1" }));
  panel.append(list, nations, guide);
  root.append(bg, veil, col, panel);
  app.append(root);
  document.title = t("app.title");
  document.documentElement.dataset["ready"] = "true";
}
