# Dettes corrigées après la dette n° 72 — partie 4 sur 4

Sommaire et méthode : `dettes-suite.md`.

## Dette n° 47 : avertissements WebGL du repli 2D
- Cause : en WebGL 1, Pixi 8 règle à chaque mise à jour d'un style de texture `TEXTURE_COMPARE_MODE`, constante propre à
  WebGL 2 (`undefined` en WebGL 1) ; le pilote répond « INVALID_ENUM: texParameter » (51 fois au passage final de R2+).
- Correctif local (rien dans `node_modules`) : les vues Pixi (carte, bataille 2D, planche des figures) reçoivent un canevas
  dont `getContext` garde tout contexte WebGL 1 : un nom de paramètre inconnu est ignoré (`src/render/pixiCompat.ts`). Une
  première version posait la garde après `app.init` : 2 avertissements restaient (textures créées pendant l'initialisation).
- `smoke:r2` exige désormais 0 avertissement : partie 3 (`dette47-smoke-r2-p3.log`) « repli 2D (WebGL 1 simulé) : 0
  avertissement « texParameter: invalid parameter name » », « smoke:r2 : tout est conforme. », `EXIT=0`.
- Passage complet de `smoke:r2` (`dette47-smoke-r2.log`) : arrêté en 3840×2160, « locator.click: Timeout 30000ms exceeded »
  sur le bouton « ×1 » (page occupée ; « prêt » 9,9 s en 1920 contre 6,0 à 6,4 s aux passages précédents, simulation aussi
  plus lente : machine ralentie) ; partie 4 rejouée seule (`dette47-smoke-r2-p4.log`) : « 3840×2160 : vues stratégique et
  suivi rendues (83 images) », « smoke:r2 : tout est conforme. », `EXIT=0`.
- `smoke:map` : premier passage (`dette47-smoke-map.log`) KO « Espace : pause, la date ne bouge plus (AC1-12) », cause non
  établie (contrôle sur une fenêtre de 0,8 s, machine chargée) ; second passage (`dette47-smoke-map-2.log`) : « OK  Espace :
  pause, la date ne bouge plus (AC1-12) », « smoke:map : OK », `EXIT=0`. À surveiller.
- `npm run verify` (`dette47-verify.log`) : « Test Files  134 passed (134) », « Tests  812 passed (812) », `EXIT=0`.
- Pas de capture : le correctif ne change pas l'image (il retire des appels sans effet en WebGL 1).

## Dette n° 70 (en partie) et E-05 : menu contextuel de la carte (04 §3)
- Clic droit sur une province : menu sobre au curseur (retourné s'il déborderait de la fenêtre) avec « Ouvrir le dossier »,
  « Centrer la vue ici », la fiche de chaque armée du joueur présente (trois au plus) et « Préparer une expédition » quand ces
  registres existent ; fermé par Échap, un clic ailleurs, la molette ou un choix (`src/ui/mapContextMenu.ts`).
- `smoke:map` (`menu-carte-smoke-map.log`) : « clic droit → menu contextuel « Trost » : Ouvrir le dossier · Centrer la vue ici
  · Armée du Sud : ouvrir la fiche · Préparer une expédition (04 §3) », « Échap ferme le menu contextuel (sans rien
  ouvrir) », « menu contextuel : « Ouvrir le dossier » ouvre le dossier de Trost », « smoke:map : OK », `EXIT=0` ;
  `npm run verify` (`menu-carte-verify.log`) : « Test Files  135 passed (135) », « Tests  813 passed (813) », `EXIT=0`.
- **`p1-menu-contextuel.png`** : île entière en 850, menu ouvert sous Trost, titre « TROST » en petites capitales et quatre
  entrées, la première surlignée.
  - Défauts : le menu cache Shiganshina et le bas de l'anneau de Rose ; titre petit et pâle ; étendard d'armée posé sur le
    nom de Trost ; « Mitras » à moitié couvert par un étendard.

## Dette n° 70 (en partie) et E-08 : surimpressions de débogage tactiques (03 §14, F-DEV-07)
- Écran 2D, touche F2 (déjà : compteur ms/image) : ancrages cerclés d'ocre (dessinés une fois à l'allumage), portée de vue
  de chaque Titan (jour ou nuit), câble de chaque soldat accroché, portée des fusées récentes, trajectoire en arc de chaque
  batterie qui vise. `TacticalScene.setDebug`, `debugStats`.
- Premier `smoke:tactique` : « 300 unités … p95 18.70 ms » (rendu 13,7 ms) : ce contrôle allumait F2 pour lire le compte
  d'unités et mesurait donc avec les surimpressions (576 cercles redessinés à chaque image). Essai sans canevas gardé
  (dette n° 47) : 20,7 ms, cause écartée. Ancrages passés sur une couche fixe : 11,8 ms. Le contrôle lit désormais le compte
  puis éteint F2 avant de mesurer, comme avant E-08 (jeu normal).
- `smoke:tactique` (`debug-smoke-tactique.log`) : « F2 : surimpressions de débogage — 576 ancrages, 3 portées de vue de
  Titans (03 §14, E-08) », « 300 unités : temps JS par image p95 6.90 ms < 8 ms (… rendu 3.00 …) », « smoke:tactique : tout
  est conforme. », `EXIT=0` ; `npm run verify` (`debug-verify.log`) : « Tests  813 passed (813) », `EXIT=0`.
- **`p4-debug.png`** : Ville des Murs vue de haut en mode debug ; cercles ocre aux angles des maisons (ancrages), arcs
  rouges des portées de vue de trois Titans, escouades 1 à 4 dans les rues, « 4,9 ms/image · 27 unités ».
  - Défauts : cercles d'ancrage serrés qui chargent l'image ; aucun câble au départ (soldats au sol) ; arcs coupés par le
    bord du cadre ; pas de légende des couleurs.

## Dette n° 44 (en partie) : aides contextuelles des calques et des notifications
- Deux aides de plus, une seule fois chacune : au premier calque affiché (« Un calque teint la carte selon une donnée… »)
  et au premier clic sur une entrée du fil des notifications. Le bandeau reste sans aide propre (le guide le présente).
- `smoke:tuto` (`dette44-smoke-tuto.log`) : « aide des calques au premier calque affiché (« Un calque teint la carte selon une
  donnée (nourriture, moral, Titans…) ») », « éléments déjà expliqués conservés (decrets, calques) », « smoke:tuto : tout est
  conforme. », `EXIT=0` ; `npm run verify` (`dette44-verify.log`) : « Tests  813 passed (813) », `EXIT=0`.
- Pas de capture nouvelle : l'aide utilise la carte d'aide existante (`tuto-aide-1366.png`).

## Dettes n° 19, 35, 42, 51 (anglais) et E-07 : le jeu en anglais (24 §2.5)
- 3 768 textes traduits en huit lots par des agents, sur une consigne commune (glossaire des noms anglais de l'œuvre :
  Survey Corps, Garrison, Military Police, Wall Maria, ODM gear, thunder spears… ; paramètres et accords gardés), puis
  fusionnés après un contrôle automatique des paramètres (0 rejet) ; deux aides ajoutées ensuite traduites à la main :
  3 886 clés sur 3 886. Noms des murs de la carte, deux-points (« : » / « : ») et format des nombres suivent la langue.
- `tests/i18n/en-coverage.test.ts` : au moins 90 % des clés, mêmes paramètres que le français, aucune clé inconnue.
- `npm run verify` (`anglais-verify.log`) : « Test Files  136 passed (136) », `EXIT=0` ; `smoke:map`
  (`anglais-smoke-map.log`) : « OK  langue EN : titre traduit (F-UIX-18) », « smoke:map : OK », `EXIT=0`. Relevé des lignes
  visibles en anglais (écran principal, économie, armées) : aucune ligne aux mots-outils français.
- **`en-armees-1366.png`** : registre « Armies » en anglais, « Army of the South », « Command: Dot Pixis », « 1,180 »,
  carte avec « WALL MARIA », « WALL ROSE », « WALL SINA », calques « Political », « Food »…
  - Défauts : « 70 % » et « 100 % » gardent l'espace française (écrite dans le code) ; « 1,2 k » sur l'étendard (format
    court français) ; « Brigade Reserve » cohabite avec « Military Police » ailleurs ; traduction relue par échantillons
    seulement (à relire par un anglophone).
- **`en-economie-1366.png`** : registre « Economy », rationnement « Normal / Reduced / Strict », ressources « Food, Gas,
  Steel, Ice Burst Stone… » au format anglais (« 450,000 », « +12.2 »), détail « Civilians (780,000) ».
  - Défauts : « 0.05 % per day » garde l'espace avant « % » ; libellés du rationnement serrés sur une ligne ; « Today's
    change » en tête du détail, terme à relire ; colonne de droite du registre vide sous les totaux.
- Complément : signe « % » (« 70 % » en français, « 70% » en anglais) et format court des étendards (« 1,2 k » / « 1.2k »)
  suivent la langue (12 endroits du code). `npm run verify` (`anglais2-verify.log`) : « Tests  815 passed (815) »,
  `EXIT=0` ; `smoke:pa` (`anglais2-smoke-pa.log`) : « smoke:pa : tout est conforme. », `EXIT=0`.
