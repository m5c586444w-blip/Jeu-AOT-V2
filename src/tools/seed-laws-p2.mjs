// Script de génération (traçabilité) : node src/tools/seed-laws-p2.mjs <sortie-textes.json>
// Décrets (02 §4 : conscription, rationnement, censure, couvre-feu, expropriation, mobilisation des civils,
// liberté de la presse, politique de la mémoire… ; compléments [A]) et 18 rôles de conseillers (08 §2).
import fs from "node:fs";
const texts = {};
const m = (target, value) => ({ target, value });
const L = (id, cat, vote, capital, gold, tags, name, desc, effects, delayed = [], group) => {
  texts[`law.${id}`] = name;
  texts[`law.${id}.desc`] = desc;
  return {
    id: `law_${id}`, name_key: `law.${id}`, desc_key: `law.${id}.desc`, category: cat, requires_vote: vote,
    cost: { capital, gold }, tags, ...(group ? { exclusive_group: group } : {}), effects,
    delayed: delayed.map(([after_days, eff, logText], i) => {
      const key = `law.${id}.later${i}`;
      texts[key] = logText;
      return { after_days, effects: eff, log_key: key };
    }),
    canon: "A",
    notes_canon: "Décret de jeu (02 §4) : effets chiffrés [A].",
  };
};
const laws = [
  // Militaire
  L("conscription_etendue", "militaire", true, 20, 0, ["militaire", "ordre"], "Conscription étendue", "Abaisse l'âge et élargit les classes appelées.",
    [m("manpower_mult", 0.5), m("satisfaction:str_paysans", -8), m("satisfaction:str_bourgeoisie", -4), m("org_loyalty:org_garrison", 5), m("legitimacy", -2)],
    [[60, [m("radicalisation:str_paysans", 6)], "Rumeurs de réfractaires dans les campagnes."]], "conscription"),
  L("exemptions_conscription", "militaire", true, 15, 0, ["commerce", "tradition"], "Exemptions de conscription", "Les familles qui paient sont dispensées.",
    [m("manpower_mult", -0.3), m("satisfaction:str_bourgeoisie", 6), m("satisfaction:str_noblesse", 4), m("satisfaction:str_paysans", -4), m("org_loyalty:org_garrison", -4)], [], "conscription"),
  L("soutien_corps", "militaire", true, 20, 3000, ["exploration", "militaire", "reforme"], "Soutien aux expéditions", "Crédits et chevaux supplémentaires pour le Corps de Reconnaissance.",
    [m("org_loyalty:org_survey_corps", 12), m("org_influence:org_survey_corps", 5), m("satisfaction:str_clerge", -5), m("consumption_mult:gas", 0.05), m("legitimacy", -1)],
    [[30, [m("radicalisation:str_clerge", 4)], "Des sermons dénoncent les sorties hors des murs."]], "expeditions"),
  L("moratoire_expeditions", "militaire", true, 15, 0, ["religion", "tradition"], "Moratoire sur les expéditions", "Suspend les sorties hors des murs.",
    [m("org_loyalty:org_survey_corps", -15), m("satisfaction:str_clerge", 6), m("satisfaction:str_bourgeoisie", 2), m("legitimacy", 1)],
    [[90, [m("org_influence:org_survey_corps", -6), m("morale", -1)], "Le Corps de Reconnaissance s'estime abandonné."]], "expeditions"),
  L("exercices_garnison", "militaire", false, 8, 1500, ["militaire"], "Exercices de la Garnison", "Manœuvres régulières sur les murs.",
    [m("consumption_mult:gas", 0.1), m("consumption_mult:powder", 0.2), m("org_loyalty:org_garrison", 4), m("stability", 2)]),
  L("requisition_chevaux", "militaire", false, 10, 0, ["militaire"], "Réquisition des chevaux", "Les chevaux de trait sont versés à l'armée.",
    [m("satisfaction:str_paysans", -6), m("org_loyalty:org_survey_corps", 5), m("production_mult:food", -0.03), m("production_mult:horses", -0.2)]),
  L("mobilisation_civils", "militaire", true, 25, 0, ["militaire", "repression"], "Mobilisation des civils", "Travaux et gardes imposés aux civils valides.",
    [m("manpower_mult", 0.3), m("production_mult:food", -0.05), m("satisfaction:str_paysans", -5), m("satisfaction:str_basfonds", -3), m("legitimacy", -2)]),
  L("milices_civiles", "militaire", false, 10, 500, ["ordre"], "Milices civiles", "Gardes de quartier armées par les districts.",
    [m("stability", 3), m("satisfaction:str_bourgeoisie", 2), m("org_influence:org_garrison", -3)]),
  // Économie
  L("impot_foncier_hausse", "economie", true, 20, 0, ["economie", "repression"], "Hausse de l'impôt foncier", "Les terres et les maisons paient davantage.",
    [m("tax_mult", 0.25), m("satisfaction:str_noblesse", -8), m("satisfaction:str_paysans", -4), m("legitimacy", -2)],
    [[45, [m("radicalisation:str_paysans", 4)], "Plaintes contre la taxe foncière dans les districts."]], "impot_foncier"),
  L("impot_commerce_hausse", "economie", true, 20, 0, ["economie"], "Hausse des taxes de commerce", "Octrois et patentes augmentés.",
    [m("tax_mult", 0.15), m("satisfaction:str_bourgeoisie", -10), m("org_loyalty:org_guildes", -10)], [], "impot_commerce"),
  L("allegement_fiscal", "economie", true, 15, 0, ["social", "commerce"], "Allègement fiscal", "Remise partielle des impôts directs.",
    [m("tax_mult", -0.2), m("satisfaction:str_paysans", 6), m("satisfaction:str_bourgeoisie", 4), m("legitimacy", 2)], [], "impot_foncier"),
  L("prix_plafonnes_grain", "economie", false, 12, 0, ["social"], "Prix plafonnés du grain", "Le pain reste abordable par décret.",
    [m("satisfaction:str_basfonds", 6), m("satisfaction:str_refugies", 6), m("satisfaction:str_paysans", -6), m("production_mult:food", -0.05)],
    [[60, [m("losses_mult:food", 0.3)], "Un marché noir du grain s'organise."]]),
  L("requisition_greniers", "economie", false, 15, 0, ["ordre", "social"], "Réquisition des greniers", "Les réserves privées passent sous contrôle public.",
    [m("consumption_mult:food", -0.05), m("losses_mult:food", -0.2), m("satisfaction:str_noblesse", -5), m("satisfaction:str_bourgeoisie", -6), m("legitimacy", -1)]),
  L("monopole_gaz", "economie", true, 15, 0, ["ordre", "militaire"], "Monopole d'État sur le gaz", "La distribution du gaz passe aux arsenaux.",
    [m("losses_mult:gas", -0.4), m("org_loyalty:org_guildes", -6), m("satisfaction:str_bourgeoisie", -4)]),
  L("soutien_forges", "economie", false, 10, 2000, ["commerce", "militaire"], "Soutien aux forges", "Commandes publiques d'acier.",
    [m("production_mult:steel", 0.15), m("tax_mult", -0.05), m("satisfaction:str_bourgeoisie", 3)]),
  L("greniers_publics", "economie", false, 10, 2500, ["social"], "Greniers publics", "Entrepôts municipaux surveillés.",
    [m("stability", 2), m("losses_mult:food", -0.15), m("tax_mult", -0.05)]),
  L("lutte_corruption", "economie", true, 25, 0, ["transparence", "reforme"], "Lutte contre la corruption", "Inspections des comptes de la Brigade et des greniers.",
    [m("losses_mult:food", -0.3), m("losses_mult:gas", -0.3), m("losses_mult:steel", -0.3), m("losses_mult:gold", -0.3), m("org_loyalty:org_military_police", -6), m("satisfaction:str_noblesse", -4)],
    [[30, [m("legitimacy", 3)], "Arrestations de fonctionnaires corrompus : la nouvelle circule."]]),
  L("travaux_murs", "economie", false, 10, 3000, ["militaire", "tradition"], "Travaux sur les murs", "Corvées d'entretien des parements et des portes.",
    [m("stability", 2), m("tax_mult", -0.05), m("satisfaction:str_paysans", -3), m("satisfaction:str_clerge", 2)]),
  // Ordre
  L("couvre_feu", "ordre", false, 10, 0, ["ordre", "repression"], "Couvre-feu", "Interdiction de circuler la nuit dans les districts.",
    [m("stability", 4), m("satisfaction:str_bourgeoisie", -5), m("satisfaction:str_basfonds", -6), m("org_influence:org_military_police", 5), m("legitimacy", -1)],
    [[30, [m("radicalisation:str_basfonds", 6)], "Échauffourées dans les rues après le couvre-feu."]]),
  L("loi_martiale", "ordre", true, 35, 0, ["ordre", "repression", "militaire"], "Loi martiale", "L'armée administre les districts.",
    [m("stability", 8), m("legitimacy", -8), m("org_influence:org_garrison", 8), m("org_influence:org_military_police", 5), m("satisfaction:str_bourgeoisie", -6), m("satisfaction:str_paysans", -5), m("satisfaction:str_basfonds", -5), m("satisfaction:str_noblesse", -4)],
    [[45, [m("radicalisation:str_bourgeoisie", 5), m("radicalisation:str_basfonds", 5)], "Pamphlets contre « le régime des sabres »."]], "exception"),
  L("police_renforcee", "ordre", false, 12, 2000, ["ordre", "repression"], "Police renforcée", "Effectifs et pouvoirs accrus pour la Brigade.",
    [m("stability", 3), m("org_influence:org_military_police", 6), m("org_loyalty:org_military_police", 4), m("satisfaction:str_basfonds", -5)]),
  L("amnistie", "ordre", true, 15, 0, ["liberte", "social"], "Amnistie", "Remise des peines pour les délits mineurs.",
    [m("legitimacy", 3), m("satisfaction:str_basfonds", 6), m("stability", -2), m("org_loyalty:org_military_police", -5)]),
  L("controle_ville_souterraine", "ordre", false, 15, 1000, ["ordre", "repression"], "Contrôle de la ville souterraine", "Barrages et rafles dans les galeries.",
    [m("stability", 3), m("satisfaction:str_basfonds", -10), m("radicalisation:str_basfonds", 5), m("losses_mult:gold", -0.1)]),
  L("tribunaux_civils", "ordre", true, 15, 1000, ["reforme", "transparence"], "Tribunaux civils", "Les délits civils échappent aux tribunaux de la Brigade.",
    [m("legitimacy", 2), m("org_influence:org_military_police", -4), m("satisfaction:str_bourgeoisie", 3)]),
  // Religion
  L("privileges_culte", "religion", true, 15, 0, ["religion", "tradition"], "Privilèges du Culte", "Exemptions et préséance pour le clergé des Murs.",
    [m("satisfaction:str_clerge", 10), m("org_loyalty:org_culte", 10), m("legitimacy", 3), m("satisfaction:str_bourgeoisie", -2)],
    [[90, [m("org_influence:org_culte", 5)], "Le Culte des Murs étend son influence sur les écoles."]], "culte"),
  L("taxe_culte", "religion", true, 20, 0, ["economie", "reforme"], "Impôt sur les biens du Culte", "Les biens du clergé contribuent aux charges.",
    [m("tax_mult", 0.08), m("satisfaction:str_clerge", -10), m("org_loyalty:org_culte", -12), m("legitimacy", -3)], [], "culte"),
  L("tolerance_heterodoxe", "religion", true, 15, 0, ["liberte", "reforme"], "Tolérance des courants hétérodoxes", "Les prédications hors du Culte ne sont plus poursuivies.",
    [m("satisfaction:str_clerge", -6), m("satisfaction:str_bourgeoisie", 3), m("legitimacy", -2), m("org_loyalty:org_culte", -6)]),
  L("censure_religieuse", "religion", false, 10, 0, ["religion", "repression"], "Censure religieuse", "Le Culte contrôle les écrits sur les Murs.",
    [m("org_influence:org_culte", 5), m("satisfaction:str_clerge", 4), m("satisfaction:str_bourgeoisie", -4), m("stability", 1)]),
  // Information
  L("censure_presse", "information", false, 12, 0, ["ordre", "repression"], "Censure de la presse", "Les gazettes passent par le visa du Cabinet.",
    [m("stability", 3), m("satisfaction:str_bourgeoisie", -5)],
    [[60, [m("legitimacy", -3)], "Des pamphlets clandestins circulent dans Mitras."]], "presse"),
  L("liberte_presse", "information", true, 15, 0, ["liberte", "transparence"], "Liberté de la presse", "Les gazettes publient sans visa préalable.",
    [m("legitimacy", 2), m("stability", -2), m("satisfaction:str_bourgeoisie", 5)], [], "presse"),
  L("gazette_officielle", "information", false, 8, 1500, ["tradition"], "Gazette officielle", "Une gazette du Cabinet paraît chaque semaine.",
    [m("morale", 2), m("tax_mult", -0.03), m("legitimacy", 1)]),
  L("politique_memoire", "information", false, 10, 2000, ["social", "tradition"], "Politique de la mémoire", "Commémorations de la chute de Maria (845).",
    [m("morale", 2), m("satisfaction:str_refugies", 5), m("legitimacy", 2), m("tax_mult", -0.03)]),
  L("recensement", "information", false, 8, 1000, ["ordre"], "Recensement général", "Registres de population tenus par district.",
    [m("stability", 2), m("manpower_mult", 0.1), m("satisfaction:str_basfonds", -3)]),
  // Société
  L("aide_refugies", "societe", true, 15, 3000, ["social"], "Aide aux réfugiés", "Rations, abris et soins pour les réfugiés de Maria.",
    [m("satisfaction:str_refugies", 12), m("tax_mult", -0.08), m("satisfaction:str_paysans", -3)],
    [[60, [m("stability", 2)], "Les camps de réfugiés s'apaisent."]], "refugies"),
  L("travail_refugies", "societe", true, 15, 0, ["repression", "economie"], "Travail obligatoire des réfugiés", "Les réfugiés valides sont affectés aux champs.",
    [m("production_mult:food", 0.05), m("satisfaction:str_refugies", -10), m("radicalisation:str_refugies", 6), m("legitimacy", -2)], [], "refugies"),
  L("hopitaux_publics", "societe", false, 10, 3000, ["social"], "Hôpitaux publics", "Lits et médecins payés par le Cabinet.",
    [m("satisfaction:str_paysans", 3), m("satisfaction:str_basfonds", 4), m("satisfaction:str_refugies", 4), m("tax_mult", -0.05), m("stability", 1)]),
  L("ecoles", "societe", false, 10, 2500, ["reforme", "science"], "Écoles de district", "Instruction élémentaire dans chaque district.",
    [m("satisfaction:str_bourgeoisie", 3), m("tax_mult", -0.04), m("legitimacy", 1)],
    [[120, [m("production_mult:steel", 0.05)], "Les premiers apprentis formés entrent dans les forges."]]),
  L("privileges_noblesse", "societe", true, 15, 0, ["tradition"], "Privilèges de la noblesse", "Confirmation des droits seigneuriaux.",
    [m("satisfaction:str_noblesse", 10), m("satisfaction:str_paysans", -5), m("legitimacy", 1), m("org_loyalty:org_cour", 8)], [], "noblesse"),
  L("expropriation", "societe", true, 30, 0, ["reforme", "social", "repression"], "Expropriation des grands domaines", "Les terres des grandes familles sont partagées.",
    [m("satisfaction:str_noblesse", -15), m("satisfaction:str_paysans", 6), m("satisfaction:str_refugies", 8), m("production_mult:food", 0.05), m("legitimacy", -4), m("org_loyalty:org_cour", -15)],
    [[30, [m("radicalisation:str_noblesse", 10)], "Des familles nobles se réunissent en secret."]], "noblesse"),
  L("rations_militaires", "societe", false, 10, 0, ["militaire"], "Priorité aux rations militaires", "L'armée est servie avant les civils.",
    [m("org_loyalty:org_garrison", 5), m("org_loyalty:org_survey_corps", 5), m("satisfaction:str_basfonds", -4), m("satisfaction:str_refugies", -4), m("morale", -1)]),
  L("fetes_murs", "societe", false, 8, 2000, ["religion", "tradition"], "Fêtes des Murs", "Jours de fête et de procession.",
    [m("morale", 3), m("tax_mult", -0.04), m("satisfaction:str_clerge", 3)]),
  L("assemblee_guildes", "societe", true, 15, 0, ["commerce", "reforme"], "Assemblée des guildes", "Les guildes siègent chaque année avec le Cabinet.",
    [m("org_influence:org_guildes", 6), m("org_loyalty:org_guildes", 8), m("satisfaction:str_bourgeoisie", 4), m("legitimacy", 1), m("stability", -1)]),
  L("charite_basfonds", "societe", false, 8, 1500, ["social", "religion"], "Charité dans les bas-fonds", "Soupes et dispensaires dans la ville souterraine.",
    [m("satisfaction:str_basfonds", 8), m("tax_mult", -0.04)]),
];
fs.writeFileSync("data/laws/paradis.json", JSON.stringify(laws, null, 2) + "\n");

const R = (n, id, name, cabinet, metric, alarm, proposal, veto, note) => {
  texts[`role.${id}`] = name;
  return { id: `role_${id}`, number: n, name_key: `role.${id}`, cabinet, metric, alarm, ...(proposal ? { proposal: `law_${proposal}` } : {}), ...(veto ? { veto_category: veto } : {}), canon: "A", notes_canon: note ?? "08 §2 (rôle), mécanique [A]." };
};
const roles = [
  R(1, "stratege", "Stratège militaire", true, "wall_structure", 75, "exercices_garnison", "militaire"),
  R(2, "intendant", "Intendant", false, "food_days", 45, "requisition_greniers"),
  R(3, "renseignement", "Chef du renseignement", false, "radicalisation", 35, "police_renforcee"),
  R(4, "tresorier", "Trésorier", true, "gold", 30000, "impot_foncier_hausse", "economie"),
  R(5, "ordre", "Ministre de l'Ordre", true, "stability", 45, "couvre_feu", "ordre"),
  R(6, "religieux", "Chef religieux", true, "faith", 50, "privileges_culte", "religion"),
  R(7, "scientifique", "Scientifique", false, "none", 0),
  R(8, "medecin", "Médecin en chef", false, "morale", 45, "hopitaux_publics"),
  R(9, "diplomate", "Diplomate", false, "none", 0, undefined, undefined, "08 §2 ; aucun contact extérieur avant 851 (01 §2) : poste vacant en 850 [A]."),
  R(10, "presse", "Propagandiste", false, "legitimacy", 45, "gazette_officielle"),
  R(11, "juriste", "Juriste", true, "legitimacy", 40, "tribunaux_civils"),
  R(12, "instructeur", "Instructeur", true, "manpower", 8000, "conscription_etendue", "militaire"),
  R(13, "titans", "Spécialiste des Titans", false, "none", 0),
  R(14, "murs", "Architecte des murs", false, "wall_structure", 85, "travaux_murs"),
  R(15, "transports", "Maître des transports", false, "horses", 6000, "requisition_chevaux"),
  R(16, "archiviste", "Archiviste", false, "none", 0),
  R(17, "confident", "Confident", false, "capital", 10),
  R(18, "chef_cabinet", "Chef de cabinet", true, "capital", 15, "gazette_officielle"),
];
fs.writeFileSync("data/roles/roles.json", JSON.stringify(roles, null, 2) + "\n");
fs.writeFileSync(process.argv[2] ?? "/dev/stdout", JSON.stringify(texts, null, 2) + "\n");
console.error(`${laws.length} décrets (${laws.filter((l) => l.requires_vote).length} soumis au vote), ${roles.length} rôles`);
