# 16 — ANALYSE DES CAPTURES ET PROMPTS PAR PHASE

> Base : les 79 captures de `docs/screenshots/` au commit `6c4963d` : 9 examinées en détail (figures, bataille en 1366 px et en 4K, porteur de Titan, transformation, menu, HUD, fiche de personnage, carte du monde), les 70 autres sur planches 3×3 à résolution réduite. Je n'ai donc pas lu les petits textes des écrans vus en miniature. Je n'ai relancé aucun test : les chiffres cités viennent du dépôt (journaux et rapports).
> Les prompts sont **autonomes** : chacun peut être collé seul dans une session neuve. Ils supposent `CLAUDE.md` en place (règles communes déjà écrites dans le dépôt).

## 1. ANALYSE PAR PHASE

| Phase | Ce qui est réussi | Écarts par rapport à tes attentes et aux fichiers 03/04 | Gravité |
|---|---|---|---|
| **P0** (démarrage, console) | Papier, tampon, machine à écrire ; console lisible | Texte de développement (« phase de fondation ») encore visible au menu | Faible |
| **P1** (carte stratégique) | Style atlas, murs concentriques, calques, dossier de province, « pourquoi ? » | Carte schématique (anneaux et secteurs) : peu de relief, de rivières, de forêts, de routes. Au zoom « province », très peu de détails. Fiches : petits textes denses | Moyenne |
| **P2** (personnages, cabinet) | Cabinet en plan de salle, décrets, journal, organisations, notices de fiabilité | Écrans en tableaux plutôt qu'en objets (fichier 04 §5). Portraits : petites icônes au trait quasi identiques, pas de « gravure » | Moyenne |
| **P3** (expéditions) | Lettre d'Erwin et rapport en télégramme : très bons | Planificateur en formulaire ; aucun tracé ni cône d'incertitude visible sur la carte | Moyenne |
| **P4** (combat) | Bilan avec dossiers des morts et lettres aux familles | **Pas de 3D.** Titans = torse rectangulaire, tête ovale, bras en bâtons ; soldats = triangle et rond. Bâtiments alignés en colonnes. Unités en points. Arbres = rectangles et ellipses | **Élevée** |
| **P5** (recherche, renseignement) | Cartes de technologie avec tampons de fiabilité | Pas d'illustration de dossier ; densité de texte | Faible |
| **P6** (porteurs) | Fiches de capacités | Capture de la transformation : forêt vide, aucun Titan ni éclair visible ; bilan « Coupes 0 / Gaz 0 » avec un Titan abattu | **Élevée** |
| **P7** (monde, Marley) | Chancellerie, atlas du monde, en-têtes gothiques | Noms qui se chevauchent sur l'atlas, moitié de la fenêtre vide | Moyenne |
| **P8** (finitions) | Menu en tiroir, gazettes, archives, options, sous-titres sonores | **4K : tout minuscule au centre, grandes marges vides.** Menu : deux tiers de l'écran vides. Sous-titre « [Pas de Titan, le sol tremble] » répété 3 fois. Fenêtres qui recouvrent la légende « Calques ». « Graine / Empreinte d'état » visibles dans le HUD. Épilogue rempli de zéros | **Élevée** |

**Constat global** : l'identité d'interface (papier, tampons, dossiers) est tenue et ne ressemble à aucun modèle web. Mais **le cœur visuel (bataille, Titans, soldats, carte) reste schématique**, loin du « 3D et détaillé » demandé, et rien ne s'adapte aux grands écrans.

## 2. ORDRE D'EXÉCUTION

`R0` → `R1` (**arrêt : ta décision de rendu**) → `R2` → `R3` → `R4` → `R5` → `R6` → `R7` → `P9` → `P10`.
Une phase par session. À la fin de chacune : rapport `docs/reports/<phase>.md`, captures, `npm run verify`, commit, mise à jour de `docs/PROGRESS.md`. Arrêt de revue après `R1`, `R3` et `R7` (voir chaque prompt).

---

## 3. PROMPT R0 — CORRECTIONS IMMÉDIATES ET R-GAZ

```
PHASE R0. Aucune nouveauté visuelle : on corrige. Lis docs/PROGRESS.md, docs/reports/P8.md et
docs/reports/P4-revue-realisme.log.

1) R-GAZ : option (c) + (a). L'auto-résolution et les expéditions stratégiques consomment le gaz
   selon la table par classe de Titan du combat tactique. Remplace la plage [3, 8] u du fichier 02 §15
   par des valeurs PAR CLASSE marquées A dans /data/balance. Garde sim:tactical -- --realisme comme
   contrôle indépendant. Contrainte : sim:expeditions reste à 25–40 % de mortalité.
2) Défauts, un commit chacun, avec un test qui échouerait avant le correctif :
   a. sous-titre sonore répété (même texte plusieurs fois en moins d'une seconde) : dédoublonner ;
   b. menu : retirer « Registre de travail — phase de fondation » et toute chaîne de développement
      (« Graine », « Empreinte d'état » du HUD : réserver au mode debug F2) ;
   c. fenêtres qui recouvrent la légende « Calques » : masquer ou déplacer la légende à l'ouverture ;
   d. atlas du monde : noms de provinces qui se chevauchent (détection par boîtes englobantes) ;
      moitié droite de la fenêtre vide : réorganiser ;
   e. bilan de bataille : « Coupes réussies 0 / Gaz consommé 0 » avec un Titan abattu : explique
      (Titan tué au canon ?) ou corrige le décompte ;
   f. capture de la transformation : le Titan et l'éclair doivent être visibles sur l'image ;
   g. épilogue : aucun « 0 » par défaut ; affiche « — » ou masque la ligne si la donnée est absente.
3) 4K : la zone de jeu (carte stratégique et bataille) occupe ≥ 85 % de l'espace disponible à
   3840×2160 comme à 1366×768 (mesure par script, valeurs collées).

CRITÈRES : npm run verify code 0 ; smoke:map, smoke:politique, smoke:tactique, smoke:p8 inchangés ou
meilleurs ; sim:tactical -- --realisme : R-gaz OK ; captures avant/après dans docs/screenshots/r0-*.
HORS PÉRIMÈTRE : le rendu 3D, les figures, la direction artistique. Ne modifie aucun test pour le
faire passer : si un test est faux, explique pourquoi dans DECISIONS.md.
```

---

## 4. PROMPT R1 — ESSAI DE RENDU 3D (ARRÊT OBLIGATOIRE ENSUITE)

```
PHASE R1 : ESSAI DE RENDU 3D du combat. Écris d'abord docs/phases/R1.md.
CONTEXTE : le rendu actuel est une vue 2D de dessus (Pixi). Les spécifications 03 §1 et 04 §4
demandent du 2.5D à volumes. L'utilisateur veut un aspect 3D et détaillé. On teste three.js sans toucher
à la simulation.

CONTRAINTES : code uniquement dans src/render/tactical3d ; AUCUN changement dans src/sim (git diff
src/sim doit être vide) ; three.js ajouté avec justification dans DECISIONS.md et une règle ESLint
qui l'interdit hors de ce dossier ; aucun asset externe (géométries et textures procédurales, bruit,
canvas) ; licences dans ASSETS_LICENSES.md ; pas de Math.random dans le rendu qui influence l'état
(la variation visuelle vient d'une graine locale).

PROTOTYPE à livrer (page /proto3d accessible depuis le menu debug F2) :
 - une rue de ville IRRÉGULIÈRE générée par graine (pas de grille) : largeurs de rues variables,
   îlots tournés, bâtiments extrudés avec 3 types de toits, fenêtres, cheminées ;
 - éclairage jour / crépuscule / nuit, ombres portées, brume ;
 - 2 Titans de proportions différentes, à membres articulés (voir docs/art/REFERENCE.md si présent) ;
 - 20 soldats avec traînées de gaz et câbles tendus entre crochet et ancrage ;
 - caméra libre et caméra de suivi d'escouade ; bascule de qualité (ombres, résolution).

MESURES (valeurs réelles collées) : images par seconde dans Chromium SANS GPU à 1366×768 et 3840×2160
(marque « GPU réel requis » pour le reste), taille du bundle avant/après, temps de chargement.
LIVRABLES : docs/reports/R1.md avec captures à 2 résolutions et un tableau coût/bénéfice
« 3D three.js » contre « 2.5D Pixi amélioré » (temps de développement estimé, risques, poids, accessibilité).

ARRÊT OBLIGATOIRE : n'enchaîne pas. J'indiquerai RENDU = 3D ou RENDU = 2.5D.
```

---

## 5. PROMPT R2 — TITANS ET SOLDATS (FIGURES)

> À compléter avant de coller : `RENDU = ____` (3D ou 2.5D, selon ta décision après R1).

```
PHASE R2 : FIGURES. RENDU = ____ (décision utilisateur). Écris docs/phases/R2.md.
Si docs/art/reference/ existe, ce sont des références de proportions et de poses, jamais des assets :
documente-les dans docs/art/REFERENCE.md et dans ASSETS_LICENSES.md (« références visuelles »).
CONSTAT : les 10 silhouettes de Titans sont des torses rectangulaires avec des bâtons ; les soldats sont
des triangles. Ça doit changer.

TÂCHES
 R2.1 Fiche de proportions par classe de Titan (3, 5, 8, 12, 15 m) et par variante (anormal,
      sentinelle, chasseur, meute, nocturne ; Titans-Murs ≈ 50 m, Titan de Rod Reiss ≈ 120 m en
      événement) : tête, épaules, bras, ventre, jambes. Chaque Titan doit avoir une anatomie
      DIFFÉRENTE (fichier 04 §4 « anatomie dérangeante ») ; expressions variées (pas tous souriants).
 R2.2 Squelette articulé par figure (hanches, genoux, épaules, coudes, cou) ; marque rouge sur la nuque.
 R2.3 Poses et animations : marche, saisie, main à la bouche (non graphique), accroupi, course,
      tête qui se tourne, à genoux, abattu, rampant (jambes coupées), vapeur à la mort.
 R2.4 Soldats : 8 types (éclaireur, tueur, soutien, cavalier, médecin, chef d'escouade, officier,
      Ackerman) lisibles par silhouette et accessoires ; poses ODM : tir de crochet, balancement,
      coupe, chute, genou à terre, tir de fusée.
 R2.5 Machine d'états : le rendu lit les états de la simulation (aucune modification de src/sim).
 R2.6 300 unités affichées sans perte de fluidité : instanciation / lots ; niveau de détail.

CRITÈRES (tests et commandes)
 - Test : les 10+ figures de Titans ont des silhouettes distinctes (recouvrement < 85 % deux à deux,
   mesuré sur des rendus hors écran) ;
 - Test : hauteurs relatives conformes aux classes (±10 %) ;
 - 8 types de soldats distinguables : test de silhouette identique ;
 - npm run smoke:tactique OK ; mesures d'images par seconde à 300 unités (Chromium sans GPU, valeurs collées) ;
 - planche de contrôle docs/screenshots/r2-figures.png (toutes figures, toutes poses) ;
 - npm run verify code 0 ; git diff src/sim vide.
HORS PÉRIMÈTRE : décors, sons, interface. Marque tout choix de design A.
```

---

## 6. PROMPT R3 — DÉCORS DE BATAILLE (ARRÊT DE REVUE ENSUITE)

```
PHASE R3 : DÉCORS ET EFFETS DE BATAILLE. RENDU = ____ (comme en R2). Écris docs/phases/R3.md.
CONSTAT (captures p4/p8) : villes en grille régulière de caisses ; forêt en rectangles et ellipses ;
pas d'occlusion ; vapeur et chute des Titans abattus = une ellipse fixe.

TÂCHES
 R3.1 Quatre décors : ville des Murs (plan irrégulier, ruelles, places), forêt des Arbres Géants
      (troncs de ~80 m avec voûte, rayons de lumière), mur (assises de pierre, créneaux, canon, escaliers),
      plaine (herbes, ruines, cours d'eau). Chaque décor est généré par graine et varie d'une partie à l'autre.
 R3.2 Occlusion : décor et unités se masquent correctement ; un bâtiment qui cache une unité devient
      translucide au survol ou à la sélection.
 R3.3 Éclairage : aube, jour, crépuscule, nuit (fichier 04 §4) ; la visibilité de nuit se lit à l'écran.
 R3.4 Effets : vapeur animée et dissipation à la mort d'un Titan ; poussière à l'effondrement ; étincelles
      de gaz et de lame ; éclair et vapeur à la transformation d'un porteur.
 R3.5 Ancrages ODM visibles (points d'accroche) avec un style discret.
 R3.6 Lisibilité : codes de couleur de camp, pastilles et icônes de gaz/lames/stress au-dessus des
      têtes (pictogrammes sobres), sans surcharger la vue de 300 unités.

CRITÈRES
 - Variété du décor mesurée : écart-type des orientations des bâtiments > 10°, largeurs de rues non
   constantes (test sur la génération, valeurs collées) ;
 - occlusion testée (une unité derrière un bâtiment n'est pas dessinée au-dessus) ;
 - captures docs/screenshots/r3-{ville,foret,mur,plaine}-{jour,nuit}.png et r3-transformation.png
   (le Titan et l'éclair visibles) ;
 - smoke:tactique et sim:tactical inchangés ; images par seconde mesurées, valeurs collées ;
 - git diff src/sim vide ; npm run verify code 0.
ARRÊT OBLIGATOIRE : rapport et captures, puis attends ma revue.
```

---

## 7. PROMPT R4 — CARTE STRATÉGIQUE

```
PHASE R4 : CARTE STRATÉGIQUE (fichier 04 §3). Écris docs/phases/R4.md.
CONSTAT : carte en anneaux et secteurs, peu de reliefs, zoom « province » presque vide, calques en simples teintes,
rien ne s'adapte à la 4K, aucun tracé d'expédition lisible.

TÂCHES
 R4.1 Relief et hydrographie : hachures de collines, rivières à l'encre, forêts, routes à trois
      niveaux ; l'île de Paradis doit ressembler à un territoire, pas à un disque.
 R4.2 Trois niveaux de zoom (monde, région, province) avec détails propres à chacun ; à l'échelle
      « province » : bâtiments, champs, routes, postes de guet.
 R4.3 Murs en élévation stylisée (coupe), portes détaillées ; état structurel visible (fissures).
 R4.4 Pions d'unités avec ombre de papier ; brouillard de guerre en papier froissé et « taches
      blanches » annotées (« inexploré ») ; mention « vu il y a N jours » sur les provinces non observées.
 R4.5 Expéditions : tracé de l'itinéraire avec cône d'incertitude de position (fichier 09 F-STR-08).
 R4.6 Toponymes sans chevauchement (placement avec évitement) ; courbure le long des murs.
 R4.7 Mise à l'échelle : la carte occupe l'espace disponible de 1366×768 à 3840×2160.
CRITÈRES
 - Test : aucun toponyme ne se chevauche aux 3 niveaux de zoom (boîtes englobantes) ;
 - captures docs/screenshots/r4-{monde,region,province}-{1366,4k}.png ;
 - smoke:map et smoke:expedition OK ; temps de rendu mesuré (valeurs collées) ;
 - npm run verify code 0. HORS PÉRIMÈTRE : combat, interfaces de fiches.
```

---

## 8. PROMPT R5 — INTERFACES ET PORTRAITS

```
PHASE R5 : INTERFACES (fichier 04 §5, §6). Écris docs/phases/R5.md.
CONSTAT : fiches en petits tableaux denses ; portraits = icônes au trait presque identiques ; aucune
illustration dans les dossiers d'événements et les gazettes ; texte minuscule en 4K.

TÂCHES
 R5.1 Échelle automatique : unités relatives (rem), corps de texte ≥ 14 px à 100 % de zoom, mise
      à l'échelle de 1366 à 3840 px ; largeur minimale 1024 px ; contraste AA.
 R5.2 Portraits « gravure » : générateur par parties (forme de crâne, cheveux, cicatrices, âge) avec
      ombrage à hachures ; DÉTERMINISTE par personnage ; au moins 30 visages distincts ; aucun trait copié de
      l'œuvre ; porteurs de Titans et personnages canon reconnaissables par un détail original.
 R5.3 Vignettes d'événements dessinées par code (brèche, procès, expédition, deuil, séance,
      coup d'État…), dans le style gravure, affichées dans les dossiers et la gazette.
 R5.4 Cabinet : plan de salle avec billes de vote ; tableau d'enquête (fils et épingles) pour le
      renseignement (fichier 04 §5 n° 14) ; dossier de province avec coupe du mur.
 R5.5 Infobulles : jamais sur l'élément qu'elles expliquent ; infobulles imbriquées OK.
 R5.6 Checklist 04 §2 appliquée écran par écran dans docs/reports/R5.md (OK/KO + capture).
CRITÈRES
 - Test : la taille de police calculée de chaque écran ≥ 14 px à 100 % ; aucune boîte de texte qui
   déborde ni se chevauche (script sur tous les écrans) ;
 - Test : 30 portraits, silhouettes distinctes (recouvrement < 85 %) ;
 - captures de tous les écrans à 1366 et 3840 px ; smoke:politique et smoke:p8 OK ;
 - npm run verify code 0. HORS PÉRIMÈTRE : audio, combat.
```

---

## 9. PROMPT R6 — IDENTITÉS DE FACTION, MENU, ÉPILOGUE

```
PHASE R6 : IDENTITÉS (fichier 04 §1). Écris docs/phases/R6.md.
CONSTAT : Marley et Hizuru ne se distinguent que par l'en-tête et la couleur ; le menu est vide aux deux
tiers ; le bilan de fin est un tableau de zéros.

TÂCHES
 R6.1 Marley : acier, rouge sombre, papier journal, titres gothiques, ambiance administrative.
      Hizuru : washi, indigo, vermillon, estampes sobres. Alliés : sobre, cartes maritimes.
      Chaque faction : cadres, tampons, icônes et typographie propres (originaux, sans insigne de l'œuvre).
 R6.2 Menu : table d'archives illustrée (carte, lampe, tiroir de scénarios) occupant l'écran, scénarios 845,
      850, 854 et Grondement ; écran de choix de nation illustré.
 R6.3 Épilogue : montage de documents (lettres, gazettes, photographies gravées) généré à partir des
      décisions marquantes de la partie (fichier 12 §2), jamais de valeur nulle par défaut.
 R6.4 Aucune chaîne de développement visible hors mode debug ; relecture i18n FR (ton sobre, pas de
      formule toute faite).
CRITÈRES : captures des 4 identités ; test qu'aucune chaîne de la liste « dev » n'apparaît hors F2 ;
épilogue généré pour 3 parties types (valeurs collées) ; smoke:p7 et smoke:p8 OK ; npm run verify code 0.
```

---

## 10. PROMPT R7 — AUDIO, ANIMATIONS, RETOURS (ARRÊT DE REVUE ENSUITE)

```
PHASE R7 : AUDIO ET RETOURS (fichier 04 §7, 03 §13). Écris docs/phases/R7.md.
Tout est synthétisé par code : aucun échantillon externe, aucune musique de l'œuvre.

TÂCHES
 R7.1 Musique adaptative à 3 à 5 couches (calme, tension, combat) ; palette par faction.
 R7.2 Effets : sifflement du gaz, câbles, lames, impacts, pas de Titans (vibrations graves), canon, cloches,
      papier et tampon pour l'interface.
 R7.3 Mixage : baisse automatique de la musique lors d'événements majeurs ; silence dramatique prévu.
 R7.4 Retours : ralenti court sur coupe de nuque réussie (désactivable), secousses réglables, séquence
      de transformation (éclair, vapeur).
 R7.5 Sous-titres des sons importants, dédoublonnés.
 R7.6 Réglages d'accessibilité : volume par bus, réduction des secousses et des flashs.
CRITÈRES (tests hors ligne, sans haut-parleur)
 - rendu hors ligne (OfflineAudioContext) de chaque effet : niveau efficace > seuil, pas d'écrêtage ;
 - mesure de la baisse de la musique pendant un événement ;
 - toutes les options d'accessibilité testées ; npm run verify code 0 ;
 - écris dans le rapport ce qui n'a PAS pu être vérifié (écoute humaine).
ARRÊT OBLIGATOIRE : j'écoute et je valide.
```

---

## 11. PROMPT P9 — SCÉNARIOS, IA ET ÉQUILIBRAGE

```
PHASE P9 (fichier 05 §5). Écris docs/phases/P9.md. Lis docs/PROGRESS.md (ce qui a été reporté à P9 :
invasion amphibie par l'IA, événements E43–E52 jouables, Grondement).

TÂCHES
 P9.1 Scénarios 845, 850, 854 et Grondement jouables de bout en bout, avec fenêtres de présence des
      personnages (fichier 11 §3) et divergence avertie (fichier 12 §3).
 P9.2 IA des factions : Marley (invasion amphibie, projection de Titans), Hizuru (neutralité qui peut
      basculer), Alliés (coalition fragile). Journal de raisonnement en mode debug.
 P9.3 Quatre niveaux de difficulté (Récit, Normal, Rude, Brèche) dans /data/balance/difficulty.json.
 P9.4 sim:balance : 1000 parties par scénario, rapport (durée moyenne, taux de victoire par faction,
      causes de mort, ressources limitantes, cas dégénérés : famine systématique, spirale de mort).
 P9.5 Ajustements UNIQUEMENT dans /data/balance (diff clair), sans changer les règles.
CRITÈRES : aucune faction > 70 % de victoires ; aucun cycle dégénéré non expliqué ; mortalité
d'expédition 25–40 % ; déterminisme (même graine et mêmes commandes = même hash) ; canon:check code 0 ;
rapport HTML dans docs/reports/P9-balance.html ; npm run verify code 0.
ARRÊTS : un critère qui échoue deux fois ; une décision de design non couverte (écris-la dans PROGRESS.md).
```

---

## 12. PROMPT P10 — FINITIONS, ACCESSIBILITÉ, DOCUMENTATION

```
PHASE P10 (fichier 05 §5). Écris docs/phases/P10.md.

TÂCHES
 P10.1 Accessibilité (fichier 09 §20) : taille de police, contrastes AA, mode daltonien, réduction des
       secousses et des flashs, navigation clavier complète, sous-titres, options de difficulté fines.
 P10.2 Parcours complet : un script automatisé joue 5 ans de jeu du scénario 850 (commandes enregistrées),
       sans bug bloquant ; sauvegarde/chargement et migration vérifiés à chaque année.
 P10.3 Performance : budgets du fichier 00 §8 ; note « GPU réel requis » pour tout ce qui ne peut pas
       être mesuré ici ; ne jamais écrire « 60 FPS atteints » sans mesure.
 P10.4 Documentation : README (installation et lancement LOCAL), manuel in-game, DECISIONS.md final,
       CANON_CHECK.md final, ASSETS_LICENSES.md, docs/CONFORMITE.md rempli par section normative.
 P10.5 Lancement : build statique et instructions pour jouer en local sur un ordinateur. NE PUBLIE PAS
       le jeu en ligne (usage personnel : pas de GitHub Pages ni d'hébergement public).
 P10.6 Dernière passe canon:check et audit : plus aucun fait de lore sans statut C/A/?.
CRITÈRES : npm run verify code 0 ; smoke:* tous OK ; docs/CONFORMITE.md sans « ABSENT » non justifié ;
rapport final docs/reports/P10.md avec les trois listes (sourcé, interprété, non confirmé).
```

---

## 13. PROMPT DE REVUE (À COLLER APRÈS CHAQUE PHASE)

```
Fais le rapport de la phase : (a) sortie RÉELLE de `npm run verify` ; (b) tableau des critères
OK / KO / non vérifiable avec preuve ; (c) captures à 1366×768 et 3840×2160 ; (d) fait / partiel /
manquant ; (e) trois listes : sourcé dans les fichiers (cite fichier et section) / interprété ou adapté (A) /
non confirmé (?) ; (f) ce que tu n'as PAS pu vérifier. N'écris jamais qu'un test passe sans coller sa sortie.
```
