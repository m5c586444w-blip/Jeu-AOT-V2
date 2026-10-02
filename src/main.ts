import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/im-fell-english/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "./ui/styles/base.css";
import "./ui/styles/console.css";
import { SaveStore } from "./save/saveStore";
import { applyCommand } from "./sim/core/commands";
import { createInitialState } from "./sim/core/state";
import { canonReportFromBundle } from "./ui/canonBrowser";
import { mountDebugOverlay } from "./ui/debugOverlay";
import type { ConsoleHost } from "./ui/debugConsole";
import { applyPaperTextures } from "./ui/paper";
import { mountStartPage } from "./ui/startPage";

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

  let state = createInitialState(seedFromUrl());
  // Hors de src/sim : l'horloge réelle ne sert qu'à horodater les sauvegardes.
  const storePromise = SaveStore.open(indexedDB, () => Date.now());

  const host: ConsoleHost = {
    state: () => state,
    dispatch: async (cmd) => {
      state = applyCommand(state, cmd);
    },
    reset: async (seed) => {
      state = createInitialState(seed);
    },
    save: async (slot) => {
      await (await storePromise).save(slot, state);
    },
    load: async (slot) => {
      state = await (await storePromise).load(slot);
    },
    canonReport: canonReportFromBundle,
  };

  const refresh = (): void => page.update(state);
  mountDebugOverlay(document.body, host, refresh);
  refresh();
  document.documentElement.dataset["ready"] = "true";
}

void boot();
