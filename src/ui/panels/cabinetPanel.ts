import type { Law } from "../../data/schemas";
import { t } from "../../i18n";
import { cabinetMembers, computeVote } from "../../sim/politics/politics";
import { formatNumber } from "../why";
import { button, displayName, el, noPolitics, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

/**
 * Salle du Cabinet (04 §5.6, F-POL-03) : plan de table, sièges, vote prévu en billes (blanches = pour,
 * noires = contre, grises = abstention), raisons de chaque membre, persuasion, soumission avec confirmation.
 */
export class CabinetPanel implements Panel {
  readonly id = "cabinet" as const;
  private motion: string | null = null;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement, arg?: string): void {
    const pw = this.ctx.world.politics;
    const pol = this.ctx.state().politics;
    if (!pw || !pol) return noPolitics(root);
    if (arg) this.motion = arg;
    const st = this.ctx.state();
    const members = cabinetMembers(this.ctx.world, pol);
    const candidates = [...pw.laws.values()].filter((l) => l.requires_vote && !pol.laws.some((a) => a.id === l.id));
    if (this.motion && !candidates.some((l) => l.id === this.motion)) this.motion = null;

    const head = el("div", "cabinet-motion");
    const label = el("label", "", t("cabinet.motion"));
    const sel = el("select", "registre-choix");
    sel.dataset["motion"] = "1";
    sel.append(new Option(t("cabinet.choose"), ""));
    for (const l of candidates) sel.append(new Option(t(l.name_key), l.id, false, l.id === this.motion));
    sel.addEventListener("change", () => {
      this.motion = sel.value || null;
      this.refresh(root);
    });
    label.append(sel);
    head.append(label);
    const capital = el("span", "registre-champ");
    capital.append(t("hud.capital"), " ", valueEl(this.ctx, formatNumber(pol.capital), () => ({ title: t("hud.capital"), sections: [{ text: t("hud.capital_why") }] })));
    head.append(capital);
    root.append(head);

    const law = this.motion ? pw.laws.get(this.motion) : undefined;
    const vote = law ? computeVote(this.ctx.world, pol, law) : null;
    root.append(this.table(members, vote));
    if (law && vote) root.append(this.motionBox(law, vote, root));
    if (pol.lastVote) {
      const lv = pol.lastVote;
      const res = el("p", `cabinet-dernier ${lv.passed ? "adopte" : "rejete"}`);
      res.textContent = t("cabinet.last_vote", {
        law: t(pw.laws.get(lv.law)?.name_key ?? lv.law),
        date: t("date.format", { year: lv.date.year, day: lv.date.day }),
        pour: lv.pour,
        contre: lv.contre,
        abst: lv.abstention,
        result: t(lv.passed ? "cabinet.passed" : lv.veto ? "cabinet.vetoed" : "cabinet.rejected"),
      });
      root.append(res);
    }
    void st;
  }

  private refresh(root: HTMLElement): void {
    root.replaceChildren();
    this.render(root);
  }

  /** Plan de table : sièges en ellipse, bille de vote prévue devant chaque membre. */
  private table(members: { character: string; role: string | null }[], vote: ReturnType<typeof computeVote> | null): HTMLElement {
    const pw = this.ctx.world.politics;
    const wrap = el("div", "cabinet-salle");
    if (!pw) return wrap;
    const w = 560;
    const h = 250;
    const svg: string[] = [`<svg viewBox="0 0 ${w} ${h}" class="cabinet-plan" role="img" aria-label="${t("cabinet.room")}">`];
    svg.push(`<ellipse cx="${w / 2}" cy="${h / 2}" rx="170" ry="62" fill="#6b4a2f" fill-opacity="0.35" stroke="#1c1a17" stroke-width="1.5"/>`);
    svg.push(`<ellipse cx="${w / 2}" cy="${h / 2}" rx="160" ry="54" fill="none" stroke="#1c1a17" stroke-width="0.6"/>`);
    const n = members.length + 1;
    const seat = (i: number): [number, number] => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return [w / 2 + Math.cos(a) * 230, h / 2 + Math.sin(a) * 100];
    };
    const ball = (i: number): [number, number] => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return [w / 2 + Math.cos(a) * 140, h / 2 + Math.sin(a) * 44];
    };
    const [px, py] = seat(0);
    svg.push(`<rect x="${px - 50}" y="${py - 13}" width="100" height="26" fill="#1c1a17"/><text x="${px}" y="${py + 4}" text-anchor="middle" font-family="IM Fell English" font-size="12" fill="#e8dcc0">${t("cabinet.chair")}</text>`);
    members.forEach((m, i) => {
      const [x, y] = seat(i + 1);
      const [bx, by] = ball(i + 1);
      const c = pw.characters.get(m.character);
      svg.push(`<rect x="${x - 58}" y="${y - 14}" width="116" height="28" fill="#efe6cf" stroke="#1c1a17"/>`);
      svg.push(`<text x="${x}" y="${y - 1}" text-anchor="middle" font-family="EB Garamond" font-size="11" fill="#1c1a17">${esc(displayName(c))}</text>`);
      const roleName = m.role ? t(pw.roles.find((r) => r.id === m.role)?.name_key ?? "") : t("cabinet.seat_extra");
      svg.push(`<text x="${x}" y="${y + 10}" text-anchor="middle" font-family="EB Garamond" font-style="italic" font-size="9" fill="#3a352d">${esc(roleName)}</text>`);
      const line = vote?.record.lines.find((l) => l.character === m.character);
      if (line) {
        const fill = line.vote === "pour" ? "#f4ecd8" : line.vote === "contre" ? "#1c1a17" : "#7b766b";
        svg.push(`<circle cx="${bx}" cy="${by}" r="8" fill="${fill}" stroke="#1c1a17" stroke-width="1.2"/><circle cx="${bx - 2.5}" cy="${by - 2.5}" r="2" fill="#ffffff" opacity="0.5"/>`);
      }
    });
    svg.push("</svg>");
    const fig = el("figure", "cabinet-figure");
    fig.innerHTML = svg.join("");
    wrap.append(fig);
    return wrap;
  }

  private motionBox(law: Law, vote: ReturnType<typeof computeVote>, root: HTMLElement): HTMLElement {
    const pw = this.ctx.world.politics;
    const pol = this.ctx.state().politics;
    const box = el("section", "cabinet-detail");
    if (!pw || !pol) return box;
    const r = vote.record;
    box.append(el("p", "registre-note", t(law.desc_key)));
    const tally = el("p", "cabinet-decompte");
    tally.append(
      t("cabinet.forecast"), " ",
      valueEl(this.ctx, String(r.pour), () => ({ title: t("cabinet.pour"), sections: [{ text: t("cabinet.tally_why", { threshold: formatNumber(pw.balance.votes.threshold) }) }] })),
      ` ${t("cabinet.pour")} · `,
      valueEl(this.ctx, String(r.contre), () => ({ title: t("cabinet.contre"), sections: [{ text: t("cabinet.tally_why", { threshold: formatNumber(pw.balance.votes.threshold) }) }] })),
      ` ${t("cabinet.contre")} · `,
      valueEl(this.ctx, String(r.abstention), () => ({ title: t("cabinet.abstention"), sections: [{ text: t("cabinet.tally_why", { threshold: formatNumber(pw.balance.votes.threshold) }) }] })),
      ` ${t("cabinet.abstention")}`,
    );
    box.append(tally);
    if (r.veto) box.append(el("p", "cabinet-veto", t("cabinet.veto_warning", { name: displayName(pw.characters.get(r.veto.character)), role: t(pw.roles.find((x) => x.id === r.veto?.role)?.name_key ?? ""), cost: pw.balance.votes.veto_override_cost })));
    const table = el("table", "registre-table");
    for (const line of r.lines) {
      const tr = el("tr");
      tr.append(el("td", "", displayName(pw.characters.get(line.character))));
      tr.append(el("td", `vote-${line.vote}`, t(`cabinet.${line.vote}`)));
      const td = el("td");
      td.append(valueEl(this.ctx, formatNumber(line.score), () => ({ title: t("cabinet.why_vote", { name: displayName(pw.characters.get(line.character)) }), sections: [{ explained: vote.reasons[line.character] }] })));
      tr.append(td);
      const act = el("td");
      if (line.vote !== "pour") {
        const b = button(t("cabinet.persuade", { cost: pw.balance.votes.persuasion_cost }), () => void this.ctx.dispatch({ type: "Persuade", character: line.character }).then(() => this.refresh(root)), "registre-bouton petit");
        b.disabled = pol.capital < pw.balance.votes.persuasion_cost;
        act.append(b);
      }
      tr.append(act);
      table.append(tr);
    }
    box.append(table);
    const submit = button(t("cabinet.submit", { capital: law.cost.capital, gold: formatNumber(law.cost.gold) }), () => {
      void this.ctx.confirm(t("cabinet.confirm", { law: t(law.name_key) })).then((ok) => {
        if (ok) void this.ctx.dispatch({ type: "EnactLaw", law: law.id }).then(() => this.refresh(root));
      });
    }, "registre-bouton principal");
    submit.disabled = pol.capital < law.cost.capital;
    box.append(submit);
    if (r.veto) {
      const force = button(t("cabinet.override"), () => {
        void this.ctx.confirm(t("cabinet.confirm_override", { law: t(law.name_key) })).then((ok) => {
          if (ok) void this.ctx.dispatch({ type: "EnactLaw", law: law.id, override: true }).then(() => this.refresh(root));
        });
      });
      force.disabled = pol.capital < law.cost.capital + pw.balance.votes.veto_override_cost;
      box.append(force);
    }
    return box;
  }
}

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch] ?? ch);
}
