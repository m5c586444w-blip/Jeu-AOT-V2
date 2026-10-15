import { z } from "zod";

/**
 * Emblèmes et enseignes (ERRATA_V3 §2.8) : objets de données `data/emblems/emblems.json`, rendus en SVG (trait pour l'interface,
 * couleurs pour la texture et le décalque 3D) à partir de la même définition. Tout emblème est une création du projet (`A`, `creation`) ;
 * le fait canon éventuel qu'il illustre (`fact`) est distinct de son dessin.
 */
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const PathData = z.string().regex(/^[MmLlHhVvCcSsQqTtAaZz0-9 ,.-]+$/, "tracé SVG : seuls les ordres de chemin et les nombres sont admis");

export const EmblemSchema = z.strictObject({
  id: z.string().regex(/^emb_[a-z0-9_]+$/),
  subject: z.strictObject({ kind: z.enum(["organisation", "faction"]), id: z.string().min(1) }),
  name_key: z.string().regex(/^emb\.name\.[a-z0-9_]+$/),
  canon: z.literal("A"),
  creation: z.literal(true),
  creation_reason: z.string().min(10),
  field: z.enum(["rond", "ecu", "losange"]),
  colors: z.strictObject({ field: Hex, line: Hex, accent: Hex }),
  charges: z.array(z.strictObject({ d: PathData, role: z.enum(["line", "fill", "accent"]) })).min(1),
  fact: z.strictObject({ canon: z.literal("C"), text: z.string().min(5), source: z.string().min(5) }).optional(),
  notes_canon: z.string().optional(),
});
export type Emblem = z.infer<typeof EmblemSchema>;

export const EmblemsFileSchema = z.strictObject({
  canon: z.literal("A"),
  notes_canon: z.string(),
  emblems: z.array(EmblemSchema).min(1),
}).superRefine((f, ctx) => {
  const seen = new Set<string>();
  for (const [i, e] of f.emblems.entries()) {
    if (seen.has(e.id)) ctx.addIssue({ code: "custom", path: ["emblems", i, "id"], message: `identifiant en double : ${e.id}` });
    seen.add(e.id);
    if (e.id !== `emb_${e.subject.id}`) ctx.addIssue({ code: "custom", path: ["emblems", i, "id"], message: `l'identifiant doit être emb_${e.subject.id}` });
  }
});
export type EmblemsFile = z.infer<typeof EmblemsFileSchema>;

/**
 * Règle R15 (création de lore, ERRATA_V3 §2) : toute entrée `creation: true` est `canon: "A"`, porte une raison non vide et figure dans
 * `docs/lore/creations.md` (texte de ce fichier passé en argument). Un `canon: "C"` avec `creation: true` est rejeté.
 */
export function checkCreationEntry(entry: { id: string; canon?: unknown; creation?: unknown; creation_reason?: unknown }, listing: string): string[] {
  if (entry.creation !== true) return [];
  const out: string[] = [];
  if (entry.canon !== "A") out.push(`création présentée comme canon « ${String(entry.canon)} » (doit être A)`);
  if (typeof entry.creation_reason !== "string" || entry.creation_reason.trim().length === 0) out.push("creation_reason manquant");
  if (!listing.split("\n").some((l) => l.startsWith("|") && l.split("|")[1]?.trim() === entry.id)) out.push("absente de docs/lore/creations.md");
  return out;
}
