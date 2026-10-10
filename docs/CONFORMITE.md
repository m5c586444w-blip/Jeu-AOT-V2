# Conformité aux spécifications

Date : 2026-10-10. Audit fait sur le commit `7fa8d15` (P10.2), par un sous-agent en lecture seule, relu et complété ensuite (D-161, dettes n° 69 et 70). P10.4–P10.5 (`a309bd0` : manuel, `smoke:local`, D-159, D-160) sont venus après : ils ne changent aucun statut ci-dessous, sauf mention.
Demandé par : 15 §5 et 18 §10 (P10.4). Une ligne par section normative : 03 §1–§14, 04 §2–§9, 05 §3 et §5, fonctions P1 et P2 de 09, C-01 à C-27.

**Méthode.** Preuves tirées des tableaux de critères des rapports (`docs/reports/*.md`), des tests commités, des scripts de `package.json`,
des captures, de `docs/DECISIONS.md` et de `docs/reports/dette.md`, avec une recherche dans `src/` et `data/` quand aucun rapport ne
tranchait. Chaque chemin cité a été vérifié. Aucune commande n'a été relancée : les sorties citées sont celles des journaux commités.

**Statuts.** FAIT (preuve concrète) · PARTIEL (une part manque) · ABSENT (rien de trouvé, justification donnée) · NON VÉRIFIABLE ICI
(GPU réel, écoute, ressenti de jeu) · NON VÉRIFIÉ (aucune preuve trouvée).

**Justifications d'un ABSENT.**
- J-ERR : écarté par un errata ou une décision de l'utilisateur.
- J-V2 : phase R4 à R9, reportée en V2 par le plan de l'utilisateur (21 §6, absente de `docs/ROADMAP.md`).
- J-REP : reporté par un plan de phase ; report confirmé par D-161 (dette n° 69).
- D-161 : report décidé à la fin de P10 pour les fonctions qui n'avaient aucune justification (dette n° 69). Aucun ABSENT n'est sans justification.

**Hiérarchie.** ERRATA (`docs/spec/ERRATA.md`, `docs/spec/ERRATA_UX.md`) > 11 > 01 > 02/03 > 06/07/08/10/12/13 > 09 > 04 > 05. Une décision de l'utilisateur prime
(CLAUDE.md, DECISIONS, R1e-consigne, fichiers 24 > 23 > 22 > 21). Principales : plus d'objectif d'images par seconde (R1c), latence en
deux temps (D-93), 3D réaliste (D-81, D-88), interface moderne et carte réaliste (E-UX-1 à 6), économie moyenne sans marchés complexes
(23 §1), portraits en peinture stylisée (23 §1), aucune marine pour Paradis (D-126).

## 1. Fichier 03 — combat tactique

| Id / section | Attente (citée, fichier et §, en une phrase) | Statut | Preuve ou raison |
|---|---|---|---|
| 03 §1 | Temps réel à pause active et vitesses ×0,25–×2, simulation à 20 Hz déterministe, verticalité, fragilité, coûts, lisibilité. | FAIT | `smoke:tactique` (5,0 pas/s à ×0,25, 41 à ×2 ; `docs/reports/P4.md`, passage de revue) ; `tests/sim/tactical-combat.test.ts`, `tests/sim/odm.test.ts` ; D-59 ; vue 3D (D-142). |
| 03 §2 | Huit types de cartes ; ancrages par structure ; cartes semi-manuelles pour les lieux canon. | PARTIEL | 4 cartes : ville, forêt, plaine, mur (`data/tactical_maps/maps.json`, AC4-02) ; château, front, mer et souterrains absents ; lieux canon hors bataille (R4.2 : J-V2 ; D-71). |
| 03 §3 | Rôles, statistiques, Ackerman ; ODM, lances de foudre après 850, ODM anti-personnel, canons, fusils, armes de Marley. | PARTIEL | 8 types (`p4-figures.png`) ; lances (P6, CPA-03), canons (`tests/sim/artillery.test.ts`), fantassins (R2.2) ; ODM anti-personnel présent seulement en données de technologie. |
| 03 §4 | ODM : crochet, rail, élan, gaz, chute ; coupe de nuque, usure et casse des lames ; esquive, capture, panique. | FAIT | AC4-03, AC4-04 : `tests/sim/odm.test.ts`, `tests/sim/tactical-combat.test.ts`, `tests/sim/titans.test.ts`. |
| 03 §5 | Perception (jour et nuit, ouïe, attraction), classes, anormaux, régénération, meute ; Titans-Murs inertes jusqu'au Grondement. | FAIT | AC4-05 (`tests/sim/titans.test.ts`) ; 8 types (`data/titan_types/purs.json`) ; Grondement (`tests/sim/rumbling.test.ts`). |
| 03 §6 | Escouades de 4 à 6, formations, ordres par groupe, et neuf ordres types. | PARTIEL | Formations temps réel (`src/sim/tactical/types.ts:16`) ; 4 + 6 ordres (`src/sim/tactical/types.ts:3,11`) ; manquent diversion, évacuer et incendier (voir C-08). |
| 03 §7 | Code du Corps (rouge, vert, noir), code de la Garnison (vert, rouge, jaune), délais et erreurs de signal. | PARTIEL | Code du Corps et erreurs : P3 (F-EXP-03), P4 (F-CMB-06) ; aucune occurrence du code de la Garnison (« jaune ») dans `src` ni `data`. |
| 03 §8 | Transformation, zones, régénération, perte de contrôle ; neuf capacités, chacune une fiche. | FAIT | AC6-05, AC6-06 : `npm run sim:shifters`, `tests/sim/shifter-combat.test.ts`, `tests/data/shifters.test.ts`. |
| 03 §9 | Blessures, hémorragie, infection ; dossier par mort ; journal lisible. | FAIT | AC4-07 : 7 577 morts sur 7 577 (`docs/reports/P8-sim-tactical.log`) ; infection : `src/sim/military/expedition.ts:376-390`. |
| 03 §10 | Moral d'escouade, chocs, discours, renforts, désertion à conséquences politiques. | PARTIEL | Moral et panique : F-CMB-07 (`docs/phases/P4.md`) ; aucun discours en bataille ; désertion par l'événement `evt_gen_desertion` seulement. |
| 03 §11 | Brèche, Trost, forêt, Utgard, Shiganshina, Liberio, Slava, Grondement en crise. | PARTIEL | Grondement en crise (P9.4, D-152) ; Slava au front (F-WAR-10) ; les batailles des événements utilisent les cartes génériques (P5.md §4 ; R4.2 : J-V2). |
| 03 §12 | Auto-résolution à queues épaisses, statistiques proches de la bataille jouée (test automatique). | FAIT | AC4-08 : écart maximal +3,8 % (`docs/reports/P8-sim-tactical.log`) ; D-62 ; contrôle de réalisme (`docs/reports/R0-realisme.log`). |
| 03 §13 | Caméras libre et suiveuses, vue carte ; traînées, secousses, ralenti sur coupe ; glisser, groupes, ordres contextuels ; accessibilité. | PARTIEL | Vues stratégique et de suivi (R2.5) ; `tests/ui/rt-controls.test.ts` ; accessibilité (`tests/ui/accessibility.test.ts`) ; pas de ralenti (R8.4 : J-V2) ; pas de caméra cinématique. |
| 03 §14 | Déterminisme ; 1 000 batailles sans interface ; ≥ 60 images/s avec 300 unités ; overlays de debug. | PARTIEL | `sim:tactical` (6 000 batailles), `sim:selftest` ; images/s : objectif levé (CLAUDE.md, R1c) ; seul overlay de debug : la mesure F2 (D-63). |

## 2. Fichier 04 — direction artistique, interfaces, audio (ERRATA_UX prime)

| Id / section | Attente (citée, fichier et §, en une phrase) | Statut | Preuve ou raison |
|---|---|---|---|
| 04 §2 | Principes « non-template » et checklist sur chaque écran, lisible à 1366×768 et en 4K ; style moderne et sobre (E-UX-2). | FAIT | `smoke:p8` : 139 contrôles OK sur 4 passes (AC8-02, AC8-03, D-76) ; CUI-05, CUI-07, CUI-09 (`docs/reports/UI.md`) ; défauts restants : dette n° 21. |
| 04 §3 | Carte : réaliste (E-UX-3), 3 zooms, overlays, pions, voile léger ; survol, clic, clic droit pour un menu contextuel. | PARTIEL | MAP (CMAP-01 à 08) ; `map-1366-*.png` ; `pa-pions-1366.png` ; clic gauche seul : `src/ui/mapControls.ts:22` ; aucun menu contextuel. |
| 04 §4 | Scène tactique illustrée, en 3D réaliste par décision (D-81, D-88) : Titans, soldats, effets, quatre lumières, pictogrammes au-dessus des têtes. | PARTIEL | R3 (CR3-03 à 08) ; vapeur et transformation (AC8-05) ; jour et nuit seulement dans la bataille réelle (`src/render/tactical3d/battle/view3d.ts:160-178`) ; pas de pictogrammes (voir C-17, C-18). |
| 04 §5 | Quinze écrans, chacun un objet (atténué par E-UX-2). | FAIT | AC8-01 : 15 écrans sans erreur console (`smoke:p8`) ; `p8-*.png` ; écrans du jeu moderne (UI, D-109 à D-113). |
| 04 §6 | Infobulles, loupe, touches réglables, file d'ordres, Espace, alertes avec historique, annulation et confirmation, accessibilité, FR et EN. | PARTIEL | `tests/ui/why.test.ts`, `tests/ui/keymap.test.ts`, `tests/ui/alerts.test.ts` ; D-47 ; pas de loupe ; anglais partiel (112 clés EN, 3 797 FR, D-37). |
| 04 §7 | Musique originale adaptative, SFX, ducking, silence ; synthèse et sources libres ; rien de l'œuvre. | FAIT | AC8-06 ; CAUD-01 à 07 (`docs/reports/AUD.md`) ; `tests/ui/audio.test.ts` ; qualité d'écoute non vérifiable ici (dette n° 22). |
| 04 §8 | Pipeline procédural, emblèmes redessinés, portraits originaux, licences documentées. | FAIT | `npm run assets:check` (102 entrées) ; `src/ui/portrait.ts` (peinture, 23 §1) ; D-74 ; `tests/lint/art-reference.test.ts`. |
| 04 §9 | 60 images/s ; chargement < 8 s à froid ; scène tactique < 3 s ; mémoire < 2 Go. | PARTIEL | Mesures `docs/reports/R1d.md` § c2 : jeu 2,60 s, « prêt » du prototype 1,99 s, RSS 1 060 Mo. Bataille réelle en qualité moyenne : 4,5 à 13 s (`docs/reports/R2.md` § Mesures). Images/s : objectif levé. P10.3 à faire. |

## 3. Fichier 05 — §3 (quotas) et §5 (acceptation par phase)

| Id / section | Attente (citée, fichier et §, en une phrase) | Statut | Preuve ou raison |
|---|---|---|---|
| 05 §3 provinces de Paradis | 70 au moins. | FAIT | 74 (`data:validate`, `docs/reports/P9-verify-final.log`). |
| 05 §3 provinces du monde | 60 au moins, plus les zones maritimes. | FAIT | 61 entrées (`data/world_provinces/world.json`) ; AC7-01. |
| 05 §3 personnages nommés | 80 au moins. | FAIT | 80 (52 Paradis, 28 monde ; `data:validate`). |
| 05 §3 traits | 40, avec modificateurs et oppositions. | FAIT | 43 (`data/traits/traits.json`) ; AC2-01. |
| 05 §3 bâtiments | 25 au moins. | PARTIEL | 11 (`data/buildings/paradis.json`) ; D-27 annonçait 60 avec la construction en P3, jamais faite ; question 4 du fichier 15 §6 sans réponse. |
| 05 §3 technologies | 60, en 9 arbres. | FAIT | 88 (76 technologies et 12 doctrines, D-64) ; `tests/data/techs.test.ts`. |
| 05 §3 lois et décrets | 40. | FAIT | 43 (`data/laws/paradis.json`). |
| 05 §3 événements canon | 60. | FAIT | `tests/data/events-coverage.test.ts` (CCHR-03) ; texte seul : E01–E08 et E60 ; E59 porté par le scénario du Grondement (dettes n° 29, 68). |
| 05 §3 événements génériques | 150. | PARTIEL | 30 génériques, 94 faits de fond sans choix (D-118) et 12 événements de missions. |
| 05 §3 Titans purs | 8 types et leurs variantes. | FAIT | 8 (`data/titan_types/purs.json`) ; D-59. |
| 05 §3 cartes tactiques | 12. | PARTIEL | 4 cartes de bataille ; 5 lieux 3D (`data/places/`), absents des batailles ; nouvelles cartes de R4.2 : J-V2. |
| 05 §3 modèles de rapports | 100 (gazette, télégrammes, lettres). | PARTIEL | Environ 70 modèles `narr.*` : 18 articles, 22 d'épilogue, 18 de bilan, lettres ; plus les gabarits `report.*` et `letter.*` (`src/i18n/fr.json`). |
| 05 §3 portraits | 80, cohérents. | FAIT | Un portrait procédural par personnage (`src/ui/portrait.ts`) ; peinture stylisée (23 §1). |
| 05 §3 icônes | 150 (« ≥ 60 dessinées » en 24 §2.4, qui prime). | FAIT | 90 icônes (`tests/ui/icons.test.ts`, CUI-06). |
| 05 §5 P0 | Page, tests verts, déterminisme sur 1 000 ticks, aller-retour de sauvegarde. | FAIT | `tests/sim/core/state.test.ts`, `tests/save/save.test.ts`, `sim:selftest`. |
| 05 §5 P1 | 70 provinces, un an sans erreur, « pourquoi ? » partout, rendu de carte (E-UX-3). | FAIT | AC1-01 à AC1-17 (`docs/reports/P1.md`) ; refonte réaliste (MAP). |
| 05 §5 P2 | Décret à effets en chaîne, Cabinet votable, mort à conséquences. | FAIT | AC2-05 à AC2-07 (`tests/sim/politics.test.ts`, `tests/sim/characters.test.ts`). |
| 05 §5 P3 | 100 expéditions sans plantage, pertes plausibles, rapport lisible. | FAIT | `sim:expeditions` : 30,3 % puis 31,9 % (D-56, D-77) ; `docs/reports/P3.md`. |
| 05 §5 P4 | 300 unités, déterminisme, mort expliquée, ±15 %. | FAIT | AC4-06 à AC4-09 ; 60 images/s non vérifiable ici, objectif levé (CLAUDE.md, R1c). |
| 05 §5 P5 | Un rapport peut être faux ; une technologie a une mécanique ; une divergence change la suite. | FAIT | AC5-04, AC5-05, AC5-07 (`docs/reports/P5.md`). |
| 05 §5 P6 | Mort et héritage d'un porteur ; coûts ; toutes les capacités de 03 §8. | FAIT | AC6-03 à AC6-05 (`docs/reports/P6.md`). |
| 05 §5 P7 | Marley jouable ; Hizuru change de camp ; Titans comme armes. | FAIT | AC7-02 à AC7-04 (`tests/sim/diplomacy.test.ts`, `tests/sim/war.test.ts`, `sim:world`). |
| 05 §5 P8 | Checklist 04 §2 sur chaque écran ; revue sans « template look ». | FAIT | AC8-01 à AC8-08 ; revue humaine de P8 (D-77) ; revue UI (D-113). |
| 05 §5 P9 | 1 000 parties par scénario ; aucune faction au-dessus de 70 % ; durée cohérente. | NON VÉRIFIÉ | `docs/reports/P9.md` garde 6 « [À REMPLIR] » (CP9-01, CP9-03 à 06, § équilibrage) ; `docs/reports/P9-balance.html` et `.json` absents du dépôt. |
| 05 §5 P10 | Parcours 850 sans bug bloquant ; tests verts ; performances conformes. | PARTIEL | `npm run sim:parcours` : OK (`docs/reports/P10-verify-p102.log`, 758 tests) ; P10.3 à P10.7 pas encore commités. |

## 4. Fichier 09 — fonctions P1

| Id / section | Attente (citée, fichier et §, en une phrase) | Statut | Preuve ou raison |
|---|---|---|---|
| F-STR-01 | 09 §1 : trois niveaux de zoom, détail des toponymes. | FAIT | AC1-10 ; `tests/map/labels.test.ts` ; `docs/screenshots/map-1366-ile.png`, `map-1366-region.png`, `map-1366-province.png`. |
| F-STR-02 | 09 §1 : 10 overlays. | FAIT | 10, tous ouverts (`src/ui/overlays.ts:11`) ; `tests/ui/overlays.test.ts`. |
| F-STR-03 | 09 §1 : survol pour une bulle, clic pour un dossier, double-clic pour centrer. | FAIT | AC1-10 (`smoke:map`). |
| F-STR-04 | 09 §1 : frontières dessinées et lisibles (E-UX-3 prime). | FAIT | MAP : CMAP-04, CMAP-05. |
| F-ECO-01 | 09 §2 : 9 ressources par province. | FAIT | `tests/sim/economy.test.ts` ; P1.md. |
| F-ECO-02 | 09 §2 : « pourquoi ? » donnant tous les facteurs. | FAIT | AC1-04 (`tests/sim/explain.test.ts`) ; `tests/ui/why.test.ts`. |
| F-ECO-03 | 09 §2 : stocks, capacités, pertes, vols. | FAIT | AC1-03 ; D-24. |
| F-ECO-04 | 09 §2 : rationnement à 3 niveaux. | FAIT | AC1-05 (`tests/sim/economy.test.ts`). |
| F-LOG-01 | 09 §3 : chaîne d'approvisionnement (dépôts, relais, convois). | FAIT | `tests/sim/logistics.test.ts` ; `p3-calque-ravitaillement.png`. |
| F-LOG-02 | 09 §3 : attrition hors du rayon. | FAIT | `tests/sim/logistics.test.ts` ; P3.md. |
| F-POP-01 | 09 §4 : au moins 8 strates (satisfaction, radicalisation). | FAIT | AC2-03 (`tests/sim/society.test.ts`). |
| F-POP-02 | 09 §4 : moral national et local, causes données. | FAIT | AC2-03 ; « pourquoi ? » du moral. |
| F-POL-01 | 09 §5 : légitimité de 0 à 100, causes données. | FAIT | AC2-04 (`tests/sim/politics.test.ts`). |
| F-POL-02 | 09 §5 : au moins 40 lois, avec effets et contre-effets. | FAIT | 43 décrets ; AC2-05. |
| F-ADV-01 | 09 §6 : 18 rôles de conseillers, avis biaisés. | FAIT | AC2-08 (`tests/sim/advisors.test.ts`). |
| F-ADV-02 | 09 §6 : propositions à signer. | FAIT | AC2-08 ; `p2-conseil.png`. |
| F-INT-01 | 09 §7 : brouillard daté. | FAIT | AC5-06 (`tests/sim/intel.test.ts`). |
| F-INT-02 | 09 §7 : agents (couverture, loyauté, risque, spécialité). | FAIT | AC5-07 (`tests/sim/intel.test.ts`). |
| F-TEC-01 | 09 §8 : 9 arbres, au moins 60 technologies. | FAIT | 88 entrées, 9 arbres (D-64). |
| F-TEC-16 | 09 §8 : verrou par événement (`unlock_event`). | FAIT | AC5-05 ; `canon:check` (R10) ; `tests/tools/canon-check.test.ts`. |
| F-CHR-01 | 09 §9 : fiches complètes. | FAIT | `p2-fiche.png` ; tableau d'enquête (`src/ui/panels/charactersPanel.ts:188`) ; défauts restants : dette n° 21. |
| F-CHR-02 | 09 §9 : stress et trauma. | FAIT | AC2-09 (`tests/sim/characters.test.ts`). |
| F-TIT-01 | 09 §10 : 8 types de Titans purs. | FAIT | AC4-01 (`tests/data/tactical.test.ts`). |
| F-TIT-02 | 09 §10 : 9 Titans à capacité signature. | FAIT | AC6-01, AC6-05. |
| F-TIT-03 | 09 §10 : horloge des 13 ans. | FAIT | AC6-02 (`tests/sim/shifters.test.ts`). |
| F-EXP-01 | 09 §11 : planificateur (objectif, itinéraire, composition). | FAIT | `tests/sim/expeditions.test.ts` ; `p3-planificateur.png`. |
| F-EXP-02 | 09 §11 : formation de reconnaissance longue portée paramétrable. | FAIT | P3.md ; D-56. |
| F-CMB-01 | 09 §12 : ODM (ancrage, rail, gaz, élan). | FAIT | AC4-03. |
| F-CMB-02 | 09 §12 : coupe de nuque (angle, vitesse, usure). | FAIT | AC4-04. |
| F-CMB-03 | 09 §12 : IA des Titans (vision, ouïe, attraction). | FAIT | AC4-05. |
| F-CMB-04 | 09 §12 : escouades et formations. | FAIT | Escouades de 4 à 6 ; formations (`src/sim/tactical/types.ts:16`, `tests/sim/rt-orders.test.ts`). |
| F-CMB-05 | 09 §12 : pause active avec ordres. | FAIT | `smoke:tactique` ; `tests/ui/rt-controls.test.ts`. |
| F-DIP-01 | 09 §14 : relations bilatérales à 4 axes. | FAIT | AC7-06 (`tests/sim/diplomacy.test.ts`). |
| F-EVT-01 | 09 §15 : moteur d'événements à chaînes. | FAIT | AC5-02 (`tests/sim/events.test.ts`, `sim:events`). |
| F-EVT-02 | 09 §15 : mode Canon fidèle, fenêtres et divergence. | FAIT | AC5-04. |
| F-UIX-01 | 09 §16 : HUD sobre, infobulles partout (E-UX-2). | FAIT | AC1-11 ; UI (D-108 à D-111). |
| F-UIX-02 | 09 §16 : dossier de province, fiche de personnage, planificateur. | FAIT | `p8-dossier-province.png`, `p8-fiche-personnage.png`, `p3-planificateur.png`. |
| F-UIX-03 | 09 §16 : touches configurables. | FAIT | AC1-14 (`tests/ui/keymap.test.ts`). |
| F-SYS-01 | 09 §18 : sauvegarde IndexedDB fiable. | FAIT | AC-10 (`tests/save/save.test.ts`). |
| F-SYS-02 | 09 §18 : export et import. | FAIT | AC-11 (`tests/save/save.test.ts`). |
| F-DEV-01 | 09 §19 : JSON validé par Zod, erreurs claires. | FAIT | AC-12 (`tests/data/validate.test.ts`) ; `data:validate`. |
| F-LOR-01 | 09 §21 : Archives à tampons de statut (E-UX-1 et E-UX-5 : encyclopédie sans tampon, mode auteur F10). | FAIT | CUX0-02, CUX0-03 (`tests/ui/no-leaks.test.ts`, `smoke:ux0`) ; `ux0-archives.png`. |
| F-LOR-09 | 09 §21 : fenêtres de présence et avertissement. | FAIT | AC2-02 (`tests/sim/characters.test.ts`) ; D-45. |

## 5. Fichier 09 — fonctions P2

| Id / section | Attente (citée, fichier et §, en une phrase) | Statut | Preuve ou raison |
|---|---|---|---|
| F-STR-05 | 09 §1 : murs en coupe, état visible. | PARTIEL | Murs en relief (MAP) ; murs en bande plate (dette n° 15). |
| F-STR-06 | 09 §1 : brouillard daté (voile léger, E-UX-3). | FAIT | AC5-06 ; MAP. |
| F-STR-07 | 09 §1 : pions avec insignes. | FAIT | `pa-pions-1366.png` (CPA-04). |
| F-STR-08 | 09 §1 : tracés d'expédition avec cône d'incertitude. | PARTIEL | Tracés (`src/ui/mapRoutes.ts`) ; aucun cône. |
| F-STR-09 | 09 §1 : notes du joueur sur la carte. | ABSENT | J-REP : P1.md §3 et P2.md §0 vers P3, jamais repris ; report confirmé par D-161 (dette n° 69). |
| F-STR-10 | 09 §1 : épingles et fils entre lieux. | ABSENT | J-REP : P2.md §0 vers P3 ; report confirmé par D-161 (dette n° 69). |
| F-STR-11 | 09 §1 : règle, compas, jours de marche. | ABSENT | J-REP : P2.md §0 vers P3 ; report confirmé par D-161 (dette n° 69). |
| F-STR-13 | 09 §1 : zones de ravitaillement. | FAIT | `p3-calque-ravitaillement.png` ; D-57. |
| F-STR-14 | 09 §1 : flux (convois, réfugiés, rumeurs). | PARTIEL | Convois et armées tracés (`src/ui/mapRoutes.ts`) ; ni réfugiés ni rumeurs. |
| F-STR-16 | 09 §1 : filtres. | FAIT | AC1-13 (`smoke:map`). |
| F-STR-17 | 09 §1 : touches, favoris, groupes de provinces. | PARTIEL | Touches de déplacement (`src/ui/keymap.ts:19`) ; pas de favoris. |
| F-STR-19 | 09 §1 : liste des provinces triable. | ABSENT | J-REP : P2.md §0 vers P3 ; report confirmé par D-161 (dette n° 69). |
| F-ECO-05 | 09 §2 : saisons. | FAIT | AC1-05 (hiver −35 %). |
| F-ECO-06 | 09 §2 : prix dynamiques. | ABSENT | J-ERR : « pas de marchés complexes » (23 §1, 24 §2.1). |
| F-ECO-07 | 09 §2 : impôts par strate. | FAIT | Décrets fiscaux à effets `satisfaction:str_*` (`data/laws/paradis.json`) ; P2.md §0. |
| F-ECO-08 | 09 §2 : dette et prêts. | ABSENT | J-ERR : économie moyenne (23 §1) ; J-REP : P2.md §0. |
| F-ECO-09 | 09 §2 : corruption par échelon. | PARTIEL | Pertes de stock et décret `law_lutte_corruption` (`losses_mult`) ; pas d'échelons. |
| F-ECO-10 | 09 §2 : contrebande. | ABSENT | J-ERR : 23 §1 ; J-REP : P2.md §0. |
| F-ECO-11 | 09 §2 : contrats avec les marchands. | ABSENT | J-ERR : 23 §1 ; J-REP : P3.md §3. |
| F-ECO-12 | 09 §2 : réquisitions et indemnités. | PARTIEL | Décrets `law_requisition_chevaux`, `law_requisition_greniers` ; aucune indemnité. |
| F-ECO-13 | 09 §2 : spéculation, émeutes de la faim. | ABSENT | J-ERR : 23 §1 ; J-REP : P3.md §3. |
| F-ECO-15 | 09 §2 : budgets par organisation. | FAIT | P2.md §0 ; `p2-organisations.png`. |
| F-ECO-16 | 09 §2 : chantiers d'infrastructure visibles. | PARTIEL | Missions nationales (greniers, routes ; `data/missions/paradis.json`) ; pas de chantier visible. |
| F-ECO-17 | 09 §2 : files de fabrication. | ABSENT | J-REP : P3.md §3 vers P9 ; report confirmé par D-161 (dette n° 69). |
| F-ECO-18 | 09 §2 : qualité des produits. | PARTIEL | Technologies de lames et de gaz ; pas de qualité de production. |
| F-ECO-20 | 09 §2 : industrie de Marley (charbon, acier, armements). | PARTIEL | Économie agrégée par nation (D-70). |
| F-ECO-21 | 09 §2 : commerce maritime, blocus, embargo. | FAIT | AC7-05, AC7-06. |
| F-ECO-23 | 09 §2 : tableaux de bord à graphiques. | PARTIEL | Registre Économie (`p8-economie.png`) sans graphique. |
| F-LOG-03 | 09 §3 : convois vulnérables. | FAIT | `tests/sim/logistics.test.ts`. |
| F-LOG-04 | 09 §3 : dépôts avancés. | FAIT | `tests/sim/logistics.test.ts`. |
| F-LOG-05 | 09 §3 : chevaux. | FAIT | P3.md ; rapport (`report.horsesLost`). |
| F-LOG-06 | 09 §3 : réparations en campagne. | ABSENT | J-REP : D-50 vers P4 ; noté « reporté » dans `docs/reports/P4.md` (c) ; non repris ; report confirmé par D-161 (dette n° 69). |
| F-LOG-07 | 09 §3 : évacuation médicale. | FAIT | P3.md (équipe médicale U-P13). |
| F-LOG-08 | 09 §3 : capacité par route, rail, fleuve, mer. | PARTIEL | Capacité unique par convoi (P3.md §3) ; rail et mer au monde (P7, PA). |
| F-LOG-10 | 09 §3 : sabotage de lignes. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-LOG-11 | 09 §3 : rail de Marley (horaires, trains blindés). | PARTIEL | Mobilité ferroviaire au front (P7.md, F-WAR-05) ; ni horaires ni trains. |
| F-LOG-13 | 09 §3 : alertes de stock. | FAIT | P3.md ; `tests/sim/logistics.test.ts`. |
| F-LOG-15 | 09 §3 : planificateur de relais. | FAIT | P3.md. |
| F-POP-03 | 09 §4 : réfugiés. | PARTIEL | Strate `str_refugies` (`src/sim/politics/society.ts:19-22`), deux décrets, un événement ; pas de flux ni de camps. |
| F-POP-04 | 09 §4 : épidémies. | PARTIEL | `evt_gen_epidemie` ; aucune propagation. |
| F-POP-05 | 09 §4 : criminalité. | PARTIEL | Décrets d'ordre (`law_police_renforcee`) ; aucune criminalité simulée. |
| F-POP-06 | 09 §4 : émeutes, grèves. | PARTIEL | `evt_gen_greve_mines`, `evt_gen_petition`, fin « désordre ». |
| F-POP-07 | 09 §4 : mouvements politiques. | PARTIEL | Programmes des personnages (`src/sim/politics/vocabulary.ts`) ; aucun mouvement de population. |
| F-POP-08 | 09 §4 : opinion publique. | ABSENT | J-REP : P3.md §3 vers P5 ou P9 ; report confirmé par D-161 (dette n° 69). |
| F-POP-09 | 09 §4 : rumeurs. | PARTIEL | Certitude « rumeur » (`src/sim/intel/intel.ts`), événements de rumeur ; aucune propagation. |
| F-POP-10 | 09 §4 : éducation. | PARTIEL | `law_ecoles` ; écoles dans les points de recherche (`src/sim/research/research.ts:58`). |
| F-POP-11 | 09 §4 : démographie. | PARTIEL | Mortalité de famine seule (`src/sim/strategic/economy.ts:332`). |
| F-POP-12 | 09 §4 : mobilité, migration interne. | ABSENT | J-REP : P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-POP-14 | 09 §4 : religion populaire. | PARTIEL | Influence du Culte (calque, P5), décrets, missions ; ni pèlerinages ni sectes. |
| F-POP-15 | 09 §4 : discrimination des Eldiens. | PARTIEL | Zone d'internement de Liberio (`data/world_provinces/world.json`) ; aucune mécanique. |
| F-POP-18 | 09 §4 : dossiers de villages. | ABSENT | J-REP : P2.md §0 vers P3 ; report confirmé par D-161 (dette n° 69). |
| F-POP-20 | 09 §4 : deuil collectif. | PARTIEL | Deuils sur la légitimité (D-54) ; ni monuments ni commémorations. |
| F-POL-03 | 09 §5 : Cabinet, votes, cliques. | FAIT | AC2-06. |
| F-POL-04 | 09 §5 : nominations sur liste courte. | FAIT | AC2-07. |
| F-POL-05 | 09 §5 : procès publics. | PARTIEL | Événements (`evt_gen_proces_local`, procès canon) ; ni jurés ni preuves. |
| F-POL-06 | 09 §5 : amnisties, grâces, exils. | PARTIEL | `law_amnistie` seulement. |
| F-POL-07 | 09 §5 : élections locales. | ABSENT | J-REP : P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-POL-08 | 09 §5 : coups d'État. | PARTIEL | Événements canon seulement (E57). |
| F-POL-09 | 09 §5 : purges. | ABSENT | J-REP : P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-POL-10 | 09 §5 : régence, abdication, succession. | PARTIEL | Succession (`src/sim/armies/succession.ts`, PA.10) ; ni régence ni abdication. |
| F-POL-11 | 09 §5 : secrets d'État. | FAIT | AC5-08. |
| F-POL-12 | 09 §5 : fuites, scandales, chantage. | PARTIEL | `evt_gen_scandale_noble`, `evt_gen_lettre_anonyme`. |
| F-POL-13 | 09 §5 : propagande. | PARTIEL | `law_gazette_officielle` ; gazette de Marley (`src/ui/narrative.ts`) ; aucune campagne. |
| F-POL-14 | 09 §5 : censure. | FAIT | `law_censure_presse`, `law_censure_religieuse`, doctrine transparence ou censure (P5.md). |
| F-POL-15 | 09 §5 : réformes constitutionnelles. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-POL-18 | 09 §5 : fins politiques variées. | PARTIEL | Fins par objectifs (`data/balance/endings.json`) ; pas de régime (république, dictature). |
| F-POL-20 | 09 §5 : capital politique. | FAIT | P2.md §0. |
| F-ADV-03 | 09 §6 : veto, démission. | FAIT | AC2-08. |
| F-ADV-04 | 09 §6 : agendas cachés. | ABSENT | J-REP : P3.md §3 ; « intrigue secondaire » (24 §2.1) ; report confirmé par D-161 (dette n° 69). |
| F-ADV-05 | 09 §6 : séances de 16 types. | ABSENT | J-REP : P2.md §3, P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-ADV-06 | 09 §6 : cliques. | FAIT | `src/sim/politics/politics.ts` (cliques) ; AC2-06. |
| F-ADV-07 | 09 §6 : relation entre joueur et conseiller. | PARTIEL | Effet des propositions sur la relation ; rancœurs (AC2-07). |
| F-ADV-08 | 09 §6 : avis ancrés dans le monde. | FAIT | `adviceFor` (`src/sim/politics/advisors.ts`) ; `tests/sim/advisors.test.ts`. |
| F-ADV-09 | 09 §6 : second avis. | ABSENT | J-REP : P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-ADV-15 | 09 §6 : dossiers des conseillers. | FAIT | P2.md §0. |
| F-INT-03 | 09 §7 : rapports bruités et faux. | FAIT | AC5-07. |
| F-INT-04 | 09 §7 : contre-espionnage. | FAIT | AC5-07. |
| F-INT-05 | 09 §7 : interception de courrier. | ABSENT | J-REP : P5.md §4 ; report confirmé par D-161 (dette n° 69). |
| F-INT-06 | 09 §7 : cryptographie. | ABSENT | J-REP : P5.md §4 ; report confirmé par D-161 (dette n° 69). |
| F-INT-07 | 09 §7 : désinformation. | ABSENT | J-REP : P5.md §4 (seules les taupes faussent les rapports) ; report confirmé par D-161 (dette n° 69). |
| F-INT-08 | 09 §7 : assassinats, sabotages. | ABSENT | J-REP : P5.md §4 ; report confirmé par D-161 (dette n° 69). |
| F-INT-09 | 09 §7 : interrogatoires. | ABSENT | J-REP : P5.md §4 ; report confirmé par D-161 (dette n° 69). |
| F-INT-10 | 09 §7 : informateurs. | PARTIEL | Mission `mis_ren_reseau_informateurs`. |
| F-INT-11 | 09 §7 : tableau d'enquête. | PARTIEL | Tableau de relations (`src/ui/panels/charactersPanel.ts:188`), recoupement des rapports ; non interactif (P5.md §4). |
| F-INT-15 | 09 §7 : rumeur, indice, preuve. | FAIT | AC5-07. |
| F-INT-16 | 09 §7 : archives secrètes. | PARTIEL | « Mur des secrets » (`src/ui/panels/intelPanel.ts:55-57`) seulement. |
| F-TEC-02 | 09 §8 : expériences sur Titans. | FAIT | AC5-05 (objectif « capture », T-MED-04). |
| F-TEC-03 | 09 §8 : doctrines exclusives. | FAIT | P5.md §0 : deux paires à effets réels. |
| F-TEC-04 | 09 §8 : prototypes. | ABSENT | J-REP : P5.md §4 vers P9 ; report confirmé par D-161 (dette n° 69). |
| F-TEC-05 | 09 §8 : espionnage technologique. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-TEC-06 | 09 §8 : contre-mesures de l'ennemi. | ABSENT | J-REP : P5.md §4 vers P9 ; report confirmé par D-161 (dette n° 69). |
| F-TEC-09 | 09 §8 : brevets. | ABSENT | J-REP : P5.md §4 vers P9 ; report confirmé par D-161 (dette n° 69). |
| F-TEC-10 | 09 §8 : manuels d'instruction. | ABSENT | J-REP : P5.md §4 vers P9 ; report confirmé par D-161 (dette n° 69). |
| F-TEC-12 | 09 §8 : accidents de laboratoire. | FAIT | AC5-05. |
| F-TEC-14 | 09 §8 : standardisation (ODM). | PARTIEL | `tech_odm_maintenance` (`tests/sim/research.test.ts:40`). |
| F-CHR-03 | 09 §9 : relations à effets. | FAIT | P2.md §0 (votes, stress de deuil). |
| F-CHR-04 | 09 §9 : mort avec dossier. | FAIT | AC2-07 ; `p2-deces.png`. |
| F-CHR-05 | 09 §9 : promotions, rétrogradations, exils. | PARTIEL | Nominations seules (P2.md §0). |
| F-CHR-06 | 09 §9 : traits qui évoluent. | PARTIEL | Traits acquis (AC2-09, séquelles) ; aucun trait perdu. |
| F-CHR-07 | 09 §9 : événements de vie. | PARTIEL | Mariage, deuil, confession (génériques) ; pas de naissance. |
| F-CHR-08 | 09 §9 : journal personnel. | ABSENT | J-REP : P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-CHR-09 | 09 §9 : lettres aux familles. | FAIT | AC8-07 ; `p3-lettre.png`. |
| F-CHR-10 | 09 §9 : blessures et séquelles. | FAIT | P3.md (trait acquis). |
| F-CHR-11 | 09 §9 : âge, mort naturelle. | ABSENT | J-REP : P3.md §3 vers P9 ; report confirmé par D-161 (dette n° 69). |
| F-CHR-15 | 09 §9 : arbres de compétences. | ABSENT | J-REP : P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-CHR-17 | 09 §9 : générateur d'officiers et de civils. | PARTIEL | Soldats générés (P3.md) ; ni civils ni officiers nommés. |
| F-CHR-19 | 09 §9 : médailles. | ABSENT | J-REP : P3.md §3 ; report confirmé par D-161 (dette n° 69). |
| F-TIT-04 | 09 §10 : transformation (coûts, recharge, risques). | FAIT | AC6-06. |
| F-TIT-05 | 09 §10 : héritage. | FAIT | AC6-03, AC6-04. |
| F-TIT-06 | 09 §10 : visions. | FAIT | AC6-07. |
| F-TIT-07 | 09 §10 : Fondation et Titans-Murs. | FAIT | AC6-07 ; Grondement (`tests/sim/rumbling.test.ts`). |
| F-TIT-08 | 09 §10 : capture de Titan. | PARTIEL | Objectif « capture » (T-ANT-06) ; ni piège ni filet en bataille. |
| F-TIT-09 | 09 §10 : laboratoire. | PARTIEL | T-MED-04 ouverte par un Titan capturé (AC5-05). |
| F-TIT-10 | 09 §10 : statistiques de comportement. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-TIT-11 | 09 §10 : événements d'anormaux. | FAIT | `evt_gen_anormal_signale` ; 4 types anormaux. |
| F-TIT-14 | 09 §10 : porteur qui dérive. | FAIT | AC6-06. |
| F-TIT-15 | 09 §10 : porteurs comme armes stratégiques. | FAIT | AC7-04. |
| F-TIT-17 | 09 §10 : coût du durcissement. | FAIT | D-69. |
| F-TIT-20 | 09 §10 : réhabilitation. | FAIT | `RetireShifter` (`src/sim/core/commands.ts:447`). |
| F-EXP-03 | 09 §11 : signaux, relais, délais. | FAIT | P3.md ; D-55. |
| F-EXP-04 | 09 §11 : plan de retrait. | FAIT | P3.md. |
| F-EXP-05 | 09 §11 : météo, jour et nuit. | FAIT | P3.md. |
| F-EXP-06 | 09 §11 : rapport avec la liste des morts. | FAIT | `p3-rapport.png`. |
| F-EXP-07 | 09 §11 : coût politique. | FAIT | D-54. |
| F-EXP-08 | 09 §11 : expéditions secrètes. | ABSENT | J-REP : D-50 vers P5, puis P5.md §4 vers P9 ; report confirmé par D-161 (dette n° 69). |
| F-EXP-09 | 09 §11 : exploration cartographique. | FAIT | Objectif « exploration » (`src/sim/military/vocabulary.ts:16`). |
| F-EXP-10 | 09 §11 : récupération. | FAIT | Objectif « recuperation ». |
| F-EXP-11 | 09 §11 : missions de capture. | FAIT | AC5-05. |
| F-EXP-12 | 09 §11 : reconquête. | PARTIEL | Missions de reconquête sans changement de contrôle (dette n° 40). |
| F-EXP-15 | 09 §11 : pré-brief et post-brief. | FAIT | D-54. |
| F-EXP-18 | 09 §11 : jouer ou auto-résoudre. | FAIT | AC4-10 (`tests/sim/battle-link.test.ts`). |
| F-EXP-19 | 09 §11 : missions conjointes. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-CMB-06 | 09 §12 : signaux et erreurs. | FAIT | P4.md §0 ; AC4. |
| F-CMB-07 | 09 §12 : moral et panique. | FAIT | P4.md (c). |
| F-CMB-08 | 09 §12 : journal de combat. | FAIT | AC4-07. |
| F-CMB-09 | 09 §12 : lances de foudre après 850. | FAIT | D-69 ; CPA-03. |
| F-CMB-10 | 09 §12 : canons. | FAIT | CPA-06 ; `pa-artillerie-rempart.png`. |
| F-CMB-11 | 09 §12 : incendies, effondrements, civils. | ABSENT | J-V2 : R4.3 et R4.5 ; J-REP : P4.md §3 et P5.md §4. |
| F-CMB-12 | 09 §12 : évacuation de civils. | ABSENT | J-REP : P4.md §3 et P5.md §4 ; aucune phase prévue ensuite ; report confirmé par D-161 (dette n° 69). |
| F-CMB-13 | 09 §12 : saignement, infection. | FAIT | 03 §9. |
| F-CMB-14 | 09 §12 : chariot de gaz. | FAIT | P4.md §0. |
| F-CMB-15 | 09 §12 : chute et récupération. | FAIT | AC4-03. |
| F-CMB-16 | 09 §12 : combat de nuit. | FAIT | R-nuit (`docs/reports/R0-realisme.log`). |
| F-CMB-17 | 09 §12 : pièges. | ABSENT | J-REP : P4.md §3 et P5.md §4 ; report confirmé par D-161 (dette n° 69). |
| F-CMB-18 | 09 §12 : capture et sauvetage. | FAIT | P4.md §0. |
| F-CMB-19 | 09 §12 : porteurs en combat. | FAIT | AC6-05. |
| F-CMB-20 | 09 §12 : capacités de commandement. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-CMB-21 | 09 §12 : combat urbain. | FAIT | Carte « ville » ; obstacles (`tests/sim/rt-obstacles.test.ts`). |
| F-CMB-22 | 09 §12 : forêt. | FAIT | Carte « forêt » (`p4-carte-foret.png`). |
| F-CMB-23 | 09 §12 : mur (canons, vent). | PARTIEL | Carte « mur » et canons de rempart ; aucun vent. |
| F-CMB-25 | 09 §12 : combat moderne. | PARTIEL | Mitrailleurs et artillerie en bataille (R2.2, PA) ; avions au front seulement. |
| F-CMB-26 | 09 §12 : combat naval. | FAIT | AC7-05 ; flottes (`tests/sim/armies.test.ts`). |
| F-CMB-28 | 09 §12 : auto-résolution détaillée. | FAIT | AC4-08. |
| F-CMB-30 | 09 §12 : replays. | FAIT | AC4-06 ; CR2-03. |
| F-CMB-31 | 09 §12 : caméras libre, suiveuse, cinématique. | PARTIEL | Libre et suiveuse (R2.5) ; pas de cinématique. |
| F-CMB-33 | 09 §12 : statistiques de bataille. | FAIT | `tests/sim/battle-summary.test.ts`. |
| F-CMB-36 | 09 §12 : difficulté tactique. | PARTIEL | Le réglage « pertes » touche les expéditions seulement (`src/sim/strategic/difficulty.ts:11,39`). |
| F-CMB-40 | 09 §12 : ancrages configurables. | FAIT | AC4-02. |
| F-WAR-01 | 09 §13 : front, ligne de contact. | FAIT | `tests/sim/war.test.ts`. |
| F-WAR-02 | 09 §13 : artillerie lourde. | FAIT | AC7-05. |
| F-WAR-03 | 09 §13 : aviation. | FAIT | AC7-05. |
| F-WAR-04 | 09 §13 : marine. | FAIT | AC7-05 (sous-marins `?`). |
| F-WAR-05 | 09 §13 : chemin de fer. | FAIT | P7.md. |
| F-WAR-06 | 09 §13 : troupes coloniales. | FAIT | `form_troupes_coloniales` (`data/formations/modern.json`). |
| F-WAR-07 | 09 §13 : internement, rafles. | PARTIEL | `form_police_internement`, zone de Liberio ; aucune mécanique. |
| F-WAR-08 | 09 §13 : projection de Titan. | FAIT | AC7-04. |
| F-WAR-10 | 09 §13 : siège de Fort Slava. | FAIT | E53 (P7.md). |
| F-WAR-11 | 09 §13 : débarquements. | FAIT | AC7-05 ; CP9-09 (`tests/sim/p9-ai.test.ts`). |
| F-DIP-02 | 09 §14 : traités. | FAIT | AC7-06. |
| F-DIP-03 | 09 §14 : ambassades. | PARTIEL | Missions de contact (`mis_mon_contact_hizuru`) ; aucune ambassade. |
| F-DIP-04 | 09 §14 : ultimatums. | FAIT | AC7-06. |
| F-DIP-05 | 09 §14 : sommets. | PARTIEL | « En événements » (P7.md : E48) ; aucune mécanique. |
| F-DIP-06 | 09 §14 : garanties, otages, mariages. | PARTIEL | Garanties payées (D-72) seulement. |
| F-DIP-09 | 09 §14 : coalition avec votes. | FAIT | D-72 ; CP9-09. |
| F-EVT-03 | 09 §15 : 60 canon et 150 génériques. | PARTIEL | Voir 05 §3. |
| F-EVT-04 | 09 §15 : choix à coûts visibles. | FAIT | AC5-03. |
| F-EVT-05 | 09 §15 : selon traits et relations. | ABSENT | D-161 : report confirmé (dette n° 69) ; aucune condition de trait (`src/sim/events/engine.ts:189-204`). |
| F-EVT-06 | 09 §15 : saisonniers. | FAIT | Condition « season » (`src/sim/events/engine.ts:203`). |
| F-EVT-07 | 09 §15 : événements de personnages. | FAIT | P5.md §0. |
| F-EVT-10 | 09 §15 : épilogue généré. | FAIT | `tests/sim/endings.test.ts` ; `p9-fin-defaite.png`. |
| F-EVT-14 | 09 §15 : éditeur d'événements. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-UIX-04 | 09 §16 : alertes et historique. | FAIT | `tests/ui/alerts.test.ts`, `tests/ui/notifications.test.ts`. |
| F-UIX-05 | 09 §16 : loupe. | ABSENT | J-REP : P2.md §0 ; report confirmé par D-161 (dette n° 69). |
| F-UIX-06 | 09 §16 : recherche globale. | ABSENT | J-REP : P2.md §0 ; report confirmé par D-161 (dette n° 69). |
| F-UIX-07 | 09 §16 : favoris, groupes d'unités. | PARTIEL | Groupes Ctrl+1–9 (`src/ui/tactical/rtControls.ts:91`) ; pas de favoris. |
| F-UIX-08 | 09 §16 : interfaces-objets (E-UX-2). | FAIT | Matière sur les cadres (UI). |
| F-UIX-09 | 09 §16 : animations physiques. | PARTIEL | Sons de papier et de tampon (D-75) ; aucune animation. |
| F-UIX-10 | 09 §16 : thème par faction. | FAIT | `src/ui/theme.ts:11` ; `p8-monde-marley.png`. |
| F-UIX-11 | 09 §16 : panneau de recommandations. | FAIT | `src/ui/panels/councilPanel.ts`. |
| F-UIX-12 | 09 §16 : annuler. | FAIT | D-47. |
| F-UIX-13 | 09 §16 : confirmer. | FAIT | D-47 ; `p2-confirmation.png`. |
| F-UIX-14 | 09 §16 : tableau d'enquête interactif. | PARTIEL | Voir F-INT-11. |
| F-UIX-15 | 09 §16 : gazette. | FAIT | AC8-07 ; `p8-gazette.png`. |
| F-UIX-17 | 09 §16 : échelle 100–200 %. | FAIT | AC1-14. |
| F-UIX-18 | 09 §16 : FR et EN. | PARTIEL | 112 clés EN contre 3 797 FR (D-37). |
| F-UIX-21 | 09 §16 : infobulles imbriquées. | PARTIEL | Trois niveaux (D-111) ; aucun survol interne. |
| F-UIX-22 | 09 §16 : comparateurs. | ABSENT | J-REP : P2.md §0 ; report confirmé par D-161 (dette n° 69). |
| F-AUD-01 | 09 §17 : 3 à 5 couches. | FAIT | D-75, D-116. |
| F-AUD-02 | 09 §17 : ambiances par lieu. | PARTIEL | Vent, ville, forêt, mur (`src/ui/audio.ts:19`) ; pas d'océan. |
| F-AUD-03 | 09 §17 : SFX. | FAIT | AC8-06. |
| F-AUD-06 | 09 §17 : ducking. | FAIT | D-75. |
| F-SYS-03 | 09 §18 : sauvegardes rotatives. | FAIT | AC-10. |
| F-SYS-04 | 09 §18 : migrations. | FAIT | `tests/sim/core/state.test.ts` ; `sim:parcours`. |
| F-SYS-05 | 09 §18 : statistiques à graphiques. | PARTIEL | Bilan chiffré (`p9-fin-defaite.png`) sans graphique. |
| F-SYS-06 | 09 §18 : distinctions. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-SYS-09 | 09 §18 : replays par commandes. | FAIT | AC-08 ; `sim:parcours`. |
| F-DEV-02 | 09 §19 : éditeur de carte. | ABSENT | J-REP : P1.md §0 (géométrie en données, `npm run map:terrain`) ; report confirmé par D-161 (dette n° 69). |
| F-DEV-03 | 09 §19 : éditeur d'événements. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-DEV-04 | 09 §19 : éditeur de personnages. | ABSENT | D-161 : report confirmé (dette n° 69). |
| F-DEV-05 | 09 §19 : `sim:balance`. | FAIT | `tests/tools/balance.test.ts`. |
| F-DEV-06 | 09 §19 : console de debug. | FAIT | `tests/ui/debug-console.test.ts`. |
| F-DEV-07 | 09 §19 : overlays de debug. | PARTIEL | Console et mesure F2 ; ni portées ni ancrages. |
| F-DEV-10 | 09 §19 : tests de déterminisme. | FAIT | AC-07 ; `sim:selftest`. |
| F-ACC-01 | 09 §20 : taille de police. | FAIT | D-158 ; `tests/ui/accessibility.test.ts`. |
| F-ACC-02 | 09 §20 : contraste AA, mode daltonien. | FAIT | `tests/ui/contrast.test.ts` ; D-158. |
| F-ACC-03 | 09 §20 : secousses et flashs réduits. | FAIT | D-158 (`src/render/motion.ts`). |
| F-ACC-04 | 09 §20 : sous-titres. | FAIT | `tests/ui/subtitle-placement.test.ts`. |
| F-LOR-02 | 09 §21 : fiches de lieux, personnages, organisations. | FAIT | Archives (`ux0-archives.png`, E-UX-5). |
| F-LOR-03 | 09 §21 : chronologie interactive. | FAIT | `tests/ui/timeline.test.ts` ; `chr-frise-850.png`. |
| F-LOR-06 | 09 §21 : alertes de contradiction (dev). | PARTIEL | `canon:check` hors jeu ; mode auteur F10 ; aucune alerte en jeu. |
| F-LOR-10 | 09 §21 : `canon:check`. | FAIT | R1–R14 (`tests/tools/canon-check.test.ts`). |

## 6. Lignes C-01 à C-27 du fichier 15

| Id / section | Attente (citée, fichier et §, en une phrase) | Statut | Preuve ou raison |
|---|---|---|---|
| C-01 | 04 §6 : interface entière à 1366×768 (cartes d'escouade). | PARTIEL | Corrigé en P4 (D-63, contrôle « 0 coupée ») ; en temps réel, la bande s'arrête après 10 escouades (dette n° 56). |
| C-02 | 03 §1 pt 6 : bataille lisible avec 300 unités. | FAIT | D-63 (pastilles, Titans agrandis) ; `p4-vue-ensemble.png`. |
| C-03 | 04 §2 : aucun chiffre technique montré au joueur. | FAIT | Mesure sous F2 (D-63) ; `tests/ui/no-leaks.test.ts`. |
| C-04 | 04 §6 : l'infobulle ne masque pas l'objet expliqué. | PARTIEL | Placée sous ou sur l'élément (`src/ui/why.ts:189-193`) ; peut couvrir le parent (`docs/reports/MIS.md`, `docs/reports/CHR.md`). |
| C-05 | 04 §2 r. 7 : ville irrégulière. | PARTIEL | Irrégulière dans le prototype (D-82) et à Shiganshina ; la bataille réelle reste en grille (`src/sim/tactical/map.ts:110-117`). |
| C-06 | 04 §4 : vrais volumes, occlusion. | FAIT | Vue 3D (D-142, CR2-06) ; occlusion 2D (AC8-05). |
| C-07 | 04 §4 : vapeur des Titans abattus. | FAIT | AC8-05 (4 nuages) ; vapeur en 3D (`src/render/tactical3d/battle/view3d.ts`, D-145). |
| C-08 | 03 §6 : 9 ordres types. | PARTIEL | Manquent diversion, évacuer, incendier ; report consigné par D-161 (dette n° 70). |
| C-09 | 03 §13 : ciblage fin et ralliement au clic. | PARTIEL | Fait en temps réel (CR2-04) ; absent de l'écran P4 des expéditions (dette n° 46). |
| C-10 | 03 §13 : ralenti sur coupe réussie. | ABSENT | J-V2 : R8.4 (21 §6) ; P3 au fichier 15. |
| C-11 | 03 §13, 04 §7 : sons des gaz, lames, pas. | FAIT | AC8-06 ; pas des soldats absents (dette n° 25). |
| C-12 | 03 §1 pt 4 : combat assez dur. | NON VÉRIFIABLE ICI | Ressenti (15 §6.1) ; Rude et Brèche (CP9-08) ; difficulté réglable (D-158). |
| C-13 | 03 §12 : calibrage déclaré, contrôle indépendant. | FAIT | D-62 ; R-gaz et R-nuit OK (`docs/reports/R0-realisme.log`, D-77). |
| C-14 | Anormaux dans le contrôle de cohérence. | PARTIEL | Présents dans R-gaz (D-77) ; absents d'AC4-08 (`docs/reports/P8-sim-tactical.log`). |
| C-15 | 04 §3 : atlas gravé. | FAIT | E-UX-3 le remplace par la carte réaliste (MAP). |
| C-16 | 04 §5 : interfaces-objets. | FAIT | E-UX-2 (UI, CUI-05). |
| C-17 | 04 §4 : pictogrammes au-dessus des têtes. | PARTIEL | Pastilles numérotées (`src/render/tactical/scene.ts:476`) ; gaz et lames sur les cartes ; aucun pictogramme par homme. |
| C-18 | 04 §4 : quatre lumières à l'écran. | PARTIEL | Quatre dans le prototype R1 (`r1-*-1366.png`) ; deux en bataille (`src/render/tactical3d/battle/view3d.ts:160-178`, R4.3 : J-V2). |
| C-19 | 04 §4 : Titans déformés, anatomie dérangeante. | PARTIEL | 3D (D-83, R3) ; visages encore humains (dette n° 63) ; T1 complet en V2 (21 §6). |
| C-20 | 03 §2 et F-CMB-10, 11, 12, 17 : civils, incendies, pièges, canons. | PARTIEL | Canons faits (CPA-06) ; le reste est absent (F-CMB-11, 12, 17). |
| C-21 | 04 §8 : portraits originaux. | FAIT | `src/ui/portrait.ts` ; `assets:check`. |
| C-22 | 04 §5 : tableau d'enquête, gazette, tampons. | PARTIEL | Gazette (AC8-07) ; tableau non interactif ; tampons de statut retirés (E-UX-1). |
| C-23 | 04 §2 : checklist sur chaque écran. | FAIT | `smoke:p8` (D-76) ; revue D-113. |
| C-24 | 00 §8, 04 §9 : 60 images/s et 4K. | NON VÉRIFIABLE ICI | GPU réel (dettes n° 1, 49, 64) ; captures 4K (`p8-4k-*.jpg`). |
| C-25 | 14 §1 : hook Stop. | FAIT | `.claude/settings.json` ; déclenché (D-79). |
| C-26 | Sourire figé non présenté comme canon. | FAIT | Rendu seulement (`src/render/tactical/figures.ts:59`, `src/render/tactical3d/titan.ts:236`). |
| C-27 | Ville-usine : rattachement A, localisation ?. | FAIT | D-41, D-49, règle R7. |

## 7. Écarts trouvés hors des listes

- **E-01** : `docs/reports/P9.md` garde 6 « [À REMPLIR] » (CP9-01, CP9-03 à 06, § équilibrage). `P9-balance.html` et `.json`, cités par CP9-10, manquent au dépôt ; PROGRESS dit pourtant « P9 terminée ».
- **E-02** : la bataille réelle se joue sur une ville en grille (`src/sim/tactical/map.ts:110-117`) ; l'irrégularité de D-82 reste dans le prototype.
- **E-03** : les batailles d'expédition, la bataille d'essai et le guide restent sur l'écran 2D de P4 (dette n° 46) : ni ciblage, ni groupes, ni file d'ordres.
- **E-04** : le code des fusées de la Garnison (vert, rouge, jaune ; 03 §7) n'existe pas.
- **E-05** : la carte stratégique n'a aucun menu au clic droit (04 §3).
- **E-06** : la bataille réelle n'a que deux lumières, jour et nuit (`src/render/tactical3d/battle/view3d.ts:160-178`) ; 03 §1 et 04 §4 en demandent quatre.
- **E-07** : l'anglais est partiel (112 clés, 3 797 en français) alors que 24 §2.5 le demande en second (dettes n° 19, 25, 35, 40, 42, 51).
- **E-08** : aucun overlay de debug pour les portées, les ancrages ou les trajectoires (03 §14, F-DEV-07).
- **E-09** : « prêt » de la bataille temps réel jamais mesuré en qualité basse allégée ; R2 l'a mesuré en qualité moyenne (4,5 à 13 s).
- **E-10** : le réglage de difficulté « pertes » n'agit pas sur la bataille tactique (`src/sim/strategic/difficulty.ts:39`).
- **E-11** : D-27 annonçait 60 bâtiments avec la construction ; il y en a 11, sans construction (05 §3 en demande 25).
- **E-12** : le « sourire figé » (C-26) manquait à la liste « interprété » de `docs/CANON_CHECK.md` (ajouté depuis).

## 8. Écarts classés, avec un critère de correction vérifiable

**P1**
1. E-01 : lancer `npm run sim:balance`, coller sa sortie dans `docs/reports/P9.md` et commiter `P9-balance.html` et `.json`. Critères :
   `grep -c "À REMPLIR" docs/reports/P9.md` → 0 ; `git ls-files docs/reports/P9-balance.*` → 2 lignes ; chaque faction ≤ 70 %, mortalité d'expédition 25–40 %.
2. **Traité** : les 11 ABSENT sans justification (F-LOG-10, F-POL-15, F-TEC-05, F-TIT-10, F-EXP-19, F-CMB-20, F-EVT-05, F-EVT-14,
   F-SYS-06, F-DEV-03, F-DEV-04) sont reportés par D-161 (dette n° 69). Critère tenu : aucun ABSENT sans justification.

**P2**
3. **Consigné** : C-08 (diversion, évacuer, incendier) : report par D-161 (dette n° 70).
4. E-09 : mesurer « prêt » de la bataille temps réel en qualité basse (P10.3). Critère : < 3 s collé dans `docs/reports/P10.md` avec sa commande, sinon une dette.
5. E-11 : trancher le quota de bâtiments (25 ou 60, 15 §6.4). Critère : `npm run data:validate` donne ≥ 25 bâtiments, ou une décision D-xx revoit le quota.
6. E-03 et C-09 : batailles d'expédition sur l'écran temps réel, ou écart consigné. Critère : `npm run smoke:r2` couvre une bataille d'expédition, ou une décision D-xx.
7. **Traité** : J-REP : les 34 reports sont confirmés par D-161, qui cite chaque Id (dette n° 69).

**P3** (à grouper avec V2, R4 et R8)
8. E-02 et C-05 : ville irrégulière en bataille réelle. Critère : la mesure d'orientation de D-82 donne > 10° sur la carte « ville » de la
   simulation. `src/sim` est fermé depuis R2 : une décision est requise.
9. E-04 : code de la Garnison. Critère : un test où une fusée jaune après une rouge annule l'échec.
10. E-05 : menu contextuel de la carte. Critère : un contrôle « clic droit » dans `npm run smoke:map`.
11. E-06 et C-18 : aube et crépuscule en bataille. Critère : `tests/render/tactical3d/battle3d.test.ts` couvre quatre lumières.
12. E-07 : anglais. Critère : un test qui exige ≥ 90 % des clés FR en EN.
13. E-08 : overlays de debug tactiques. Critère : un contrôle F2 dans `npm run smoke:tactique` (ancrages et portées visibles).
14. E-10 : difficulté tactique. Critère : un test où « Brèche » augmente les pertes d'une bataille à graine fixe.
15. C-01 et C-04 : bande d'escouades défilante (dette n° 56) ; infobulle hors de la carte parente. Critère : 0 pastille coupée (`smoke:r2`) et un contrôle `smoke:p8`.
16. C-17 : pictogrammes de gaz, de lames et de stress. Critère : un contrôle de leur présence dans `smoke:r2`.
17. **Traité** : E-12 : sourire figé (A) ajouté à `docs/CANON_CHECK.md` (`grep -n "Sourire" docs/CANON_CHECK.md` : une ligne).

## 9. Totaux par statut

| Tableau | FAIT | PARTIEL | ABSENT | NON VÉRIFIABLE ICI | NON VÉRIFIÉ | Lignes |
|---|---|---|---|---|---|---|
| 03 §1–§14 | 6 | 8 | 0 | 0 | 0 | 14 |
| 04 §2–§9 | 4 | 4 | 0 | 0 | 0 | 8 |
| 05 §3 et §5 | 19 | 5 | 0 | 0 | 1 | 25 |
| 09, fonctions P1 | 43 | 0 | 0 | 0 | 0 | 43 |
| 09, fonctions P2 | 110 | 60 | 51 | 0 | 0 | 221 |
| C-01 à C-27 | 13 | 11 | 1 | 2 | 0 | 27 |
| **Total** | **195** | **88** | **52** | **2** | **1** | **338** |

Les 52 ABSENT : J-ERR seule 1 (F-ECO-06) ; J-ERR et J-REP 4 (F-ECO-08, 10, 11, 13) ; J-V2 2 (F-CMB-11, avec J-REP, et C-10) ; J-REP seule 34 et sans justification 11, tous reportés par D-161 (dette n° 69). Aucun ABSENT n'est sans justification.
Toutes les fonctions P1 de 09 sont faites. Les écarts tiennent à trois causes : des fonctions P2 reportées puis oubliées, les effets
de bataille renvoyés en V2 (R4, R8), et la preuve d'équilibrage de P9.
