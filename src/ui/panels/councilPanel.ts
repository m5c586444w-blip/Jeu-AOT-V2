import { t } from "../../i18n";
import { adviceFor } from "../../sim/politics/advisors";
import type { Advice } from "../../sim/politics/advisors";
import { absDay, effectiveAttributes } from "../../sim/politics/state";
import { formatNumber } from "../why";
import { button, displayName, el, noPolitics, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

/** Le conseil (08 §3) : avis des 18 rôles avec fiabilité estimée, biais connu, intérêt ; propositions ; nominations. */
export class CouncilPanel implements Panel {
  readonly id = "conseil" as const;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const pw = this.ctx.world.politics;
    const state = this.ctx.state();
    const pol = state.politics;
    const st = state.strategic;
    if (!pw || !pol || !st) return noPolitics(root);
    const today = absDay(state.date);

    if (pol.nominations.length > 0) {
      root.append(el("h3", "registre-intertitre", t("council.nominations")));
      for (const nom of pol.nominations) {
        const post = nom.post.kind === "role" ? t(pw.roles.find((r) => r.id === nom.post.id)?.name_key ?? nom.post.id) : t("characters.leads", { org: t(pw.organisations.get(nom.post.id)?.name_key ?? nom.post.id) });
        const box = el("section", "conseil-nomination");
        box.append(el("h4", "", t("council.vacant_post", { post })));
        const table = el("table", "registre-table");
        for (const cid of nom.candidates) {
          const c = pw.characters.get(cid);
          const cs = pol.characters[cid];
          if (!c || !cs) continue;
          const a = effectiveAttributes(pw, c, cs);
          const tr = el("tr");
          const name = button(displayName(c), () => this.ctx.open("personnages", cid), "lien-dossier");
          const tdN = el("td");
          tdN.append(name);
          tr.append(tdN, el("td", "", t(`agenda.${c.agenda}`)));
          const tdA = el("td");
          tdA.append(valueEl(this.ctx, `${formatNumber(a.intellect)} / ${formatNumber(a.command)} / ${formatNumber(a.charisma)}`, () => ({ title: t("council.aptitudes"), sections: [{ text: t("council.aptitudes_why") }] })));
          const tdL = el("td");
          tdL.append(valueEl(this.ctx, formatNumber(cs.loyalty), () => ({ title: t("characters.loyalty"), sections: [{ text: t("characters.loyalty_why") }] })));
          const act = el("td");
          act.append(button(t("council.nominate"), () => {
            void this.ctx.confirm(t("council.confirm_nominate", { name: displayName(c), post })).then((ok) => {
              if (ok) void this.ctx.dispatch({ type: "Nominate", nomination: nom.id, candidate: cid }).then(() => this.refresh(root));
            });
          }, "registre-bouton principal petit"));
          tr.append(tdA, tdL, act);
          table.append(tr);
        }
        box.append(table, el("p", "registre-note", t("council.resentment")));
        root.append(box);
      }
    }

    if (pol.proposals.length > 0) {
      root.append(el("h3", "registre-intertitre", t("council.proposals")));
      for (const p of pol.proposals) {
        const law = pw.laws.get(p.law);
        const box = el("article", "conseil-proposition");
        box.dataset["proposal"] = String(p.id);
        box.append(el("p", "", t("council.proposal_text", { name: displayName(pw.characters.get(p.advisor)), law: t(law?.name_key ?? p.law) })));
        const left = el("p", "registre-note");
        left.append(t("council.expires_in"), " ", valueEl(this.ctx, String(p.expires - today), () => ({ title: t("council.expiry"), sections: [{ text: t("council.expiry_why") }] })), ` ${t("council.days")}`);
        box.append(left);
        box.append(button(t("council.sign"), () => {
          void this.ctx.confirm(t("council.confirm_sign", { law: t(law?.name_key ?? p.law) })).then((ok) => {
            if (ok) void this.ctx.dispatch({ type: "AcceptProposal", proposal: p.id }).then(() => this.refresh(root));
          });
        }, "registre-bouton principal petit"), button(t("council.refuse"), () => void this.ctx.dispatch({ type: "RejectProposal", proposal: p.id }).then(() => this.refresh(root)), "registre-bouton petit"));
        root.append(box);
      }
    }

    root.append(el("h3", "registre-intertitre", t("council.advice")));
    const table = el("table", "registre-table conseil-avis");
    for (const role of pw.roles) {
      const advice = adviceFor(this.ctx.world, pol, st, state.date, role.id);
      if (!advice) continue;
      const tr = el("tr", advice.alarm ? "avis-alarme" : "");
      tr.append(el("td", "conseil-role", `${role.number}. ${t(role.name_key)}`));
      const tdW = el("td");
      if (advice.advisor) tdW.append(button(displayName(pw.characters.get(advice.advisor)), () => this.ctx.open("personnages", advice.advisor ?? ""), "lien-dossier"));
      else tdW.append(el("span", "registre-note", t("council.vacant")));
      tr.append(tdW, this.adviceCell(advice));
      table.append(tr);
    }
    root.append(table);
  }

  /** Ce que dit le conseiller (valeur annoncée, jamais la valeur réelle) et « pourquoi me dit-il cela ? ». */
  private adviceCell(a: Advice): HTMLTableCellElement {
    const pw = this.ctx.world.politics;
    const td = el("td", "conseil-texte");
    if (!a.advisor || a.shown === null || !Number.isFinite(a.shown) || a.metric === "none") {
      td.append(el("span", "registre-note", t(a.advisor ? "council.nothing" : "council.no_advice")));
      return td;
    }
    td.append(t(`advice.${a.metric}`), " ");
    td.append(valueEl(this.ctx, formatNumber(a.shown), () => ({
      title: t("council.why_says"),
      sections: [
        { text: t("council.estimated_reliability", { n: a.estimatedReliability }) },
        { text: a.bias ? t("council.known_bias", { bias: t(`bias.${a.bias}`) }) : t("council.no_bias") },
        { text: a.recommendation ? t("council.interest", { law: t(pw?.laws.get(a.recommendation)?.name_key ?? ""), n: formatNumber(a.interest) }) : t("council.no_recommendation") },
        { text: t("council.caveat") },
      ],
    })));
    if (a.alarm && a.recommendation) td.append(" — ", el("em", "", t("council.recommends", { law: t(pw?.laws.get(a.recommendation)?.name_key ?? "") })));
    return td;
  }

  private refresh(root: HTMLElement): void {
    root.replaceChildren();
    this.render(root);
  }
}
