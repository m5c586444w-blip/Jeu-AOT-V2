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

  const refresh = (): void => {
    const d = state.date;
    if (fields["date"]) fields["date"].textContent = t("date.format", { year: d.year, day: d.day });
    if (fields["seed"]) fields["seed"].textContent = String(state.seed);
    if (fields["hash"]) fields["hash"].textContent = stateHash(state);
    map.setDynamic(mapDynamic(state));
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
