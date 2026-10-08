/**
 * Page de contrôle des composants (UI.1) et des icônes (UI.2) : /ui-kit.html sur le serveur de développement.
 * Non publiée dans le jeu (la construction ne prend que index.html).
 */
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/im-fell-english/latin-400.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screen.css";
import { bar, btn, gauge, h, listItem, panel, sep, tag, tabs, variation } from "./kit";
import { portraitSvg, ARCHETYPES } from "./portrait";

const root = document.getElementById("kit");
if (root) {
  root.style.padding = "1.5rem";
  root.style.maxWidth = "80rem";
  root.style.margin = "0 auto";
  root.append(h("h1", "", "Composants de l'interface"), h("p", "registre-note", "Jetons : src/ui/styles/tokens.css · composants : components.css · fabriques : src/ui/kit.ts"));

  const sec = (title: string): HTMLElement => {
    const s = h("section", "");
    s.style.margin = "1.2rem 0";
    s.append(sep(title));
    root.append(s);
    return s;
  };

  const buttons = sec("Boutons");
  buttons.append(btn("Signer le décret", () => undefined, { variant: "principal", key: "Entrée" }), btn("Différer", () => undefined), btn("Déclarer la guerre", () => undefined, { variant: "danger" }), btn("Annuler", () => undefined, { variant: "discret" }), btn("Persuader", () => undefined, { small: true }));
  const off = btn("Indisponible", () => undefined);
  off.disabled = true;
  buttons.append(off);

  const tb = sec("Onglets");
  tb.append(tabs([{ id: "a", label: "Vivants" }, { id: "b", label: "Morts" }, { id: "c", label: "Tous" }], "a", () => undefined));

  const md = sec("Liste et détail (maître-détail)");
  const grid = h("div", "maitre-detail");
  const list = h("ul", "liste");
  list.append(h("li", "liste__groupe", "Corps de Reconnaissance"));
  ["Commandant", "Chef de section", "Capitaine", "Chef d'escouade"].forEach((rank, i) => list.append(listItem({ lead: portraitSvg(10 + i, "officier"), title: `Officier ${i + 1}`, meta: rank, trail: variation(i % 2 ? "−3" : "+2", i % 2 ? "baisse" : "hausse"), selected: i === 0 })));
  const detail = h("div", "detail");
  detail.append(h("h2", "", "Fiche"), h("p", "registre-note", "Le détail de l'élément choisi s'affiche ici : portrait, traits, relations, cursus."));
  const maitre = h("div", "maitre");
  maitre.append(list);
  grid.append(maitre, detail);
  md.append(grid);

  const gauges = sec("Jauges, barres, variations");
  const g = h("div", "");
  g.style.display = "grid";
  g.style.gridTemplateColumns = "repeat(3, 1fr)";
  g.style.gap = "1rem";
  g.append(gauge("Loyauté", "72", 0.72), gauge("Stress", "81", 0.81, { tone: "danger", mark: 0.75 }), gauge("Moral", "58", 0.58, { tone: "succes" }), bar(0.4));
  gauges.append(g, h("p", "", ""));
  gauges.lastElementChild?.append("Nourriture ", variation("+1 240", "hausse"), " · Gaz ", variation("−165", "baisse"), " · Pierre de glace ", variation("rupture", "rupture"), " · Or ", variation("0", "stable"));

  const tags = sec("Étiquettes");
  for (const [t, tone] of [["En vigueur", "succes"], ["Vote requis", "alerte"], ["Guerre", "danger"], ["Neutre", "neutre"], ["Rumeur", "info"], ["Étude en cours", "accent"]] as const) tags.append(tag(t, tone), " ");

  const tip = sec("Infobulle de calcul (U4)");
  const fake = h("div", "pourquoi");
  fake.style.position = "static";
  fake.innerHTML = `<strong class="pourquoi__titre">Nourriture : variation par jour</strong><div class="pourquoi__section"><span class="pourquoi__libelle">Production : 9 870</span><table><tr><td>Champs de Rose</td><td class="pourquoi__valeur" data-sign="plus">+7 200</td></tr><tr><td>Hiver</td><td class="pourquoi__valeur" data-sign="moins">×0,8</td></tr><tr class="pourquoi__total"><td>Total</td><td class="pourquoi__valeur">9 870</td></tr></table></div><p class="pourquoi__touche">Raccourci : V</p>`;
  tip.append(fake);

  const pn = sec("Panneau");
  const p = panel("Province");
  p.body.append(h("div", "kv"));
  p.body.lastElementChild?.append(h("span", "kv__cle", "Population"), h("span", "kv__valeur valeur", "212 000"));
  pn.append(p.root);

  const pal = sec("Palette (jetons) et contrastes");
  const sw = h("div", "");
  sw.style.display = "grid";
  sw.style.gridTemplateColumns = "repeat(auto-fill, minmax(10rem, 1fr))";
  sw.style.gap = "0.4rem";
  for (const v of ["--fond", "--panneau", "--panneau-haut", "--filet", "--texte", "--texte-second", "--texte-discret", "--accent", "--accent-clair", "--danger", "--succes", "--alerte", "--info", "--nation-paradis", "--nation-marley", "--nation-hizuru", "--nation-allies"]) {
    const c = h("div", "kv");
    const chip = h("span", "puce");
    chip.style.background = `var(${v})`;
    c.append(h("span", "kv__cle"), h("span", "kv__valeur", v));
    c.firstElementChild?.append(chip);
    sw.append(c);
  }
  pal.append(sw);

  const pt = sec("Portraits peints (U7)");
  const row = h("div", "");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "repeat(7, 6rem)";
  row.style.gap = "0.5rem";
  ARCHETYPES.forEach((a, i) => {
    const f = h("figure", "fiche-portrait");
    f.style.margin = "0";
    f.innerHTML = portraitSvg(100 + i * 7, a, i === 6);
    row.append(f);
  });
  pt.append(row);
  document.documentElement.dataset["ready"] = "true";
}
