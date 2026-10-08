# Phase CHR — chronologie complète (branche `claude/v2-chr`)

Sources : fichier 22 §7, fichier 24 §2.4, E-UX-1 et E-UX-6, fichier 12 (60 événements), fichier 11 et ERRATA (priment). Plafond : 120 tours.
`src/sim` : seules des données s'ajoutent ; une extension additive (tirage des événements de fond) est permise si elle est déterministe,
testée, sans `any`, et que `sim:selftest` reste au code 0 (consignée dans DECISIONS).

## Tâches
- **CHR.1** Couverture : tableau des 60 événements (présent, jouable ou texte seul) dans `docs/reports/CHR.md` ; manquants ajoutés dans `data/events`
  (canon `C`/`A`/`?` partout, dates incertaines `?` paramétrables, jamais de date inventée présentée comme canon) ; thème et résumé de chaque événement.
- **CHR.2** Événements de fond : listes génériques (`canon: "A"`, aucun personnage canon inventé), au moins 3 par mois de jeu, texte varié (aucune
  phrase répétée dans l'année) ; chronique non vide dès le début de la partie.
- **CHR.3** Frise « Chronologie » : axe 845 à 854+, passés (cochés), en cours, annoncés (rumeur ou prévision selon le renseignement ; invisibles sinon),
  écart au récit connu, filtre par thème (politique, militaire, Titans, famille, monde). Style : jetons `tokens.css`, composants `kit.ts`.
- **CHR.4** Notifications d'événements : texte, illustration d'archétype, choix clairs, effets listés dans l'infobulle.
- **CHR.5** `tests/data/events-coverage.test.ts` : échoue si un des 60 événements n'a pas d'entrée.

## Critères d'acceptation
| ID | Critère | Commande |
|---|---|---|
| CCHR-01 | `verify` code 0 | `npm run verify` |
| CCHR-02 | `canon:check` code 0 | `npm run canon:check` |
| CCHR-03 | 60 événements couverts | `npx vitest run tests/data/events-coverage.test.ts` |
| CCHR-04 | ≥ 3 événements de fond par mois en moyenne sur un an simulé | `npm run sim:year` (ligne « fond ») ; `npx vitest run tests/sim/fond.test.ts` |
| CCHR-05 | Déterminisme | `npm run sim:selftest` |
| CCHR-06 | Frise capturée (1366×768 et 3840×2160) et lue | `docs/reports/CHR.md` § captures |

## Hors-périmètre
Mécaniser les 20 squelettes (E01–E08, E43–E52, E59, E60) ; nouvelle IA d'événements ; refonte d'écrans autres que la chronique ; nouvel outil de mesure ;
mode auteur ; sous-phase.
