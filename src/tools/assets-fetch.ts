// npm run assets:fetch — télécharge les sources CC0 de R1c (dépôts officiels de MakeHuman, commits épinglés) dans
// docs/art/assets/, et met à jour leurs entrées au manifeste (URL, licence, date, auteur, empreinte). Un fichier déjà présent
// avec la même empreinte garde sa date de récupération.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ManifestSchema, writeAttributions } from "./assetsCheck";
import type { Manifest, ManifestEntry } from "./assetsCheck";
import { MH_AUTHOR, sourceFiles } from "./assetsSources";

const ROOT = "docs/art/assets";
const manifestPath = join(ROOT, "manifest.json");
const today = new Date().toISOString().slice(0, 10);
const manifest: Manifest = existsSync(manifestPath) ? ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8"))) : { version: 1, fichiers: [] };
const byFile = new Map(manifest.fichiers.map((e) => [e.fichier, e] as const));
let fetched = 0;
let kept = 0;
for (const s of sourceFiles()) {
  // curl passe par le mandataire HTTPS de l'environnement (variables HTTPS_PROXY, certificats).
  let buf: Buffer;
  try {
    buf = execFileSync("curl", ["-sSfL", "--max-time", "120", s.url], { maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.error(`  KO  ${s.url} : ${(e as Error).message.split("\n")[0]}`);
    process.exit(1);
  }
  const sha = createHash("sha256").update(buf).digest("hex");
  const path = join(ROOT, s.fichier);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  const old = byFile.get(s.fichier);
  const entry: ManifestEntry = { fichier: s.fichier, nom: s.nom, url: s.url, licence: "CC0-1.0", date: old && old.sha256 === sha ? old.date : today, auteur: MH_AUTHOR, sha256: sha, usage: "corps_de_base" };
  if (old && old.sha256 === sha) kept++;
  else fetched++;
  byFile.set(s.fichier, { ...old, ...entry });
  console.log(`  OK  ${s.fichier}  ${buf.length} octets  ${sha.slice(0, 12)}…`);
}
manifest.fichiers = [...byFile.values()].sort((a, b) => a.fichier.localeCompare(b.fichier));
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeAttributions("docs/ASSETS_LICENSES.md", manifest);
console.log(`assets:fetch : ${fetched} fichier(s) nouveaux ou changés, ${kept} inchangé(s) ; manifeste : ${manifest.fichiers.length} entrées.`);
