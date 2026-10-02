

# 05 — DONNÉES, CONTENU À PRODUIRE, PLAN DE DÉVELOPPEMENT

> Ce fichier te dit **quoi produire, dans quel ordre, avec quels critères d'acceptation**. Il contient aussi des prompts prêts à l'emploi pour chaque phase.

## 1. CONVENTIONS DE DONNÉES

- Format **JSON**, validé par **Zod** au chargement (`/src/data/schemas.ts`). Une erreur de donnée = message clair avec chemin du fichier et du champ.
- **IDs** : `snake_case` stables (`prov_shiganshina`, `char_levi`, `evt_trost_breach_845`).
- Chaque entrée possède : `canon: "C" | "A" | "?"` et `notes_canon` (string facultative).
- **Textes** : jamais en dur ; clés i18n (`fr.json`).
- **Valeurs numériques** d'équilibrage : uniquement dans `/data/balance/`.
- **Versionnage** : champ `schemaVersion` ; migrateurs pour les saves.

## 2. SCHÉMAS (TypeScript)

```ts
type Canon = "C" | "A" | "?";

interface Province {
  id: string; name_key: string; canon: Canon;
  region: string; wall?: "maria" | "rose" | "sina" | null;
  terrain: "urbain" | "rural" | "foret" | "mur" | "cote" | "plaine" | "souterrain";
  population: { strates: Record<string, number> };
  production: Partial<Record<ResourceId, number>>;
  buildings: string[]; garrison_slots: number;
  neighbors: string[]; titan_density: number; // 0..1
  map_polygon: [number, number][]; // coordonnées carte
  tactical_template?: string;
}

interface Character {
  id: string; name: string; canon: Canon;
  birth_year: number;
  active_from?: number; active_until?: number; death_event?: string; // fenêtre canon (voir fichier 11 §3)
  faction: string; roles: string[];
  attributes: { odm: number; melee: number; aim: number; command: number;
                tactics: number; intellect: number; charisma: number;
                endurance: number; composure: number; };
  traits: string[]; loyalty: Record<string, number>;
  relations: { to: string; type: string; strength: number }[];
  titan?: { kind: TitanKind; acquired_year: number; control: number };
  portrait_key: string; bio_key: string;
}

interface Unit {
  id: string; kind: "escouade" | "regiment" | "convoi" | "flotte" | "escadrille";
  faction: string; members: string[]; // IDs de personnages ou effectifs abstraits
  location: string; supplies: { gas: number; blades: number; food: number };
  orders: Order[];
}

interface EventDef {
  id: string; canon: Canon; window: { from: Date; to: Date };
  trigger: Condition[]; choices: Choice[]; effects: Effect[];
  divergence_weight: number; text_key: string;
}

interface Tech {
  id: string; tree: string; cost: number; prereqs: string[];
  effects: Effect[]; exclusive_with?: string[]; canon: Canon;
  unlock_event?: string; // ex. 'evt_thunder_spears_seized_850' (voir fichier 11)
}

interface Trait { id: string; name_key: string; modifiers: Modifier[]; opposes?: string[]; }
interface Building { id: string; cost: Record<ResourceId, number>; effects: Effect[]; build_days: number; }
```

## 3. CONTENU À PRODUIRE (quotas minimaux)

| Catégorie | Quantité min | Remarques |
|---|---|---|
| Provinces Paradis | 70 | Murs, districts, forêts, plaines |
| Provinces monde (Marley/Hizuru/Alliés) | 60 | + zones maritimes |
| Personnages nommés | 80 | Canon + personnages `[A]` de remplissage |
| Traits | 40 | Avec modificateurs et oppositions |
| Bâtiments | 25 | Voir fichier 02 §3.4 |
| Technologies | 60 | 9 arbres |
| Lois/décrets | 40 | Effets systémiques |
| Événements canon | 60 | Voir §4 |
| Événements génériques | 150 | Incidents, rumeurs, crises locales |
| Types de Titans purs | 8 | + variantes comportementales |
| Cartes tactiques | 12 | Voir fichier 03 §2 |
| Modèles de rapports/articles | 100 | Gazette, télégrammes, lettres |
| Portraits | 80 | Gravure/encre, cohérents |
| Icônes | 150 | Ressources, états, ordres, traits |

## 4. ÉVÉNEMENTS CANON (liste de départ, dates `[?]` à paramétrer)

1. Brèche de Shiganshina (845) — Colossal/Cuirassé.
2. Crise des réfugiés (845–846).
3. Mission de reconquête de Wall Maria (846) — envoi massif de civils.
4. Remise des diplômes de la 104ᵉ promotion (850).
5. Brèche de Trost (850).
6. Première transformation d'Eren.
7. Opération de bouchage de la brèche.
8. Procès d'Eren / décision sur la garde.
9. Expédition 57 — titan féminin.
10. Stohess — capture/échec.
11. Invasion de Wall Rose (Titan Bestial), Ragako, **bataille d'Utgard** (nuit).
12. Révélation de la chapelle (famille Reiss).
13. Coup d'État contre le faux roi.
14. Couronnement d'Historia.
15. Retour à Shiganshina — Bestial, Cuirassé, Colossal ; **premier emploi des Lances de foudre**.
16. Découverte du sous-sol (archives familiales).
17. Ouverture sur l'océan, première flotte marleyenne de reconnaissance et arrivée des Volontaires anti-Marleyens (851), contacts avec Hizuru (852–854).
18. Voyage vers Marley.
19. Attaque sur Liberio (854).
20. Guerre Marley–Paradis.
21. Coup d'État Yeagerist.
22. Le Grondement (déclenchement).
23. Réponse des Alliés.
24. Combats finaux.
*(Compléter jusqu'à 60 avec événements intermédiaires de politique, logistique, Corps de Reconnaissance, Marley, Hizuru.)*

## 5. PLAN DE DÉVELOPPEMENT PAR PHASES

### P0 — Fondations
**Livrables** : repo, Vite+TS strict, ESLint, Vitest, structure dossiers, RNG seedé, bus d'événements, système de commandes, sauvegarde IndexedDB, loader JSON+Zod, i18n minimal, console debug.
**Acceptation** : `npm run dev` ouvre une page ; `npm test` vert ; test de déterminisme (1000 ticks, 2 runs identiques) ; save/load roundtrip.

### P1 — Carte stratégique et économie de base
**Livrables** : rendu Pixi de la carte (Paradis), temps/vitesses/pause, provinces avec ressources, production/consommation, HUD v1, dossier de province, overlays.
**Acceptation** : 70 provinces chargées ; 1 an de jeu sans erreur ; tooltips « pourquoi ? » sur toutes les valeurs ; rendu atlas conforme au fichier 04 §3.

### P2 — Personnages, organisations, politique
**Livrables** : base de personnages (≥ 40), traits, relations, organisations (Corps, Garnison, MP, Culte, Cabinet), légitimité, lois, votes, fiches personnage.
**Acceptation** : un décret provoque des effets en chaîne visibles ; cabinet votable ; mort d'un personnage a des conséquences relationnelles et politiques.

### P3 — Expéditions et logistique
**Livrables** : planificateur d'expédition, chaîne d'approvisionnement, convois, attrition, auto-résolution v1, rapports post-mission.
**Acceptation** : 100 expéditions simulées sans crash ; distribution de pertes plausible (voir 02 §15) ; rapport lisible.

### P4 — Combat tactique v1
**Livrables** : scène tactique, ODM (ancrage, rail, gaz), Titans purs + IA, escouades, signaux, lames/usure, journal de combat, 4 cartes.
**Acceptation** : 300 unités à 60 FPS ; déterminisme ; mort individuelle expliquée ; auto-résolution cohérente avec combat joué (±15 % sur pertes moyennes).

### P5 — Renseignement, recherche, événements
**Livrables** : brouillard de guerre, agents, rapports bruités, arbres de recherche, moteur d'événements + divergence, 30 événements canon.
**Acceptation** : un rapport peut être faux ; une technologie débloque une mécanique réelle ; une divergence modifie la suite des événements.

### P6 — Titans-hôtes et héritage
**Livrables** : porteurs, horloge des 13 ans, transformation, capacités en combat, héritage, mémoire/visions, Fondation.
**Acceptation** : un porteur peut mourir/hériter ; décisions d'héritage ont un coût systémique ; toutes les capacités du fichier 03 §8 existent.

### P7 — Marley, Hizuru, Alliés
**Livrables** : provinces monde, guerre moderne (artillerie, marine, aviation simplifiées), diplomatie, traités, IA de factions, scénario 854.
**Acceptation** : partie jouable côté Marley ; Hizuru peut changer de camp ; Titans comme armes stratégiques.

### P8 — DA, interfaces finales, audio
**Livrables** : tous les écrans du fichier 04 §5, shaders, textures, portraits, icônes, musique adaptative, SFX.
**Acceptation** : checklist du fichier 04 §2 validée sur **chaque écran** ; revue visuelle sans « template look ».

### P9 — Scénarios, IA, équilibrage
**Livrables** : scénarios 845, 850, 854, Grondement ; difficultés ; `sim:balance` ; réglages.
**Acceptation** : 1000 parties headless par scénario ; aucune faction ne gagne > 70 % ; durée moyenne cohérente.

### P10 — Polish et documentation
**Livrables** : accessibilité, perf, bugs, manuel in-game, `README`, `DECISIONS.md` finalisé, `CANON_CHECK.md`, `ASSETS_LICENSES.md`.
**Acceptation** : parcours complet 850 sans bug bloquant ; tests verts ; perf conforme.

## 6. STRATÉGIE DE TESTS

- **Unitaires** : formules (production, moral, dégâts), RNG, sérialisation.
- **Simulation headless** : parties accélérées, statistiques ; détection de **cycles dégénérés** (spirales de mort, famines systématiques).
- **Déterminisme** : hash de l'état final comparé.
- **Golden files** : cartes générées, événements, textes clés.
- **Tests visuels** : captures automatisées des écrans clés (régression).
- **Perf** : benchmark des ticks stratégiques et tactiques.

## 7. GESTION DU LORE ET DES INCERTITUDES

- `docs/CANON_CHECK.md` : tableau `fait | statut [C]/[A]/[?] | où utilisé | note`.
- L'**onglet Archives** affiche ces statuts au joueur.
- Si l'utilisateur corrige un `[?]`, il modifie le JSON, **sans toucher au code**.
- Avant de rédiger tout texte de lore long, présente trois listes séparées :
  1. **Affirmations sourcées** (présentes dans les fichiers fournis)
  2. **Affirmations interprétatives** (adaptations `[A]`)
  3. **Éléments non confirmés** (`[?]`)

## 8. RISQUES ET PARADES

| Risque | Parade |
|---|---|
| Scope trop vaste | Phases strictes ; MVP jouable dès P4 ; « profond mais jouable » |
| Look générique | Checklist 04 §2 ; revue par écran ; ressources dessinées |
| Lore inventé | Convention `[C]/[A]/[?]` ; `CANON_CHECK.md` |
| Perf tactique | Index spatial ; LOD ; profilage en continu |
| Déséquilibre | `sim:balance` ; difficultés ; paramètres externes |
| Dérive de code | Typage strict ; tests ; architecture simulation/présentation |

## 9. PROMPTS PRÊTS À L'EMPLOI

### 9.1 Prompt de démarrage (à coller en premier)
```
Tu vas construire un jeu de stratégie personnel (usage non commercial) dans l'univers de
L'Attaque des Titans. Lis intégralement les 6 fichiers joints (00 à 05) dans l'ordre.
Avant de coder, produis :
1) un résumé de ta compréhension (10 lignes max),
2) la liste des ambiguïtés ou contradictions que tu as repérées,
3) un plan détaillé de la phase P0 avec critères d'acceptation vérifiables.
Règles : respecte la convention [C]/[A]/[?], n'invente pas de lore sans le marquer, ne mets
aucun placeholder visible, ne copie aucun asset de l'œuvre. Attends ma validation avant P1.
```

### 9.2 Prompt de fin de phase
```
Phase Pn terminée. Fournis : (a) commande de lancement, (b) résultats des tests,
(c) liste « fait / partiel / manquant », (d) trois listes distinctes :
affirmations sourcées dans mes fichiers / interprétations ou adaptations / éléments non
confirmés ou laissés paramétrables, (e) mises à jour de DECISIONS.md et CANON_CHECK.md.
Ne démarre pas la phase suivante sans mon accord.
```

### 9.3 Prompt de revue DA
```
Passe en revue l'écran X avec la checklist du fichier 04 §2. Pour chaque critère, réponds
OK/KO avec justification et capture. Corrige tout KO avant de continuer. Signale tout élément
qui ressemble à un template web générique (cartes arrondies, ombres douces, icônes de
bibliothèque non retouchées, dégradés modernes).
```

### 9.4 Prompt d'équilibrage
```
Lance sim:balance sur le scénario Y avec 1000 seeds. Fournis : durée moyenne, taux de victoire
par faction, causes de mort, ressources limitantes, cas dégénérés. Propose des ajustements
chiffrés dans /data/balance/ (diff clair) sans modifier le code.
```

## 10. TEMPLATE `DECISIONS.md`

```
## [Date] — [Titre]
- Contexte :
- Options envisagées :
- Décision :
- Justification :
- Impact (code/données/DA) :
- Statut canon (C/A/?) si lié au lore :
```

## 11. ORDRE DE PRIORITÉ SI LE TEMPS MANQUE

1. P0–P4 (jeu jouable avec carte, économie, personnages, combat).
2. P5 (renseignement/événements) pour la profondeur.
3. P8 partiel (DA) sur les écrans les plus utilisés.
4. P6 (Titans-hôtes) puis P7 (Marley/monde).
5. P9–P10 (équilibrage, polish).

> **Rappel final** : mieux vaut un jeu **cohérent, profond, lisible** sur le scénario 850 qu'un jeu **vaste mais superficiel**. La fidélité se mesure à la **justesse des mécaniques par rapport au lore**, pas à la quantité de contenu.



