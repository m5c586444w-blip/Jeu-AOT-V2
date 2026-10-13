// npm run coord -- fenetre | statut | verrou prendre <A|B> "<tâche>" | verrou battement <A|B> ["<tâche>"] | verrou liberer <A|B>
// Protocole : docs/coord/PROTOCOLE.md. Le verrou est le fichier docs/coord/LOCK.json, partagé par git (tronc).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { evaluerVerrou, fenetre, VERROU_LIBRE, VerrouSchema } from "./coordLib";
import type { Session, Verrou } from "./coordLib";

const LOCK_PATH = "docs/coord/LOCK.json";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function lire(): Verrou {
  if (!existsSync(LOCK_PATH)) return VERROU_LIBRE;
  const parsed = VerrouSchema.safeParse(JSON.parse(readFileSync(LOCK_PATH, "utf8")));
  return parsed.success ? parsed.data : VERROU_LIBRE;
}

function ecrire(v: Verrou): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(v, null, 2)}\n`);
}

function session(arg: string | undefined): Session {
  if (arg === "A" || arg === "B") return arg;
  console.error("Session attendue : A ou B.");
  process.exit(2);
}

/** Commit + push du verrou ; en cas de refus (l'autre session a poussé), on récupère et on réévalue. */
function publier(message: string): boolean {
  try {
    git(["add", LOCK_PATH]);
    git(["commit", "-m", message, "--", LOCK_PATH]);
    git(["push"]);
    return true;
  } catch {
    return false;
  }
}

function prendre(s: Session, tache: string): number {
  for (let essai = 1; essai <= 3; essai++) {
    try {
      git(["pull", "--rebase", "--autostash"]);
    } catch (e) {
      console.error(`git pull a échoué : ${e instanceof Error ? e.message : String(e)}`);
    }
    const now = new Date();
    const d = evaluerVerrou(lire(), s, now);
    if (d.decision === "occupe") {
      console.log(`OCCUPE : ${d.raison}`);
      return 3;
    }
    const iso = now.toISOString();
    const avant = git(["rev-parse", "HEAD"]);
    ecrire({ proprietaire: s, tache, depuis: iso, battement: iso });
    if (publier(`coord: verrou ${s} — ${tache}`)) {
      console.log(`PRIS (${d.raison}) : ${s} — ${tache}`);
      return 0;
    }
    // Échec : on défait seulement notre propre commit de verrou, jamais un commit antérieur.
    if (git(["rev-parse", "HEAD"]) !== avant) git(["reset", "--soft", avant]);
    git(["restore", "--staged", LOCK_PATH]);
    git(["checkout", "--", LOCK_PATH]);
  }
  console.log("OCCUPE : trois tentatives de publication ont échoué (l'autre session pousse en même temps).");
  return 3;
}

/** Battement : commit + push du verrou (au moins toutes les 30 min). Code 3 = verrou perdu : s'arrêter. */
function battement(s: Session, tache: string): number {
  for (let essai = 1; essai <= 3; essai++) {
    try {
      git(["pull", "--rebase", "--autostash"]);
    } catch (e) {
      console.error(`git pull a échoué : ${e instanceof Error ? e.message : String(e)}`);
    }
    const v = lire();
    if (v.proprietaire !== s) {
      console.log(`PERDU : le verrou est détenu par ${v.proprietaire ?? "personne"}. Commit ton travail s'il est vert, pull --rebase, push, puis arrête-toi sans toucher à COORD.md.`);
      return 3;
    }
    const avant = git(["rev-parse", "HEAD"]);
    ecrire({ ...v, tache: tache || v.tache, battement: new Date().toISOString() });
    if (publier(`coord: battement ${s}`)) {
      console.log(`BATTEMENT ${s} poussé.`);
      return 0;
    }
    if (git(["rev-parse", "HEAD"]) !== avant) git(["reset", "--soft", avant]);
    git(["restore", "--staged", LOCK_PATH]);
    git(["checkout", "--", LOCK_PATH]);
  }
  console.log("Battement non poussé après trois essais (réseau ?) ; réessayer plus tard.");
  return 4;
}

const [cmd, sub, arg1, ...rest] = process.argv.slice(2);
const now = new Date();
if (cmd === "fenetre") {
  console.log(JSON.stringify(fenetre(now), null, 2));
} else if (cmd === "statut") {
  console.log(JSON.stringify({ fenetre: fenetre(now), verrou: lire() }, null, 2));
} else if (cmd === "verrou" && sub === "prendre") {
  process.exit(prendre(session(arg1), rest.join(" ") || "(sans titre)"));
} else if (cmd === "verrou" && sub === "battement") {
  process.exit(battement(session(arg1), rest.join(" ")));
} else if (cmd === "verrou" && sub === "liberer") {
  const s = session(arg1);
  const v = lire();
  if (v.proprietaire !== s) {
    console.log(`Rien à libérer : titulaire ${v.proprietaire ?? "personne"}.`);
  } else {
    ecrire(VERROU_LIBRE);
    console.log("Verrou libéré (à inclure dans le commit de clôture, puis git push).");
  }
} else {
  console.error('Usage : npm run coord -- fenetre | statut | verrou prendre <A|B> "<tâche>" | verrou battement <A|B> ["<tâche>"] | verrou liberer <A|B>');
  process.exit(2);
}
