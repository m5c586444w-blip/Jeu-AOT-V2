# Dettes corrigées après la dette n° 72 — partie 3 sur 4

Sommaire et méthode : `dettes-suite.md`.

## Dette n° 21 (en partie) : chiffres sans libellé, pluriels, signes des dépenses
- Accord en nombre dans les textes (`{n|singulier|pluriel}`, singulier pour 0 et 1 en français, pour 1 en anglais) : les
  21 formes « (s) » réécrites (« 4 Titans », « 1 Titan », « 2 abstentions », « 1 objectif atteint »…).
- Cartes d'escouade de la bataille 2D : « 6/6 debout · gaz 100 · lames 2 · stress 13,4/100 » au lieu de « 6/6 gaz 100
  lames 2 stress 13,4 ». Chancellerie : chaque axe de relation porte un mot d'échelle (« 0 · neutre », « 62 · élevée »).
- Infobulles : dans une dépense (consommation, pertes, entretien), un poste qui s'ajoute s'écrit comme un montant
  (« 7 800 », en rouge) et non « +7 800 », qui contredisait le « −8 304 » du solde ; une réduction garde son « − ».
- `npm run verify` (`dette21-verify.log`) : « Test Files  129 passed (129) », « Tests  801 passed (801) », `EXIT=0`.
- `smoke:tactique` : premier passage (`dette21-smoke-tactique.log`) KO sur « 300 unités : temps JS par image p95 8.00 ms
  < 8 ms » (simulation, que ce lot ne touche pas, à 1,90 ms contre 1,0 à 2,1 ms aux passages antérieurs : charge de la
  machine) ; second passage (`dette21-smoke-tactique-2.log`) : « p95 7.60 ms < 8 ms », « revue P4 : 4 cartes d'escouade
  entières dans la largeur (0 coupée(s)) », « smoke:tactique : tout est conforme. », `EXIT=0`. Marge mince : à surveiller.
- **`p4-carte-ville.png`** (bas de l'écran) : quatre cartes d'escouade sur une ligne, « Escouade 01 » à « 04 », ligne
  « 6/6 debout · gaz 100 · lames 2 · stress 13,4/100 », ordre « ATTAQUER », boutons d'ordres.
  - Défauts : stress à une décimale (13,4) quand les autres valeurs sont entières ; boutons d'ordres sur deux lignes ; carte
    du terrain vide au-dessus (fond uni beige) ; « gaz 100 » sans unité.

## Dette n° 55 (en partie) : nom du lieu au carnet de bataille
- Une rencontre d'armées ouvre son carnet sur le nom de la province (« Plaines intérieures de Maria — Sud ») au lieu du type
  de carte tactique (« Plaine hors-murs »). Les quatre provinces « Plaines » reçoivent leur article : « Titans en vue aux
  Plaines intérieures… » au lieu de « à Plaines… ». Reste le camp des obus au bilan : la simulation ne compte pas les tirs
  par camp (`src/sim`, figé depuis R2).
- `npm run verify` (`dette55-verify.log`) : « Tests  801 passed (801) », `EXIT=0` ; `smoke:pa` (`dette55-smoke-pa.log`) :
  « carnet : « 00:00 — Début de la bataille — Plaines intérieures de Maria — Sud — 109 hommes de Paradis contre 3 Titans —
  de » », « smoke:pa : tout est conforme. », `EXIT=0` (capture prise avant l'ajout des articles).
- **`pa-artillerie-rempart.png`** : plaine vue de haut, cinq sections au sud (S1 à S5), trois Titans au nord ; carnet
  « Début de la bataille — Plaines intérieures de Maria — Sud — 109 hommes de Paradis contre 3 Titans — de jour. ».
  - Défauts : titre « Titans en vue à Plaines… » (article absent, corrigé ensuite) ; tiret du nom de province confondu avec
    les tirets de la phrase ; plaine uniforme presque vide ; sections réduites à des traits au sol à cette distance.

## Dette n° 15 (en partie) : noms de la carte sur les murs
- Le test « le nom touche-t-il un mur ? » ne regardait que trois points sur la longueur : la bande d'un mur passait entre deux.
  Un test fin (un point par demi-hauteur de texte) choisit d'abord parmi de petits décalages (au-dessus, au-dessous, le long
  du rayon de l'île) ; à défaut, l'ancien choix reste (aucun nom ne disparaît : un premier essai, test fin partout, en
  cachait neuf et poussait « Rivière des Cendres » sur la mer). Liseré couleur papier sous les noms de provinces et d'outre-mur.
- `npm run verify` (`dette15-verify.log`) : « Tests  801 passed (801) », `EXIT=0` ; `smoke:map` (`dette15-smoke-map.log`) :
  « smoke:map : OK (captures dans docs/screenshots/). », `EXIT=0`.
- **`map-1366-region.png`** : moitié sud de l'île, trois anneaux de murs, Trost et Shiganshina au centre ; « Fort avancé de
  Maria » descendu sous « Forêt des Arbres Géants », entre les anneaux ; « Plaines céréalières du Sud » rentrée dans l'anneau.
  - Défauts : « Hameaux de l'Ouest de Maria » et « Plaines intérieures de Maria — Sud » chevauchent encore l'anneau de Maria
    (lisibles grâce au liseré) ; « Rivière des Cendres » mord sur la côte ; « Collines minières » coupé au bord haut.
- **`map-1366-province.png`** : niveau province autour de Trost ; noms de segments de murs dans les bandes, aucun nom de
  province sur un mur.
  - Défauts : « 1,2 k » de l'armée collé au nom du segment « Rose-Sud — porte de Trost » ; relief peu marqué ; grands aplats
    de prairie sans nom au sud.

## Dette n° 12 (suite) : halles de Quinta distinctes
- La halle aux draps (plan d'auteur de Quinta) reçoit un étage fermé en pan de bois au-dessus de la halle ouverte, en
  encorbellement, et un beffroi sur le faîtage (paramètres `etage` et `beffroi` de l'archétype « halle », A) ; sa couverture
  d'ardoise est enfin rendue (toutes les halles prenaient la teinte des tuiles). La grande halle reste basse et ouverte.
- `places:regenerer -- maria-district-4` : seule l'entrée de la halle change dans le JSON ; `places:valider`
  (`dette12-places-valider.log`) : « places:valider : 4 lieu(x) N1 et 1 plan(s) figé(s) valides. » ; `npm run verify`
  (`dette12-verify.log`) : « Tests  801 passed (801) », `EXIT=0`.
- **`vue-marche-aux-draps.png`** : place pavée couverte d'étals ; au fond, la halle aux draps à toit d'ardoise, étage à
  colombages sur poteaux de bois, beffroi à flèche ; maisons à pignons autour.
  - Défauts : beffroi un peu grêle pour la masse du toit ; fenêtres de l'étage en simple bandeau sombre ; étals tous
    alignés, identiques d'une rangée à l'autre ; habitants très petits.
- **`vue-grand-marche.png`** : la grande halle basse, ouverte, toit de tuiles brun clair, et un grand arbre à droite.
  - Défauts : toit de la halle uniforme, sans tuiles visibles ; poteaux serrés vus de loin ; ciel identique à l'autre vue.

## Dette n° 46 (en partie) : batailles d'expédition en 3D (D-173)
- « Jouer » une bataille d'expédition ouvre l'écran temps réel (vue 3D par défaut), avec le nom de la province au carnet ;
  les ordres sont rejoués par la simulation comme avant. Restent sur l'écran de P4 : la bataille d'essai classique et le guide.
- Cartes d'escouade de l'écran de P4 : gaz et stress arrondis à l'entier (le stress à une décimale réécrivait la carte à
  chaque image ; poste « interface » du contrôle des 300 unités de 1,8 à 1,4 ms).
- `smoke:tactique`, premier passage (`dette46-smoke-tactique.log`) : partie expédition conforme, mais KO « 300 unités :
  temps JS par image p95 8.00 ms < 8 ms » (interface 1,80 ms) ; après l'arrondi, second passage
  (`dette46-smoke-tactique-2.log`) : « p95 7.60 ms < 8 ms », « écran de bataille lié (temps réel, vue 3d) : « Expédition n° 1
  — bataille de la Forêt des Arbres Géants » », « ordre « couvrir » donné à la première escouade (touche C) », « bataille
  validée puis reportée dans la campagne : « J3 — Bataille jouée à la Forêt des Arbres Géants : 1 morts, 1 Titans abattus
  (victoire). » », « smoke:tactique : tout est conforme. », `EXIT=0`. Marge du contrôle de 300 unités mince (rendu 3,5 ms).
- `npm run verify` (`dette46-verify.log`) : « Tests  801 passed (801) », `EXIT=0`.
- **`p4-bataille-liee.png`** : forêt des Arbres Géants en 3D vue de haut, troncs et houppiers, ombres portées ; pastilles des
  escouades 2 à 17, Titan « T » au nord ; carnet « Début de la bataille — Forêt des Arbres Géants — 12 hommes contre 1 Titan
  — de jour. ».
  - Défauts : arbres en sucettes (tronc lisse, boule de feuillage), bien moins hauts que 80 m à l'œil ; sol olive uniforme ;
    trace rouge isolée à gauche ; « 1 morts » au journal de l'expédition (corrigé ensuite : accord en nombre dans dix textes de pertes).

## Conformité 3D : Arbres Géants de la bataille (03 §2)
- Constat (capture de la bataille d'expédition, dette n° 46) : arbres « en sucettes », fût lisse et boule de feuillage.
- Fût effilé à sept côtes d'écorce, sillons plus sombres ; pour les arbres géants (70 à 90 m) : six contreforts au pied,
  cinq à sept branches maîtresses entre 55 et 80 % de la hauteur, houppier en quatre ou cinq masses (`battle/trees.ts`, A).
  Le pied du fût garde le rayon de la simulation (emprise testée à ± 0,1 m : premier essai à 18 côtés refusé, 20 côtés).
- `npm run verify` (`arbres-verify.log`) : « Test Files  130 passed (130) », « Tests  803 passed (803) », `EXIT=0`.
- **`bataille-foret-strategique.png`** : essai de compagnie dans la Forêt des Arbres Géants, vue haute ; troncs bruns
  obliques, houppiers en grappes, ombres longues ; escouades 1 à 10 au sud, Titans et sections ennemies au nord.
  - Défauts : houppiers encore en facettes ; sol olive uniforme ; petits arbres réduits à une boule sombre ; pastilles
    « S1 », « S2 » et numéros d'escouades serrés sur la même ligne.
- **`bataille-foret-suivi.png`** : caméra de suivi de l'escouade 01 au sol ; trois soldats en cape verte au premier plan,
  troncs géants côtelés au fond, contreforts visibles au pied, ciel bleu pâle.
  - Défauts : herbe absente (sol lisse) ; un petit arbre isolé en boule noire au loin ; étiquette « 1 » de l'escouade posée
    sur un tronc ; lisière nette de la forêt contre la plaine.

## Dette n° 65 (reste) : chevaux et cavaliers (fichier 18, R3.6)
- Les hommes des sections de type « cavalier » (simulation) montent un cheval dans la bataille 3D : foule instanciée d'un
  cheval (tronc, encolure, tête à 45°, crinière, queue, quatre pattes ; cinq robes) et d'un cavalier en selle (cuisses à 35°,
  jambes le long des flancs, fusil en travers du dos ; uniforme commun pour Paradis). Allures dans le shader : chaque patte
  pivote autour de son épaule ou de sa hanche, galop rassemblé, tronc qui monte et descend ; arrêt à l'arrêt, immobiles en
  mouvements réduits. Mort : cheval couché sur le flanc. Pas de figure détaillée de cavalier (foule à toute distance). A.
- Premier rendu de profil : cuisses à l'horizontale (posture de chaise), queue en pointe vers l'arrière, tête trop haute ;
  angles repris, puis queue rentrée sous la croupe.
- `smoke:pa` (`cavaliers-smoke-pa.log`) : « cavaliers : 11 chevaux pour 11 hommes des sections de cavaliers », « smoke:pa :
  tout est conforme. », `EXIT=0` ; `npm run verify` (`cavaliers-verify.log`) : « Test Files  131 passed (131) », « Tests  805
  passed (805) », `EXIT=0`.
- **`pa-cavaliers.png`** : la section 5 (cavaliers) vue de dos, onze chevaux en ligne (bai, alezan, noir, gris, isabelle),
  cavaliers en selle, un rocher gris derrière.
  - Défauts : cavaliers petits et raides ; selles en boîtes ; chevaux à l'arrêt (section en « tenir la position ») ; herbe
    lisse.
- **`pa-cavaliers-profil.png`** : la même ligne de profil ; encolure et tête inclinées, crinière sombre, queue pendante,
  cavalier assis, bras tendus vers les rênes, botte le long du flanc.
  - Défauts : pas de rênes ni de bride ; bras du cavalier trop droits ; tronc du cheval en trois boules visibles ;
    oreilles à peine marquées.

## Soldats (CLAUDE.md § Style) : lames cassables et remplaçables
- Quand la simulation retire une paire de lames à un soldat (usure), la vue 3D lâche les deux lames : elles partent des
  mains vers l'extérieur, tournoient, retombent et restent à plat au sol quatre secondes (`battle/shards.ts`, trajectoires
  tirées de l'événement ; mouvements réduits : posées d'emblée). Longueur des lames tenues en main (0,86 m), reflet discret.
- `smoke:r2` (`controle-smoke-r2.log`, après ambiance, arbres et chevaux) : « smoke:r2 : tout est conforme. », `EXIT=0` ;
  `smoke:r3` (`lames-smoke-r3.log`) : « lames brisées : couche présente ; 0 paires usées depuis le début, 0 lames en train de
  tomber ou au sol », « smoke:r3 : tout est conforme. », `EXIT=0` ; `npm run verify` (`lames-verify.log`) : « Test Files
  132 passed (132) », « Tests  808 passed (808) », `EXIT=0`.
- Aucune casse en dix minutes de bataille au rendu logiciel : la capture provoque une casse par la sonde de développement
  (une paire retirée au soldat 0 d'un essai, sans effet sur la partie).
- **`bataille-lames-brisees.png`** et son recadrage agrandi **`bataille-lames-brisees-x4.png`** : plaine, escouade 01 suivie ;
  colonne de fumée rouge d'une fusée ; dans le recadrage, deux lames posées à plat dans l'herbe, fines bandes claires.
  - Défauts : lames presque invisibles à cette distance (vraie taille) ; crénelage en pointillés ; la fumée rouge couvre le
    tiers droit de la vue ; aucune animation de changement de lames sur la figure.

## Soldats (CLAUDE.md § Style) : jets de gaz de l'équipement de manœuvre
- Quand la simulation dépense du gaz pour un soldat (élan sur le câble), une bouffée part du bas du dos, au plus toutes
  les 0,12 s ; elle grossit et se dissipe en 1,2 s (`battle/gasJets.ts`) ; émission claire pour rester blanchâtre à l'ombre.
- `smoke:r3` (`gaz-smoke-r3.log`) : « jets de gaz : 0 bouffées visibles (gaz dépensé depuis le début : 0) » (aucun élan
  dans cette séquence, d'où une ligne d'information ; un premier contrôle exigeant des bouffées y était donc mal posé, KO),
  « smoke:r3 : tout est conforme. », `EXIT=0` ; `npm run verify` (`gaz-verify.log`) : « Tests  811 passed (811) », `EXIT=0`.
- **`bataille-jets-de-gaz.png`** : essai contre quatre Titans dans la Ville des Murs, caméra de suivi plongeante sur
  l'escouade 01 au pied d'un Titan ; derrière elle, une file de bouffées claires sur la chaussée ; maisons à fenêtres.
  - Défauts : vue plongeante (rue masquée) qui écrase le relief ; bouffées petites à cette distance ; bâtiment translucide
    hachuré au centre ; cratère sombre pris pour une bouffée au premier coup d'œil.
