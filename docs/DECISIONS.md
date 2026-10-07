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
- Statuts (précisés par l'utilisateur le 2026-10-03, voir D-49) : **localisation = `?`** (11 §9) ; **rattachement à Paradis en 850 = `A`**, paramètre de scénario, **jamais présenté comme canon**. Le canon montre seulement l'ODM en usage en 850.

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

## 2026-10-03 — D-49 Statut de localisation et de rattachement (demande de l'utilisateur)
- Décision : deux champs distincts du statut d'existence.
  - `location_canon` (province) : statut de la position sur la carte. La ville-usine a `canon: C` pour son existence (11 §6) et `location_canon: ?` (11 §9).
  - `control_canon` (scénario) : statut d'un rattachement donné dans `control`. Le scénario 850 donne `prov_ville_usine: A`.
- Nouvelle règle **R7** de `canon:check` : le rattachement d'une province à localisation `?` doit porter un statut, et ce statut ne peut jamais être `C`. Fixture d'échec : `tests/fixtures/bad/r7_uncertain_location_as_canon`.
- Le dossier de province affiche les deux tampons (« Localisation : ? », « Rattachement : A »), chacun avec sa fiche « pourquoi ? ».

## 2026-10-04 — D-50 Périmètre de P3
- Décision : P3 couvre les expéditions et la logistique (05 §5). S'y ajoutent les fonctions de phase P3 directement liées : générateur de soldats, lettres aux familles, blessures et séquelles, calque de ravitaillement.
- Reportées, avec leur phase cible (`docs/phases/P3.md` §3) :
  - expéditions secrètes → P5 ;
  - réparations en campagne → P4 ;
  - transport par route, rail ou mer → P7 ;
  - fonctions politiques et sociales de phase P2/P3 sans lien avec les expéditions → P5 ou P9.
- Raison : 05 §11 et son rappel final (cohérent et profond plutôt que vaste).

## 2026-10-04 — D-51 Densité de Titans propre au scénario
- Décision : le fichier des provinces décrit les lieux et garde sa densité de départ. La densité de Titans d'un scénario (ex. Maria perdue en 850) est un paramètre de scénario `titan_density` `[A]`. Le fait que Maria soit tombée est `[C]` ; les valeurs sont `[A]`.

## 2026-10-04 — D-52 Graphe de routage et franchissement des murs
- Décision : la simulation ne lit pas les polygones de la carte. `npm run map:generate` en dérive `data/geo/paradis.json` : ancres, zones, arêtes en km, portes. Un test vérifie qu'il est à jour.
- Règle `[A]` : chevaux et chariots ne franchissent un mur (passage d'une zone à une autre par un segment) que par une porte listée dans la carte (Rose-Est = porte de Karanes `[C]`). Longer un mur reste possible.
- `loadWorld` (Node) emprunte désormais le même chemin que le Worker (`readDataFiles` + `worldSourceFromFiles`).

## 2026-10-04 — D-53 Unités de gaz
- Décision : une unité du stock national de gaz vaut 10 unités d'ODM `[A]`. Le réservoir d'un soldat fait 100 u d'ODM (03 §3.2) ; un engagement en consomme 3 à 8 par soldat engagé (02 §15). Ainsi, une expédition de 100 soldats emporte environ 2 000 unités de stock (réservoirs + recharges), sur 25 000 en 850.

## 2026-10-04 — D-54 Logistique : escortes, retours, commit groupé
- Commit groupé : T3.3 à T3.6 (logistique, planification, auto-résolution, rapport) partagent le contexte d'un jour militaire (`MilCtx`) et l'état v4 ; un découpage aurait produit des commits qui ne compilent pas (comme D-40).
- Escorte d'un convoi : prise sur la première garnison de la Garnison du chemin, en pratique la porte franchie (Rose-Est pour Karanes). Elle y revient quand le convoi arrive ou est perdu.
- Retour des chariots `[A]` : trajet abstrait ; chevaux et chariots sont rendus dès la livraison.
- Effets politiques du retour : modificateurs décroissants de la légitimité et de la loyauté du Corps (mécanisme des deuils de P2). Ils apparaissent donc d'eux-mêmes dans le « pourquoi ? » de ces cibles.
- Le pré-brief applique au stratège et à l'intendant la même « lentille » que les avis du conseil (`advisorLens`, extraite de `adviceFor`).

## 2026-10-04 — D-55 Modèle d'auto-résolution v1
- Chaque jour : contacts tirés suivant une loi de Poisson, dont le taux dépend de la densité, de la taille de la colonne, de la saison et du temps ; la nuit compte pour une fraction (`night_share`).
- Chaque contact : détection (formation, temps, tactique du commandant), puis fusée rouge ou noire (03 §7). Une erreur de lecture est possible. Ensuite, soit une réorientation (fusée verte), soit un engagement.
- Engagement : morts tirés selon une loi log-normale (queue droite épaisse), plus une rupture de formation rare, plus probable face à un anormal ou en colonnes. Puis blessés graves, mort par hémorragie ou infection sauf présence de médecin (03 §9), gaz de 3 à 8 u par homme engagé (02 §15).
- Officiers nommés : moins exposés, un Ackerman encore moins (03 §3.1). Leur mort passe par `CharacterDies` (dossier, deuils de P2).
- Tous les chiffres sont dans `data/balance/expeditions.json` et calibrés par `sim:expeditions` (T3.7).

## 2026-10-04 — D-56 Calibrage des expéditions (T3.7)
- Premier passage de `sim:expeditions` (AC3-07), avant calibrage : **KO**, mortalité moyenne 44,9 % pour l'éventail ; colonnes à 92,9 %. **Échec n° 1 d'AC3-07.**
- Corrections :
  - `deaths_base` passe de 1,2 à 0,8 `[A]`.
  - L'ampleur d'une rupture de formation est bornée par `max_engaged`, identique pour toutes les formations. Elle croissait avec l'effectif engagé, donc doublait pour les colonnes.
  - Colonnes lourdes conformes à 03 §6 (« sécurité accrue, vitesse réduite ») : exposition par engagement 0,8 au lieu de 1,3 ; détection 0,45 ; esquive 0,35 ; allure 45 km/j.
- Exploration hors commande (60 tirages par réglage), puis second passage de la commande officielle : **OK**. Éventail : moyenne 30,3 %, p10 15 %, p90 52,4 %, max 83,8 %. Colonnes : 64,7 %. Sortie : `docs/reports/P3-sim-expeditions.log`.

## 2026-10-04 — D-57 Interface des expéditions (T3.8–T3.9)
- Registre « Expéditions » (touche E) : expéditions en campagne (rappel), dépôts et convois, rapports. Le planificateur s'ouvre sur le côté gauche pour laisser visible la moitié est de la carte, où partent les itinéraires de Karanes. Tant qu'il est ouvert, un clic sur la carte prolonge l'itinéraire (plus court chemin depuis la dernière étape, règle des portes) au lieu d'ouvrir le dossier de province.
- Champs numériques : ils gardent leurs chiffres (« 1 » ne change plus la vitesse quand on saisit une provision).
- Lettres aux familles : trois modèles sobres, choisis de façon stable par défunt. Ils sont rédigés sans accord de genre, car les personnages nommés n'ont pas de genre dans les données et on n'en invente pas.
- Calques :
  - « Ravitaillement » ouvert (F-STR-13).
  - « Titans » lit désormais la densité du scénario (D-51).
  - « Religion » et « Légitimité », annoncés pour P2, restent fermés et sont annoncés pour P5. Il n'existe ni système religieux, ni légitimité provinciale : afficher une valeur nationale identique partout n'aurait aucun sens.

## 2026-10-04 — D-58 Correctif de la règle des portes (D-52)
- Défaut trouvé en préparant `smoke:expedition` : le contrôle ne portait que sur un pas « province → segment → province ». Un chemin longeant plusieurs segments franchissait donc le mur sans porte (Karanes → Utgard → Rose-Nord-Est → Rose-Nord → Gorge du Silence).
- Correction : une suite de segments reliant deux zones différentes doit contenir une porte. Le plus court chemin porte dans son état la zone d'entrée et la porte rencontrée. Test ajouté : tout plus court chemin de Karanes vers Maria passe une porte, et l'ancien chemin est refusé (`route.no_gate`).
- Lecture `[A]` : franchir la porte puis longer le pied du mur avant de s'en écarter est permis.

## 2026-10-04 — D-59 Architecture de P4
- Simulation tactique pure à 20 Hz (`src/sim/tactical`). Une bataille se définit par sa graine, son scénario et son journal d'ordres (rejeu exact).
- « Jouer » un engagement d'expédition : la campagne se met en pause ; la bataille jouée se conclut par la commande `ResolveBattle { ordres }`, qui rejoue la bataille dans la simulation. Le résultat reste déterministe et rejouable, comme toute commande.
- Auto-résolution : le modèle d'engagement de P3 reste la référence. La simulation tactique est calibrée pour s'en approcher à ±15 % en pertes moyennes ; le calibrage de P3 (AC3-07) est inchangé.
- 60 FPS (05 §5) : non mesurable dans l'environnement (Chromium headless sans GPU). On mesure ce qui dépend du code : pas de simulation et temps JS par image. Le débit réel sur GPU reste à confirmer par l'utilisateur à la revue de fin de P4.
- 8 types de Titans purs (F-TIT-01) : 4 classes de 03 §5.2 × variantes de comportement `[A]`, aucune présentée comme canon.

## 2026-10-04 — D-60 Calibrage du combat tactique et taille d'échantillon d'AC4-08
- Défauts de conception trouvés par le diagnostic et corrigés, avant tout calibrage chiffré :
  - un Titan ne frappait que sa cible : il frappe désormais le soldat le plus proche à sa portée ;
  - aucune réserve de gaz : les soldats chutaient réservoir vide. Il existe maintenant une réserve de 12 u, et le rail est lâché à mi-réserve ;
  - en forêt, les soldats zigzaguaient d'arbre en arbre près de la nuque. Règle explicite : Titan à portée → crochet dans son corps (passe d'attaque).
- La menace de classe (données de P3 : 1 ; 2 ; 3,5) règle :
  - la cadence d'attaque, × menace^1,5 ;
  - la difficulté de coupe, ÷ menace^1,3 (nuque plus épaisse des grandes classes) `[A]`.
- Valeurs `[A]` : coupe de base 0,15 ; esquive 0,25 ; cadence d'attaque 0,48–0,88 s ; frappe mortelle 0,72.
- **Taille d'échantillon** : une bataille contre un petit Titan tue 0, 1 ou 2 hommes. Sur 100 batailles, le bruit de la moyenne atteint ±16 % ; le critère de ±15 % ne serait donc pas mesurable. AC4-08 passe à **1 000 batailles par type**, ce qui donne un bruit d'environ 5 %. La référence d'auto-résolution est calculée sur les mêmes configurations (4 tirages par graine). Révision faite **avant** toute mesure officielle ; le critère est plus exigeant, pas plus lâche.
- Exploration (hors commande officielle) : écart maximal de 5 % sur les graines 1–1 000 et de 9 % sur les graines 1 001–2 000.

## 2026-10-04 — D-61 Interface tactique et mesure de performance
- **Échelle** : les figures suivent l'échelle réelle (homme 1,8 m ; Titan 3–15 m), avec une taille minimale à l'écran (soldat 9 px, Titan 22 px). Sinon, en vue large, un homme ferait moins d'un pixel. La caméra s'ouvre cadrée sur les unités, à 3 px/m au plus.
- **Projection** : oblique « gravure » (y × 0,62, la hauteur monte à l'écran), sans perspective, pour garder la lisibilité des volumes et la stabilité des positions.
- **Performance** :
  - Figures : une figure de Titan ou de soldat est construite **une fois par apparence** (GraphicsContext partagé), puis seulement déplacée et mise à l'échelle.
  - Cartes d'escouade : mises à jour en place, 8 par image à tour de rôle.
  - Carte stratégique : rendu suspendu pendant la bataille.
  - Mesure : le rendu Pixi est appelé dans la boucle de l'écran de bataille (pas de ticker propre). Le « temps JS par image » d'AC4-09 inclut donc simulation, préparation des figures, rendu et interface. La décomposition par poste est publiée (`data-js-parts`).
- **Premier passage de `smoke:tactique` : KO** (p95 17,8 ms avec 300 unités). Diagnostic : la carte stratégique continuait d'être rendue sous l'écran de bataille, en WebGL logiciel, ce qui donnait 3,5 images/s ; la simulation rattrapait donc 6 pas par image. Les figures étaient aussi reconstruites à chaque image. Le second passage, après correctifs, est OK (p95 4,4 ms, 157 images). Les deux journaux sont conservés.
- **Bataille d'essai** (registre des expéditions) : escarmouche hors campagne, sans aucun effet sur l'état. Elle sert à essayer les cartes et les Titans, et aux contrôles.
- **Planche des figures** (`src/ui/tactical/specimenSheet.ts`) : outil de revue (AC4-13) chargé par `smoke:tactique` ; absente du jeu et du paquet de production.
- Touches : pendant une bataille, les raccourcis de la carte sont neutralisés ; Espace = pause active.

## 2026-10-04 — D-62 Revue de P4 : sens du calibrage et contrôle de réalisme indépendant
L'auto-résolution n'a **pas** été dérivée ni calibrée à partir des batailles jouées. Son modèle d'engagement (`engagementMedian`, log-normale à queue épaisse et rupture rare, 03 §12) a été calibré en P3 sur la seule mortalité par expédition de 02 §15 (25–40 % `[A]`, D-56). En P4, il a été extrait en fonction partagée sans changement de formule ni de valeur : `data/balance/expeditions.json` est inchangé depuis T3.7, et les facteurs de terrain de l'auto-résolution valent tous 1, jamais réglés. Le calibrage s'est fait **dans l'autre sens** : c'est le combat tactique qui a été réglé pour s'approcher de l'auto-résolution (D-60). AC4-08 vérifie donc une concordance obtenue par construction, pas le réalisme de l'un ou de l'autre ; c'est une limite, et je la signale. Pour la compenser, `sim:tactical` ajoute un contrôle de réalisme indépendant. Il porte sur des grandeurs **émergentes** de la simulation tactique, qui n'ont servi à aucun calibrage, et sur des graines tenues à l'écart du calibrage (1001–2000). Ses critères sont fixés ici, **avant toute mesure** :
- **R-gaz** : pour chacun des 6 engagements types, le gaz consommé par homme engagé et par bataille reste dans **[3, 8] u** (02 §15 `[A]`). Ce chiffre ne règle que l'auto-résolution ; en tactique, le gaz résulte de la physique de l'ODM.
- **R-nuit** : sur l'ensemble des 6 engagements types, les pertes moyennes **de nuit** sont **inférieures** à celles **de jour** (03 §5.2 : Titans moins actifs la nuit). Aucun paramètre n'a été réglé sur cette comparaison.
- Exclu : l'usure des lames, car le nombre de coupes par paire est une donnée d'entrée (`wear_per_cut`). Le vérifier serait circulaire.
- **Résultats** (`docs/reports/P4-revue-realisme*.log`) :
  - **R-gaz : KO** — 2,4 u (petit Titan), 5,7 u (moyen), 10,6 u (grand).
    - Cause : le gaz suit le nombre de passes d'attaque (11, 19 et 33 par bataille), et ce nombre suit la difficulté de coupe ÷ menace^1,3 calibrée en D-60 pour s'accorder aux morts de l'auto-résolution. Ramener le gaz dans [3, 8] u défait ce calibrage : c'est un **choix de conception ouvert**, renvoyé à la revue de P8 (options dans `docs/PROGRESS.md`). Je ne l'ai pas tranché seul.
    - Conséquence connue : contre un grand Titan, jouer coûte environ deux fois plus de gaz qu'auto-résoudre.
  - **R-nuit, 1re mesure** : 0,00 mort de nuit, mais en trompe-l'œil : **100 %** des batailles de nuit finissaient au temps limite, sans contact. Les Titans étaient déployés à environ 240 m, et la vue de nuit porte à 40–80 m. Défaut corrigé : de nuit, la bataille naît d'un contact à courte portée, donc les Titans sont déployés à portée de vue nocturne des escouades. Le déploiement de jour est inchangé : mêmes tirages, AC4-08 identique au centième.
  - **R-nuit, 2e mesure : OK** — 0,34 mort de nuit contre 1,17 de jour ; 54 % des batailles de nuit au temps limite.

## 2026-10-04 — D-63 Revue de P4 : lisibilité de l'écran de bataille
- **Cartes d'escouade** : quatre tiennent dans la largeur (largeur = (barre − 3 espaces) / 4, 12 rem au moins, boutons repliés sur deux lignes). Au-delà, la barre défile horizontalement, avec une barre de défilement visible.
- **Vue d'ensemble** : sous **4 px/m**, chaque escouade porte une pastille numérotée de taille constante, posée au-dessus de ses hommes (liseré brique en repli, pastille ocre pour les officiers). Les soldats deviennent des points de 3 px, et les Titans sont agrandis à 42 px au moins. Au-delà du seuil : figures complètes, sans pastilles.
- **Cadrage** : la vue s'ouvre en **couvrant** la zone des unités, à 30 % au plus au-delà du cadrage « tout voir » et 6 px/m au plus. La caméra est bornée à la carte, sans bande vide inutile ; contrôle : le sol couvre au moins 90 % de la scène. Ceci remplace le plafond de 3 px/m de D-61.
- **Inclinaison de la vue** : passée de 0,62 à **0,8**. La carte de 400 × 300 m projetée (400 × 240) a alors le rapport d'aspect de la scène, et le sol remplit l'écran sans rognage excessif.
- Contrôles de la revue, **1er passage KO** (`docs/reports/P4-revue-smoke-tactique-essai1-KO.log`) :
  - le sol ne couvrait que 82 % de la scène : carte trop large pour l'inclinaison 0,62, et cadrage tiré vers le ciel par la hauteur des Titans ;
  - la sélection au clic visait un soldat sorti du champ, désormais possible avec le cadrage « couvrir ». Le test vise maintenant le premier soldat visible.
  - Correctifs : inclinaison 0,8, cadrage sur l'emprise au sol rognée à la carte.
  - **2e passage OK** : couverture 100 %, 47 pastilles, sélection, p95 4,7 ms avec 300 unités.
- **Mesure « ms/image · unités »** : masquée, affichée par **F2** (mode debug) pendant la bataille. La console de la carte ne s'ouvre pas sous la bataille.
- **60 FPS** : **non vérifié, GPU réel requis** (l'utilisateur n'a pas de poste local). Ne bloque pas.

## 2026-10-04 — D-64 Données de P5 : événements, technologies
- **Graphe** : le graphe des événements (12 §3) est porté par les champs `window.after`, qui sont la source unique. Il n'existe pas de fichier `graph.json` en double. Les bifurcations (12 §2) sont un champ `bifurcation` de l'événement. `canon:check` refuse les cycles (R4).
- **Squelettes** : E01–E08 et E43–E60 sont saisis sans mécanique (`playable: false`), pour que les technologies puissent les citer (`unlock_event`). Au début de 850, ceux des années passées comptent comme « passés ».
- **Fenêtres** : délai en jours après le prédécesseur, toujours `?` (12 : mois inconnus). Choix et effets : `A`, avec exactement un choix historique par événement canon à choix.
- **Événement de l'errata Q1** (fusil anti-Titan) : non jouable en P5, côté Marley (P7).
- **Technologies** : les 76 du fichier 13 sont générées depuis ses tables. Hizuru et les Alliés forment un seul arbre (« Hizuru et Alliés », 13 §9), d'où 9 arbres (F-TEC-01). Les 12 doctrines (13 §10) s'y ajoutent. Interprétations `[A]` :
  - T-ODM-03 (extraction du gaz) est possédée au départ : la production de gaz existe dès 845 dans l'économie ;
  - T-HIZ-01 est rattachée à E48 (la pierre est obtenue après le contact avec Paradis) ;
  - T-INT-08, technologie de Marley, est rattachée à E50.
- **R8–R10** :
  - R8 : sur le chemin historique d'un événement, un personnage ne meurt qu'à son `death_event`, et chaque `death_event` jouable le tue ;
  - R9 : références des effets et des conditions ;
  - R10 : un événement n'exige pas une technologie postérieure à son année.

## 2026-10-04 — D-65 Mort d'Erwin : E42 plutôt qu'E41
- 11 §3 : Erwin meurt à Shiganshina (850). 12 attribue sa mort à la charge (E41), mais le choix du sérum (E42) se fait « entre Erwin et Armin ». Il faut donc qu'Erwin, mortellement blessé, soit encore en vie à E42.
- Décision `[A]` : E41 (charge) le blesse à mort (drapeau `erwin_mortally_wounded`). E42, choix historique « Armin », le fait mourir. `death_event` = E42. Le choix « Erwin » (divergence maximale) n'est offert que s'il a été blessé à la charge.
- Hannes : `death_event` = E28 `[A]` (11 §3 : arc de l'invasion de Wall Rose, Titan souriant).

## 2026-10-04 — D-66 Forme canonique de l'état après chaque commande
- Défaut latent révélé par P5 : un état relu d'une sauvegarde a ses clés triées, un état vivant non. Les sommes flottantes qui parcourent ces objets (provinces, stocks) diffèrent alors au dernier chiffre, et une partie rechargée diverge de la partie vivante. Le test d'aller-retour de P2 l'a montré dès que les événements ont fait varier le moral.
- Correctif : l'état initial et l'état après chaque commande sont mis en forme canonique (clés triées), exactement comme une sauvegarde relue. Coût : une copie par commande ; le tick quotidien n'est pas touché.
- **Isolation des outils de P3** : `sim:expeditions` et les tests d'expédition et de P2 qui supposent qu'aucun événement ne tue utilisent le monde 850 **sans chronologie**. Sinon, E19 tuerait par exemple les officiers que le plan type engage. Résultat de `sim:expeditions` : inchangé (30,3 %).

## 2026-10-04 — D-67 Fenêtres des événements de 850 resserrées
- Premier passage de `sim:events` : **KO**. Sur 3 graines sur 20, la chronique E09 → E42 débordait sur 851. En mode automatique, chaque décision attend son échéance (5 jours) avant de programmer la suite. Au pire, avec les délais maximaux et toutes les décisions à l'échéance, la chaîne durait 430 jours. 12 situe E09–E42 en 850.
- Décision : maxima resserrés (E09, E14–E17, E20, E21, E30–E32, E36–E39 ; E38 : 20–40 jours au lieu de 30–60). Les fenêtres restent `?` et paramétrables. Le pire cas tombe à 342 jours, garanti par un test de données (≤ 355).
- Les successeurs restent programmés depuis la **décision** et non depuis le déclenchement, car E13 dépend du choix fait à E12.
- Second passage : OK (20/20 graines ; dernier événement au plus tard le jour 313).

## 2026-10-04 — D-68 Titans-porteurs : état, héritage, horloge (P6)
- **Couche v7 `shifters`** : pour chaque Titan, le porteur (personnage ou `null`), le camp (`paradis`, `marley`, `inconnu`, `perdu`), l'année d'héritage et son statut, capturé, retiré, visions ; doses de sérum ; dossiers d'héritage. Les porteurs de 850 viennent des données (`holder_850`).
- **Porteurs de Marley sans fiche** (Zeke, Pieck, Lara Tybur, plus tard Porco) : le Titan est « tenu par Marley » sans nom. À l'échéance de ses 13 ans, Marley le transmet à un nouvel héritier sans nom (`relais_marley`, `[A]`), car Marley transmet ses Titans avant la mort de leur porteur (11 §4 : chaînes de transmission). Aucun nom n'est inventé.
- **Horloge** : années restantes = 13 − (année − année d'héritage), valeur expliquée. La mort tombe au 1er jour de l'année d'échéance (cause « malédiction d'Ymir »). Le jour précis est `[A]` : les spécifications ne donnent que l'année.
- **Mort sans ingestion** : le pouvoir passe à un nouveau-né eldien inconnu (02 §10, `[C]`) et sort du jeu pour tous les camps (`perdu`).
- **Héritage préparé** (`InheritTitan`) : il exige un porteur vivant, au service de Paradis ou capturé, une dose de sérum et un héritier vivant. Ses coûts sont prévus avant la décision puis appliqués à l'identique : porteur dévoré, dose consommée, 13 ans pour l'héritier, stress de l'héritier et de ses proches, loyauté de son organisation, légitimité. Les valeurs sont `[A]`, dans `data/balance/shifters.json`.
- **Effets d'événement** : `inherit`, `serum`, `capture_shifter` et `shifter_faction`.
  - E35 apporte la dose de Kenny.
  - E42 : Bertholdt est capturé, puis l'élu (Armin, historique ; Erwin, divergence) le dévore.
  - E28 : Ymir part avec les guerriers ; la Mâchoire passe à Marley.
  - E28 « arrestation » : Reiner et Bertholdt sont capturés, donc héritables.
  - R8 compte un `inherit` comme la mort du porteur de 850 ; R9 vérifie `heir` et `shifter`.
- **Visions** (F-TIT-06) : chaque mois, un tirage par porteur de Paradis. Une vision est un rapport de renseignement « rumeur » sur la densité de Titans d'une province hors des Murs ; il est faux dans 40 % des cas (`[A]`) et une observation le confirme ou le dément. Les visions ne vont pas au journal, pour ne pas évincer les alertes.
- **Fondation** : la Coordonnée exige le drapeau `royal_contact` (02 §10) ; sinon la raison du verrou est affichée. Aucun événement de 850 ne le pose, et le Grondement reste en P7.

## 2026-10-04 — D-69 Porteurs en bataille tactique (P6)
- Le corps transformé est une entrée de `titans`, liée à son porteur (`shifter`), pour partager le rendu, le ciblage et l'ancrage ODM. Les corps alliés (`ally`) ne sont jamais visés par les soldats. La victoire exige qu'aucun Titan hostile ne soit debout, porteur ennemi pas encore transformé compris.
- Points de vie par zones (nuque, bras, jambes). Une coupe réussie entame la nuque, une coupe partielle un membre. Les lames font 10 et les lances de foudre 30 (`[A]`). La nuque à zéro donne « vaincu » : le porteur est arraché au corps, ce qui compte comme un Titan abattu au bilan.
- Endurance : la transformation coûte 20 et le corps s'use de 0,4 par seconde (la Charrette deux fois moins). La régénération coûte 0,5 point d'endurance par point de vie, et le durcissement 3 par seconde. À zéro, le porteur est « épuisé » et se détransforme, avec une recharge de 30 s avant de se retransformer. Délai de transformation : 1 à 3 s (03 §8.1).
- Perte de contrôle (F-TIT-14) : au-delà d'un stress de 80 ou de la moitié des points de vie perdus, une crise survient avec une chance de 2 % par seconde. Pendant 8 s, le porteur frappe le plus proche, alliés compris.
- Les 16 capacités sont des effets fermés (`SHIFTER_EFFECTS`), chacun mesuré (`stats.abilities`) : `sim:shifters` en exerce chacune en bataille.
  - Interprétations `[A]` : l'onde de chaleur brûle et rend la nuque intouchable ; le cri d'appel attire les purs, qui dévorent le porteur le plus proche (E20) ; la Coordonnée du Bestial accélère les purs ennemis.
  - Le Marteau de guerre a une nuque qui encaisse trois fois mieux : le porteur n'y est pas (03 §8.2 « corps à distance »).
  - La Charrette ravitaille les soldats alliés en gaz et en lames.
- Les lances de foudre (dotation de 2 par soldat, T-ANT-08) ignorent l'armure et le durcissement. Résultat : le Cuirassé est vaincu dans 6 batailles sur 6 avec lances, et dans 0 sur 6 aux lames seules.

## 2026-10-04 — D-70 Échelle du monde : des nations, pas un second Paradis (P7)
- Contexte : 05 §5 (P7) demande provinces du monde, guerre moderne simplifiée, diplomatie, IA et une partie jouable côté Marley. Les spécifications ne fixent pas l'échelle de simulation de Marley.
- Décision :
  - le monde se joue à l'échelle des **nations** ;
  - économies de guerre agrégées : industrie, hommes, soutien à la guerre, stabilité ;
  - **formations** de 10 §1.2–1.3 posées sur les 60 provinces de 06 §3 et l'île Paradis ;
  - Paradis y est résumé à partir de son état détaillé (part de l'acier et de la main-d'œuvre) ; ses 74 provinces restent simulées par P1–P6.
- Justification : 05 §11 (« profond mais jouable »), 02 §11 (« front, artillerie, aviation, marine » simplifiés). Un second moteur province par province pour Marley doublerait le coût sans rien apporter de lisible.
- Atlas : positions et voisinages schématiques `[A]` ; un seul atlas d'encre en P7, esthétiques de Marley et d'Hizuru en P8.
- Personnages étrangers (`faction` marley, hizuru, allies, volontaires) : hors des registres et des tirages de Paradis (`isDomestic`). Les porteurs de Marley ont une identité secrète pour Paradis (champ `hidden`), percée au départ de 854 pour Zeke.

## 2026-10-04 — D-71 Guerre moderne et Titans stratégiques (P7)
- **Front** : une résolution par semaine, par province disputée.
  - Puissance = Σ formations × état × attaque (ou défense).
  - Multiplicateurs : appui d'artillerie (part des batteries), supériorité aérienne, reconnaissance, terrain et fortification en défense.
  - Pertes en racine du rapport de force, bruit de ±15 %.
  - Prise à partir d'un rapport de 1,3, ou face à un défenseur sans troupes ; le défenseur se replie.
  - Toutes les valeurs sont `[A]`, dans `data/balance/world.json`.
- **Mer** : la zone appartient à la flotte la plus forte, avec une marge de 1,2. Le blocus coupe 40 % de l'industrie côtière. Embarquer exige des transports, débarquer exige la mer. Deux flottes en guerre dans une même zone se battent.
- **Titans** (F-WAR-08) : un porteur projeté vaut 12 à 80 points de puissance au front selon sa classe (`[A]`).
  - Premier passage : la Forteresse du Passage ne tombait jamais. La puissance a été doublée et le seuil de prise abaissé à 1,3, pour qu'une projection décide d'une bataille que l'infanterie seule ne gagne pas.
  - Usure : 8 de stress par semaine, 2 % de risque de mort par semaine de combat (le Titan est alors perdu, P6), repos de 4 semaines après un rappel.
  - Coût politique : +6 de peur chez toutes les autres nations, +3 de soutien chez soi, −2 de légitimité à Paradis.
- Les porteurs du combat tactique (P6) restent hors des batailles de la campagne. La guerre moderne ne passe pas par la scène tactique (hors plan).

## 2026-10-04 — D-72 Diplomatie, Hizuru, IA (P7)
- **Acceptation** d'une proposition : utilité expliquée, comptée au-delà de 10.
  - Facteurs : confiance × 0,4 + intérêt × 0,4 + idéologie × 0,2 ; peur × 0,3 pour la paix et la non-agression.
  - Biais par traité ; impossible en guerre.
  - La coalition alliée **vote** (trois voix, majorité, F-DIP-09).
- **Hizuru** (07 H01) : penchant de −100 (Marley) à +100 (Paradis). Au-delà de ±60, alliance avec ce camp ; retour à la neutralité si le penchant retombe. Moteurs mensuels :
  - commerce : 1 par mois ;
  - peur relative de chaque camp : 2 par mois au plus ;
  - garanties payées en industrie : ±15 chacune.
  - Premier réglage (3 et 4 par mois) : Hizuru basculait seul en un an. Il a été ramené pour qu'une bascule demande des décisions du joueur (AC7-03).
- **IA** (02 §14) : utilité et règles, avec une personnalité par nation (poids d'attaque, de levée, de diplomatie, de prudence).
  - Attracteur canon de Marley (le Fondateur) : guerre à Paradis quand ses autres guerres ne l'occupent plus.
  - Levées seulement si le revenu peut les entretenir. Premier réglage : pénuries en chaîne ; corrigé.
  - Attaques au-delà d'un rapport de force, projections de Titans sur les fronts actifs.
  - Chaque décision est consignée avec ses raisons (chancellerie, débogage).
  - Limite assumée : l'IA ne monte pas d'invasion amphibie de Paradis (P9).

## 2026-10-04 — D-73 Événements de 854 (P7)
- E53 à E58 sont jouables. Leurs effets passent par le monde (`world_war`, `world_relation`, `world_losses`, `world_support`, `world_hizuru`) :
  - E55 : Eren dévore Lara Tybur (`capture_shifter` puis `inherit`) ;
  - E56 : Zeke passe à Paradis ;
  - morts canon de 854 (11 §3) : Willy Tybur (E55), Zackly (E57), Pixis et Nile (E58).
  - Sasha (854 `[?]`, non vérifié) n'est pas tuée.
- E59 (Grondement) et E60 restent scénarisés, sans mécanique (P9).
- Règle : un squelette sans mécanique commencé avant l'année du scénario compte comme « passé ». Sans elle, la guerre du Moyen-Orient (E50, 851–854), ni passée ni jouable, bloquait E53.
- E43–E52 restent des squelettes. Une partie de 850 s'arrête à E42 ; le scénario 854 part de leur issue canonique.

## 2026-10-04 — D-74 Menu principal et bandeau (P8)
- Le menu principal (04 §5.1–5.2 : table d'archives, tiroir des scénarios, chemises à couverture, blasons) s'ouvre par `?menu=1` ou par le bouton du bandeau. Sans paramètre, la partie s'ouvre directement : les contrôles de non-régression de P1–P7 chargent l'adresse nue et attendent la carte. C'est aussi plus commode en développement.
- Le bandeau ne passe plus sur deux lignes (revue de P5) : les registres sont des icônes dessinées (libellé en bulle et pour les lecteurs d'écran), placées sur la ligne du pied, entre l'alerte et la graine.
- Blasons : emblèmes originaux (enceintes de Paradis, tour étoilée de Marley, soleil et vagues d'Hizuru, sabres et étoile des Alliés), aucun emblème de l'œuvre (04 §8.5).

## 2026-10-04 — D-75 Audio par synthèse (P8)
- 04 §7 autorise « synthèse (WebAudio) + banques libres de droits ». Seule la synthèse est retenue : aucun fichier à licencier, aucun poids ajouté au paquet, et l'absence d'échantillon de l'œuvre se vérifie mécaniquement.
- Trois couches (calme, tension, combat) jouent en permanence sous trois gains croisés. L'humeur vient de l'état :
  - combat : une scène tactique est ouverte ;
  - tension : une bataille attend, une expédition est dehors, la nation jouée est en guerre, ou une alerte date de moins de 10 jours ;
  - calme : sinon.
- Accents : Marley (caisse claire, fanfare de quintes), Hizuru (cordes pincées en gamme in sur ré).
- Mixage : ducking de 3 s sur une alerte majeure ; silence de 3 s puis cloche sur la mort d'un personnage nommé ; effets d'interface (papier au clic, tampon sur un ordre accepté).
- Le contexte audio démarre au premier geste (politique de lecture automatique des navigateurs). Sans WebAudio, le jeu reste muet, sans erreur.
- Sous-titres des sons importants : pas de Titan, cri, canon, cloche, transformation. Ils sont actifs par défaut et se désactivent dans les options.

## 2026-10-04 — D-76 Revue automatique par écran (P8)
- `smoke:p8` traduit la checklist de 04 §2 en contrôles mesurés dans la page :
  - police : la première famille calculée de tout texte visible appartient au projet, et cette police est chargée ;
  - icône générique : aucune classe de bibliothèque d'icônes, aucun emoji ;
  - « card + shadow + rounded » : aucun élément à coins arrondis (≥ 6 px) et ombre floue (> 1 px) ;
  - texture : au moins deux éléments à image de fond ou canvas sur la chaîne de l'écran ;
  - valeurs : toute `.valeur` porte un « pourquoi ? » ;
  - texte factice : aucun « lorem », « TODO », `undefined`, `NaN`, gabarit `{x}`, clé ou identifiant brut ;
  - lisibilité : aucun débordement horizontal ni texte coupé ; corps minimal ≥ 11 px × échelle (− 0,6 px de tolérance d'arrondi).
- Quatre passes : 1366×768 et 3840×2160, à 100 % et 125 %.
- La revue visuelle « sans template look » reste humaine. C'est l'objet de l'arrêt de revue de fin de P8.

## 2026-10-05 — D-77 R-gaz : gaz par classe de Titan (options c + a, décision de l'utilisateur)
- **Décision de l'utilisateur** (revue de P8) : options (c) + (a) de D-62.
- **Sources.** L'auto-résolution des expéditions (`engage`) et le pré-brief (`estimatePlan`) consomment désormais le gaz selon la classe du Titan engagé. La table vient du combat tactique, mesurée sur les graines de calibrage 1–200, 12 hommes contre 1, plaine et forêt :
  - petit : 2,7–3,1 u ;
  - moyen : 5,3–5,4 u ;
  - grand : 10,0 u ;
  - Anormaux : 11,4 (sauteur) à 23,0 u (rampant).
- **Plages retenues** `[A]`, dans `data/balance/expeditions.json` → `engagement.gas_per_engaged_by_class` :
  - `titan_petit` [2, 4] ;
  - `titan_moyen` [4, 7] ;
  - `titan_grand` [8, 12,5] ;
  - `titan_anormal` [9, 21].
- **Consommation.** Elle est tirée uniformément dans la plage de la classe. Le seuil « gaz insuffisant » est la borne basse de la classe. Le pré-brief prend la moyenne des milieux de plage, pondérée par la fréquence des classes.
- **Ce que la table remplace.** La plage unique [3, 8] u de 02 §15 se lit désormais comme « un combat type contre un Titan moyen » (option a) : elle reste vraie en moyenne pondérée. ERRATA > 02, mais aucun errata ne couvre ce point : c'est une décision `[A]` de l'utilisateur.
- **Contrôle indépendant.** `sim:tactical -- --realisme` reste ce contrôle, sur les graines 1001–1250 que le calibrage n'a jamais vues. R-gaz y vérifie, classe par classe, que le gaz moyen par homme au combat tactique (tous les types de la classe, deux terrains) tombe dans la plage consommée par l'auto-résolution. R-nuit est inchangé.
- **Mortalité.** Elle est inchangée : 31,9 % pour l'éventail, contre 25–40 %. Le nombre de tirages aléatoires est identique, et le réservoir d'une expédition type ne s'épuise pas.
- **Test modifié et pourquoi.** `tests/data/expeditions.test.ts` exigeait `gas_per_engaged = [3, 8]`. Il encodait la donnée que l'utilisateur a décidé de remplacer : le tester tel quel reviendrait à refuser la décision. Le test vérifie désormais :
  - que la table couvre toutes les classes de Titan ;
  - que les plages croissent du petit au grand ;
  - qu'une classe absente est refusée.

## 2026-10-05 — D-78 Zone de jeu ≥ 85 % : définition de la mesure et correctif 4K (R0.3)
- **Ce que la consigne laisse ouvert.** La consigne fixe le seuil (≥ 85 %), mais ne définit pas « l'espace disponible ». Mesure retenue (`smoke:r0`), sur une grille de 48 × 27 points par `elementFromPoint` :
  - **carte stratégique** : espace disponible = la fenêtre sous le bandeau ; zone de jeu = les points où le canevas de la carte est au premier plan, non recouvert par un panneau ;
  - **bataille** : espace disponible = la boîte de la scène (sans la barre de titre, le carnet de combat ni les cartes d'escouade, qui sont l'interface) ; zone de jeu = les points où le canevas est au premier plan, multipliés par la part de la scène couverte par le sol de la carte.
- **Mesure avant correction** (commit 6c4963d, `docs/reports/R0-smoke-avant.log`) :
  - carte : 92,4 % (1366×768), 99,1 % (3840×2160) ;
  - bataille : 100 % (1366×768), **47,0 %** (3840×2160).
- **Cause.** Le cadrage de la bataille plafonnait l'échelle à 6 px/m en valeur absolue. Ce réglage a été fait pour une scène de 1014×588 px. En 4K, « couvrir » demande environ 8 px/m : le plafond bridait le zoom et laissait le sol au centre d'un grand vide.
- **Correctif.** Le plafond suit la taille de la scène, rapportée à la scène de référence (× min(largeur / 1014, hauteur / 588), jamais en dessous de 1). À 1366×768, rien ne change.
- **Interprétation à confirmer.** Il est possible que l'utilisateur ait entendu par « espace disponible » toute la fenêtre, interface comprise. Dans ce cas, la bataille à 1366×768 reste sous 85 %, puisque le carnet et les cartes d'escouade occupent environ 40 % de l'écran. Il faudrait alors superposer l'interface à la scène, un changement de mise en page hors du périmètre « aucune nouveauté visuelle » de R0.

## 2026-10-06 — D-79 AC3-06 : délai du test relevé, assertions inchangées (décision de l'utilisateur)
- **Le test.** `tests/sim/expeditions.test.ts` › « sur 30 tirages, l'éventail longue portée perd moins que les colonnes lourdes » simule 60 expéditions complètes.
- **Mesure, test seul** (`npx vitest run tests/sim/expeditions.test.ts -t "perd moins que les colonnes"`, trois passages) : fichier en 16,4 / 15,8 / 16,2 s, dont 94–95 % pour le test, soit environ 15 s.
- **Sous charge.** Pendant qu'un smoke navigateur tournait, il a dépassé le délai global de 30 s à deux reprises (31,8 s et 34,2 s, sorties du hook `stop-verify`), sans aucune assertion fausse.
- **Correctif.** Le délai de ce seul test passe à 90 s (environ 6 fois sa durée seule) ; le délai global de `vitest.config.ts` reste à 30 s. Le test est réputé correct : seule sa limite de temps était trop serrée.

## 2026-10-06 — D-80 Cadrage d'ouverture de bataille et flèches de bord (critère f, décision de l'utilisateur)
- **Ce qu'on garde toujours dans le champ.** Les hommes du joueur (pieds et tête, 1,8 m) et les porteurs (pieds et tête du Titan à venir) forment l'emprise « à voir absolument ». Le cadrage est un calcul pur, `src/render/tactical/framing.ts`, testé par tableau : `tests/render/framing.test.ts`, 8 scénarios.
  - Scénarios : hommes au sud et porteur au nord, l'inverse, porteur excentré, 300 unités ; chacun à 1366×768 et à 3840×2160.
- **Échelle.** C'est la plus grande qui remplit l'écran autour des unités (« couvrir », au plus 30 % au-delà de « tout voir », plafond relatif à la scène, D-78). Elle ne dépasse jamais celle qui contient l'emprise « à voir absolument ».
- **Lisibilité, telle que retenue ici.** L'échelle ne descend pas sous l'échelle « carte entière » ; à cette échelle, la vue d'ensemble garde les pastilles d'escouade et les Titans agrandis (revue de P4). La seule exception est une emprise qui l'exigerait ; aucun des 8 scénarios n'y conduit.
- **Position.** Le cadre est centré sur les unités, puis ramené sur l'emprise, y compris après le recalage sur la carte. Les marges au-delà des bords nord et sud suivent l'emprise : les têtes des porteurs au nord, la ligne de départ au sud.
- **Flèches de bord.** Chaque Titan vivant dont les pieds et la tête sont hors champ est signalé par une flèche rouge, au bord du champ, sur la droite qui joint le centre au Titan. Les flèches sont tracées à chaque image, pas seulement à l'ouverture.
- **Zone de jeu.** Le test vérifie aussi que le sol couvre au moins 85 % de la scène. Cette assertion a été ajoutée après une erreur de signe dans le ramenage : elle épinglait l'emprise au bord du champ, ne laissait que 12 % de sol, et passait les autres assertions.

## 2026-10-06 — D-81 three.js pour l'essai de rendu 3D (R1, consigne de l'utilisateur)
- **Demande.** L'utilisateur veut un aspect 3D et détaillé du combat. 03 §1 et 04 §4 demandent du 2.5D à volumes. R1 essaie three.js **sans toucher à la simulation**, pour trancher ensuite : RENDU = 3D ou RENDU = 2.5D.
- **Pourquoi three.js** (`three` 0.186.1, licence MIT ; types `@types/three`, MIT, en dépendance de développement) :
  - bibliothèque de rendu, pas un moteur : elle n'impose ni boucle, ni physique, ni éditeur ; la simulation à 20 Hz reste maîtresse (03 §1) ;
  - ESM, importable morceau par morceau, compilée par Vite sans configuration ; types TypeScript complets (TS strict, pas de `any`) ;
  - ombres portées, brume, instanciation (300 soldats), tons ACES : ce que l'essai doit montrer, sans code GLSL maison ;
  - très répandue et documentée : le risque d'abandon est faible.
- **Écartés.**
  - Babylon.js (Apache 2.0) : moteur complet, plus lourd, chevauche notre boucle.
  - PlayCanvas (MIT) : pensé pour son éditeur en ligne.
  - WebGL brut : trop de travail pour un essai.
  - Godot 4, l'alternative de 00 §86 : il remplacerait toute la pile (interface, carte, sauvegardes) ; hors de propos pour un essai.
- **Deux moteurs.** 00 §86 dit « Ne mélange pas deux moteurs ». L'essai ne mélange rien dans une même vue :
  - Pixi reste interdit dans `src/render/tactical3d` ;
  - three.js reste interdit partout ailleurs (règle ESLint, prouvée par `tests/lint/sim-purity.test.ts`).
  Si la 3D est retenue, la bataille serait en three.js et la carte stratégique en Pixi : deux bibliothèques dans l'application, une par vue. C'est un point de la décision de l'utilisateur (rapport R1).
- **Chargement.** `src/main.ts` charge `src/render/tactical3d/entry.ts` par import dynamique pour `/proto3d` ou `?proto3d`.
  - L'entrée vérifie que WebGL 2 existe (three.js l'exige depuis r163) avant d'importer three.js.
  - Sans WebGL : message clair, bouton et retour automatique au rendu 2D ; three.js n'est pas téléchargé.
  - Les textes du prototype restent dans son propre morceau (`texts.ts`) ; s'il est adopté, ils passeront dans `fr.json`.
- **Bundle principal** (build de 13c9f77 contre ce commit) : 900 697 → 901 113 octets, soit +416 octets (+0,05 %). Ce sont le routage, la table de l'import dynamique, le lien de la console F2 et son libellé. three.js y pèse 0 octet : aucune signature `THREE.`, alors que le morceau du prototype en compte 45.
- **Graine.** Les variations visuelles viennent d'une graine locale (`rng.ts`, mulberry32). `Math.random` est interdit dans le dossier par ESLint.

## 2026-10-06 — D-82 Ville irrégulière : comment on mesure l'irrégularité (R1.2)
- **Orientations : écart-type à 90° près.** Le critère demande un écart-type des orientations > 10°. Un écart-type brut des angles ne mesurerait rien : une grille parfaitement régulière a des maisons à 0° et à 90°, et son écart-type brut avoisine 45°.
  - La mesure retenue est l'écart-type circulaire de 4θ, ramené en degrés (`orientationSpreadDeg`). Une grille régulière donne 0°, ce que le test vérifie comme contrôle.
  - Sur les graines 1 à 200 : minimum 10,75°, moyenne 14,0°, maximum 19,0°.
- **Largeurs de rues : mesurées sur la géométrie.** On ne relit pas la largeur déclarée. Sur chaque rue intérieure, en 5 points (de 30 à 70 % du tronçon, loin des carrefours), on mesure la distance de l'axe à l'îlot bâti de chaque côté.
  - Contrôle : avec des rues toutes à 8 m et des îlots non tournés, la mesure donne 8 m partout.
- **D'où vient l'irrégularité.**
  - Carrefours tirés jusqu'à 9 m de leur place de grille.
  - Torsion légère autour du centre (0,0026 rad/m).
  - Largeur propre à chaque tronçon (5 à 14 m).
  - Îlots tournés sur eux-mêmes jusqu'à ±15°, puis réduits pour ne jamais empiéter sur la rue : la rue s'évase d'un côté.
- **Hauteurs** : 2 à 5 étages de 3,0 à 3,5 m, toit compris, soit 6,9 à 23 m. La carte tactique « ville » (`maps.json`) indique 8–20 m. Tout est `[A]`.
- **Enceinte** : un pan de 50 m `[C]`, 10 m d'épaisseur `[?]`, en toile de fond au nord. Son parement est lisse : pas de créneaux.

## 2026-10-06 — D-83 Titans 3D : anatomies, nuque, poses (R1.4)
- **Tailles.** 5 m et 15 m, les bornes hautes de `ttype_petit_errant` et `ttype_grand_errant` (`data/titan_types/purs.json`). Le test relit ces données, puis mesure la boîte englobante de la figure posée, sommet par sommet, à 8 instants de la marche.
- **Deux anatomies inventées pour le projet** : ce sont des proportions, pas des personnages ; aucun Titan de l'œuvre n'est reproduit.
  - Petit : trapu, tête d'un quart de la hauteur, ventre lourd, bras courts, voûté ; rictus figé, joues gonflées, petits yeux vides.
  - Grand : filiforme, petite tête sur un long cou, bras qui descendent sous le genou, mèches raides ; bouche béante, yeux exorbités.
- **Construction.** Formes de révolution et sphères déformées, accrochées à 18 articulations nommées (bassin → torse → poitrine → cou → tête → mâchoire ; épaule → coude → poignet → doigts ; hanche → genou → cheville). Il n'y a ni maillage sculpté ni peau déformée par os : c'est la limite visible de l'essai (aspect « mannequin »), discutée au rapport.
- **Poses.**
  - Marche : cycle de jambes et de bras opposés, bassin qui descend à l'écart des jambes.
  - Saisie : penché, bras droit tendu, main gauche fermée.
  - Abattu : face contre terre, membres dans le plan du sol, vapeur qui monte (03 §5.2). Pas de sang.
- **Marque de nuque.** Tache rouge derrière le cou, sous le crâne, légèrement émissive pour rester lisible la nuit ; elle s'éteint quand le Titan est abattu. C'est un repère de lisibilité du point faible (03 §4.2). Le test vérifie qu'elle est rouge, derrière la tête et à hauteur de nuque.
- **Écart trouvé par le test.** La première version annonçait des mains « sous le genou » pour le grand ; la mesure les a trouvées au-dessus (28,5 % de la hauteur, genou à 26,7 %). Les bras ont été allongés (avant-bras 0,195 → 0,215 H) ; le test compare chaque main à son propre genou.
- **Place.** Pour loger un Titan de 15 m, la place couvre deux îlots voisins, traversés par une rue (environ 90 × 35 m).

## 2026-10-06 — D-84 Caméras et qualité de l'essai 3D (R1.6)
- **Caméras** (03 §13 : « libre, suivre escouade… ») :
  - libre : orbite, zoom, déplacement ;
  - suivi d'escouade (touches 1–4) : la cible glisse vers le centre de l'escouade et la caméra garde son décalage, l'orbite reste possible. Autour du grand Titan, la caméra se place dos à lui ; sinon, côté place, face à l'escouade ;
  - vues fixes : vue Titan, vue de dessus des 300 soldats, planche des poses.
- **Qualité.** Trois préréglages, sur les postes qui coûtent sur une machine modeste :

  | Préréglage | Résolution interne | Ombres | Anticrénelage | Réverbères la nuit |
  |---|---|---|---|---|
  | Basse | 75 % | non | non | 2 |
  | Moyenne (défaut) | 100 % | 1024² | non | 4 |
  | Haute | jusqu'à 200 % selon l'écran | 2048² | oui (MSAA) | 8 |

  L'anticrénelage se fixe à la création du contexte WebGL : changer de préréglage recrée le moteur et y rebranche les contrôles.
- **Prairie.** La première texture d'herbe, à grandes taches, se répétait de façon visible vue de dessus (contraire à 04 §2.4). Elle est remplacée par une tuile de 1024 px, sans couture, à petites touches.

## 2026-10-06 — D-85 Critère f rouvert : cadrer ce qui est DESSINÉ pour le porteur, avec une marge haute (revue de R0)
- **Constat de l'utilisateur.** Sur `r0-apres-transformation.png`, la tête du porteur était coupée par la barre de titre, alors que le contrôle passait : il testait un point à mi-corps, pas l'image.
- **Cause.** Le cadrage gardait la tête « théorique », soit `reach` (hauteur moyenne du Titan à venir) plus 3 m. Or la scène dessine plus grand :
  - en vue d'ensemble, la figure est agrandie à 42 px au moins : 17,4 à 18,2 m pour un Titan de 15 m à 1366×768 ;
  - la tête dépasse le gabarit de 4 % (bornes Pixi mesurées : jusqu'à 104,1 pour 100).
- **Correctif.**
  - Le cadrage (`framing.ts`) prend la hauteur dessinée (`drawnTitanHeight`, la formule même de la scène), tête comprise (1,05 × cette hauteur), avec une marge haute de 10 px à l'écran.
  - Cette hauteur dépend de l'échelle : on cherche le point fixe (la suite des échelles décroît et se stabilise).
  - Les côtés d'un porteur sont la largeur réelle de sa figure plus 4 px, et non 6 m de plus.
- **Conflit avec D-78 (sol ≥ 85 %), et arbitrage.** Dans le scénario de test « porteur excentré » (coin nord-est, hommes au bord sud, 1366×768), les 85 % de sol et une marge de 10 px sont incompatibles.
  - Les 85 % imposent une échelle d'au moins 2,30 px/m, donc environ 20,7 m visibles au-dessus des pieds du porteur, pour une figure de 19,2 m.
  - La marge haute se réduit alors par paliers de 2 px, jusqu'à 2 px au moins, et seulement dans ce cas. Les autres scénarios gardent 10 px.
- **Éclairs.** Les zigzags tombent du ciel et sont maintenant à l'échelle du Titan, 1,4 × sa hauteur dessinée (celui de la transformation faisait 40 m fixes). Seuls leur pied et leur moitié basse sont garantis dans le champ. Les garder entiers obligerait à montrer du vide au-delà du bord nord, sous 85 % de sol.
- **Contrôles.**
  - `tests/render/framing.test.ts` calcule la boîte englobante de la figure DESSINÉE : les tracés réels de `figures.ts`, bornes Pixi, 10 silhouettes, deux sens. Il la compare à la zone visible pour les 6 scénarios à porteur.
  - `smoke:r0` compare la boîte Pixi de la figure dans la vraie page (`getBounds`, tête comprise) à la scène, et vérifie que la scène commence sous la barre de titre.

## 2026-10-06 — D-86 Environnements de R1b : choix de rendu non couverts par les spécifications
- **Titans spéciaux (Titan-Mur, Titan de Rod Reiss, Colossal).** Proportions génériques du squelette commun, à leur taille de lore (50, 120 et 60 m). Aucune reprise de leur dessin dans l'œuvre : pas de traits de visage, de musculature à nu ou de silhouette reconnaissables. Le rendu fidèle reste à décider par l'utilisateur.
- **Bundle principal « inchangé ».** Il ne peut pas rester identique à l'octet : il cite le morceau 3D par un nom haché sur son contenu. Le critère devient : même taille, et même contenu une fois les noms de morceaux hachés normalisés (plan R1b, § 1). Le worker reste identique à l'octet.
- **Teintes des textures en sRGB.** `shade()` (`texturesEnv.ts`) écrivait dans le canevas les composantes linéaires de `Color`. Le canevas étant ensuite décodé comme sRGB, toutes les teintes peintes (sols, façades) étaient assombries deux fois. Le défaut a été trouvé sur les sols souterrains, presque noirs. Corrigé : les composantes sont lues en sRGB. Les planches du lot 1 ont été refaites après la correction (façades et prés plus clairs, conformes à la palette du profil).
- **Lieux souterrains (E08, E21 cavernes, E23).** Pas de soleil sous la voûte, sauf par les puits de jour. Sans soleil, la lumière d'hémisphère de three.js (non multipliée par π depuis r155) doit être bien plus forte : 3,4 à 4,6 sous terre, contre 1,15 à l'air libre. Ses teintes viennent du profil : lanternes et `toit_2` pour la ville, cristal pour la glace, `toit_2` (bougies) pour la crypte. Lanternes, bougies et fenêtres restent allumées de jour comme de nuit. Sans ouverture, jour et crépuscule sont identiques (attendu).
- **Essence « géante » hors de la forêt (E28).** Une lisière d'Arbres Géants (74–86 m) borde les champs au nord du terrain. Ni champ, ni haie, ni ferme sous les géants.
- **Glacis de Shiganshina (E29).** Le demi-cercle de la saillie bombe vers le point de vue : la porte extérieure est à la distance du profil (400 m, `?`), et le mur principal la prolonge, un rayon de saillie plus loin.
- **Ruines sans toit.** Les murs arasés montrent leur face intérieure, en retrait de 0,4 m, sinon l'arase flottait seule quand on voyait l'intérieur.

## 2026-10-06 — D-87 Titans et soldats sur le corps de base (R1c.2–R1c.3) : choix non couverts par les spécifications
- **Lecture des paramètres de R1b sur un corps humain.** Jambes = hauteur des hanches ; torse = hanches → ligne d'épaules ; cou = épaules → menton ; tête = menton → sommet du crâne ; bras et avant-bras d'articulation à articulation ; main = du poignet au bout des doigts. Le torse garde sa longueur ; les autres segments s'en déduisent, puis le corps façonné est mesuré et corrigé (deux passes). Écarts mesurés : longueurs à ±7 %, tête, jambes et bras à ±5 %.
- **Largeur de tête.** Les têtes de R1 étaient des sphères plus larges qu'un crâne : `headW` se lit par rapport au grand Titan de R1 (0,42, le plus proche d'un humain), qui garde la largeur humaine. Les autres largeurs (carrure, bassin, profondeur, épaisseurs) se lisent directement.
- **Pieds.** Leur taille suit la longueur des jambes (comme en R1) ; sinon un pied humain sur une jambe de Titan courte le soulevait en marchant.
- **Corpulence et visage.** Corpulence tirée du rapport taille/poitrine, ventre par la cible « ventre » ; expressions par cibles de visage : rictus (coins tirés, lèvres rétractées, yeux plissés), béant (bouche et mâchoire ouvertes, yeux exorbités), neutre, creuse (orbites sombres). Sexe surtout masculin (0,65–1, sans sexe visible : le maillage de base n'en a pas).
- **Coude.** La pose de repos de MakeHuman porte les avant-bras en avant (≈ 43°) : la flexion du coude est donnée depuis le bras tendu ; les valeurs des poses de soldat ont été décalées d'autant (rendu inchangé).
- **Corps couchés.** Pose écrite debout puis basculée d'un bloc (rotations conjuguées par la bascule) ; pieds tendus, bras dans le plan des épaules (la main tombante touche le sol) ; pas de voussure.
- **Yeux.** L'atlas d'yeux de MakeHuman est lu à la convention glTF (pas de retournement) ; la cornée, transparente dans MakeHuman, est retirée (opaque, elle cachait l'iris).

## 2026-10-06 — D-88 Rendu réaliste (R1c.4) : choix non couverts par les spécifications
- **Ciel physique le jour seulement.** Modèle de Preetham de three.js (diffusion atmosphérique, nuages calculés, aucune image) en plein jour à l'air libre. À l'aube, au crépuscule et la nuit, le modèle assombrit l'horizon opposé au soleil et jure avec la brume chaude des profils : le dôme peint de R1b reste. Sous terre : dôme peint.
- **Éclairage d'image dosé.** La carte d'environnement est tirée du ciel montré, à luminance réduite (× 0,45) : l'horizon blanc, reflété en incidence rasante par tous les matériaux, délavait le sol. Avec le ciel physique, l'hémisphère est réduite (× 0,7) ; avec le dôme peint, elle garde son intensité de R1b.
- **Occlusion ambiante (GTAO) depuis la profondeur du rendu.** Pas de second rendu de la scène (normales reconstruites) : les cartes de feuillage gardent leur découpe. Contournement d'un défaut de three r186 (profondeur externe passée au constructeur). Aucune en qualité basse.
- **Ombres douces** : rayon PCF de 3 à 4 texels (le type « PCF doux » a été retiré de three).
- **Arbres procéduraux** (aucun modèle externe) : massifs bosselés à normales de volume, intérieur sombre, cartes de feuillage découpées par une texture de feuilles dessinée ; bois non teinté par le feuillage ; conifères en étages dentelés ; haies et voûte des Arbres Géants habillées de la même façon.
- **Relief** : cartes de normales tirées des textures procédurales (murs, façades, toits, pavés), détail du sol répété (6 m), rides de l'eau qui défilent, grain de peau et armure toile des uniformes.
- **Normales des pièces assemblées** (`FaceBuilder`) : la matrice inverse transposée 4 × 4 appliquée comme à un point divisait par une composante w nulle ou négative ; l'ombrage plat le masquait. Matrice des normales 3 × 3.

## 2026-10-06 — D-89 Districts d'après l'animé (R1c.5) : choix non couverts par les spécifications
- **Faits retenus, statut et sources** : `docs/reports/R1c-annexe-districts.md`. Le wiki communautaire est bloqué par la politique réseau : seuls les extraits renvoyés par la recherche ont pu être lus ; un fait vu sur un seul agrégateur est marqué `A`.
- **Rue principale droite** de la porte intérieure à la porte extérieure (« larges rues qui mènent à la porte », Trost) : la colonne de rue centrale est fixée à x = 0 après les perturbations du tracé organique ; aucune maison dont l'emprise touche la chaussée ; pavée sur toute sa longueur.
- **Portes de rivière de Shiganshina** (carte du district, épisode 2) : voie d'eau entrée par une porte d'eau de la saillie et sortie par une porte d'eau du mur principal, à l'est de la porte intérieure ; barques d'évacuation et pontons sur le dernier tronçon, ponts aux croisements des rues. Le tracé (`WATER_ROUTE`) est `A` ; les dimensions des portes d'eau (14 × 11 m) sont `?` dans `data/art/murs.json`. Herse de fer, relevée sauf en état « fermée ».
- **Trost 850** : variante `850_rocher` (porte extérieure bouchée par un rocher générique, débris au pied).
- **Casernes** : poste de la Garnison près de la porte extérieure de Shiganshina (position `A`).
- **Vues E07, E17, E20** recadrées (correctif proposé à l'arrêt de R1b) : E07 composée sur ses repères, E17 sur la rivière et les mares, E20 plus proche et plus basse sur le château.

## 2026-10-07 — D-90 Latence de R1c : mesure par type de page, carte d'environnement réduite (R1c.6)
- **Cibles par page** (04 §9), mesurées en WebGL logiciel, de la navigation à la première image :
  - scène tactique (prototype de R1 : rue, 2 Titans, 20 soldats) : < 3 s ;
  - visionneuse d'un environnement : < 8 s (chargement à froid) ;
  - pages de contrôle (banc d'échelle, galerie des environnements) : mesurées sans cible. La galerie prenait déjà 56 s avant R1c.
- **Carte d'environnement à 64 texels par face** (`ENV_MAP_SIZE`, `lighting.ts`). À 256, le filtrage PMREM coûtait ≈ 3,8 s au chargement sans GPU. Le ciel est lisse, et la carte ne sert qu'aux reflets flous et à la lumière diffuse.
- **Sonde de la scène tactique** : `window.__proto3d.timings` (début, corps, ville, Titans, soldats, réglages, première image) et nombre de programmes de shaders dans `stats()`.
- **Latence de la scène tactique en échec deux fois** (10,25 s puis 8,91 s) : arrêt, décision de l'utilisateur (`docs/reports/R1c.md` § d, § i).

## 2026-10-07 — D-91 Revue de R1c : décisions de l'utilisateur appliquées en R1d
- **Latence (options c + b)** :
  - « prêt » = ville visible avec les soldats et les Titans en repères simplifiés (figures en primitives de R1) ;
  - corps détaillés chargés ensuite ; les deux instants sont mesurés ;
  - cible de 3 s sur « prêt » en qualité basse allégée (rendu logiciel) ;
  - qualités moyenne et haute, et mesure sur GPU réel : « à vérifier » ;
  - pas de compression d'assets (jeu local).
- **Poly Haven** : textures d'environnement seulement (sol, pierre, toits), au plus 12 fichiers WebP en 1K ; `assets:check` le vérifie. Choix des matières et conversion au plan R1d.
- **Districts** : tout reste `?` ou `A` paramétrable ; pas de portes de rivière hors de Shiganshina.

## 2026-10-07 — D-92 Teintes : éclairage d'image corrigé (R1d.2, corrige D-88)
- **Cause mesurée.** Sans éclairage d'image (intensité 0, hémisphère entière), les teintes reviennent à celles de R1b :
  - scène tactique : b* 12,1 contre 12,2, L* 56,0 contre 55,4 ;
  - Trost : b* 9,7 contre 10,2.

  Le relief, l'occlusion ambiante et les normales corrigées de R1c n'y sont pour presque rien. C'est la lumière diffuse du ciel physique, très bleu, qui bleuissait et blanchissait façades, sols et ombres.
- **Réglage.**
  - Carte d'environnement tirée d'un ciel désaturé à 35 % (`ENV_SKY_SATURATION`).
  - Sol ajouté à la carte (demi-sphère basse de la teinte `hemiGround`, × 0,6) : la moitié basse ne prolonge plus le ciel.
  - Intensité de jour de 0,35 à 0,18 ; hémisphère gardée à 95 % (au lieu de 70 %).
  - Les reflets des métaux restent tirés de la même carte.
- **Mesure de mise au point** (bas de l'image, jour, qualité moyenne ; R1b → R1c → R1d) :
  - scène tactique : b* 12,2 → 6,1 → 10,7 ; ombres L10 28,4 → 40,2 → 33,7 ;
  - Trost : b* 10,2 → 4,3 → 8,7 ;
  - murs (E22) : b* 15,2 → 9,6 → 13,7.

  Mesure de fin de phase : CR1d-08.

## 2026-10-07 — D-93 Latence en deux temps et qualité basse allégée (R1d.1)
- **Repères simplifiés** = les figures en primitives de R1 (soldats et Titans). Elles ont déjà la même interface que les corps de base (poses, lanceurs, articulations) : câbles, suivi de caméra et planche restent valables. Les places sont les mêmes avant et après l'échange (mêmes graines).
- **Second temps.**
  - Le corps de base est chargé après la première image.
  - Les corps détaillés sont façonnés par morceaux, la main étant rendue à l'image entre deux morceaux : 2 Titans, puis les soldats par 4.
  - Ils sont échangés d'un coup, après compilation de leurs shaders (en parallèle si le moteur le permet, sinon d'un coup en WebGL logiciel).
  - L'instant « corps » est la première image dessinée après l'échange (`data-corps3d="pret"`, `timings.corps`).
  - La visionneuse fait de même pour ses Titans.
- **Qualité basse allégée.**
  - Sans éclairage d'image : l'hémisphère reprend toute sa part.
  - Dôme peint au lieu du ciel physique.
  - Sans cartes de relief ni détail du sol, sans cartes de feuilles (forêts, haies, voûte des Arbres Géants).
  - Densité des arbres de la qualité basse (0,32). Ombres et post-traitement déjà coupés.
  - La bascule se fait aussi à chaud (`applyLite`, `setLite`).
- **Mesure ponctuelle** (`npm run mesure:r1d -- rapide`, construction de production, WebGL logiciel) : scène tactique en qualité basse, « prêt » 1,77 s, « corps » 6,92 s.

## 2026-10-07 — D-94 Corps de base sans détail anatomique (R1d.3)
- **Organes génitaux** : absents depuis R1c. Le groupe « helper-genital » de MakeHuman (maillage d'aide, hors du corps) n'est pas repris dans le `.glb` ; aucune primitive ni cible génitale (test).
- **Entrejambe** : la peau où s'attachait cette aide (sommets du corps à moins de 4,5 cm, élargis de deux couronnes) est carénée à la construction (`assets:build`).
  - Plaque mince à bord fixe, le long de la normale de chaque sommet (`fairing.ts`).
  - Même opérateur linéaire sur le corps de référence et sur chacune des 51 cibles : tout mélange reste caréné.
  - L'opérateur (poids cotangents, normales) est recalculé sur le corps caréné jusqu'au point fixe (6 passes), pour qu'un contrôle sur le `.glb` retrouve la même surface.
- **Mamelons et aréoles** (cibles officielles « nipple-size » et « nipple-point », élargies d'une couronne) : rabattus au façonnage (`humanBase.flattenZones`) sur une **surface lissée** :
  - quadrique ajustée sur la 3ᵉ à la 5ᵉ couronne autour de la zone (la forme du sein) ;
  - plus l'écart de la peau à cette quadrique sur la 1ʳᵉ couronne, prolongé dans la zone par interpolation harmonique ; la surface rejoint la peau sans marche.
  - La pointe du sein féminin est arrondie par la cible officielle « breast-point-decr » (1,5 × (1 − sexe)).
  - Normales adoucies dans les deux zones (4 passes) : les facettes fines de l'ancien mamelon gardaient un point d'ombre.
- **Essais écartés (mesurés ou vus de près)** :
  - plaque mince des mamelons à la construction : elle prolonge la pointe du sein, et creuse ou pointe le torse masculin ;
  - projection sur la seule quadrique : plateaux ovales cernés d'un pli, surtout sur les corpulences lourdes ;
  - normales adoucies au-delà de la zone : le sein perd son modelé.
- **Mesure** (`zoneRelief`, `fairRelief`) : écart à la surface lissée, sur l'homme, le Titan de sexe 0,65, la femme et la corpulence lourde, au repos.
  - Corps de R1c (`3782acd`) : mamelons de 3,3 à 26,3 mm, entrejambe de 8,6 à 14,6 mm.
  - R1d : 0,00 mm sur les mamelons, moins de 0,5 mm sur l'entrejambe.
- **Fesses** : le sillon interfessier est la forme du corps de MakeHuman ; il reste (vue de dos revue).

## 2026-10-07 — D-95 Arbres réalistes dans la scène tactique (R1d.4)
- Les arbres de la ville de R1 (place et abords) sont rendus par la végétation des environnements (`buildVegetation`, arbres de R1c : bois séparé, massifs bosselés, cartes de feuilles) au lieu de trois icosaèdres sur un cylindre.
- **Mêmes graines** : chaque arbre prend les 22 tirages de R1 (`townTree`) ; maisons, étals et réverbères ne bougent pas.
- **Essences** : la place garde des feuillus ; aux abords, un tiers de fruitiers (vergers), le reste en feuillus. Le sommet d'un feuillu est celui de l'arbre de R1 (6 à 10 m).
- **Qualité basse** : cartes de feuilles cachées (`applyLite`), comme dans les environnements ; tous les arbres sont gardés (une centaine, pas une forêt).
