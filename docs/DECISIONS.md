# JOURNAL DES DÉCISIONS

> Modèle du fichier 05 §10. Les décisions D-01 à D-15 sont les « choix par défaut » validés par l'utilisateur le 2026-10-02 ; les errata Q1–Q4 sont dans `docs/spec/ERRATA.md`.

## 2026-10-02 — D-01 Format des identifiants d'événements
- Contexte : formats concurrents (`evt_trost_breach_845` en 05, `evt_850_police_tech_seized` en 13/14, `E37` en 12).
- Décision : `evt_<année>_<nom>` + champ `code: "E37"`.
- Impact : schéma `EventDef`, graine `data/events/canon_850.json`. Statut : A.

## 2026-10-02 — D-02 Identifiants de provinces
- Contexte : `prov_shiganshina` (05) contre `R01`/`S06` (06, 14).
- Décision : `id` en snake_case (`prov_shiganshina`) + `atlas_code: "R01"`.
- Impact : schéma `Province`. Statut : A.

## 2026-10-02 — D-03 Fenêtre d'un événement
- Contexte : `{from: Date, to: Date}` (05) n'est pas sérialisable et suppose des mois déclarés `?` en 12.
- Décision : format du fichier 12 : `window {after, within_days?}` + `year_min` / `year_max`.
- Impact : schéma `EventDef`, règle R4. Statut : A.

## 2026-10-02 — D-04 Années floues
- Contexte : « ≈ 847 ? », « 851–854 », « 850 (fin) ».
- Décision : `year_min` / `year_max` ; R2 et R4 comparent `year_min` (confirmé par l'errata).
- Impact : `canonRules.ts`. Statut : A.

## 2026-10-02 — D-05 Valeurs « C ? » du fichier 13
- Décision : `canon: "?"` + `notes_canon: "C présumé"` (R6 n'accepte que C/A/?).
- Impact : saisie future des technologies T-LOG-05/07, T-MOD-04. Statut : A.

## 2026-10-02 — D-06 Déblocage par plusieurs événements
- Décision : `unlock_event: string | string[]` (au moins un) ; R2 compare `min_year` à l'événement le plus ancien.
- Impact : schéma `Tech`, R2 ; T-MED-05 = E35 ou E47 (errata Q2). Statut : A.

## 2026-10-02 — D-07 Année de naissance facultative
- Contexte : `birth_year` obligatoire en 05 mais jamais donnée.
- Décision : facultative ; aucune date inventée. Statut : A.

## 2026-10-02 — D-08 `active_from` par défaut
- Décision : 845 (début de la chronologie jouable), avec la note « borne de jeu, pas un fait canon ». Statut : A.

## 2026-10-02 — D-09 Morts des personnages de la graine
- Décision : Mike → E24 (11 prime sur 12 ; confirmé par l'errata), Erwin → E41, Kenny → E35 (errata Q2). Hange (E60), Pixis (E58), Zackly (E57) : `active_until: 854` sans `death_event` tant que la chaîne 851–854 n'est pas saisie (une référence vers un événement absent ferait échouer `data:validate`).
- Statut : C pour les années, A pour le rattachement aux événements.

## 2026-10-02 — D-10 Positionnements (règle R5)
- Contexte : les schémas de T0.8 ne localisaient pas les unités.
- Décision : collection `placements` (id, kind, location, year, canon) + champ `location` sur les événements ; un lieu reste utilisable l'année même de sa destruction (comparaison stricte `year > destroyed_year`).
- Statut : A.

## 2026-10-02 — D-11 Priorité du fichier 14
- Décision : 14 fait foi pour la méthode de P0, 11 pour le lore, l'errata utilisateur prime sur tout.

## 2026-10-02 — D-12 Incohérences notées sans correction
- Décision : 134 provinces (00/06) contre ≈ 70 + 60 (01) ; E08 sans prédécesseur ; E29 déclenché pendant E32. Consignées dans `CANON_CHECK.md`. W07 corrigé par l'errata (proche de Krolva).

## 2026-10-02 — D-13 Pas de Pixi en P0
- Décision : page de démarrage en DOM ; Pixi sera ajouté en P1. La règle ESLint interdisant Pixi dans `src/sim` est déjà active.

## 2026-10-02 — D-14 Horloge des sauvegardes
- Décision : horloge injectée (`SaveStore.open(factory, clock)`) ; `Date.now()` n'est appelé que dans `src/main.ts`, hors de `src/sim`.

## 2026-10-02 — D-15 Faux positifs possibles d'AC-17
- Décision : si `grep "cdn\."` trouve une chaîne dans une dépendance, le signaler sans modifier le test. Constat P0 : aucun résultat.

## 2026-10-02 — D-16 Calendrier
- Décision : année de 360 jours (12 × 30), départ an 845 jour 1, saisons : mois 1–3 hiver, 4–6 printemps, 7–9 été, 10–12 automne.
- Justification : le canon ne donne aucun calendrier fin (12, en-tête). Statut : A.

## 2026-10-02 — D-17 Graine aléatoire et fork
- Décision : mulberry32 ; `fork(label)` = mulberry32(FNV-1a(`<graine d'origine>:<label>`)) ; l'état du RNG vit dans `GameState.rng.state`, la graine d'origine dans `GameState.seed`.

## 2026-10-02 — D-18 Hash d'état
- Décision : JSON canonique (clés triées récursivement, `undefined` omis, nombres non finis refusés) puis FNV-1a 32 bits, affiché en 8 caractères hexadécimaux.

## 2026-10-02 — D-19 Données hors de `src/`
- Contexte : 00 §5 place `/data` dans `src/`, 05 et 14 parlent de `/data`.
- Décision : code de données (schémas, chargeurs) dans `src/data/`, JSON dans `data/` à la racine (modifiable sans toucher au code).

## 2026-10-02 — D-20 canon:check indépendant de Zod
- Contexte : une province sans `canon` échouerait au schéma avant d'atteindre R6.
- Décision : `canon:check` lit les JSON bruts et applique R1–R6 lui-même ; `data:validate` contrôle les schémas et les références.

## 2026-10-02 — D-21 Worker
- Décision : `createSim()` + `handleSimRequest()` (protocole de messages pur) ; le même module sert l'exécution directe, le Web Worker (`src/workers/sim.worker.ts`) et `worker_threads` (amorce `sim.node-worker.boot.mjs` qui active tsx dans le thread).

## 2026-10-02 — D-22 Dépendances
| Paquet | Pourquoi |
|---|---|
| typescript, vite | Langage et build imposés (00 §4) |
| vitest | Tests (00 §4) |
| eslint, @eslint/js, typescript-eslint, globals | Lint, interdiction de `any`, pureté de `src/sim` (AC-02, AC-03) |
| zod | Validation des données (00 §4, AC-12) ; messages en français (`z.locales.fr`) |
| fake-indexeddb | Tests IndexedDB sous Node (AC-10, piège du 14 §8) |
| tsx | Exécuter les outils CLI TypeScript et le worker Node |
| @types/node | Types des outils CLI |
| @fontsource/eb-garamond, im-fell-english, special-elite | Polices libres auto-hébergées (aucun CDN, 04 §1.3) |
| playwright-core | `smoke:page` : vérification réelle d'AC-19 avec le Chromium déjà installé (pas de téléchargement de navigateur) |

## 2026-10-02 — D-23 Événement E19
- Décision : E19 (perte de l'escouade d'élite d'origine) marqué `?` : moment « fin de E18 ? » et morts non recoupées (11 §3, §9).
