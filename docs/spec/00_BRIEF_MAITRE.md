

# 00 — BRIEF MAÎTRE : « MURS ET SANG » (titre de travail)

> Jeu de stratégie profond, situé dans l'univers de *L'Attaque des Titans* (Shingeki no Kyojin).
> **Usage strictement personnel et non commercial.** Aucune distribution.
> Tu es l'IA chargée de le construire. Lis les 6 fichiers dans l'ordre avant d'écrire une seule ligne de code.

## 0. LES 6 FICHIERS

| # | Fichier | Rôle |
|---|---------|------|
| 0 | `00_BRIEF_MAITRE.md` | Vision, périmètre, stack, architecture, règles de travail (ce fichier) |
| 1 | `01_LORE_MONDE_CANON.md` | Univers : chronologie, géographie, factions, personnages, règles du monde |
| 2 | `02_SYSTEMES_STRATEGIQUES.md` | Couche stratégique : économie, politique, renseignement, recherche, personnages, Titans |
| 3 | `03_COMBAT_TACTIQUE.md` | Combat : manœuvre tridimensionnelle, Titans, formations, sièges, Marley moderne |
| 4 | `04_DA_UI_UX.md` | Direction artistique, interfaces, audio, pipeline d'assets, look « non-IA » |
| 5 | `05_DONNEES_ET_PLAN.md` | Schémas de données, contenu à produire, plan de dev par phases, tests, prompts |
| 6 | `06_ATLAS_LIEUX.md` | Atlas : 134 provinces, POI, 40 cartes tactiques, 30 intérieurs, réseaux, actions par province |
| 7 | `07_PERSONNAGES_JOUABLES_ET_GENERAUX.md` | 28 personnages jouables, rosters de généraux, capacités de commandement, arbres de compétences |
| 8 | `08_CONSEILLERS_ET_INSTITUTIONS.md` | 18 rôles de conseillers, mécaniques, cabinets par faction, institutions, grades, séances |
| 9 | `09_FONCTIONNALITES_ETENDUES.md` | ≈ 330 fonctionnalités numérotées avec priorité et phase |
| 10 | `10_CATALOGUES_UNITES_EQUIPEMENTS.md` | Unités, équipements, bâtiments, Titans, véhicules, documents, méga-projets |
| 11 | `11_AUDIT_LORE_ET_CORRECTIONS.md` | Audit de cohérence lore : corrections, fenêtres de présence des personnages, règles anti-anachronisme |
| 12 | `12_EVENEMENTS_CANON.md` | 60 événements canon : ordre, déclencheurs, choix, effets, points de bifurcation, graphe de dépendances |
| 13 | `13_CATALOGUE_TECHNOLOGIES.md` | ≈ 70 technologies : conditions de déblocage par événement, date minimale, doctrines, anachronismes interdits |
| 14 | `14_PROMPT_PHASE_0.md` | Prompt d'exécution de la phase 0 : tâches, critères d'acceptation vérifiables, vecteurs de test, rapport de fin de phase |

**Ordre de lecture** : 00 → 01 → **11** → 02 → 03 → 04 → 06 → 07 → 08 → 10 → **12** → **13** → 09 → 05 → **14** (le fichier 11 se lit juste après le lore ; le 09 après les catalogues ; le 05 donne le plan d'exécution global).

En cas de contradiction : **11 (audit lore) > 01 (lore) > 02/03 (mécaniques) > 06/07/08/10 (contenu) > 09 (fonctions) > 04 (DA) > 05 (plan)**, sauf si une contradiction rend le jeu injouable : tu la signales alors dans `DECISIONS.md`. Les faits de lore marqués `[?]` restent paramétrables, jamais figés dans le code.

**Intégration des fichiers 06–10 dans le plan (fichier 05)** : P1 utilise le 06 (provinces) ; P2 le 07 (personnages) et le 08 (conseillers/institutions) ; P3–P4 le 10 (unités/équipements) ; toutes les phases piochent dans le 09 selon la priorité/phase indiquée sur chaque fonction.

## 1. VISION

Un jeu de grande stratégie en temps réel avec pause (type Paradox) couplé à des **batailles tactiques** où la manœuvre tridimensionnelle (ODM) est le cœur sensoriel. Le joueur gère **un État, une armée, une idéologie, un secret**, dans un monde où :
- l'humanité est enfermée derrière trois murs, nourrie de mensonges ;
- la menace n'est pas seulement le Titan mais **la politique, la faim, la mémoire, l'histoire** ;
- chaque décision coûte des vies identifiables, car les soldats sont des **individus** avec noms, traits, liens et traumas.

Le jeu doit donner la sensation de **l'attrition, du doute moral, de la découverte progressive** (le joueur ne sait pas d'emblée ce qu'il y a derrière les murs, selon le scénario).

## 2. PILIERS DE DESIGN (non négociables)

1. **Fidélité d'abord.** Chaque mécanique doit se justifier par le lore (voir fichier 01). Quand le canon est muet, c'est une *adaptation* explicitement marquée `[A]`.
2. **Les individus comptent.** Pas d'unités anonymes dans le Corps de Reconnaissance. Perdre un vétéran se ressent (compétence perdue, moral, relations).
3. **Ressources rares, décisions tragiques.** Gaz, lames, nourriture, hommes : jamais assez. Pas de « mal nécessaire » gratuit : toute décision dure doit avoir un coût visible et des conséquences systémiques.
4. **Information imparfaite.** Brouillard de guerre, rapports tardifs ou faux, espions, rumeurs. Le renseignement est un jeu à part entière.
5. **Pas de manichéisme.** Chaque faction a une logique interne crédible, des idéologues, des modérés, des opportunistes.
6. **Lisibilité avant spectacle.** Une bataille complexe doit rester compréhensible. Chaque mort doit être explicable (log de combat).
7. **Look artisanal.** L'interface et la DA doivent sembler *dessinées et composées par des humains* (voir fichier 04).

## 3. PÉRIMÈTRE : MODES ET SCÉNARIOS

**Modes**
- **Canon Fidèle** : événements scénarisés « souples » (déclencheurs historiques ; le joueur peut les faire diverger).
- **Histoire Libre** : mêmes conditions de départ, scripts désactivés, IA pleine liberté.
- **Bac à sable** : choix de faction, date, difficulté, paramètres du monde.

**Scénarios de départ** (détaillés en 01 et 05)
1. **845 — La Brèche** : défense/chute de Shiganshina, crise des réfugiés.
2. **850 — Reconquête** : Trost, Corps de Reconnaissance, intrigues royales.
3. **854 — Le Monde Extérieur** : Marley, Hizuru, Forces Alliées, Paradis.
4. **854 (fin) — Le Grondement** : scénario de crise finale.
5. *(Phase tardive, optionnel)* **Ère impériale** : empire eldien et Grande Guerre des Titans.

**Factions jouables (v1)** : Paradis-Corps de Reconnaissance (administration royale puis régime post-coup), Garnison, Marley, Hizuru, Forces Alliées du Moyen-Orient, Volontaires Anti-Marley/Restaurationnistes (scénario 854).

## 4. STACK TECHNIQUE (décision par défaut)

| Couche | Choix | Pourquoi |
|--------|-------|----------|
| Langage | **TypeScript** strict | Fiabilité du code généré par IA, typage des données |
| Build | **Vite** | Lancement local simple (`npm run dev`) |
| Rendu carte/tactique | **PixiJS v8** (WebGL/WebGPU) + shaders GLSL maison | Performance 2D, effets papier/encre |
| UI | **DOM + CSS artisanal** (pas de Tailwind par défaut, pas de lib de composants stylés) | Contrôle total du rendu, éviter le look générique |
| Simulation | Module TS pur, **déterministe**, tournant dans un **Web Worker** | Reproductibilité, saves, tests, fluidité |
| État | Store maison + commandes/événements (event sourcing léger) | Replays, debug, annulation |
| Données | JSON validé par **Zod** | Moddabilité, erreurs claires |
| Sauvegarde | IndexedDB + export fichier | Persistance locale |
| Audio | Howler.js ou WebAudio direct | Mixage couches musicales |
| Tests | **Vitest** + tests de simulation headless | Équilibrage automatisé |
| Packaging (optionnel) | **Tauri** | Application desktop locale légère |

*Alternative acceptée* : **Godot 4 (GDScript/C#)** si tu juges que le rendu 3D/ODM l'exige. Dans ce cas, garde la même séparation simulation / présentation et documente le choix dans `DECISIONS.md`. Ne mélange pas deux moteurs.

## 5. ARCHITECTURE

```
/src
  /sim            # Logique pure, AUCUNE dépendance DOM/Pixi
    /core         # temps, RNG seedé, bus d'événements, commandes
    /strategic    # économie, politique, renseignement, recherche, diplomatie
    /tactical     # combat, ODM, titans, IA tactique
    /characters   # personnages, traits, relations, titans-hôtes
    /ai           # IA de factions et IA tactique
    /events       # moteur d'événements et de divergence
  /data           # JSON : provinces, unités, techs, traits, événements, etc.
  /render         # Pixi : carte stratégique, scène tactique, shaders, particules
  /ui             # écrans, composants, thèmes, tooltips
  /audio
  /i18n           # fr.json (principal), en.json
  /tools          # scripts de validation, génération d'assets procéduraux, sim d'équilibrage
/tests
/docs
  DECISIONS.md    # journal des décisions (obligatoire)
  CANON_CHECK.md  # tableau des faits de lore utilisés et leur statut
```

**Règles d'architecture**
- La **simulation est la source de vérité** ; l'UI ne la modifie que via des **commandes** (`Command`) validées.
- **RNG seedé** unique (ex. mulberry32/PCG) ; jamais de `Math.random()` dans `/sim`.
- **Pas de nombre magique** : tout équilibrage dans `/data/balance/*.json`.
- Tick stratégique = **1 jour** de jeu ; vitesses 1–5 + pause. Tick tactique = **fixe 20 Hz** de simulation, rendu interpolé.
- Chaque système expose : `init`, `tick`, `serialize`, `deserialize`, `explain` (renvoie les facteurs qui ont produit une valeur, pour les tooltips détaillés).
- **Toute valeur affichée doit pouvoir être expliquée** (tooltip « pourquoi ? ») : c'est un pilier d'interface (cf. fichier 04).

## 6. PROTOCOLE DE TRAVAIL POUR L'IA

1. **Travaille par phases** (fichier 05). Ne commence pas une phase sans que la précédente passe ses critères d'acceptation.
2. **À la fin de chaque phase** : lance les tests, fournis une commande de lancement, liste ce qui marche, ce qui manque, les choix faits.
3. **Aucun placeholder visible** : pas de « Lorem ipsum », pas de « TODO » affiché au joueur, pas d'icône emoji, pas de rectangle gris en guise d'illustration. Si un asset manque, génère un asset procédural propre ou un état « dossier non encore ouvert » diégétique.
4. **Lore** : n'invente pas de faits canon. Tout ce que tu ajoutes de ton cru est marqué `[A]` dans les données et dans `CANON_CHECK.md`. Si un fait est marqué `[?]` dans le fichier 01, traite-le comme **paramétrable** (dans les données) plutôt que comme certain.
5. **Sources et incertitude** : en cas de doute sur un fait de l'œuvre, dis-le explicitement dans `DECISIONS.md` plutôt que de produire quelque chose de plausible mais inventé.
6. **Pas d'actifs extraits** de l'anime, du manga, des jeux officiels ou de fans (images, sons, musiques, polices propriétaires). **Tout est recréé** : emblèmes redessinés dans un style original, musique composée/synthétisée, sons générés ou libres de droits (licences listées dans `/docs/ASSETS_LICENSES.md`).
7. **Qualité du code** : TypeScript strict, fonctions courtes, commentaires utiles (pourquoi, pas quoi), pas de dépendances inutiles, pas de fichier > ~500 lignes sans raison.
8. **Performance** : 60 FPS sur machine milieu de gamme avec 300 unités tactiques ; strategic tick < 8 ms pour 150 provinces.
9. **Équilibrage** : fournis un outil `npm run sim:balance` qui fait tourner N parties headless et sort des statistiques (durée, morts par cause, fréquences de victoire par faction).
10. **Communication** : à chaque phase, présente avant le code une liste en trois parties : *faits de lore sourcés dans les fichiers fournis* / *interprétations ou adaptations* / *éléments non confirmés ou laissés paramétrables*.

## 7. DÉFINITION DE « TERMINÉ » (globale)

- Une partie complète du scénario 850 peut se jouer de bout en bout (≈ 6–10 h), avec sauvegarde/chargement fiables.
- Toutes les mécaniques des fichiers 02 et 03 existent au moins sous forme « profonde mais jouable », avec tooltips explicatifs.
- Aucune interface ne ressemble à un template web générique (vérifier avec la checklist du fichier 04, §3).
- Les 4 scénarios sont lançables ; Marley et Paradis sont jouables.
- Tests de simulation verts ; déterminisme vérifié (même seed + mêmes commandes = même état final).

## 8. ROADMAP SYNTHÉTIQUE (détail en fichier 05)

- **P0** Squelette, outillage, RNG, bus, saves.
- **P1** Carte stratégique + temps + provinces + économie de base.
- **P2** Personnages, organisations, politique.
- **P3** Expéditions + auto-résolution + logistique.
- **P4** Combat tactique v1 (Titans purs + ODM).
- **P5** Renseignement, recherche, événements/divergence.
- **P6** Titans-hôtes, héritage, Fondation.
- **P7** Marley, Hizuru, Alliés : guerre moderne, diplomatie.
- **P8** DA complète, shaders, interfaces finales, audio.
- **P9** Scénarios, IA de factions, équilibrage.
- **P10** Polish, accessibilité, performance, documentation.



