# CONTRÔLE CANON — faits de lore utilisés

> Format du fichier 05 §7 : `fait | statut | où utilisé | note`. Sources : fichiers `docs/spec/` (11 prime sur 01) et `docs/spec/ERRATA.md` (prime sur tout).
> Contrôle automatique : `npm run canon:check` (R1–R7 ; R7 ajoutée en P2, D-49).

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
| Ville-usine : existence | C | `data/provinces/paradis.json` (`canon`) | 11 §6 |
| Ville-usine : localisation sur la carte | ? | `location_canon` | 11 §9 ; D-49 |
| Ville-usine : rattachement à Paradis en 850 | A (paramètre de scénario, jamais canon) | scénario 850, `control_canon` ; règle R7 | D-41, D-49 |
| Population 780 000, réfugiés de Maria, culture de l'intérieur de Rose | A | scénario 850 | D-42 |

## Faits utilisés en P3

| Fait | Statut | Où | Note |
|---|---|---|---|
| Départ des expéditions de Karanes, porte de Rose-Est | C | scénarios (`expedition_base`), carte (porte) | 06 S02, W03 |
| Maria perdue et peuplée de Titans en 850 | C (fait) / A (densités) | scénario 850, `titan_density` | 06 §1.3 ; D-51 |
| Formation de reconnaissance longue portée ; colonnes lourdes | C (existence) / A (chiffres) | `data/balance/expeditions.json` | 03 §6, 12 E17 |
| Fusées du Corps : rouge = Titan repéré, noire = anormal, verte = changement de direction | C | auto-résolution, rapport | 03 §7, 11 |
| Titans anormaux | C (existence) / A (fréquence, menace) | `data/titans/classes.json` | 03 §5 |
| Titans moins actifs la nuit et en hiver | A (03 §5.2) | `encounters.night_share`, saison | 03 §5.2 |
| Réservoir d'ODM ≈ 100 u ; lames : 2 paires de 4–8 coupes | A | équilibrage | 03 §3.2 |
| Gaz : 3–8 u par engagement ; mortalité 25–40 % en début de partie ; Corps de 200–500 hommes | A | équilibrage, calibrage | 02 §15 ; D-56 |
| Ackerman : multiplicateurs spéciaux | C (fait) / A (valeur) | exposition des officiers | 03 §3.1 |
| Hémorragie et infection simulées ; équipe médicale | A | auto-résolution | 03 §9, 10 U-P13 |
| Types d'unités U-P01, U-P02 (C) ; U-P03, U-P04, U-P12, U-P13 (A) | C / A | `data/units/paradis.json` | 10 §1.1 |
| Soldats générés et leurs noms | A | générateur, `data/names/paradis.json` | aucun nom de famille de l'œuvre |
| Les murs ne se franchissent qu'aux portes | A | règle de routage | D-52, D-58 |
| Arme de contention, expédition 57, Titan féminin | hors P3 | — | événements E16–E19 en P5 |

## Faits utilisés en P4

| Fait | Statut | Où | Note |
|---|---|---|---|
| Seule une coupe de la nuque tue un Titan ; les membres repoussent | C | `src/sim/tactical/battle.ts` | 03 §4.2, 11 |
| Manœuvre tridimensionnelle : crochets, gaz, lames de rechange | C (existence) / A (valeurs) | `data/balance/tactical.json` | 03 §3.2, §4.1 |
| Portée des crochets 40–60 m | ? | `odm.hook_range_m`, `hook_range_canon: "?"` | 03 §3.2 |
| Réservoir ≈ 100 u ; poussée 1–2,5 u/s ; changement de lames 1,5 s | A | équilibrage | 03 §3.2, §4.1, §4.2 |
| Réserve de gaz pour freiner la descente | A | `soldiers.gas_reserve` | D-60 |
| Titans moins actifs et voyant moins la nuit | A | `titans.vision_*` | 03 §5.1 |
| Titans attirés par les humains | C | IA des Titans | 03 §5.1 |
| 8 types de Titans purs (errant, meute, coureur, sauteur, ignorant, rampant…) | A | `data/titan_types/purs.json` | aucun présenté comme canon (D-59) |
| Forêt des Arbres Géants : troncs ≈ 80 m | C (hauteur) / A (disposition) | `data/tactical_maps/maps.json` | 03 §2 ; localisation `?` (P1) |
| Mur : hauteur 50 m | C | carte « Mur » | 11 §2 ; épaisseur 10 m `?` |
| Fusées rouge, noire, verte | C | signaux tactiques | 03 §7 |
| Ackerman plus rapides et plus sûrs | C (fait) / A (multiplicateurs) | ODM | 03 §3.1 |
| Silhouettes des Titans et figures des soldats | A | dessinées par code | aucun personnage ni design de l'œuvre |

## Faits utilisés en P5

| Fait | Statut | Où | Note |
|---|---|---|---|
| Existence, ordre et contexte des événements E09 → E42 de 850 | C | `data/events/canon_850.json` | 12 §1, §3 ; délais en jours : `?` (12 : mois inconnus) ; D-67 |
| Choix proposés, coûts, effets chiffrés, règles de divergence | A | idem | 12 (en-tête) |
| Choix « historique » de chaque événement | A (interprétation) | champ `historical` | Le choix qui reproduit le récit de 12 |
| Morts de Mike (E24), Nanaba et Gelgar (E26), Kenny et Rod (E35) | C | effets des événements | 11 §3, errata (Mike E24, Kenny E35) |
| Morts d'Eld, Gunther, Oluo, Petra (E19) | ? | E19 | 11 §3 : « à vérifier » |
| Mort de Hannes rattachée à E28 | A | E28 | 11 §3 : arc de l'invasion de Wall Rose (Titan souriant) |
| Mort d'Erwin à E42 (blessé à mort à E41) | A | E41, E42 | D-65 |
| Bertholdt dévoré au choix du sérum (E42) | C (fiabilité moyenne) | E42 | 11 §3 |
| Révélations : Eren (E12), Annie (E22), Ymir, Historia, Reiner, Bertholdt (E27) | C | effets `reveal` | 12 E12, E22, E27 |
| Deux Titans capturés vivants à Trost pour l'étude | C | E11 (`captured`) | 12 E11, §4 |
| Lances de foudre après E37, Hange vivante requise | C | T-ANT-08 | 13 §2, §11 ; 11 §1 |
| Scellement par durcissement après E13 | C | T-FOR-03 | 13 §5 |
| ODM anti-personnel après E31 | C | T-ODM-06 | 13 §1 |
| Sérum : E35 ou E47 | C | T-MED-05 | errata Q2 |
| Les 76 technologies, leurs coûts et effets | C / A / ? selon 13 | `data/techs/*.json` | effets et coûts : A (13) |
| Rattachements T-HIZ-01 → E48, T-INT-08 → E50 ; T-ODM-03 possédée au départ | A | `data/techs` | D-64 |
| Doctrines exclusives | A | `data/techs/doctrines.json` | 13 §10 |
| Influence du Culte des Murs par anneau | A | `data/balance/intel.json` | 02 §5 (existence du Culte : C) |
| Bruit des rapports ±20 % | A (02 §6) | `data/balance/intel.json` | 02 §6 |
| Infiltrés de 850 (taupes) : Reiner, Bertholdt, Annie | C | champs `hidden` des personnages | 12 E27 |
| 30 événements génériques | A | `data/events/generic.json` | 12 §5 ; aucun objet ni lieu avant sa date (R10) |

## Faits utilisés en P6

| Fait | Statut | Où | Note |
|---|---|---|---|
| Les Neuf Titans et leur capacité signature | C | `data/shifters/nine.json` | 03 §8.2 |
| Chaînes de porteurs (Assaillant, Fondateur, Bestial, Mâchoire, Colossal, Cuirassé, Féminin, Charrette, Marteau de guerre) | C | `chain` ; canon:check R11 | 11 §4 (chaînes corrigées) |
| Dates de transfert hors de celles que donne 11 §4 (Reiner, Bertholdt, Annie, Pieck en 843 ; Marteau en 845) | ? | `holder_850.since_canon` | 11 §4 : « dates exactes `[?]` » |
| Porteurs en 850 : Eren (Assaillant, Fondateur), Ymir (Mâchoire), Reiner, Bertholdt, Annie ; Marley tient Bestial, Charrette, Marteau | C | `holder_850` | 11 §4 ; aucun nom de porteur de Marley hors des données (P7) |
| Malédiction d'Ymir : 13 ans | C | `data/balance/shifters.json` | 02 §10 |
| Mort sans ingestion → pouvoir à un nouveau-né eldien | C | `dailyShifters` | 02 §10 |
| Héritage par ingestion d'un porteur après injection de sérum | C | `InheritTitan`, effet `inherit` | 02 §10 ; 12 E42 |
| Sérum de Kenny transmis à Levi (E35), donné à Armin (E42) | C | E35 `serum`, E42 `inherit` | errata Q2 ; 12 E42 |
| Ymir part avec Reiner et Bertholdt (E28) | C | E28 `shifter_faction` | 12 E28 |
| Contrôle des purs du Fondateur lié au sang royal | C | `requires_flag: royal_contact` | 02 §10 |
| Délai de transformation 1–3 s | A (03 §8.1) | `transform_delay_s` | 03 §8.1 |
| Hauteurs, vitesses, points de vie, endurance, valeurs des capacités | A | `data/shifters/nine.json` | aucune valeur chiffrée canonique |
| Lances de foudre efficaces contre l'armure du Cuirassé | C | `pierce` ; `sim:shifters` | 12 E40 ; 13 T-ANT-08 |
| Visions (mémoires des porteurs) sous forme de rapports peu fiables | A | `monthlyVisions` | F-TIT-06 ; forme ludique |
