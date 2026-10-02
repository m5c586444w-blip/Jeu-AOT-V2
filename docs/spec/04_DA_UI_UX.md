

# 04 — DIRECTION ARTISTIQUE, INTERFACES, AUDIO

> Objectif : un jeu qui ressemble à **un objet fabriqué**, pas à un template. Atmosphère : archives militaires, cartes d'atlas, dossiers papier, journaux, télégrammes — l'Europe de la fin du XIXᵉ/début du XXᵉ siècle, filtrée par un monde où les Titans existent.

## 1. IDENTITÉ VISUELLE

### 1.1 Trois esthétiques (une par grand bloc)
| Bloc | Inspirations | Matières | Ambiance |
|---|---|---|---|
| **Paradis** | Europe centrale XIXᵉ, forteresses, gravure, plans cadastraux | Pierre, cuir, laiton, papier jauni, encre | Austère, poussiéreux, fragile |
| **Marley** | Empire industriel (années 1910), propagande, typographie gothique/gravure | Acier, charbon, rouge/bleu militaire, papier journal | Froid, administratif, impérial |
| **Hizuru / Alliés** | Estampes, laques, indigo, tissus, cartes maritimes | Papier washi, laque, bois, textile | Mesuré, élégant, sobre |

### 1.2 Palette (point de départ, ajustable)
- **Paradis** : papier `#E8DCC0`, papier sombre `#CDBF9F`, encre `#1C1A17`, pierre `#8A8577`, ocre `#B5873A`, vert-de-gris `#4F6B5A`, brique `#8A3B2A`.
- **Marley** : acier `#2D3E50`, rouge sombre `#7A1F1F`, charbon `#222426`, papier journal `#D9D2C0`, laiton terni `#A8873C`.
- **Hizuru** : vermillon `#B8321F`, indigo `#2A3A5C`, crème washi `#EFE6D2`, bois `#6B4A2F`.
- **États** : danger `#9E2B25`, alerte `#C58A2B`, ok `#4F6B5A`, inconnu `#7B766B`. Pas de néon, pas de dégradé violet/bleu « techno ».

### 1.3 Typographie (licences libres)
- Titres : **IM Fell English / IM Fell DW Pica** (gravure), Marley : **UnifrakturMaguntia** (bannières uniquement).
- Texte courant : **EB Garamond** ou **Cormorant Garamond**.
- Rapports/télégrammes : **Special Elite** ou **Courier Prime** (machine à écrire).
- Chiffres et tableaux : **EB Garamond tabular** ou **IBM Plex Mono** (très sobre).
- Interdits : Inter, Roboto, Poppins comme police principale ; gradients de texte ; ombres portées génériques.

## 2. PRINCIPES « NON-IA / NON-TEMPLATE »

1. **Pas de cartes arrondies avec ombre douce** par défaut. Utiliser : **cadres filetés**, **papier collé**, **onglets de dossier**, **tampons**, **trombones**, **coins renforcés**.
2. **Pas de glassmorphism, pas de néon, pas d'icônes emoji, pas de dégradés violets**.
3. **Iconographie dessinée** : icônes en SVG avec **traits irréguliers** (légère variation de largeur, extrémités arrondies différentes), cohérentes en épaisseur ; jamais de set d'icônes générique (Lucide/FontAwesome) sans retouche.
4. **Textures** : grain de papier, fibres, légère usure, plis, taches de café très discrètes, **jamais répétitives de manière visible** (tuiles + masques aléatoires).
5. **Asymétrie contrôlée** : alignements légèrement imparfaits, mais lisibles.
6. **Détails diégétiques** : tampons « REÇU », cachets, signatures, notes manuscrites ; **mais lisibilité avant tout**.
7. **Chaque écran a une composition unique** ; pas de grille de cartes identiques répétée.
8. **Micro-interactions physiques** : tourner une page, sortir une feuille d'un dossier, poser un tampon (son + animation courte).
9. **Wording sobre** : pas de ton « corporate cheerful ».
10. **Pas de bandes de gradient + coins arrondis + icône-cercle** (look SaaS).

### Checklist de validation d'un écran (obligatoire)
- [ ] Aucune police par défaut du système.
- [ ] Aucune icône générique non retouchée.
- [ ] Aucun élément « card + shadow-md + rounded-xl ».
- [ ] Texture et matière visibles sur au moins 2 niveaux (fond, cadre, objet).
- [ ] Toute donnée numérique a un tooltip « pourquoi ? ».
- [ ] Aucun texte placeholder, aucune illustration générique.
- [ ] Lisible à 100 % et 125 % de zoom, à 1366×768 et 4K.

## 3. CARTE STRATÉGIQUE

- **Rendu** : cartographie d'atlas gravé ; **hachures** de relief, **hydrographie encrée**, **aquarelle** sourde pour provinces, **toponymes** en petite capitale avec courbure suivant les murs.
- **Murs** : anneaux massifs rendus en élévation stylisée (coupe), ombres portées de gravure ; **portes** détaillées.
- **Brouillard de guerre** : papier froissé / encre diluée ; régions inconnues = **taches blanches annotées** « inexploré ».
- **Overlays** (touches) : politique, moral, nourriture, gaz, Titans (densité), influence religieuse, renseignement.
- **Marqueurs d'unités** : jetons style wargame ancien (épingles, pions) avec insignes dessinés, **ombres de papier** légères.
- **Zoom** : 3 niveaux (Monde → Région → Province) avec changement de détail ; transitions fluides ; shaders discrets (grain, vignettage).
- **Interaction** : survol = info courte ; clic = **dossier de province** ; clic droit = menu contextuel sobre.

## 4. SCÈNE TACTIQUE

- **Style** : 2.5D illustré, vues obliques façon gravure/lithographie ; bâtiments en **volumes dessinés** ; textures de pierre, bois, toiture ; **ambiance lumineuse** (aube, jour, crépuscule, nuit) via éclairage 2D + LUT.
- **Titans** : silhouettes lisibles, **anatomie dérangeante**, variété de proportions ; animations par **sprites déformés** (mesh deformation) + secondaires (muscles, vapeur).
- **Soldats** : modèles simples, différenciation par **insignes, capes, accessoires** ; mouvements ODM avec **traînées de gaz**, **câbles** tendus, **étincelles**.
- **Effets** : fumée, poussière, éclats de pierre, lueur de lame, étincelles de gaz, **vapeur** des Titans, **flash** de transformation.
- **Lisibilité** : contours légers, codes couleurs de camp, **icônes au-dessus des têtes** (gaz/lames/stress) en pictogrammes sobres.

## 5. ÉCRANS ET INTERFACES (liste minimale)

> Chaque interface doit être un **objet** (dossier, carnet, table de commandement, journal…), pas un panneau flottant.

1. **Menu principal** : table d'archives, dossier « Scénarios » en tiroir, lampe, tampon « CONFIDENTIEL ». Pas de boutons rectangulaires.
2. **Sélection de scénario/faction** : dossiers avec **couverture illustrée**, onglets, fiches de faction (blasons dessinés).
3. **HUD stratégique** : bandeau supérieur en **papier-registre** (ressources, date, vitesse) ; icônes personnalisées ; tooltips détaillés.
4. **Dossier de province** : feuille cadastrale + coupe du mur + onglets (Population, Économie, Garnison, Renseignement, Bâtiments).
5. **Fiche de personnage** : portrait gravé/dessiné **non photoréaliste**, notes manuscrites, relations en schéma façon tableau d'enquête (fils, épingles), jauges **non-modernes** (barres tamponnées, curseurs de laiton).
6. **Table du cabinet** : plan de salle, sièges, **vote** (billes/jetons), dossiers de négociation, lettres.
7. **Planificateur d'expédition** : **carte étendue + table de logistique**, règles/compas, formation à glisser-déposer, calcul gaz/vivres avec incertitudes.
8. **Salle de renseignement** : mur de preuves, fiches d'agents, rapports **datés** et **annotés**, états de certitude (rumeur/indice/preuve).
9. **Arbre de recherche** : planches de bureau d'étude (**schémas techniques** à l'encre, calques superposés).
10. **Journal / Gazette** : titres et articles selon la faction (propagande Marley, presse de Paradis), génération d'articles par modèles.
11. **Interface tactique** : barre basse sobre ; **cartes d'escouade** (fiches papier) ; **minimap** façon plan ; journal de combat comme **carnet de campagne**.
12. **Rapports post-bataille** : télégramme + liste des morts (dossier individuel) + **lettres aux familles** (génération textuelle, ton sobre).
13. **Archives (lore)** : encyclopédie diégétique avec **statuts de fiabilité** `[C]/[A]/[?]` rendus comme **tampons** (« Établi », « Interprété », « Non confirmé »).
14. **Options** : design cohérent, lisible (pas de style système).
15. **Fin de partie / épilogue** : montage de documents, photographies gravées, statistiques, narration sobre.

## 6. UX : RÈGLES

- **Tooltips explicatifs** partout ; mode « loupe » (touche maintenue) pour détails.
- **Raccourcis clavier** personnalisables ; **file d'ordres** ; **pause rapide** (Espace).
- **Alertes triées** par importance, non intrusives, avec **historique**.
- **Annulation** pour décisions non engagées ; **confirmations** pour décisions irréversibles.
- **Textes courts**, hiérarchie claire, **jamais plus de 3 niveaux** d'imbrication.
- **Accessibilité** : taille de police réglable, contrastes AA minimum, mode daltonien, réduction de secousses/flashs, sous-titres pour sons importants.
- **Langue** : FR par défaut, EN en second ; tous les textes dans `/i18n`.

## 7. AUDIO

- **Musique** : instrumentale originale, **couches adaptatives** (calme → tension → combat). Instruments : cordes, cuivres, orgue, percussions, chœurs ; Marley : fanfares militaires, caisses claires ; Hizuru : instruments traditionnels, sobriété.
- **Interdit** : musiques ou échantillons de l'œuvre originale.
- **SFX** : gaz ODM (sifflement), câbles, lames, impacts sur chair/pierre, pas de Titans (vibrations), cris, canons, cloches de murs, tampon/papier/encre pour UI.
- **Mix** : ducking des musiques lors des évènements majeurs ; **silence** utilisé de manière dramatique.
- **Génération** : synthèse (WebAudio) + banques libres de droits ; fichier `ASSETS_LICENSES.md` obligatoire.

## 8. PIPELINE D'ASSETS (sans extraction d'œuvres)

1. **Vectoriel/procédural d'abord** : SVG pour icônes, emblèmes, cartouches ; scripts pour variations irrégulières.
2. **Textures** : génération procédurale (bruit, fibres, taches) + **masques manuels** ; baking en atlas.
3. **Sprites tactiques** : modèles 3D simples **rendus en 2D** (pré-calcul de rotations) *ou* sprites vectoriels déformables ; cohérence de lumière.
4. **Portraits** : **style gravure/encre** généré par pipeline de filtrage sur des **modèles originaux** (pas de captures de l'œuvre) ; ou dessins vectoriels par archétype avec variantes.
5. **Emblèmes** : **redessinés** dans un style original (inspiration permise, pas de copie directe).
6. **Shaders** : grain papier, désaturation, vignettage, encre diluée, lueurs de lanterne ; **budget perf** défini.
7. **Optimisation** : atlas, compression, chargement progressif ; fallback pour machines faibles.
8. **Licences** : chaque asset externe documenté (source, licence).

## 9. PERFORMANCE ET COMPATIBILITÉ

- **Cibles** : 60 FPS sur GPU intégré récent à 1080p ; 30 FPS minimum sur machine modeste.
- **Chargement** : < 8 s à froid ; scènes tactiques < 3 s.
- **Mémoire** : < 2 Go en usage normal.
- **Plateformes** : navigateur desktop (Chrome/Firefox), packaging Tauri optionnel.

## 10. LIVRABLES DA PAR PHASE (voir fichier 05)

- **P1** : carte stratégique v1 (rendu atlas), HUD papier, 5 icônes de ressources originales.
- **P2** : fiches personnages, cabinet, polices intégrées.
- **P4** : scène tactique v1 (villes + forêt), 10 sprites de Titans, 8 types de soldats.
- **P8** : tous les écrans finaux, shaders, audio complet, polish.



