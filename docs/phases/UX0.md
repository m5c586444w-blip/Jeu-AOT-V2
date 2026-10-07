# UX0 — Nettoyer les fuites (E-UX-1)

Prompt : `docs/spec/22_PLAN_V2_EXPERIENCE_DE_JEU.md` §3. Errata : `docs/spec/ERRATA_UX.md`. Aucune modification de `src/sim` ni des règles.

## Tâches
- **UX0.1** Inventaire, par écran, des textes affichés qui contiennent un statut canon, un code ou identifiant, un renvoi aux spécifications, une phase ou une annonce (« pas avant », « n'existe pas encore »). Liste : `docs/reports/UX0.md`.
- **UX0.2** Retrait de l'interface ; les données gardent `canon: C|A|?`. Mode auteur : touche F10 (réassignable), case dans les options, désactivé par défaut ; les mentions y paraissent en pastilles discrètes (classe `auteur-seul`).
- **UX0.3** Recherche : étude verrouillée grisée, condition en langage de jeu (« Exige : … ») ; étude dont la mécanique n'existe pas encore (phase P9) absente, sauf acquise ou à l'étude.
- **UX0.4** Archives : sans tampons ; ne montrent que le découvert (personnages de la nation, provinces tenues ou observées, Titans au porteur connu, événements survenus).
- **UX0.5** `tests/ui/no-leaks.test.ts` (dictionnaires, détecteur, mode auteur, recherche) et `npm run smoke:ux0` (tous les écrans dans Chromium, texte visible et bulles).

## Critères
| Id | Critère | Commande |
|---|---|---|
| CUX0-01 | verify code 0 | `npm run verify` |
| CUX0-02 | aucune mention interne visible | `npx vitest run tests/ui/no-leaks.test.ts` ; `npm run smoke:ux0` |
| CUX0-03 | F10 affiche puis masque les mentions | `npm run smoke:ux0` (contrôle « F10 ») |
| CUX0-04 | canon:check code 0 | `npm run canon:check` |
| CUX0-05 | 6 captures lues une par une | `docs/screenshots/ux0-*.png`, rapport § captures |

## Hors périmètre
Refonte graphique (phase UI), visionneuses 3D de développement (`?proto3d`, lieux), console de service (F2).
