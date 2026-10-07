# 22 — PLAN V2 : FAIRE UN VRAI JEU (carte, interface, audio, chronologie), PUIS BATAILLE 3D

> **Remplace l'ordre des phases du fichier 21** (ses règles anti-dérive §2, ses points de contrôle §5 et le prompt PA §7 restent valables). Le fichier 20 (R1e : lieux faits main) passe **après** ces phases.
> Décisions de l'utilisateur (7 oct. 2026) : carte **réaliste de l'île** ; interface **de jeu de stratégie moderne** ; musique **calme et discrète** ; priorité : **refaire d'abord carte, interface et audio**, puis bataille 3D.
> Point de départ : retour de l'utilisateur après 20 minutes de jeu : « musique oppressante, interface mal conçue et très IA, carte décevante, il manque plein de choses, mentions lore/pas lore et "ça va arriver" inutiles, chronologie incomplète, on dirait un fichier Excel ». Points positifs : jeu très complet, conseillers.

---

## 0. CE QUI A ÉTÉ CONSTATÉ (captures du dépôt, commit `497be52`, écrans `p8-*`, `p5-chronique`)

1. **Carte** : anneaux concentriques sépia ; presque toute l'île est « inexploré » ; aucun relief, forêt, rivière ni côte lisible ; les provinces ne se distinguent pas.
2. **Fuites de notes de développement dans l'interface** : tampons « Établi / Interprété / Non confirmé » sur chaque fiche (Archives) ; sur les cartes de recherche : codes (`T-ODM-04`), « Mécanique en P9 », « pas avant 845 », « N'existe pas encore : il faut d'abord… ». Un joueur n'a rien à faire de ces mentions.
3. **Aspect tableur** : bandeau de neuf colonnes de chiffres, quatorze petites icônes identiques, fenêtres faites de listes de fiches de même format, textes courts sans image.
4. **Chronique** : au début de la partie, deux lignes. Aucune frise, aucune vue du calendrier, aucune annonce de ce qui approche.
5. **Bataille 2D** : bâtiments en rectangles d'un plan de rues régulier, soldats en pastilles numérotées. Rien de l'ambiance attendue (la 3D de R2 y répond).
6. **Menu** : une carte et trois dossiers en haut à gauche, trois quarts de l'écran vides.
7. **Musique** : non écoutée par moi ; l'utilisateur la trouve oppressante (à diagnostiquer dans le code de `src/ui/audio.ts`).

**Cause de plusieurs défauts : mes spécifications.** Le fichier 04 a prescrit « statuts de fiabilité rendus comme tampons » (§5.13), le « bureau d'étude » (§5.9), des écrans « objets » de papier partout (§2) et un wording « archives ». Ces passages sont **annulés** par ce fichier (voir §1).

---

## 1. ERRATA D'INTERFACE (à enregistrer dans `docs/spec/ERRATA_UX.md`, prime sur le fichier 04)

```
ERRATA UX (décision de l'utilisateur, 7 oct. 2026)
E-UX-1  Le joueur ne voit JAMAIS : tampons canon / adaptation / incertain, codes internes (T-ODM-04…), identifiants, mentions « mécanique en Pn », « pas avant AAAA », « n'existe pas encore », « ça va arriver ». Ces informations restent dans les données et dans un « mode auteur » (touche F10, désactivé par défaut) pour la vérification du lore.
E-UX-2  Direction visuelle : interface de jeu de stratégie MODERNE, façon Hearts of Iron IV / Pax Historia pour la structure (barre supérieure, panneaux latéraux, infobulles détaillées, notifications), sobre, sombre, lisible. Fini le papier partout. Une touche de matière (cuir, laiton, gravure) est permise sur des ÉLÉMENTS précis (titres, cadres de dossiers), pas comme fond de tous les écrans.
E-UX-3  Carte : carte RÉALISTE de l'île de Paradis (relief, forêts, rivières, côtes, provinces lisibles et cliquables, murs en relief). Aucun « inexploré » plaqué sur le tiers de l'île au départ : le brouillard est un voile léger ; les terres connues du joueur sont visibles.
E-UX-4  Audio : musique calme, discrète, non oppressante, volume par défaut bas, longues boucles, silences. Jamais de bourdon grave continu, d'accord dissonant tenu, ni de cuivres agressifs hors combat.
E-UX-5  La recherche reste (c'est un cœur de jeu de stratégie), refondue en ARBRE lisible. Les Archives deviennent une encyclopédie discrète du monde (personnages, lieux, Titans, événements connus), sans tampons ni mention de statut ; elle ne montre que ce que le joueur a découvert.
E-UX-6  Chronologie : frise des événements (passés, en cours, annoncés par rumeur ou prévision selon le renseignement du joueur), au moins tous les événements du fichier 12.
```

Si la mention E-UX-5 ne vous convient pas (par exemple, vous voulez supprimer les Archives), **dites-le avant de lancer UI**.

---

## 2. FEUILLE DE ROUTE (10 jours, max 5x)

| Jours | Phase | Contenu | Effort | Plafond | Arrêt |
|---|---|---|---|---|---|
| J1 (matin) | **UX0** | Nettoyer les fuites (E-UX-1), mode auteur F10 | high | 60 | non |
| J1–J3 | **MAP** | Carte réaliste de l'île | xhigh | 220 | **OUI** |
| J3–J6 | **UI** | Interface moderne, tous les écrans | xhigh | 280 | **OUI** |
| J6 | **AUD** | Musique et sons | high | 100 | non |
| J7 | **CHR** | Chronologie et couverture des événements | high | 120 | non |
| J8–J9 | **R2** | Bataille 3D branchée (fichier 18 §1) | xhigh | 200 | **OUI** |
| J10 | **PA-lite** | Artillerie et déplacements (fichier 21 §7), version réduite | xhigh | 150 | **OUI** |
| après | **R1e**, lieux faits main, Titans (fichiers 20, 18 §2) | | | | |

**Honnêteté** : je ne pense pas que tout cela tienne en 10 jours si une phase déborde. Les points de contrôle du fichier 21 §5 s'appliquent (relever le % de quota à la fin de MAP, de UI et de R2). Si MAP + UI dépassent 60 % du quota hebdomadaire, **sautez PA-lite** et passez R2 en version courte (fichier 18 §1, tâches 1 à 4 seulement).
**Sans R1e**, R2 utilise la ville 3D actuelle (scène de R1d) : elle n'est pas encore faite main. C'est assumé : le jeu d'abord, la beauté des lieux ensuite.

**Commandes `/goal`** :
- UX0 : `/goal UX0 terminée : plus aucune mention E-UX-1 visible dans l'interface (test), mode auteur F10, verify code 0. Plafond 60 tours.`
- MAP : `/goal MAP terminée : carte réaliste de l'île jouable avec calques, docs/reports/MAP.md, verify code 0, sim:selftest code 0. Plafond 220 tours.`
- UI : `/goal UI terminée : tous les écrans refaits selon ERRATA_UX, docs/reports/UI.md, verify code 0, smoke:* OK. Plafond 280 tours.`
- AUD : `/goal AUD terminée : nouvelle musique et sons, volume par défaut bas, docs/reports/AUD.md, verify code 0. Plafond 100 tours.`
- CHR : `/goal CHR terminée : frise et couverture des événements du fichier 12, docs/reports/CHR.md, verify code 0, canon:check code 0. Plafond 120 tours.`

---

## 3. PROMPT UX0 : NETTOYER LES FUITES

```
PHASE UX0 : NETTOYAGE DES MENTIONS INTERNES. Aucune modification de src/sim ni des règles. Règles : CLAUDE.md (dont règles de budget), un commit par tâche, verify avant chaque commit.
Lis docs/spec/ERRATA_UX.md (E-UX-1 à E-UX-6) et docs/reports/P8.md.
TÂCHES
 UX0.1 Inventaire : liste, par écran (src/ui, src/render), tout texte affiché qui contient un statut canon (Établi/Interprété/Non confirmé/C/A/?), un identifiant (T-…, E-…, ids de données), « Mécanique en », « pas avant », « n'existe pas encore », « P4 », « P9 »… Écris la liste dans docs/reports/UX0.md.
 UX0.2 Retire-les de l'interface. Les données gardent canon: C|A|?. Ajoute un « mode auteur » (touche F10, off par défaut, option dans les options) qui affiche ces mentions en pastille discrète pour la vérification du lore.
 UX0.3 Recherche : une étude dont la condition n'est pas remplie s'affiche grisée avec la condition en langage de jeu (« Exige : Entretien d'ODM standardisé »), sans date de lore ni numéro de phase. Une étude non implémentée n'apparaît pas du tout.
 UX0.4 Archives : encyclopédie sans tampons, sans mention de statut, ne montre que ce que le joueur a découvert (personnages rencontrés, lieux visités, événements survenus).
 UX0.5 Test automatisé tests/ui/no-leaks.test.ts : parcourt tous les écrans (smoke) et échoue si un motif interdit apparaît dans le texte visible hors mode auteur.
CRITÈRES : CUX0-01 verify code 0 ; CUX0-02 no-leaks vert ; CUX0-03 mode auteur F10 affiche les mentions ; CUX0-04 canon:check code 0 ; CUX0-05 captures de 6 écrans lues une par une.
Hors périmètre : refonte graphique (c'est la phase UI).
```

---

## 4. PROMPT MAP : CARTE RÉALISTE DE L'ÎLE

```
PHASE MAP : CARTE STRATÉGIQUE RÉALISTE DE L'ÎLE DE PARADIS. Pixi uniquement dans src/render. src/sim INCHANGÉ (les provinces, leurs voisinages et leurs données ne changent pas ; seul leur dessin change).
Règles : CLAUDE.md (dont règles de budget), un commit par tâche, verify avant chaque commit. Lis docs/spec/ERRATA_UX.md (E-UX-3), docs/spec/06_ATLAS_LIEUX.md, 11, data/map/paradis.json, data/map/paradis.layout.json, src/render/strategicMap.ts, atlasLayers.ts, worldAtlas.ts, docs/reports/P1.md et R0.md.
CONTEXTE : la carte actuelle est un schéma d'anneaux sépia, presque tout est « inexploré ». L'utilisateur veut une carte d'île réaliste de jeu de grande stratégie (type Hearts of Iron IV / Pax Historia), qu'on a envie de regarder et de parcourir.

TÂCHES
 MAP.1 Terrain procédural DÉTERMINISTE, généré une fois puis figé et committé (data/map/terrain/*.json ou .bin compact, commande npm run map:terrain, version et graine dans le fichier, comme les lieux figés du fichier 20 §4) : forme de côte originale [A] (île allongée, baies, caps, presqu'îles, quelques îlots), relief (plaines, collines, montagnes), fleuves qui descendent vers la mer, lacs, forêts (dont la forêt des Arbres Géants [C] à l'emplacement de l'atlas du fichier 06), marais, falaises. Positions relatives des murs et des lieux : [C] selon fichier 06 ; sinon [A]. Les trois murs gardent leurs anneaux, mais sont posés SUR le terrain (le relief les traverse, les anneaux ne sont plus parfaitement circulaires si le terrain l'impose, dans la limite du fichier 06).
 MAP.2 Provinces : chaque province de data/map/paradis.json reçoit un POLYGONE réaliste (cellules de Voronoï contraintes par côtes, fleuves et murs ; frontières sinueuses ; aucune cellule absurde) ; adjacence recalculée et COMPARÉE à celle de data/map : toute différence est listée et corrigée du côté du dessin, jamais de la sim.
 MAP.3 Rendu Pixi : ombrage du relief (hillshade), teintes de terrain par type, textures de forêt, côte avec écume et profondeur d'eau, fleuves, frontières de province et de mur nets, murs en relief (volume stylisé, ombre portée), villes en icônes dessinées par taille (hameau, bourg, ville, capitale, fortifiée), routes et ponts, brouillard de guerre en VOILE léger (pas de zones « inexploré » écrites sur la carte au départ ; ce que le joueur ne connaît pas est simplement voilé et sans détail).
 MAP.4 Niveaux de zoom (île entière, région, province) avec détail croissant ; étiquettes courbes qui suivent murs et fleuves, qui se simplifient au dézoom.
 MAP.5 Calques existants (politique, nourriture, gaz, Titans, religion, population, légitimité, ravitaillement, renseignement) recolorés sur le nouveau rendu (aplat par province avec transparence, lisible sur le relief). Survol de province : infobulle de jeu (nom, population, garnison, ressource principale, état) ; clic : le panneau latéral actuel.
 MAP.6 Emplacements de pions (armées, expéditions, flottes) prêts pour PA : chaque province a un point d'ancrage ; les pions s'affichent sans chevaucher les noms.
 MAP.7 Performance de chargement : première image < 3 s (rendu logiciel, qualité basse) ; terrain préchargé en une seule ressource.
CRITÈRES : CMAP-01 verify code 0 ; CMAP-02 src/sim inchangé (git diff vide) ; CMAP-03 sim:selftest code 0 ; CMAP-04 adjacence du dessin = adjacence des données, ou liste d'écarts justifiés ; CMAP-05 aucune province illisible (aire minimale) ; CMAP-06 terrain figé reproductible (même hash) ; CMAP-07 smoke:map OK ; CMAP-08 captures 1366×768 et 3840×2160 pour 3 zooms et 3 calques, lues une par une.
Hors périmètre : nouvelle interface (HUD, panneaux), pions animés, 3D.
ARRÊT DE REVUE : fin de MAP. Je regarde la carte.
```

---

## 5. PROMPT UI : INTERFACE DE JEU DE STRATÉGIE MODERNE

```
PHASE UI : REFONTE DE L'INTERFACE. src/sim INCHANGÉ. Règles : CLAUDE.md (dont règles de budget), un commit par tâche, verify avant chaque commit.
Lis docs/spec/ERRATA_UX.md (prime sur le fichier 04), docs/reports/P8.md, les captures docs/screenshots/p8-*.png (toutes), src/ui/*, src/ui/styles/*.
CONTEXTE : l'utilisateur trouve l'interface « mal conçue, très IA, un fichier Excel ». Il veut une interface de jeu de stratégie moderne (structure type HOI4 / Pax Historia), sobre, lisible, riche en infobulles.

PRINCIPES (vérifiables)
 U1 Thème sombre sobre : fond anthracite (≈ #14171c), panneaux (≈ #1c2128) à filet fin, accent laiton, rouge de danger, vert d'état ; un thème d'accent par faction (Paradis, Marley, Hizuru, Alliés). Jetons de style dans src/ui/styles/tokens.css, aucune couleur en dur ailleurs.
 U2 Disposition : barre supérieure (date, vitesse, pause, 6 à 8 ressources clés avec variation par jour ; les autres dans une infobulle ou un panneau « Économie ») ; barre d'alertes ; panneau latéral gauche (province / sélection) ; panneau latéral droit (notifications et ordres) ; menu de gestion en bas ou à gauche (boutons larges, nommés au survol ET icône + étiquette courte, regroupés : Gouvernement, Armée, Recherche, Renseignement, Diplomatie, Monde).
 U3 Hiérarchie : titre, sous-titre, corps, valeur ; chiffres avec unités et variation colorée ; jamais plus de 7 éléments au même niveau.
 U4 Infobulles à la HOI4 : survoler une valeur donne le détail de calcul (sources, malus, bonus) sur trois niveaux max.
 U5 Écrans en « liste + détail » (maître-détail) plutôt que grilles de cartes identiques : personnages (liste filtrable à gauche, fiche à droite avec portrait, traits, relations, cursus), conseillers (cabinet en vue de table avec vote lisible), recherche (VRAI ARBRE avec liens, branches par domaine, étude en cours et temps restant), législation, renseignement, expéditions, chancellerie, chronique (voir CHR).
 U6 Icônes : jeu d'au moins 60 icônes DESSINÉES (SVG, grille 24 px, traits cohérents, deux tailles), aucune bibliothèque générique, aucune emoji. Une icône par ressource, par domaine, par type d'unité et d'événement.
 U7 Portraits : portrait par personnage important (peinture ou gravure stylisée) généré par un procédé local déterministe ou par rendu du modèle 3D de corps (R1c) en buste ; jamais de silhouette vide. Les autres : portrait générique par archétype et âge.
 U8 Menu principal : plein écran, scène en arrière-plan = rendu 3D des murs au crépuscule (capture ou rendu direct de la scène 3D existante), titre, 4 entrées (Nouvelle partie, Continuer, Options, Quitter), choix de scénario en panneau à droite avec illustrations. Plus de « tiroir de dossiers ».
 U9 Notifications : fil à droite, regroupé et trié, avec icône, titre, un clic pour aller sur le lieu ; historique accessible.
 U10 Accessibilité de base : taille de police, contraste AA, touches clavier pour toutes les fenêtres, raccourcis affichés dans les infobulles.
 U11 Interdits : papier partout ; tampons ; cartes arrondies à ombre douce répétées ; dégradés violets ; codes internes à l'écran ; fenêtres de plus de 3 niveaux d'imbrication ; textes d'espace réservé.

TÂCHES
 UI.1 Jetons de style, composants de base (bouton, onglet, liste, infobulle, jauge, barre, étiquette, séparateur) et page de contrôle /ui-kit.html (non publiée dans le jeu).
 UI.2 Jeu d'icônes (U6) + page de contrôle.
 UI.3 Barre supérieure, alertes, menu de gestion, panneaux latéraux (U2).
 UI.4 Écrans, dans cet ordre : personnages, cabinet, recherche (arbre), renseignement, expéditions, chancellerie, législation, économie, journal. Chaque écran reçoit sa capture après revue.
 UI.5 Menu principal, choix de nation, fin de partie / épilogue (sobres, avec illustrations).
 UI.6 Notifications (U9) et infobulles de calcul (U4).
 UI.7 Passage de tous les smoke:* ; test no-leaks (UX0) toujours vert ; revue des captures.
CRITÈRES : CUI-01 verify code 0 ; CUI-02 src/sim inchangé ; CUI-03 tous les smoke:* OK ; CUI-04 no-leaks vert ; CUI-05 aucun écran de la liste en grille de cartes identiques ; CUI-06 60 icônes minimum ; CUI-07 lisibilité à 1366×768 et à 3840×2160 ; CUI-08 chaque écran capturé et lu une par une (3 lignes + 3 défauts) ; CUI-09 tests de contraste AA.
Hors périmètre : carte (phase MAP), musique, 3D.
ARRÊT DE REVUE : fin de UI. Je navigue dans le jeu pendant 15 minutes.
```

---

## 6. PROMPT AUD : MUSIQUE ET SONS

```
PHASE AUD : AUDIO NON OPPRESSANT. src/sim INCHANGÉ. Règles : CLAUDE.md (dont règles de budget), un commit par tâche.
Lis docs/spec/ERRATA_UX.md (E-UX-4), src/ui/audio.ts et son README, docs/reports/P8.md (audio).
CONTEXTE : l'utilisateur trouve la musique actuelle oppressante.
TÂCHES
 AUD.1 Diagnostic écrit (docs/reports/AUD.md) : lis le code audio ; liste ce qui crée l'oppression (bourdon grave continu, intervalles dissonants tenus, tempo, volume, absence de silence, boucles courtes, registre). Pas de supposition : cite les lignes.
 AUD.2 Réécris la musique : modes consonants (par exemple mode majeur ou dorien) en tempo lent, cordes et bois doux, piano, harpe ; phrases qui respirent avec silences ; boucles longues (au moins 4 minutes avant répétition) ; trois états (calme, tension légère, combat) où la tension monte par ajout d'instruments, jamais par dissonance continue. Volume par défaut bas (30 %).
 AUD.3 Sons de jeu : clics d'interface, notifications, pas, vent, cloches, ambiances de lieu (ville, forêt, mur), bruits de bataille (lames, gaz, câbles, canons, impacts, pas de Titans). Synthèse WebAudio et banques libres de droits déclarées dans docs/ASSETS_LICENSES.md. Aucun échantillon de l'œuvre.
 AUD.4 Dossier assets_user/musique/ : si l'utilisateur y dépose des fichiers audio (mp3, ogg), le jeu les propose comme pistes (liste réglable dans les options).
 AUD.5 Options : curseurs musique, ambiances, effets, interface ; case « musique en combat seulement ».
CRITÈRES : CAUD-01 verify code 0 ; CAUD-02 diagnostic cité ; CAUD-03 volume par défaut ≤ 35 % ; CAUD-04 aucune note tenue plus de 8 s en registre grave ; CAUD-05 boucle ≥ 4 minutes ; CAUD-06 licences à jour ; CAUD-07 assets_user pris en charge.
Note : tu ne peux pas écouter. N'écris jamais « agréable » : écris ce qui est mesurable et dis que l'écoute revient à l'utilisateur.
```

---

## 7. PROMPT CHR : CHRONOLOGIE ET COUVERTURE DES ÉVÉNEMENTS

```
PHASE CHR : CHRONOLOGIE COMPLÈTE. src/sim peut recevoir des DONNÉES (data/events) ; les RÈGLES ne changent pas sans test. Règles : CLAUDE.md (dont règles de budget), un commit par tâche, verify avant chaque commit.
Lis docs/spec/12_EVENEMENTS_CANON.md (60 événements), docs/spec/11, data/events/*.json, src/ui/eventDossier.ts, eventText.ts, narrative.ts, docs/reports/P5.md et P6.md.
CONTEXTE : l'utilisateur constate qu'il manque « plein de choses » dans la chronologie ; au début, la chronique n'a que deux lignes.
TÂCHES
 CHR.1 Couverture : compare les 60 événements du fichier 12 à data/events. Écris le tableau (événement, date, présent ou absent, jouable ou texte seul) dans docs/reports/CHR.md. Ajoute les manquants dans data/events avec dates, conditions, choix et effets, canon C/A/? sur chaque entrée ; aucune date inventée comme canon (sinon [?] paramétrable).
 CHR.2 Événements de fond : au moins 3 petits événements par mois de jeu (vie politique, famille, rumeurs, récoltes, incidents du mur, disputes de cabinet) tirés de listes génériques, avec texte varié (pas de répétition d'une même phrase dans l'année).
 CHR.3 Frise : écran « Chronologie » (fenêtre ou panneau) : axe du temps de 845 à 854+, événements passés (cochés), en cours, annoncés (rumeur ou prévision, selon le niveau de renseignement du joueur ; invisibles sinon), divergence par rapport au récit connu, filtre par thème (politique, militaire, Titans, famille, monde).
 CHR.4 Notifications d'événements : texte, illustration d'archétype, choix clairs, effets listés dans l'infobulle.
 CHR.5 Test de couverture : tests/data/events-coverage.test.ts échoue si un des 60 événements n'a pas d'entrée.
CRITÈRES : CCHR-01 verify code 0 ; CCHR-02 canon:check code 0 ; CCHR-03 60 événements couverts ; CCHR-04 3 événements de fond par mois en moyenne sur un an simulé (sim:year) ; CCHR-05 déterminisme (sim:selftest) ; CCHR-06 frise capturée et lue.
Rappel : l'interface n'affiche aucune mention de statut canon (E-UX-1).
```

---

## 8. CE QUE VOUS FAITES, JOUR PAR JOUR

1. **Avant d'acheter** : dites-moi si E-UX-5 (recherche et Archives) vous convient. Donnez-moi aussi trois **événements ou périodes** qui vous manquent dans la chronologie (même approximatifs) : je les ajoute à CHR.
2. Déposez les fichiers 20, 21 et 22 dans `docs/spec/`, créez `docs/spec/ERRATA_UX.md` avec le bloc du §1 (ou demandez-le à Claude Code), ajoutez les règles du fichier 21 §2 à CLAUDE.md.
3. Lancez dans cet ordre : UX0, MAP, UI, AUD, CHR, R2, PA-lite. Une session par phase ; le prompt, puis la ligne `/goal` du §2.
4. Aux arrêts (MAP, UI, R2, PA-lite) : jouez 15 minutes, notez trois points positifs et trois négatifs, envoyez-les-moi. Je les transforme en correctifs ciblés, une seule passe.
5. Relevez le % de quota aux points du fichier 21 §5.

---

## 9. STATUT DES AFFIRMATIONS DE CE FICHIER (liste séparée)

**Sourcées (captures du dépôt et fichiers du projet)** : l'état de l'interface décrit au §0 (captures `p8-hud`, `p8-archives`, `p8-recherche`, `p8-menu`, `p8-bataille`, `p5-chronique`) ; les passages du fichier 04 cités ; les 60 événements du fichier 12 ; les règles de budget du fichier 21.

**Interprétatives** : la cause de chaque défaut de conception ; la forme de l'île et le relief (originaux, `[A]`) ; le style « HOI4 / Pax Historia » (référence de structure, pas de reproduction) ; les durées et plafonds de tours ; le diagnostic de la musique (non écoutée) ; mon interprétation de « pourquoi y a-t-il des recherches, archives ? » (comme une critique des mentions, pas de l'existence des écrans).

**Non confirmées** : que MAP et UI tiennent chacune en 2 à 3 jours ; ce que contient exactement `src/ui/audio.ts` ; quels événements manquent précisément (couverture à mesurer en CHR.1) ; la possibilité de déposer de la musique libre sans accès réseau supplémentaire.
