# 20 — PROMPT R1e : CORRECTIFS + LIEUX-CLÉS FAITS MAIN + MÉMOIRE DES LIEUX + RÉORGANISATION

> À coller dans Claude Code (cloud) **à la place** du « lancer R2 ». Effort : `/effort xhigh`.
> Commande de départ (une seule ligne, à coller avant le prompt) :
> `/goal R1e puis LC-B, LC-C, LC-D sans s'arrêter entre elles ; arrêts uniquement après R1e (pilote Shiganshina) et après LC-D ; tous les critères CR1e-*, CLC-* passent avec sorties collées.`
> Prérequis : `docs/spec/06_ATLAS_LIEUX.md`, `11_AUDIT_LORE.md`, `ERRATA.md` et `docs/reports/R1d.md` lus en entier avant la première ligne de code.

---

## 0. POURQUOI CE PROMPT (lis-le, il change ta façon de travailler)

L'utilisateur est très déçu de la qualité des rendus 3D et du rythme. Constat honnête :
1. **Les villes sont générées au hasard** (îlots verts de taille identique, toits identiques, murs en motif répété). Cela se voit tout de suite et ne ressemble à aucun lieu de l'histoire.
2. **Trois districts du mur Maria manquent** : seule Shiganshina existe.
3. **Trop de sous-phases** (R1b, R1c, R1d…) : le projet n'a pas atteint R2. Chaque phase a dérivé vers des mesures, des outils et des détails de latence.

Décision de l'utilisateur, **définitive** :
- Les **lieux principaux de l'histoire sont construits à la main** (plan d'auteur, dimensions, repères, portes, château), pas tirés au sort.
- Les lieux secondaires (villages, hameaux, fermes de campagne) sont **générés une première fois puis mémorisés** (voir §4), le plus légèrement possible.
- **Chaque ville a une taille réaliste** (déduite de sa population) **et de la végétation** : arbres d'alignement, cours, parcs, jardins, vergers.
- Tout est **dans le détail** : chaque plan, les dimensions des murailles, la porte extérieure et la porte intérieure vues de près et de loin, le château, les rues nommées.
- Le sujet du droit d'auteur est levé **pour la forme des lieux** : reconstruis-les le plus fidèlement possible d'après les descriptions canon. **Une seule limite reste, et elle n'est pas négociable** : n'importe **aucun fichier** (modèle, texture, image) tiré de l'œuvre ou de fans, et ne décalque aucune illustration. Tu construis toi-même, avec la géométrie procédurale du dépôt, MakeHuman et les textures Poly Haven déjà autorisées. Les inspirations réelles (architecture européenne) sont permises, voir §3.4.

### Règles d'organisation (remplacent les anciennes ; à copier dans CLAUDE.md, §9)
- **Plus aucune sous-phase inventée.** Interdit de créer R1f, R1g, etc. Un problème hors-périmètre va dans `docs/reports/dette.md` (une ligne : quoi, où, gravité) et on avance.
- **Plus de nouvel outil de mesure.** Les outils existants (`mesure:r1d`, `smoke:r1b`) restent, pas d'autres. Aucun temps passé à optimiser le rendu logiciel (SwiftShader). La performance se juge sur le PC de l'utilisateur, plus tard.
- **Rapports courts** : 150 lignes maximum (hors sorties collées), un tableau de critères, les captures, la dette.
- **Arrêts obligatoires réduits à** : fin de R1e, fin de LC-D, puis (inchangés) fin de R4, fin de P9. Les arrêts « 1 à 4 » de CLAUDE.md (échec deux fois, lore ambigu, décision majeure, commande impossible) restent valables.
- **Lore** : aucun nom, chiffre ou événement inventé et présenté comme canon. Chaque donnée est `[C]` établi, `[A]` adaptation assumée, `[?]` incertain et paramétrable. Sources acceptées : le manga, les databooks et guides officiels. **Pas de wiki, ni fandom, ni sandbox** sauf s'il est signalé comme non officiel. Une donnée sans source vérifiable est `[?]` et va dans `docs/lore/questions-ouvertes.md`.

---

## 1. FEUILLE DE ROUTE (remplace l'ordre précédent)

| Ordre | Phase | Contenu | Arrêt |
|---|---|---|---|
| 1 | **R1e** | Correctifs R1d + système de lieux (§2) + mémoire des lieux (§4) + **Wall Maria complet** : Shiganshina à la main, quatre districts du mur Maria | **OUI** (pilote : l'utilisateur valide la méthode) |
| 2 | **LC-B** | Mur Rose : Trost (complète), Karanes, Utopia, Krolva ; camp d'entraînement ; quartier général | non |
| 3 | **LC-C** | Mur Sina : Mitras (capitale, château royal, cathédrale), Stohess, Orvud, Ehrmich, Yarckel ; ville souterraine ; chapelle Reiss | non |
| 4 | **LC-D** | Hors-murs et autres : forêt des Arbres Géants, château d'Utgard, villages de Ragako, Dauper, Jinae, ferme/campagne, Liberio (Marley), un fort du front | **OUI** |
| 5 | **R2** | Inchangée : 3D branchée sur la vraie bataille (voir `18_PROMPTS_R2_A_P10.md`), avec l'exception `map.ts` | selon 18 |
| 6 | **T1** | Titans réalistes (peau, dents, proportions variées, silhouette « dérangeante », animations) : prompt à écrire après R2 | — |
| 7 | R3 → P10 | Inchangées (fichier 18) | selon 18 |

Si le temps manque dans LC-B/C/D, **garde la profondeur plutôt que la largeur** : mieux vaut 6 lieux entiers que 15 lieux bâclés. Les lieux non faits vont dans `docs/reports/dette.md` avec le tag `LC-reporté`.

---

## 2. SYSTÈME DE LIEUX (la base de toute la phase)

### 2.1 Niveaux
| Niveau | Quoi | Comment c'est fabriqué |
|---|---|---|
| **N1 – lieu-clé** | Lieux principaux de l'histoire (liste §5) | **Plan d'auteur** dans `data/places/<id>.json` (rues nommées, îlots, emprises de bâtiments listées une à une, repères, portes, murs, végétation placée). Rendu dans `src/render/tactical3d/places/<id>.ts`. |
| **N2 – lieu courant** | Villes secondaires, villages, hameaux, fermes | **Générés une fois** par un générateur à graine, puis **figés** (§4). |
| **N3 – campagne** | Champs, forêts, haies, routes | Procédural, piloté par la graine du lieu ; non mémorisé sauf modifications. |

### 2.2 Schéma d'un lieu N1 (Zod, `src/data/placeSchema.ts`)
Champs obligatoires :
- `id`, `nom`, `canon` (`C|A|?`), `sources[]` (référence précise ou « aucune »), `province` (lien vers `data/provinces`).
- `population` (lue dans les données de simulation) et `densite` (habitants/hectare, `[A]`, bornée par classe : cœur ancien dense 150–300, faubourg 60–150, village 15–50, ferme < 10). **La surface bâtie se déduit de population ÷ densité.** Si l'écart avec le plan dépasse 25 %, le test échoue et le rapport l'explique.
- `enceinte` : tracé (polygone ou arcs), `hauteur_m` (50 `[C]`), `epaisseur_m` (`[?]`, voir §3.1), profil en coupe (talus, fruit, chemin de ronde, créneaux ou non, escaliers, chemins d'accès), `portes[]`.
- `portes[]` (chacune, §3.2) : `id`, `role` (`exterieure|interieure|riviere|poterne`), position, orientation, dimensions du passage et du vantail, structure (huisserie, gonds, treuils, herses, contrepoids), tours/postes de garde, passage voûté (longueur, profondeur, trous d'assassin), `etat` (`intacte|brisee_845|reparee|bouchee`).
- `rues[]` : nom (`[A]` si non canon), tracé (polyligne), largeur, revêtement.
- `ilots[]` : polygone, fonction (habitation, marché, atelier, caserne, entrepôt, culte, jardin), densité de bâti.
- `batiments[]` (lieux-clés listés **un par un** ; bâtiments courants rangés par îlot avec **gabarit choisi, pas tiré au sort** : étages, toit, matériau, état) : emprise, hauteur, orientation (angle libre, pas seulement 0/90°), `archetype`, `reperes_canon` (ex. maison, clinique, église).
- `vegetation` : arbres d'alignement (rues, essences, intervalle), arbres isolés placés (nom du lieu), parcs, cours intérieures, vergers, haies, potagers ; **chaque ville ≥ 8 arbres par hectare bâti, cœur historique compris, ≥ 20 par hectare sur parcs et faubourgs** ; essences tempérées européennes (tilleul, marronnier, chêne, érable, peuplier, bouleau, pin, saule en bord d'eau).
- `eau` : rivières, canaux, puits, fontaines, avec ponts.
- `points_de_vue[]` : caméras nommées pour les captures (§6).
- `etats[]` : variantes datées (`845` avant la brèche, `850`, etc.) si le lieu change dans l'histoire.

### 2.3 Rendu
- Un **chargeur unique** `loadPlace(id)` : lit le JSON validé, construit en **tronçons de 64 m** (frustum culling), **`InstancedMesh`** par archétype de bâtiment et par essence d'arbre, géométries fusionnées pour le statique, textures partagées.
- Chargement à la demande, hors bundle principal (règle existante de three.js). Aucun asset dans le JS.
- Les anciennes scènes E01 à E29 restent pour l'instant ; **E01 est remplacée** par le lieu `shiganshina` (même identifiant dans la visionneuse : `?proto3d&env=E01` charge le lieu N1).
- **Bâtiments pivotés** : le lieu N1 ne dépend pas des boîtes alignées de `src/sim`. Le raccord avec la simulation tactique est le travail de R2 (exception `map.ts`, inchangée).

---

## 3. LES MURAILLES, LES PORTES, LES CHÂTEAUX : CE QUE TU DOIS FAIRE EXACTEMENT

### 3.1 Dimensions des murailles
Rappel `[C]` (fichier 11) : hauteur ≈ **50 m**. Titans-murs ≈ 50 m, Colossal 60 m, Titan de Rod Reiss ≈ 120 m.
- **Épaisseur, fruit, hauteur du parapet, largeur du chemin de ronde, rayon des anneaux** : cherche d'abord dans les sources officielles. Si tu ne trouves pas de valeur **vérifiable**, mets une valeur `[?]` raisonnable et paramétrable dans `data/places/_murs.json`, avec la plage plausible, et note la question dans `docs/lore/questions-ouvertes.md`. **Ne présente jamais un chiffre trouvé sur un wiki comme `[C]`.**
- Chaque mur a une **coupe** dessinée (SVG généré depuis les données) : sol, fondation, parement, fruit, couronnement, chemin de ronde, accès. Fichier `docs/places/<id>/mur-coupe.svg`.
- Le rendu du mur doit **perdre l'aspect « motif répété »** : appareil à plusieurs tailles de blocs, joints, assises irrégulières, usure par zones (coulures, mousse au pied, éclats), au moins trois textures de parement mélangées par masque, variation de teinte par panneau de 5 à 10 m, plus lierre ou pied végétal en campagne. Critère mesurable : l'autocorrélation du parement sur 30 m doit rester sous un seuil à fixer dans le test (pas de répétition visible).

### 3.2 Les portes (extérieure et intérieure), détail obligatoire
Pour **chaque porte** d'un lieu N1 :
1. **Dimensions** `[A]` cohérentes avec la hauteur du mur (une porte de mur de 50 m n'est pas une porte de ville ordinaire : passage assez haut pour une charge de convoi, vantaux massifs, mécanisme de levage visible).
2. **Géométrie** : arc ou linteau, voussures, huisserie, gonds, ferrures, rivets, treuils et contrepoids en tête de mur, herse si pertinente, tourelles ou postes de garde, passage voûté avec trous d'assassin et rainures.
3. **Deux états** quand le canon en prévoit (Shiganshina : porte extérieure, `intacte` et `brisee_845`; porte intérieure `intacte` et `brisee_845`). Pas de trou en forme de rectangle : débris, éclats, arrachements.
4. **Vues rendues** (fichiers obligatoires dans `docs/places/<id>/`) :
   - `porte-<id>-exterieure-face.png` : de l'extérieur, à hauteur d'homme, à 60 m.
   - `porte-<id>-exterieure-detail.png` : ferrures et mécanisme, à 8 m.
   - `porte-<id>-interieure-face.png` et `-detail.png` : de l'intérieur de la ville.
   - `porte-<id>-passage.png` : dans le passage voûté.
   - `porte-<id>-haut.png` : vue du chemin de ronde sur le mécanisme.
   - `porte-<id>-echelle.png` : la porte avec un soldat, un cheval, une charrette et un Titan de 15 m pour l'échelle.
5. **Distinction extérieure / intérieure** : les deux ne se ressemblent pas (la porte extérieure est une porte de front, plus lourde ; l'intérieure protège le cœur de la ville). Le test compare les deux vues et exige une différence mesurable.

### 3.3 Châteaux et édifices majeurs
Pour chacun (château royal de Mitras, château d'Utgard, vieux quartier général du Bataillon d'exploration, quartier général de Trost, cathédrale, chapelle Reiss, caserne, palais de justice, etc.) :
- **Plan** (SVG généré, avec cotes) : étage par étage, cours, remparts, tours, escaliers principaux.
- **Élévations** (SVG) : façade principale et latérale, avec hauteurs.
- **Modèle 3D détaillé fait à la main** (paramétrique, pas aléatoire) : toitures, tours, créneaux, fenêtres, portails, cours, jardins.
- **Vues rendues** : approche (80 m), façade (25 m), cour intérieure, vue d'ensemble du dessus.
- **Intérieurs principaux** : les grandes salles qui servent à l'histoire (salle du trône ou d'audience, salle des conseils, cachot, chapelle), au moins un plan et une vue chacune. Si une salle n'est pas canon, elle est `[A]` et signalée.

### 3.4 Références du monde réel (permises, utilise-les pour échapper au look « généré »)
`[A]` L'ambiance est celle de l'Europe centrale (Allemagne du sud) et alsacienne : on cite couramment Nördlingen comme source d'inspiration de Shiganshina (à noter `[?]` : affirmation répandue, source officielle non vérifiée ici). Pars de **tissus urbains réels** (centres de Nördlingen, Rothenburg ob der Tauber, Colmar, Strasbourg, Carcassonne, Mont-Saint-Michel, châteaux de la Loire et de Bavière) pour : largeur des rues, gabarit des îlots, rapport pignon/gouttereau, pente des toits, fréquence des placettes, rapport rue-mur. Écris dans `docs/places/<id>/inspirations.md` ce que tu as pris et à quel endroit (une ligne par emprunt).

---

## 4. MÉMOIRE DES LIEUX (« une certaine mémoire doit subsister »)

Objectif : un lieu généré **ne change pas** d'une partie à l'autre ni d'un lancement à l'autre, sans stocker de maillages.

1. **Plan figé** : la première génération d'un lieu N2 écrit un **plan compact** (liste d'emprises, hauteurs quantifiées à 0,25 m, archétype par index, positions quantifiées à 0,1 m, version du générateur, graine) dans `data/places/generated/<id>.json`. Ce fichier est **committé** : après ça, le générateur n'est plus relancé pour ce lieu, sauf demande explicite (`npm run places:regenerer -- <id>`).
2. **Maillages** : jamais stockés. Ils se reconstruisent du plan, de manière **déterministe** (même plan = même rendu), avec les instances.
3. **Deltas** (dégâts, incendies, brèches, constructions) : couche séparée dans la sauvegarde (IndexedDB, clé `(lieu, version)`), sous forme de **liste de modifications** par bâtiment (`id`, état, ruine %) ; rien d'autre. Une sauvegarde de 100 lieux modifiés doit rester sous 200 Kio.
4. **Mémoire d'exécution** : un cache LRU de 8 lieux ; au-delà, les tronçons éloignés sont déchargés et rebâtis à la demande ; chaque lieu garde un **budget** de 250 000 triangles visibles et 400 appels de rendu (valeurs cibles à confirmer sur le PC de l'utilisateur).
5. **Lien avec la simulation** : le plan N2 fournit la population et la capacité d'accueil ; la simulation ne lit que ces deux champs (le reste est de la présentation).
6. **Version** : si le générateur change, les plans existants **ne sont pas touchés** ; un test vérifie que le plan figé de chaque lieu produit toujours la même empreinte (hash) de rendu.

---

## 5. LISTE DES LIEUX N1 (par vague ; chacun reçoit son dossier `docs/places/<id>/`)

Chaque lieu a : `plan.svg` (cotes), `mur-coupe.svg` (si enceinte), `portes` (§3.2), `vue-ensemble.png`, au moins 6 `points_de_vue`, `inspirations.md`, `lore.md` (canon / adaptation / incertain, sources).

### R1e — Mur Maria (pilote)
1. **Shiganshina** `[C]` : district sud du mur Maria, saillie du mur avec **porte extérieure** et **porte intérieure** `[C]` (voir fichier 11). À faire entièrement : enceinte et saillie, rue principale, place, église, marché, quartier ouvrier, maison des Jaeger et clinique du Dr Jaeger (position `[A]`, existence `[C]`), maison d'Armin, canal et portes de rivière, quais, entrepôts, casernes de la garnison, escaliers de mur, canons de rempart. États : `845-avant`, `845-breche`, `850-reprise`.
2. **Trois autres districts du mur Maria** : l'utilisateur affirme qu'ils existent. **Vérifie** dans les sources officielles. Si tu confirmes les noms, utilise-les (`[C]`). **Sinon : n'invente aucun nom présenté comme canon.** Crée `maria-district-2`, `-3`, `-4` avec libellé affiché « District du mur Maria (nom non établi) », `canon: "?"`, orientation et rang provisoires `[?]`, et note-les dans `docs/lore/questions-ouvertes.md` pour que l'utilisateur renseigne. Même qualité de construction que les autres lieux (pas de tuile générique) : ils sont **construits à la main** avec une identité propre (un district agricole et grenier, un district de garnison et d'artillerie, un district de marché et de rivière, par exemple, `[A]`).
3. **Corrections de R1d** (§6), appliquées à tous les environnements existants.

### LC-B — Mur Rose
**Trost** `[C]` (porte sud, quartier général, rue des évacuations de 845 et de la bataille de 850, canons de rempart et rails, place du marché, rocher de 850 comme état) ; **Karanes**, **Utopia**, **Krolva** (districts `[C]`, détails `[A]`) ; **camp d'entraînement de la 104e** `[C]` (site `[A]`) ; **quartier général et caserne du Bataillon d'exploration** (ancien château `[A]`).

### LC-C — Mur Sina
**Mitras** `[C]` (capitale : château royal avec cour, salle d'audience et jardins ; cathédrale ; quartier noble ; place du palais ; hôtel de ville ; rempart intérieur), **Stohess**, **Orvud**, **Ehrmich**, **Yarckel** `[C]` ; **ville souterraine** `[C]` (cavernes, escaliers, cheminées de lumière, taudis) ; **chapelle Reiss** `[C]` (souterrain).

### LC-D — Hors des murs et autres
**Forêt des Arbres Géants** `[C]` (arbres de 80 m `[A]`, plusieurs essences, sous-bois, clairières) ; **château d'Utgard** `[C]` (état avant et après 850) ; **Ragako**, **Dauper**, **Jinae** (villages `[C]`, plans `[A]`) ; **ferme et campagne type** ; **Liberio** (Marley : ghetto, quartier des Eldiens, port, quartier de l'armée, forts `[C]`/`[A]`) ; **un fort du front** (artillerie lourde, blockhaus, tranchées) ; **un port de Paradis**.

Les lieux de la liste du fichier 06 qui ne sont pas ci-dessus passent en **N2** (générés puis figés, §4) avec dossier court (`plan.svg` + `vue-ensemble.png`).

---

## 6. CORRECTIFS DE R1d (à faire en premier dans R1e, une seule passe)

1. **CR1d-12 : option a.** Ville-usine (E21) : ciel gris de fumée, voile de brume, suie sur les façades, teinte plus sombre et plus rouge ; Orvud garde son ciel clair. Repasse `smoke:r1b` **en attendant `data-photo3d`**.
2. **Shiganshina/E01 et tous les lieux** : plus d'îlots verts de taille identique ; toits variés (ardoise, tuile plate, tuile canal, bois, chaume en faubourg) ; teintes de façade variées ; ruelles étroites et placettes ; cours plantées.
3. **Mur** : voir §3.1 (fin du motif répété).
4. **Caméra de suivi** : aucun feuillage ne masque l'image (distance minimale caméra-arbre ; sinon l'arbre est écarté ou rendu translucide).
5. **Traînées de gaz** : fines, effilées, dispersées (pas de boudins blancs).
6. **Forêt (E14)** : branches non rectilignes, ramification, éclairage moins sombre, brouillard plus mince ; rayons de lumière dans le sous-bois.
7. **Soldats** : ne sont plus coupés par le bord bas dans les vues de suivi.
8. **Critère f de R0** (tête coupée par la barre de titre) : corrigé enfin, avec capture.
9. **Corps** : conserver l'état R1d (aucun détail anatomique). Ne pas y retoucher.
10. **Titans** : **hors périmètre** (phase T1). Ne rien y faire, sauf bug.

---

## 7. CRITÈRES D'ACCEPTATION (avec commandes ; sorties collées dans le rapport)

| # | Critère | Commande / preuve |
|---|---|---|
| CR1e-01 | `src/sim` inchangé ; `verify` au code 0 | `git diff --stat <départ> -- src/sim` vide ; `npm run verify` |
| CR1e-02 | Schéma de lieu validé ; `places:valider` passe sur tous les lieux | `npm run places:valider` (nouveau, simple) |
| CR1e-03 | Population ÷ densité = surface bâtie à ±25 % pour chaque lieu | test par lieu |
| CR1e-04 | Végétation : ≥ 8 arbres/ha bâti dans chaque ville, ≥ 20/ha sur parcs et faubourgs | test par lieu |
| CR1e-05 | Murs : coupe SVG produite, hauteur 50 m, épaisseur lue de `_murs.json` ; test d'absence de répétition du parement | test + fichier |
| CR1e-06 | Chaque porte : 7 vues de §3.2 produites, non vides, deux à deux **distinctes** (ΔE moyen ≥ 6) ; extérieure ≠ intérieure | script de capture + test |
| CR1e-07 | Shiganshina : états `845-avant`, `845-breche`, `850-reprise` rendus et distincts | captures |
| CR1e-08 | Wall Maria : 4 districts présents ; noms non confirmés marqués `?` et listés dans `questions-ouvertes.md` | test + fichier |
| CR1e-09 | Mémoire : plan figé reproduit le même hash de rendu ; sauvegarde de deltas < 200 Kio pour 100 lieux modifiés | test |
| CR1e-10 | Bundle principal inchangé ; assets hors du JS ; `assets:check` code 0 | commandes existantes |
| CR1e-11 | Correctifs §6 (1 à 8) : chacun avec capture avant/après | planche |
| CR1e-12 | Captures revues une par une (ligne 14 de CLAUDE.md : 3 lignes + 3 défauts possibles) | rapport |
| CLC-B/C/D | Même grille de critères, par lieu ; les lieux non faits en dette `LC-reporté` | rapports courts |

**Critère visuel décisif (juge unique : l'utilisateur)** : à l'arrêt de R1e, la vue d'ensemble de Shiganshina ne doit **pas** pouvoir être confondue avec un tirage au hasard : rues nommées, places, église, quartiers distincts, arbres, mur détaillé, deux portes crédibles.

---

## 8. ORDRE DE TRAVAIL DE R1e (tâches ; un commit par tâche ; `npm run verify` avant chaque commit)

1. **R1e.0** : mettre à jour `CLAUDE.md` (§0 ci-dessus) et `docs/PROGRESS.md` (nouvelle feuille de route). Lire les fichiers requis. Créer `docs/reports/dette.md` et `docs/lore/questions-ouvertes.md`.
2. **R1e.1** : schéma de lieu, chargeur, validation, dossier `docs/places/`, générateur de plans SVG (plan, coupe, élévations).
3. **R1e.2** : correctifs §6 (1 à 8).
4. **R1e.3** : modèles de murs et de portes (fiches §3.1, §3.2), bancs de test sur un mur et une porte isolés avant de les poser.
5. **R1e.4** : **Shiganshina** (plan complet, portes, états, végétation, bâtiments repères).
6. **R1e.5** : les trois autres districts du mur Maria.
7. **R1e.6** : mémoire des lieux (§4) et premier lieu N2 de démonstration (un village).
8. **R1e.7** : captures (script unique `places:captures`), revue des captures, rapport, `PROGRESS.md`. **ARRÊT.**

Puis LC-B, LC-C, LC-D à la suite, sans arrêt, avec le même modèle (une tâche par lieu).

---

## 9. TEXTE À AJOUTER À CLAUDE.md

```
## Réorganisation (R1e, décision de l'utilisateur)
- Lieux principaux : faits à la main (data/places/<id>.json, plan d'auteur). Lieux courants : générés une fois puis figés (data/places/generated/). Villes de taille réaliste (population ÷ densité) et plantées.
- Interdit : créer une sous-phase (R1f, R1g…). Hors-périmètre : docs/reports/dette.md.
- Interdit : nouvel outil de mesure ; ne pas optimiser pour le rendu logiciel.
- Rapports : 150 lignes maximum.
- Arrêts de revue : fin de R1e, fin de LC-D, fin de R4, fin de P9 (et les arrêts 1 à 4).
- Droit d'auteur : formes des lieux reconstruites d'après les descriptions ; aucun fichier de l'œuvre ou de fans, aucun décalque.
- Lore : jamais de nom ou de chiffre inventé présenté comme canon ; sources officielles seulement ; incertain = [?] + docs/lore/questions-ouvertes.md.
```

---

## 10. STATUT DES AFFIRMATIONS DE CE FICHIER (liste séparée, demandée par l'utilisateur)

**Sourcées (dans les fichiers du projet, pas re-vérifiées en ligne ici)** : mur ≈ 50 m, Colossal 60 m, Titan de Rod Reiss ≈ 120 m, saillie de Shiganshina avec deux portes (fichier 11, `ERRATA.md`) ; districts de Rose et de Sina (fichier 11).

**Interprétatives (adaptations assumées `[A]`)** : toutes les densités d'habitants par hectare, les dimensions des portes, les noms de rues, l'identité des trois districts « hypothétiques » de Maria, les essences d'arbres, la localisation de la maison des Jaeger, la répartition des tissus urbains réels comme modèles.

**Non confirmées (`[?]`)** : épaisseur, fruit et largeur du chemin de ronde des murs ; noms, rang et orientation des trois autres districts du mur Maria (affirmés par l'utilisateur, non retrouvés dans une source officielle ; recherche en ligne de ma part sans résultat exploitable) ; lien entre Nördlingen et Shiganshina (affirmation courante, source officielle non vérifiée).
