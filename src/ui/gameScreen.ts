import { isAuthorMode, setAuthorMode } from "./authorMode";
import mapJson from "../../data/map/paradis.json";
import type { MapData } from "../data/map";
import type { TerrainData } from "../data/terrain";
import { t } from "../i18n";
import { StrategicMap } from "../render/strategicMap";
import { SaveStore } from "../save/saveStore";
import type { Command } from "../sim/core/commands";
import type { GameState } from "../sim/core/state";
import type { SimResponse } from "../sim/sim";
import type { World } from "../sim/strategic/world";
import { buildWorld } from "../sim/strategic/world";
import { SimClient } from "../workers/simClient";
import { Bubble } from "./bubble";
import { canonReportFromBundle } from "./canonBrowser";
import { GameClock } from "./clock";
import type { ConsoleHost } from "./debugConsole";
import { mountDebugOverlay } from "./debugOverlay";
import { Dossier } from "./dossier";
import { Hud } from "./hud";
import { ACTIONS, KeyMap, keyLabel, PANEL_ACTION } from "./keymap";
import { NotificationFeed } from "./notifications";
import type { Action } from "./keymap";
import { LayersPanel } from "./layersPanel";
import { attachMapControls } from "./mapControls";
import { buildLabels, buildMapProvinces, drawingMap, mapDynamic } from "./mapModel";
import { buildMapRoutes } from "./mapRoutes";
import { computeOverlay } from "./overlays";
import { applyPaperTextures } from "./paper";
import { formatNumber, WhyTooltip } from "./why";
import { Registers } from "./registers";
import { openBattleScreen } from "./tactical/battleScreen";
import { EventDossier } from "./eventDossier";
import type { BattleSetup, TimedOrder } from "../sim/tactical/types";
import type { PanelId } from "./panels/common";
import { Notice } from "./notice";
import { OptionsPanel } from "./optionsPanel";
import { applyUiScale, crossesAutosave, LAST_GAME_KEY, loadSettings, saveSettings, volumesOf } from "./settings";
import { accentOf, moodInput, moodOf, sharedAudio } from "./audio";
import { loadUserTracks, onUserTracks, syncLibrary, userTracks } from "./audioSetup";
import { setLocale } from "../i18n";

/** Scénario par défaut (P2 : bac à sable politique de 850) ; `?scenario=` pour en choisir un autre. */
export const DEFAULT_SCENARIO = "scn_sandbox_850";

function scenarioFromUrl(): string {
  const raw = new URLSearchParams(window.location.search).get("scenario");
  return raw && /^scn_[a-z0-9_]+$/.test(raw) ? raw : DEFAULT_SCENARIO;
}
const DEFAULT_SEED = 42;
/** Au plus quelques jours par lot, pour que l'affichage suive même à la vitesse 5. */
const MAX_DAYS_PER_BATCH = 3;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("seed");
  const n = raw === null ? DEFAULT_SEED : Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : DEFAULT_SEED;
}

/** localStorage peut être indisponible (navigation privée, aperçus) : on renvoie null plutôt que d'échouer. */
export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Écran principal de P1 : bandeau-registre, carte stratégique, calques, console de service. */
export async function bootGame(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;
  applyPaperTextures(document.documentElement);
  const settings = loadSettings(safeStorage());
  setLocale(settings.locale);
  document.documentElement.lang = settings.locale;
  applyUiScale(settings.uiScale);
  setAuthorMode(settings.authorMode);
  await document.fonts.ready;

  const worker = new Worker(new URL("../workers/sim.worker.ts", import.meta.url), { type: "module" });
  const sim = new SimClient({
    post: (m) => worker.postMessage(m),
    onMessage: (h) => worker.addEventListener("message", (ev: MessageEvent<SimResponse>) => h(ev.data)),
  });
  const scenario = scenarioFromUrl();
  const first = await sim.init(seedFromUrl(), scenario);
  if (!first.source) throw new Error("Le Worker n'a pas fourni le monde.");
  const world = buildWorld(first.source, scenario);
  let state: GameState = first.state;
  const storePromise = SaveStore.open(indexedDB, () => Date.now());
  // « Continuer » (menu principal, U8) : reprend la sauvegarde automatique la plus récente de ce scénario, s'il y en a une.
  if (new URLSearchParams(window.location.search).get("reprendre") === "1") {
    try {
      const store = await storePromise;
      for (const s of (await store.list()).filter((x) => x.slot.startsWith("auto-"))) {
        const saved = await store.load(s.slot);
        if (saved.strategic?.scenario !== scenario) continue;
        state = (await sim.load(saved)).state;
        break;
      }
    } catch {
      // Aucune sauvegarde lisible : la partie commence au début du scénario.
    }
  }

  const clock = new GameClock(world.time.ms_per_day);
  const why = new WhyTooltip();
  const screen = document.createElement("div");
  screen.className = "ecran";
  let busy = false;
  const dispatch = async (cmd: Command): Promise<void> => {
    busy = true;
    const before = state.date;
    try {
      state = (await sim.dispatch(cmd)).state;
      clock.observeAlerts(state.strategic?.log ?? []);
      if (crossesAutosave(before, state.date, world.time.autosave_every_days)) void (await storePromise).autosave(state);
    } finally {
      busy = false;
    }
    refresh();
  };
  let registers: Registers | null = null;
  const keymap = new KeyMap(safeStorage());
  // Touche d'un registre (`personnages`) ou d'une action (`pause`, `speed_2`), pour les infobulles (U10).
  const keyOf = (id: string): string => {
    const a = PANEL_ACTION[id] ?? ACTIONS.find((x) => x === id);
    return a ? keyLabel(keymap.codeOf(a)) : "";
  };
  const hud = new Hud(world, state, why, {
    setSpeed: (s) => {
      clock.setSpeed(s);
      refresh();
    },
    keyOf,
    ...(world.politics ? { openPanel: (id: string) => registers?.toggle(id as PanelId) } : {}),
  });
  const host = document.createElement("div");
  host.className = "carte";
  // Écran (U2) : barre supérieure, carte, menu de gestion en bas.
  screen.append(hud.el, host, hud.gestion);
  app.append(screen);

  // Carte réaliste (MAP) : terrain figé chargé à part, en une seule ressource ; durée jusqu'à la première image mesurée (MAP.7).
  performance.mark("carte:debut");
  const terrain = (await import("../../data/map/terrain/paradis.json")).default as unknown as TerrainData;
  const mapData = drawingMap(mapJson as unknown as MapData, terrain);
  const map = await StrategicMap.create(host, mapData, buildMapProvinces(mapData, world.provinces), buildLabels(mapData, world.provinces, terrain), terrain);
  const byId = new Map(world.provinces.map((p) => [p.id, p]));
  map.onCamera = () => {
    host.dataset["lod"] = map.lod;
  };
  host.dataset["lod"] = map.lod;
  requestAnimationFrame(() => requestAnimationFrame(() => performance.measure("carte:premiere-image", "carte:debut")));
  const dossier = new Dossier(host, world, mapData.walls, why, () => {
    dossier.close();
    map.setSelected(null);
  });
  const bubble = new Bubble(document.body);
  attachMapControls(host, map, {
    hover(id, x, y) {
      const p = id ? byId.get(id) : undefined;
      if (p) bubble.show(p, state, x, y);
      else bubble.hide();
    },
    select(id) {
      bubble.hide();
      // Planificateur ouvert : le clic prolonge l'itinéraire au lieu d'ouvrir le dossier.
      if (id && registers?.mapClick(id)) return;
      if (id) dossier.open(id, state);
      else dossier.close();
    },
  });

  const layers = new LayersPanel(host, () => applyOverlay(), { pawns: true, labels: true, walls: true, fog: true }, (f) => map.setFilters(f));
  const applyOverlay = (): void => {
    const id = layers.active;
    const result = id ? computeOverlay(id, world, state, formatNumber, t) : null;
    map.setOverlay(result?.colors ?? null);
    layers.showLegend(result);
  };

  // Les commandes venues des registres passent par le même chemin ; une erreur (capital insuffisant…) est affichée.
  const safeDispatch = async (cmd: Command): Promise<void> => {
    try {
      await dispatch(cmd);
      audio.play("tampon");
    } catch (e) {
      notice.show((e as Error).message);
    }
  };
  const notice = new Notice(document.body);
  // Écran de bataille (P4) : le temps stratégique est suspendu tant qu'il est ouvert.
  let inBattle = false;
  const playBattle = async (setup: BattleSetup, title: string, linked: boolean): Promise<TimedOrder[] | null> => {
    inBattle = true;
    bubble.hide();
    // La carte stratégique est masquée : son rendu est suspendu pour laisser l'image à la bataille.
    map.setSuspended(true);
    try {
      return await openBattleScreen({ world, why, setup, title, linked });
    } finally {
      inBattle = false;
      map.setSuspended(false);
      last = performance.now();
      refresh();
    }
  };
  // Dossiers d'événements (P5) : ouverts d'eux-mêmes quand une décision est due ; la chronique peut les rouvrir.
  // `?dossiers=0` (contrôles de non-régression de P1–P4) : pas d'ouverture automatique ; la chronique reste accessible.
  const autoDossiers = new URLSearchParams(window.location.search).get("dossiers") !== "0";
  const eventDossier = world.chronicle ? new EventDossier(document.body, world, why, safeDispatch, autoDossiers) : null;
  const openEvent = (id: string): void => eventDossier?.open(state, id);
  if (world.politics) registers = new Registers(document.body, world, why, () => state, safeDispatch, playBattle, openEvent);
  if (registers) {
    registers.keyOf = keyOf;
    // Un registre ouvert referme le dossier de province (même côté de l'écran) ; son bouton reste enfoncé.
    registers.onChange = (id) => {
      hud.setOpenPanel(id);
      if (id) {
        dossier.close();
        map.setSelected(null);
      }
    };
  }
  // Fil de notifications (U9) : un clic sur une entrée qui nomme un lieu centre la carte et ouvre son dossier.
  const feed = new NotificationFeed(
    host,
    world,
    (province) => {
      registers?.close();
      map.centerOn(province);
      map.setSelected(province);
      dossier.open(province, state);
    },
    () => registers?.open("journal"),
    keyOf("journal"),
  );
  const drawRoutes = (): void => map.setRoutes(buildMapRoutes(mapData, world, state, registers?.draftRoute() ?? null));
  if (registers) registers.onDraft = drawRoutes;

  // Audio (04 §7) : humeur tirée de l'état, cloche et ducking sur les alertes, silence sur la mort d'un personnage nommé.
  const audio = sharedAudio(volumesOf(settings));
  syncLibrary(audio, settings);
  void loadUserTracks().then(() => syncLibrary(audio, loadSettings(safeStorage())));
  let heardSeq = Math.max(0, ...(state.strategic?.log ?? []).map((l) => l.seq));
  const listen = (): void => {
    audio.setAccent(accentOf(state.nations?.player));
    audio.setMood(moodOf(moodInput(state, inBattle)));
    if (!inBattle) audio.setAmbience("vent");
    const news = (state.strategic?.log ?? []).filter((l) => l.seq > heardSeq);
    const fresh = news.filter((l) => l.pause);
    heardSeq = Math.max(heardSeq, ...(state.strategic?.log ?? []).map((l) => l.seq));
    if (fresh.some((l) => l.key === "alert.character_died" || l.key === "alert.divergence_death")) {
      audio.silence(3);
      audio.play("cloche");
    } else if (fresh.length) {
      audio.duck(3);
      audio.play("alerte");
    } else if (news.length) audio.play("notification", 0.8);
  };
  document.addEventListener("click", (ev) => {
    if ((ev.target as HTMLElement | null)?.closest?.("button, [role=button], select, summary")) audio.play("clic");
  });

  const refresh = (): void => {
    listen();
    hud.update(state, clock.speed);
    feed.update(state);
    registers?.refresh();
    map.setDynamic(mapDynamic(state));
    drawRoutes();
    if (layers.active) applyOverlay();
    dossier.refresh(state);
    eventDossier?.refresh(state);
  };

  const PAN = 80;
  const setSpeed = (s: number) => () => {
    clock.setSpeed(s);
    refresh();
  };
  const actions: Partial<Record<Action, () => void>> = {
    pause: () => {
      clock.togglePause();
      refresh();
    },
    speed_1: setSpeed(1),
    speed_2: setSpeed(2),
    speed_3: setSpeed(3),
    speed_4: setSpeed(4),
    speed_5: setSpeed(5),
    zoom_in: () => map.zoomAt(host.clientWidth / 2, host.clientHeight / 2, 1.25),
    zoom_out: () => map.zoomAt(host.clientWidth / 2, host.clientHeight / 2, 0.8),
    pan_up: () => map.panBy(0, PAN),
    pan_down: () => map.panBy(0, -PAN),
    pan_left: () => map.panBy(PAN, 0),
    pan_right: () => map.panBy(-PAN, 0),
    lod_monde: () => map.setLod("monde"),
    lod_region: () => map.setLod("region"),
    lod_province: () => map.setLod("province"),
    fit: () => map.fit(),
    overlay_next: () => layers.next(),
    overlay_off: () => layers.select(null),
    close: () => {
      if (eventDossier?.openId) return eventDossier.close();
      if (registers?.openId) return registers.close();
      dossier.close();
      map.setSelected(null);
    },
    open_characters: () => registers?.toggle("personnages"),
    open_cabinet: () => registers?.toggle("cabinet"),
    open_laws: () => registers?.toggle("decrets"),
    open_orgs: () => registers?.toggle("organisations"),
    open_council: () => registers?.toggle("conseil"),
    open_journal: () => registers?.toggle("journal"),
    open_expeditions: () => (world.military ? registers?.toggle("expeditions") : undefined),
    open_chronicle: () => (world.chronicle ? registers?.toggle("chronique") : undefined),
    open_intel: () => (world.intel ? registers?.toggle("renseignement") : undefined),
    open_research: () => (world.research ? registers?.toggle("recherche") : undefined),
    open_shifters: () => (world.shifters ? registers?.toggle("porteurs") : undefined),
    open_world: () => (world.nations ? registers?.toggle("monde") : undefined),
    open_diplomacy: () => (world.nations ? registers?.toggle("diplomatie") : undefined),
    open_gazette: () => registers?.toggle("gazette"),
    open_archives: () => registers?.toggle("archives"),
    open_epilogue: () => registers?.toggle("epilogue"),
    open_economy: () => registers?.toggle("economie"),
  };
  window.addEventListener("keydown", (ev) => {
    // Pendant une bataille, l'écran tactique a ses propres touches.
    if (document.body.dataset["tactique"]) return;
    // Touche déjà traitée par un composant (Entrée ou Espace sur une ligne de liste) : pas d'action globale.
    if (ev.defaultPrevented) return;
    // Seule la saisie de texte (console) et les listes déroulantes gardent leurs touches ; une case cochée ne bloque rien.
    // Les champs numériques (planificateur) gardent aussi leurs chiffres : « 1 » ne doit pas changer la vitesse.
    const typing = (ev.target instanceof HTMLInputElement && (ev.target.type === "text" || ev.target.type === "number")) || ev.target instanceof HTMLSelectElement;
    if (typing && keymap.actionFor(ev.code) !== "console") return;
    const action = keymap.actionFor(ev.code);
    const run = action ? actions[action] : undefined;
    if (!run) return;
    ev.preventDefault();
    run();
  });

  // Boucle de temps : le temps réel devient des commandes AdvanceDays (la simulation reste déterministe).
  // Légende « Calques » (R0.2c) : masquée tant qu'une fenêtre ouverte (registre, dossier, options…) la recouvre ;
  // une fenêtre qui ne la touche pas la laisse utilisable. Masquée par `visibility`, elle garde sa place : on peut mesurer.
  const WINDOWS = ".registre-panneau:not([hidden]), .dossier:not([hidden]), .dossier-evenement:not([hidden]), .options:not([hidden]), .choix-nation";
  const syncLegend = (): void => {
    const a = layers.el.getBoundingClientRect();
    const covered = [...document.querySelectorAll(WINDOWS)].some((w) => {
      const b = w.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    });
    if ((layers.el.dataset["masque"] === "1") !== covered) layers.el.dataset["masque"] = covered ? "1" : "0";
  };
  new MutationObserver(syncLegend).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
  syncLegend();

  let last = performance.now();
  const loop = (now: number): void => {
    const days = busy || inBattle ? 0 : clock.consume(now - last, MAX_DAYS_PER_BATCH);
    last = now;
    if (days > 0) void dispatch({ type: "AdvanceDays", n: days });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const consoleHost: ConsoleHost = {
    state: () => state,
    dispatch,
    reset: async (seed) => {
      state = (await sim.reset(seed)).state;
    },
    save: async (slot) => {
      await (await storePromise).save(slot, state);
    },
    load: async (slot) => {
      state = (await sim.load(await (await storePromise).load(slot))).state;
    },
    canonReport: canonReportFromBundle,
  };
  const debug = mountDebugOverlay(document.body, consoleHost, refresh);
  actions.console = () => debug.toggle();
  const options = new OptionsPanel(document.body, keymap, settings, (s) => {
    saveSettings(safeStorage(), s);
    audio.setVolumes(volumesOf(s));
    syncLibrary(audio, s);
    if (s.locale !== settings.locale) window.location.reload();
    applyUiScale(s.uiScale);
    if (s.authorMode !== isAuthorMode()) {
      setAuthorMode(s.authorMode);
      refresh();
    }
  }, userTracks);
  onUserTracks(() => options.sync(loadSettings(safeStorage())));
  actions.options = () => {
    options.toggle();
    audio.play(options.isOpen ? "ouvrir" : "fermer");
  };
  // Mode auteur (E-UX-1) : F10 bascule l'affichage des statuts du lore et des codes internes.
  actions.author_mode = () => {
    const s = { ...loadSettings(safeStorage()), authorMode: !isAuthorMode() };
    saveSettings(safeStorage(), s);
    setAuthorMode(s.authorMode);
    options.sync(s);
    refresh();
  };
  // Choix de la nation jouée (P7, scénario 854) : `?faction=fac_marley`, sinon un dossier de choix au départ.
  const playable = world.scenario.world?.playable ?? [];
  if (playable.length > 1) {
    const wanted = new URLSearchParams(window.location.search).get("faction");
    const faction = wanted && playable.includes(wanted) ? wanted : await chooseFaction(world, playable);
    if (faction !== state.nations?.player) await safeDispatch({ type: "SetPlayerFaction", faction });
    if (faction !== "fac_paradis") registers?.open("monde");
  }
  // Dernière partie (scénario, nation) : l'entrée « Continuer » du menu principal la reprend.
  try {
    safeStorage()?.setItem(LAST_GAME_KEY, JSON.stringify({ scenario, ...(state.nations ? { faction: state.nations.player } : {}), reprendre: "1" }));
  } catch {
    // Stockage refusé : « Continuer » restera indisponible.
  }
  refresh();
  document.documentElement.dataset["ready"] = "true";
}

/** Dossier de choix de la nation (04 §5.2 ; habillage final en P8). */
function chooseFaction(world: World, playable: readonly string[]): Promise<string> {
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.className = "choix-nation";
    box.setAttribute("role", "dialog");
    const h = document.createElement("h2");
    h.className = "bordereau-titre";
    h.textContent = t("world.choose_nation");
    box.append(h);
    for (const f of playable) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `choix-nation__dossier choix-nation__dossier--${f}`;
      b.dataset["nation"] = f;
      const title = document.createElement("strong");
      title.textContent = t(world.nations?.factions.get(f)?.name_key ?? f);
      const goals = document.createElement("span");
      goals.textContent = (world.nations?.factions.get(f)?.objectives ?? []).map((o) => t(o)).join(" · ");
      b.append(title, goals);
      b.addEventListener("click", () => {
        box.remove();
        resolve(f);
      });
      box.append(b);
    }
    document.body.append(box);
  });
}
