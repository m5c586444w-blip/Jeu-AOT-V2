

# 14 — PROMPT D'EXÉCUTION : PHASE 0 (FONDATIONS)

> À utiliser avec une IA de code capable d'exécuter des commandes (Claude Code, par exemple). **Joins les fichiers 00 à 13**, colle le prompt du §1, puis ne passe à la phase 1 qu'après validation du rapport de fin de phase (§7).
> Ce fichier ne contient **aucun code de jeu** : seulement la demande, les critères d'acceptation et des vecteurs de test. Je n'ai pas pu exécuter de code ici ; les valeurs de référence du §4 ont été calculées avec Node 22.

## 0. MODE D'EMPLOI

1. Crée un dossier vide `murs-et-sang/` et place-y les fichiers `00` à `14` dans `docs/spec/`.
2. Ouvre l'IA de code dans ce dossier et colle le prompt du §1.
3. L'IA te rend un **plan de P0** (étape de revue) ; tu valides, elle exécute.
4. À la fin, colle le prompt du §7 : elle produit le rapport (commandes lancées, sorties réelles, trois listes de faits).

## 1. PROMPT À COLLER

```
Tu vas construire la PHASE 0 d'un jeu de stratégie personnel (usage non commercial) dans l'univers
de L'Attaque des Titans. Les spécifications complètes sont dans docs/spec/ (fichiers 00 à 14).

AVANT DE CODER, lis dans cet ordre : 00, 01, 11, 05 (§5 P0), puis 14 (ce fichier). Les autres
fichiers serviront aux phases suivantes ; ne les implémente pas maintenant.

Étape 1 (obligatoire, sans écrire de code) : rends-moi
 (a) un résumé de ta compréhension de P0 en 10 lignes maximum ;
 (b) la liste des ambiguïtés ou contradictions repérées dans les fichiers ;
 (c) ton plan en tâches T0.1 à T0.15 (voir §2) avec, pour chacune, la commande qui prouvera
     qu'elle est terminée.
Attends ma validation.

Étape 2 : exécute les tâches dans l'ordre, UN COMMIT PAR TÂCHE. Après chaque tâche, lance
`npm run verify` (dès qu'il existe) et corrige avant de continuer.

Règles non négociables :
- TypeScript strict, aucun `any`. Le dossier src/sim n'importe ni DOM ni Pixi, et n'utilise jamais
  Math.random ni Date.now (le temps et l'aléa sont injectés).
- Tout fait de lore est marqué C / A / ? et suit le fichier 11, qui prime sur le fichier 01.
  N'invente aucun fait : en cas de doute, marque ? et rends la valeur paramétrable dans /data.
- Aucun asset de l'œuvre. Polices auto-hébergées (aucun CDN), licences listées dans
  docs/ASSETS_LICENSES.md.
- Si une commande ne peut pas être exécutée dans ton environnement (réseau, droits...), DIS-LE
  explicitement. N'écris jamais « tests verts » sans avoir collé la sortie réelle.
- Pas de gameplay, pas de carte, pas de combat : P0 = fondations uniquement (voir §6).
```

## 2. TÂCHES DE LA PHASE 0

| # | Tâche | Livrables |
|---|---|---|
| T0.1 | **Dépôt et outillage** | Vite + TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`), ESLint (flat config), Vitest, `.gitignore`. Scripts : `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `data:validate`, `canon:check`, `sim:balance` (stub), `verify` |
| T0.2 | **Arborescence** | Dossiers du fichier 00 §5 (`src/sim/{core,strategic,tactical,characters,ai,events}`, `src/data`, `src/render`, `src/ui`, `src/audio`, `src/i18n`, `src/tools`, `tests`, `docs`) |
| T0.3 | **RNG seedé** | `Rng` (mulberry32) : `next()`, `int(min,max)`, `pick`, `shuffle`, `fork(label)`, état sérialisable. **`fork` dérive de la graine initiale et du label (hash FNV-1a), pas de l'état courant**, pour qu'ajouter un fork ne change pas la suite du parent |
| T0.4 | **Temps de jeu** | `GameDate {year, day}`, année de 360 jours (12 mois × 30), saisons de 3 mois, `advance(days)`. Départ : an 845, jour 1. Choix à consigner dans `DECISIONS.md` (`A`) |
| T0.5 | **Bus d'événements et commandes** | Bus typé ; `Command` (`AdvanceDays {n}`, `SetFlag {key,value}`, `Noop`) ; validation (n entier 1–3650) ; journal de commandes ; `replay(initialState, commands)` |
| T0.6 | **État et hash** | `GameState` versionné (`schemaVersion`), `serialize/deserialize`, registre de migrations, `stateHash(state)` (JSON canonique à clés triées + FNV-1a 32 bits) |
| T0.7 | **Sauvegardes** | Couche IndexedDB (créneaux, **3 sauvegardes automatiques rotatives**), export/import en fichier JSON, erreurs explicites sur fichier corrompu |
| T0.8 | **Chargeur de données** | Schémas Zod pour `Province`, `Character`, `Tech`, `EventDef` (avec `active_from/active_until/death_event`, `unlock_event`, `min_year`, `destroyed_year`, `canon`). Erreurs avec **chemin de fichier + chemin JSON**. `npm run data:validate` |
| T0.9 | **`canon:check`** | Outil CLI avec les règles R1–R6 du §3. Code de sortie 1 en cas d'échec, message `R# fichier id : explication` |
| T0.10 | **i18n minimale** | `fr.json` (principal), `en.json` (amorce), `t(key, params)` ; test qui échoue si une clé littérale utilisée dans `src/` manque dans `fr.json` |
| T0.11 | **Console de debug** | Surcouche en page (touche F2) ; commandes : `help`, `seed`, `date`, `advance N`, `hash`, `save`, `load`, `canon` |
| T0.12 | **Page de démarrage** | Une seule page : titre de travail, version, graine, date, hash d'état, console. Voir la checklist visuelle du §5 |
| T0.13 | **Worker de simulation** | La simulation s'exécute via `createSim()` ; un wrapper Web Worker l'expose. Le **même code** sert en direct et en Worker |
| T0.14 | **Graines de données** | `/data` minimal du §3.3, valide pour `data:validate` et `canon:check` |
| T0.15 | **Documentation** | `README.md`, `docs/DECISIONS.md` (≥ 6 entrées), `docs/CANON_CHECK.md`, `docs/ASSETS_LICENSES.md` |

### État minimal à implémenter (point de départ)

```ts
interface GameState {
  schemaVersion: 1;
  seed: number;
  rng: { state: number };
  date: { year: number; day: number };
  world: { noise: number; flags: Record<string, boolean> };
  commandIndex: number;
}
```

Système de test : à chaque jour avancé, un tirage du RNG met à jour `world.noise` (de sorte que le hash dépende de la graine et du nombre de ticks).

## 3. RÈGLES `canon:check` (T0.9)

| Règle | Contrôle |
|---|---|
| **R1** | Toute technologie a `min_year` ; toute technologie `canon: "C"` avec `min_year ≥ 850` a un `unlock_event` |
| **R2** | `tech.min_year` ≥ année de l'événement référencé par `unlock_event` |
| **R3** | Tout personnage a `active_from ≤ active_until` ; si `death_event` existe, l'événement existe et son année ≤ `active_until` |
| **R4** | Les dépendances d'événements (`after`) référencent des événements existants, **sans cycle**, et l'année d'un événement ≥ celle de son prédécesseur |
| **R5** | Aucun événement, unité ou personnage n'est situé dans un lieu après son `destroyed_year` |
| **R6** | Toute entité a `canon ∈ {C, A, ?}` |

### 3.1 Jeux de test (fixtures)

- `tests/fixtures/good/` : données valides → `canon:check` sort avec le code 0.
- `tests/fixtures/bad/` : **un fichier par règle**, chacun doit échouer avec la règle attendue :
  1. `r1_thunder_spear_no_unlock` : Lance de foudre `canon: C`, `min_year: 850`, sans `unlock_event` → **R1**.
  2. `r2_thunder_spear_too_early` : `unlock_event: evt_850_police_tech_seized` mais `min_year: 849` → **R2**.
  3. `r3_character_window_inverted` : `active_from: 850`, `active_until: 845` → **R3**.
  4. `r4_event_cycle` : A après B, B après A → **R4**.
  5. `r5_unit_at_destroyed_place` : unité à Utgard en 851 (`destroyed_year: 850`) → **R5**.
  6. `r6_missing_canon_tag` : province sans `canon` → **R6**.

### 3.2 Test d'intégrité de la chaîne d'outils

Un test Vitest lance `canon:check` sur chaque dossier de fixtures et vérifie code de sortie et identifiant de règle.

### 3.3 Graines de données minimales (T0.14)

À écrire d'après les fichiers 06, 07, 12 et 13 (vérifiés par le fichier 11) :

- **Provinces** : `R01` Shiganshina (C), `S01` Trost (C), `S06` Utgard (C, `destroyed_year: 850`), `I01` Mitras (C), `M05` Maria-Sud/porte (A).
- **Personnages** : Erwin (`active_until: 850`, `death_event: evt_850_erwin_charge`), Mike (850), Kenny (850), Hange (854), Pixis (854), Zackly (854).
- **Technologies** : ODM standard (départ), Lance de foudre prototype (`unlock_event: evt_850_police_tech_seized`, `min_year: 850`), Scellement par durcissement (`unlock_event: evt_850_trost_plug`, `min_year: 850`), Fusil anti-Titan (`min_year: 850`, `canon: C`, avec `unlock_event`).
- **Événements** : au moins E10 (brèche de Trost), E11, E12, E13, E26 (Utgard), E37, E40, E41, avec leurs dépendances d'après le graphe du fichier 12 §3.

## 4. VECTEURS DE TEST (calculés avec Node 22)

Algorithme mulberry32 de référence :

```js
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
```

| Graine | 5 premières valeurs (10 décimales) |
|---|---|
| 42 | 0.6011037519, 0.4482905590, 0.8524657935, 0.6697340414, 0.1748138987 |
| 12345 | 0.9797282678, 0.3067522645, 0.4842054215, 0.8179344125, 0.5094283693 |

Graine 42 : valeur du **1000ᵉ appel** = `0.6425111389` ; 1001ᵉ = `0.3865283413`.

FNV-1a 32 bits : `fnv1a("canon")` = `49169776` (hex `2ee4570`).

## 5. CRITÈRES D'ACCEPTATION (TOUS VÉRIFIABLES)

| # | Critère | Comment le vérifier |
|---|---|---|
| AC-01 | Installation propre | `rm -rf node_modules && npm ci && npm run verify` → code 0 |
| AC-02 | Typage strict | `npm run typecheck` : 0 erreur ; ESLint interdit `any` et échoue sinon |
| AC-03 | Pureté de `src/sim` | `npm run lint` échoue si `src/sim` importe DOM/Pixi ou utilise `Math.random` / `Date.now` (règles `no-restricted-imports` / `no-restricted-properties`) ; un test d'exemple prouve l'échec |
| AC-04 | RNG conforme | Test Vitest comparant les 5 valeurs des deux graines du §4, le 1000ᵉ et le 1001ᵉ appel de la graine 42 |
| AC-05 | `fork` indépendant | Test : (a) `fork("a")` ≠ `fork("b")` ; (b) créer un fork ne change pas la suite du parent ; (c) même label + même graine = même suite |
| AC-06 | FNV-1a | Test : `fnv1a("canon") === 49169776` |
| AC-07 | Déterminisme | Test : 1000 ticks (graine 42, mêmes commandes) lancés **deux fois** → hash identique ; graine 43 → hash **différent** |
| AC-08 | Rejeu | Test : état obtenu par `replay(initial, journal)` a le **même hash** que l'état vivant |
| AC-09 | Sérialisation | Test : `deserialize(serialize(s))` a le même hash que `s` ; un état de `schemaVersion` plus ancien est migré par un exemple de migration |
| AC-10 | IndexedDB | Tests avec `fake-indexeddb` : sauvegarde/chargement, **rotation à 3 sauvegardes automatiques**, JSON corrompu → erreur explicite sans plantage |
| AC-11 | Export/import | Test : export → import redonne le même hash |
| AC-12 | Validation des données | Données valides passent ; données invalides échouent avec un message contenant le **chemin du fichier** et le **chemin JSON** (test sur le motif) |
| AC-13 | `canon:check` | Dossier `good` → code 0 ; chacun des 6 dossiers `bad` → code 1 avec la règle attendue (§3.1) ; `/data` → code 0 |
| AC-14 | i18n | Test : clé manquante dans `fr.json` → échec ; `t()` interpole les paramètres |
| AC-15 | Console de debug | Tests unitaires de `advance 10` (date changée), `seed`, `hash` (format hexadécimal sur 8 caractères) |
| AC-16 | Worker = direct | Auto-test `sim:selftest` : même hash après 1000 ticks en direct et via le Worker (dans le navigateur ou Node `worker_threads`) |
| AC-17 | Aucun CDN | `grep -R "fonts.googleapis\|fonts.gstatic\|cdn\." src dist` ne renvoie rien |
| AC-18 | Build | `npm run build` réussit ; JS gzip hors polices < 600 Ko (valeur à consigner dans le rapport) |
| AC-19 | Page de démarrage | `npm run dev` : page sans erreur console ; affiche titre, version, graine, date (an 845, jour 1), hash ; **F2** ouvre la console |
| AC-20 | Documentation | `README.md`, `docs/DECISIONS.md` (≥ 6 entrées), `docs/CANON_CHECK.md`, `docs/ASSETS_LICENSES.md` présents et non vides |

### Checklist visuelle (revue manuelle, fichier 04 §2)

- [ ] Aucune police système ; polices libres auto-hébergées (par exemple EB Garamond pour le texte, IM Fell pour les titres, Special Elite ou Courier Prime pour la console).
- [ ] Aucun élément « carte arrondie + ombre douce » ; aucun dégradé violet/bleu ; aucune icône emoji.
- [ ] Fond de papier généré sans image externe (bruit procédural SVG/canvas) ; au moins deux niveaux de matière (fond, cadre).
- [ ] Console de debug en style « machine à écrire » lisible.
- [ ] Lisible à 100 % et 125 % de zoom.
- [ ] Capture d'écran jointe au rapport.

## 6. HORS PÉRIMÈTRE (À NE PAS FAIRE EN P0)

- Aucune carte stratégique, aucun rendu Pixi au-delà de ce qui est nécessaire pour une page de démarrage.
- Aucune économie, aucun personnage jouable, aucun combat, aucune IA.
- Aucun contenu de lore long : les graines de données du §3.3 suffisent.
- Pas d'optimisation prématurée ; pas de dépendances superflues (liste justifiée dans `DECISIONS.md`).

## 7. PROMPT DE FIN DE PHASE (À COLLER APRÈS LA T0.15)

```
Phase 0 terminée. Fournis un rapport avec :
(a) la commande de lancement et la sortie RÉELLE de `npm run verify` (colle-la) ;
(b) un tableau AC-01 à AC-20 : OK / KO / non vérifiable, avec la preuve (sortie ou capture) ;
(c) la liste « fait / partiel / manquant » ;
(d) trois listes distinctes :
    1. affirmations sourcées dans mes fichiers (cite le fichier et la section),
    2. interprétations ou adaptations (A),
    3. éléments non confirmés ou laissés paramétrables (?) ;
(e) les dépendances installées et leur justification ;
(f) les entrées ajoutées à DECISIONS.md et CANON_CHECK.md.
Ne démarre pas la phase 1 sans mon accord. Si un critère n'a pas pu être vérifié, écris-le
explicitement : n'affirme jamais qu'un test passe sans avoir collé sa sortie.
```

## 8. PIÈGES FRÉQUENTS À SURVEILLER

| Piège | Pourquoi c'est un problème |
|---|---|
| `JSON.stringify` sans tri de clés pour le hash | Hash instable selon l'ordre d'insertion |
| `Date.now()` dans les sauvegardes ou la simulation | Détruit le déterminisme ; injecter une horloge dans les tests |
| `fork` dérivé de l'état courant du RNG | Ajouter un fork change la suite du parent |
| Tests IndexedDB sans `fake-indexeddb` | Tests qui ne tournent pas en Node |
| Données `canon: C` tardives sans `unlock_event` | Réintroduit les anachronismes corrigés dans le fichier 11 |
| Polices chargées depuis un CDN | Viole la règle « aucun CDN » et casse hors ligne |
| Code de sortie 0 malgré des erreurs | `canon:check` et `data:validate` doivent échouer avec le code 1 |
| Déclarer « tout est vert » sans sortie collée | L'IA doit prouver chaque critère |

