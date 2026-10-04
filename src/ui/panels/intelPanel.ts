import { t } from "../../i18n";
import { toAbsoluteDay, fromAbsoluteDay } from "../../sim/core/time";
import { agentSlots, INTEL_OPS, recruitProblem } from "../../sim/intel/intel";
import type { Agent, IntelOp, IntelReport, IntelState } from "../../sim/intel/intel";
import { button, displayName, el, provinceName, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { formatNumber } from "../why";

/**
 * Salle de renseignement (04 §5.8, 02 §6) : fiches d'agents, rapports datés et annotés (certitude, recoupement),
 * mur des secrets. Les vérités cachées ne sont jamais affichées : seulement ce que les rapports affirment.
 */
export class IntelPanel implements Panel {
  readonly id = "renseignement" as const;
  /** Opération choisie par agent dans le formulaire (avant envoi). */
  private readonly draftOp = new Map<string, IntelOp>();

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const intel = s.intel;
    if (!intel || !this.ctx.world.intel) {
      root.append(el("p", "registre-ferme", t("intel.closed")));
      return;
    }
    const today = toAbsoluteDay(s.date);
    root.append(el("h3", "registre-intertitre", t("intel.agents", { n: intel.agents.filter((a) => a.status !== "grille").length, max: agentSlots(this.ctx.world, s.research) })));
    const wall = el("div", "fiches-agents");
    for (const a of intel.agents) wall.append(this.agentCard(a, today));
    root.append(wall);
    const problem = recruitProblem(this.ctx.world, intel, s.politics, s.research);
    const recruit = button(t("intel.recruit", { cost: this.ctx.world.intel.balance.agents.recruit_capital }), () => void this.ctx.dispatch({ type: "RecruitAgent" }), "registre-bouton petit");
    recruit.dataset["action"] = "recruter";
    recruit.disabled = problem !== null;
    root.append(recruit);
    if (problem) root.append(el("p", "plan-probleme", t(problem)));

    root.append(el("h3", "registre-intertitre", t("intel.reports")));
    const visible = intel.reports.filter((r) => r.day <= today);
    if (visible.length === 0) root.append(el("p", "registre-note", t("intel.no_report")));
    const list = el("ol", "rapports");
    for (const r of [...visible].reverse()) list.append(this.report(intel, r, today));
    root.append(list);

    root.append(el("h3", "registre-intertitre", t("intel.secrets")));
    const board = el("div", "mur-secrets");
    for (const def of this.ctx.world.intel.secrets) {
      const sec = intel.secrets[def.id];
      if (!sec || (sec.certainty === "aucune" && !sec.revealed)) continue;
      const card = el("article", "fiche-secret");
      card.dataset["secret"] = def.id;
      card.append(el("span", "epingle"), el("h4", "", displayName(this.ctx.world.politics?.characters.get(def.character))));
      const stamp = el("span", `tampon-certitude certitude-${sec.revealed ? "revele" : sec.certainty}`, t(sec.revealed ? "intel.cert.revele" : `intel.cert.${sec.certainty}`));
      stamp.dataset["why"] = t("intel.cert_why", { evidence: sec.evidence, indice: this.ctx.world.intel.balance.evidence.indice, preuve: this.ctx.world.intel.balance.evidence.preuve });
      card.append(stamp);
      // Le contenu n'est connu qu'une fois prouvé ou révélé ; avant, seulement la certitude d'un secret.
      if (sec.revealed || sec.certainty === "preuve") for (const f of def.fields) card.append(el("p", "fiche-secret__fait", t(`intel.secret.${f}`)));
      else card.append(el("p", "registre-note", t("intel.secret.unknown")));
      board.append(card);
    }
    if (board.childElementCount === 0) root.append(el("p", "registre-note", t("intel.no_secret")));
    else root.append(board);
    const exposed = intel.moles.filter((m) => m.exposed);
    if (exposed.length > 0) root.append(el("p", "registre-champ", t("intel.moles_exposed", { names: exposed.map((m) => displayName(this.ctx.world.politics?.characters.get(m.character))).join(", ") })));
  }

  private agentCard(a: Agent, today: number): HTMLElement {
    const card = el("article", `fiche-agent statut-${a.status}`);
    card.dataset["agent"] = a.id;
    card.append(el("h4", "", a.name), el("span", "fiche-agent__statut", t(`intel.status.${a.status}`)));
    const line = el("p", "registre-champ");
    const v = (key: string, value: number): HTMLSpanElement => valueEl(this.ctx, formatNumber(value), () => ({ title: t(`intel.${key}`), sections: [{ text: t(`intel.${key}_why`) }] }));
    line.append(`${t("intel.cover")} `, v("cover", a.cover), ` · ${t("intel.loyalty")} `, v("loyalty", a.loyalty), ` · ${t("intel.skill")} `, v("skill", a.skill));
    card.append(line, el("p", "registre-note", t("intel.specialty", { op: t(`intel.op.${a.specialty}`) })));
    if (a.mission) {
      card.append(el("p", "registre-champ", t("intel.mission", { op: t(`intel.op.${a.mission.op}`), target: this.targetName(a.mission.op, a.mission.target), n: Math.max(0, a.mission.end - today) })));
      const recall = button(t("intel.recall"), () => void this.ctx.dispatch({ type: "RecallAgent", agent: a.id }), "registre-bouton petit");
      recall.dataset["action"] = "rappeler-agent";
      card.append(recall);
      return card;
    }
    if (a.status === "grille") return card;
    const op = this.draftOp.get(a.id) ?? a.specialty;
    const opSel = el("select", "plan-choix");
    opSel.dataset["agentOp"] = a.id;
    for (const o of INTEL_OPS) {
      const option = el("option", "", t(`intel.op.${o}`));
      option.value = o;
      option.selected = o === op;
      opSel.append(option);
    }
    opSel.addEventListener("change", () => {
      this.draftOp.set(a.id, opSel.value as IntelOp);
      this.ctx.open("renseignement");
    });
    const target = el("select", "plan-choix");
    target.dataset["agentTarget"] = a.id;
    for (const [id, label] of this.targets(op)) {
      const option = el("option", "", label);
      option.value = id;
      target.append(option);
    }
    const send = button(t("intel.send"), () => void this.ctx.dispatch({ type: "AssignAgent", agent: a.id, op, target: target.value }), "registre-bouton petit principal");
    send.dataset["action"] = "envoyer-agent";
    const row = el("div", "plan-ligne");
    row.append(opSel, target, send);
    card.append(row);
    return card;
  }

  private targets(op: IntelOp): [string, string][] {
    const w = this.ctx.world;
    const s = this.ctx.state();
    if (op === "surveiller") return w.provinces.filter((p) => p.kind !== "segment" && s.strategic?.provinces[p.id]?.control !== "paradis").map((p) => [p.id, provinceName(w, p.id)]);
    if (op === "enqueter") return Object.entries(s.politics?.characters ?? {}).filter(([id, c]) => c.alive && id !== s.politics?.player && (w.politics?.characters.get(id)?.active_from ?? 9999) <= s.date.year).map(([id]) => [id, displayName(w.politics?.characters.get(id))]);
    return [...(w.politics?.organisations.values() ?? [])].map((o) => [o.id, t(o.name_key)]);
  }

  private targetName(op: IntelOp, id: string): string {
    if (op === "surveiller") return provinceName(this.ctx.world, id);
    if (op === "enqueter") return displayName(this.ctx.world.politics?.characters.get(id));
    const o = this.ctx.world.politics?.organisations.get(id);
    return o ? t(o.name_key) : id;
  }

  private report(intel: IntelState, r: IntelReport, today: number): HTMLElement {
    const li = el("li", `rapport statut-${r.status}`);
    li.dataset["report"] = r.id;
    const d = fromAbsoluteDay(r.day);
    const agent = intel.agents.find((a) => a.id === r.agent)?.name ?? "—";
    li.append(el("span", "journal-date", t("date.format", { year: d.year, day: d.day })), " ", t("intel.report_line", { agent, op: t(`intel.op.${r.op}`), target: this.targetName(r.op, r.target), age: Math.max(0, today - r.about) }), " ");
    let claim: string;
    if (typeof r.claim === "number") claim = t("intel.claim.titans", { v: formatNumber(r.claim) });
    else if (r.claim === "taupe") claim = t("intel.claim.taupe", { name: displayName(this.ctx.world.politics?.characters.get(r.named ?? "")) });
    else claim = t(`intel.claim.${r.claim}`);
    li.append(el("strong", "", claim), " ");
    const cert = el("span", `tampon-certitude certitude-${r.certainty}`, t(`intel.cert.${r.certainty}`));
    cert.dataset["why"] = t("intel.report_cert_why");
    const status = el("span", `tampon-recoupement recoupement-${r.status}`, t(`intel.check.${r.status}`));
    status.dataset["why"] = t(`intel.check.${r.status}_why`);
    li.append(cert, " ", status);
    return li;
  }
}
