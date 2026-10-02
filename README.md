# Murs et Sang (titre de travail)

Jeu de grande stratégie **personnel et non commercial** situé dans l'univers de *L'Attaque des Titans*.
Aucun élément de l'œuvre originale (images, sons, polices propriétaires) n'est reproduit.

- Spécifications : [`docs/spec/`](docs/spec/) (fichiers 00 à 14) et l'**errata utilisateur** [`docs/spec/ERRATA.md`](docs/spec/ERRATA.md), qui prime.
- Avancement : [`docs/PROGRESS.md`](docs/PROGRESS.md) · décisions : [`docs/DECISIONS.md`](docs/DECISIONS.md) · faits de lore : [`docs/CANON_CHECK.md`](docs/CANON_CHECK.md) · licences : [`docs/ASSETS_LICENSES.md`](docs/ASSETS_LICENSES.md).

## Démarrer

Prérequis : Node.js ≥ 22.

```bash
npm ci
npm run dev        # page de démarrage ; F2 ouvre la console de service
npm run verify     # typecheck + lint + tests + data:validate + canon:check + sim:selftest + build
```

## Scripts

| Script | Rôle |
|---|---|
| `dev` / `build` / `preview` | Serveur Vite, build de production, prévisualisation |
| `typecheck` | TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`) |
| `lint` | ESLint ; interdit `any` partout, et DOM / Pixi / `Math.random` / `Date.now` dans `src/sim` |
| `test` | Vitest (RNG, temps, commandes, hash, sauvegardes, données, canon, i18n, console, Worker) |
| `data:validate [dossier]` | Valide les JSON de `data/` avec Zod ; erreurs « fichier : $.chemin — message » |
| `canon:check [dossier]` | Règles de cohérence canon R1–R6 (fichier 14 §3) ; code 1 en cas d'échec |
| `sim:selftest` | Même hash après 1000 ticks en direct et via un worker |
| `sim:balance` | Ébauche (l'équilibrage arrive en P9) |
| `smoke:page` | Ouvre la page dans Chromium (serveur de dev), vérifie le contenu et F2, capture à 100 % et 125 % |
| `verify` | Enchaîne tous les contrôles ci-dessus sauf `smoke:page` |

## Architecture

```
src/sim/      logique pure et déterministe (core : RNG, temps, bus, commandes, état, hash ; sim.ts : createSim)
src/data/     schémas Zod, chargeurs, règles canon R1–R6
src/save/     IndexedDB (créneaux + 3 sauvegardes automatiques), export/import fichier
src/workers/  Web Worker navigateur, worker Node, client asynchrone
src/ui/       page de démarrage, console de debug, textures procédurales
src/i18n/     fr.json (référence), en.json
src/tools/    outils CLI
data/         données de jeu (provinces, characters, techs, events, placements)
tests/        tests Vitest et fixtures
```

La simulation est la source de vérité : l'interface ne la modifie que par des **commandes** validées et
journalisées, ce qui permet le rejeu (`replay`) et la comparaison d'états par empreinte (`stateHash`).

## Convention de fiabilité

Chaque entrée de données porte `canon: "C" | "A" | "?"` : canon, adaptation de design, ou incertain
(paramétrable dans `data/`, jamais figé dans le code).
