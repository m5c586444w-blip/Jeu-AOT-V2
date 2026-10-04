import { hasKey, t } from "../../i18n";
import { isDomestic } from "../../sim/politics/vocabulary";
import { epilogue, gazette } from "../narrative";
import { emblem } from "../icons";
import { button, displayName, el, stamp, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

/** Gazette (04 §5.10) : une, chroniques et brèves ; journal de Paradis ou feuille de propagande de Marley. */
export class GazettePanel implements Panel {
  readonly id = "gazette" as const;
  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const g = gazette(this.ctx.world, s);
    const paper = el("article", `gazette gazette--${s.nations?.player === "fac_marley" ? "marley" : "paradis"}`);
    paper.append(el("h3", "gazette__titre", g.masthead), el("p", "gazette__date", t("date.format", { year: s.date.year, day: s.date.day })));
    const cols = el("div", "gazette__colonnes");
    for (const a of g.articles) {
      const art = el("section", `gazette__article gazette__article--${a.kind}`);
      art.append(el("h4", "", a.headline), el("p", "gazette__date", a.date), el("p", "", a.body));
      cols.append(art);
    }
    paper.append(cols);
    root.append(paper);
  }
}

/** Archives (04 §5.13) : encyclopédie diégétique, chaque fiche tamponnée Établi, Interprété ou Non confirmé. */
export class ArchivesPanel implements Panel {
  readonly id = "archives" as const;
  private tab = "personnages";
  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const w = this.ctx.world;
    const s = this.ctx.state();
    const tabs = ["personnages", "titans", "lieux", "evenements", "nations"].filter((x) => x !== "nations" || w.nations);
    const nav = el("nav", "registre-onglets");
    for (const id of tabs) {
      const b = button(t(`archives.tab.${id}`), () => {
        this.tab = id;
        this.ctx.open("archives");
      }, "registre-onglet");
      b.setAttribute("aria-pressed", String(id === this.tab));
      b.dataset["tab"] = id;
      nav.append(b);
    }
    root.append(el("p", "registre-note", t("archives.note")), nav);
    const list = el("div", "archives");
    const card = (title: string, canon: string, body: string, extra?: HTMLElement): void => {
      const c = el("article", "fiche-archive");
      const h = el("header", "planche__tete");
      h.append(el("h4", "", title), stamp(canon));
      c.append(h, el("p", "", body));
      if (extra) c.append(extra);
      list.append(c);
    };
    if (this.tab === "personnages") {
      for (const c of [...(w.politics?.characters.values() ?? [])].filter((x) => isDomestic(x) && x.active_from <= s.date.year).sort((a, b) => displayName(a).localeCompare(displayName(b), "fr")))
        card(displayName(c), c.canon, c.bio_key && hasKey(c.bio_key) ? t(c.bio_key) : t(c.rank_key ?? "archives.no_bio"));
    } else if (this.tab === "titans") {
      for (const d of w.shifters?.order ?? []) card(t(d.name_key), d.canon, d.abilities.map((a) => t(`shifter.ability.${a.id}`)).join(" · "));
    } else if (this.tab === "lieux") {
      for (const p of w.provinces.filter((x) => x.kind !== "segment")) card(t(p.name_key), p.canon, t(`archives.kind.${p.kind}`));
      for (const p of w.nations?.order ?? []) card(t(p.name_key), p.canon, t("archives.world_place"));
    } else if (this.tab === "evenements") {
      for (const e of [...(w.chronicle?.canon ?? [])]) {
        const r = s.events?.history[e.id];
        card(t(e.text_key), e.canon, t(`archives.event.${r?.status ?? "a_venir"}`));
      }
    } else {
      for (const f of w.nations?.factions.values() ?? []) {
        const em = el("span", "fiche-archive__blason");
        em.innerHTML = emblem(f.id);
        card(t(f.name_key), f.canon, f.objectives.map((o) => t(o)).join(" · "), em);
      }
    }
    root.append(list);
  }
}

/** Fin de partie / épilogue (04 §5.15) : montage de documents ; consultable à tout moment comme bilan provisoire. */
export class EpiloguePanel implements Panel {
  readonly id = "epilogue" as const;
  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const e = epilogue(this.ctx.world, this.ctx.state());
    const sheet = el("article", "epilogue");
    sheet.append(el("h3", "epilogue__titre", e.title));
    const story = el("div", "epilogue__recit");
    for (const l of e.lines) story.append(el("p", "", l));
    const table = el("table", "registre-table epilogue__chiffres");
    for (const x of e.stats) {
      const tr = el("tr");
      const th = el("th", "", t(x.key));
      th.scope = "row";
      const td = el("td");
      td.append(valueEl(this.ctx, String(x.value), () => ({ title: t(x.key), sections: [{ text: t(`${x.key}_why`) }] })));
      tr.append(th, td);
      table.append(tr);
    }
    sheet.append(story, table, el("p", "registre-note", t("narr.epi.note")));
    root.append(sheet);
  }
}
