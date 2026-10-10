# Murs et Sang (titre de travail)

Jeu de grande stratégie **personnel et non commercial** situé dans l'univers de *L'Attaque des Titans*. Il se joue dans un
navigateur, sur l'ordinateur, sans connexion : rien n'est publié en ligne. Aucun élément de l'œuvre originale (images, sons,
polices, modèles) n'est reproduit ; les rares ressources externes sont libres (CC0) et listées dans
[`docs/ASSETS_LICENSES.md`](docs/ASSETS_LICENSES.md).

- Spécifications : [`docs/spec/`](docs/spec/) (fichiers 00 à 24) et les errata [`ERRATA.md`](docs/spec/ERRATA.md) et
  [`ERRATA_UX.md`](docs/spec/ERRATA_UX.md), qui priment.
- Avancement : [`docs/PROGRESS.md`](docs/PROGRESS.md) · feuille de route : [`docs/ROADMAP.md`](docs/ROADMAP.md) · décisions :
  [`docs/DECISIONS.md`](docs/DECISIONS.md) · conformité : [`docs/CONFORMITE.md`](docs/CONFORMITE.md) · faits de lore :
  [`docs/CANON_CHECK.md`](docs/CANON_CHECK.md) · rapports de phase : [`docs/reports/`](docs/reports/).

## Jouer en local

Prérequis : Node.js 22 ou plus récent, et un navigateur récent (Chrome, Edge, Firefox). Une seule fois, avec le réseau :

```bash
npm ci
```

Ensuite, sans réseau :

```bash
npm run jouer      # construit le jeu (dist/) puis l'ouvre dans le navigateur : http://localhost:4173/?menu=1
```

`npm run jouer` enchaîne `npm run build` et `npm run preview -- --open`. Une fois le jeu construit, `npm run preview` suffit
pour le relancer. Le jeu doit être servi par ce petit serveur local : ouvert directement par un double-clic sur
`dist/index.html`, le navigateur refuse ses modules (protection `file://`). L'adresse `http://localhost:4173/?menu=1` ouvre le
menu principal ; `http://localhost:4173/` ouvre directement une nouvelle partie du scénario de 850.

- **Manuel en jeu** : touche **F1**, ou l'entrée « Manuel » du menu principal (but, temps, carte, registres, économie,
  politique, armée, expéditions, événements, monde, fins, difficulté, accessibilité, sauvegardes).
- **Options** : **F9** (langue, échelle de l'interface, accessibilité, son, bataille, touches). Console : **F2** (`help`).
- **Sauvegardes** : automatiques tous les trente jours de jeu (trois emplacements tournants, dans le navigateur) ; « Continuer »
  au menu les reprend. Elles restent dans le profil du navigateur de cet ordinateur.

`npm run smoke:local` vérifie le build hors réseau (toute requête sortante refusée et comptée) : menu, partie, sauvegarde et
rechargement, manuel, options, scène 3D.

## Développer

```bash
npm run dev        # serveur de développement Vite (rechargement à chaud)
npm run verify     # typecheck, lint, tests, données, assets, canon, autotest de la simulation, build
```

## Scripts

| Script | Rôle |
|---|---|
| `jouer` | Construit le jeu puis l'ouvre dans le navigateur (serveur local, hors réseau) |
| `dev` / `build` / `preview` | Serveur de développement, build de production (`dist/`), service local du build |
| `verify` | Enchaîne `typecheck`, `lint`, `test`, `data:validate`, `assets:check`, `canon:check`, `sim:selftest`, `build` |
| `typecheck` | TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`) |
| `lint` | ESLint ; interdit `any` partout ; DOM, Pixi, three.js, `Math.random` et `Date.now` interdits dans `src/sim` ; three.js seulement dans `src/render/tactical3d` |
| `test` | Vitest (simulation, données, sauvegardes, interface, outils) |
| `data:validate` | Valide les JSON de `data/` (schémas Zod) ; erreurs « fichier : $.chemin — message » |
| `assets:check` | Manifeste des ressources externes : licence CC0 ou CC-BY, source retenue, empreinte, attribution |
| `canon:check` | Règles de cohérence du lore (R1 à R14) sur les données ; code 1 en cas d'échec |
| `sim:selftest` | Même empreinte en direct et via un worker, sur huit configurations |
| `sim:parcours` | Cinq ans du scénario 850 par commandes enregistrées ; sauvegarde, migration et chargement chaque année ; même empreinte qu'en continu |
| `sim:balance` | Équilibrage : 1 000 parties par scénario menées par un pilote automatique ; rapport `docs/reports/P9-balance.html` |
| `sim:year` / `sim:world` / `sim:events` / `sim:shifters` / `sim:expeditions` / `sim:tactical` | Simulations sans interface d'un système (un an de jeu, monde, chronique, porteurs, expéditions, combat), invariants vérifiés |
| `smoke:local` | Build hors réseau dans Chromium (voir plus haut) ; captures `docs/screenshots/p10-*` |
| `smoke:*` | Parcours dans un vrai navigateur, un par phase (`smoke:map`, `smoke:p9`, `smoke:tuto`…), avec captures `docs/screenshots/` |
| `mesure:r1` … `mesure:r1d` | Mesures de latence et de rendu de la scène 3D (rendu logiciel ; bornes basses) |
| `map:generate` / `map:terrain` / `captures:map` | Régénération de la carte de Paradis et de son relief ; captures de la carte |
| `places:valider` / `places:captures` / `places:regenerer` | Lieux faits main et générés (`data/places/`) |
| `assets:fetch` / `assets:build` | Téléchargement et conversion des ressources libres listées au manifeste |

## Architecture

```
src/sim/      simulation pure et déterministe (core : RNG, temps, commandes, état, empreinte, sauvegarde ; strategic, politics,
              military, tactical, events, research, intel, shifters, world, missions, crisis, ending…)
src/data/     schémas Zod, chargeurs, règles canon
src/save/     IndexedDB (créneaux + 3 sauvegardes automatiques), export et import
src/workers/  Web Worker de simulation, worker Node, client asynchrone
src/render/   carte d'atlas Pixi ; tactical3d : scène de bataille three.js chargée à la demande
src/ui/       écran de jeu, menu, registres, dossiers, options, manuel, guide de prise en main
src/audio/    musique et ambiances synthétisées (WebAudio, aucun échantillon) ; pistes personnelles facultatives
src/i18n/     fr.json (référence), en.json
src/tools/    outils en ligne de commande (vérifications, simulations, smokes, mesures)
data/         données du jeu (provinces, personnages, événements, technologies, scénarios, équilibrage, lieux…)
tests/        tests Vitest
```

La simulation est la source de vérité : l'interface ne la modifie que par des **commandes** validées et journalisées. Même
graine et mêmes commandes donnent la même partie, vérifiée par empreinte (`stateHash`) : c'est ce qui permet le rejeu, les
sauvegardes fidèles et l'équilibrage par milliers de parties.

## Convention de fiabilité

Chaque fait de lore porte `canon: "C" | "A" | "?"` : canon (établi par l'œuvre), adaptation de design, ou incertain
(paramétrable dans `data/`, jamais figé dans le code). Les questions ouvertes sont dans
[`docs/lore/questions-ouvertes.md`](docs/lore/questions-ouvertes.md). Ces statuts ne sont montrés au joueur qu'en mode auteur
(F10).
