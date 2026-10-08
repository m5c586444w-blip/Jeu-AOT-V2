import { isAuthorMode } from "../authorMode";
import type { Character } from "../../data/schemas";
import { isDomestic } from "../../sim/politics/vocabulary";
import { t } from "../../i18n";
import { Explainer } from "../../sim/core/explain";
import { postsOf, relationBetween, stressGain } from "../../sim/politics/characters";
import { effectiveAttributes } from "../../sim/politics/state";
import type { CharacterState, PoliticalState } from "../../sim/politics/state";
import { ATTRIBUTES } from "../../sim/politics/vocabulary";
import type { PoliticsWorld } from "../../sim/strategic/world";
import { portraitSvg } from "../portrait";
import { formatNumber } from "../why";
import { button, displayName, el, masterDetail, noPolitics, stamp, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

/** Teinte du fil de relation (classe CSS, jetons de tokens.css). */
const RELATION_TONE: Record<string, string> = {
  amitie: "bonne", loyaute: "bonne", respect: "neutre", amour: "forte", mentor: "bonne", dette: "discrete",
  rivalite: "mauvaise", haine: "mauvaise", tension: "neutre",
};

/** Registre des personnages et fiche personnage (F-CHR-01, F-ADV-15, 04 §5.5). */
export class CharactersPanel implements Panel {
  readonly id = "personnages" as const;
  private filter: "vivants" | "morts" | "tous" = "vivants";
  private selected: string | null = null;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement, arg?: string): void {
    const pw = this.ctx.world.politics;
    const pol = this.ctx.state().politics;
    if (!pw || !pol) return noPolitics(root);
    if (arg && pw.characters.has(arg)) this.selected = arg;
    const md = masterDetail(root, "personnages", "perso-vue");
    const shown = this.list(md.master, pw, pol);
    const id = this.selected && pw.characters.has(this.selected) ? this.selected : shown[0];
    if (id) this.sheet(md.detail, pw, pol, id);
    else md.detail.append(el("p", "registre-note", t("characters.none")));
    md.done();
  }

  /** Liste filtrable (vivants, morts, tous), groupée par organisation ; renvoie les identifiants affichés. */
  private list(root: HTMLElement, pw: PoliticsWorld, pol: PoliticalState): string[] {
    const bar = el("div", "registre-filtres");
    for (const f of ["vivants", "morts", "tous"] as const) {
      const b = button(t(`characters.filter.${f}`), () => {
        this.filter = f;
        this.ctx.open("personnages", this.selected ?? undefined);
      }, "registre-onglet");
      b.setAttribute("aria-pressed", String(this.filter === f));
      bar.append(b);
    }
    root.append(bar);
    const year = this.ctx.state().date.year;
    const byOrg = new Map<string, Character[]>();
    for (const c of pw.characters.values()) {
      const cs = pol.characters[c.id];
      if (c.active_from > year || !isDomestic(c)) continue;
      if (this.filter === "vivants" && !cs?.alive) continue;
      if (this.filter === "morts" && cs?.alive) continue;
      const key = c.org ?? "sans";
      byOrg.set(key, [...(byOrg.get(key) ?? []), c]);
    }
    const shown: string[] = [];
    const ul = el("ul", "liste perso-liste");
    ul.setAttribute("aria-label", t("panel.personnages"));
    for (const [org, list] of byOrg) {
      ul.append(el("li", "liste__groupe", org === "sans" ? t("characters.no_org") : t(pw.organisations.get(org)?.name_key ?? org)));
      for (const c of list) {
        shown.push(c.id);
        const cs = pol.characters[c.id];
        const li = el("li", `liste__item perso-ligne${cs?.alive ? "" : " ligne-morte"}`);
        li.dataset["character"] = c.id;
        li.setAttribute("aria-selected", String(c.id === this.selected));
        const lead = el("span", "liste__tete");
        lead.innerHTML = portraitSvg(c.portrait?.seed ?? 1, c.portrait?.archetype ?? "civil", !cs?.alive);
        const mid = el("span", "liste__milieu");
        // Le nom est le bouton (clavier) ; un clic n'importe où sur la ligne ouvre la fiche.
        const name = el("button", "lien-dossier", displayName(c));
        name.type = "button";
        const title = el("span", "liste__titre");
        title.append(name, " ", stamp(c.canon));
        const posts = postsOf(pol, c.id).map((p) => (p.kind === "role" ? t(pw.roles.find((r) => r.id === p.id)?.name_key ?? p.id) : t("characters.leads", { org: t(pw.organisations.get(p.id)?.name_key ?? p.id) })));
        mid.append(title, el("span", "liste__meta registre-poste", [t(c.rank_key ?? "rank.inconnu"), ...posts].join(" · ")));
        const trail = el("span", "liste__queue");
        if (cs) {
          trail.append(valueEl(this.ctx, formatNumber(cs.stress), () => this.stressWhy(pw, c, cs)));
          trail.append(el("span", "liste__meta", t("characters.stress")));
        }
        li.append(lead, mid, trail);
        li.addEventListener("click", () => {
          this.selected = c.id;
          this.ctx.open("personnages", c.id);
        });
        ul.append(li);
      }
    }
    root.append(ul);
    return shown;
  }

  private stressWhy(pw: PoliticsWorld, c: Character, cs: CharacterState) {
    const sb = pw.balance.stress;
    return {
      title: t("characters.stress"),
      sections: [
        { text: t("characters.stress_why", { decay: formatNumber(sb.decay_per_day), exhausted: sb.exhausted, trauma: sb.trauma, breakdown: sb.breakdown }) },
        { text: t("characters.stress_gain", { k: formatNumber(stressGain(pw, c, cs)) }) },
      ],
    };
  }

  private sheet(root: HTMLElement, pw: PoliticsWorld, pol: PoliticalState, id: string): void {
    const c = pw.characters.get(id) as Character;
    const cs = pol.characters[id];
    const head = el("header", "fiche-tete");
    const portrait = el("div", "fiche-portrait");
    portrait.innerHTML = portraitSvg(c.portrait?.seed ?? 1, c.portrait?.archetype ?? "civil", !cs?.alive);
    const ident = el("div", "fiche-identite");
    ident.append(el("h3", "fiche-nom", displayName(c)), el("p", "fiche-rang", `${t(c.rank_key ?? "rank.inconnu")} — ${c.org ? t(pw.organisations.get(c.org)?.name_key ?? c.org) : t("characters.no_org")}`));
    ident.append(stamp(c.canon));
    ident.append(el("p", "fiche-bio", c.bio_key ? t(c.bio_key) : ""));
    head.append(portrait, ident);
    root.append(head);

    if (cs?.death) {
      const d = cs.death;
      const box = el("section", "fiche-deces");
      box.append(el("h4", "", t("characters.death_title", { year: d.date.year, day: d.date.day })));
      box.append(el("p", "", `${t("characters.cause")} : ${t(`death.cause.${d.cause}`)}. ${t(d.circumstances)}`));
      const ul = el("ul");
      for (const x of d.consequences) {
        const params: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(x.params)) params[k] = typeof v === "string" && v.includes(".") ? t(v) : v;
        ul.append(el("li", "", t(x.key, params)));
      }
      box.append(ul);
      root.append(box);
    }

    const grid = el("div", "fiche-colonnes");
    // Attributs effectifs (données + traits), chacun expliqué.
    const attrs = el("table", "registre-table fiche-attributs");
    attrs.append(el("caption", "", t("characters.attributes")));
    const eff = effectiveAttributes(pw, c, cs);
    for (const a of ATTRIBUTES) {
      const tr = el("tr");
      tr.append(el("td", "", t(`attr.${a}`)));
      const td = el("td");
      td.append(valueEl(this.ctx, formatNumber(eff[a]), () => {
        const e = new Explainer().base("why.attr_base", c.attributes[a] ?? 50);
        for (const tr2 of [...c.traits, ...(cs?.acquired ?? [])]) {
          const trait = pw.traits.get(tr2);
          const v = trait?.attributes[a];
          if (v) e.add("why.attr_trait", v, { trait: trait.name_key });
        }
        return { title: t(`attr.${a}`), sections: [{ explained: e.done() }, { text: t("characters.attr_note") }] };
      }));
      tr.append(td);
      attrs.append(tr);
    }
    const side = el("div", "fiche-cote");
    const traits = el("ul", "fiche-traits");
    for (const tid of [...c.traits, ...(cs?.acquired ?? [])]) {
      const tr = pw.traits.get(tid);
      if (!tr) continue;
      const li = el("li", tr.acquired ? "trait-acquis" : "", t(tr.name_key));
      li.dataset["why"] = traitSummary(tr);
      li.tabIndex = 0;
      traits.append(li);
    }
    side.append(el("h4", "", t("characters.traits")), traits);
    if (cs) {
      const vitals = el("div", "fiche-ligne");
      vitals.append(el("span", "", t("characters.stress")), valueEl(this.ctx, formatNumber(cs.stress), () => this.stressWhy(pw, c, cs)));
      const loyal = el("div", "fiche-ligne");
      loyal.append(el("span", "", t("characters.loyalty")), valueEl(this.ctx, formatNumber(cs.loyalty), () => ({ title: t("characters.loyalty"), sections: [{ text: t("characters.loyalty_why") }] })));
      const agenda = el("div", "fiche-ligne");
      agenda.append(el("span", "", t("characters.agenda")), el("span", "", t(`agenda.${c.agenda}`)));
      side.append(vitals, loyal, agenda);
    }
    grid.append(attrs, side);
    root.append(grid);
    root.append(this.relationsBoard(pw, pol, c));
  }

  /** Relations en tableau d'enquête : épingles et fils de couleur autour du personnage (04 §5.5). */
  private relationsBoard(pw: PoliticsWorld, pol: PoliticalState, c: Character): HTMLElement {
    const box = el("section", "fiche-relations");
    box.append(el("h4", "", t("characters.relations")));
    const others = [...pw.characters.values()].filter((o) => o.id !== c.id && relationBetween(pw, c.id, o.id)).slice(0, 10);
    if (others.length === 0) {
      box.append(el("p", "registre-note", t("characters.no_relations")));
      return box;
    }
    const w = 420;
    const h = 240;
    const cx = w / 2;
    const cy = h / 2;
    const parts: string[] = [`<svg class="tableau-enquete" viewBox="0 0 ${w} ${h}" role="img" aria-label="${t("characters.relations")}">`, `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" class="enq-fond"/>`];
    const nodes = others.map((o, i) => {
      const a = (i / others.length) * Math.PI * 2 - Math.PI / 2;
      return { o, x: cx + Math.cos(a) * 160, y: cy + Math.sin(a) * 88 };
    });
    for (const n of nodes) {
      const rel = relationBetween(pw, c.id, n.o.id);
      const tone = RELATION_TONE[rel?.type ?? ""] ?? "discrete";
      parts.push(`<path d="M${cx} ${cy} Q${(cx + n.x) / 2} ${(cy + n.y) / 2 + 14} ${n.x} ${n.y}" class="enq-fil enq-fil--${tone}" stroke-width="${1 + Math.abs(rel?.strength ?? 0) / 40}"/>`);
    }
    const card = (x: number, y: number, label: string, dead: boolean): string =>
      `<g><rect x="${x - 48}" y="${y - 11}" width="96" height="22" class="enq-carte"/>` +
      `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10.5" class="enq-nom${dead ? " enq-nom--mort" : ""}">${escapeXml(label)}</text></g>`;
    for (const n of nodes) parts.push(card(n.x, n.y, displayName(n.o), !pol.characters[n.o.id]?.alive));
    parts.push(card(cx, cy, displayName(c), !pol.characters[c.id]?.alive));
    parts.push("</svg>");
    const fig = el("figure", "fiche-tableau");
    fig.innerHTML = parts.join("");
    const legend = el("ul", "fiche-legende");
    for (const n of nodes) {
      const rel = relationBetween(pw, c.id, n.o.id);
      if (!rel) continue;
      legend.append(el("li", "", `${displayName(n.o)} — ${t(`relation.${rel.type}`)} (${formatNumber(rel.strength)})`));
    }
    box.append(fig, legend);
    return box;
  }
}

function traitSummary(tr: { name_key: string; attributes: Record<string, number | undefined>; stress_gain: number; advice_bias?: string | undefined; notes_canon?: string | undefined }): string {
  const parts: string[] = [];
  for (const [a, v] of Object.entries(tr.attributes)) if (v) parts.push(`${t(`attr.${a}`)} ${v > 0 ? "+" : "−"}${Math.abs(v)}`);
  if (tr.stress_gain !== 1) parts.push(t("characters.trait_stress", { k: formatNumber(tr.stress_gain) }));
  if (tr.advice_bias) parts.push(t(`bias.${tr.advice_bias}`));
  return `${t(tr.name_key)} : ${parts.join(" ; ") || t("characters.trait_vote_only")}${tr.notes_canon && isAuthorMode() ? ` — ${tr.notes_canon}` : ""}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch] ?? ch);
}
