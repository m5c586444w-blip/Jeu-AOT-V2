import { t } from "../../i18n";
import { TacticalScene } from "../../render/tactical/scene";
import type { UnitPose } from "../../render/tactical/scene";
import type { SoldierLook } from "../../render/tactical/figures";
import type { World } from "../../sim/strategic/world";
import { createBattle, stepBattle } from "../../sim/tactical/battle";
import type { Battle } from "../../sim/tactical/battle";
import type { BattleSetup, SoldierUnit, TacticalOrder, TimedOrder } from "../../sim/tactical/types";
import { TACTICAL_ORDERS } from "../../sim/tactical/types";
import { el } from "../panels/common";
import { formatNumber } from "../why";
import type { WhyTooltip } from "../why";

const SPEEDS = [0, 0.25, 0.5, 1, 2] as const;

const clock = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Apparence d'un soldat (8 types, 04 §10) d'après son rôle et son statut. */
function lookOf(s: SoldierUnit): SoldierLook {
  if (s.ackerman) return "ackerman";
  if (s.named) return "officier";
  if (s.leader) return "chef";
  const id = Number(s.id.replace(/\D/g, "")) || 0;
  return (["tueur", "eclaireur", "soutien", "cavalier", "medecin", "tueur"] as const)[id % 6] ?? "tueur";
}

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
  const perf = el("span", "bataille-perf");
  head.append(title, timer, speeds, perf);
  root.append(head, host, side, bar);
  document.body.append(root);
  document.body.dataset["tactique"] = "1";

  const bt: Battle = createBattle(o.world, o.setup);
  const scene = await TacticalScene.create(host);
  scene.setMap(bt.map);
  scene.frame([...bt.state.soldiers.map((s) => ({ x: s.x, y: s.y, z: 0 })), ...bt.state.titans.map((x) => ({ x: x.x, y: x.y, z: x.height }))]);
  const orders: TimedOrder[] = [];
  let speed: number = 0;
  let prev: UnitPose[] | null = null;
  let acc = 0;
  let last = performance.now();
  const frameTimes: number[] = [];
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

  // Cartes d'escouade (fiches papier, 04 §5.11).
  const renderCards = (): void => {
    bar.replaceChildren();
    for (const sq of bt.state.squads) {
      const members = bt.state.soldiers.filter((s) => s.squad === sq.id);
      const up = members.filter((s) => s.mode !== "mort" && s.mode !== "fui");
      const card = el("article", "carte-escouade");
      card.dataset["squad"] = sq.id;
      const name = sq.id === "officiers" ? t("tac.officers") : sq.id.replace("esc_", t("tac.squad_n"));
      card.append(el("h4", "", name));
      const line = el("p", "carte-escouade-ligne");
      const gas = up.length ? up.reduce((a, s) => a + s.gas, 0) / up.length : 0;
      const blades = up.length ? up.reduce((a, s) => a + s.pairs, 0) / up.length : 0;
      const stress = up.length ? up.reduce((a, s) => a + s.stress, 0) / up.length : 0;
      const val = (text: string, why: string): HTMLSpanElement => {
        const v = el("span", "valeur", text);
        o.why.bind(v, () => ({ title: name, sections: [{ text: why }] }));
        return v;
      };
      line.append(val(`${up.length}/${members.length}`, t("tac.men_why")), ` ${t("tac.gas")} `, val(formatNumber(gas), t("tac.gas_why")), ` ${t("tac.blades")} `, val(formatNumber(blades), t("tac.blades_why")), ` ${t("tac.stress")} `, val(formatNumber(stress), t("tac.stress_why", { panic: bt.world.balance.soldiers.panic_threshold })));
      card.append(line, el("p", "carte-escouade-ordre", t(`order.${sq.order}`)));
      const btns = el("div", "carte-escouade-ordres");
      for (const ord of TACTICAL_ORDERS) {
        const b = el("button", "registre-bouton petit", t(`order.${ord}`));
        b.type = "button";
        b.dataset["order"] = ord;
        b.setAttribute("aria-pressed", String(sq.order === ord));
        b.addEventListener("click", () => give(sq.id, ord));
        btns.append(b);
      }
      const follow = el("button", "registre-bouton petit", t("tac.follow"));
      follow.type = "button";
      follow.addEventListener("click", () => {
        following = following?.kind === "squad" && following.id === sq.id ? null : { kind: "squad", id: sq.id };
      });
      btns.append(follow);
      card.append(btns);
      bar.append(card);
    }
  };
  renderCards();

  const label = (v: string | number): string | number => (typeof v === "string" && v.includes(".") ? t(v) : v);
  const renderLog = (): void => {
    logList.replaceChildren();
    for (const l of bt.state.log.slice(-40).reverse()) {
      const params: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(l.params)) params[k] = label(v);
      logList.append(el("li", l.key.startsWith("battle.death") ? "carnet-mort" : "", `${clock(l.t)} — ${t(l.key, params)}`));
    }
  };

  // Caméra : molette, glisser, clic pour sélectionner (et suivre un individu).
  host.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const r = host.getBoundingClientRect();
    scene.zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.15 : 0.87);
  }, { passive: false });
  let drag: { x: number; y: number; moved: boolean } | null = null;
  host.addEventListener("pointerdown", (ev) => (drag = { x: ev.clientX, y: ev.clientY, moved: false }));
  window.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved) {
      scene.panBy(dx, dy);
      following = null;
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    }
  });
  window.addEventListener("pointerup", (ev) => {
    if (drag && !drag.moved) {
      const r = host.getBoundingClientRect();
      const hit = scene.pick(bt.state, ev.clientX - r.left, ev.clientY - r.top);
      scene.selected = new Set(hit?.kind === "soldat" ? [hit.index] : []);
      if (hit?.kind === "soldat") following = { kind: "soldat", index: hit.index };
    }
    drag = null;
  });
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.code === "Space") {
      ev.preventDefault();
      setSpeed(speed === 0 ? 1 : 0);
    }
  };
  window.addEventListener("keydown", onKey);

  return new Promise<TimedOrder[] | null>((resolve) => {
    const finish = (value: TimedOrder[] | null): void => {
      done = true;
      window.removeEventListener("keydown", onKey);
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
      const rows: [string, number, string][] = [
        ["tac.sum.dead", dead.length, "tac.sum.dead_why"],
        ["tac.sum.napes", st.stats.napes, "tac.sum.napes_why"],
        ["tac.sum.cuts", st.stats.cuts, "tac.sum.cuts_why"],
        ["tac.sum.limbs", st.stats.limbs, "tac.sum.limbs_why"],
        ["tac.sum.dodges", st.stats.dodges, "tac.sum.dodges_why"],
        ["tac.sum.rescues", st.stats.rescues, "tac.sum.rescues_why"],
        ["tac.sum.blades", st.stats.bladesBroken, "tac.sum.blades_why"],
        ["tac.sum.gas", Math.round(st.stats.gasUsed), "tac.sum.gas_why"],
      ];
      for (const [k, v, w] of rows) {
        const tr = el("tr");
        const td = el("td");
        const span = el("span", "valeur", formatNumber(v));
        o.why.bind(span, () => ({ title: t(k), sections: [{ text: t(w) }] }));
        td.append(span);
        tr.append(el("td", "", t(k)), td);
        table.append(tr);
      }
      box.append(table);
      if (dead.length > 0) {
        box.append(el("h4", "", t("tac.sum.dossiers")));
        const ul = el("ul", "bilan-morts");
        for (const s of dead) {
          const titan = s.death?.titan !== null && s.death?.titan !== undefined ? st.titans[s.death.titan] : undefined;
          ul.append(el("li", "", t("tac.sum.dossier", { name: s.name, squad: s.squad, cause: t(`tac.cause.${s.death?.cause ?? "frappe"}`), titan: titan ? t(bt.world.titanTypes.get(titan.type)?.name_key ?? "") : "—", t: clock(s.death?.t ?? 0), x: s.death?.x ?? 0, y: s.death?.y ?? 0 })));
        }
        box.append(ul);
      }
      const ok = el("button", "registre-bouton principal", o.linked ? t("tac.validate") : t("tac.close"));
      ok.type = "button";
      ok.dataset["action"] = "valider";
      ok.addEventListener("click", () => finish(o.linked ? orders : null));
      box.append(ok);
      root.append(box);
    };

    const frame = (now: number): void => {
      if (done) return;
      const t0 = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const tick = 1 / bt.world.balance.tick_hz;
      acc += dt * speed;
      let stepped = false;
      while (acc >= tick && !bt.state.ended) {
        prev = bt.state.soldiers.map((s) => ({ x: s.x, y: s.y, z: s.z }));
        stepBattle(bt, orders.filter((x) => x.tick === bt.state.tick));
        acc -= tick;
        stepped = true;
      }
      if (following?.kind === "squad") {
        const sqId = following.id;
        const m = bt.state.soldiers.filter((s) => s.squad === sqId && s.mode !== "mort" && s.mode !== "fui");
        if (m.length) scene.follow(m.reduce((a, s) => a + s.x, 0) / m.length, m.reduce((a, s) => a + s.y, 0) / m.length, 0);
      } else if (following?.kind === "soldat") {
        const s = bt.state.soldiers[following.index];
        if (s && s.mode !== "mort") scene.follow(s.x, s.y, s.z);
      }
      scene.draw(bt.state, prev, Math.min(1, acc / tick), lookOf);
      timer.textContent = clock(bt.state.tick / bt.world.balance.tick_hz);
      if (stepped && bt.state.tick % 10 === 0) {
        renderCards();
        renderLog();
      }
      if (bt.state.ended) {
        renderCards();
        renderLog();
        showSummary();
      }
      const spent = performance.now() - t0;
      frameTimes.push(spent);
      if (frameTimes.length > 240) frameTimes.shift();
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      root.dataset["jsP95"] = p95.toFixed(2);
      root.dataset["tick"] = String(bt.state.tick);
      perf.textContent = t("tac.perf", { ms: formatNumber(p95), n: bt.state.soldiers.length + bt.state.titans.length });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
