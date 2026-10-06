import { t } from "../../i18n";
import { TacticalScene } from "../../render/tactical/scene";
import type { UnitPose } from "../../render/tactical/scene";
import type { SoldierLook } from "../../render/tactical/figures";
import type { World } from "../../sim/strategic/world";
import { createBattle, stepBattle } from "../../sim/tactical/battle";
import type { Battle } from "../../sim/tactical/battle";
import { bodyName } from "../../sim/tactical/shifters";
import { letterFor } from "../narrative";
import { battleSummary } from "./summary";
import { advanceFrame } from "./battleClock";
import { placeSubtitles } from "./subtitlePlacement";
import type { BattleClock } from "./battleClock";
import { battleCues, cueSnapshot, sharedAudio } from "../audio";
import { loadSettings, volumesOf } from "../settings";
import type { BattleSetup, SoldierUnit, TacticalOrder, TimedOrder } from "../../sim/tactical/types";
import { TACTICAL_ORDERS } from "../../sim/tactical/types";
import { el } from "../panels/common";
import { formatNumber } from "../why";
import type { WhyTooltip } from "../why";

const SPEEDS = [0, 0.25, 0.5, 1, 2] as const;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const clock = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Apparence d'un soldat (8 types, 04 §10) d'après son rôle et son statut. */
function lookOf(s: SoldierUnit): SoldierLook {
  if (s.ackerman) return "ackerman";
  if (s.named) return "officier";
  if (s.leader) return "chef";
  const id = Number(s.id.replace(/\D/g, "")) || 0;
  return (["tueur", "eclaireur", "soutien", "cavalier", "medecin", "tueur"] as const)[id % 6] ?? "tueur";
}

/** Sonde de contrôle (smoke:tactique) : position à l'écran d'un soldat de la bataille ouverte, relative à la scène. */
export const battleProbe: { soldierOnScreen: ((i: number) => [number, number] | null) | null; markers: (() => readonly { x0: number; y0: number; x1: number; y1: number }[]) | null } = { soldierOnScreen: null, markers: null };

/** Nom affiché d'une escouade (jamais l'identifiant brut). */
const squadName = (id: string): string => (id === "officiers" ? t("tac.officers") : id.replace("esc_", t("tac.squad_n")));

export interface BattleScreenOptions {
  world: World;
  why: WhyTooltip;
  setup: BattleSetup;
  title: string;
  /** Bataille liée à une expédition : « Valider » renvoie les ordres ; sinon « Fermer ». */
  linked: boolean;
}

/**
 * Écran de bataille (03 §1, §13 ; 04 §5.11) : pause active, ralenti, ordres en pause, cartes d'escouade, carnet de combat,
 * bilan. Simulation à 20 Hz dans le fil de l'interface, rendu interpolé. Résout la promesse avec le journal d'ordres
 * (bataille validée) ou null (fermée sans valider).
 */
export async function openBattleScreen(o: BattleScreenOptions): Promise<TimedOrder[] | null> {
  const root = el("section", "bataille");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", o.title);
  const head = el("header", "bataille-tete");
  const title = el("h2", "bataille-titre", o.title);
  const timer = el("span", "bataille-horloge", "00:00");
  const speeds = el("div", "bataille-vitesses");
  const host = el("div", "bataille-scene");
  const side = el("aside", "bataille-carnet");
  side.append(el("h3", "registre-intertitre", t("tac.carnet")));
  const logList = el("ol", "carnet-lignes");
  side.append(logList);
  const bar = el("footer", "bataille-escouades");
  // Mesure de performance : affichée seulement en mode debug (F2), comme la console de service.
  const perf = el("span", "bataille-perf");
  perf.hidden = !document.querySelector(".debug-console:not([hidden])");
  head.append(title, timer, speeds, perf);
  root.append(head, host, side, bar);
  document.body.append(root);
  document.body.dataset["tactique"] = "1";

  const bt: Battle = createBattle(o.world, o.setup);
  const scene = await TacticalScene.create(host);
  scene.setMap(bt.map);
  // Cadrage initial : soldats, Titans et porteurs encore sous forme humaine (R0.2f : la transformation doit être dans le champ).
  scene.frame([...bt.state.soldiers.map((s) => ({ x: s.x, y: s.y, z: 0, own: true })), ...bt.state.titans.map((x) => ({ x: x.x, y: x.y, z: x.height })), ...(bt.state.shifters ?? []).map((u) => {
    const h = o.world.shifters?.defs.get(u.shifter)?.height_m;
    return { x: u.x, y: u.y, z: 0, reach: h ? (h[0] + h[1]) / 2 : 15 };
  })]);
  let seenFlashes = 0;
  const orders: TimedOrder[] = [];
  battleProbe.markers = () => scene.markerBoxes;
  battleProbe.soldierOnScreen = (i) => {
    const s = bt.state.soldiers[i];
    return s && s.mode !== "mort" && s.mode !== "fui" ? scene.toScreen(s.x, s.y, s.z + 2) : null;
  };
  let speed: number = 0;
  let prev: UnitPose[] | null = null;
  const frameClock: BattleClock = { acc: 0 };
  let last = performance.now();
  const audio = sharedAudio(volumesOf(loadSettings(storage())));
  audio.setMood("combat");
  let lastCues = cueSnapshot(bt.state);
  let following: { kind: "squad"; id: string } | { kind: "soldat"; index: number } | null = null;
  let done = false;

  const speedButtons = SPEEDS.map((sp) => {
    const b = el("button", "bataille-vitesse", sp === 0 ? "‖" : `×${formatNumber(sp)}`);
    b.type = "button";
    b.dataset["speed"] = String(sp);
    b.addEventListener("click", () => setSpeed(sp));
    speeds.append(b);
    return b;
  });
  const setSpeed = (sp: number): void => {
    speed = sp;
    for (const b of speedButtons) b.setAttribute("aria-pressed", String(Number(b.dataset["speed"]) === sp));
  };
  setSpeed(0);

  const give = (squad: string, order: TacticalOrder): void => {
    // Ordre donné en pause ou en marche : appliqué au prochain pas, consigné pour le rejeu (F-CMB-30).
    orders.push({ tick: bt.state.tick, squad, order });
    renderCards();
  };

  // Cartes d'escouade (fiches papier, 04 §5.11) : construites une fois, puis mises à jour en place (300 unités = 47 cartes).
  interface CardRefs {
    men: HTMLSpanElement;
    gas: HTMLSpanElement;
    blades: HTMLSpanElement;
    stress: HTMLSpanElement;
    order: HTMLParagraphElement;
    buttons: HTMLButtonElement[];
    follow: HTMLButtonElement;
  }
  const cards = new Map<string, CardRefs>();
  const membersOf = new Map<string, SoldierUnit[]>();
  for (const s of bt.state.soldiers) membersOf.set(s.squad, [...(membersOf.get(s.squad) ?? []), s]);
  for (const sq of bt.state.squads) {
    const card = el("article", "carte-escouade");
    card.dataset["squad"] = sq.id;
    const name = squadName(sq.id);
    card.append(el("h4", "", name));
    const line = el("p", "carte-escouade-ligne");
    const val = (why: string): HTMLSpanElement => {
      const v = el("span", "valeur");
      o.why.bind(v, () => ({ title: name, sections: [{ text: why }] }));
      return v;
    };
    const refs: CardRefs = { men: val(t("tac.men_why")), gas: val(t("tac.gas_why")), blades: val(t("tac.blades_why")), stress: val(t("tac.stress_why", { panic: bt.world.balance.soldiers.panic_threshold })), order: el("p", "carte-escouade-ordre"), buttons: [], follow: el("button", "registre-bouton petit", t("tac.follow")) };
    line.append(refs.men, ` ${t("tac.gas")} `, refs.gas, ` ${t("tac.blades")} `, refs.blades, ` ${t("tac.stress")} `, refs.stress);
    card.append(line, refs.order);
    const btns = el("div", "carte-escouade-ordres");
    for (const ord of TACTICAL_ORDERS) {
      const b = el("button", "registre-bouton petit", t(`order.${ord}`));
      b.type = "button";
      b.dataset["order"] = ord;
      b.addEventListener("click", () => give(sq.id, ord));
      refs.buttons.push(b);
      btns.append(b);
    }
    refs.follow.type = "button";
    refs.follow.addEventListener("click", () => {
      following = following?.kind === "squad" && following.id === sq.id ? null : { kind: "squad", id: sq.id };
      root.dataset["follow"] = following ? `escouade:${sq.id}` : "";
      renderCards();
    });
    btns.append(refs.follow);
    card.append(btns);
    bar.append(card);
    cards.set(sq.id, refs);
  }
  const setText = (e: HTMLElement, text: string): void => {
    if (e.textContent !== text) e.textContent = text;
  };
  const setPressed = (e: HTMLElement, on: boolean): void => {
    const v = String(on);
    if (e.getAttribute("aria-pressed") !== v) e.setAttribute("aria-pressed", v);
  };
  // Mise à jour étalée : `n` cartes par appel (tour à tour), toutes si n est omis (ordre, suivi, fin de bataille).
  let cardCursor = 0;
  const renderCards = (n = bt.state.squads.length): void => {
    const squads = bt.state.squads;
    for (let k = 0; k < Math.min(n, squads.length); k++) {
      const sq = squads[(cardCursor + k) % squads.length];
      if (!sq) continue;
      const refs = cards.get(sq.id);
      if (!refs) continue;
      const members = membersOf.get(sq.id) ?? [];
      const up = members.filter((s) => s.mode !== "mort" && s.mode !== "fui");
      const avg = (f: (s: SoldierUnit) => number): number => (up.length ? up.reduce((a, s) => a + f(s), 0) / up.length : 0);
      setText(refs.men, `${up.length}/${members.length}`);
      setText(refs.gas, formatNumber(avg((s) => s.gas)));
      setText(refs.blades, formatNumber(avg((s) => s.pairs)));
      setText(refs.stress, formatNumber(avg((s) => s.stress)));
      // Un ordre donné en pause s'affiche tout de suite (il s'applique au prochain pas).
      const current = orders.filter((x) => x.squad === sq.id && x.tick >= bt.state.tick).at(-1)?.order ?? sq.order;
      setText(refs.order, t(`order.${current}`));
      refs.buttons.forEach((b, i) => setPressed(b, TACTICAL_ORDERS[i] === current));
      setPressed(refs.follow, following?.kind === "squad" && following.id === sq.id);
    }
    cardCursor = (cardCursor + n) % Math.max(1, squads.length);
  };
  renderCards();

  // Carnet : seules les nouvelles lignes sont ajoutées (40 au plus, la plus récente en tête).
  const label = (v: string | number): string | number => (typeof v === "string" && v.includes(".") ? t(v) : v);
  let logged = 0;
  const renderLog = (): void => {
    const log = bt.state.log;
    for (; logged < log.length; logged++) {
      const l = log[logged];
      if (!l) continue;
      const params: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(l.params)) params[k] = k === "squad" && typeof v === "string" ? squadName(v) : label(v);
      logList.prepend(el("li", l.key.startsWith("battle.death") ? "carnet-mort" : "", `${clock(l.t)} — ${t(l.key, params)}`));
    }
    while (logList.childElementCount > 40) logList.lastElementChild?.remove();
  };

  // Caméra : molette, glisser, clic pour sélectionner (et suivre un individu).
  host.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const r = host.getBoundingClientRect();
    scene.zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.15 : 0.87);
    root.dataset["zoom"] = scene.zoomLevel.toFixed(2);
  }, { passive: false });
  let drag: { x: number; y: number; moved: boolean } | null = null;
  host.addEventListener("pointerdown", (ev) => (drag = { x: ev.clientX, y: ev.clientY, moved: false }));
  const onMove = (ev: PointerEvent): void => {
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved) {
      scene.panBy(dx, dy);
      following = null;
      root.dataset["follow"] = "";
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    }
  };
  const onUp = (ev: PointerEvent): void => {
    if (drag && !drag.moved) {
      const r = host.getBoundingClientRect();
      const hit = scene.pick(bt.state, ev.clientX - r.left, ev.clientY - r.top);
      scene.selected = new Set(hit?.kind === "soldat" ? [hit.index] : []);
      if (hit?.kind === "soldat") following = { kind: "soldat", index: hit.index };
      root.dataset["selection"] = hit ? `${hit.kind}:${hit.index}` : "";
      root.dataset["follow"] = following?.kind === "soldat" ? `soldat:${following.index}` : (root.dataset["follow"] ?? "");
    }
    drag = null;
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.code === "F2") {
      ev.preventDefault();
      perf.hidden = !perf.hidden;
      root.dataset["debug"] = String(!perf.hidden);
      return;
    }
    if (ev.code === "Space") {
      ev.preventDefault();
      setSpeed(speed === 0 ? 1 : 0);
    }
  };
  window.addEventListener("keydown", onKey);

  return new Promise<TimedOrder[] | null>((resolve) => {
    const finish = (value: TimedOrder[] | null): void => {
      done = true;
      battleProbe.soldierOnScreen = null;
      battleProbe.markers = null;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      delete document.body.dataset["tactique"];
      scene.destroy();
      root.remove();
      resolve(value);
    };
    const quit = el("button", "registre-bouton", o.linked ? t("tac.auto_end") : t("tac.close"));
    quit.type = "button";
    quit.dataset["action"] = "quitter";
    quit.addEventListener("click", () => {
      // Bataille liée : finir le combat sans ordres supplémentaires (l'IA mène jusqu'au bout), puis bilan.
      if (o.linked) {
        while (!bt.state.ended) stepBattle(bt, orders.filter((x) => x.tick === bt.state.tick));
        showSummary();
      } else finish(null);
    });
    head.append(quit);

    const showSummary = (): void => {
      if (root.querySelector(".bilan")) return;
      setSpeed(0);
      const box = el("section", "bilan");
      const st = bt.state;
      box.append(el("h3", "", t(`battle.end_short.${st.ended?.reason ?? "temps"}`).toUpperCase()));
      const table = el("table", "registre-table");
      const dead = st.soldiers.filter((s) => s.mode === "mort");
      for (const r of battleSummary(st)) {
        const tr = el("tr");
        const td = el("td");
        const span = el("span", "valeur", formatNumber(r.value));
        o.why.bind(span, () => ({ title: t(r.key), sections: r.why.map((k) => ({ text: t(k, r.params) })) }));
        td.append(span);
        tr.append(el("td", "", t(r.key)), td);
        table.append(tr);
      }
      box.append(table);
      if (dead.length > 0) {
        box.append(el("h4", "", t("tac.sum.dossiers")));
        const ul = el("ul", "bilan-morts");
        for (const s of dead) {
          const titan = s.death?.titan !== null && s.death?.titan !== undefined ? st.titans[s.death.titan] : undefined;
          ul.append(el("li", "", t("tac.sum.dossier", { name: s.name, squad: squadName(s.squad), cause: t(`tac.cause.${s.death?.cause ?? "frappe"}`), titan: titan ? t(bodyName(bt, titan)) : "—", t: clock(s.death?.t ?? 0), x: Math.round(s.death?.x ?? 0), y: Math.round(s.death?.y ?? 0) })));
        }
        box.append(ul);
        // Lettres aux familles (04 §5.12) : les trois premières en entier, les autres comptées.
        const letters = el("details", "bilan-lettres");
        letters.append(el("summary", "", t("narr.letters", { n: dead.length })));
        const place = t(o.world.tactical?.maps.get(o.setup.map)?.name_key ?? "");
        for (const s of dead.slice(0, 3)) letters.append(el("p", "lettre", letterFor(o.world, st, s, place)));
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

    // Temps JS par image (AC4-09) : simulation, préparation des figures, rendu Pixi, interface ; p95 sur 240 images.
    const parts = { sim: [] as number[], draw: [] as number[], render: [] as number[], ui: [] as number[], total: [] as number[] };
    const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? 0;
    const push = (xs: number[], v: number): void => {
      xs.push(v);
      if (xs.length > 240) xs.shift();
    };
    let uiTick = -10;
    let ended = false;
    const frame = (now: number): void => {
      if (done) return;
      const t0 = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      // Pas fixes ; le plafond par image (FRAME_DT_CAP_S) ne change que le rythme, jamais le résultat.
      advanceFrame(bt, frameClock, dt, speed, orders, () => {
        // Positions avant le pas (interpolation), dans un tableau réutilisé.
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
      if (following?.kind === "squad") {
        const sqId = following.id;
        const m = (membersOf.get(sqId) ?? []).filter((s) => s.mode !== "mort" && s.mode !== "fui");
        if (m.length) scene.follow(m.reduce((a, s) => a + s.x, 0) / m.length, m.reduce((a, s) => a + s.y, 0) / m.length, 0);
      } else if (following?.kind === "soldat") {
        const s = bt.state.soldiers[following.index];
        if (s && s.mode !== "mort") scene.follow(s.x, s.y, s.z);
      }
      scene.draw(bt.state, prev, Math.min(1, frameClock.acc * bt.world.balance.tick_hz), lookOf);
      const t2 = performance.now();
      scene.render();
      const t3 = performance.now();
      setText(timer, clock(bt.state.tick / bt.world.balance.tick_hz));
      if (bt.state.ended && !ended) renderCards();
      else renderCards(8);
      if (bt.state.tick - uiTick >= 10 || (bt.state.ended && !ended)) {
        uiTick = bt.state.tick;
        renderLog();
      }
      if (bt.state.ended && !ended) {
        ended = true;
        showSummary();
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
      root.dataset["frames"] = String(Number(root.dataset["frames"] ?? "0") + 1);
      root.dataset["tick"] = String(bt.state.tick);
      // Effets sonores de la bataille, hors mesure du temps de rendu (04 §7).
      const cues = cueSnapshot(bt.state);
      for (const c of battleCues(lastCues, cues)) audio.play(c);
      lastCues = cues;
      // Sous-titres (R0, item 2) : en haut à gauche de la scène, ou au premier coin libre de pastilles et de flèches.
      const subs = document.querySelector<HTMLElement>(".sous-titres");
      if (subs && subs.childElementCount > 0) {
        const sr = host.getBoundingClientRect();
        const br = subs.getBoundingClientRect();
        const obstacles = scene.markerBoxes.map((m) => ({ x0: m.x0 + sr.left, y0: m.y0 + sr.top, x1: m.x1 + sr.left, y1: m.y1 + sr.top }));
        const place = placeSubtitles({ x0: sr.left, y0: sr.top, x1: sr.right, y1: sr.bottom }, { w: Math.max(br.width, 260), h: Math.max(br.height, 30) }, obstacles);
        document.documentElement.style.setProperty("--sous-titres-x", `${Math.round(place.rect.x0)}px`);
        document.documentElement.style.setProperty("--sous-titres-y", `${Math.round(place.rect.y0)}px`);
        root.dataset["sousTitres"] = place.corner;
      }
      // R0.2f : après chaque éclair de transformation, dès que le corps existe, est-il dans le champ de la caméra ?
      if (scene.fx.flashes > seenFlashes) {
        const cw = scene.canvas.clientWidth;
        const ch = scene.canvas.clientHeight;
        const bodies = (bt.state.shifters ?? []).map((u) => (u.body !== null ? bt.state.titans[u.body] : undefined)).filter((b) => b !== undefined);
        if (bodies.length > 0) {
          seenFlashes = scene.fx.flashes;
          const inView = bodies.some((b) => {
            const [x, y] = scene.toScreen(b.x, b.y, b.height / 2);
            return x >= 0 && x <= cw && y >= 0 && y <= ch;
          });
          root.dataset["porteurVisible"] = inView ? "oui" : "non";
        }
      }
      root.dataset["fx"] = `toits ${scene.fx.roofs.size} · vapeur ${scene.fx.steam} · éclairs ${scene.fx.flashes} · occultés ${scene.fx.occluded} · flèches ${scene.fx.arrows}`;
      root.dataset["vue"] = scene.view;
      root.dataset["pastilles"] = String(scene.markers);
      root.dataset["zoom"] = scene.zoomLevel.toFixed(2);
      root.dataset["couverture"] = scene.coverage().toFixed(2);
      setText(perf, t("tac.perf", { ms: formatNumber(total), n: bt.state.soldiers.length + bt.state.titans.length }));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
