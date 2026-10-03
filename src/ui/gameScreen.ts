import mapJson from "../../data/map/paradis.json";
import type { MapData } from "../data/map";
import { t } from "../i18n";
import { StrategicMap } from "../render/strategicMap";
import { SaveStore } from "../save/saveStore";
import type { Command } from "../sim/core/commands";
import type { GameState } from "../sim/core/state";
import type { SimResponse } from "../sim/sim";
import { buildWorld } from "../sim/strategic/world";
import { SimClient } from "../workers/simClient";
import { Bubble } from "./bubble";
import { canonReportFromBundle } from "./canonBrowser";
import { GameClock } from "./clock";
import type { ConsoleHost } from "./debugConsole";
import { mountDebugOverlay } from "./debugOverlay";
import { Dossier } from "./dossier";
import { Hud } from "./hud";
import { KeyMap } from "./keymap";
import type { Action } from "./keymap";
import { LayersPanel } from "./layersPanel";
import { attachMapControls } from "./mapControls";
import { buildLabels, buildMapProvinces, mapDynamic } from "./mapModel";
import { computeOverlay } from "./overlays";
import { applyPaperTextures } from "./paper";
import { formatNumber, WhyTooltip } from "./why";

export const SCENARIO = "scn_sandbox_845";
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
  await document.fonts.ready;

  const worker = new Worker(new URL("../workers/sim.worker.ts", import.meta.url), { type: "module" });
  const sim = new SimClient({
    post: (m) => worker.postMessage(m),
    onMessage: (h) => worker.addEventListener("message", (ev: MessageEvent<SimResponse>) => h(ev.data)),
  });
  const first = await sim.init(seedFromUrl(), SCENARIO);
  if (!first.source) throw new Error("Le Worker n'a pas fourni le monde.");
  const world = buildWorld(first.source, SCENARIO);
  let state: GameState = first.state;

  const clock = new GameClock(world.time.ms_per_day);
  const why = new WhyTooltip();
  const screen = document.createElement("div");
  screen.className = "ecran";
  let busy = false;
  const dispatch = async (cmd: Command): Promise<void> => {
    busy = true;
    try {
      state = (await sim.dispatch(cmd)).state;
      clock.observeAlerts(state.strategic?.log ?? []);
    } finally {
      busy = false;
    }
    refresh();
  };
  const hud = new Hud(world, state, why, {
    setSpeed: (s) => {
      clock.setSpeed(s);
      refresh();
    },
    setRationing: (level) => void dispatch({ type: "SetRationing", level }),
  });
  const host = document.createElement("div");
  host.className = "carte";
  screen.append(hud.el, host);
  app.append(screen);

  const mapData = mapJson as unknown as MapData;
  const map = await StrategicMap.create(host, mapData, buildMapProvinces(mapData, world.provinces), buildLabels(mapData, world.provinces));
  const byId = new Map(world.provinces.map((p) => [p.id, p]));
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

  const refresh = (): void => {
    hud.update(state, clock.speed);
    map.setDynamic(mapDynamic(state));
    if (layers.active) applyOverlay();
    dossier.refresh(state);
  };

  const keymap = new KeyMap(safeStorage());
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
      dossier.close();
      map.setSelected(null);
    },
  };
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
    const action = keymap.actionFor(ev.code);
    const run = action ? actions[action] : undefined;
    if (!run) return;
    ev.preventDefault();
    run();
  });

  // Boucle de temps : le temps réel devient des commandes AdvanceDays (la simulation reste déterministe).
  let last = performance.now();
  const loop = (now: number): void => {
    const days = busy ? 0 : clock.consume(now - last, MAX_DAYS_PER_BATCH);
    last = now;
    if (days > 0) void dispatch({ type: "AdvanceDays", n: days });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const storePromise = SaveStore.open(indexedDB, () => Date.now());
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
  mountDebugOverlay(document.body, consoleHost, refresh);
  refresh();
  document.documentElement.dataset["ready"] = "true";
}
