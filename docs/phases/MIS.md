# Phase MIS — arbre de missions nationales (branche `claude/v2-mis`)

Sources : fichier 23 §5 (MIS.1 à MIS.6, CMIS-01 à 06), fichier 24 §2 (priorité : stratégie militaire et nationale, intrigue secondaire),
fichier 12 §3 (divergence), fichier 11 et ERRATA (priment), ERRATA_UX. Plafond : 150 tours.
`src/sim` et `data/` : ajouts seulement, déterministes (graine et jour), sans `any`, testés ; `sim:selftest` code 0 ; anciennes
sauvegardes chargées (champ `missions` facultatif, schéma de sauvegarde inchangé) ; tout changement d'empreinte est listé dans le rapport et DECISIONS.

## Tâches
- **MIS.1** Modèle (`data/missions/*.json`, Zod) : nom, description, durée (jours de jeu), coût, prérequis (tous / au moins un), exclusions,
  conditions, effets ponctuels, modificateurs durables, événements déclenchés (génériques ou de fond seulement, jamais canon), `canon`
  C/A/?, branche (militaire, politique, économique, religion, renseignement, monde extérieur), nation (Paradis, Marley), scénarios.
  Moteur : état facultatif, commandes journalisées `StartMission` / `CancelMission`, fin de mission au jour dit, effets appliqués par le moteur d'événements.
- **MIS.2** Arbre de Paradis : au moins 40 missions par scénario (845, 850, 854) dont reconquête de Maria, réforme de l'armée, cabinet,
  église des murs, recherche anti-Titan, artillerie, renseignement sur le monde extérieur, préparation de l'invasion de Marley. Aucune
  mission ne force un événement canon (règle `canon:check` R14 : les événements déclenchés sont génériques ou de fond ; les effets ne
  touchent ni le contrôle des provinces, ni les morts, ni les porteurs).
- **MIS.3** Écran « Missions » (style de l'écran de recherche) : arbre par branche, liens, mission en cours avec temps restant, infobulle d'effet, aucun code interne.
- **MIS.4** Intégration : missions sur la frise (en cours et accomplies), pause automatique à la fin d'une mission, journal.
- **MIS.5** Marley : branche simplifiée (une dizaine de missions), jouable.
- **MIS.6** IA : Marley choisit des missions cohérentes (raisons consignées), déterministe.

## Critères d'acceptation
| ID | Critère | Commande |
|---|---|---|
| CMIS-01 | `verify` code 0 | `timeout 1500 npm run verify` |
| CMIS-02 | `sim:selftest` code 0 | `npm run sim:selftest` |
| CMIS-03 | `canon:check` code 0 | `npm run canon:check` |
| CMIS-04 | ≥ 40 missions par scénario de Paradis ; branche de Marley ; aucune mission canon forcée | `npx vitest run tests/data/missions.test.ts` |
| CMIS-05 | Aucune mention interne à l'écran | `npx vitest run tests/ui/no-leaks.test.ts` ; `npm run smoke:ux0` ; `npm run smoke:mis` |
| CMIS-06 | Captures lues (1366×768, 3840×2160, infobulle d'effet, mission en cours) | `docs/reports/MIS.md` § captures |
| CMIS-07 | Mission : démarrage, fin, effets, pause, journal, déterminisme, vieilles sauvegardes | `npx vitest run tests/sim/missions.test.ts` |
| CMIS-08 | L'IA de Marley choisit des missions cohérentes (raisons consignées) | `npx vitest run tests/sim/missions-ai.test.ts` |

## Hors-périmètre
Mécaniser des événements canon ; refonte de la recherche ou de la frise ; missions des autres nations (Hizuru, Alliés) ; IA de Paradis
pour les missions quand Marley est jouée ; textes anglais ; nouvel outil de mesure ; sous-phase.
