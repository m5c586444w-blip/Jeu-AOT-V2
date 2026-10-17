# 03 — Plan de production V4

> Statut : **PROPOSÉ**. Dépend de : `01`, `02`, `04`, `05`. Remplace pour la V4 le plan `docs/coord/PLAN_FONCTIONNALITES.md` (chantiers C0 à C18), qui reste l'historique de l'ancien dépôt.
> Les tailles (S, M, L, XL) sont des **estimations non mesurées** ; elles sont recalibrées à la fin de M1 d'après l'usage réellement consommé.

## 1. Principes de séquencement (ce qui évite les retours en arrière)

1. **Spikes d'abord** (M0) : voix, déterminisme, niveaux de détail, réseau, ressenti du combattant, chaîne de modèles. Un spike échoué déclenche son repli écrit dans `05`, sans nouvelle discussion.
2. **Le noyau avant l'image** : toute la logique (M1 à M6) se développe et se teste **sans moteur ni GPU**. La présentation (M7) vient ensuite sur un noyau déjà prouvé.
3. **Une tranche verticale** avant le contenu : une bataille jouable de bout en bout avec des modèles provisoires (M7) précède les modèles définitifs (M8) et les lieux (M10).
4. **Un jalon se termine** par son gel : décisions concernées passées à FIGÉ dans `04`, revue indépendante, note de passage.
5. **Une seule piste de travail** : après vendredi 16 octobre, il n'y a plus qu'un compte de session ; pas de partage de voies à coordonner. Le protocole à fenêtres A/B de l'ancien dépôt n'est pas repris.

## 2. Jalons

Chaque jalon a des **entrées**, des **livrables** et des **critères** exprimés en commandes ou en mesures. Un critère sans commande ni mesure n'est pas un critère.

| Jalon | Objectif | Entrées | Livrables | Critères (commande ou mesure) | Taille |
|---|---|---|---|---|---|
| **M0** Cadrage et spikes | lever les risques et figer les décisions | R-D1 faite ; accès à une machine avec GPU et micro (PC de Gabriel) | `docs/v4/spikes/S0.md` à `S6.md` (et `S7.md` si la carte voxel est fournie) avec verdict PASS/FAIL et chiffres ; version Godot/.NET figée ; nouveau dépôt ; `CLAUDE.md` | chaque spike a un verdict daté ; `04` : D06, D07, D17, D21 passés à FIGÉ ou repli activé | M |
| **M1** Squelette technique | un projet qui compile, se teste, se rejoue | M0 | solution .NET (`Sim`, `Data`, `Net`, `Voice`, `Tools`), projet Godot qui charge un état, schémas JSON, générateur aléatoire, empreintes, lanceur de traces d'or, script `verify` | `verify` code 0 ; `Tools selftest` : 3 exécutions identiques ; première trace d'or (`core`) reproduite | M |
| **M2** Simulation stratégique | porter les règles de campagne | M1 | `core`, `commands`, `knowledge`, `world`, `strategic`, `politics`, `events`, `intel`, `missions`, `research`, `shifters` (voir section 4), `owner` toujours présent | traces d'or par module ; `Tools selftest` reproduit les empreintes de référence des scénarios sans bataille `[?]` si la reprise à l'identique est confirmée en M1 | L |
| **M3** Armées et campagne militaire | piles, rencontres, sièges, expéditions | M2 | `military`, `armies` | traces d'or ; année simulée de 845 sans erreur (équivalent de `sim:year`) | L |
| **M4** Piliers de campagne | Mur, Horloge, Vérité, Registre, Marée | M3 | `Pillars/{Wall,Clock,Truth,Registry,Tide}` activés par défaut | tests de signature de chaque pilier (portés avec leurs tests) ; test « Marley–Paradis à densité de Titans nulle » ; `Tools balance` sans régression | L |
| **M5** Bataille (simulation) | bataille commandant + combattant, entièrement dans `Sim` | M3, S1, S5 | `Tactical` refondu (ODM, gaz, ancrage, navigation propre, formations, ordres), `Pillars/{Gas,Signal}`, commandes du combattant | tests de signature P3/P4 ; bataille de 400 unités sans moteur : temps par tick relevé sur le PC de Gabriel ; rejeu identique sur 10 minutes de bataille | XL |
| **M6** Réseau | lockstep à 9, salon, votes, camps, trahison | M1 (campagne), M5 (bataille) | `Net`, salon, votes, instantanés, coffre de secrets | 9 clients sans interface, 10 minutes, 0 désynchronisation sur 10 graines ; reconnexion en bataille sans rupture d'empreinte ; test « un secret de traître ne figure pas dans l'état partagé » ; `sim:balance` : aucun camp au-dessus de 60 % de victoires sur 200 parties IA par scénario `[A]` | L |
| **M7** Présentation, tranche verticale | une bataille jouable de bout en bout, modèles provisoires | M5 ; M6 pour le multijoueur | cadre d'interface unique (barre, alertes, menu, fil, barre des joueurs) dans tous les modes ; campagne → rencontre → bataille 3D → retour ; commandant et combattant ; qualités Bas/Moyen | script de parcours équivalent à `smoke:bataille` code 0 **sur machine avec GPU** ; vérification équivalente à `smoke:cadre` en 1366 × 768 et 3840 × 2160 ; captures relues par un second relecteur ; fluidité mesurée par Gabriel sur RTX 3050 | XL |
| **M8** Modèles et animations | tenues, Titans, décors définitifs | S6 ; peut démarrer dès M1 côté Blender | squelettes partagés, animations, tenues par institution, Titans (trois variantes ou plus), décalques d'emblèmes, niveaux de détail, décors importés depuis une carte voxel si S7 PASS (V4-D23) | test de budgets (`02` §7) ; contrôle de provenance équivalent à `assets:check` ; planche de revue relue | XL |
| **M9** Commande vocale | voix en français pour les escouades IA | S3 (PASS), M5, M7 | `Voice` intégré, retours visuels et sous-titres, repli clavier/menu radial | ≥ 90 % de commandes correctes sur 60 commandes, 100 énoncés (`06`) ; latence mesurée ; aucune capture audio conservée | L |
| **M10** Contenu | lieux jouables, scénarios, événements, illustrations | M7, M8 | scènes de lieux depuis `data/places`, scénarios, événements, portraits | couverture de l'atlas : tout lieu de l'atlas a un lieu jouable (équivalent de `places:couverture`, 126 provinces) ; `canon:check` équivalent vert | XL |
| **M11** Finition et paquet | équilibrage, accessibilité, export Windows | M6 à M10 | exécutable Windows, notice d'installation, réglages de qualité | session de 9 joueurs réelle de 30 minutes sans plantage ; `sim:balance` ; mesure de fluidité sur RTX 3050 | L |

## 3. Réutilisation depuis l'ancien dépôt (inventaire constaté le 2026-10-16)

| Ressource | Quantité constatée | Réutilisation en V4 |
|---|---|---|
| Spécifications `docs/spec/` | 29 fichiers (00 à 27, errata) | **reprises** : sources des règles et du lore (V4-D13) |
| Données `data/` | 29 dossiers ; lieux 2,1 Mo (27 fichiers), carte 1 Mo, équilibre 22 fichiers, événements 6 fichiers | **reprises telles quelles**, validées par schéma (V4-D05) |
| Modèles `.glb` | 24 fichiers, 1,7 Mo | prototypes **sans squelette** (V4-D16) |
| Code `src/sim` (TypeScript) | 17 973 lignes | **référence** pour le portage (section 4), non réutilisable tel quel |
| Code `src/net` | 906 lignes | protocole repris, transport changé |
| Code `src/ui` / `src/render` | 12 320 / 26 870 lignes | **remplacés** par Godot |
| Code `src/tools` | 16 503 lignes | `canon:check`, `data:validate`, `assets:check` à reporter ; les générateurs de lieux ne sont pas repris (leurs sorties le sont) |
| Tests | 173 fichiers, 1 678 tests au dernier `verify` | décrivent le comportement attendu ; **traces d'or** produites depuis l'ancien dépôt pour les modules repris |

## 4. Table de portage (modes proposés — Gabriel corrige en R-D1)

Mode **REPRISE FIDÈLE** : le port doit reproduire les traces d'or de l'ancien module. **REFONTE** : le comportement change, il est spécifié avant le code. **NOUVEAU** : pas d'équivalent.

| Module (ancien) | Lignes TS | Mode proposé | Écart avec `26`/`27` | Jalon |
|---|---|---|---|---|
| `core` (état, tick, sérialisation, aléa) | 1 384 | REPRISE FIDÈLE | aucun | M1–M2 |
| `commands`, `knowledge` | 317 + 81 | REPRISE FIDÈLE + `owner` toujours présent | `owner` jamais facultatif (D-168 étendu) | M2 |
| `world`, `strategic` | 986 + 757 | REPRISE FIDÈLE | aucun | M2 |
| `politics`, `events`, `intel`, `missions`, `research`, `shifters` | 1 078 + 552 + 372 + 459 + 168 + 262 | REPRISE FIDÈLE | aucun | M2 |
| `military`, `armies` | 1 645 + 2 010 | REPRISE FIDÈLE | rencontres adaptées au nouveau moteur de bataille | M3 |
| `Pillars/Wall`, `Clock`, `Truth`, `Registry`, `Tide` | 702 + 582 + 540 + 909 + 926 | REPRISE FIDÈLE (tests de signature portés) | activés par défaut en V4 | M4 |
| `tactical` | 3 246 | **REFONTE** | combattant incarné, navigation propre, ODM sans physique du moteur | M5 |
| `Pillars/Gas`, `Signal` | 333 + 560 | **REFONTE** (logique reprise, liée à la nouvelle bataille) | brouillard et ancrage en 3D | M5 |
| `net` | 906 | REPRISE du protocole, **REFONTE** du transport | ENet à la place de WebSocket (V4-D07) | M6 |
| `data` (chargement) | 4 406 | REFONTE (langage) | schémas inchangés | M1 |
| `ui`, `render` | 12 320 + 26 870 | **NOUVEAU** (Godot) | cadre d'interface unique conservé (`ERRATA_V3` §3) | M7 |
| *(sans équivalent)* `Voice` | — | **NOUVEAU** | commande vocale (V4-D21) | M9 |

## 5. Graphe de dépendances

```
 R-D1 → M0 ─→ M1 ─→ M2 ─→ M3 ─┬→ M4
                │              └→ M5 ─┬→ M6
                │                     └→ M7 ─┬→ M9 (aussi S3)
                └→ M8 (dès M1, aussi S6) ──────┴→ M10 → M11
```
Ordre conseillé pour une seule piste : M0, M1, M2, M3, M4, M5, M6, M7, M8 (peut s'intercaler dès M1 quand le travail Blender est plus léger), M9, M10, M11.

## 6. Définition de « terminé » pour un jalon

1. Les commandes de la colonne « Critères » ont été **exécutées et leur sortie réelle est collée** dans `docs/v4/rapports/Mn.md` (150 lignes au plus). Rien n'est déclaré réussi sans cette sortie.
2. Tout critère visuel : chaque capture a été ouverte, décrite en 3 lignes, avec **au moins 3 défauts possibles** listés (texte répété, zone vide, chevauchement, élément absent, valeur à 0 incohérente, cadre d'interface manquant).
3. `04` est à jour : décisions concernées FIGÉES, nouvelles décisions consignées.
4. Une **revue indépendante** (relecteur distinct de l'auteur) a rendu un verdict écrit.
5. `docs/PROGRESS.md` (nouveau dépôt) donne l'état et la **prochaine action exacte**.
6. Un critère qui échoue deux fois est consigné dans `docs/reports/dette.md` et on passe à la suite ; il ne bloque pas le jalon si le repli de `05` le permet.

## 7. Revues

R-D1 (Gabriel, documents 01 et 04) · R-M0 (verdicts des spikes) · fin de M2 · fin de M5 · fin de M6 · fin de M7 · fin de M9 · avant M11.
