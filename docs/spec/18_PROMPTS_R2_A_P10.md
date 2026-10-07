# 18 — PROMPTS DE R2 À P10 (VERSION MISE À JOUR)

> **Remplace** la partie R2 à P10 du fichier 16. Les phases R0, R1 et R1b restent celles des fichiers 16 et 17.
> **Prérequis :** R1 et R1b terminées, rapports relus, et ta décision prise : **RENDU = 3D**. Ces prompts supposent la 3D (three.js). Si tu choisis la 2.5D, dis-le-moi : R2, R3 et R4 sont à réécrire.
> **Une phase par session.** Colle le prompt entier, en un message. Chaque prompt est autonome.

## 0. NUMÉROTATION (changée par rapport au fichier 16)

| Nouveau | Contenu | Ancien (fichier 16) |
|---|---|---|
| **R2** | Brancher le rendu 3D sur la bataille réelle | « R2.0 » (que je t'avais conseillé d'isoler) |
| **R3** | Figures : Titans, soldats, poses, états | R2 |
| **R4** | Environnements et effets en bataille | R3 |
| **R5** | Carte stratégique | R4 |
| **R6** | Interfaces et portraits | R5 |
| **R7** | Identités de faction, menu, épilogue | R6 |
| **R8** | Audio et retours | R7 |
| **R9** | Environnements du monde extérieur (Marley, Hizuru, Alliés) | nouveau |
| **P9** | Scénarios, IA, équilibrage | P9 |
| **P10** | Finitions, accessibilité, documentation | P10 |

**Arrêts de revue obligatoires (CLAUDE.md à mettre à jour) :** après **R2, R4, R8 et P9**.
**Niveau de réflexion :** `/effort xhigh` pour R2, R3, R4, R9 et P9 ; `/effort high` pour les autres.

---

## 1. PROMPT R2 — BRANCHER LE RENDU 3D SUR LA BATAILLE RÉELLE

```
PHASE R2 : RENDU 3D BRANCHÉ SUR LA BATAILLE RÉELLE. RENDU = 3D (décision de l'utilisateur).
Écris d'abord docs/phases/R2.md. Lis docs/reports/R1.md et docs/reports/R1b.md.
Règles communes : CLAUDE.md (dont la ligne 14) ; un commit par tâche, `npm run verify` avant chaque
commit ; git diff <commit de départ de R2> -- src/sim VIDE ; aucun asset de l'œuvre ; arrêts obligatoires
de CLAUDE.md ; arrêt de revue à la fin.

CONTEXTE : le prototype de R1 est une scène de démonstration, non pilotée par la simulation. L'écran de
bataille réel (smoke:tactique) est en Pixi 2D. Il faut que la bataille réelle s'affiche en 3D, avec le
rendu 2D conservé en secours.

TÂCHES
 R2.1 Interface commune : repère l'interface de la vue 2D (src/render/tactical) et fais implémenter la
      même par la vue 3D. Bascule 2D/3D dans les options ; bascule automatique vers le 2D, avec un message
      clair, si WebGL est indisponible (three.js alors non téléchargé).
 R2.2 La vue lit l'état de la simulation en LECTURE SEULE (unités, Titans, ancrages, bâtiments, signaux).
      Les bâtiments et ancrages affichés DÉRIVENT des données de carte de la simulation, jamais
      l'inverse : le décor visuel doit correspondre aux obstacles réels.
 R2.3 Interactions en 3D : sélection par clic et par cadre, ordres (attaquer, tenir, repli, couvrir,
      suivre), pastilles d'escouade et flèches de bord projetées à l'écran, sous-titres sans recouvrement
      (reprends la logique de R0), pause active et vitesses, caméras (libre, suivi d'escouade, tactique).
 R2.4 Cadrage garanti (règle du critère f de R0) : à l'ouverture, tous les hommes du joueur et le porteur,
      tête comprise, sont visibles ; la tête n'est jamais coupée par la barre de titre ; flèches pour les
      Titans engagés hors champ. Tests par tableau, au moins 8 scénarios, à 1366×768 et 3840×2160.
 R2.5 Lisibilité à 300 unités : niveaux de détail, repères simplifiés au-delà d'une distance, silhouettes
      distinctes ; aucune perte de lisibilité par rapport au 2D.
 R2.6 Qualité bas, moyen, haut ; instanciation ; mesure d'images par seconde.
 R2.7 `npm run smoke:tactique3d` : mêmes contrôles que smoke:tactique (reprends chacun), adaptés à la 3D.

CRITÈRES (commandes, sorties réelles collées)
 - Parité : smoke:tactique3d passe tous les contrôles de smoke:tactique ; la bataille jouée en 3D et en 2D
   (même graine, mêmes ordres) donne le MÊME hash de résultat (le rendu n'influence pas la simulation).
 - Test : chaque bâtiment de la simulation a une géométrie 3D de même emprise (±0,1 m) ; chaque ancrage
   utilisé par la simulation est visible dans la scène.
 - Cadrage : 8 scénarios OK, tête du porteur comprise (boîte englobante calculée sur le rendu, pas sur le
   script).
 - git diff src/sim vide ; verify code 0 ; smoke:map, smoke:politique, smoke:p8 inchangés.
 - Captures 1366 et 4K de la bataille 3D, revues selon CLAUDE.md ligne 14.
 - Mesures sans GPU collées ; indique ce qui doit être mesuré sur un vrai GPU.
HORS PÉRIMÈTRE : nouveaux modèles de Titans, nouveaux environnements, audio, modification de src/sim.
ARRÊT OBLIGATOIRE : j'y joue sur mon PC et je valide.
```

**À lancer :** `/goal R2 est terminée : docs/reports/R2.md avec tous les critères en OK (ou « non vérifiable » justifié), PROGRESS.md indique « R2 terminée, arrêt de revue », git diff src/sim vide depuis le commit de départ, verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 150 tours.`

---

## 2. PROMPT R3 — FIGURES : TITANS, SOLDATS, POSES, ÉTATS

```
PHASE R3 : FIGURES. RENDU = 3D. Écris d'abord docs/phases/R3.md. Lis docs/reports/R1b.md et R2.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; git diff src/sim vide ;
aucun asset de l'œuvre ; arrêts obligatoires de CLAUDE.md. Si docs/art/assets/ existe (R1c), ces bases
CC0 sont autorisées ; sinon, tout est procédural.
RÉUTILISE le squelette paramétrique de R1b : ne le recrée pas.

TÂCHES
 R3.1 Fiche de proportions (docs/art/REFERENCE.md) par classe (3, 5, 8, 12, 15 m) et variante (anormal,
      sentinelle, chasseur, meute, nocturne), Titan-Mur ≈ 50 m, Titan de Rod Reiss ≈ 120 m, Colossal 60 m.
      Chaque Titan a une anatomie et un visage DIFFÉRENTS, pas tous souriants ; marque rouge sur la
      nuque. Marque les choix de design A.
 R3.2 Machine d'états lue depuis la simulation (sans la modifier) : repos, marche, course, saisie, main à la
      bouche (non graphique), accroupi, tête qui se tourne, à genoux, abattu, rampant (jambes coupées),
      transformation d'un porteur (éclair et vapeur). Fondus entre états.
 R3.3 Contact au sol : aucun pied sous le sol ni flottant (tolérance à justifier) ; test par pose.
 R3.4 Soldats : 8 types (éclaireur, tueur, soutien, cavalier, médecin, chef d'escouade, officier,
      Ackerman) reconnaissables à la silhouette et aux accessoires ; cape verte du projet, harnais, deux
      bouteilles de gaz, lames ; poses ODM : tir de crochet, balancement, coupe, chute, genou à terre, fusée.
 R3.5 Câbles et traînées de gaz cohérents avec les ancrages de la simulation ; lames qui se brisent.
 R3.6 Cavalier : cheval animé (marche, galop).
 R3.7 300 unités à l'écran : instanciation, niveaux de détail ; mesure d'images par seconde.
CRITÈRES (sorties réelles collées)
 - Test : silhouettes de Titans distinctes (recouvrement < 85 % deux à deux, rendus hors écran) ; 8 types de
   soldats distinguables de la même façon.
 - Test : hauteurs relatives conformes (±5 %) ; test de contact au sol pour chaque pose.
 - Test : l'état affiché correspond à l'état de la simulation à chaque tick (échantillon de 3 batailles).
 - smoke:tactique3d, sim:tactical, verify inchangés ou meilleurs ; git diff src/sim vide.
 - Planches docs/screenshots/r3-titans.png, r3-soldats.png, r3-poses.png ; revue ligne 14 de chacune.
HORS PÉRIMÈTRE : environnements, interface, audio.
```

**À lancer :** `/goal R3 est terminée : docs/reports/R3.md avec tous les critères en OK, PROGRESS.md indique « R3 terminée », git diff src/sim vide, verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 150 tours.`

---

## 3. PROMPT R4 — ENVIRONNEMENTS ET EFFETS EN BATAILLE (ARRÊT DE REVUE)

```
PHASE R4 : ENVIRONNEMENTS ET EFFETS EN BATAILLE. RENDU = 3D. Écris d'abord docs/phases/R4.md.
Lis docs/art/STYLES.md (catalogue E01–E29), docs/reports/R1b.md et R3.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; git diff src/sim vide
(les changements de données de cartes sont autorisés, ceux du code de la simulation non) ; arrêts
obligatoires de CLAUDE.md.

CONSTAT : les environnements de R1b existent en prototype ; la bataille réelle n'a que 4 cartes (ville,
forêt, mur, plaine) à l'aspect uniforme.

TÂCHES
 R4.1 Relier les cartes tactiques réelles aux profils de style : ville → au choix E01 Shiganshina, E02 Trost,
      E05 Stohess, E06 Mitras ; forêt → E14 ; mur → E22 ; plaine → E19 ou E13. Chaque carte tient son style
      de data/art/styles.json.
 R4.2 Nouvelles cartes tactiques (DONNÉES uniquement) : Shiganshina (portes), Trost, Stohess, Mitras
      (grande avenue), village (E11), campagne (E13), territoire des Titans (E19), forêt de lisière, château
      d'Utgard (nuit), abords de Shiganshina (E26–E29). Elles n'entrent PAS dans le calibrage de
      sim:tactical (D-62) sans validation de l'utilisateur ; signale-le.
 R4.3 Variantes d'état : 845 (brèche, incendies), 850 (porte extérieure scellée), 851 (repeuplée),
      Utgard détruit, ruines. Heure : aube, jour, crépuscule, nuit ; brume, pluie, neige d'hiver.
 R4.4 Occlusion : un bâtiment qui cache une unité devient translucide au survol ou à la sélection.
 R4.5 Effets : vapeur animée à la mort d'un Titan, poussière d'effondrement, étincelles de gaz et de lame,
      éclair et vapeur de transformation, feux de bâtiments.
 R4.6 Murs : chemin de ronde, canons sur rails, porte, variante endommagée ; mur visible à l'horizon seulement
      près des districts adossés à un mur (jamais dans la campagne intérieure).
 R4.7 Ancrages ODM : style discret et lisible.
CRITÈRES
 - Distinction mesurable des environnements (tableau : distance entre profils ET distance de couleur
   moyenne entre rendus) ; au moins 9 environnements différents jouables.
 - Test d'occlusion ; test « le mur n'est pas visible en campagne intérieure ».
 - smoke:tactique3d, sim:tactical (hors nouvelles cartes), verify inchangés ; git diff src/sim vide.
 - Captures docs/screenshots/r4-{environnement}-{jour,nuit}.png et r4-transformation.png (le Titan ET
   l'éclair visibles, tête comprise) ; revue ligne 14 de chacune.
ARRÊT OBLIGATOIRE : rapport et captures, puis j'attends ma revue.
```

**À lancer :** `/goal R4 est terminée : docs/reports/R4.md avec tous les critères en OK, PROGRESS.md indique « R4 terminée, arrêt de revue », git diff src/sim vide, verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 180 tours.`

---

## 4. PROMPT R5 — CARTE STRATÉGIQUE

```
PHASE R5 : CARTE STRATÉGIQUE (fichier 04 §3). Écris d'abord docs/phases/R5.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; ne modifie pas les règles
de la simulation ; arrêts obligatoires.
CONSTAT : carte en anneaux et secteurs, peu de relief, zoom « province » presque vide, noms qui recouvrent
des provinces, aucun tracé d'expédition lisible, rien ne s'adapte à la 4K.

TÂCHES
 R5.1 Relief et hydrographie : hachures de collines, rivières à l'encre, forêts, routes à trois niveaux ; l'île
      de Paradis ressemble à un territoire, pas à un disque.
 R5.2 Fidélité au lore : murs circulaires et concentriques ; districts aux quatre points cardinaux de chaque
      mur (Maria : Shiganshina au sud ; Rose : Utopia, Karanes, Trost, Krolva ; Sina : Orvud, Stohess,
      Ehrmich, Yarckel, Mitras au centre) ; Shiganshina dessinée comme une SAILLIE du Mur Maria avec deux
      portes ; villages Ragako, Dauper et Jinae dans le sud de l'intérieur de Rose.
 R5.3 Trois niveaux de zoom (monde, région, province) avec des détails propres à chacun ; à l'échelle
      province : bâtiments, champs, routes, postes de guet, vignette de style du district (E01–E29).
 R5.4 Murs en coupe stylisée avec état structurel visible (fissures) ; portes détaillées.
 R5.5 Pions d'unités avec ombre de papier ; brouillard de guerre en papier froissé ; « taches blanches »
      annotées « inexploré » ; mention « vu il y a N jours » sur les provinces non observées.
 R5.6 Expéditions : tracé de l'itinéraire avec cône d'incertitude de position (fichier 09, F-STR-08).
 R5.7 Toponymes sans chevauchement entre eux NI avec les provinces et les pions (placement avec
      évitement), courbés le long des murs.
 R5.8 Mise à l'échelle : la carte occupe l'espace disponible de 1366×768 à 3840×2160.
CRITÈRES
 - Test : aucun toponyme ne se chevauche, ni avec un autre, ni avec un pion, aux 3 niveaux de zoom ;
 - Test : la répartition des districts par mur est conforme à R5.2 (données) ;
 - captures docs/screenshots/r5-{monde,region,province}-{1366,4k}.png, revues ligne 14 ;
 - smoke:map et smoke:expedition OK ; temps de rendu mesuré (valeurs collées) ; verify code 0.
HORS PÉRIMÈTRE : combat, interfaces de fiches.
```

**À lancer :** `/goal R5 est terminée : docs/reports/R5.md avec tous les critères en OK, PROGRESS.md indique « R5 terminée », verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 150 tours.`

---

## 5. PROMPT R6 — INTERFACES ET PORTRAITS

```
PHASE R6 : INTERFACES (fichier 04 §5, §6). Écris d'abord docs/phases/R6.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; ne modifie pas la
simulation ; aucun asset de l'œuvre ; arrêts obligatoires.
CONSTAT : fiches en petits tableaux denses ; portraits = icônes au trait presque identiques ; aucune
illustration dans les dossiers d'événements et les gazettes ; texte minuscule en 4K ; infobulle qui
recouvre l'élément qu'elle explique.

TÂCHES
 R6.1 Échelle automatique : unités relatives, corps de texte ≥ 14 px à 100 % de zoom, de 1366 à 3840 px de
      large, largeur minimale 1024 px, contraste AA.
 R6.2 Portraits « gravure » : générateur par parties (crâne, cheveux, cicatrices, âge) avec ombrage à
      hachures ; DÉTERMINISTE par personnage ; au moins 30 visages distincts ; aucun trait copié de l'œuvre.
 R6.3 Vignettes d'événements dessinées par code (brèche, procès, expédition, deuil, séance, coup d'État),
      affichées dans les dossiers et la gazette.
 R6.4 Cabinet : plan de salle avec billes de vote ; tableau d'enquête (fils et épingles) pour le
      renseignement ; dossier de province avec coupe du mur.
 R6.5 Infobulles : jamais sur l'élément qu'elles expliquent ; imbrication possible.
 R6.6 Checklist 04 §2 appliquée écran par écran dans docs/reports/R6.md (OK/KO + capture).
CRITÈRES
 - Test : police calculée ≥ 14 px à 100 % sur chaque écran ; aucune boîte de texte qui déborde ni se
   chevauche (script sur tous les écrans) ;
 - Test : 30 portraits aux silhouettes distinctes (recouvrement < 85 %) ;
 - Test : une infobulle ne recouvre pas son élément source ;
 - captures de tous les écrans à 1366 et 3840 px ; smoke:politique et smoke:p8 OK ; verify code 0.
HORS PÉRIMÈTRE : audio, combat.
```

**À lancer :** `/goal R6 est terminée : docs/reports/R6.md avec tous les critères en OK, PROGRESS.md indique « R6 terminée », verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 150 tours.`

---

## 6. PROMPT R7 — IDENTITÉS DE FACTION, MENU, ÉPILOGUE

```
PHASE R7 : IDENTITÉS (fichier 04 §1). Écris d'abord docs/phases/R7.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; ne modifie pas la
simulation ; aucun asset ni insigne de l'œuvre (redessine) ; arrêts obligatoires.
CONSTAT : Marley et Hizuru ne se distinguent que par l'en-tête et la couleur ; le menu est vide aux deux
tiers ; le bilan de fin est un tableau de zéros.

TÂCHES
 R7.1 Paradis : pierre, cuir, laiton, papier jauni. Marley : acier, rouge sombre, papier journal, titres
      gothiques, ambiance administrative. Hizuru : washi, indigo, vermillon, estampes sobres. Alliés :
      sobre, cartes maritimes. Cadres, tampons, icônes et typographie propres à chacun.
 R7.2 Menu : table d'archives illustrée (carte, lampe, tiroir de scénarios) occupant l'écran ; scénarios
      845, 850, 854 et Grondement ; choix de nation illustré.
 R7.3 Épilogue : montage de documents (lettres, gazettes, gravures) généré à partir des décisions
      marquantes (fichier 12 §2) ; jamais de valeur nulle par défaut (« — » ou ligne masquée).
 R7.4 Aucune chaîne de développement visible hors du mode debug F2 ; relecture i18n FR (ton sobre,
      sans formule toute faite).
CRITÈRES : captures des 4 identités ; test qu'aucune chaîne de la liste « dev » n'apparaît hors F2 ;
épilogue généré pour 3 parties types (valeurs collées) ; smoke:p7 et smoke:p8 OK ; verify code 0.
```

**À lancer :** `/goal R7 est terminée : docs/reports/R7.md avec tous les critères en OK, PROGRESS.md indique « R7 terminée », verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 120 tours.`

---

## 7. PROMPT R8 — AUDIO ET RETOURS (ARRÊT DE REVUE)

```
PHASE R8 : AUDIO ET RETOURS (fichier 04 §7, 03 §13). Écris d'abord docs/phases/R8.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; ne modifie pas les règles
de la simulation ; tout est synthétisé par code, aucun échantillon externe, aucune musique de l'œuvre ;
arrêts obligatoires.

TÂCHES
 R8.1 Musique adaptative à 3 à 5 couches (calme, tension, combat) ; palette par faction.
 R8.2 Effets : sifflement du gaz, câbles, lames, impacts, pas de Titans (vibrations graves), canon, cloches,
      papier et tampon pour l'interface.
 R8.3 Mixage : baisse automatique de la musique lors des événements majeurs ; silence dramatique.
 R8.4 Retours visuels : ralenti court sur coupe de nuque réussie (désactivable), secousses réglables,
      séquence de transformation (éclair, vapeur).
 R8.5 Sous-titres des sons importants, dédoublonnés.
 R8.6 Accessibilité : volume par bus, réduction des secousses et des flashs.
CRITÈRES (tests hors ligne, sans haut-parleur)
 - rendu hors ligne (OfflineAudioContext) de chaque effet : niveau efficace au-dessus d'un seuil, pas
   d'écrêtage ;
 - mesure de la baisse de la musique pendant un événement ;
 - toutes les options d'accessibilité testées ; verify code 0 ;
 - écris dans le rapport ce qui n'a PAS pu être vérifié (écoute humaine).
ARRÊT OBLIGATOIRE : j'écoute et je valide.
```

**À lancer :** `/goal R8 est terminée : docs/reports/R8.md avec tous les critères en OK, PROGRESS.md indique « R8 terminée, arrêt de revue », verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 120 tours.`

---

## 8. PROMPT R9 — ENVIRONNEMENTS DU MONDE EXTÉRIEUR

```
PHASE R9 : ENVIRONNEMENTS DU MONDE EXTÉRIEUR (scénarios 854 et Grondement). RENDU = 3D.
Écris d'abord docs/phases/R9.md. Lis docs/art/STYLES.md et docs/reports/R4.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; git diff src/sim vide ;
aucun asset de l'œuvre ; arrêts obligatoires. Les styles sont des adaptations A (le fichier 01 ne les
décrit pas) ; marque ? tout ce que les sources ne confirment pas (blindés, armes chimiques, etc.).

TÂCHES
 R9.1 Ajoute à data/art/styles.json et docs/art/STYLES.md les profils : Liberio (quartier marleyen moderne :
      brique, gares, rails ; zone d'internement : quartier dense et clos), Fort Slava (fort côtier), ports et
      gares de Marley, ville portuaire d'Hizuru (inspiration japonaise sobre), cité du désert des Alliés.
 R9.2 Cartes tactiques (DONNÉES) correspondantes, reliées aux cartes T23–T37 du fichier 06.
 R9.3 Éléments de guerre moderne visibles : tranchées, artillerie, trains, dirigeables ; marque ? ceux dont
      l'existence n'est pas confirmée (blindés).
 R9.4 Distinction mesurable avec les environnements de Paradis (même méthode qu'en R4).
CRITÈRES : au moins 5 environnements nouveaux jouables ; tests de distinction ; captures jour et nuit
revues ligne 14 ; smoke:tactique3d et verify inchangés ; git diff src/sim vide.
```

**À lancer :** `/goal R9 est terminée : docs/reports/R9.md avec tous les critères en OK, PROGRESS.md indique « R9 terminée », verify code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 120 tours.`

---

## 9. PROMPT P9 — SCÉNARIOS, IA ET ÉQUILIBRAGE (ARRÊT DE REVUE)

```
PHASE P9 (fichier 05 §5). Écris d'abord docs/phases/P9.md. Lis docs/PROGRESS.md (reports vers P9 :
invasion amphibie par l'IA, événements E43–E52 jouables, Grondement).
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; arrêts obligatoires.

TÂCHES
 P9.1 Scénarios 845, 850, 854 et Grondement jouables de bout en bout, avec les fenêtres de présence des
      personnages (fichier 11 §3) et la divergence avertie (fichier 12 §3).
 P9.2 IA des factions : Marley (invasion amphibie, projection de Titans), Hizuru (neutralité pouvant
      basculer), Alliés (coalition fragile). Journal de raisonnement en mode debug.
 P9.3 Quatre difficultés (Récit, Normal, Rude, Brèche) dans /data/balance/difficulty.json.
 P9.4 sim:balance : 1000 parties par scénario ; rapport (durée moyenne, taux de victoire par faction, causes
      de mort, ressources limitantes, cas dégénérés : famine systématique, spirale de mort).
 P9.5 Ajustements UNIQUEMENT dans /data/balance, avec diff clair, sans changer les règles.
CRITÈRES : aucune faction au-dessus de 70 % de victoires ; aucun cycle dégénéré non expliqué ; mortalité
d'expédition 25–40 % ; déterminisme (même graine et mêmes commandes = même hash) ; canon:check code 0 ;
rapport HTML docs/reports/P9-balance.html ; verify code 0.
ARRÊT DE REVUE : je joue au moins un scénario complet avant P10.
```

**À lancer :** `/goal P9 est terminée : docs/reports/P9.md avec tous les critères en OK, PROGRESS.md indique « P9 terminée, arrêt de revue », verify code 0, canon:check code 0. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 200 tours.`

---

## 10. PROMPT P10 — FINITIONS, ACCESSIBILITÉ, DOCUMENTATION

```
PHASE P10 (fichier 05 §5). Écris d'abord docs/phases/P10.md.
Règles communes : CLAUDE.md ; un commit par tâche, verify avant chaque commit ; arrêts obligatoires.

TÂCHES
 P10.1 Accessibilité (fichier 09 §20) : taille de police, contrastes AA, mode daltonien, réduction des
       secousses et des flashs, navigation clavier complète, sous-titres, options de difficulté fines.
 P10.2 Parcours complet : un script automatisé joue 5 ans du scénario 850 (commandes enregistrées) sans
       bug bloquant ; sauvegarde, chargement et migration vérifiés à chaque année.
 P10.3 Performance : budgets du fichier 00 §8 ; note « GPU réel requis » pour tout ce qui ne peut pas être
       mesuré ; n'écris jamais « 60 FPS atteints » sans mesure.
 P10.4 Documentation : README (installation et lancement LOCAL), manuel in-game, DECISIONS.md final,
       CANON_CHECK.md final, ASSETS_LICENSES.md, docs/CONFORMITE.md rempli par section normative.
 P10.5 Lancement : build statique et instructions pour jouer en local sur un ordinateur. NE PUBLIE PAS le
       jeu en ligne (usage personnel : ni GitHub Pages ni hébergement public).
 P10.6 Dernière passe canon:check et audit : plus aucun fait de lore sans statut C/A/?.
CRITÈRES : verify code 0 ; tous les smoke:* OK ; docs/CONFORMITE.md sans « ABSENT » non justifié ; rapport
final docs/reports/P10.md avec les trois listes (sourcé, interprété, non confirmé).
```

**À lancer :** `/goal P10 est terminée : docs/reports/P10.md existe avec tous les critères en OK ou justifiés, PROGRESS.md indique « P10 terminée », verify code 0, smoke:* tous OK. Arrête-toi à tout arrêt obligatoire de CLAUDE.md ou après 150 tours.`

---

## 11. PROMPT DE REVUE (À COLLER APRÈS CHAQUE PHASE)

```
Fais le rapport de la phase : (a) sortie RÉELLE de `npm run verify` ; (b) tableau des critères OK / KO / non
vérifiable avec preuve ; (c) captures à 1366×768 et 3840×2160 ; (d) fait / partiel / manquant ; (e) trois
listes : sourcé dans les fichiers (cite fichier et section) / interprété ou adapté (A) / non confirmé (?) ;
(f) ce que tu n'as PAS pu vérifier. N'écris jamais qu'un test passe sans coller sa sortie. Ouvre chaque
capture avec l'outil de lecture d'image : description en 3 lignes et au moins 3 défauts possibles.
```

---

## 12. RAPPELS

- **Ne lance pas** une phase avant la fin de la précédente et ta relecture de son rapport.
- **CLAUDE.md** doit mentionner les arrêts de revue après R2, R4, R8 et P9, et que three.js n'est utilisé que dans `src/render/tactical3d`.
- **R1c (bases CC0)** est facultative : lance-la seulement si les figures de R1b te déçoivent, et avant R3.
- **Mesures de fluidité :** sans carte graphique, elles ne disent rien de ton PC. Les vraies mesures se font chez toi.
