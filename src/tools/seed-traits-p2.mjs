// Script de génération (traçabilité) : node src/tools/seed-traits-p2.mjs <sortie-textes.json>
// Traits (02 §9.2 + compléments [A]), strates (01 §4), organisations (01 §5.1, 08 §5.1).
import fs from "node:fs";
const texts = {};
const T = (id, name, extra = {}) => {
  texts[`trait.${id}`] = name;
  return { id: `trait_${id}`, name_key: `trait.${id}`, canon: "A", ...extra };
};
const traits = [
  // Exemples du 02 §9.2
  T("obstine", "Obstiné", { attributes: { composure: 5 }, vote: { reforme: 0.1 }, opposes: ["trait_pragmatique"] }),
  T("pragmatique", "Pragmatique", { attributes: { tactics: 5 }, vote: { economie: 0.1 }, opposes: ["trait_obstine", "trait_idealiste"] }),
  T("charismatique", "Charismatique", { attributes: { charisma: 15 } }),
  T("terrorise", "Terrorisé", { attributes: { composure: -20 }, stress_gain: 1.5, advice_bias: "exagere", opposes: ["trait_temeraire"] }),
  T("fanatique_mur", "Fanatique du Mur", { attributes: { faith: 25 }, advice_bias: "ignore", vote: { religion: 0.6, exploration: -0.6, tradition: 0.3 }, opposes: ["trait_sceptique"] }),
  T("idealiste", "Idéaliste", { vote: { reforme: 0.3, liberte: 0.3, repression: -0.3 }, opposes: ["trait_cynique", "trait_pragmatique"] }),
  T("opportuniste", "Opportuniste", { attributes: { ambition: 15 }, advice_bias: "gonfle", vote: { commerce: 0.2 }, opposes: ["trait_devoue"] }),
  T("veteran_breches", "Vétéran des brèches", { attributes: { composure: 10, command: 5 }, stress_gain: 0.8, notes_canon: "Ne peut concerner que des faits antérieurs à la date du scénario (845 : chute de Maria)." }),
  T("traumatise_trost", "Traumatisé de Trost", { attributes: { composure: -15 }, stress_gain: 1.3, acquired: true, notes_canon: "Acquis seulement après la bataille de Trost (E10–E11, 850) : jamais attribué au départ d'un scénario antérieur." }),
  T("meneur_ne", "Meneur né", { attributes: { command: 15, charisma: 5 } }),
  T("froid", "Froid", { attributes: { composure: 10, charisma: -5 }, stress_gain: 0.8 }),
  T("solitaire", "Solitaire", { attributes: { charisma: -5 }, opposes: ["trait_charismatique"] }),
  T("devoue", "Dévoué", { vote: { militaire: 0.1 }, opposes: ["trait_opportuniste"] }),
  T("rancunier", "Rancunier", { stress_gain: 1.1 }),
  T("curieux", "Curieux", { attributes: { intellect: 10 }, vote: { exploration: 0.4, science: 0.5 } }),
  T("cynique", "Cynique", { advice_bias: "exagere", vote: { liberte: -0.1 }, opposes: ["trait_idealiste"] }),
  T("ackerman", "Ackerman (éveil)", { attributes: { odm: 20, melee: 20, endurance: 15 }, notes_canon: "Lignée aux capacités physiques exceptionnelles (01 §1) ; effets chiffrés [A]." }),
  T("hante", "Hanté (Titan-hôte)", { stress_gain: 1.3, acquired: true, notes_canon: "Réservé aux porteurs, après révélation (P5–P6)." }),
  T("soupconneux", "Soupçonneux", { attributes: { intellect: 5 }, vote: { ordre: 0.2, liberte: -0.2 } }),
  // Compléments [A]
  T("ambitieux", "Ambitieux", { attributes: { ambition: 25 }, advice_bias: "gonfle", opposes: ["trait_modeste"] }),
  T("modeste", "Modeste", { attributes: { ambition: -15 }, opposes: ["trait_ambitieux"] }),
  T("prudent", "Prudent", { attributes: { tactics: 5 }, advice_bias: "exagere", vote: { exploration: -0.3, militaire: -0.1 }, opposes: ["trait_temeraire"] }),
  T("temeraire", "Téméraire", { attributes: { composure: 5 }, vote: { exploration: 0.3 }, opposes: ["trait_prudent", "trait_terrorise"] }),
  T("loyal", "Loyal", { opposes: ["trait_corrompu"] }),
  T("corrompu", "Corrompu", { advice_bias: "gonfle", vote: { commerce: 0.3, transparence: -0.5 }, opposes: ["trait_integre", "trait_loyal"] }),
  T("integre", "Intègre", { vote: { transparence: 0.5, repression: -0.1 }, opposes: ["trait_corrompu"] }),
  T("pieux", "Pieux", { attributes: { faith: 15 }, vote: { religion: 0.4 }, opposes: ["trait_sceptique"] }),
  T("sceptique", "Sceptique", { attributes: { faith: -15 }, vote: { religion: -0.3, science: 0.2 }, opposes: ["trait_pieux", "trait_fanatique_mur"] }),
  T("erudit", "Érudit", { attributes: { intellect: 15 }, vote: { science: 0.3, reforme: 0.1 } }),
  T("brutal", "Brutal", { attributes: { melee: 10, charisma: -5 }, vote: { repression: 0.4 } }),
  T("compatissant", "Compatissant", { vote: { social: 0.5, repression: -0.4 }, opposes: ["trait_brutal"] }),
  T("discret", "Discret", { attributes: { charisma: -5 }, stress_gain: 0.9 }),
  T("methodique", "Méthodique", { attributes: { tactics: 5, intellect: 5 } }),
  T("impulsif", "Impulsif", { attributes: { composure: -10 }, stress_gain: 1.2, opposes: ["trait_methodique"] }),
  T("stoique", "Stoïque", { attributes: { composure: 15 }, stress_gain: 0.5, opposes: ["trait_anxieux"] }),
  T("anxieux", "Anxieux", { attributes: { composure: -10 }, stress_gain: 1.5, advice_bias: "exagere", opposes: ["trait_stoique"] }),
  T("joueur", "Joueur (pari calculé)", { attributes: { tactics: 5 }, vote: { exploration: 0.2 } }),
  T("bureaucrate", "Bureaucrate", { vote: { tradition: 0.2, reforme: -0.2 } }),
  T("bon_vivant", "Bon vivant", { stress_gain: 0.8, attributes: { charisma: 5 } }),
  T("rigide", "Rigide", { vote: { tradition: 0.3, reforme: -0.3, ordre: 0.2 } }),
  T("diplomate", "Diplomate", { attributes: { charisma: 10 } }),
  // Traits acquis en cours de partie (02 §9.3)
  T("epuise", "Épuisé", { attributes: { intellect: -10, command: -10, composure: -10 }, acquired: true }),
  T("blessure_psychique", "Blessure psychique", { attributes: { composure: -20 }, stress_gain: 1.4, acquired: true }),
];
fs.writeFileSync("data/traits/traits.json", JSON.stringify(traits, null, 2) + "\n");

const S = (id, name, note) => {
  texts[`stratum.${id}`] = name;
  return { id: `str_${id}`, name_key: `stratum.${id}`, canon: "A", notes_canon: note };
};
const strata = [
  S("royaute", "Famille royale et cour", "Strates de Paradis (01 §4, A) : famille royale/Reiss."),
  S("noblesse", "Noblesse des murs", "01 §4 (A)."),
  S("bourgeoisie", "Bourgeoisie et marchands", "01 §4 (A)."),
  S("militaires", "Militaires", "01 §4 (A)."),
  S("clerge", "Clergé des Murs", "01 §4 (A)."),
  S("paysans", "Paysans et ouvriers", "01 §4 (A)."),
  S("basfonds", "Habitants des bas-fonds", "01 §4 (A) : ville souterraine."),
  S("refugies", "Réfugiés", "01 §4 (A) ; afflux après la chute de Maria (02 §4)."),
];
fs.writeFileSync("data/strata/strata.json", JSON.stringify(strata, null, 2) + "\n");

const O = (id, key, name, kind, budgeted, canon, note) => {
  texts[`org.name.${id}`] = name;
  return { id: `org_${id}`, key, name_key: `org.name.${id}`, kind, budgeted, canon, ...(note ? { notes_canon: note } : {}) };
};
const orgs = [
  O("survey_corps", "survey_corps", "Corps de Reconnaissance", "militaire", true, "C", "01 §5.1 : expéditions hors murs ; budget faible (A)."),
  O("garrison", "garrison", "Garnison", "militaire", true, "C", "01 §5.1."),
  O("military_police", "military_police", "Brigade Militaire", "militaire", true, "C", "01 §5.1 ; corruption élevée (A)."),
  O("training_corps", "training_corps", "Corps d'Entraînement", "militaire", true, "C", "01 §5.1."),
  O("culte", "culte", "Culte des Murs", "religieuse", false, "C", "01 §5.1 : religion d'État."),
  O("cabinet", "cabinet", "Cabinet", "civile", false, "C", "01 §5.1, 08 §4.1."),
  O("cour", "cour", "Cour royale et noblesse", "cour", false, "C", "01 §5.1 : famille royale (Reiss), faux roi."),
  O("guildes", "guildes", "Guildes marchandes", "civile", false, "A", "08 §5.1 : approvisionnement, crédit."),
];
fs.writeFileSync("data/organisations/paradis.json", JSON.stringify(orgs, null, 2) + "\n");
fs.writeFileSync(process.argv[2] ?? "/dev/stdout", JSON.stringify(texts, null, 2) + "\n");
console.error(`${traits.length} traits, ${strata.length} strates, ${orgs.length} organisations`);
