# Styles des environnements (catalogue de l'utilisateur)

> Ce fichier enregistre, **sans modification**, la partie B de l'annexe A du prompt R1b (consigne de l'utilisateur du 2026-10-06), entre les deux marqueurs ci-dessous.
> - **Empreinte.** sha256 du texte entre les marqueurs : `c8fb8c17112a25245ec66a722d1d2fa5e892de658265baefd6009dc4fc1060d7`. Le test `tests/lint/art-reference.test.ts` la contrôle.
> - **Profils.** Les profils de style lus par les générateurs sont dans `data/art/styles.json`, un par environnement (E01–E08, E10–E29).
> - **Images de référence.** Une image ajoutée un jour dans `docs/art/reference/` ne sert qu'à l'ambiance. Elle n'est **jamais** intégrée au build, ni copiée comme texture, ni présente dans `dist` (voir `docs/art/reference/README.md`).

<!-- PARTIE B : début (texte de l'utilisateur, non modifié) -->
## B0. Corrections apportées à la grille de référence

La grille de l'utilisateur est une image générée par une IA, avec du texte déformé par endroits (« Plan (appppenny) », « Détatle »). On l'utilise pour l'**ambiance** (matériaux, couleurs, silhouettes), pas comme source de lore. Erreurs corrigées :

| Dans la grille | Correction (fichiers 01 et 11) |
|---|---|
| Trost « Mur Maria » | Trost est le district sud du **Mur Rose** `C` |
| Stohess « Mur Maria » | Stohess est le district est du **Mur Sina** `C` |
| « MITRASS … probablement Mur Maria / région centrale » | **Mitras** est la capitale, au centre du **Mur Sina** `C` |
| Villes et villages « de campagne du Mur X » | Catégories génériques, donc `A`. Seuls trois lieux sont nommés : Ragako, Dauper et Jinae, dans le sud de l'intérieur de Rose `C` |
| Mur visible derrière les campagnes | Les murs sont à 100–130 km les uns des autres `?` : pas de mur à l'horizon dans la campagne intérieure |
| Plans circulaires « approx. » | Décoratifs, sans valeur de lore |

Ce qui reste utile : **les contrastes de style**. Ville frontalière chaleureuse et médiévale (Shiganshina), ville plus urbaine (Trost), ville administrative et militaire (Stohess), capitale de pierre taillée avec cathédrale, ponts et canaux (Mitras), campagne de bois, de pierre et de chaume.

## B1. Fiche d'un profil de style

```
id, nom, canon, lieu (province du fichier 06), mur
disposition   : organique | planifiée | quadrillée
bâtiments     : types et hauteurs (étages × 3–3,5 m, 8–21 m au faîtage)
toits         : tuiles rouges | ardoise | chaume | plat
matériaux     : colombage, enduit, pierre taillée, pierre brute, brique, bois
densité       : 0–1
palette       : 6 teintes hex (approximatives, A)
accessoires   : fontaines, lampadaires, étals, clochers, moulins, clôtures, charrettes…
terrain       : plat | collines | rivière | canaux
végétation    : arbres, haies, champs
mur visible   : oui / non (distance)
variantes     : ruines, nuit, hiver, brume
```

## B2. Les environnements

### Villes et districts

| ID | Environnement | Lieu / mur | Style (grille et lore) | Palette `A` | Tactique |
|---|---|---|---|---|---|
| E01 | **Shiganshina** | Maria, sud (R01) `C` | Ville frontalière chaleureuse, **bâtie dans une saillie du Mur Maria, avec une porte extérieure et une porte intérieure** `C` : colombages, toits de tuiles rouges, église à clocher, place centrale, rues étroites et sinueuses, remparts intérieurs `A` | rouge brique `#8A3B2A`, brun `#6B4A2F`, beige `#D9C9A8` | Portes et mur tout proches ; variantes : **845** (brèche, incendies, gravats), **850** (porte extérieure scellée par la coque de Titan d'Eren), **851** (repeuplée, passage creusé dans la coque) |
| E02 | **Trost** | Rose, sud (S01) `C` | Plus grande et plus urbaine que Shiganshina : grande église, marché, casernes de pierre près de la porte, QG de la Garnison | beige, brun, rouge, gris | Porte et toits ; variante **850** (brèche) |
| E03 | **Karanes** | Rose, est (S02) `C` | Ville de départ des expéditions : cours de rassemblement, écuries, dépôts, activité militaire | gris, brun, vert olive | Cour de départ, porte |
| E04 | **Utopia, Krolva** | Rose, nord et ouest `C` | **Utopia** : ville moyenne, pierre et bois, toits mixtes `A`. **Krolva** : ville de forêt de montagne, vivant de la chasse, puis de l'agriculture et de l'élevage de chevaux avec l'afflux de réfugiés de Maria (d'après une fiche de wiki communautaire `?`) : maisons de bois et de pierre, écuries, lisières boisées | beige, brun, rouge, vert | Rues, toits, lisière de forêt |
| E05 | **Stohess** | Sina, est (I03) `C` | Plus moderne et organisée : grand édifice de pierre au centre, rues larges et pavées, lampadaires, fontaines, toits d'ardoise ou de tuiles, atmosphère stricte | gris `#7B8088`, bleu-gris `#4A5A6B`, beige | Rues larges, canaux, accès à la ville souterraine |
| E06 | **Mitras** | Sina, centre (I01) `C` | Capitale : pierre taillée, toits d'ardoise, cathédrale gothique, ponts, canaux, avenues, palais, quartier des nobles | gris-bleu `#8A929B`, ardoise `#3E4752`, vert `#5F7A5A`, crème | Grande avenue, palais |
| E07 | **Orvud, Ehrmich, Yarckel** | Sina, nord, sud, ouest `C` | Districts de Sina, un peu moins fastueux que Mitras ; variante **Orvud ravagé (850)** | gris, beige, bleu | Rues et places |
| E08 | **Ville souterraine** | Sina (I06) `C` | Sombre, serrée : galeries de pierre et de bois, lanternes, cordes, marchés de contrebande ; plus pauvre et plus criminelle `C` | brun, noir, ocre chaud | Intérieurs, faible visibilité |

### Campagne et villages

| ID | Environnement | Lieu / mur | Style | Palette `A` |
|---|---|---|---|---|
| E10 | **Ville agricole** (trois variantes : Maria, Rose, Sina) `A` | Anneaux Maria, Rose, Sina | Pierre, bois, toits de tuiles ou de chaume ; église simple, marché, moulins, remparts légers ; Maria plus proche des champs, Sina plus isolée | vert, brun, beige, rouge |
| E11 | **Village agricole** (trois variantes) | Intérieur de Rose (Ragako S05, Dauper S10, Jinae S13) `C` pour les noms | Petit village : chaume, bois et pierre, chapelle, moulin, fermes, clôtures, champs ; variante **Ragako ravagé (850)** | vert, brun chaud, ocre |
| E12 | **Fermes isolées, moulins, granges** `A` | Toute la campagne | Fermes à cour, granges, haies, charrettes, puits | vert, brun, ocre |
| E13 | **Campagne pure** `A` | Champs de Maria, Rose, Sina (R07, R08, S09) | Patchwork de champs, haies, vergers, routes de terre, collines douces, rivières, ponts ; saisons (hiver : production réduite `A`) | vert `#6E8B4A`, ocre, brun |

### Abords de Shiganshina (bourgs, faubourgs, avant-postes)

> **Ce qui est canon** : Shiganshina est bâtie dans une saillie du Mur Maria, avec deux portes `C`. **Au-delà de la porte extérieure, c'est le territoire des Titans** : aucune source consultée ne mentionne de bourg à cet endroit. Les habitants rentrent à Shiganshina environ neuf mois après l'élimination des Titans de Maria `C`. **Les entrées ci-dessous sont donc des adaptations `A`**, à afficher avec le tampon « Interprété » dans les Archives.

| ID | Environnement | Position | Style `A` | Variantes |
|---|---|---|---|---|
| E26 | **Faubourgs de l'arrière-pays de Shiganshina** (R02) | Juste derrière la porte intérieure, côté Maria | Quartiers plus pauvres et plus récents que le centre : maisons de bois sur soubassement de pierre, entrepôts, écuries, relais de poste, ateliers de charrons ; la route vers Rose part d'ici | 845 : évacuation, charrettes renversées ; 846–850 : abandonnés, envahis par les herbes ; 851 : reconstruits |
| E27 | **Bourgs et hameaux de l'arrière-pays de Maria** (R03, R05, R16) | Le long de la route de Rose, au nord de la porte intérieure | Petits bourgs de bois et de pierre, toits de chaume ou de tuiles, moulin, église simple, enclos, champs en lanières | Habités avant 845, vides ensuite, Titans en visite |
| E28 | **Fermes et lisières de forêt de Maria** (R11, R12) | Entre les bourgs et les forêts d'arbres géants | Fermes à cour, granges, haies, bûcherons, scieries | Idem |
| E29 | **Glacis extérieur de Shiganshina** `A` | Au-delà de la porte extérieure | **Aucun bourg** : terre nue, quelques bornes et une route, puis ruines d'anciens villages loin au sud (voir E19) ; très forte visibilité depuis la porte | Titans en grand nombre le jour de la brèche |

**Règle de génération :** un bourg « hors de Shiganshina » n'existe que du côté intérieur (E26–E28) ; la zone extérieure reste E29 puis E19. Aucun nom propre n'est inventé : utiliser des descripteurs (« bourg de l'arrière-pays »).

### Nature et territoire hors des murs

| ID | Environnement | Lieu | Style |
|---|---|---|---|
| E14 | **Forêts des Arbres Géants** `C` | **Plusieurs forêts**, dans l'espace de Maria et hors des murs `C` ; celle du piège au Titan féminin est dans Maria (R06, localisation `?`) | Troncs ≈ 80 m, voûte dense, brume, rayons de lumière, mousse ; points d'ancrage abondants ; prévoir au moins 3 variantes (dense, clairière, lisière) |
| E15 | **Bois et forêts ordinaires** `A` | Anneaux, Forêt Morte (O06) | Arbres normaux, sous-bois, clairières, sentiers |
| E16 | **Montagnes, plateaux, gorges** `A` | Monts Brumeux, Gorge du Silence (R17, R18), plateau du Nord (O09) | Roche, éboulis, vallées étroites, embuscades |
| E17 | **Rivières, lacs, marais** `A` | Rivière des Cendres (O03), Lac des Reflets (R14), Marais Brumeux (O05) | Gués, berges, roseaux, brume, visibilité réduite |
| E18 | **Côte et plage** `C` pour la découverte de l'océan (≈ 850–851) | Côtes Sud et Est (O04, O08) | Falaises, plage, premiers pontons ; vent, embruns |
| E19 | **Territoire des Titans** `A` | Plaines Meurtries, Ruines du Premier Cordon (O01, O02), anneau de Maria après 845 | Plaines, villages abandonnés envahis par la végétation, charrettes, murs effondrés ; Titans nombreux |
| E20 | **Château d'Utgard** `C` | Rose (S06) | Château de pierre abandonné, tour, cour ; combat de nuit ; **détruit en 850** (variante ruines) |
| E21 | **Ville-usine et cavernes de glace** `C`, localisation `?` | Maria (R10) | Brique et pierre, cheminées ; cavernes : anciennes caldeiras, roche sombre, lueurs `A` |

### Ouvrages

| ID | Environnement | Style |
|---|---|---|
| E22 | **Murs** `C` : 50 m | Surface de pierre à joints, porte massive, chemin de ronde, canons sur rails (`C`), variante endommagée révélant l'intérieur (`C`, Mur Sina) ; épaisseur 10 m `?`, teinte `?` |
| E23 | **Chapelle souterraine Reiss** `C`, localisation `?` | Crypte de pierre, colonnes, lumière de bougies |
| E24 | **Camps militaires** `A` | Camp d'entraînement, QG du Corps (château ancien), forts avancés, dépôts, tentes |
| E25 | **Camps de réfugiés (845–846)** `A` | Tentes, baraques, files de charrettes devant les portes de Rose |

### Prévus plus tard (champ `style` extensible)

Marley : **Liberio** (quartier marleyen moderne et zone d'internement), **Fort Slava**, ports et gares. **Hizuru** : ville portuaire d'inspiration japonaise sobre. **Alliés** : cité du désert `A`. À traiter en P7/P8, avec leur propre fiche.

## B3. Modificateurs communs

| Modificateur | Effets |
|---|---|
| Heure | Aube, jour, crépuscule, nuit (fenêtres éclairées, lanternes) |
| Météo | Brume, pluie, neige d'hiver |
| État | Intact, ravagé (845, 850), ruines et incendies |
| Distance au mur | Visible seulement près des districts adossés à un mur |

## B4. Éléments communs à tous les lieux

Toits de tuiles ou de chaume, bois et pierre selon la région, églises et clochers, marchés et places, rues pavées ou de terre battue, fontaines, fermes et champs, murs et fortifications selon les lieux.
<!-- PARTIE B : fin -->
