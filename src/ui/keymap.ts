/**
 * Raccourcis clavier configurables (F-UIX-03). Logique pure : la persistance passe par un `Storage` injecté.
 * Codes = `KeyboardEvent.code` (indépendants de la disposition du clavier).
 */
export const ACTIONS = [
  "pause", "speed_1", "speed_2", "speed_3", "speed_4", "speed_5",
  "zoom_in", "zoom_out", "pan_up", "pan_down", "pan_left", "pan_right",
  "lod_monde", "lod_region", "lod_province", "fit",
  "overlay_next", "overlay_off", "close", "console", "options", "author_mode",
  "open_characters", "open_cabinet", "open_laws", "open_orgs", "open_council", "open_journal", "open_expeditions",
  "open_chronicle", "open_intel", "open_research", "open_shifters", "open_world", "open_diplomacy", "open_gazette", "open_archives", "open_epilogue", "open_economy", "open_armies", "open_missions",
] as const;
export type Action = (typeof ACTIONS)[number];

export const DEFAULT_BINDINGS: Readonly<Record<Action, string>> = {
  pause: "Space",
  speed_1: "Digit1", speed_2: "Digit2", speed_3: "Digit3", speed_4: "Digit4", speed_5: "Digit5",
  zoom_in: "Equal", zoom_out: "Minus",
  pan_up: "ArrowUp", pan_down: "ArrowDown", pan_left: "ArrowLeft", pan_right: "ArrowRight",
  lod_monde: "KeyM", lod_region: "KeyR", lod_province: "KeyP", fit: "KeyF",
  overlay_next: "KeyO", overlay_off: "KeyX",
  close: "Escape", console: "F2", options: "F9", author_mode: "F10",
  open_characters: "KeyC", open_cabinet: "KeyK", open_laws: "KeyL", open_orgs: "KeyG", open_council: "KeyA", open_journal: "KeyJ", open_expeditions: "KeyE",
  open_chronicle: "KeyH", open_intel: "KeyI", open_research: "KeyB", open_shifters: "KeyT", open_world: "KeyW", open_diplomacy: "KeyD", open_gazette: "KeyN", open_archives: "KeyY", open_epilogue: "KeyU", open_economy: "KeyV", open_armies: "KeyS", open_missions: "KeyZ",
};

/** Action clavier qui ouvre chaque registre (raccourcis affichés dans les infobulles et les têtes de registre, U10). */
export const PANEL_ACTION: Readonly<Record<string, Action>> = {
  personnages: "open_characters", cabinet: "open_cabinet", decrets: "open_laws", organisations: "open_orgs", conseil: "open_council", journal: "open_journal", expeditions: "open_expeditions",
  chronique: "open_chronicle", renseignement: "open_intel", recherche: "open_research", porteurs: "open_shifters", monde: "open_world", diplomatie: "open_diplomacy", gazette: "open_gazette", archives: "open_archives", epilogue: "open_epilogue", economie: "open_economy", armees: "open_armies", missions: "open_missions",
};

const STORAGE_KEY = "murs-et-sang:raccourcis";

export class KeyMap {
  private bindings: Record<Action, string>;

  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> | null = null) {
    this.bindings = { ...DEFAULT_BINDINGS };
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Record<string, string>>;
        for (const a of ACTIONS) {
          const code = saved[a];
          if (typeof code === "string" && code.length > 0) this.bindings[a] = code;
        }
      }
    } catch {
      // Stockage indisponible ou illisible : on garde les valeurs par défaut.
    }
  }

  codeOf(action: Action): string {
    return this.bindings[action];
  }

  actionFor(code: string): Action | null {
    return ACTIONS.find((a) => this.bindings[a] === code) ?? null;
  }

  /** Réassigne une touche ; si elle servait déjà, les deux actions échangent leurs touches. Renvoie l'action déplacée. */
  rebind(action: Action, code: string): Action | null {
    const previous = this.actionFor(code);
    if (previous && previous !== action) this.bindings[previous] = this.bindings[action];
    this.bindings[action] = code;
    this.persist();
    return previous && previous !== action ? previous : null;
  }

  reset(): void {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.persist();
  }

  all(): Readonly<Record<Action, string>> {
    return this.bindings;
  }

  private persist(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
    } catch {
      // Stockage refusé (navigation privée…) : la configuration reste valable pour la session.
    }
  }
}

/** Libellé lisible d'un code de touche. */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const names: Record<string, string> = { Space: "Espace", Escape: "Échap", Equal: "=", Minus: "−", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  return names[code] ?? code;
}
