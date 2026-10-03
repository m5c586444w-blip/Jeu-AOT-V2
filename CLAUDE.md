# Murs et Sang — mémoire de travail

- Stack : TypeScript strict + Vite, Vitest, ESLint (flat), Zod. Spécifications : `docs/spec/00…14` + `docs/spec/ERRATA.md` (l'errata prime).
- Scripts : `dev`, `build`, `typecheck`, `lint`, `test`, `data:validate`, `canon:check`, `sim:selftest`, `sim:balance`, **`verify`** (enchaîne tout).
- `src/sim` : logique pure. **Jamais** de DOM, de Pixi, de `Math.random`, de `Date.now` (temps et aléa injectés). Pas de `any`.
- Lore : chaque entrée porte `canon: "C" | "A" | "?"`. Le **fichier 11 prime** sur le 01 ; n'invente rien ; doute → `?` paramétrable dans `/data`.
- Ordre de priorité : ERRATA > 11 > 01 > 02/03 > 06/07/08/10/12/13 > 09 > 04 > 05.
- Un commit par tâche ; `npm run verify` avant chaque commit ; push sur `claude/attack-on-titan-strategy-game-4ukom6`.
- N'affirme jamais qu'un test est vert sans avoir collé sa sortie réelle.
- Aucun CDN (polices auto-hébergées), aucun asset de l'œuvre originale ; licences dans `docs/ASSETS_LICENSES.md`.
- Chaque phase Pn (n ≥ 1) commence par `docs/phases/Pn.md` (tâches, AC avec commandes, hors-périmètre).
- Fin de phase : rapport `docs/reports/Pn.md` (sorties réelles collées, captures dans `docs/screenshots/`), commit, `docs/PROGRESS.md` à jour, puis phase suivante si tous ses critères passent.
- Pixi uniquement dans `src/render`. Tenir `docs/PROGRESS.md` à jour (phase, tâche, dernier verify, prochaine étape).

## Arrêts obligatoires (écrire la raison dans docs/PROGRESS.md puis attendre l'utilisateur)
1. Un critère d'acceptation échoue deux fois.
2. Fait de lore ambigu qu'aucune valeur `?` paramétrable ne règle.
3. Décision de design à impact majeur non couverte par les spécifications.
4. Une commande ne peut pas s'exécuter (réseau, droits…).
5. Fin de **P4** et de **P8** uniquement : revue de l'utilisateur (rapport du fichier 14 §7, sorties réelles collées).
