// Script de génération (traçabilité) : node src/tools/seed-characters-p2.mjs <sortie-textes.json>
// Personnages de Paradis vers 850. Existence et rôle : C si canon (07, 08, 11) ; attributs, traits, programmes : A.
// Fenêtres de présence : 11 §3 + errata utilisateur. Secrets (`hidden`) : jamais affichés avant P5.
import fs from "node:fs";

const PROFILES = {
  commandant: { odm: 70, melee: 55, aim: 50, command: 90, tactics: 90, intellect: 85, charisma: 85, endurance: 65, composure: 85, ambition: 60, faith: 25, health: 80 },
  elite: { odm: 85, melee: 70, aim: 55, command: 55, tactics: 60, intellect: 55, charisma: 45, endurance: 80, composure: 70, ambition: 35, faith: 30, health: 85 },
  officier: { odm: 60, melee: 55, aim: 55, command: 65, tactics: 60, intellect: 60, charisma: 55, endurance: 65, composure: 60, ambition: 50, faith: 40, health: 75 },
  cadet: { odm: 55, melee: 50, aim: 50, command: 30, tactics: 35, intellect: 50, charisma: 45, endurance: 70, composure: 45, ambition: 50, faith: 40, health: 90 },
  savant: { odm: 55, melee: 40, aim: 45, command: 50, tactics: 55, intellect: 92, charisma: 55, endurance: 55, composure: 50, ambition: 45, faith: 20, health: 75 },
  clerc: { odm: 5, melee: 10, aim: 10, command: 40, tactics: 30, intellect: 60, charisma: 70, endurance: 40, composure: 55, ambition: 55, faith: 95, health: 60 },
  noble: { odm: 5, melee: 15, aim: 20, command: 50, tactics: 50, intellect: 65, charisma: 60, endurance: 45, composure: 60, ambition: 75, faith: 55, health: 65 },
  civil: { odm: 5, melee: 15, aim: 20, command: 45, tactics: 45, intellect: 70, charisma: 55, endurance: 45, composure: 55, ambition: 50, faith: 45, health: 70 },
  ombre: { odm: 85, melee: 85, aim: 85, command: 60, tactics: 70, intellect: 65, charisma: 45, endurance: 75, composure: 75, ambition: 60, faith: 10, health: 75 },
};
const attrs = (profile, over = {}) => ({ ...PROFILES[profile], ...over });
const texts = {};
let seed = 101;
const C = (o) => {
  const id = `char_${o.id}`;
  const out = {
    id,
    name: o.name,
    ...(o.display ? { display_name: o.display } : {}),
    active_from: o.from ?? 845,
    ...(o.until ? { active_until: o.until } : {}),
    ...(o.death ? { death_event: o.death } : {}),
    faction: o.faction ?? "paradis",
    ...(o.org ? { org: `org_${o.org}` } : {}),
    rank_key: `rank.${o.rank}`,
    roles: o.roles ?? [],
    attributes: attrs(o.profile, o.attrs),
    traits: (o.traits ?? []).map((t) => `trait_${t}`),
    agenda: o.agenda ?? "pragmatique",
    honesty: o.honesty ?? 60,
    fame: o.fame ?? 20,
    relations: (o.rel ?? []).map(([to, type, strength, canon]) => ({ to: `char_${to}`, type, strength, canon: canon ?? "A" })),
    ...(o.hidden ? { hidden: o.hidden } : {}),
    portrait: { seed: seed++, archetype: o.portrait ?? "officier" },
    bio_key: `bio.${o.id}`,
    canon: o.canon ?? "C",
    notes_canon: o.note,
  };
  texts[`bio.${o.id}`] = o.bio;
  return out;
};

const chars = [
  // ——— Commandement suprême et Cabinet ———
  C({ id: "darius_zackly", name: "Darius Zackly", org: "cabinet", rank: "commandant_en_chef", profile: "commandant", attrs: { odm: 30, melee: 30, charisma: 70, ambition: 55 }, until: 854, traits: ["pragmatique", "cynique", "methodique"], agenda: "pragmatique", honesty: 55, fame: 70, portrait: "officier",
    rel: [["erwin_smith", "tension", -20, "C"]], note: "Commandant en chef ; assassiné en 854 (11 §3). Graphie « Dhalis » selon les versions [?]. Incarnation du joueur dans le bac à sable 850 [A].",
    bio: "Commandant en chef des trois corps. Il arbitre entre la Garnison, la Brigade et le Corps de Reconnaissance, et tient les cordons du budget." }),
  C({ id: "friedrich_amsel", name: "Friedrich Amsel", org: "cabinet", rank: "secretaire", profile: "civil", traits: ["bureaucrate", "methodique", "discret"], agenda: "conservateur", honesty: 65, canon: "A", portrait: "civil",
    note: "Secrétaire royal, chef de cabinet : personnage de remplissage (08 §4.1).", bio: "Secrétaire royal. Il tient l'agenda du Cabinet et filtre ce qui parvient au commandant en chef." }),
  C({ id: "albrecht_mohr", name: "Albrecht Mohr", org: "cabinet", rank: "chancelier", profile: "noble", traits: ["rigide", "soupconneux"], agenda: "conservateur", honesty: 45, canon: "A", portrait: "noble",
    note: "Personnage de remplissage (08 §4.1 : chancelier).", bio: "Chancelier chargé des affaires intérieures. Il préfère l'ordre aux explications." }),
  C({ id: "hartmut_kessel", name: "Hartmut Kessel", org: "cabinet", rank: "magistrat", profile: "civil", attrs: { intellect: 78 }, traits: ["integre", "rigide"], agenda: "reformateur", honesty: 80, canon: "A", portrait: "civil",
    note: "Magistrat en chef : personnage de remplissage (08 §4.1).", bio: "Magistrat en chef. Il défend la procédure, y compris quand elle gêne." }),
  C({ id: "theodor_brahm", name: "Theodor Brahm", org: "cabinet", rank: "conseiller", profile: "civil", attrs: { charisma: 60 }, traits: ["loyal", "bon_vivant"], agenda: "pragmatique", honesty: 85, canon: "A", portrait: "civil",
    rel: [["darius_zackly", "amitie", 70]], note: "Confident : personnage de remplissage (08 §2, rôle 17).", bio: "Vieil ami du commandant en chef, sans titre officiel. On l'écoute parce qu'il ne demande rien." }),
  // ——— Corps de Reconnaissance ———
  C({ id: "erwin_smith", name: "Erwin Smith", org: "survey_corps", rank: "commandant", profile: "commandant", until: 850, death: "evt_850_erwin_charge", traits: ["meneur_ne", "joueur", "obstine"], agenda: "reformateur", honesty: 55, fame: 75, portrait: "officier",
    rel: [["levi_ackerman", "loyaute", 85, "C"], ["hange_zoe", "respect", 70, "C"], ["dot_pixis", "respect", 50, "C"], ["darius_zackly", "tension", -20, "C"], ["nile_dok", "amitie", 40, "C"]],
    note: "Mort à Shiganshina (850, E41) (11 §3). Relations : 07 §10 (Nile : amis d'enfance).", bio: "Commandant du Corps de Reconnaissance. Il mise gros et le sait ; ses pertes lui valent autant d'ennemis que de fidèles." }),
  C({ id: "hange_zoe", name: "Hange Zoë", org: "survey_corps", rank: "chef_section", profile: "savant", attrs: { odm: 70 }, until: 854, traits: ["curieux", "impulsif", "erudit"], agenda: "reformateur", honesty: 75, fame: 50, portrait: "officier",
    rel: [["erwin_smith", "respect", 70, "C"], ["moblit_berner", "amitie", 60]], note: "14ᵉ commandante après Erwin ; meurt en 854 (11 §3). Graphie « Hanji » [?]. death_event (E60) à relier.", bio: "Chef de section et scientifique du Corps. Les Titans l'intéressent davantage que les règlements." }),
  C({ id: "levi_ackerman", name: "Levi Ackerman", org: "survey_corps", rank: "capitaine", profile: "elite", attrs: { odm: 98, melee: 95, command: 70, composure: 85 }, traits: ["froid", "ackerman", "stoique"], agenda: "pragmatique", honesty: 80, fame: 65, portrait: "officier",
    rel: [["erwin_smith", "loyaute", 90, "C"], ["petra", "loyaute", 50], ["oluo", "loyaute", 45], ["eld", "loyaute", 45], ["gunther", "loyaute", 45]], note: "Capitaine d'élite (07 P06) ; aucune date de sortie dans les spécifications.", bio: "Capitaine d'une escouade d'élite. Peu de mots, peu de pertes évitables." }),
  C({ id: "mike_zacharias", name: "Mike Zacharias", org: "survey_corps", rank: "chef_escouade", profile: "elite", attrs: { command: 65 }, until: 850, death: "evt_850_wall_rose_invasion", traits: ["solitaire", "loyal"], agenda: "pragmatique", honesty: 70, fame: 35, portrait: "officier",
    rel: [["erwin_smith", "loyaute", 70], ["nanaba", "respect", 50], ["gelgar", "respect", 40]], note: "Meurt pendant l'invasion de Wall Rose (E24), pas à Utgard (11 §3 + errata).", bio: "Chef d'escouade et second du commandant. Il sent venir les ennuis avant les autres." }),
  C({ id: "nanaba", name: "Nanaba", org: "survey_corps", rank: "soldat_elite", profile: "elite", until: 850, death: "evt_850_utgard_battle", traits: ["devoue", "methodique"], agenda: "pragmatique", honesty: 70, portrait: "soldat",
    rel: [["mike_zacharias", "respect", 55]], note: "Meurt à Utgard (850) (11 §3).", bio: "Soldate d'élite de l'escouade de Mike." }),
  C({ id: "gelgar", name: "Gelgar", org: "survey_corps", rank: "soldat_elite", profile: "elite", until: 850, death: "evt_850_utgard_battle", traits: ["bon_vivant", "temeraire"], agenda: "pragmatique", honesty: 60, portrait: "soldat",
    rel: [["mike_zacharias", "respect", 50]], note: "Meurt à Utgard (850) (11 §3).", bio: "Soldat d'élite de l'escouade de Mike." }),
  C({ id: "moblit_berner", name: "Moblit Berner", org: "survey_corps", rank: "soldat_elite", profile: "savant", attrs: { intellect: 75, odm: 65 }, traits: ["devoue", "anxieux"], agenda: "pragmatique", honesty: 80, portrait: "soldat",
    rel: [["hange_zoe", "loyaute", 75]], note: "Adjoint de Hange (08 §4.1) ; date de sortie [?] (11 §9).", bio: "Adjoint de Hange. Il note tout et s'inquiète du reste." }),
  C({ id: "petra", name: "Petra", org: "survey_corps", rank: "soldat_elite", profile: "elite", until: 850, death: "evt_850_special_squad_loss", traits: ["devoue", "compatissant"], agenda: "pragmatique", honesty: 80, portrait: "soldat",
    rel: [["levi_ackerman", "loyaute", 80]], note: "Escouade spéciale ; mort en 850 (expédition 57) [?] (11 §3). Nom de famille non donné dans les spécifications.", bio: "Membre de l'escouade spéciale du capitaine Levi." }),
  C({ id: "oluo", name: "Oluo", org: "survey_corps", rank: "soldat_elite", profile: "elite", until: 850, death: "evt_850_special_squad_loss", traits: ["ambitieux", "temeraire"], agenda: "pragmatique", honesty: 55, portrait: "soldat",
    rel: [["levi_ackerman", "loyaute", 75]], note: "Escouade spéciale ; mort en 850 [?] (11 §3). Nom de famille non donné.", bio: "Membre de l'escouade spéciale du capitaine Levi." }),
  C({ id: "eld", name: "Eld", org: "survey_corps", rank: "soldat_elite", profile: "elite", attrs: { command: 60 }, until: 850, death: "evt_850_special_squad_loss", traits: ["methodique", "loyal"], agenda: "pragmatique", honesty: 75, portrait: "soldat",
    rel: [["levi_ackerman", "loyaute", 75]], note: "Escouade spéciale ; mort en 850 [?] (11 §3). Nom de famille non donné.", bio: "Membre de l'escouade spéciale du capitaine Levi." }),
  C({ id: "gunther", name: "Gunther", org: "survey_corps", rank: "soldat_elite", profile: "elite", until: 850, death: "evt_850_special_squad_loss", traits: ["discret", "devoue"], agenda: "pragmatique", honesty: 75, portrait: "soldat",
    rel: [["levi_ackerman", "loyaute", 75]], note: "Escouade spéciale ; mort en 850 [?] (11 §3). Nom de famille non donné.", bio: "Membre de l'escouade spéciale du capitaine Levi." }),
  C({ id: "elise_brandt", name: "Elise Brandt", org: "survey_corps", rank: "major", profile: "officier", attrs: { intellect: 72, tactics: 65 }, traits: ["methodique", "prudent"], agenda: "pragmatique", honesty: 75, canon: "A",
    note: "Intendance (07 GP19, 08 §4.1) : personnage de remplissage.", bio: "Major chargée de l'intendance. Elle compte le gaz, les lames et les jours qui restent." }),
  C({ id: "ilse_kruger_moll", name: "Ilse Kruger-Moll", org: "survey_corps", rank: "major", profile: "civil", attrs: { intellect: 80 }, traits: ["compatissant", "methodique"], agenda: "reformateur", honesty: 85, canon: "A", portrait: "civil",
    note: "Médecin (07 GP21, 08 §4.1) : personnage de remplissage.", bio: "Major médecin. Elle tient le registre des blessés et celui des lits vides." }),
  C({ id: "joris_haller", name: "Joris Haller", org: "survey_corps", rank: "capitaine", profile: "officier", attrs: { odm: 70, tactics: 70 }, traits: ["curieux", "temeraire"], agenda: "reformateur", honesty: 65, canon: "A",
    note: "Éclaireur en chef (07 GP22) : personnage de remplissage.", bio: "Capitaine éclaireur et cartographe." }),
  // ——— Garnison ———
  C({ id: "dot_pixis", name: "Dot Pixis", org: "garrison", rank: "commandant_sud", profile: "commandant", attrs: { odm: 40, ambition: 35 }, until: 854, traits: ["pragmatique", "bon_vivant", "veteran_breches"], agenda: "pragmatique", honesty: 65, fame: 60,
    rel: [["erwin_smith", "respect", 50, "C"]], note: "Responsable de la Garnison du Sud ; meurt en 854 (11 §3). death_event (E58) à relier.", bio: "Commandant de la Garnison du Sud. Il décide vite, et boit en décidant." }),
  C({ id: "hannes", name: "Hannes", org: "garrison", rank: "officier", profile: "officier", until: 850, traits: ["bon_vivant", "veteran_breches", "devoue"], agenda: "pragmatique", honesty: 70, portrait: "soldat",
    note: "Officier de Garnison ; mort en 850, arc de l'invasion de Wall Rose (11 §3).", bio: "Officier de la Garnison, vétéran de la chute de Shiganshina." }),
  C({ id: "kitz_weilman", name: "Kitz Weilman", org: "garrison", rank: "capitaine", profile: "officier", attrs: { composure: 35 }, traits: ["anxieux", "rigide"], agenda: "conservateur", honesty: 55,
    note: "Officier de Garnison ; rôle exact [?] (07 GP12).", bio: "Officier de la Garnison, très attaché au règlement." }),
  C({ id: "ian_dietrich", name: "Ian Dietrich", org: "garrison", rank: "capitaine", profile: "officier", traits: ["methodique", "compatissant"], agenda: "pragmatique", honesty: 75, note: "Officier de Garnison (07 GP13).", bio: "Officier de la Garnison, apprécié de ses hommes." }),
  C({ id: "rico_brzenska", name: "Rico Brzenska", org: "garrison", rank: "capitaine", profile: "officier", attrs: { aim: 70 }, traits: ["froid", "methodique"], agenda: "pragmatique", honesty: 75, note: "Officier de Garnison, artillerie (07 GP14).", bio: "Officière de la Garnison, spécialiste de l'artillerie." }),
  C({ id: "ruben_tauber", name: "Ruben Tauber", org: "garrison", rank: "capitaine", profile: "officier", attrs: { aim: 72 }, traits: ["methodique"], agenda: "militariste", honesty: 60, canon: "A", note: "Artillerie de Garnison (07 GP20) : personnage de remplissage.", bio: "Capitaine d'artillerie de la Garnison." }),
  C({ id: "brune_aldous", name: "Brune Aldous", org: "garrison", rank: "commandant", profile: "officier", attrs: { command: 70 }, traits: ["prudent", "bureaucrate"], agenda: "conservateur", honesty: 55, canon: "A", note: "Réserve de Rose (07 GP25) : personnage de remplissage.", bio: "Commandant de la réserve de Rose." }),
  C({ id: "maren_voss", name: "Maren Voss", org: "garrison", rank: "colonel", profile: "officier", attrs: { command: 68 }, traits: ["temeraire", "loyal"], agenda: "militariste", honesty: 65, canon: "A", note: "Cavalerie (07 GP23) : personnage de remplissage.", bio: "Colonel de cavalerie ; elle connaît chaque haras de l'intérieur." }),
  C({ id: "wendel_sauer", name: "Wendel Sauer", org: "garrison", rank: "maitre_murs", profile: "civil", attrs: { intellect: 74 }, traits: ["methodique", "prudent"], agenda: "conservateur", honesty: 70, canon: "A", portrait: "civil",
    note: "Architecte des murs (08 §2, rôle 14) : personnage de remplissage.", bio: "Maître des murs. Il connaît chaque fissure de Rose." }),
  // ——— Brigade Militaire ———
  C({ id: "nile_dok", name: "Nile Dok", org: "military_police", rank: "commandant", profile: "commandant", attrs: { odm: 50, charisma: 60, ambition: 60 }, until: 854, traits: ["pragmatique", "prudent"], agenda: "conservateur", honesty: 55, fame: 45,
    rel: [["erwin_smith", "amitie", 40, "C"]], note: "Commandant de la Brigade ; meurt en 854 (11 §3). Amis d'enfance avec Erwin (07 §10).", bio: "Commandant de la Brigade Militaire. Il couvre beaucoup et en sait davantage." }),
  C({ id: "marlowe_freudenberg", name: "Marlowe Freudenberg", org: "military_police", rank: "soldat", profile: "officier", attrs: { command: 40 }, traits: ["idealiste", "integre"], agenda: "reformateur", honesty: 85, portrait: "soldat", note: "Officier de la Brigade (07 GP15).", bio: "Jeune soldat de la Brigade, convaincu qu'elle peut être réformée de l'intérieur." }),
  C({ id: "aldric_vane", name: "Aldric Vane", org: "military_police", rank: "colonel", profile: "officier", traits: ["ambitieux", "corrompu"], agenda: "opportuniste", honesty: 30, canon: "A", note: "Chef de secteur Sina, garde royale (07 GP18) : personnage de remplissage.", bio: "Colonel du secteur de Sina. Il connaît le prix de chaque faveur." }),
  C({ id: "kaspar_lind", name: "Kaspar Lind", org: "military_police", rank: "major", profile: "officier", attrs: { intellect: 75 }, traits: ["soupconneux", "discret"], agenda: "conservateur", honesty: 45, canon: "A", note: "Chef du renseignement (08 §2, rôle 3) : personnage de remplissage.", bio: "Major de la Brigade chargé des informateurs." }),
  // ——— Corps d'Entraînement et 104ᵉ promotion ———
  C({ id: "keith_shadis", name: "Keith Shadis", org: "training_corps", rank: "instructeur_chef", profile: "officier", attrs: { command: 70, composure: 55 }, traits: ["rigide", "veteran_breches"], agenda: "conservateur", honesty: 70, fame: 30,
    note: "Instructeur en chef (07 P07) ; date de sortie [?] (11 §3).", bio: "Instructeur en chef. Il forme les recrues comme on trempe l'acier." }),
  C({ id: "anselm_koch", name: "Anselm Koch", org: "training_corps", rank: "lieutenant", profile: "elite", traits: ["methodique"], agenda: "pragmatique", honesty: 70, canon: "A", note: "Instructeur ODM (07 GP24) : personnage de remplissage.", bio: "Lieutenant instructeur d'ODM." }),
  ...[
    ["eren_yeager", "Eren Yeager", ["obstine", "impulsif", "idealiste"], { odm: 55, composure: 35 }, { titan: "assaillant_fondateur" }, "Porteur de l'Assaillant et du Fondateur depuis 845 (11 §4), sans le savoir en 850 : secret."],
    ["mikasa_ackerman", "Mikasa Ackerman", ["ackerman", "stoique", "devoue"], { odm: 75, melee: 70 }, null, "Lignée Ackerman (01 §1)."],
    ["armin_arlert", "Armin Arlert", ["erudit", "curieux", "anxieux"], { intellect: 85, endurance: 50 }, null, "Hérite du Colossal en 850 (E42) : hors de la fenêtre de départ."],
    ["jean_kirstein", "Jean Kirstein", ["pragmatique", "ambitieux"], { command: 45 }, null, ""],
    ["connie_springer", "Connie Springer", ["bon_vivant", "loyal"], {}, null, "Originaire de Ragako (événement E25)."],
    ["sasha_blouse", "Sasha Blouse", ["impulsif", "devoue"], { aim: 75 }, null, "Sortie en 854 [?] (11 §3)."],
    ["historia_reiss", "Historia Reiss", ["compatissant", "discret"], {}, { true_name: "Historia Reiss" }, "Connue sous le nom de Krista Lenz en 850 ; identité révélée à E27 (12) : secret."],
    ["ymir", "Ymir", ["cynique", "solitaire"], {}, { titan: "machoire" }, "Porteuse de la Mâchoire (11 §4) : secret ; ne pas confondre avec Ymir Fritz. Sortie entre 850 et 854 [?]."],
    ["reiner_braun", "Reiner Braun", ["meneur_ne", "loyal"], { command: 50, endurance: 80 }, { faction: "marley", titan: "cuirasse" }, "Guerrier de Marley infiltré (01 §2) : secret."],
    ["bertholdt_hoover", "Bertholdt Hoover", ["discret", "anxieux"], { odm: 70 }, { faction: "marley", titan: "colossal" }, "Guerrier de Marley infiltré : secret. Mort en 850 (E42, mangé par Armin) (11 §3, fiabilité moyenne)."],
    ["annie_leonhart", "Annie Leonhart", ["froid", "solitaire"], { melee: 80 }, { faction: "marley", titan: "feminin" }, "Guerrière de Marley infiltrée : secret."],
  ].map(([id, name, traits, a, hidden, note]) =>
    C({ id, name, ...(id === "historia_reiss" ? { display: "Krista Lenz" } : {}), org: "training_corps", rank: "cadet", profile: "cadet", attrs: a, from: 847, ...(id === "bertholdt_hoover" ? { until: 850, death: "evt_850_serum_choice" } : {}), ...(id === "sasha_blouse" ? { until: 854 } : {}), traits, agenda: "pragmatique", honesty: 60, portrait: "cadet", ...(hidden ? { hidden } : {}),
      note: `Recrue de la 104ᵉ promotion (recrutement ≈ 847 [?], E08 ; remise des diplômes en 850, E09). ${note}`.trim(), bio: "Recrue de la 104ᵉ promotion, à quelques semaines de la remise des diplômes." }),
  ),
  // ——— Culte, cour, guildes, ville souterraine ———
  C({ id: "pasteur_nick", name: "Pasteur Nick", org: "culte", rank: "pasteur", profile: "clerc", traits: ["fanatique_mur", "discret"], agenda: "religieux", honesty: 40, fame: 30, portrait: "clerc",
    note: "Culte des Murs (08 §4.1) ; date de sortie [?] (11 §9).", bio: "Pasteur du Culte des Murs. Il sait des choses qu'il refuse de dire." }),
  C({ id: "rod_reiss", name: "Rod Reiss", org: "cour", rank: "noble", profile: "noble", until: 850, death: "evt_850_rod_reiss_titan", traits: ["ambitieux", "discret", "soupconneux"], agenda: "conservateur", honesty: 25, fame: 40, portrait: "noble",
    note: "Seul survivant de la famille royale en 845 (11 §1) ; mort en 850 (E35). Son rang réel est un secret de la cour.", bio: "Noble influent de l'intérieur de Sina, proche de la cour." }),
  C({ id: "margarethe_von_alt", name: "Margarethe von Alt", org: "cour", rank: "noble", profile: "noble", traits: ["ambitieux", "diplomate"], agenda: "conservateur", honesty: 40, canon: "A", portrait: "noble",
    note: "Représentante de la noblesse au Cabinet (08 §4.1) : personnage de remplissage.", bio: "Porte-parole des grandes familles au Cabinet." }),
  C({ id: "ida_lorenz", name: "Ida Lorenz", org: "cour", rank: "archiviste", profile: "civil", attrs: { intellect: 80 }, traits: ["erudit", "discret"], agenda: "pragmatique", honesty: 70, canon: "A", portrait: "civil",
    note: "Archiviste royale (08 §2, rôle 16) : personnage de remplissage.", bio: "Archiviste royale. Les registres qu'elle garde ne sont pas tous ouverts." }),
  C({ id: "ottilie_brandauer", name: "Ottilie Brandauer", org: "guildes", rank: "redactrice", profile: "civil", attrs: { charisma: 72 }, traits: ["opportuniste", "charismatique"], agenda: "opportuniste", honesty: 45, canon: "A", portrait: "civil",
    note: "Presse et gazette (08 §2, rôle 10) : personnage de remplissage.", bio: "Rédactrice de la gazette de Mitras ; elle écrit pour qui la lit." }),
  C({ id: "conrad_vehl", name: "Conrad Vehl", org: "guildes", rank: "delegue", profile: "civil", attrs: { intellect: 75, ambition: 70 }, traits: ["ambitieux", "corrompu"], agenda: "opportuniste", honesty: 35, canon: "A", portrait: "civil",
    note: "Délégué des guildes, trésorier (08 §4.1) : personnage de remplissage.", bio: "Délégué des guildes marchandes et trésorier du Cabinet." }),
  C({ id: "kenny_ackerman", name: "Kenny Ackerman", faction: "ville_souterraine", rank: "inconnu", profile: "ombre", until: 850, death: "evt_850_rod_reiss_titan", traits: ["brutal", "cynique", "ackerman"], agenda: "opportuniste", honesty: 20, fame: 40, portrait: "ombre",
    note: "Sortie en 850, arc du gouvernement royal ; death_event = E35 (errata Q2). Affiliation exacte [?].", bio: "Figure redoutée de la ville souterraine. Son nom circule plus que son visage." }),
];

fs.writeFileSync("data/characters/paradis.json", JSON.stringify(chars, null, 2) + "\n");
const ranks = {
  commandant_en_chef: "Commandant en chef", secretaire: "Secrétaire royal", chancelier: "Chancelier", magistrat: "Magistrat en chef", conseiller: "Conseiller",
  commandant: "Commandant", chef_section: "Chef de section", capitaine: "Capitaine", chef_escouade: "Chef d'escouade", soldat_elite: "Soldat d'élite", major: "Major",
  commandant_sud: "Commandant de la Garnison du Sud", officier: "Officier", colonel: "Colonel", maitre_murs: "Maître des murs", soldat: "Soldat",
  instructeur_chef: "Instructeur en chef", lieutenant: "Lieutenant", cadet: "Recrue", pasteur: "Pasteur", noble: "Noble", archiviste: "Archiviste royale",
  redactrice: "Rédactrice", delegue: "Délégué des guildes", inconnu: "—",
};
for (const [k, v] of Object.entries(ranks)) texts[`rank.${k}`] = v;
fs.writeFileSync(process.argv[2] ?? "/dev/stdout", JSON.stringify(texts, null, 2) + "\n");
console.error(`${chars.length} personnages (${chars.filter((c) => c.canon === "C").length} canon, ${chars.filter((c) => c.canon === "A").length} de remplissage)`);
