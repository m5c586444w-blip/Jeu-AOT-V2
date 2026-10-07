/**
 * Mentions internes que le joueur ne doit jamais voir hors mode auteur (E-UX-1, UX0) : statuts canon, codes et
 * identifiants, renvois aux spécifications, phases de développement, annonces de ce qui « arrive ».
 * « canon » seul n'est pas interdit : c'est aussi la pièce d'artillerie.
 */
export const LEAK_PATTERNS: readonly { id: string; re: RegExp }[] = [
  { id: "statut canon", re: /ÉTABLI|INTERPRÉTÉ|NON CONFIRMÉ|Statut de fiabilité|non confirmée?s?\b|\b(?:en|chronique|chronologie|statut) canon\b|canon de \d{3}|\bcanon[,)]/u },
  { id: "marque de statut", re: /\[(?:A|C|\?)\]|« \? »/u },
  { id: "code interne", re: /\b(?:T|D|F|E|AC|CR|CUX)-(?:[A-Z]{2,4}-)?\d{1,3}\b/u },
  { id: "renvoi aux spécifications", re: /[Ff]ichier \d{2}\b|\b\d{2} §\s?\d+|\b\d{2} [A-Z]{1,2}\d{2}\b|\bdata\/[\w/.-]+/u },
  { id: "phase de développement", re: /\bphase P?\d+\b|\bP(?:[0-9]|10)\b|[Mm]écanique en\b|registre non (?:encore )?ouvert|NON OUVERT/u },
  { id: "annonce", re: /pas avant (?:l'an )?\d{3}|n'existe pas encore|ça va arriver|arrive en phase/iu },
  { id: "identifiant de données", re: /\b(?:prov|char|org|str|evt|tech|secret|agent|shifter|ttype|tmap|wprov|fac|form|scn)_[a-z0-9_]+/u },
];

export interface Leak {
  pattern: string;
  excerpt: string;
}

/** Mentions interdites trouvées dans un texte visible. */
export function findLeaks(text: string): Leak[] {
  const out: Leak[] = [];
  for (const { id, re } of LEAK_PATTERNS) {
    const g = new RegExp(re.source, `${re.flags.replace("g", "")}g`);
    for (const m of text.matchAll(g)) {
      const i = m.index;
      out.push({ pattern: id, excerpt: text.slice(Math.max(0, i - 30), i + m[0].length + 30).replace(/\s+/g, " ") });
    }
  }
  return out;
}

/** Clés de traduction réservées au mode auteur ou à la console de service (jamais affichées au joueur hors F10, F2). */
export const AUTHOR_KEYS: readonly RegExp[] = [/^console\./, /^canon\./, /^dossier\.canon_why$/, /^dossier\.(location|control)_(status|why)$/, /^research\.min_year$/, /^research\.phase$/, /^layers\.closed$/, /^evt\.canon_stamp$/, /^app\./, /^debug\./];

const SPEC_REF = /^(?:\d{2} §\s?[\d.]+|\d{2} [A-Z]{1,2}\d{2}|[A-Z]{1,3}-(?:[A-Z]{2,4}-)?\d{1,3}|E\d{2}|[CA?])$/u;

/** Note de données rendue lisible pour le joueur : sans renvois aux spécifications ni marques de statut. */
export function playerText(note: string): string {
  return note
    .replace(/\s*\(([^()]*)\)/gu, (whole, inner: string) => {
      const parts = inner.split(/[,;]/u).map((x) => x.trim());
      const keep = parts.filter((x) => !SPEC_REF.test(x));
      if (keep.length === parts.length) return whole;
      return keep.length ? ` (${keep.join(", ")})` : "";
    })
    .replace(/\s*\[(?:A|C|\?)\]/gu, "")
    .trim();
}
