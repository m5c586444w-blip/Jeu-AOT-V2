import { t } from "../../i18n";
import type { TutorialPrefs } from "../settings";
import { placeBubble } from "./placement";

/** Éléments qui reçoivent une aide contextuelle, une seule fois chacun (TUT.2) : un texte `aide.<id>` par entrée. */
export const HINT_IDS: readonly string[] = [
  "province",
  "bataille",
  "personnages", "cabinet", "decrets", "organisations", "conseil", "journal", "expeditions", "chronique", "renseignement", "recherche", "porteurs", "monde", "diplomatie", "gazette", "archives", "epilogue", "economie", "armees", "missions",
];

export interface HintsHost {
  prefs(): TutorialPrefs;
  save(p: TutorialPrefs): void;
  /** Le tutoriel guidé est en cours : pas d'aide contextuelle en plus. */
  busy(): boolean;
}

/**
 * Aides contextuelles (TUT.2) : une petite carte près de l'élément, la première fois seulement qu'il s'ouvre.
 * Actives après le tutoriel guidé (terminé ou quitté), désactivables dans les options.
 */
export class Hints {
  private readonly card = document.createElement("aside");
  private current: string | null = null;

  constructor(parent: HTMLElement, private readonly host: HintsHost) {
    this.card.className = "aide-ctx";
    this.card.setAttribute("role", "status");
    this.card.hidden = true;
    parent.append(this.card);
  }

  get shown(): string | null {
    return this.current;
  }

  /** L'élément `id` vient de s'ouvrir ; `anchor` est son cadre à l'écran. Rien si l'aide est coupée, déjà vue ou sans texte. */
  show(id: string, anchor: Element | null): boolean {
    const p = this.host.prefs();
    if (!p.hints || this.host.busy() || p.seen.includes(id) || !HINT_IDS.includes(id)) return false;
    this.host.save({ ...p, seen: [...p.seen, id] });
    this.card.replaceChildren();
    const text = document.createElement("p");
    text.className = "aide-ctx__texte";
    text.textContent = t(`aide.${id}`);
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "aide-ctx__ok";
    ok.dataset["aide"] = "compris";
    ok.textContent = t("aide.ok");
    ok.addEventListener("click", () => this.hide());
    this.card.append(text, ok);
    this.card.dataset["aide"] = id;
    this.card.hidden = false;
    this.current = id;
    const w = this.card.offsetWidth;
    const h = this.card.offsetHeight;
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const r = anchor?.getBoundingClientRect();
    // Sans cadre (aide de la carte) ou cadre très grand : coin bas droit, au-dessus du menu de gestion.
    const placed = r && r.width < vp.width * 0.6 ? placeBubble({ left: r.left, top: r.top, width: r.width, height: r.height }, { width: w, height: h }, vp, 10, 8) : { left: vp.width - w - 16, top: vp.height * 0.7 - h };
    this.card.style.left = `${Math.round(placed.left)}px`;
    this.card.style.top = `${Math.round(placed.top)}px`;
    return true;
  }

  hide(): void {
    this.card.hidden = true;
    this.current = null;
  }
}
