# CONTRÔLE CANON — faits de lore utilisés

> Format du fichier 05 §7 : `fait | statut | où utilisé | note`. Sources : fichiers `docs/spec/` (11 prime sur 01) et `docs/spec/ERRATA.md` (prime sur tout).
> Contrôle automatique : `npm run canon:check` (R1–R6).

## Faits utilisés en P0

| Fait | Statut | Où | Note |
|---|---|---|---|
| Shiganshina : district sud de Wall Maria | C | `data/provinces/paradis.json` (R01) | 01 §3.1, 11 §2 |
| Segment Maria-Sud / porte de Shiganshina | A (découpage) | M05 | 06 §1.2 ; porte et brèche 845 = C |
| Trost : district sud de Wall Rose, brèche en 850 | C | S01 | 06 §1.5 |
| Utgard : château dans Wall Rose, détruit en 850 | C | S06, `destroyed_year: 850` | 11 §1, §2 |
| Mitras : capitale, Wall Sina | C | I01 | 01 §3.1 |
| Erwin meurt à Shiganshina (850), charge = E41 | C | `char_erwin_smith` | 11 §3 |
| Mike meurt pendant l'invasion de Wall Rose (E24) | C | `char_mike_zacharias` | 11 §3 + errata (pas à Utgard) |
| Kenny sort en 850 (arc du gouvernement royal), mort rattachée à E35 | C / rattachement A | `char_kenny_ackerman` | errata Q2 ; affiliation exacte `?` |
| Hange, Pixis, Zackly sortent en 854 | C | personnages | 11 §3 ; `death_event` à relier (E60, E58, E57) |
| ODM standard, artillerie de mur dès 845 | C | T-ODM-01, T-ANT-01 | 13 §1, §2 |
| Lances de foudre : après la saisie des technologies de la Police intérieure (E37), Hange requise | C | T-ANT-08 | 11 §1, 13 §11 |
| Scellement par durcissement après E13 | C | T-FOR-03 | 13 §5, §11 |
| Fusils anti-Titan de Marley : existence confirmée, date de développement inconnue | C / date `?` | T-MOD-05 + `evt_850_marley_antititan_rifle` (`?`) | 11 §6, errata Q1 |
| Ordre des événements E09 → E42 (année 850) | C (existence, ordre) | `data/events/canon_850.json` | 12 §1, §3 ; mois toujours `?` |
| E19 : moment et morts de l'escouade d'origine | ? | E19 | 11 §9 |
| E31 : localisation du combat de rue | ? | E31 `location: "?"` | errata Q2 |
| E29 se déclenche pendant E32 | C | E29 `after: E32` | 12 §3 |
| Calendrier 360 jours, saisons | A | `src/sim/core/time.ts` | D-16 |

## Incohérences relevées dans les spécifications (non corrigées)

| Point | Où | Traitement |
|---|---|---|
| 134 provinces (00, 06) contre ≈ 70 + 60 (01 §3.3) | 00/01/06 | 06 fait foi pour le contenu (P1) |
| W07 « proche d'Ehrmich » | 06 §1.4 | **Corrigé par l'errata : proche de Krolva** (à appliquer en P1) |
| E08 sans prédécesseur dans le graphe | 12 §3 | E09 est la racine de la graine P0 |
| `evt_trost_breach_845` (Trost tombe en 850) | 05 §1 | Format D-01 |
| Mike « à Utgard » dans E26 | 12 §1 | 11 + errata : E24 |
| Kenny lié à E31 avec `?` | 12 §1, §4 | Errata : E35 ; sérum (T-MED-05) = E35 ou E47 |

## Points restant `?` (paramétrables dans `data/`)

Voir 11 §9 et 01 §10 : dates de mort d'Eld, Gunther, Oluo, Petra, Moblit, Pasteur Nick, Sasha, Magath, Keith Shadis ; localisation de la ville-usine, de la forêt des Arbres Géants, du camp d'entraînement, du QG du Corps, de la chapelle Reiss ; année des Murs (743) ; distances entre murs ; blindés, sous-marins, gaz de combat ; composition de l'alliance anti-Eldia ; durée du Grondement ; rôle des Tybur dans la Grande Guerre.

## Faits utilisés en P1

| Fait | Statut | Où | Note |
|---|---|---|---|
| 74 provinces de Paradis (10 outre-murs, 22 segments, 42 provinces) | A (découpage) | `data/provinces/paradis.json` | 06 §1 ; toponymes `A` = noms de remplissage |
| Districts : Shiganshina (sud, Maria) ; Utopia N, Karanes E, Trost S, Krolva O (Rose) ; Orvud N, Stohess E, Ehrmich S, Yarckel O (Sina) | C | carte, `tests/data/map.test.ts` | 11 §2 |
| Ragako, Dauper, Jinae au sud de l'intérieur de Rose | C | carte | 11 §2 |
| W07 proche de Krolva | errata | `data/provinces/paradis.json`, carte | errata utilisateur (corrige 06 §1.4) |
| Raiberg retiré, remplacé par « Bourg minier de Maria » | A | R04 | 11 §2 |
| Murs ≈ 50 m | C | `data/map/paradis.layout.json` | 11 §2 |
| Épaisseur ≈ 10 m ; rayons et distances entre murs | ? | idem | 01 §3.1, 11 §9 |
| Localisation : forêt des Arbres Géants, ville-usine, QG du Corps, camp d'entraînement, chapelle Reiss, Utgard | ? | positions de carte | 11 §9 (existence C) |
| Pierre à éclatement de glace = source du gaz d'ODM | C | fabrique de gaz (conversion) | 11 §6 ; procédé et chiffres A |
| Population ≈ 1 000 000 ; Garnison 20 000–40 000 ; Brigade 2 000–5 000 ; Corps 200–500 | A | scénario bac à sable | 02 §15 (33 200 soldats au départ) |
| Hiver −35 % de nourriture, chauffage | A | `data/balance/economy.json` | 02 §1 |
| Rationnement −15/−30 %, moral −3/−8, productivité −5/−12 % | A | idem | 02 §3.2 |
| Charbon = dépendance de Marley (pas de production à Paradis) | A | HUD (masqué pour Paradis) | 02 §3.1 |
| Brouillard « inexploré » sur 7 des 10 provinces outre-murs | A | `visibility` | 04 §3 ; choix de jeu |

## Faits utilisés en P2

| Fait | Statut | Où | Note |
|---|---|---|---|
| 52 personnages : 34 canon, 18 de remplissage (conseillers, officiers, notables) | C / A | `data/characters/paradis.json` | 01 §4, 11 §4 ; chaque personnage porte `canon` et `notes_canon` |
| Chefs en 850 : Erwin Smith (Corps d'exploration), Dot Pixis (Garnison), Nile Dok (Brigade spéciale), Keith Shadis (instructeur), Darius Zackly (commandant suprême), Pasteur Nick (culte des Murs), Rod Reiss (noblesse) | C | scénario 850 (`org_leaders`) | 11 §4 |
| Identité de Krista Lenz (Historia Reiss) | C, secrète | champ `hidden`, jamais affiché (D-44) | révélée à E27, événements en P5 |
| Fenêtres de présence (`active_from` / `active_until`) ; années floues → règle `year_min` | C / ? | personnages | errata utilisateur ; dates de mort `?` de 11 §9 laissées paramétrables |
| Mike Zacharias meurt à E24 (pas à Utgard) | errata | `active_until` / événement P5 | errata utilisateur |
| Mort de Kenny = E35 | C | référence d'événement (P5) | réponse Q2 de l'utilisateur |
| Attributs 0–100, 43 traits, stress et seuils | A | `data/traits/traits.json`, `data/balance/politics.json` | 02 §9 |
| 8 strates (royauté, noblesse, bourgeoisie, militaires, clergé, paysans, bas-fonds, réfugiés) | A (découpage) | `data/strata/strata.json` | 02 §10 ; existence des groupes C (11 §5) |
| 8 organisations : Corps d'exploration, Garnison, Brigade spéciale, Brigade d'entraînement, culte des Murs, Cabinet, cour, guildes | C (existence) / A (guildes, chiffres) | `data/organisations/paradis.json` | 11 §3 |
| 43 décrets (6 catégories), effets différés | A | `data/laws/paradis.json` | 08 §4 ; aucun décret présenté comme canon |
| 18 rôles du conseil, biais des conseillers | A | `data/roles/roles.json` | 08 §3 |
| Ville-usine exploitée en 850 | ? (localisation) | scénario 850, `control` | D-41 ; 11 §9 |
| Population 780 000, réfugiés de Maria, culture de l'intérieur de Rose | A | scénario 850 | D-42 |
