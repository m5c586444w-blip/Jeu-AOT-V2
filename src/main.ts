import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/im-fell-english/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "./ui/styles/base.css";
import "./ui/styles/console.css";
import { SaveStore } from "./save/saveStore";
import { createInitialState } from "./sim/core/state";
import type { GameState } from "./sim/core/state";
import type { SimResponse } from "./sim/sim";
import { canonReportFromBundle } from "./ui/canonBrowser";
import { mountDebugOverlay } from "./ui/debugOverlay";
import type { ConsoleHost } from "./ui/debugConsole";
import { applyPaperTextures } from "./ui/paper";
import { mountStartPage } from "./ui/startPage";
import { SimClient } from "./workers/simClient";

const DEFAULT_SEED = 42;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("seed");
  const n = raw === null ? DEFAULT_SEED : Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : DEFAULT_SEED;
}

async function boot(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;
  applyPaperTextures(document.documentElement);
  const page = mountStartPage(app);

  // La simulation tourne dans un Web Worker ; l'UI ne garde qu'une copie de l'état pour l'affichage.
  const worker = new Worker(new URL("./workers/sim.worker.ts", import.meta.url), { type: "module" });
  const sim = new SimClient({
    post: (m) => worker.postMessage(m),
    onMessage: (h) => worker.addEventListener("message", (ev: MessageEvent<SimResponse>) => h(ev.data)),
  });
  let state: GameState = createInitialState(seedFromUrl());
  state = (await sim.reset(state.seed)).state;
  // Hors de src/sim : l'horloge réelle ne sert qu'à horodater les sauvegardes.
  const storePromise = SaveStore.open(indexedDB, () => Date.now());

  const host: ConsoleHost = {
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

  const refresh = (): void => page.update(state);
  mountDebugOverlay(document.body, host, refresh);
  refresh();
  document.documentElement.dataset["ready"] = "true";
}

void boot();
