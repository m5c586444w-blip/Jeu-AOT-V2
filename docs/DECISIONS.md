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

# Phase P1

## 2026-10-03 — D-24 Réserve nationale unique
- Contexte : 02 §3 décrit stocks, capacités et logistique ; le transport entre provinces arrive en P3.
- Décision : en P1, une réserve nationale par ressource (capacité = somme des provinces tenues) ; production et consommation y passent directement. La « famine locale » devient nationale tant que la logistique n'existe pas.
- Impact : `src/sim/strategic/economy.ts`. Statut : A.

## 2026-10-03 — D-25 Géométrie en anneaux concentriques
- Décision : carte générée depuis `data/map/paradis.layout.json` : anneaux concentriques découpés en secteurs ; chaque district est un secteur adossé à la porte de son mur, du côté indiqué par le fichier 06 (« anneau Maria » / « anneau Rose »). Rayons de Sina/Rose/Maria = `?` (valeurs de travail), hauteur des murs 50 m = C, épaisseur 10 m = `?`.
- Justification : le découpage en provinces est une abstraction (06 §0) ; tout reste éditable (polygones dans `data/map/paradis.json`, éditeur reporté).
- Statut : A (orientations des districts : 11 §2).

## 2026-10-03 — D-26 Répartition de la population
- Décision : 1 000 000 d'habitants (02 §15, A) répartis selon le niveau de population de l'atlas (poids 0/1/2/4/7/11). Statut : A.

## 2026-10-03 — D-27 Catalogue des bâtiments
- Décision : `data/buildings/` (même mécanique de collections que le reste) plutôt que `data/catalogs/` (10 §11) ; ses champs chiffrés comptent comme données d'équilibrage. 11 bâtiments en P1 (ceux qui ont un effet économique) ; les 60 du 10 §3 arrivent avec la construction (P3).

## 2026-10-03 — D-28 Données validées dans le Worker
- Décision : le Worker embarque et valide les JSON (Zod) puis renvoie la source validée au fil principal à l'initialisation. Zod reste hors du paquet principal ; les mêmes fonctions servent sous Node (`readDataFiles`).

## 2026-10-03 — D-29 Rendu : traits en pixels, texte à taille constante
- Décision : les épaisseurs de trait sont exprimées en pixels écran ; les couches sont redessinées à chaque palier de zoom (×√2). Les toponymes gardent une taille constante (échelle inverse du zoom) ; les noms de murs sont posés lettre à lettre sur l'anneau.

## 2026-10-03 — D-30 Overlays sans données
- Décision : religion et légitimité (P2), ravitaillement (P3), renseignement (P5) sont déclarés mais « non encore ouverts » : aucune valeur inventée ; quand un calque est actif, les provinces sans valeur restent neutres.

## 2026-10-03 — D-31 Overlay « Gaz »
- Décision : en l'absence de stocks provinciaux (D-24), le calque montre la capacité de stockage de gaz par province (dépôts, fabriques, magasins des murs). Statut : A.

## 2026-10-03 — D-32 Saisons
- Décision : seul l'hiver modifie la production (−35 % de nourriture, 02 §1) ; il ajoute un chauffage au gaz et −2 à la cible de moral. Les autres saisons sont neutres. Statut : A.

## 2026-10-03 — D-33 Tolérance d'arrondi
- Décision : une rupture n'est déclarée qu'au-delà de 10⁻⁶ unité manquante (une fabrique qui vide exactement son stock ne déclenche pas d'alerte).

## 2026-10-03 — D-34 Bruit du pilote WebGL en test
- Décision : `smoke:map` ignore les messages « GL Driver Message … GPU stall due to ReadPixels » émis par le rendu logiciel de Chromium headless ; toute autre erreur ou alerte de console fait échouer le test.

## 2026-10-03 — D-35 Raccourcis
- Décision : codes physiques (`KeyboardEvent.code`) ; en cas de conflit, échange des touches ; seuls les champs de saisie de texte et les listes déroulantes conservent leurs touches (défaut trouvé par `smoke:map` : une case cochée bloquait les raccourcis).

## 2026-10-03 — D-36 Écran de jeu
- Décision : la page de démarrage de P0 devient l'écran de jeu ; graine et empreinte d'état restent visibles en pied de bandeau. `smoke:page` renvoie désormais à `smoke:map`.

## 2026-10-03 — D-37 Anglais partiel
- Décision : le sélecteur de langue existe ; les textes non traduits retombent sur le français (aucune clé brute affichée). La traduction complète est prévue en P10.

## 2026-10-03 — D-38 Équilibrage initial ajusté
- Décision : après simulation d'un an (`sim:year`), rendements ramenés à nourriture 760, pierre de glace 330, acier 25, commerce 20 : l'hiver creuse la réserve (≈ −3 200/jour), le reste de l'année la reconstitue ; aucune rupture la première année au rationnement normal.

## 2026-10-03 — D-39 Dépendance ajoutée
| Paquet | Pourquoi |
|---|---|
| pixi.js 8 | Rendu WebGL de la carte (00 §4), utilisé uniquement dans `src/render` (règle ESLint) |

## 2026-10-03 — D-40 Commits groupés en P2
- Décision : T2.2–T2.5 (personnages, société, politique, conseillers) et T2.6–T2.8 (registres de l'interface) sont livrés chacun en un commit : ces tâches partagent l'état v3 et le contexte des registres ; un découpage aurait produit des commits intermédiaires qui ne compilent pas.

## 2026-10-03 — D-41 Ville-usine exploitée dans le scénario 850
- Décision : dans `scn_sandbox_850`, la province `ville_usine` reste contrôlée par Paradis avec ses bâtiments (mine de pierre de glace, fabrique de gaz). Sans cela, le gaz s'épuise en quelques mois, alors que le canon montre l'ODM en usage en 850.
- Lore : la localisation exacte de la ville-usine est `?` (11 §9) ; le contrôle est un paramètre du scénario (`control`), documenté dans `notes_canon`. **À trancher par l'utilisateur si une source plus précise existe.**

## 2026-10-03 — D-42 Production agricole du scénario 850
- Décision : `production_mult.food = 2.8` [A]. Il compense la perte de Maria par la mise en culture de l'intérieur de Rose et du Sina ; calibré par `sim:year` (aucune rupture de vivres la première année au rationnement normal).

## 2026-10-03 — D-43 Morts en P2
- Décision : une mort passe uniquement par la commande `CharacterDies` (cause, circonstances). En P2, seules la console de service (`mort <id> [cause]`) et les tests l'emploient. Les combats (P3–P4) et les événements canon (P5) l'utiliseront ensuite. Aucune mort n'est déclenchée automatiquement en P2.

## 2026-10-03 — D-44 Secrets jamais affichés
- Décision : les champs `hidden` (identités et secrets, ex. Krista Lenz → Historia) sont chargés mais jamais affichés. L'interface montre `display_name`. La révélation est prévue en P5 (événements).

## 2026-10-03 — D-45 Divergence assumée
- Décision (F-LOR-09) : un personnage encore vivant après `active_until` déclenche une seule fois une alerte « divergence assumée » dans le journal. Rien d'autre ne change : le joueur est libre, la chronologie canon n'est pas forcée.

## 2026-10-03 — D-46 Scénario par défaut
- Décision : l'écran de jeu ouvre `scn_sandbox_850`, le premier scénario avec couche politique. `?scenario=scn_sandbox_845` reste disponible pour le bac à sable économique de P1.

## 2026-10-03 — D-47 Confirmation des décisions
- Décision (F-UIX-12/13) : décréter, abroger, soumettre au vote, passer outre un veto, nommer, signer une proposition et arrêter un budget passent par un bordereau « Signer / Annuler ». Persuader et refuser une proposition sont immédiats : réversibles ou sans coût durable.

## 2026-10-03 — D-48 Critère AC2-11 révisé (accord de l'utilisateur)
- Ancien libellé du contrôle : « raisons d'un membre : la fiche « pourquoi ? » du premier membre affiche ≥ 2 facteurs ».
- Nouveau libellé : pour chacun des membres votants, ≥ 1 facteur affiché ; au moins un membre en a ≥ 2 ; la somme des facteurs affichés égale le score affiché (à l'arrondi près). Contrôle de somme ajouté sans navigateur (`tests/sim/politics.test.ts`, 22 décrets × 8 membres).
- Raison : deux échecs de l'ancien contrôle (arrêt obligatoire du 2026-10-03). Le premier membre, Dot Pixis, n'a qu'un facteur non nul et la fiche masque volontairement une base nulle (`displayedFactors`, désormais exportée et partagée par la fiche et le test). L'ancien seuil testait une particularité du membre ; le nouveau vérifie que l'explication reconstitue le score.
