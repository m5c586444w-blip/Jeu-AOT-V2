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
