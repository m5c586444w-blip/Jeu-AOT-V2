import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { z } from "zod";

/**
 * Contrôle des fichiers externes (R1c, CLAUDE.md) : chaque fichier de `docs/art/assets/` a son entrée au manifeste, une licence
 * CC0 ou CC-BY (attribuée dans `docs/ASSETS_LICENSES.md`), une URL d'une source retenue, une empreinte exacte. Outil Node, jamais
 * empaqueté.
 * R1d (décision de l'utilisateur) : Poly Haven seulement pour les textures d'environnement (sol, pierre, toits), au plus 12
 * fichiers, chacun en WebP de 1024 × 1024.
 */
export const ASSET_LICENSES = ["CC0-1.0", "CC-BY-4.0", "CC-BY-3.0"] as const;
export const ASSET_USAGES = ["corps_de_base", "animation", "derive", "texture_environnement"] as const;
/** R1d : nombre et taille des textures d'environnement (Poly Haven). */
export const ENV_TEXTURE_MAX = 12;
export const ENV_TEXTURE_SIZE = 1024;

export const ManifestEntrySchema = z
  .object({
    /** Chemin relatif à `docs/art/assets/`, en barres obliques. */
    fichier: z.string().min(1),
    nom: z.string().min(1),
    url: z.string().url(),
    licence: z.string().min(1),
    /** Date de récupération (AAAA-MM-JJ). */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    auteur: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    usage: z.enum(ASSET_USAGES),
    /** Fichiers du manifeste dont celui-ci est tiré (dérivés seulement). */
    derive_de: z.array(z.string().min(1)).optional(),
    /** R1d : empreinte md5 du fichier source téléchargé (publiée par la source), quand le fichier est une conversion. */
    md5_source: z.string().regex(/^[0-9a-f]{32}$/).optional(),
    /** Servi au navigateur sous `/assets3d/` (copié dans `dist/assets3d/` à la construction). */
    execution: z.boolean().optional(),
    note: z.string().optional(),
  })
  .strict();
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z
  .object({
    version: z.literal(1),
    note: z.string().optional(),
    fichiers: z.array(ManifestEntrySchema),
  })
  .strict();
export type Manifest = z.infer<typeof ManifestSchema>;

export type SourceVerdict = { kind: "retenue"; source: string } | { kind: "ecartee"; source: string } | { kind: "interdite"; raison: string } | { kind: "inconnue" };

/** Sources retenues (réalistes) : MakeHuman (dépôts et site officiels), Poly Haven. */
const RETAINED: { source: string; test: (u: URL) => boolean }[] = [
  { source: "MakeHuman", test: (u) => ((u.hostname === "github.com" || u.hostname === "raw.githubusercontent.com") && u.pathname.toLowerCase().startsWith("/makehumancommunity/")) || u.hostname === "makehumancommunity.org" || u.hostname.endsWith(".makehumancommunity.org") },
  { source: "Poly Haven", test: (u) => /(^|\.)polyhaven\.(com|org)$/.test(u.hostname) },
];
/** Sources autorisées par la consigne mais écartées : styles non réalistes. */
const EXCLUDED: { source: string; test: (u: URL) => boolean }[] = [
  { source: "Kenney", test: (u) => /(^|\.)kenney\.nl$/.test(u.hostname) || u.hostname === "kenney.itch.io" },
  { source: "Quaternius", test: (u) => /(^|\.)quaternius\.com$/.test(u.hostname) || u.hostname === "quaternius.itch.io" },
  { source: "KayKit", test: (u) => /(^|\.)kaylousberg\.com$/.test(u.hostname) || u.hostname === "kaylousberg.itch.io" },
  { source: "Poly Pizza", test: (u) => /(^|\.)poly\.pizza$/.test(u.hostname) },
];
/** Interdits quelle que soit la licence : plateformes de fans et modèles tirés de l'œuvre. */
const FORBIDDEN_HOSTS = /(^|\.)(sketchfab\.com|deviantart\.com|deviantart\.net|roblox\.com|rbxcdn\.com|bowlroll\.net|nicovideo\.jp|nicoseiga\.jp|vroid\.com|booth\.pm|mmd\.fandom\.com)$/;
const FORBIDDEN_WORDS = /(attack[\s_-]?on[\s_-]?titan|shingeki|kyojin|\bsnk\b|\baot\b|\bmmd\b|\.pmx\b|\.pmd\b)/i;

export function classifySource(url: string, nom = ""): SourceVerdict {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: "inconnue" };
  }
  if (FORBIDDEN_HOSTS.test(u.hostname)) return { kind: "interdite", raison: `plateforme de fans ou de modèles tiers (${u.hostname})` };
  if (FORBIDDEN_WORDS.test(decodeURIComponent(u.pathname + u.search)) || FORBIDDEN_WORDS.test(nom)) return { kind: "interdite", raison: "modèle ou texture tiré de l'œuvre ou d'un fan" };
  if (u.protocol !== "https:") return { kind: "inconnue" };
  for (const r of RETAINED) if (r.test(u)) return { kind: "retenue", source: r.source };
  for (const r of EXCLUDED) if (r.test(u)) return { kind: "ecartee", source: r.source };
  return { kind: "inconnue" };
}

/** Dimensions d'une image WebP lues dans son en-tête (VP8, VP8L ou VP8X), ou null si ce n'est pas un WebP. */
export function webpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8 ") {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >>> 14) & 0x3fff) + 1 };
  }
  if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  return null;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Fichiers du dossier qui ne sont pas des assets : le manifeste et la notice. */
const NOT_ASSETS = new Set(["manifest.json", "README.md"]);

export interface CheckResult {
  errors: string[];
  entries: number;
  files: number;
}

export function checkAssets(root: string, licensesMd: string): CheckResult {
  const errors: string[] = [];
  const manifestPath = join(root, "manifest.json");
  if (!existsSync(manifestPath)) return { errors: [`manifeste absent : ${manifestPath}`], entries: 0, files: 0 };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    return { errors: [`manifeste illisible : ${(e as Error).message}`], entries: 0, files: 0 };
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `manifeste : ${i.path.join(".")} : ${i.message}`), entries: 0, files: 0 };
  const manifest = parsed.data;
  const attributions = existsSync(licensesMd) ? readFileSync(licensesMd, "utf8") : "";
  const files = walk(root)
    .map((p) => relative(root, p).split(sep).join("/"))
    .filter((p) => !NOT_ASSETS.has(p));
  const byFile = new Map<string, ManifestEntry>();
  for (const e of manifest.fichiers) {
    if (byFile.has(e.fichier)) errors.push(`${e.fichier} : entrée en double`);
    byFile.set(e.fichier, e);
  }
  for (const f of files) if (!byFile.has(f)) errors.push(`${f} : fichier sans entrée au manifeste`);
  for (const e of manifest.fichiers) {
    const path = join(root, e.fichier);
    if (!existsSync(path)) {
      errors.push(`${e.fichier} : entrée sans fichier`);
      continue;
    }
    if (!(ASSET_LICENSES as readonly string[]).includes(e.licence)) errors.push(`${e.fichier} : licence « ${e.licence} » refusée (CC0 ou CC-BY seulement)`);
    if (e.licence.startsWith("CC-BY") && !attributions.split("\n").some((l) => l.includes(e.nom) && l.includes(e.auteur))) errors.push(`${e.fichier} : licence ${e.licence} sans attribution (nom et auteur) dans ASSETS_LICENSES.md`);
    if (!attributions.includes(e.fichier)) errors.push(`${e.fichier} : absent de ASSETS_LICENSES.md`);
    const v = classifySource(e.url, e.nom);
    if (v.kind === "interdite") errors.push(`${e.fichier} : source interdite (${v.raison}) : ${e.url}`);
    else if (v.kind === "ecartee") errors.push(`${e.fichier} : source écartée (${v.source}, non réaliste) : ${e.url}`);
    else if (v.kind === "inconnue") errors.push(`${e.fichier} : URL hors des sources retenues (MakeHuman, Poly Haven) : ${e.url}`);
    const content = readFileSync(path);
    const sha = createHash("sha256").update(content).digest("hex");
    if (sha !== e.sha256) errors.push(`${e.fichier} : empreinte sha256 différente du manifeste`);
    // R1d : Poly Haven seulement pour les textures d'environnement, et celles-ci seulement de Poly Haven, en WebP 1K.
    const polyHaven = v.kind === "retenue" && v.source === "Poly Haven";
    if (polyHaven && e.usage !== "texture_environnement") errors.push(`${e.fichier} : Poly Haven n'est autorisé que pour les textures d'environnement (usage « ${e.usage} »)`);
    if (e.usage === "texture_environnement") {
      if (!polyHaven) errors.push(`${e.fichier} : texture d'environnement hors de Poly Haven : ${e.url}`);
      const size = webpSize(content);
      if (!e.fichier.endsWith(".webp") || !size) errors.push(`${e.fichier} : texture d'environnement autre que WebP`);
      else if (size.width !== ENV_TEXTURE_SIZE || size.height !== ENV_TEXTURE_SIZE) errors.push(`${e.fichier} : texture d'environnement de ${size.width} × ${size.height} (1024 × 1024 attendu)`);
    }
    if (e.usage === "derive") {
      if (!e.derive_de || e.derive_de.length === 0) errors.push(`${e.fichier} : fichier dérivé sans sources (derive_de)`);
      for (const s of e.derive_de ?? []) {
        const src = byFile.get(s);
        if (!src) errors.push(`${e.fichier} : source « ${s} » absente du manifeste`);
        else if (src.usage === "derive") errors.push(`${e.fichier} : source « ${s} » elle-même dérivée`);
        else if (src.licence !== "CC0-1.0" && e.licence === "CC0-1.0") errors.push(`${e.fichier} : dérivé déclaré CC0 d'une source ${src.licence}`);
      }
    } else if (e.derive_de) errors.push(`${e.fichier} : derive_de réservé aux fichiers dérivés`);
  }
  const envTextures = manifest.fichiers.filter((e) => e.usage === "texture_environnement").length;
  if (envTextures > ENV_TEXTURE_MAX) errors.push(`${envTextures} textures d'environnement (au plus ${ENV_TEXTURE_MAX})`);
  return { errors, entries: manifest.fichiers.length, files: files.length };
}

const ATTR_START = "<!-- R1c : début de la table générée depuis docs/art/assets/manifest.json (npm run assets:fetch, assets:build) -->";
const ATTR_END = "<!-- R1c : fin de la table générée -->";

/** Réécrit, dans `ASSETS_LICENSES.md`, la table des fichiers externes de R1c à partir du manifeste (une ligne par fichier). */
export function writeAttributions(licensesMd: string, manifest: Manifest): void {
  const md = existsSync(licensesMd) ? readFileSync(licensesMd, "utf8") : "";
  const rows = manifest.fichiers.map((e) => `| \`${e.fichier}\` | ${e.nom} | ${e.licence} | ${e.auteur} | ${e.usage === "derive" ? `dérivé de ${(e.derive_de ?? []).length} fichiers (\`npm run assets:build\`)` : `<${e.url}>`} | ${e.date} |`);
  const table = [ATTR_START, "| Fichier (`docs/art/assets/`) | Nom | Licence | Auteur | Source | Récupéré le |", "|---|---|---|---|---|---|", ...rows, ATTR_END].join("\n");
  const a = md.indexOf(ATTR_START);
  const b = md.indexOf(ATTR_END);
  const next = a >= 0 && b > a ? `${md.slice(0, a)}${table}${md.slice(b + ATTR_END.length)}` : `${md.trimEnd()}\n\n${table}\n`;
  writeFileSync(licensesMd, next);
}
