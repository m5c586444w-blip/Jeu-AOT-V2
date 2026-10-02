// Script de génération (conservé pour traçabilité) : node src/tools/seed-data-p0.mjs
// Génère la graine de données P0 (fichier 14 §3.3) — exécuté une fois ; les JSON produits sont la source.
import fs from "node:fs";
const w = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

w("data/provinces/paradis.json", [
  { id: "prov_shiganshina", atlas_code: "R01", name_key: "prov.shiganshina", region: "anneau_maria", wall: "maria", terrain: "urbain", canon: "C", notes_canon: "District sud de Wall Maria (fichiers 01 §3.1, 06 §1.3, 11 §2)." },
  { id: "prov_maria_sud", atlas_code: "M05", name_key: "prov.maria_sud", region: "mur_maria", wall: "maria", terrain: "mur", canon: "A", notes_canon: "Découpage du mur en segments = adaptation (06 §1.2) ; la porte de Shiganshina et la brèche de 845 sont canon." },
  { id: "prov_trost", atlas_code: "S01", name_key: "prov.trost", region: "anneau_rose", wall: "rose", terrain: "urbain", canon: "C", notes_canon: "District sud de Wall Rose ; brèche de 850 (06 §1.5, 11 §2)." },
  { id: "prov_utgard", atlas_code: "S06", name_key: "prov.utgard", region: "anneau_rose", wall: "rose", terrain: "fort", destroyed_year: 850, destroyed_event: "evt_850_utgard_battle", canon: "C", notes_canon: "Château abandonné dans Wall Rose, près du périmètre intérieur ; détruit en 850 (11 §1, §2)." },
  { id: "prov_mitras", atlas_code: "I01", name_key: "prov.mitras", region: "interieur_sina", wall: "sina", terrain: "urbain", canon: "C", notes_canon: "Capitale, dans Wall Sina (01 §3.1)." },
]);

w("data/characters/paradis.json", [
  { id: "char_erwin_smith", name: "Erwin Smith", active_from: 845, active_until: 850, death_event: "evt_850_erwin_charge", faction: "survey_corps", roles: ["commandant"], canon: "C", notes_canon: "Mort à Shiganshina en 850 (11 §3). active_from 845 = borne de jeu [A]." },
  { id: "char_mike_zacharias", name: "Mike Zacharias", active_from: 845, active_until: 850, death_event: "evt_850_wall_rose_invasion", faction: "survey_corps", roles: ["chef_escouade"], canon: "C", notes_canon: "Meurt pendant l'invasion de Wall Rose (E24), pas à Utgard (11 §3 + errata). active_from 845 = borne de jeu [A]." },
  { id: "char_kenny_ackerman", name: "Kenny Ackerman", active_from: 845, active_until: 850, death_event: "evt_850_rod_reiss_titan", faction: "reseau_souterrain", roles: ["chef_de_l_ombre"], canon: "C", notes_canon: "Sortie en 850, arc du gouvernement royal (11 §3) ; death_event = E35 (errata Q2). Affiliation exacte non précisée dans les spécifications [?]. active_from 845 = borne de jeu [A]." },
  { id: "char_hange_zoe", name: "Hange Zoë", active_from: 845, active_until: 854, faction: "survey_corps", roles: ["chef_de_section", "scientifique"], canon: "C", notes_canon: "Meurt en 854 pendant le Grondement (11 §3) ; death_event (E60) à relier quand la chaîne 851–854 sera saisie. Graphie « Hanji » selon les éditions [?]." },
  { id: "char_dot_pixis", name: "Dot Pixis", active_from: 845, active_until: 854, faction: "garrison", roles: ["commandant_garnison_sud"], canon: "C", notes_canon: "Meurt lors de la contre-attaque de Marley à Shiganshina en 854 (11 §3) ; death_event (E58) à relier plus tard." },
  { id: "char_darius_zackly", name: "Darius Zackly", active_from: 845, active_until: 854, faction: "commandement_supreme", roles: ["commandant_en_chef"], canon: "C", notes_canon: "Assassiné en 854 (11 §3) ; death_event (E57) à relier plus tard. Graphie « Dhalis » selon les versions [?]." },
]);

w("data/techs/paradis.json", [
  { id: "tech_odm_standard", code: "T-ODM-01", tree: "odm", cost: null, start: true, min_year: 845, canon: "C" },
  { id: "tech_wall_artillery", code: "T-ANT-01", tree: "anti_titan", cost: null, start: true, min_year: 845, canon: "C" },
  { id: "tech_thunder_spear_prototype", code: "T-ANT-08", tree: "anti_titan", cost: 260, prereqs: ["tech_wall_artillery", "tech_odm_standard"], unlock_event: "evt_850_police_tech_seized", requires_character: "char_hange_zoe", min_year: 850, canon: "C", notes_canon: "Première apparition fin 850 (Retour à Shiganshina) ; développée par Hange à partir des technologies de la Police intérieure (11 §1). Condition « poudrière niv. 2 » à relier en P5." },
  { id: "tech_hardening_seal", code: "T-FOR-03", tree: "fortification", cost: 250, unlock_event: "evt_850_trost_plug", min_year: 850, canon: "C", notes_canon: "Exige Eren porteur et T-FOR-01 (13 §5) : personnage et prérequis à relier en P2/P5." },
]);

w("data/techs/marley.json", [
  { id: "tech_antititan_rifle", code: "T-MOD-05", tree: "armes_modernes", faction: "marley", cost: 220, unlock_event: "evt_850_marley_antititan_rifle", min_year: 850, canon: "C", notes_canon: "Fusils anti-Titan confirmés (emploi en 854, 11 §6) ; date de développement [?] : déblocage par un événement paramétrable (errata Q1). Prérequis T-MOD-01 à relier en P7." },
]);

const chain = [
  ["E09", "104th_graduation", null],
  ["E10", "trost_breach", "E09", "prov_trost"],
  ["E11", "trost_defense", "E10", "prov_trost"],
  ["E12", "eren_first_transformation", "E11", "prov_trost"],
  ["E13", "trost_plug", "E12", "prov_trost"],
  ["E14", "eren_trial", "E13"],
  ["E15", "branch_choice", "E14"],
  ["E16", "expedition57_preparation", "E15"],
  ["E17", "expedition57", "E16"],
  ["E18", "giant_tree_forest", "E17"],
  ["E19", "special_squad_loss", "E18"],
  ["E20", "traitor_investigation", "E19"],
  ["E21", "stohess_capture", "E20"],
  ["E22", "annie_crystallization", "E21"],
  ["E23", "wall_titan_discovery", "E22"],
  ["E24", "wall_rose_invasion", "E23"],
  ["E25", "ragako", "E24"],
  ["E26", "utgard_battle", "E25", "prov_utgard"],
  ["E27", "ymir_historia_revelations", "E26"],
  ["E28", "armored_colossal_fight", "E27"],
  ["E29", "sina_gates_closed", "E32"],
  ["E30", "survey_corps_hunted", "E28"],
  ["E31", "levi_kenny_street_fight", "E30", "?"],
  ["E32", "erwin_trial", "E31"],
  ["E33", "coup", "E32"],
  ["E34", "reiss_chapel", "E33"],
  ["E35", "rod_reiss_titan", "E34"],
  ["E36", "historia_coronation", "E35"],
  ["E37", "police_tech_seized", "E36"],
  ["E38", "shiganshina_preparations", "E37"],
  ["E39", "shiganshina_battle", "E38", "prov_shiganshina"],
  ["E40", "thunder_spears_first_use", "E39", "prov_shiganshina"],
  ["E41", "erwin_charge", "E40", "prov_shiganshina"],
  ["E42", "serum_choice", "E41", "prov_shiganshina"],
];
const idOf = (code) => `evt_850_${chain.find((c) => c[0] === code)[1]}`;
const notes = {
  E09: "Racine de la graine P0 : son prédécesseur E08 (≈ 847 [?]) n'est pas encore saisi.",
  E19: "Moment exact « fin de E18 » [?] ; dates de mort des membres de l'escouade non recoupées (11 §9).",
  E29: "Se déclenche pendant le procès d'Erwin (E32), à l'annonce de la brèche de Rose (12 §3).",
  E31: "Localisation du combat de rue = [?] (errata Q2).",
  E35: "Titan de Rod Reiss ≈ 120 m ; Orvud ravagé (11 §2). Mort de Kenny rattachée ici (errata Q2).",
  E37: "unlock_event des Lances de foudre (11 §1, 13 §11).",
  E41: "Mort d'Erwin en canon (11 §3).",
};
const events = chain.map(([code, slug, after, location]) => ({
  id: `evt_850_${slug}`,
  code,
  year_min: 850,
  window: { after: after ? idOf(after) : null },
  ...(location ? { location } : {}),
  text_key: `evt.850.${slug}`,
  canon: code === "E19" ? "?" : "C",
  ...(notes[code] ? { notes_canon: notes[code] } : {}),
}));
events.push({
  id: "evt_850_marley_antititan_rifle",
  year_min: 850,
  year_max: 854,
  window: { after: idOf("E28") },
  text_key: "evt.850.marley_antititan_rifle",
  canon: "?",
  notes_canon: "Événement paramétrable hors des 60 événements canon (errata Q1) : date de mise au point des fusils anti-Titan inconnue ; placé après E28 (premier affrontement Guerriers/Paradis).",
});
w("data/events/canon_850.json", events);
console.log(events.length, "événements");
