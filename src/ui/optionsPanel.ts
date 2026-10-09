import { t } from "../i18n";
import { ACTIONS, keyLabel } from "./keymap";
import type { Action, KeyMap } from "./keymap";
import type { UserTrack } from "../audio/userTracks";
import { BATTLE_QUALITIES, BATTLE_VIEWS, MUSIC_SOURCES, UI_SCALES, VIOLENCES } from "./settings";
import type { Settings } from "./settings";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Dossier « Options » : langue, échelle, son, raccourcis (F-UIX-03, F-UIX-17, F-UIX-18). */
export class OptionsPanel {
  readonly el = el("aside", "options");
  private capturing: Action | null = null;

  constructor(
    parent: HTMLElement,
    private readonly keymap: KeyMap,
    private settings: Settings,
    private readonly onSettings: (s: Settings) => void,
    /** Pistes présentes dans `assets_user/musique/` (AUD.4), lues au moment de l'affichage. */
    private readonly tracks: () => readonly UserTrack[] = () => [],
    /** Rejouer le guide de prise en main (TUT.2) ; absent : le bouton n'est pas proposé. */
    private readonly replayTutorial: (() => void) | null = null,
  ) {
    this.el.hidden = true;
    this.el.setAttribute("aria-label", t("options.title"));
    parent.append(this.el);
    window.addEventListener(
      "keydown",
      (ev) => {
        if (!this.capturing) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (ev.code !== "Escape") this.keymap.rebind(this.capturing, ev.code);
        this.capturing = null;
        this.render();
      },
      { capture: true },
    );
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
    if (!this.el.hidden) this.render();
  }

  private render(): void {
    this.el.replaceChildren();
    const head = el("header", "options__tete");
    head.append(el("h2", "options__titre", t("options.title")));
    const close = el("button", "dossier__fermer", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("dossier.close"));
    close.addEventListener("click", () => this.toggle());
    head.append(close);

    const lang = el("label", "options__ligne");
    lang.append(el("span", "", t("options.language")));
    const sel = el("select", "options__choix");
    for (const [v, label] of [["fr", "Français"], ["en", "English"]] as const) {
      const o = el("option", "", label);
      o.value = v;
      o.selected = this.settings.locale === v;
      sel.append(o);
    }
    sel.dataset["setting"] = "locale";
    sel.addEventListener("change", () => this.change({ ...this.settings, locale: sel.value === "en" ? "en" : "fr" }));
    lang.append(sel);

    const scale = el("label", "options__ligne");
    scale.append(el("span", "", t("options.scale")));
    const sc = el("select", "options__choix");
    for (const v of UI_SCALES) {
      const o = el("option", "", `${v} %`);
      o.value = String(v);
      o.selected = this.settings.uiScale === v;
      sc.append(o);
    }
    sc.dataset["setting"] = "uiScale";
    sc.addEventListener("change", () => this.change({ ...this.settings, uiScale: Number(sc.value) }));
    scale.append(sc);

    // Son (04 §7) : volumes maître, musique, effets ; sous-titres des sons importants.
    const sound = el("fieldset", "options__son");
    sound.append(el("legend", "", t("options.sound")));
    for (const k of ["volMaster", "volMusic", "volAmbient", "volSfx", "volUi"] as const) {
      const row = el("label", "options__ligne");
      row.append(el("span", "", t(`options.${k}`)));
      const r = el("input", "options__curseur");
      r.type = "range";
      r.min = "0";
      r.max = "100";
      r.step = "5";
      r.value = String(this.settings[k]);
      r.dataset["setting"] = k;
      const out = el("output", "options__valeur", `${this.settings[k]} %`);
      r.addEventListener("input", () => {
        out.textContent = `${r.value} %`;
        this.change({ ...this.settings, [k]: Number(r.value) });
      });
      row.append(r, out);
      sound.append(row);
    }
    for (const k of ["musicCombatOnly", "subtitles"] as const) {
      const line = el("label", "options__ligne");
      const box = el("input", "options__case");
      box.type = "checkbox";
      box.checked = this.settings[k];
      box.dataset["setting"] = k;
      box.addEventListener("change", () => this.change({ ...this.settings, [k]: box.checked }));
      line.append(el("span", "", t(`options.${k}`)), box);
      sound.append(line);
    }

    // Musique (AUD.4, AUD.5) : source et pistes personnelles, chacune affectée à un état ou écartée.
    const music = el("fieldset", "options__son options__musique");
    music.append(el("legend", "", t("options.music")));
    const src = el("label", "options__ligne");
    src.append(el("span", "", t("options.musicSource")));
    const srcSel = el("select", "options__choix");
    for (const v of MUSIC_SOURCES) {
      const o = el("option", "", t(`options.source_${v}`));
      o.value = v;
      o.selected = this.settings.musicSource === v;
      srcSel.append(o);
    }
    srcSel.dataset["setting"] = "musicSource";
    srcSel.addEventListener("change", () => this.change({ ...this.settings, musicSource: MUSIC_SOURCES.find((v) => v === srcSel.value) ?? "mixte" }));
    src.append(srcSel);
    music.append(src);
    const list = this.tracks();
    if (list.length === 0) music.append(el("p", "options__note", t("options.tracks_none")));
    else {
      music.append(el("h3", "options__sous-titre", t("options.tracks")));
      for (const tr of list) {
        const row = el("label", "options__ligne options__piste");
        row.append(el("span", "", tr.name));
        const sel = el("select", "options__choix");
        const current = this.settings.userTracks[tr.file] ?? tr.mood;
        for (const v of ["calme", "tension", "combat", "off"] as const) {
          const o = el("option", "", t(`options.track_${v}`));
          o.value = v;
          o.selected = current === v;
          sel.append(o);
        }
        sel.dataset["track"] = tr.file;
        sel.addEventListener("change", () => {
          const v = sel.value;
          if (v === "calme" || v === "tension" || v === "combat" || v === "off") this.change({ ...this.settings, userTracks: { ...this.settings.userTracks, [tr.file]: v } });
        });
        row.append(sel);
        music.append(row);
      }
    }

    const author = el("label", "options__ligne");
    const ab = el("input", "options__case");
    ab.type = "checkbox";
    ab.checked = this.settings.authorMode;
    ab.dataset["setting"] = "authorMode";
    ab.addEventListener("change", () => this.change({ ...this.settings, authorMode: ab.checked }));
    author.append(el("span", "", t("options.author_mode")), ab);

    // Guide de prise en main (TUT.2) : aides contextuelles coupables, guide rejouable.
    const guide = el("fieldset", "options__son options__guide");
    guide.append(el("legend", "", t("options.tutorial")));
    const hintsRow = el("label", "options__ligne");
    const hintsBox = el("input", "options__case");
    hintsBox.type = "checkbox";
    hintsBox.checked = this.settings.tutorial.hints;
    hintsBox.dataset["setting"] = "hints";
    hintsBox.addEventListener("change", () => this.change({ ...this.settings, tutorial: { ...this.settings.tutorial, hints: hintsBox.checked } }));
    hintsRow.append(el("span", "", t("options.hints")), hintsBox);
    guide.append(hintsRow);
    if (this.replayTutorial) {
      const replay = el("button", "options__remise", t("options.tutorial_replay"));
      replay.type = "button";
      replay.dataset["action"] = "rejouer-tuto";
      replay.addEventListener("click", () => this.replayTutorial?.());
      guide.append(replay);
    }

    // Bataille temps réel (R2+) : vue 3D ou 2D, violence montrée, qualité de la vue 3D.
    const battle = el("fieldset", "options__son options__bataille");
    battle.append(el("legend", "", t("options.battle")));
    const pick = <V extends string>(label: string, key: "battleView" | "violence" | "battleQuality", values: readonly V[], current: V, apply: (v: V) => Settings): void => {
      const row = el("label", "options__ligne");
      row.append(el("span", "", t(label)));
      const sel = el("select", "options__choix");
      for (const v of values) {
        const o = el("option", "", t(`options.${key}_${v}`));
        o.value = v;
        o.selected = current === v;
        sel.append(o);
      }
      sel.dataset["setting"] = key;
      sel.addEventListener("change", () => {
        const v = values.find((x) => x === sel.value);
        if (v) this.change(apply(v));
      });
      row.append(sel);
      battle.append(row);
    };
    pick("options.battle_view", "battleView", BATTLE_VIEWS, this.settings.battleView, (v) => ({ ...this.settings, battleView: v }));
    pick("options.battle_quality", "battleQuality", BATTLE_QUALITIES, this.settings.battleQuality, (v) => ({ ...this.settings, battleQuality: v }));
    pick("options.violence", "violence", VIOLENCES, this.settings.violence, (v) => ({ ...this.settings, violence: v }));

    const keys = el("table", "options__touches");
    const caption = el("caption", "", t("options.keys"));
    keys.append(caption);
    for (const a of ACTIONS) {
      const tr = el("tr", "");
      const b = el("button", "options__touche", this.capturing === a ? t("options.press_key") : keyLabel(this.keymap.codeOf(a)));
      b.type = "button";
      b.dataset["action"] = a;
      b.addEventListener("click", () => {
        this.capturing = a;
        this.render();
      });
      const td = el("td", "");
      td.append(b);
      tr.append(el("td", "", t(`action.${a}`)), td);
      keys.append(tr);
    }
    const reset = el("button", "options__remise", t("options.reset_keys"));
    reset.type = "button";
    reset.addEventListener("click", () => {
      this.keymap.reset();
      this.render();
    });
    this.el.append(head, lang, scale, sound, music, battle, guide, author, keys, reset);
  }

  /** Préférences changées hors du dossier (touche F10). */
  sync(s: Settings): void {
    this.settings = s;
    if (this.isOpen) this.render();
  }

  private change(s: Settings): void {
    this.settings = s;
    this.onSettings(s);
  }
}
