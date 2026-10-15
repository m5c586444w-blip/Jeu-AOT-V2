// npm run assets:blender — modèles 3D créés par le projet (ERRATA_V3 §4, C10). Crée `.venv-blender` et installe `bpy` si absent,
// lance les scripts de `tools/blender/` (aucune fenêtre : module Python), écrit `docs/art/assets/projet/*.glb`, vérifie que
// l'export est déterministe (deux générations, même sha256) puis met à jour le manifeste et la table des licences.
// Le manifeste est réécrit à chaque exécution avec l'empreinte de la dernière génération.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ManifestSchema, ORIGINE_PROJET, writeAttributions } from "./assetsCheck";
import type { ManifestEntry } from "./assetsCheck";

const VENV = ".venv-blender";
const PYTHON = `${VENV}/bin/python`;
const MANIFEST = "docs/art/assets/manifest.json";
const LICENSES = "docs/ASSETS_LICENSES.md";
const AUTEUR = "Projet Murs et Sang (création originale, générée par script Blender bpy)";

interface Modele {
  fichier: string;
  nom: string;
  script: string;
  note: string;
  /** Servi au navigateur (`execution` au manifeste) : tenues et décalques, chargés par `tenuesProjet.ts`. */
  servi?: boolean;
}
const MODELES: Modele[] = [
  { fichier: "projet/lame_odm.glb", nom: "Lame d'ODM (création du projet)", script: "tools/blender/armes.py", note: "Fichier 10 E-P03 ; origine à la poignée, lame vers +Y." },
  { fichier: "projet/lance_de_foudre.glb", nom: "Lance de foudre (création du projet)", script: "tools/blender/armes.py", note: "Fichier 10 E-P06 ; origine à la poignée, pointe vers +Y." },
  { fichier: "projet/fusil.glb", nom: "Fusil à poudre (création du projet)", script: "tools/blender/armes_a_feu.py", note: "Fichier 10 E-P07 ; origine à la poignée, canon vers +Z (avant glTF)." },
  { fichier: "projet/canon_chariot.glb", nom: "Canon sur chariot-canon (création du projet)", script: "tools/blender/armes_a_feu.py", note: "Fichier 10 E-P08 et V-02 ; origine au sol, bouche vers +Z (avant glTF)." },
  { fichier: "projet/dispositif_odm.glb", nom: "Dispositif ODM (création du projet)", script: "tools/blender/odm.py", note: "Fichier 10 E-P01 et E-P05 ; origine au centre de la ceinture." },
];

/** Tenues par institution (tools/blender/tenues.py) : identifiant, institution, emblème porté. Deux niveaux de détail chacune. */
const TENUES: { id: string; nom: string; emblem: string }[] = [
  { id: "bataillon_exploration", nom: "Bataillon d'exploration", emblem: "emb_org_survey_corps" },
  { id: "garnison", nom: "Garnison", emblem: "emb_org_garrison" },
  { id: "police_militaire", nom: "Police militaire", emblem: "emb_org_military_police" },
  { id: "corps_entrainement", nom: "Corps d'entraînement", emblem: "emb_org_training_corps" },
  { id: "police_interieure", nom: "Police intérieure (anti-personnel)", emblem: "emb_org_military_police" },
  { id: "marley_soldat", nom: "Soldat de Marley", emblem: "emb_fac_marley" },
  { id: "marley_officier", nom: "Officier de Marley", emblem: "emb_fac_marley" },
];
for (const t of TENUES) {
  for (const lod of [0, 1]) {
    MODELES.push({
      fichier: `projet/tenue_${t.id}_lod${lod}.glb`,
      nom: `Tenue ${t.nom}, LOD${lod} (création du projet)`,
      script: "tools/blender/tenues.py",
      note: `Fichier 10 §9 ; pièces rigides ajustées au corps humain.glb, un nœud par os (extras : emblème ${t.emblem}) ; couleurs A (cape verte E-P11 : C) ; LOD${lod} ${lod === 0 ? "≤ 8 000" : "≤ 2 000"} triangles.`,
      servi: true,
    });
  }
}
for (const e of ["emb_org_survey_corps", "emb_org_garrison", "emb_org_military_police", "emb_org_training_corps", "emb_fac_marley"]) {
  MODELES.push({
    fichier: `projet/decalque_${e}.glb`,
    nom: `Décalque d'emblème ${e} (création du projet)`,
    script: "tools/blender/emblemes.py",
    note: `Tracé de data/emblems (${e}) converti en maillage plat de 0,09 m, trois couches (champ, traits, accents), sans image ; face vers +Z, origine au centre.`,
    servi: true,
  });
}

const sha = (f: string): string => createHash("sha256").update(readFileSync(f)).digest("hex");

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function ensureBpy(): void {
  if (existsSync(PYTHON)) {
    try {
      sh(PYTHON, ["-c", "import bpy"]);
      return;
    } catch {
      /* bpy absent : réinstallation ci-dessous */
    }
  } else {
    console.log(`assets:blender : création de ${VENV}`);
    sh("python3", ["-m", "venv", VENV]);
  }
  console.log("assets:blender : pip install bpy (environ une minute)");
  sh(`${VENV}/bin/pip`, ["install", "bpy"]);
}

function generer(): Map<string, string> {
  const scripts = [...new Set(MODELES.map((m) => m.script))];
  for (const s of scripts) {
    const out = sh(PYTHON, [s]);
    for (const l of out.split("\n")) if (l.startsWith("OK ")) console.log(`  ${l}`);
  }
  return new Map(MODELES.map((m) => [m.fichier, sha(`docs/art/assets/${m.fichier}`)]));
}

ensureBpy();
const premiere = generer();
const seconde = generer();
for (const [f, h] of premiere) {
  if (seconde.get(f) !== h) {
    console.error(`assets:blender : export non déterministe pour ${f} (${h} puis ${seconde.get(f)})`);
    process.exit(1);
  }
}
const manifest = ManifestSchema.parse(JSON.parse(readFileSync(MANIFEST, "utf8")));
if (process.argv.includes("--check")) {
  // Mode contrôle : régénère et compare au manifeste, sans rien écrire (le manifeste ne doit pas mentir).
  const ecarts = MODELES.filter((m) => manifest.fichiers.find((e) => e.fichier === m.fichier)?.sha256 !== premiere.get(m.fichier));
  if (ecarts.length > 0) {
    for (const m of ecarts) console.error(`  KO  ${m.fichier} : empreinte du manifeste différente de la régénération`);
    process.exit(1);
  }
  console.log(`assets:blender --check : ${MODELES.length} modèles régénérés, empreintes conformes au manifeste.`);
  process.exit(0);
}
const today = new Date().toISOString().slice(0, 10);
for (const m of MODELES) {
  const old = manifest.fichiers.find((e) => e.fichier === m.fichier);
  const h = premiere.get(m.fichier) ?? "";
  const entry: ManifestEntry = {
    fichier: m.fichier,
    nom: m.nom,
    licence: "CC0-1.0",
    date: old && old.sha256 === h ? old.date : today,
    auteur: AUTEUR,
    sha256: h,
    usage: "modele_projet",
    origine: ORIGINE_PROJET,
    script: m.script,
    note: m.note,
    ...(m.servi ? { execution: true } : {}),
  };
  manifest.fichiers = [...manifest.fichiers.filter((e) => e.fichier !== m.fichier), entry];
}
manifest.fichiers.sort((a, b) => a.fichier.localeCompare(b.fichier));
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
writeAttributions(LICENSES, manifest);
console.log(`assets:blender : ${MODELES.length} modèles générés (deux fois, empreintes identiques), manifeste et licences à jour.`);
