

# 03 — COMBAT TACTIQUE

> Valeurs `[A]` sauf mention. Tout est dans `/data/balance/tactical.json`.
> Objectif : **sensation de vitesse, de verticalité, de fragilité**, tout en restant **lisible et stratégique**.

## 1. PRINCIPES

1. **Temps réel avec pause active** : pause, ralenti ×0.25, ×0.5, ×1, ×2. Les ordres peuvent être donnés en pause.
2. **Simulation 20 Hz déterministe**, rendu interpolé.
3. **Verticalité réelle** : la carte tactique est en **2.5D** (couches de hauteur) : sol, toits, murs, arbres, tours. Les unités ODM se déplacent en 3D logique (x, y, z).
4. **Fragilité** : un soldat touché par un Titan est **presque toujours mort ou hors-combat** ; la compétence tient à *ne pas être touché*.
5. **Coût de chaque action** : gaz, lames, endurance, stress.
6. **Lisibilité** : signaux (fusées), codes visuels, journal de combat expliquant chaque mort.

## 2. CARTES TACTIQUES (types)

| Type | Caractéristiques |
|---|---|
| **Ville des Murs** (Trost, Shiganshina, Stohess) | Toits, rues étroites, points d'ancrage nombreux, civils à évacuer, incendies |
| **Forêt des Arbres Géants** | Troncs ≈ 80 m, ancrages abondants, visibilité faible, risque de sol |
| **Plaine / Hors-murs** | Peu d'ancrages, chevaux, formation en éventail, forte exposition |
| **Mur (sommet/face)** | Canons, ancrages limités, vent, risque de chute |
| **Château / Fort (Utgard, Slava)** | Intérieurs, escaliers, murs d'enceinte |
| **Front Marley** | Tranchées, artillerie, avions, trains blindés, blindés `[?]` |
| **Mer / Côte** | Navires, plages, marine marleyenne/Hizuru |
| **Souterrains (Mitras)** | Couloirs, faible visibilité, combat urbain |

- Génération par **briques de terrain** (templates) + variations seedées. Pour les lieux canon (Trost, Shiganshina, etc.), cartes **semi-manuelles** (layout fixe + détails procéduraux).
- **Points d'ancrage** : chaque structure expose des `anchors[]` (position, type, solidité). Sans ancrage, pas d'ODM.

## 3. UNITÉS

### 3.1 Soldats (individus)
Statistiques : `hp`, `endurance`, `ODM_skill`, `melee`, `aim`, `reaction`, `courage`, `stress`, `gaz`, `lames`.
Rôles : **Éclaireur** (vitesse, signal), **Tueur** (ODM d'élite), **Soutien** (gaz/lames, soins), **Artilleur** (canons), **Cavalier**, **Garnison** (défense), **MP** (contrôle de foule), **Commandement**.
- **Courage** et **stress** modifient précision, réaction et obéissance.
- **Ackerman** : multiplicateurs spéciaux (vitesse, réactivité, précision de coupe) ; rares, très puissants, limités par fatigue et gaz.

### 3.2 Équipements
- **ODM** : réserves de gaz (≈ 100 u), lames (2 paires, ≈ 4–8 coupes efficaces chacune), crochets (portée ~ 40–60 m `[?]`).
- **Lances de foudre** (**disponibles seulement après la fin de 850**, voir fichier 11) : dégâts de zone élevés, capables de percer l'armure durcie ; tirées depuis le bras ; 1 par soldat spécialisé ; risque de **tir fratricide** ; précision faible à longue portée.
- **ODM anti-personnel** (Police intérieure) `[C]` : armes à feu intégrées, usage contre humains ; **arme de contention spéciale** `[C]` (capture de porteurs).
- **Canons** : anti-Titan (fixes/mobiles), cadence lente.
- **Fusils** : peu utiles contre Titans purs sauf distraction ; efficaces contre humains.
- **Marley** : fusils à répétition, **fusils anti-Titan** `[C]`, mitrailleuses, mortiers, artillerie lourde, avions, dirigeables `[C]`, blindés `[?]`.

## 4. MANŒUVRE TRIDIMENSIONNELLE (ODM) — RÈGLES

### 4.1 Modèle de mouvement `[A]`
- État : `position(x,y,z)`, `vitesse`, `anchors actifs` (0–2), `gaz`, `mode` (sol, vol, rail, chute).
- **Tir de crochet** : cible un ancrage dans le rayon ; délai `0.15–0.3 s` selon compétence.
- **Rail** : l'unité accélère vers l'ancrage ; **vitesse** = base + `gaz_burst` ; collision possible.
- **Momentum** : la vitesse conservée à la fin d'un rail permet des **arcs balistiques** ; le gaz permet des corrections.
- **Consommation** : 1.0–2.5 u/s en poussée ; 0 en glisse ; pics lors de manœuvres brusques.
- **Perte de contrôle** : si `gaz = 0` ou crochets non ancrés → **chute** (dégâts selon hauteur), récupération possible via un ancrage de fortune.

### 4.2 Attaques de coupe
- **Approche** : trajectoire orientée vers la nuque.
- **Fenêtre de coupe** : durée courte (~0.2 s) ; réussite = f(vitesse, angle, compétence, lame).
- **Lames** : chaque coupe **abîme** la lame (usure) ; casse possible → changement de lames (1.5 s).
- **Succès critique** : coupe parfaite (nuque tranchée) → mort immédiate du Titan pur.
- **Échec** : blessure partielle, chute, ou capture.

### 4.3 Défense et esquive
- **Réaction** : unité détecte attaque de Titan → tentative d'esquive (ancrage, bond, contre-poussée).
- **Capture** : si le Titan saisit l'unité → probabilité de **coup de grâce** d'un camarade, de libération ou de mort.
- **Panique** : stress élevé → hésitation, mauvais ancrage, gaspillage de gaz.

## 5. TITANS PURS : COMPORTEMENT ET IA

### 5.1 Perception
- **Vision** (jour) : portée ~ 100–200 m ; faible la nuit.
- **Ouïe/bruit** : détection de groupes, cris, explosions.
- **Attraction** : priorité aux humains **les plus proches/nombreux** ; **les Titans purs ignorent** la nourriture et les animaux sauf stimulus.
- **Déviants** : comportement modifié (poursuite, anticipation, contournement des pièges).

### 5.2 Taille, vitesse et menace `[A]`
| Classe | Taille | Vitesse | Notes |
|---|---|---|---|
| Petit | 3–5 m | Lente–moyenne | Facile à abattre |
| Moyen | 6–9 m | Moyenne | Standard |
| Grand | 10–15 m | Moyenne/rapide | Dangereux en nombre |
| **Anormal** | 5–15 m | Rapide/erratique | Imprévisible |
| **Cavalier** (shifters) | variable | Variable | Voir §8 |

- **Régénération** : membres coupés se reforment, mais **la nuque** détruite = mort.
- **Hiver/nuit** : activité réduite ; **soleil** : activité plus forte.

### 5.3 Stratégies de Titans
- **Meute** : effet « horde » → saturation d'un point.
- **Piège** : certains anormaux ignorent l'appât.
- **Mur** : attirés par les points d'ancrage où se tiennent des humains ; **Titans-Murs** (≈ 50 m) inertes jusqu'au Grondement `[C]`.

## 6. ESCOUADES ET FORMATIONS

- **Escouade** : 4–6 individus ; chef + roles ; cohésion.
- **Formation de reconnaissance longue portée** `[C]` : disposition en éventail avec signaux ; l'IA applique des règles : détection → fusée rouge → réorientation ; **abnormal** → fusée noire ; changement de route → fusée verte.
- **Colonnes lourdes** : chariots, escortes, sécurité accrue, vitesse réduite.
- **Formations de siège** : défense en profondeur, tireurs en hauteur, équipes d'ODM mobiles.
- **Contrôle** : le joueur peut **donner des ordres par groupe** ou **laisser l'IA suivre les règles de formation**.
- **Ordres types** : avancer, tenir, repli, diversion, tuer cible, escorter, évacuer, couvrir, incendier.

## 7. SIGNAUX (FUSÉES) ET COMMUNICATION

- **Code du Corps (expédition 57)** `[C]` : **rouge** = Titan repéré ; **vert** = changement de direction ; **noir** = Titan anormal.
- **Code de la Garnison** `[C]` : **vert** = mission commencée ; **rouge** = mission échouée ; **jaune** = mission réussie/terminée (un jaune après un rouge annule l'échec).
- Les couleurs bleu/violet ne sont **pas retenues** (source mineure).
- **Transmission** : visibilité dépend de la fumée, du terrain, du jour/nuit ; **retard** de propagation (relais).
- **Erreurs de signal** : mauvais code, fumée absente, mauvaise interprétation = **risque majeur**.

## 8. PORTEURS DE TITANS EN COMBAT

### 8.1 Mécanique générale
- **Transformation** : animation + délai (1–3 s) ; coût d'endurance ; **cooldown**.
- **Points de vie** : barre de santé + zones (nuque, jambes, bras).
- **Régénération** : régénère mais **consomme de l'endurance** ; en dessous d'un seuil → fatigue ; **cristal** = renforcement.
- **Perte de contrôle** : si le porteur subit de fortes blessures + stress, **chance d'échec** ; dangers de **détransformation** involontaire.

### 8.2 Capacités (chacune = fiche de données)
| Titan | Capacité principale | Contre-mesures |
|---|---|---|
| **Colossal** | Onde de chaleur, taille massive, destruction de murs | Canons massés, lances de foudre (dès fin 850), bombes, attaque sur la nuque |
| **Cuirassé** | Armure durcie, charge | Pointes explosives, marteaux, lances multiples |
| **Féminin** | Durcissement local, cri d'appel | Lames spéciales, piège |
| **Bestial** | Lancers de projectiles, contrôle de purs | Abri, tireurs |
| **Mâchoire** | Vitesse, morsure | Terrain, filets, coups précis |
| **Charrette** | Endurance, transport | Épuisement |
| **Marteau de guerre** | Cristal, créations solides | Brisement + nuque |
| **Assaillant** | Combat rapproché, régénération | Combiné |
| **Fondateur** | Contrôle de purs, Grondement | Cas scénarisés |

> Chaque capacité a : **coût**, **portée**, **délai**, **effets**, **limites** (ex. durcissement ne couvre pas toute la surface).

## 9. DÉGÂTS, MORT, BLESSURE

- **Soldats** : blessures légères (pénalité) / graves (hors combat) / mortelles. **Hémorragie** et **infection** simulées.
- **Titans purs** : mort si nuque coupée ; membres coupés → régénération en N secondes.
- **Résultats** : après bataille, chaque blessé/mort a un **dossier** (cause, lieu, escouade).
- **Journal de combat** : chronologie lisible (« 14:32 — Pvt X ancre T-12, coupe nuque, lame cassée »).

## 10. MORAL ET PANIQUE

- **Morale d'escouade** : influence ordres, risque de fuite, qualité d'ODM.
- **Chocs** : mort d'un chef, vue d'un anormal, Titan hors de portée, feu, bruit.
- **Gestion** : discours (si commandement élevé), renforts, retraite organisée.
- **Désertion** : possible, avec conséquences politiques.

## 11. SIÈGES ET SCÉNARIOS-TYPES

- **Brèche de porte** (Shiganshina/Trost) : flot de Titans, évacuation, défense de passage.
- **Opération de recapture** (Trost 850) : plan, bouchage de brèche, convois.
- **Opération en forêt** (poursuite de Titan féminin) : piège, appât, retrait.
- **Utgard** (850) : défense statique d'une tour, de nuit, contre des Titans actifs la nuit sous l'influence du Bestial `[C]` ; le château est **détruit** à l'issue.
- **Retour à Shiganshina** : combat contre Colossal/Cuirassé/Bestial.
- **Liberio** : assaut urbain moderne.
- **Fort Slava** : assaut côtier/combiné `[?]`.
- **Grondement** : pas de bataille « classique » ; système de **crise** avec moyens de défense/diplomatie.

## 12. AUTO-RÉSOLUTION

- Option pour les batailles mineures. Calcul basé sur : effectifs, compétence, gaz/lames, terrain, moral, signaux, présence d'anormaux, porteurs.
- **Aléa** : distribution large pour refléter l'imprévisible (queues épaisses).
- **Résultat** : pertes détaillées, décès individuels, rapport textuel.
- **Cohérence** : l'auto-résolution doit produire des **statistiques proches** de la bataille jouée (test automatique).

## 13. CAMÉRA, CONTRÔLES, RETOURS

- **Caméra** : libre, suivre escouade, suivre individu ; zoom ; vue « carte » simplifiée.
- **Retours** : traînées de gaz, lueur de lames, secousses, bruits spatiaux, ralenti sur coupe réussie.
- **Contrôles** : sélection par glisser, groupes numérotés, ordres contextuels, pause active, raccourcis.
- **Accessibilité** : options de réduction de secousses, lisibilité daltonien, taille de texte.

## 14. TESTS ET QUALITÉ

- **Déterminisme** : mêmes seeds + ordres = mêmes résultats.
- **Tests automatiques** : 1000 batailles headless ; taux de mortalité ; fréquence de défaites ; cohérence auto-résolution.
- **Perf** : ≥ 60 FPS avec 300 unités ; pathfinding et ancrage optimisés (index spatial).
- **Debug** : overlay de portées, ancrages, signaux, trajectoire de balistique.



