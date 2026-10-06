# Murs et Sang — mémoire de travail

- Stack : TypeScript strict + Vite, Vitest, ESLint (flat), Zod. Spécifications : `docs/spec/00…14` + `docs/spec/ERRATA.md` (l'errata prime).
- Scripts : `dev`, `build`, `typecheck`, `lint`, `test`, `data:validate`, `canon:check`, `sim:selftest`, `sim:balance`, **`verify`** (enchaîne tout).
- `src/sim` : logique pure. **Jamais** de DOM, de Pixi, de `Math.random`, de `Date.now` (temps et aléa injectés). Pas de `any`.
- Lore : chaque entrée porte `canon: "C" | "A" | "?"`. Le **fichier 11 prime** sur le 01 ; n'invente rien ; doute → `?` paramétrable dans `/data`.
- Ordre de priorité : ERRATA > 11 > 01 > 02/03 > 06/07/08/10/12/13 > 09 > 04 > 05.
- Un commit par tâche ; `npm run verify` avant chaque commit ; push sur `claude/attack-on-titan-strategy-game-4ukom6`.
- N'affirme jamais qu'un test est vert sans avoir collé sa sortie réelle.
- Aucun CDN (polices auto-hébergées), aucun asset de l'œuvre originale ; licences dans `docs/ASSETS_LICENSES.md`.
- Assets externes (R1c, décision de l'utilisateur) : la règle « aucun asset externe » est levée pour les **corps de base** et les **animations** seulement.
  - Sources réalistes retenues : **MakeHuman** (données ou export CC0, dépôts officiels `makehumancommunity`) et **Poly Haven** (CC0). Kenney, KayKit, Quaternius et Poly Pizza sont écartées (styles non réalistes, consigne de l'utilisateur).
  - **Interdit**, quelle que soit la licence : tout modèle ou texture tiré de L'Attaque des Titans ou d'un fan (Sketchfab, DeviantArt, Roblox, MMD, etc.).
  - Chaque fichier est dans `docs/art/assets/`, avec son entrée au manifeste `docs/art/assets/manifest.json` (nom, URL, licence, date, auteur) et son attribution dans `docs/ASSETS_LICENSES.md`. `npm run assets:check` échoue sinon (licence autre que CC0 ou CC-BY, URL hors des sources retenues, fichier sans entrée).
  - Chargement : `GLTFLoader`, à la demande, dans `src/render/tactical3d` seulement ; rien dans le bundle principal.
- Images par seconde (R1c, décision de l'utilisateur) : plus d'objectif moyen d'images par seconde ; les contraintes de **latence** restent (04 §9 : chargement < 8 s à froid, scène tactique < 3 s). Priorité : scènes et environnements réalistes et travaillés.
- Chaque phase Pn (n ≥ 1) commence par `docs/phases/Pn.md` (tâches, AC avec commandes, hors-périmètre).
- Fin de phase : rapport `docs/reports/Pn.md` (sorties réelles collées, captures dans `docs/screenshots/`), commit, `docs/PROGRESS.md` à jour, puis phase suivante si tous ses critères passent.
- Pixi uniquement dans `src/render`. three.js n'est utilisé que dans `src/render/tactical3d` (chargé à la demande ; règle ESLint en place, prouvée par `tests/lint/sim-purity.test.ts`). Tenir `docs/PROGRESS.md` à jour (phase, tâche, dernier verify, prochaine étape).
- Avant d'écrire OK sur un critère visuel : ouvre chaque capture avec l'outil de lecture d'image,  décris ce que tu vois en 3 lignes et liste au moins 3 défauts possibles (texte répété, zone vide,  chevauchement, élément absent, valeur à 0 incohérente). Écris-les dans le rapport, même si tu les  juges mineurs. Si une capture est vide ou ne montre pas l'élément testé, le critère est KO.
- Exception connue à « `git diff` de `src/sim` vide » : pendant **R2 seulement**, `src/sim/tactical/map.ts` peut recevoir une extension **additive** (voir le prompt R2). Aucun autre fichier de `src/sim`, et rien après R2.
## Arrêts obligatoires (écrire la raison dans docs/PROGRESS.md puis attendre l'utilisateur)
1. Un critère d'acceptation échoue deux fois.
2. Fait de lore ambigu qu'aucune valeur `?` paramétrable ne règle.
3. Décision de design à impact majeur non couverte par les spécifications.
4. Une commande ne peut pas s'exécuter (réseau, droits…).
5. Fin de **P4**, **P8**, **R1**, **R1c**, **R2**, **R3**, **R4**, **R7**, **R8** et **P9** : revue de l'utilisateur (rapport du fichier 14 §7, sorties réelles collées).
