# Dette n° 72 — uniformes des soldats fidèles à l'univers (D-163, D-165)

Demande de l'utilisateur (2026-10-10) : soldats conformes à L'Attaque des Titans (uniformes, emblèmes, tenues de pluie,
cérémonies, équipement). Règle de méthode inchangée : tout est redessiné par le projet, aucun fichier ni décalque de l'œuvre.

## Ce qui est livré
- **Uniforme commun** des quatre corps de Paradis (veste courte brun clair, pantalon clair, hautes bottes, harnais) ; les
  inventions de R3 (veste gris pierre, écharpe rouge, manteau et képi de la Police) sont retirées.
- **Emblèmes vectoriels** (`src/render/tactical3d/emblems.ts`) : Ailes de la liberté, deux roses, tête de licorne, épées
  croisées, sur un écu ; au dos (sur la cape pour le Corps de Reconnaissance), aux deux manches, à la poitrine.
- **Cape verte à capuche** jusqu'au-dessus du genou ; **capuche levée sous la pluie** (option `pluie` du soldat).
- **Équipement** : une bonbonne de gaz sur chaque boîtier ; lames rangées au salut.
- **Salut** (poing droit sur le cœur, main gauche dans le dos) et planche de **cérémonie** (trois rangs de recrues).
- **Marley** : brassard à étoile à neuf branches au bras gauche de l'infanterie (couleurs et bras : `?`, Q18).
- **Bataille** : fantassins de Paradis en tenue de la Garnison, fusil en main pour tirer ; foule instanciée et figures du
  premier temps aux couleurs de l'uniforme commun (aucun saut de couleur entre détail et foule).
- Mention du menu et du README : « aucun fichier de l'œuvre originale n'est repris ; uniformes et emblèmes redessinés par
  le projet » (D-163).

## Contrôles
Tests des soldats et des poses (`npx vitest run tests/render/tactical3d/r3-soldats.test.ts
tests/render/tactical3d/r3-poses.test.ts tests/render/tactical3d/battle3d.test.ts --reporter=verbose`), sortie réelle :
```
silhouettes de soldats : maximum 0.964 ; exploration/garnison 0.70 | exploration/police 0.69 | exploration/recrues 0.83 | exploration/marley_infanterie 0.58 | exploration/marley_officier 0.63 | garnison/police 0.96 | garnison/recrues 0.78 | garnison/marley_infanterie 0.59 | garnison/marley_officier 0.61 | police/recrues 0.78 | police/marley_infanterie 0.59 | police/marley_officier 0.60 | recrues/marley_infanterie 0.61 | recrues/marley_officier 0.65 | marley_infanterie/marley_officier 0.58
 Test Files  3 passed (3)
      Tests  20 passed (20)
```
Garnison et Brigade Militaire (0,96) ne se distinguent que par l'emblème, comme dans l'œuvre : critère par famille (D-165).
Contact au sol, salut compris : « soldats, écart maximal au sol (m) : attente 0.0025, marche 0.0032, course 0.0030, frappe
0.0039, tir 0.0065, salut 0.0016 ».

`npm run smoke:r3 -- --captures` (`docs/reports/dette72-smoke-r3.log`, avant le seul changement de libellé « Bataillon
d'exploration » → « Corps de Reconnaissance » dans le smoke) :
```
  OK  r3-soldats : planche prête en 33.9 s, 8 étiquettes
  OK  r3-uniformes : planche prête en 34.5 s, 5 étiquettes
  OK  r3-ceremonie : planche prête en 41.0 s, 1 étiquettes
  OK  fantassins de la Garnison en tenue : 7 (et 17 soldats du Bataillon d'exploration)
  OK  bundle principal assets/index-DBiz2Du2.js sans three.js ni figures de R3 ; vue 3D en morceau à part (view3d-BHHd3pM8.js)
  OK  0 erreur console
smoke:r3 : tout est conforme.
EXIT=0
```
`npm run verify` (`docs/reports/dette72-verify.log`) : « Test Files  119 passed (119) », « Tests  763 passed (763) »,
`assets:check` « 102 entrées, 102 fichiers ; licences, sources et empreintes conformes », `sim:selftest` OK, `EXIT=0`.
`canon:check` : « « data » conforme (R1–R14, 845 entrées). » ; statuts de `data/` : 360 C, 1 348 A, 117 ?.

## Captures (`docs/screenshots/`, 1920×1080 ; bataille 1366×768)
1. **r3-uniformes** : quatre corps de dos et de trois quarts sous leurs emblèmes agrandis (ailes, roses, licorne, épées) ;
   cinquième colonne, le Corps de Reconnaissance sous la pluie, capuche verte levée. Uniforme brun et blanc, harnais et
   équipement de manœuvre visibles. Défauts : pieds lisses (bottes sans semelle ni talon, lecture de pieds nus de près) ;
   intérieur de la capuche sombre et bord détaché vu de face ; emblèmes de manche très petits à cette distance ; la licorne
   reste schématique (crinière en trois mèches).
2. **r3-ceremonie** : trois rangs de sept recrues au salut, poing droit sur la poitrine, face à un instructeur du Corps de
   Reconnaissance vu de dos (cape et Ailes de la liberté). Défauts : rangs serrés qui se chevauchent en perspective ; aucune
   estrade ni drapeau (mise en scène minimale) ; certains poings proches du sternum plutôt qu'à gauche ; pieds lisses.
3. **r3-soldats** : six tenues de face et de dos (quatre de Paradis, infanterie et officier de Marley) ; fusils au pied
   pour la Garnison et la Brigade Militaire, brassard doré au bras de l'infanterie. Défauts : Garnison et Brigade identiques
   de loin (emblème seul, voulu) ; l'étoile du brassard est à peine lisible ; cape à peine visible de face.
4. **r3-bataille-paradis-1366** : ligne de la Garnison devant les maisons, en brun et blanc, fusils en main ; trois
   soldats du Corps de Reconnaissance au premier plan, capes vertes et emblèmes. Défauts : bâtiments sans texture au
   premier temps ; ligne de figures petites au loin ; bandeau « Pause » qui couvre le haut de la scène.

## Reste (dette n° 72, moyenne)
Tenues sombres de 854 (Liberio), équipement anti-personnel et lances de foudre, cérémonies en jeu (hors planche), capuche
liée à une météo de bataille (la bataille n'a pas de météo), semelles et talons des bottes.
