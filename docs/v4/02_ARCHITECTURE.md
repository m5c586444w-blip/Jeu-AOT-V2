# 02 — Architecture technique V4 (Godot .NET)

> Statut : **PROPOSÉ**. Dépend de : `04` (V4-D02 à D07, D14 à D17, D20, D21). Les valeurs marquées `[?]` sont remplacées par des mesures de `05_SPIKES_RISQUES.md` avant d'être utilisées.
> Les noms de commandes et d'options Godot cités ici sont à **confirmer en S0** sur la documentation de la version figée : je ne les ai pas tous vérifiés.

## 1. Principes

1. **La simulation ne sait rien du moteur** : elle est une bibliothèque .NET testable sans Godot, sans GPU (V4-D04).
2. **Le rendu lit l'état, il ne le modifie jamais.** Animations, particules, caméras et sons ne rétroagissent pas sur la simulation.
3. **Tout ce qui change l'état est une commande typée** (siège, tick, nature, charge utile) : clavier, souris, voix et réseau produisent les mêmes commandes (V4-D19).
4. **Les données sont des fichiers**, validés par schéma ; aucun chiffre d'équilibre dans le code (V4-D05).
5. **Un risque non mesuré ne se code pas** : il passe d'abord par un spike (V4-D18).

## 2. Couches et sens des dépendances

```
                 ┌────────────────────────────────────────┐
                 │  game/  (projet Godot .NET)            │
                 │  scènes, interface, rendu, audio,      │
                 │  entrées, caméras, effets              │
                 └───────┬───────────┬───────────┬────────┘
                         │           │           │
                  ┌──────▼───┐ ┌─────▼────┐ ┌────▼─────┐
                  │  Voice   │ │   Net    │ │  (outils)│
                  │ grammaire│ │ lockstep │ │          │
                  └──────┬───┘ └─────┬────┘ └──────────┘
                         │           │
                         └─────┬─────┘
                          ┌────▼────┐
                          │   Sim   │   bibliothèque pure
                          └────┬────┘
                          ┌────▼────┐
                          │  Data   │   JSON + schémas
                          └─────────┘
```
Règle de dépendance : une flèche ne se remonte jamais. `Sim` ne référence ni `Net`, ni `Voice`, ni Godot. `Voice` et `Net` produisent ou transportent des commandes, rien d'autre.

## 3. Arborescence du dépôt V4 (proposée)

```
Murs-et-Sang-V4/
  CLAUDE.md                 règles de travail (modèle : 08)
  docs/                     documents V4 + spécifications reprises
  data/                     JSON repris de l'ancien dépôt (un dossier par domaine)
  schemas/                  JSON Schema (générés une fois depuis les schémas Zod)
  src/
    Sim/                    Core, Commands, Knowledge, World, Strategic, Politics, Events,
                            Intel, Military, Armies, Tactical, Missions, Research, Shifters,
                            Pillars/{Wall,Tide,Clock,Gas,Signal,Truth,Registry}
    Data/                   chargement, validation, accès typé aux données
    Net/                    hôte séquenceur, clients, salon, votes, instantanés
    Voice/                  grammaire fermée, analyse, pont vers le moteur de reconnaissance
    Tools/                  data:validate, canon:check, assets:check, selftest, balance
  game/                     projet Godot : scenes/, ui/, render/, battle/, campaign/, i18n/
  tests/                    Sim.Tests, Data.Tests, Net.Tests, Voice.Tests, golden/
  tools/blender/            scripts bpy (modèles, tenues, décalques)
```
Version de .NET et de Godot : lues dans la documentation de la version 4.7.x et **figées en S0** (la page de téléchargement officielle donne 4.7.2 du 18 août 2026, avec une édition .NET).

## 4. Déterminisme (règles de la simulation)

| # | Règle | Pourquoi |
|---|---|---|
| R1 | Aléa : un seul générateur maison (famille PCG ou xoshiro), graine de la partie, **forks nommés** par système ; jamais `System.Random` | rejeu et lockstep |
| R2 | Le temps est un **entier de ticks** ; aucun `DateTime`, `Stopwatch` ni compteur système dans `Sim` | rejeu |
| R3 | Aucune itération sur `Dictionary`/`HashSet` sans tri par identifiant stable ; les entités ont des identifiants entiers stables | l'ordre d'itération ne doit pas dépendre de la machine |
| R4 | Nombres : `double` avec +, −, ×, ÷, racine carrée seulement ; sinus, cosinus, arctangente par **tables** ou implémentation maison. Variante de repli : arithmétique en virgule fixe pour tout l'état de bataille | les fonctions mathématiques du système peuvent différer d'une machine à l'autre `[?]` S1 |
| R5 | Aucun multithread dans l'avancement d'un pas (le parallélisme est permis hors `Sim`) | ordre des effets |
| R6 | Pas de physique ni de navigation du moteur dans l'état partagé : trajectoires ODM, collisions et cheminement sont calculés dans `Sim` (grille ou maillage de navigation propre) | le moteur n'est pas déterministe d'une machine à l'autre `[?]` |
| R7 | Empreinte d'état : sérialisation canonique (ordre de champs fixe, octets de poids faible en premier) puis condensat 64 bits, comparée tous les N ticks | détection de désynchronisation |
| R8 | Une seule version de l'exécutable par partie, Windows 64 bits | élimine les écarts de compilation |
| R9 | Mutable global interdit dans `Sim` ; les structures chaudes de la bataille évitent les allocations | reproductibilité et fluidité |

Variante retenue pour R4 (double + tables, ou virgule fixe) : **décidée par S1**.

## 5. Commandes, sièges, connaissance

- `Command` = `{ seat, tick, kind, payload }`, sérialisable en JSON ; `CommandEnvelope` pour le réseau. Toute commande est **refusée** si le siège ne possède pas l'entité visée (`seat.err.not_owner`, comme D-157).
- En V4, `owner` est **toujours présent** sur les armées, flottes, escouades, sections, provinces et institutions : il n'y a plus de sauvegardes à conserver, donc pas de champ facultatif (cela satisfait D-168). Décision V4-D22 de `04` (PROPOSÉ).
- La connaissance est **par faction** et le brouillard **par siège** (P4, `26` §5) ; l'interface ne reçoit que la vue du siège local.
- Le prêt et la cession d'une escouade entre joueurs sont des commandes (`27` §4.3).
- Une commande vocale (`06`) est analysée en dehors de `Sim` ; seule la commande typée résultante entre dans le journal.

## 6. Réseau (résumé ; protocole : `27` §1–2, §9 et ancien `src/net`)

| Élément | Choix `[A]` | À confirmer |
|---|---|---|
| Topologie | étoile, l'hôte séquence les commandes | — |
| Pas | bataille à 20 Hz ; campagne par jour de jeu | — |
| Retard d'entrée | quelques ticks (valeur de départ 3, soit 150 ms) | S4, S5 |
| Contrôle | empreinte comparée tous les 100 ticks `[?]` | S1, S4 |
| Reconnexion | instantané + journal rejoué depuis l'hôte | S4 |
| Transport | UDP via ENet (V4-D07), WebSocket en repli | S4 |
| Secrets (trahison) | « coffre de secrets » de l'hôte qui injecte des événements communs ; l'hôte peut le lire | audit de C13 de l'ancien plan |
| Pause, anti-triche, connexion | défauts de `27` §5 et §10 (pause : défaut accepté ; anti-triche et connexion : non tranchés) | R-D1 pour anti-triche et connexion |

## 7. Rendu : niveaux de détail et budgets de départ `[?]`

Les chiffres ci-dessous sont des **hypothèses de départ**, pas des faits. S2 les remplace par des mesures sur RTX 3050. La variante exacte de la RTX 3050 de Gabriel (VRAM de 4 à 8 Go selon les versions) doit être relevée avant S2.

| Niveau | Usage | Triangles `[?]` | Représentation |
|---|---|---|---|
| L0 | héros et soldat incarné, plan rapproché | soldat ≤ 25 000 ; héros ≤ 80 000 ; Titan ≤ 120 000 | maillage squelettique complet |
| L1 | unités proches (≈ 60 au plus) | ≈ 6 000 | squelette allégé |
| L2 | unités moyennes | ≈ 1 500 | animation cuite |
| L3 | lointain, foules | impostor | instances regroupées |

| Préréglage | Intention | Réglages pressentis `[?]` |
|---|---|---|
| Bas | RTX 3050, jouable à 9 | ombres réduites, L0 limité au soldat incarné, 1080p avec mise à l'échelle |
| Moyen | RTX 3050, confortable | lumière cuite sur les décors fixes, ombres du soleil en cascade |
| Haut / Ultra | GPU plus puissants | L0/L1 étendus, brouillard volumétrique, textures lourdes |

Fonctions du moteur à étudier en S2 (non vérifiées ici) : génération automatique de niveaux de détail à l'import, instances regroupées (`MultiMesh`), plages de visibilité, cartes de lumière, décalques (pour les emblèmes déjà dessinés), culling par occlusion, rendu Forward+ ou Compatibilité.

## 8. Chaîne de modèles

Blender (scripts `bpy` versionnés) → glTF 2.0 (`.glb`) → import Godot. Un modèle a : un script, une empreinte, un manifeste (`origine: "creation-projet"`), un budget par niveau (section 7), un squelette partagé par famille (soldat, Titan), des animations nommées. Les 24 `.glb` actuels (5 accessoires, 7 tenues, 5 décalques, etc., 1,7 Mo) sont des **prototypes sans squelette** : le rigging est le lot M8. Aucun fichier de l'œuvre ou de fans (V4-D11).

## 9. Tests et commandes de vérification (modèle)

| Commande | Rôle | Où |
|---|---|---|
| `dotnet build` | compilation, avertissements = erreurs | nuage |
| `dotnet test` | tests de `Sim`, `Data`, `Net`, `Voice` | nuage |
| `Tools validate-data` | schémas + règles de données | nuage |
| `Tools canon-check` | création `A` correctement déclarée, aucun fait `C` contredit | nuage |
| `Tools assets-check` | provenance et licences des assets | nuage |
| `Tools selftest` | rejeu et empreintes (équivalent de `sim:selftest`) | nuage |
| `verify` | enchaîne tout ce qui précède | nuage |
| Godot en ligne de commande, sans fenêtre | import, chargement des scènes, captures | **machine avec GPU** pour tout jugement visuel ou de fluidité |

**Traces d'or** : pour chaque module repris fidèlement (`03`, section 4), l'ancien dépôt produit une fois un fichier de trace (commandes + empreintes à des ticks donnés) ; le port doit les reproduire. Cela remplace la discussion « est-ce pareil ? » par un test. Cela suppose que les générateurs aléatoires et la sérialisation soient reproduits à l'identique : à vérifier en M1.

## 10. Conventions de code

Identifiants en anglais, documentation et textes joueur en français ; types « nullable » activés ; aucun état statique mutable dans `Sim` ; enregistrements immuables pour les commandes et les événements ; une classe par fichier ; tout texte joueur par clé de traduction ; toute valeur d'équilibre `[A]` dans `data/balance`.
