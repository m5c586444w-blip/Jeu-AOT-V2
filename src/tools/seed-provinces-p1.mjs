// Script de génération (conservé pour traçabilité) : node src/tools/seed-provinces-p1.mjs
// Produit data/provinces/paradis.json (74 provinces du fichier 06 §1) et les textes fr associés.
// Les JSON produits sont la source : ce script ne sert qu'à régénérer la saisie initiale.
import fs from "node:fs";

// [code, id, nom, description, terrain, pop, ressource clé, canon, note canon, extras]
const O = (code, id, name, desc, terrain, density, visibility) => ({ code, id, name, desc, terrain, pop: 0, key: "none", canon: "A", kind: "outre", region: "outre_murs", wall: null, extra: { titan_density: density, visibility } });
const SEG = (code, id, name, desc, wall, canon = "A", note) => ({ code, id, name, desc, terrain: "mur", pop: 0, key: "none", canon, note, kind: "segment", region: `mur_${wall}`, wall });
const P = (code, id, name, desc, terrain, pop, key, canon, region, wall, note) => ({ code, id, name, desc, terrain, pop, key, canon, note, kind: "province", region, wall });

const rows = [
  O("O01", "prov_plaines_meurtries", "Plaines Meurtries", "Zone de manœuvre principale hors de Maria, au sud.", "plaine", 0.8, "partielle"),
  O("O02", "prov_ruines_premier_cordon", "Ruines du Premier Cordon", "Ruines d'anciens villages ; dépôts abandonnés à fouiller.", "ruines", 0.7, "partielle"),
  O("O03", "prov_riviere_des_cendres", "Rivière des Cendres", "Ligne naturelle et gués ; les traversées attirent les Titans.", "fleuve", 0.5, "inexplore"),
  O("O04", "prov_falaises_cote_sud", "Falaises de la Côte Sud", "Premier contact possible avec l'océan (scénario 850 et suivants).", "cote", 0.4, "inexplore"),
  O("O05", "prov_marais_brumeux", "Marais Brumeux", "Visibilité réduite ; les chevaux y sont ralentis.", "marais", 0.6, "inexplore"),
  O("O06", "prov_foret_morte", "Forêt Morte", "Ancrages abondants, Titans embusqués.", "foret", 0.6, "inexplore"),
  O("O07", "prov_steppe_orientale", "Steppe Orientale", "Longues distances ; terrain favorable à la formation en éventail.", "plaine", 0.7, "partielle"),
  O("O08", "prov_cote_est", "Côte Est", "Site possible d'un port.", "cote", 0.3, "inexplore"),
  O("O09", "prov_plateau_du_nord", "Plateau du Nord", "Vue dominante ; poste de guet possible.", "plateau", 0.5, "inexplore"),
  O("O10", "prov_vallee_oubliee", "Vallée Oubliée", "Concentration anormale de Titans.", "vallee", 0.9, "inexplore"),

  SEG("M01", "prov_maria_nord", "Maria-Nord", "Garnison réduite.", "maria"),
  SEG("M02", "prov_maria_nord_est", "Maria-Nord-Est", "Poste de guet.", "maria"),
  SEG("M03", "prov_maria_est", "Maria-Est", "Route des convois.", "maria"),
  SEG("M04", "prov_maria_sud_est", "Maria-Sud-Est", "Proche du district sud.", "maria"),
  SEG("M05", "prov_maria_sud", "Maria-Sud — porte de Shiganshina", "Point de brèche canon de 845.", "maria", "A", "Découpage du mur en segments = adaptation (06 §1.2) ; la porte de Shiganshina et la brèche de 845 sont canon."),
  SEG("M06", "prov_maria_sud_ouest", "Maria-Sud-Ouest", "Zone minière adjacente.", "maria"),
  SEG("M07", "prov_maria_ouest", "Maria-Ouest", "Isolé, ravitaillement difficile.", "maria"),
  SEG("M08", "prov_maria_nord_ouest", "Maria-Nord-Ouest", "Poste de signal.", "maria"),

  P("R01", "prov_shiganshina", "Shiganshina", "District sud ; porte ; maison des Yeager et son sous-sol.", "urbain", 4, "nourriture", "C", "anneau_maria", "maria", "District sud de Wall Maria (fichiers 01 §3.1, 06 §1.3, 11 §2)."),
  P("R02", "prov_faubourgs_shiganshina", "Faubourgs de Shiganshina", "Marché, entrepôts, quartiers pauvres.", "urbain", 3, "main_oeuvre", "A", "anneau_maria", "maria"),
  P("R03", "prov_plaines_interieures_maria_sud", "Plaines intérieures de Maria — Sud", "Terres agricoles.", "plaine", 3, "nourriture", "A", "anneau_maria", "maria"),
  P("R04", "prov_bourg_minier_maria", "Bourg minier de Maria", "Nom fictif ; remplace « Raiberg », non confirmé dans les sources.", "urbain", 2, "acier", "A", "anneau_maria", "maria", "Raiberg retiré (11 §2) : toponyme de remplissage."),
  P("R05", "prov_hameaux_ouest_maria", "Hameaux de l'Ouest de Maria", "Dispersés, vulnérables.", "rural", 1, "nourriture", "A", "anneau_maria", "maria"),
  P("R06", "prov_foret_arbres_geants", "Forêt des Arbres Géants", "Arbres d'environ 80 m ; terrain de grands combats.", "foret", 0, "bois", "C", "anneau_maria", "maria", "Existence canon ; localisation exacte [?] (11 §9)."),
  P("R07", "prov_plaines_cerealieres_sud", "Plaines céréalières du Sud", "Grenier de Paradis.", "plaine", 3, "nourriture", "A", "anneau_maria", "maria"),
  P("R08", "prov_plaines_du_nord", "Plaines du Nord", "Élevage, chevaux.", "plaine", 2, "nourriture", "A", "anneau_maria", "maria"),
  P("R09", "prov_collines_minieres", "Collines minières", "Mines de fer.", "collines", 2, "acier", "A", "anneau_maria", "maria"),
  P("R10", "prov_ville_usine", "Ville-usine et cavernes de glace", "Cavernes sous la ville-usine : source du gaz d'ODM.", "urbain", 2, "pierre_glace", "C", "anneau_maria", "maria", "Existence canon (11 §6) ; localisation exacte [?] (11 §9)."),
  P("R11", "prov_haras_maria", "Haras de Maria", "Élevage militaire.", "rural", 1, "chevaux", "A", "anneau_maria", "maria"),
  P("R12", "prov_vallee_du_moulin", "Vallée du Moulin", "Meunerie, convois.", "rural", 2, "nourriture", "A", "anneau_maria", "maria"),
  P("R13", "prov_carrefour_du_sud", "Carrefour du Sud", "Nœud routier.", "plaine", 1, "commerce", "A", "anneau_maria", "maria"),
  P("R14", "prov_lac_des_reflets", "Lac des Reflets", "Eau douce, pêche.", "lac", 1, "peche", "A", "anneau_maria", "maria"),
  P("R15", "prov_fort_avance_maria", "Fort avancé de Maria", "Dépôt de gaz avancé.", "fort", 1, "none", "A", "anneau_maria", "maria"),
  P("R16", "prov_hameaux_est", "Hameaux de l'Est", "Dispersés, vulnérables.", "rural", 2, "nourriture", "A", "anneau_maria", "maria"),
  P("R17", "prov_monts_brumeux", "Monts Brumeux", "Carrière, refuge.", "montagne", 0, "pierre", "A", "anneau_maria", "maria"),
  P("R18", "prov_gorge_du_silence", "Gorge du Silence", "Embuscades, terrain tactique.", "vallee", 0, "none", "A", "anneau_maria", "maria"),
  P("R19", "prov_vergers_ouest", "Vergers de l'Ouest", "Fruits, cidre.", "rural", 2, "nourriture", "A", "anneau_maria", "maria"),
  P("R20", "prov_relais_poste_maria", "Relais de poste de Maria", "Rapports plus rapides.", "rural", 1, "information", "A", "anneau_maria", "maria"),

  SEG("W01", "prov_rose_nord", "Rose-Nord", "Tours d'observation.", "rose"),
  SEG("W02", "prov_rose_nord_est", "Rose-Nord-Est", "Proche de Karanes.", "rose"),
  SEG("W03", "prov_rose_est", "Rose-Est — porte de Karanes", "Porte du district de Karanes.", "rose", "C", "Porte du district de Karanes (06 §1.4) ; découpage en segments = adaptation."),
  SEG("W04", "prov_rose_sud_est", "Rose-Sud-Est", "Réserve de gaz.", "rose"),
  SEG("W05", "prov_rose_sud", "Rose-Sud — porte de Trost", "Porte de Trost ; brèche de 850.", "rose", "C", "Porte de Trost, brèche de 850 (06 §1.4) ; découpage en segments = adaptation."),
  SEG("W06", "prov_rose_sud_ouest", "Rose-Sud-Ouest", "Zone de garnison.", "rose"),
  SEG("W07", "prov_rose_ouest", "Rose-Ouest", "Proche de Krolva.", "rose", "A", "Errata utilisateur : proche de Krolva (et non d'Ehrmich, district de Sina)."),
  SEG("W08", "prov_rose_nord_ouest", "Rose-Nord-Ouest", "Poste d'artillerie.", "rose"),

  P("S01", "prov_trost", "Trost", "District sud du Mur Rose ; QG de la Garnison ; brèche de 850.", "urbain", 5, "nourriture", "C", "anneau_rose", "rose", "District sud de Wall Rose ; brèche de 850 (06 §1.5, 11 §2)."),
  P("S02", "prov_karanes", "Karanes", "District est ; départ des expéditions.", "urbain", 4, "commerce", "C", "anneau_rose", "rose", "Transcrit « Calaneth » dans certaines versions (01 §3.1)."),
  P("S03", "prov_utopia", "Utopia", "District nord du Mur Rose.", "urbain", 3, "commerce", "C", "anneau_rose", "rose"),
  P("S04", "prov_krolva", "Krolva", "District ouest du Mur Rose.", "urbain", 3, "artisanat", "C", "anneau_rose", "rose"),
  P("S05", "prov_ragako", "Ragako", "Village du sud de l'intérieur de Rose ; détruit en 850.", "rural", 1, "none", "C", "anneau_rose", "rose", "Village du sud de l'intérieur de Rose (11 §2)."),
  P("S06", "prov_utgard", "Château d'Utgard", "Château abandonné près du périmètre intérieur de Rose ; détruit en 850.", "fort", 0, "none", "C", "anneau_rose", "rose", "Château abandonné dans Wall Rose, près du périmètre intérieur ; détruit en 850 (11 §1, §2). Position exacte sur la carte [?]."),
  P("S07", "prov_qg_corps", "QG du Corps de Reconnaissance", "Château ancien ; laboratoires, cachots, écuries.", "fort", 1, "equipement", "C", "anneau_rose", "rose", "Existence canon ; localisation exacte [?] (11 §9)."),
  P("S08", "prov_camp_entrainement", "Camp d'entraînement", "Corps d'Entraînement ; recrutement annuel.", "militaire", 2, "recrues", "C", "anneau_rose", "rose", "Existence canon ; localisation exacte [?] (11 §9)."),
  P("S09", "prov_champs_du_centre", "Champs du Centre", "Grenier de Rose.", "plaine", 3, "nourriture", "A", "anneau_rose", "rose"),
  P("S10", "prov_dauper", "Dauper", "Petit village du sud de l'intérieur de Rose.", "rural", 1, "chasse", "C", "anneau_rose", "rose", "Village du sud de l'intérieur de Rose (11 §2)."),
  P("S11", "prov_forges_rose", "Forges de Rose", "Atelier d'ODM principal.", "urbain", 2, "acier", "A", "anneau_rose", "rose"),
  P("S12", "prov_poudriere_rose", "Poudrière de Rose", "Production d'explosifs.", "urbain", 1, "poudre", "A", "anneau_rose", "rose"),
  P("S13", "prov_jinae", "Jinae", "Ville du sud de l'intérieur de Rose.", "urbain", 2, "nourriture", "C", "anneau_rose", "rose", "Sud de l'intérieur de Rose (11 §2)."),
  P("S14", "prov_relais_ferroviaire", "Relais ferroviaire (en projet)", "Chantier envisagé ; débloqué par la technologie.", "urbain", 1, "logistique", "A", "anneau_rose", "rose", "Chemin de fer vers 852–853 : source secondaire [?]."),

  SEG("N01", "prov_sina_nord", "Sina-Nord", "Protection de la capitale.", "sina"),
  SEG("N02", "prov_sina_nord_est", "Sina-Nord-Est", "Garnison de prestige.", "sina"),
  SEG("N03", "prov_sina_est", "Sina-Est", "Porte de commerce.", "sina"),
  SEG("N04", "prov_sina_sud", "Sina-Sud", "Porte principale.", "sina"),
  SEG("N05", "prov_sina_ouest", "Sina-Ouest", "Postes d'élite.", "sina"),
  SEG("N06", "prov_sina_nord_ouest", "Sina-Nord-Ouest", "Archives murales.", "sina"),

  P("I01", "prov_mitras", "Mitras", "Capitale : cour royale, Cabinet, cathédrale.", "urbain", 5, "commerce", "C", "interieur_sina", "sina", "Capitale, dans Wall Sina (01 §3.1)."),
  P("I02", "prov_palais_royal", "Palais royal", "Faux roi, salles, chapelle privée.", "fort", 1, "none", "C", "interieur_sina", "sina", "Existence canon ; détails [?] (06 §1.7)."),
  P("I03", "prov_stohess", "Stohess", "District est de Sina ; Brigade Militaire.", "urbain", 4, "commerce", "C", "interieur_sina", "sina"),
  P("I04", "prov_orvud", "Orvud", "District nord de Sina.", "urbain", 3, "commerce", "C", "interieur_sina", "sina", "Ravagé par le Titan de Rod Reiss en 850 (11 §2)."),
  P("I05", "prov_yarckel", "Yarckel", "District ouest de Sina.", "urbain", 3, "artisanat", "C", "interieur_sina", "sina"),
  P("I06", "prov_ville_souterraine", "Ville souterraine", "Marché noir, contrebande.", "souterrain", 3, "commerce", "C", "interieur_sina", "sina"),
  P("I07", "prov_domaine_reiss", "Domaine Reiss et chapelle souterraine", "Secret majeur.", "fort", 0, "none", "C", "interieur_sina", "sina", "Existence canon ; localisation exacte [?] (11 §9)."),
  P("I08", "prov_ehrmich", "Ehrmich", "District sud de Sina.", "urbain", 3, "commerce", "C", "interieur_sina", "sina"),
];

const POI = {
  prov_shiganshina: [["poi_maison_yeager", "Maison des Yeager et son sous-sol", "C"]],
  prov_maria_sud: [["poi_porte_shiganshina", "Porte de Shiganshina", "C"]],
  prov_rose_sud: [["poi_porte_trost", "Porte de Trost", "C"]],
  prov_trost: [["poi_qg_garnison_trost", "QG de la Garnison", "C"], ["poi_entrepot_gaz_trost", "Entrepôt de gaz de Trost", "A"]],
  prov_qg_corps: [["poi_qg_corps", "QG du Corps (château)", "C"]],
  prov_camp_entrainement: [["poi_camp_entrainement", "Camp d'entraînement", "C"]],
  prov_mitras: [["poi_cathedrale_murs", "Cathédrale des Murs", "C"], ["poi_tribunal_militaire", "Tribunal militaire", "C"]],
  prov_palais_royal: [["poi_palais_royal", "Palais royal", "C"]],
  prov_stohess: [["poi_prison_brigade", "Prison souterraine de la Brigade", "?"]],
  prov_ville_souterraine: [["poi_marche_noir", "Marché noir souterrain", "C"]],
  prov_domaine_reiss: [["poi_chapelle_reiss", "Chapelle Reiss", "C"]],
  prov_utgard: [["poi_chateau_utgard", "Château d'Utgard", "C"]],
  prov_ville_usine: [["poi_cavernes_glace", "Ville-usine et cavernes de glace", "C"]],
  prov_foret_arbres_geants: [["poi_foret_arbres_geants", "Forêt des Arbres Géants", "C"]],
  prov_plaines_cerealieres_sud: [["poi_grenier_maria", "Ferme et grenier de Maria", "A"]],
};

const slug = (id) => id.replace(/^prov_/, "");
const provinces = rows.map((r) => {
  const out = {
    id: r.id,
    atlas_code: r.code,
    name_key: `prov.${slug(r.id)}`,
    desc_key: `prov.${slug(r.id)}.desc`,
    kind: r.kind,
    region: r.region,
    wall: r.wall,
    terrain: r.terrain,
    pop_level: r.pop,
    key_resource: r.key,
    titan_density: r.extra?.titan_density ?? 0,
    visibility: r.extra?.visibility ?? "connue",
    canon: r.canon,
  };
  if (r.id === "prov_utgard") Object.assign(out, { destroyed_year: 850, destroyed_event: "evt_850_utgard_battle" });
  if (POI[r.id]) out.poi = POI[r.id].map(([id, , canon]) => ({ id, name_key: `poi.${id.replace(/^poi_/, "")}`, canon }));
  if (r.note) out.notes_canon = r.note;
  return out;
});
fs.writeFileSync("data/provinces/paradis.json", JSON.stringify(provinces, null, 2) + "\n");

const texts = {};
for (const r of rows) {
  texts[`prov.${slug(r.id)}`] = r.name;
  texts[`prov.${slug(r.id)}.desc`] = r.desc;
}
for (const list of Object.values(POI)) for (const [id, name] of list) texts[`poi.${id.replace(/^poi_/, "")}`] = name;
fs.writeFileSync(process.argv[2] ?? "/dev/stdout", JSON.stringify(texts, null, 2) + "\n");
console.error(`${provinces.length} provinces`);
