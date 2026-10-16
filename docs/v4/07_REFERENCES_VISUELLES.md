# 07 — Références visuelles : bible d'images écrite

> Statut : **PROPOSÉ**. Dépend de : `04` (V4-D09 style, V4-D11 provenance), `docs/art/STYLES.md` (catalogue E01–E29, repris tel quel), `data/art/*.json`, `data/emblems/emblems.json` (12 emblèmes).
> **Ce document ne contient aucune image et n'en contiendra jamais** (V4-D11). Il contient une **méthode** et des **fiches à remplir** : la description écrite d'un sujet visuel, assez précise pour qu'un modeleur (ou une session) puisse le construire sans avoir l'image sous les yeux.

## 1. Pourquoi des descriptions écrites et pas des captures

1. **Règle du projet** : aucune image, capture ou texture de l'œuvre ou de fans dans le dépôt (V4-D11, `CLAUDE.md`, D-167). La règle vise le dépôt, pas ton usage personnel.
2. **Je ne vois pas l'animé** : je ne peux pas décrire de mémoire, plan par plan, ce qui n'est pas dans les spécifications sans risquer d'inventer. Une fiche dont le contenu vient de mon seul souvenir serait étiquetée `?`, pas `C`.
3. **Une description est plus utile qu'une image pour construire** : elle fixe les proportions, matières, couleurs et silhouettes utiles, et pas le reste.

## 2. Méthode : la séance de référence

Elle remplace la demande « captures dans le moindre détail » sans enfreindre la règle.

1. Gabriel choisit un sujet de la liste (section 4), dans l'ordre de priorité proposé.
2. Il me montre, **dans la conversation**, une ou plusieurs images de référence (captures personnelles, photos d'époque, tableaux, architectures réelles). Elles ne sont **jamais copiées dans le dépôt** ni exportées en fichier du projet.
3. Je rédige la fiche (section 3) en mots : formes, proportions, matières, couleurs approchées, éclairage, état d'usure. Je note ce qui est **ambigu** au lieu de le deviner.
4. Gabriel corrige la fiche en une passe. Elle passe à **VALIDÉE** et ne se rouvre que par demande de changement (`04` §4).
5. La fiche alimente le script Blender (M8) ou la scène de lieu (M10). Le rapport du jalon cite la fiche utilisée.

Sources légitimes pour les références : photos et gravures d'époque (architecture, uniformes, armement et machines du début du XXᵉ siècle), tableaux, relevés d'architecture réelle, **description de Gabriel**. Une image de l'œuvre sert à *Gabriel* à vérifier le résultat ; elle n'est pas une pièce du projet.

## 3. Modèle de fiche

```
ID               : V<catégorie>-<nn>   (ex. V01-03)
Sujet            : nom court
Statut           : BROUILLON | VALIDÉE (Gabriel) | OBSOLÈTE
Étiquette lore   : C | A | ?   (+ creation: true et raison si création, voir docs/lore/creations.md)
Lien catalogue   : E.. de docs/art/STYLES.md, id de data/art/*.json, id d'emblème, id de lieu
Usage            : plan rapproché L0 | moyen L1 | lointain L2/L3 | décor | interface
Silhouette       : 2-3 phrases (proportions relatives, hauteur, encombrement)
Formes clés      : liste (ce qui ne doit pas manquer pour qu'on le reconnaisse)
Matières         : liste (cuir épais, laine feutrée, toile cirée, acier bleui, pierre taillée…)
Couleurs         : 4-6 teintes hex approximatives [A] + règle de désaturation (V4-D09)
Usure            : propre | portée | boueuse | brûlée | ensanglantée (niveaux autorisés)
Lumière          : comment le sujet doit réagir (mat, satiné, brillant ; ombres lourdes)
À ne pas faire   : erreurs fréquentes à éviter
Ambiguïtés       : ce que la référence ne tranche pas (à décider par Gabriel)
Budget           : L0/L1/L2/L3 (02 §7), nombre de matières, textures
Sources           : « description de Gabriel du JJ/MM » · « photo d'époque (type) » — jamais un fichier du projet
```

## 4. Catalogue des sujets et ordre de priorité

La colonne « Déjà couvert » renvoie à ce qui existe dans l'ancien dépôt et qu'on **reprend** comme point de départ.

| Cat. | Sujets | Fiches | Jalon | Priorité | Déjà couvert |
|---|---|---|---|---|---|
| **V01 Uniformes** | Bataillon d'exploration, Garnison, Police militaire (licorne), Police intérieure, Corps d'entraînement, soldat et officier de Marley, civils (ouvriers, bourgeois, nobles, clergé), enfants | 1 par institution et par grade visible | M8 | 1 | 7 tenues prototypes (`docs/art/assets/projet`), `data/emblems/emblems.json` |
| **V02 Équipement ODM** | dispositif (sangles, harnais, réservoirs de gaz, boîtiers), lames, fourreaux, câbles et ancrages, usure | 1 par pièce | M8 | 1 | `dispositif_odm.glb`, `lame_odm.glb` (sans squelette) |
| **V03 Armes et machines** | fusil, lance de foudre, canon de rempart et chariot, balistes, flèches de signal, matériel de siège | 1 par arme | M8 | 2 | `fusil.glb`, `lance_de_foudre.glb`, `canon_chariot.glb` |
| **V04 Titans** | trois silhouettes de base (petit, moyen, grand), variantes « bizarres », déformations, peau/musculature, yeux, dents, dégâts, fumée de régénération ; **Titans spéciaux** (porteurs) en fiches séparées | 1 par famille | M8 | 1 | `data/art/titans.json` |
| **V05 Murs** | surface, joints, usure, taille des blocs, portes, chemin de ronde, canons, brèche, vues de près et de loin | 1 par type de mur ; 1 par porte | M8, M10 | 1 | `data/art/murs.json`, E22 |
| **V06 Villes et districts** | Shiganshina, Trost, Karanes, Utopia, Krolva, Stohess, Mitras, Orvud, Ehrmich, Yarckel, ville souterraine | 1 par ville | M10 | 2 | E01–E08 de `STYLES.md`, `data/places` |
| **V07 Campagne et nature** | villages, fermes, forêts d'arbres géants, rivières, côte, territoire des Titans, plateaux | 1 par environnement | M10 | 3 | E10–E19, E26–E29 |
| **V08 Lieux singuliers** | château d'Utgard, ville-usine, chapelle souterraine, camps militaires, camps de réfugiés | 1 par lieu | M10 | 3 | E20–E25 |
| **V09 Marley et Hizuru** | quartier de Liberio, camps, forts ; architecture et vêtements de Hizuru | 1 par ensemble | M10 | 3 | `data/places` (Marley/Hizuru), `emblems.json` |
| **V10 Intérieurs** | salle du conseil, caserne, église, auberge, cachots, bureau, atelier | 1 par type | M10 | 3 | — |
| **V11 Lumière et ambiances** | aube, plein jour, crépuscule, nuit, pluie, brume, fumée, incendie, signaux lumineux ; palette générale « réaliste sombre » | 1 par ambiance | M7 (provisoire), M10 | 1 | `data/art/materiaux.json` |
| **V12 Interface** | police, matières de l'interface, icônes, cartes, journaux (habillage début XXᵉ), alertes, carte du monde | 1 par écran type | M7 | 2 | cadre d'interface (ERRATA_V3 §3) |
| **V13 Animaux et transport** | chevaux, harnais, chariots, trains et gares, bateaux, ballons | 1 par type | M10 | 4 | — |

« Priorité 1 » = à documenter avant M7/M8 ; les autres peuvent attendre leur jalon.

## 5. Règles transversales de style (V4-D09)

Ces règles sont **proposées** ; les chiffres sont des points de départ `[A]`, à corriger par Gabriel lors des premières fiches.

| Règle | Contenu |
|---|---|
| Palette | désaturée ; valeurs de gris-bleu, brun terreux, ocre fané ; **aucune couleur pure** ; le rouge et le vert vifs sont réservés aux signaux |
| Matières | grain visible en plan rapproché ; reflets très limités sauf métal huilé et eau ; textures sales mais lisibles |
| Lumière | soleil direct dur, ombres lourdes ; ciel haut contrasté ; intérieur à la bougie ou à la lampe à huile ; jamais de lumière « studio » |
| Échelle humaine | un humain adulte mesure environ 1,7 m `[A]` ; mur 50 m `C` ; Titans selon `data/art/titans.json` ; les proportions priment sur le style |
| Lisibilité | toute unité garde une silhouette reconnaissable à distance (couleur de tabard ou de cape, emblème) même sous la brume |
| Usure | trois niveaux d'usure par tenue (neuf, porté, abîmé) pour permettre la progression de la bataille |
| Époque | début du XXᵉ siècle d'inspiration européenne : machines à vapeur, gaz et pétrole possibles, électricité rare `[?]` ; pas de technologie moderne |

## 6. Gabarit de remise en forme d'une fiche (exemple vide)

```
ID              : V02-01
Sujet           : Dispositif ODM — boîtiers de gaz et harnais
Statut          : BROUILLON
Étiquette lore  : ?
Lien catalogue  : dispositif_odm.glb (prototype)
Usage           : L0 plan rapproché ; L1
Silhouette      : (à rédiger après la séance de référence)
Formes clés     : (à rédiger)
Matières        : (à rédiger)
Couleurs        : (à rédiger)
Usure           : (à rédiger)
Lumière         : (à rédiger)
À ne pas faire  : (à rédiger)
Ambiguïtés      : (à poser à Gabriel pendant la séance)
Budget          : (02 §7)
Sources         : (à compléter : description de Gabriel du …)
```

## 7. Ce que je ne ferai pas

- Je ne remplis pas les fiches de mémoire en les présentant comme du canon : sans séance de référence, elles restent `BROUILLON` et étiquetées `?`.
- Je ne copie, ne trace, ne reconstitue pas un plan précis de l'œuvre en l'enregistrant dans le dépôt.
- Je ne dessine pas un personnage connu : les personnages originaux et les créations autorisées par `ERRATA_V3` §2 sont étiquetés `A` avec leur raison.

## 8. Ce qu'il te reste à faire (Gabriel)

1. Choisir les 3 premiers sujets de priorité 1 (suggestion : V01 Bataillon d'exploration, V02 Dispositif ODM, V04 Titan de base).
2. Pour chacun : une séance courte (quelques images montrées en conversation + tes commentaires).
3. Relire et valider (ou corriger) la fiche en une passe.
