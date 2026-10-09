import { t } from "../../i18n";
import type { BattleView, PickHit, ViewOptions } from "../../render/battleView";
import { View2D } from "../../render/tactical/view2d";
import type { World } from "../../sim/strategic/world";
import { createBattle, stepBattle } from "../../sim/tactical/battle";
import type { Battle } from "../../sim/tactical/battle";
import { bodyName } from "../../sim/tactical/shifters";
import { FORMATIONS, RESTRAINTS, SHIFTER_OBJECTIVES } from "../../sim/tactical/types";
import type { BattleSetup, Restraint, ShifterObjective, SquadOrder, TimedOrder } from "../../sim/tactical/types";
import { letterFor } from "../narrative";
import { battleCues, cueSnapshot, sharedAudio } from "../audio";
import { BATTLE_QUALITIES, BATTLE_VIEWS, VIOLENCES, loadSettings, volumesOf } from "../settings";
import type { BattleQualityPref, BattleViewPref, ViolencePref } from "../settings";
import { button, el } from "../panels/common";
import { formatNumber } from "../why";
import type { WhyTooltip } from "../why";
import { advanceFrame } from "./battleClock";
import type { BattleClock } from "./battleClock";
import { placeSubtitles } from "./subtitlePlacement";
import { battleSummary, troopSummary } from "./summary";
import * as C from "./rtControls";

/**
 * Écran de bataille temps réel (R2+) : 100 à 400 unités, sélection (clic, Alt+clic, rectangle, groupes numérotés), ordres
 * par escouade et par unité, formations, file d'ordres (Maj), pause active, tir sur zone de l'artillerie, ordres généraux des
 * porteurs (jamais pilotés), caméra stratégique libre et suivi à la troisième personne (touche V). Vue 3D (three.js chargé à
 * la demande) ou 2D (Pixi) en repli. Tout ordre passe par le journal : la campagne rejoue la même bataille.
 */

const SPEEDS = [0, 0.25, 0.5, 1, 2, 4] as const;
const ZONE_R = 30;
const SHIFTER_ZONE_R = 60;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const clock = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** WebGL 2 disponible (three.js l'exige) ? Le contexte d'essai est rendu aussitôt. */
export function webgl2Available(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export interface RtBattleOptions {
  world: World;
  why: WhyTooltip;
  setup: BattleSetup;
  title: string;
  /** Bataille liée (rencontre d'armées) : « Valider » renvoie le journal d'ordres ; sinon « Fermer ». */
  linked: boolean;
}

type Targeting = { kind: "deplacer" | "tuer" | "suivre"; queue: boolean } | { kind: "tir_zone"; battery: string } | { kind: "zone_porteur"; shifter: number };

/** Vue de bataille : 3D si demandée et possible, sinon 2D (avec la raison du repli). */
async function createView(host: HTMLElement, kind: BattleViewPref, opts: ViewOptions, seed: number, night: boolean): Promise<{ view: BattleView; fallback: string | null }> {
  if (kind === "3d") {
    if (!webgl2Available()) return { view: await View2D.create(host), fallback: t("rt.no_webgl") };
    try {
      const m = await import("../../render/tactical3d/battle/view3d");
      return { view: m.createView3d(host, opts, seed, night), fallback: null };
    } catch (e) {
      return { view: await View2D.create(host), fallback: t("rt.view3d_failed", { msg: e instanceof Error ? e.message : String(e) }) };
    }
  }
  return { view: await View2D.create(host), fallback: null };
}

export async function openRtBattleScreen(o: RtBattleOptions): Promise<TimedOrder[] | null> {
  const prefs = loadSettings(storage());
  let viewKind: BattleViewPref = prefs.battleView;
  let quality: BattleQualityPref = prefs.battleQuality;
  let violence: ViolencePref = prefs.violence;
  const root = el("section", "bataille bataille--rt");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", o.title);
  const head = el("header", "bataille-tete");
  const title = el("h2", "bataille-titre", o.title);
  const timer = el("span", "bataille-horloge", "00:00");
  const speeds = el("div", "bataille-vitesses");
  const host = el("div", "bataille-scene rt-scene");
  const side = el("aside", "bataille-carnet rt-panneau");
  const bar = el("footer", "bataille-escouades rt-unites");
  const perf = el("span", "bataille-perf");
  perf.hidden = !document.querySelector(".debug-console:not([hidden])");
  const viewLabel = el("span", "rt-vue");
  const camBtn = button(t("rt.camera_strategic"), () => toggleCamera(), "registre-bouton petit");
  camBtn.dataset["action"] = "camera";
  camBtn.title = t("rt.key_camera");
  const optBtn = button(t("rt.options"), () => (optBox.hidden = !optBox.hidden), "registre-bouton petit");
  optBtn.dataset["action"] = "options-bataille";
  head.append(title, timer, speeds, camBtn, viewLabel, optBtn, perf);
  const rect = el("div", "rt-rect");
  rect.hidden = true;
  const labels = el("div", "rt-etiquettes");
  const pauseBanner = el("p", "rt-pause", t("rt.paused"));
  const message = el("p", "rt-message");
  message.hidden = true;
  const optBox = el("div", "rt-options");
  optBox.hidden = true;
  host.append(rect, labels, pauseBanner, message, optBox);
  root.append(head, host, side, bar);
  document.body.append(root);
  document.body.dataset["tactique"] = "1";

  const bt: Battle = createBattle(o.world, o.setup);
  const st = (): Battle["state"] => bt.state;
  root.dataset["unites"] = String(bt.state.soldiers.length + (bt.state.troops?.length ?? 0) + bt.state.titans.length + (bt.state.batteries ?? []).reduce((n, b) => n + b.count, 0));
  root.dataset["titans"] = String(bt.state.titans.length);
  let view: BattleView;
  const framePoints = (): { x: number; y: number; z: number }[] => [
    ...bt.state.soldiers.map((s) => ({ x: s.x, y: s.y, z: 0 })),
    ...(bt.state.troops ?? []).map((x) => ({ x: x.x, y: x.y, z: 0 })),
    ...bt.state.titans.map((x) => ({ x: x.x, y: x.y, z: x.height })),
  ];
  const mountView = async (): Promise<void> => {
    const made = await createView(host, viewKind, { quality, violence }, o.setup.seed, o.setup.night);
    view = made.view;
    host.prepend(view.canvas);
    view.setMap(bt.map);
    view.frame(framePoints());
    message.hidden = !made.fallback;
    message.textContent = made.fallback ?? "";
    root.dataset["vue"] = view.kind;
    // Sonde des contrôles (smoke:r2), serveur de développement seulement : vue et bataille en lecture.
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>)["__batailleRt"] = { view, bt, orders: () => orders };
    root.dataset["repli"] = made.fallback ? "1" : "0";
    viewLabel.textContent = t(view.kind === "3d" ? "rt.view_3d" : "rt.view_2d");
  };
  await mountView();

  // ——— État de l'interface ———
  const orders: TimedOrder[] = [];
  let sel: C.Selection = C.EMPTY;
  let targeting: Targeting | null = null;
  const groups = new Map<number, string[]>();
  let focusTitan: number | null = null;
  let speed = 0;
  let lastSpeed = 1;
  let done = false;
  const directive = new Map<number, { objective: ShifterObjective; restraint: Restraint; zone: { x: number; y: number; r: number } | null }>();
  const audio = sharedAudio(volumesOf(prefs));
  audio.setMood("combat");
  audio.setAmbience(bt.map.terrain === "ville" ? "ville" : bt.map.terrain === "foret" ? "foret" : bt.map.terrain === "mur" ? "mur" : "vent");
  let lastCues = cueSnapshot(bt.state);

  const unitName = (id: string): string => {
    const sq = bt.state.squads.find((x) => x.id === id);
    if (sq?.side) {
      const kind = bt.state.troops?.find((x) => x.section === id)?.kind ?? "fusilier";
      return t("rt.section", { n: Number(id.replace(/\D/g, "")) || 0, kind: t(`rt.kind.${kind}`) });
    }
    return id === "officiers" ? t("tac.officers") : id.replace("esc_", t("tac.squad_n"));
  };
  const batteryName = (id: string): string => {
    const b = bt.state.batteries?.find((x) => x.id === id);
    return b ? t(`art.${b.piece.replace(/^art_/, "")}`) : id;
  };

  // ——— Vitesses, pause active ———
  const speedButtons = SPEEDS.map((sp) => {
    const b = el("button", "bataille-vitesse", sp === 0 ? "‖" : `×${formatNumber(sp)}`);
    b.type = "button";
    b.dataset["speed"] = String(sp);
    b.addEventListener("click", () => setSpeed(sp));
    speeds.append(b);
    return b;
  });
  const setSpeed = (sp: number): void => {
    if (sp > 0) lastSpeed = sp;
    speed = sp;
    for (const b of speedButtons) b.setAttribute("aria-pressed", String(Number(b.dataset["speed"]) === sp));
    pauseBanner.hidden = sp !== 0 || !!bt.state.ended;
    root.dataset["pause"] = sp === 0 ? "1" : "0";
  };
  setSpeed(0);

  // ——— Options de la bataille (vue, qualité, violence) : valent pour cette bataille ; les préférences durables sont dans Options. ———
  const optSelect = <V extends string>(label: string, key: string, values: readonly V[], current: () => V, apply: (v: V) => void): HTMLLabelElement => {
    const row = el("label", "options__ligne");
    row.append(el("span", "", t(label)));
    const s = el("select", "options__choix");
    for (const v of values) {
      const op = el("option", "", t(`options.${key}_${v}`));
      op.value = v;
      op.selected = current() === v;
      s.append(op);
    }
    s.dataset["rtOption"] = key;
    s.addEventListener("change", () => {
      const v = values.find((x) => x === s.value);
      if (v) apply(v);
    });
    row.append(s);
    return row;
  };
  optBox.append(
    optSelect("options.battle_view", "battleView", BATTLE_VIEWS, () => viewKind, (v) => {
      viewKind = v;
      view.destroy();
      void mountView().then(() => view.setCamera("strategique"));
    }),
    optSelect("options.battle_quality", "battleQuality", BATTLE_QUALITIES, () => quality, (v) => {
      quality = v;
      view.setOptions({ quality, violence });
    }),
    optSelect("options.violence", "violence", VIOLENCES, () => violence, (v) => {
      violence = v;
      view.setOptions({ quality, violence });
      root.dataset["violence"] = v;
    }),
    el("p", "registre-note", t("rt.options_note")),
  );
  root.dataset["violence"] = violence;

  // ——— Ordres ———
  const give = (list: readonly (TimedOrder | null)[]): void => {
    const ok = list.filter((x): x is TimedOrder => !!x);
    if (ok.length === 0) return;
    orders.push(...ok);
    root.dataset["ordres"] = String(orders.length);
    renderPanel();
  };
  const squadOrder = (order: SquadOrder, queue: boolean): void => {
    if (order === "deplacer" || order === "suivre") {
      setTargeting({ kind: order, queue });
      return;
    }
    if (order === "tuer" && !sel.unit) {
      setTargeting({ kind: "tuer", queue });
      return;
    }
    give(C.ordersFor(bt.state, sel, order, { queue }));
  };
  const setTargeting = (m: Targeting | null): void => {
    targeting = m;
    root.dataset["mode"] = m ? m.kind : "";
    renderPanel();
  };

  // ——— Panneau : sélection, ordres, formations, file ; artillerie ; porteurs ; carnet ———
  const selBox = el("section", "rt-bloc rt-selection");
  const artBox = el("section", "rt-bloc rt-artillerie");
  const shBox = el("section", "rt-bloc rt-porteurs");
  const logBox = el("section", "rt-bloc rt-carnet");
  const logList = el("ol", "carnet-lignes");
  logBox.append(el("h3", "registre-intertitre", t("tac.carnet")), logList);
  const help = el("p", "registre-note rt-aide", t("rt.help"));
  side.append(selBox, artBox, shBox, logBox, help);

  const ORDER_KEYS: Record<C.RtSquadOrder, string> = { deplacer: "D", tuer: "A", couvrir: "C", repli: "R", tenir: "T", suivre: "S" };
  const renderPanel = (): void => {
    const s = bt.state;
    selBox.replaceChildren(el("h3", "registre-intertitre", t("rt.selection")));
    const ids = sel.squads.filter((id) => C.membersOf(s, id).length > 0);
    if (ids.length === 0 && !sel.unit) selBox.append(el("p", "registre-note", t("rt.select_hint")));
    else {
      const men = ids.reduce((n, id) => n + C.membersOf(s, id).length, 0);
      const name = sel.unit ? t("rt.unit_of", { squad: unitName(sel.unit.squad) }) : ids.length === 1 ? unitName(ids[0] ?? "") : t("rt.n_squads", { n: ids.length });
      selBox.append(el("p", "rt-nom", name));
      const first = ids[0];
      if (first && !sel.unit) {
        const sq = s.squads.find((x) => x.id === first);
        const line = el("p", "registre-note");
        const v = el("span", "valeur", formatNumber(men));
        o.why.bind(v, () => ({ title: name, sections: [{ text: t("rt.men_why") }] }));
        line.append(t("rt.men"), " ", v, ` · ${t(`order.${C.shownOrder(s, orders, first)}`)} · ${t(`formation.${sq?.formation ?? "ligne"}`)}`);
        selBox.append(line);
      }
    }
    const row = el("div", "carte-escouade-ordres rt-ordres");
    for (const ord of C.RT_SQUAD_ORDERS) {
      const b = button(`${t(`order.${ord}`)} (${ORDER_KEYS[ord]})`, () => squadOrder(ord, false), "registre-bouton petit");
      b.dataset["order"] = ord;
      b.disabled = ids.length === 0 && !sel.unit;
      if (targeting && "queue" in targeting && targeting.kind === ord) b.setAttribute("aria-pressed", "true");
      row.append(b);
    }
    selBox.append(row);
    const forms = el("div", "carte-escouade-ordres rt-formations");
    for (const f of FORMATIONS) {
      const b = button(t(`formation.${f}`), () => give(C.formationOrders(bt.state, sel, f)), "registre-bouton petit");
      b.dataset["formation"] = f;
      b.disabled = ids.length === 0 || !!sel.unit;
      forms.append(b);
    }
    selBox.append(forms);
    // Groupes numérotés : Ctrl + chiffre, ou ce choix (Ctrl + chiffre change d'onglet dans certains navigateurs).
    const grp = el("label", "plan-ligne rt-groupe");
    const gs = el("select", "plan-choix");
    gs.dataset["action"] = "groupe";
    gs.append(el("option", "", t("rt.group_pick")));
    for (let n = 1; n <= 9; n++) {
      const op = el("option", "", t("rt.group_n", { n }));
      op.value = String(n);
      gs.append(op);
    }
    gs.disabled = ids.length === 0;
    gs.addEventListener("change", () => {
      const n = Number(gs.value);
      if (n >= 1) assignGroup(n);
    });
    grp.append(`${t("rt.group_save")} `, gs);
    selBox.append(grp);
    // File d'ordres de la première escouade sélectionnée.
    const first = ids[0];
    const queue = first ? C.queueOf(s, orders, first) : [];
    root.dataset["file"] = String(queue.length);
    if (queue.length > 0) {
      selBox.append(el("h4", "", t("rt.queue")));
      const ol = el("ol", "rt-file");
      for (const q of queue) ol.append(el("li", "", t(`order.${q}`)));
      selBox.append(ol);
    }
    if (targeting) selBox.append(el("p", "rt-cible", t(`rt.target.${targeting.kind}`)));
    // Artillerie alliée : tir sur zone, cessez-le-feu, feu libre.
    artBox.replaceChildren();
    const bats = (s.batteries ?? []).filter((b) => b.side === "allie");
    artBox.hidden = bats.length === 0;
    if (bats.length > 0) {
      artBox.append(el("h3", "registre-intertitre", t("rt.artillery")));
      for (const b of bats) {
        const line = el("div", "rt-batterie");
        line.dataset["battery"] = b.id;
        const state = b.alive <= 0 ? t("rt.battery_silenced") : b.hold ? t("rt.battery_hold") : b.zone ? t("rt.battery_zone") : t("rt.battery_free");
        const cnt = el("span", "valeur", `${b.alive}/${b.count}`);
        o.why.bind(cnt, () => ({ title: batteryName(b.id), sections: [{ text: t("rt.battery_why", { shots: b.shots }) }] }));
        line.append(el("strong", "", batteryName(b.id)), " ", cnt, ` · ${state}`);
        const zb = button(t("rt.fire_zone"), () => setTargeting({ kind: "tir_zone", battery: b.id }), "registre-bouton petit");
        zb.dataset["action"] = "tir-zone";
        const cb = button(t("rt.cease_fire"), () => give([C.batteryOrder(bt.state, b.id, null)]), "registre-bouton petit");
        cb.dataset["action"] = "cessez-feu";
        const fb = button(t("rt.free_fire"), () => give([{ tick: bt.state.tick, squad: b.id, order: "tir_zone" }]), "registre-bouton petit");
        fb.dataset["action"] = "feu-libre";
        line.append(el("br"), zb, cb, fb);
        artBox.append(line);
      }
    }
    // Porteurs alliés : ordre général (objectif, zone, retenue), jamais de pilotage.
    shBox.replaceChildren();
    const shifters = (s.shifters ?? []).map((u, i) => ({ u, i })).filter((x) => x.u.side === "allie");
    shBox.hidden = shifters.length === 0;
    if (shifters.length > 0) {
      shBox.append(el("h3", "registre-intertitre", t("rt.shifters")), el("p", "registre-note", t("rt.shifters_note")));
      for (const { u, i } of shifters) {
        const d = directive.get(i) ?? { objective: u.directive?.objective ?? "libre", restraint: u.directive?.restraint ?? "mesuree", zone: u.directive?.zone ?? null };
        directive.set(i, d);
        const box = el("div", "rt-porteur");
        box.dataset["shifter"] = String(i);
        box.append(el("strong", "", u.name), ` · ${t(`rt.phase.${u.phase}`)}`);
        const pick = <V extends string>(key: string, values: readonly V[], cur: V, set: (v: V) => void): HTMLSelectElement => {
          const sl = el("select", "plan-choix");
          sl.dataset["directive"] = key;
          for (const v of values) {
            const op = el("option", "", t(`rt.${key}.${v}`));
            op.value = v;
            op.selected = v === cur;
            sl.append(op);
          }
          sl.addEventListener("change", () => {
            const v = values.find((x) => x === sl.value);
            if (v) set(v);
          });
          return sl;
        };
        const l1 = el("label", "plan-ligne");
        l1.append(`${t("rt.objective_label")} `, pick("objective", SHIFTER_OBJECTIVES, d.objective, (v) => (d.objective = v)));
        const l2 = el("label", "plan-ligne");
        l2.append(`${t("rt.restraint_label")} `, pick("restraint", RESTRAINTS, d.restraint, (v) => (d.restraint = v)));
        const zb = button(d.zone ? t("rt.zone_set") : t("rt.zone_pick"), () => setTargeting({ kind: "zone_porteur", shifter: i }), "registre-bouton petit");
        zb.dataset["action"] = "zone-porteur";
        const nz = button(t("rt.zone_clear"), () => {
          d.zone = null;
          renderPanel();
        }, "registre-bouton petit");
        const go = button(t("rt.shifter_send"), () => give([C.shifterOrder(bt.state, i, d)]), "registre-bouton petit principal");
        go.dataset["action"] = "ordre-porteur";
        box.append(l1, l2, zb, nz, go);
        shBox.append(box);
      }
    }
  };

  // ——— Bandeau des unités : escouades et sections alliées (clic : sélection, Maj : ajout, double-clic : suivre) ———
  const chips = new Map<string, { b: HTMLButtonElement; men: HTMLSpanElement; ord: HTMLSpanElement; grp: HTMLSpanElement }>();
  for (const sq of bt.state.squads.filter((x) => x.side !== "ennemi")) {
    const b = el("button", "rt-unite");
    b.type = "button";
    b.dataset["squad"] = sq.id;
    const men = el("span", "rt-unite__hommes");
    const ord = el("span", "rt-unite__ordre");
    const grp = el("span", "rt-unite__groupe");
    b.append(grp, el("strong", "", unitName(sq.id)), men, ord);
    b.addEventListener("click", (ev) => {
      select(ev.shiftKey ? { ...C.EMPTY, squads: sel.squads.includes(sq.id) ? sel.squads.filter((x) => x !== sq.id) : [...sel.squads, sq.id] } : { ...C.EMPTY, squads: [sq.id] });
    });
    b.addEventListener("dblclick", () => {
      select({ ...C.EMPTY, squads: [sq.id] });
      if (view.camera !== "suivi") toggleCamera();
    });
    bar.append(b);
    chips.set(sq.id, { b, men, ord, grp });
  }
  const renderChips = (): void => {
    for (const [id, c] of chips) {
      const sq = bt.state.squads.find((x) => x.id === id);
      const n = C.membersOf(bt.state, id).length;
      const size = sq?.side ? (sq.size ?? n) : bt.state.soldiers.filter((s) => s.squad === id).length;
      const men = `${n}/${size}`;
      if (c.men.textContent !== men) c.men.textContent = men;
      const ord = t(`order.${C.shownOrder(bt.state, orders, id)}`);
      if (c.ord.textContent !== ord) c.ord.textContent = ord;
      const g = [...groups.entries()].filter(([, l]) => l.includes(id)).map(([k]) => k).join(",");
      if (c.grp.textContent !== g) c.grp.textContent = g;
      const on = String(sel.squads.includes(id));
      if (c.b.getAttribute("aria-pressed") !== on) c.b.setAttribute("aria-pressed", on);
      c.b.disabled = n === 0;
    }
  };
  const select = (s: C.Selection): void => {
    sel = s;
    root.dataset["selection"] = sel.unit ? `${sel.unit.troop ? "troupe" : "soldat"}:${sel.unit.index}` : sel.squads.join(",");
    renderPanel();
    renderChips();
  };
  const assignGroup = (n: number): void => {
    if (sel.squads.length === 0) return;
    groups.set(n, [...sel.squads]);
    root.dataset["groupes"] = [...groups.entries()].map(([k, l]) => `${k}:${l.join("+")}`).join(" ");
    renderChips();
    renderPanel();
  };
  select(C.EMPTY);

  // ——— Caméra : stratégique libre ↔ suivi (escouade, unité ou Titan) ———
  const prevCenter = new Map<string, { x: number; y: number; h: number }>();
  const followTarget = (): { x: number; y: number; z: number; heading: number; height: number } | null => {
    const s = bt.state;
    if (focusTitan !== null && sel.squads.length === 0 && !sel.unit) {
      const ti = s.titans[focusTitan];
      if (ti) return { x: ti.x, y: ti.y, z: 0, heading: ti.heading, height: ti.height };
    }
    if (sel.unit) {
      const m = sel.unit.troop ? s.troops?.[sel.unit.index] : s.soldiers[sel.unit.index];
      if (m && m.mode !== "mort") return { x: m.x, y: m.y, z: "z" in m ? m.z : 0, heading: "heading" in m ? m.heading : -Math.PI / 2, height: 1.8 };
    }
    const id = sel.squads[0] ?? C.commandable(s)[0]?.id;
    if (!id) return null;
    const c = C.centerOf(s, id);
    if (!c) return null;
    const sq = s.squads.find((x) => x.id === id);
    const pc = prevCenter.get(id);
    let h = pc?.h ?? sq?.heading ?? -Math.PI / 2;
    if (pc && Math.hypot(c.x - pc.x, c.y - pc.y) > 0.4) h = Math.atan2(c.y - pc.y, c.x - pc.x);
    if (!pc || Math.hypot(c.x - pc.x, c.y - pc.y) > 0.4) prevCenter.set(id, { ...c, h });
    return { x: c.x, y: c.y, z: 0, heading: h, height: 1.8 };
  };
  const toggleCamera = (): void => {
    const next = view.camera === "suivi" ? "strategique" : "suivi";
    view.setCamera(next);
    const f = next === "suivi" ? followTarget() : null;
    if (f) view.follow(f.x, f.y, f.z, f.heading, f.height);
    root.dataset["camera"] = next;
    camBtn.textContent = t(next === "suivi" ? "rt.camera_follow" : "rt.camera_strategic");
  };
  root.dataset["camera"] = "strategique";

  // ——— Souris : sélection, rectangle, ordres (clic droit), caméra (glisser clic droit ou milieu, molette) ———
  const local = (ev: { clientX: number; clientY: number }): [number, number] => {
    const r = host.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };
  host.addEventListener("contextmenu", (ev) => ev.preventDefault());
  host.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const [x, y] = local(ev);
    view.zoomAt(x, y, ev.deltaY < 0 ? 1.15 : 0.87);
    root.dataset["zoom"] = view.zoomLevel.toFixed(2);
  }, { passive: false });
  let drag: { button: number; x0: number; y0: number; x: number; y: number; moved: boolean } | null = null;
  host.addEventListener("pointerdown", (ev) => {
    if (ev.target !== view.canvas && ev.target !== host) return;
    const [x, y] = local(ev);
    drag = { button: ev.button, x0: x, y0: y, x, y, moved: false };
  });
  const onMove = (ev: PointerEvent): void => {
    if (!drag) return;
    const [x, y] = local(ev);
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (Math.abs(x - drag.x0) + Math.abs(y - drag.y0) > 5) drag.moved = true;
    if (!drag.moved) return;
    if (drag.button === 0 && !targeting) {
      rect.hidden = false;
      rect.style.left = `${Math.min(drag.x0, x)}px`;
      rect.style.top = `${Math.min(drag.y0, y)}px`;
      rect.style.width = `${Math.abs(x - drag.x0)}px`;
      rect.style.height = `${Math.abs(y - drag.y0)}px`;
    } else if (drag.button !== 0) {
      if (ev.altKey && view.kind === "3d") view.rotateBy(dx * 0.006);
      else view.panBy(dx, dy);
      if (view.camera === "suivi") toggleCamera();
    }
    drag.x = x;
    drag.y = y;
  };
  const onUp = (ev: PointerEvent): void => {
    const d = drag;
    drag = null;
    rect.hidden = true;
    if (!d) return;
    const [x, y] = local(ev);
    if (d.button === 0) {
      if (d.moved && !targeting) {
        select(C.rectSelect(bt.state, (a, b, c) => view.toScreen(a, b, c), { x0: d.x0, y0: d.y0, x1: x, y1: y }, ev.shiftKey ? sel : null));
        return;
      }
      if (d.moved) return;
      const hit = view.pick(bt.state, x, y);
      if (targeting) {
        clickTarget(hit, view.groundAt(x, y), ev.shiftKey);
        return;
      }
      if (hit?.kind === "titan") {
        focusTitan = hit.index;
        root.dataset["titan"] = String(hit.index);
      }
      select(C.clickSelect(bt.state, sel, hit, { alt: ev.altKey, shift: ev.shiftKey }));
    } else if (d.button === 2 && !d.moved) {
      if (targeting) {
        setTargeting(null);
        return;
      }
      give(C.defaultOrders(bt.state, sel, view.pick(bt.state, x, y), view.groundAt(x, y), ev.shiftKey));
    }
  };
  const clickTarget = (hit: PickHit | null, ground: { x: number; y: number } | null, shift: boolean): void => {
    const m = targeting;
    if (!m) return;
    if (m.kind === "tir_zone") {
      if (ground) give([C.batteryOrder(bt.state, m.battery, { x: ground.x, y: ground.y, r: ZONE_R })]);
    } else if (m.kind === "zone_porteur") {
      const dd = directive.get(m.shifter);
      if (ground && dd) dd.zone = { x: ground.x, y: ground.y, r: SHIFTER_ZONE_R };
    } else if (m.kind === "deplacer") {
      if (ground) give(C.ordersFor(bt.state, sel, "deplacer", { x: ground.x, y: ground.y, queue: m.queue || shift }));
    } else if (m.kind === "suivre") {
      const squad = hit ? C.squadOfHit(bt.state, hit) : null;
      if (squad && C.isAllied(bt.state, squad)) give(C.ordersFor(bt.state, sel, "suivre", { follow: squad, queue: m.queue || shift }));
    } else {
      const extra = hit?.kind === "titan" ? { target: hit.index } : hit?.kind === "troupe" && !C.isAllied(bt.state, C.squadOfHit(bt.state, hit) ?? "") ? { troop: hit.index } : {};
      give(C.ordersFor(bt.state, sel, "tuer", { ...extra, queue: m.queue || shift }));
    }
    setTargeting(null);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  // ——— Clavier ———
  const onKey = (ev: KeyboardEvent): void => {
    const tgt = ev.target as HTMLElement | null;
    if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "SELECT" || tgt.tagName === "TEXTAREA")) return;
    if (root.querySelector(".bilan")) return;
    const code = ev.code;
    if (code === "F2") {
      ev.preventDefault();
      perf.hidden = !perf.hidden;
      return;
    }
    const digit = /^Digit([1-9])$/.exec(code);
    if (digit) {
      ev.preventDefault();
      const n = Number(digit[1]);
      if (ev.ctrlKey || ev.metaKey) assignGroup(n);
      else select(C.recallGroup(bt.state, groups, n));
      return;
    }
    const q = ev.shiftKey;
    const orderKeys: Record<string, SquadOrder> = { KeyD: "deplacer", KeyA: "tuer", KeyC: "couvrir", KeyR: "repli", KeyT: "tenir", KeyS: "suivre" };
    const ok = orderKeys[code];
    if (ok && (sel.squads.length > 0 || sel.unit)) {
      ev.preventDefault();
      squadOrder(ok, q);
      return;
    }
    switch (code) {
      case "Space":
        ev.preventDefault();
        setSpeed(speed === 0 ? lastSpeed : 0);
        return;
      case "KeyV":
        toggleCamera();
        return;
      case "KeyF": {
        const first = sel.squads[0];
        const cur = first ? bt.state.squads.find((x) => x.id === first)?.formation : undefined;
        give(C.formationOrders(bt.state, sel, C.nextFormation(cur)));
        return;
      }
      case "KeyZ": {
        const b = (bt.state.batteries ?? []).find((x) => x.side === "allie" && x.alive > 0);
        if (b) setTargeting({ kind: "tir_zone", battery: b.id });
        return;
      }
      case "KeyX":
        give((bt.state.batteries ?? []).filter((x) => x.side === "allie").map((b) => C.batteryOrder(bt.state, b.id, null)));
        return;
      case "KeyQ":
        view.rotateBy(-0.15);
        return;
      case "KeyE":
        view.rotateBy(0.15);
        return;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        ev.preventDefault();
        const step = 60;
        view.panBy(code === "ArrowLeft" ? step : code === "ArrowRight" ? -step : 0, code === "ArrowUp" ? step : code === "ArrowDown" ? -step : 0);
        return;
      }
      case "Equal":
      case "NumpadAdd":
        view.zoomAt(host.clientWidth / 2, host.clientHeight / 2, 1.25);
        return;
      case "Minus":
      case "NumpadSubtract":
        view.zoomAt(host.clientWidth / 2, host.clientHeight / 2, 0.8);
        return;
      case "Escape":
        if (targeting) setTargeting(null);
        else if (!optBox.hidden) optBox.hidden = true;
        else select(C.EMPTY);
        return;
      default:
        return;
    }
  };
  window.addEventListener("keydown", onKey);

  // ——— Carnet ———
  const label = (v: string | number): string | number => (typeof v === "string" && v.includes(".") ? t(v) : v);
  let logged = 0;
  const renderLog = (): void => {
    const log = bt.state.log;
    for (; logged < log.length; logged++) {
      const l = log[logged];
      if (!l) continue;
      const params: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(l.params)) params[k] = (k === "squad" || k === "other") && typeof v === "string" ? unitName(v) : k === "battery" && typeof v === "string" ? batteryName(v) : label(v);
      logList.prepend(el("li", l.key.startsWith("battle.death") ? "carnet-mort" : "", `${clock(l.t)} — ${t(l.key, params)}`));
    }
    while (logList.childElementCount > 40) logList.lastElementChild?.remove();
  };

  // ——— Étiquettes (pastilles) des escouades et sections, au-dessus des hommes ———
  const tags = new Map<string, HTMLSpanElement>();
  const renderLabels = (): { x0: number; y0: number; x1: number; y1: number }[] => {
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const w = host.clientWidth;
    const h = host.clientHeight;
    for (const sq of bt.state.squads) {
      // En 2D, la scène dessine déjà les pastilles des escouades de soldats.
      const show = sq.side !== undefined || view.kind === "3d";
      let tag = tags.get(sq.id);
      const c = show ? C.centerOf(bt.state, sq.id) : null;
      const p = c ? view.toScreen(c.x, c.y, sq.side ? 3 : 6) : null;
      if (!p || p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) {
        if (tag) tag.hidden = true;
        continue;
      }
      if (!tag) {
        tag = el("span", `rt-etiquette${sq.side === "ennemi" ? " rt-etiquette--ennemi" : sq.side === "allie" ? " rt-etiquette--allie" : ""}`);
        tag.textContent = sq.side === "ennemi" ? t("rt.enemy_short") : sq.side === "allie" ? `S${Number(sq.id.replace(/\D/g, "")) || ""}` : sq.id === "officiers" ? "O" : String(Number(sq.id.replace(/\D/g, "")) || "");
        labels.append(tag);
        tags.set(sq.id, tag);
      }
      tag.hidden = false;
      tag.classList.toggle("rt-etiquette--choisie", sel.squads.includes(sq.id));
      tag.classList.toggle("rt-etiquette--repli", sq.order === "repli");
      tag.style.transform = `translate(${Math.round(p[0])}px, ${Math.round(p[1])}px) translate(-50%, -100%)`;
      boxes.push({ x0: p[0] - 12, y0: p[1] - 24, x1: p[0] + 12, y1: p[1] });
    }
    // Titans debout : étiquette rouge au-dessus de la tête (lisibles en vue stratégique, même cachés par les toits).
    bt.state.titans.forEach((ti, i) => {
      const key = `titan:${i}`;
      let tag = tags.get(key);
      const p = ti.alive && view.kind === "3d" && view.camera === "strategique" ? view.toScreen(ti.x, ti.y, ti.height + 2) : null;
      if (!p || p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) {
        if (tag) tag.hidden = true;
        return;
      }
      if (!tag) {
        tag = el("span", "rt-etiquette rt-etiquette--titan", t("rt.titan_short"));
        labels.append(tag);
        tags.set(key, tag);
      }
      tag.hidden = false;
      tag.style.transform = `translate(${Math.round(p[0])}px, ${Math.round(p[1])}px) translate(-50%, -100%)`;
      boxes.push({ x0: p[0] - 12, y0: p[1] - 24, x1: p[0] + 12, y1: p[1] });
    });
    return boxes;
  };

  return new Promise<TimedOrder[] | null>((resolve) => {
    const finish = (value: TimedOrder[] | null): void => {
      done = true;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      delete document.body.dataset["tactique"];
      view.destroy();
      root.remove();
      resolve(value);
    };
    const quit = el("button", "registre-bouton", o.linked ? t("tac.auto_end") : t("tac.close"));
    quit.type = "button";
    quit.dataset["action"] = "quitter";
    quit.addEventListener("click", () => {
      // Bataille liée : l'IA mène le combat jusqu'au bout avec les ordres déjà donnés, puis bilan.
      if (o.linked) {
        while (!bt.state.ended) stepBattle(bt, orders.filter((x) => x.tick === bt.state.tick));
        showSummary();
      } else finish(null);
    });
    head.append(quit);

    const showSummary = (): void => {
      if (root.querySelector(".bilan")) return;
      setSpeed(0);
      pauseBanner.hidden = true;
      const box = el("section", "bilan");
      const s = bt.state;
      box.append(el("h3", "", t(`battle.end_short.${s.ended?.reason ?? "temps"}`).toUpperCase()));
      const table = el("table", "registre-table");
      for (const r of [...battleSummary(s), ...troopSummary(s)]) {
        const tr = el("tr");
        const td = el("td");
        const span = el("span", "valeur", formatNumber(r.value));
        o.why.bind(span, () => ({ title: t(r.key), sections: r.why.map((k) => ({ text: t(k, r.params) })) }));
        td.append(span);
        tr.append(el("td", "", t(r.key)), td);
        table.append(tr);
      }
      box.append(table);
      const dead = s.soldiers.filter((x) => x.mode === "mort");
      if (dead.length > 0) {
        box.append(el("h4", "", t("tac.sum.dossiers")));
        const ul = el("ul", "bilan-morts");
        for (const x of dead.slice(0, 30)) {
          const titan = x.death?.titan !== null && x.death?.titan !== undefined ? s.titans[x.death.titan] : undefined;
          ul.append(el("li", "", t("tac.sum.dossier", { name: x.name, squad: unitName(x.squad), cause: t(`tac.cause.${x.death?.cause ?? "frappe"}`), titan: titan ? t(bodyName(bt, titan)) : "—", t: clock(x.death?.t ?? 0), x: Math.round(x.death?.x ?? 0), y: Math.round(x.death?.y ?? 0) })));
        }
        if (dead.length > 30) ul.append(el("li", "registre-note", t("rt.more_dead", { n: dead.length - 30 })));
        box.append(ul);
        const letters = el("details", "bilan-lettres");
        letters.append(el("summary", "", t("narr.letters", { n: dead.length })));
        const place = t(o.world.tactical?.maps.get(o.setup.map)?.name_key ?? "");
        for (const x of dead.slice(0, 3)) letters.append(el("p", "lettre", letterFor(o.world, s, x, place)));
        if (dead.length > 3) letters.append(el("p", "registre-note", t("narr.letters_more", { n: dead.length - 3 })));
        box.append(letters);
      }
      const ok = el("button", "registre-bouton principal", o.linked ? t("tac.validate") : t("tac.close"));
      ok.type = "button";
      ok.dataset["action"] = "valider";
      ok.addEventListener("click", () => finish(o.linked ? orders : null));
      box.append(ok);
      root.append(box);
    };

    // ——— Boucle : pas fixes de 1/20 s, rendu interpolé ; temps JS par image (p95 sur 240 images) ———
    const parts = { sim: [] as number[], draw: [] as number[], render: [] as number[], ui: [] as number[], total: [] as number[] };
    const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? 0;
    const push = (xs: number[], v: number): void => {
      xs.push(v);
      if (xs.length > 240) xs.shift();
    };
    let prev: { x: number; y: number; z: number }[] | null = null;
    const frameClock: BattleClock = { acc: 0 };
    let last = performance.now();
    let frames = 0;
    let lastTickUi = -10;
    let ended = false;
    let boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const frame = (now: number): void => {
      if (done) return;
      const t0 = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      advanceFrame(bt, frameClock, dt, speed, orders, () => {
        const ps = (prev ??= bt.state.soldiers.map(() => ({ x: 0, y: 0, z: 0 })));
        bt.state.soldiers.forEach((s, i) => {
          const p = ps[i];
          if (p) {
            p.x = s.x;
            p.y = s.y;
            p.z = s.z;
          }
        });
      });
      const t1 = performance.now();
      if (view.camera === "suivi") {
        const f = followTarget();
        if (f) view.follow(f.x, f.y, f.z, f.heading, f.height);
      }
      view.draw(st(), prev, Math.min(1, frameClock.acc * bt.world.balance.tick_hz), C.overlayOf(st(), sel));
      const t2 = performance.now();
      view.render();
      const t3 = performance.now();
      frames++;
      const s = bt.state;
      timer.textContent = clock(s.tick / bt.world.balance.tick_hz);
      if (frames % 2 === 0) boxes = renderLabels();
      if (s.tick - lastTickUi >= 10 || (s.ended && !ended)) {
        lastTickUi = s.tick;
        renderLog();
        renderChips();
        if (frames % 4 === 0 || speed > 0) renderPanel();
        // Repères pour les contrôles (smoke:r2) : centre à l'écran des escouades commandables et des Titans debout.
        const marks: Record<string, [number, number]> = {};
        for (const sq of C.commandable(s)) {
          const c = C.centerOf(s, sq.id);
          const p = c ? view.toScreen(c.x, c.y, 1) : null;
          if (p) marks[sq.id] = [Math.round(p[0]), Math.round(p[1])];
        }
        s.titans.forEach((ti, i) => {
          const p = ti.alive ? view.toScreen(ti.x, ti.y, ti.height * 0.5) : null;
          if (p) marks[`titan:${i}`] = [Math.round(p[0]), Math.round(p[1])];
        });
        root.dataset["reperes"] = JSON.stringify(marks);
      }
      if (s.ended && !ended) {
        ended = true;
        showSummary();
      }
      const cues = cueSnapshot(s);
      for (const c of battleCues(lastCues, cues)) audio.play(c);
      lastCues = cues;
      const subs = document.querySelector<HTMLElement>(".sous-titres");
      if (subs && subs.childElementCount > 0) {
        const sr = host.getBoundingClientRect();
        const br = subs.getBoundingClientRect();
        const obstacles = boxes.map((m) => ({ x0: m.x0 + sr.left, y0: m.y0 + sr.top, x1: m.x1 + sr.left, y1: m.y1 + sr.top }));
        const place = placeSubtitles({ x0: sr.left, y0: sr.top, x1: sr.right, y1: sr.bottom }, { w: Math.max(br.width, 260), h: Math.max(br.height, 30) }, obstacles);
        document.documentElement.style.setProperty("--sous-titres-x", `${Math.round(place.rect.x0)}px`);
        document.documentElement.style.setProperty("--sous-titres-y", `${Math.round(place.rect.y0)}px`);
      }
      const t4 = performance.now();
      push(parts.sim, t1 - t0);
      push(parts.draw, t2 - t1);
      push(parts.render, t3 - t2);
      push(parts.ui, t4 - t3);
      push(parts.total, t4 - t0);
      const total = p95(parts.total);
      root.dataset["jsP95"] = total.toFixed(2);
      root.dataset["jsParts"] = `sim ${p95(parts.sim).toFixed(2)} · figures ${p95(parts.draw).toFixed(2)} · rendu ${p95(parts.render).toFixed(2)} · interface ${p95(parts.ui).toFixed(2)}`;
      root.dataset["frames"] = String(frames);
      root.dataset["tick"] = String(s.tick);
      const vs = view.stats();
      root.dataset["stats"] = `appels ${vs.calls} · triangles ${vs.triangles} · détail ${vs.detail} · foule ${vs.crowd} · repères ${vs.markers}`;
      perf.textContent = t("tac.perf", { ms: formatNumber(total), n: Number(root.dataset["unites"] ?? 0) });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
