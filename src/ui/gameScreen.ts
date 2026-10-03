import mapJson from "../../data/map/paradis.json";
import type { MapData } from "../data/map";
import { t } from "../i18n";
import { StrategicMap } from "../render/strategicMap";
import { SaveStore } from "../save/saveStore";
import { stateHash } from "../sim/core/canonical";
import type { GameState } from "../sim/core/state";
import type { SimResponse } from "../sim/sim";
import { buildWorld } from "../sim/strategic/world";
import { canonReportFromBundle } from "./canonBrowser";
import type { ConsoleHost } from "./debugConsole";
import { mountDebugOverlay } from "./debugOverlay";
import { buildLabels, buildMapProvinces, mapDynamic } from "./mapModel";
import { applyPaperTextures } from "./paper";
import { Bubble } from "./bubble";
import { KeyMap } from "./keymap";
import type { Action } from "./keymap";
import { attachMapControls } from "./mapControls";
import { LayersPanel } from "./layersPanel";
import { computeOverlay } from "./overlays";
import { SimClient } from "../workers/simClient";

export const SCENARIO = "scn_sandbox_845";
const DEFAULT_SEED = 42;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("seed");
  const n = raw === null ? DEFAULT_SEED : Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : DEFAULT_SEED;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Écran principal de P1 : bandeau-registre + carte stratégique + console de service. */
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

  const screen = el("div", "ecran");
  const band = el("header", "bandeau");
  band.append(el("h1", "bandeau__titre", t("app.title")));
  const fields: Record<string, HTMLElement> = {};
  for (const [key, label] of [["date", t("app.date")], ["seed", t("app.seed")], ["hash", t("app.hash")]] as const) {
    const f = el("span", "bandeau__champ");
    f.append(el("span", "bandeau__libelle", label));
    const v = el("span", "bandeau__valeur");
    v.dataset["field"] = key;
    f.append(v);
    fields[key] = v;
    band.append(f);
  }
  const host = el("div", "carte");
  screen.append(band, host);
  app.append(screen);

  const mapData = mapJson as unknown as MapData;
  const map = await StrategicMap.create(host, mapData, buildMapProvinces(mapData, world.provinces), buildLabels(mapData, world.provinces));

  const byId = new Map(world.provinces.map((p) => [p.id, p]));
  const bubble = new Bubble(document.body);
  let selected: string | null = null;
  attachMapControls(host, map, {
    hover(id, x, y) {
      const p = id ? byId.get(id) : undefined;
      if (p) bubble.show(p, state, x, y);
      else bubble.hide();
    },
    select(id) {
      selected = id;
    },
  });

  const fmt = (n: number): string => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: n < 10 ? 2 : 0 }).format(n);
  const layers = new LayersPanel(
    host,
    () => applyOverlay(),
    { pawns: true, labels: true, walls: true, fog: true },
    (f) => map.setFilters(f),
  );
  const applyOverlay = (): void => {
    const id = layers.active;
    const result = id ? computeOverlay(id, world, state, fmt, t) : null;
    map.setOverlay(result?.colors ?? null);
    layers.showLegend(result);
  };

  const keymap = new KeyMap(safeStorage());
  const PAN = 80;
  const actions: Partial<Record<Action, () => void>> = {
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
      selected = null;
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
  void selected;

  const refresh = (): void => {
    const d = state.date;
    if (fields["date"]) fields["date"].textContent = t("date.format", { year: d.year, day: d.day });
    if (fields["seed"]) fields["seed"].textContent = String(state.seed);
    if (fields["hash"]) fields["hash"].textContent = stateHash(state);
    map.setDynamic(mapDynamic(state));
    if (layers.active) applyOverlay();
  };

  const storePromise = SaveStore.open(indexedDB, () => Date.now());
  const consoleHost: ConsoleHost = {
    state: () => state,
    dispatch: async (cmd) => {
      state = (await sim.dispatch(cmd)).state;
    },
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

/** localStorage peut être indisponible (navigation privée, aperçus) : on renvoie null plutôt que d'échouer. */
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
