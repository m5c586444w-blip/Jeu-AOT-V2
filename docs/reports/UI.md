# Rapport de phase UI — refonte de l'interface (fichier 22 §5)

Branche `claude/v2-ui` (depuis `7146a98`). Tâches UI.1 à UI.7 faites, un commit par tâche (UI.7 : un commit d'état,
un commit de correctifs), `verify` code 0 avant chaque commit de code. **9 smoke sur 10 OK** ; `smoke:tactique` garde
une ligne KO (2 erreurs de page, § Smoke). La bataille n'est plus recouverte (99,0 % de la scène visible).

## Commits
| Tâche | Commit | Contenu |
|---|---|---|
| UI.1 | f50f61a | jetons de style (`tokens.css` seule source de couleurs), composants, `/ui-kit.html`, portraits peints |
| UI.2 | 3e3616b | 90 icônes SVG dessinées (`src/ui/icons.ts`), blasons, test `icons` |
| UI.3 | 77ba299 | barre supérieure (6 ressources + variation), alertes, menu de gestion en bas regroupé, fil, écran Économie |
| UI.4 | f73769b | maître-détail : personnages, cabinet, arbre de recherche, renseignement, expéditions, chancellerie, décrets, journal |
| UI.5 | 35efdec | menu principal plein écran (rendu 3D des murs au crépuscule), 4 entrées, scénarios illustrés, épilogue |
| UI.6 | 5713f29 | infobulles de calcul à 3 niveaux (`whyModel`), raccourcis dans les infobulles, fil (icône, catégorie, lieu) |
| UI.7 | a51a1bd | premier passage des smoke (4 OK, 6 KO), journaux, rapport d'étape |
| UI.7 | dc09c21 | correctifs des 6 smoke KO (un par cause, § Smoke) |
| UI.7 | (ce commit) | second passage des 6 smoke, 12 captures, rapport, dette, décisions |

## Critères
| Id | Statut | Preuve |
|---|---|---|
| CUI-01 verify code 0 | **OK** | `docs/reports/UI-verify-correctifs.log` (après dc09c21), extrait ci-dessous |
| CUI-02 `src/sim` inchangé | **OK** | `git diff origin/claude/attack-on-titan-strategy-game-4ukom6 --stat -- src/sim` : sortie vide |
| CUI-03 tous les `smoke:*` | **KO (1 ligne)** | 9/10 OK ; `smoke:tactique` : « KO 0 erreur console » (2 erreurs de page Pixi, dette n° 20) |
| CUI-04 no-leaks | **OK** | `smoke:ux0` : « 119 écrans contrôlés ; 0 échec(s). » ; `no-leaks.test.ts` vert |
| CUI-05 pas de grille de cartes | **OK** | `smoke:p8` « tout est conforme » : contrôle « grille de cartes » sur les 9 écrans U5, 4 passes |
| CUI-06 ≥ 60 icônes | **OK** | `tests/ui/icons.test.ts` (90 icônes) |
| CUI-07 lisible 1366 et 4K | **OK** | `smoke:p8` 4 passes (1366 et 3840, 100 et 125 %) : 171 OK, 0 KO ; captures 1366 et 4K |
| CUI-08 écrans capturés et lus | **OK (12 captures)** | § Captures ; décrets, expéditions, journal, épilogue vus seulement par smoke:p8 (`p8-*.png`) |
| CUI-09 contraste AA | **OK** | `tests/ui/contrast.test.ts` |

Sortie réelle (`docs/reports/UI-verify-correctifs.log`) :
```
 Test Files  86 passed (86)
      Tests  530 passed (530)
canon:check : « data » conforme (R1–R12, 592 entrées).
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée).
✓ built in 1.76s
EXIT 0
```

## Smoke
Premier passage (`docs/reports/UI-smokes-resume.log`) : politique, expedition, p7, ux0 **OK** ; map, tactique, p5, p6,
p8, r0 KO. Second passage des six seuls KO, après dc09c21 (`docs/reports/UI-smokes2-resume.log`) :
```
smoke:map EXIT 0 (127 s)
smoke:tactique EXIT 1 (231 s)
smoke:p5 EXIT 0 (167 s)
smoke:p6 EXIT 0 (70 s)
smoke:r0 EXIT 0 (613 s)
smoke:p8 EXIT 0 (1860 s)
```
| Cause mesurée (1er passage) | Correctif (dc09c21) | Preuve (2e passage) |
|---|---|---|
| Bataille recouverte : `elementFromPoint` au centre de `.bataille-scene` → `div.exp-colonnes` du registre des expéditions (z 25 depuis UI.1) au-dessus de `.bataille` (z 22) — r0 7,3 %, tactique (clic, molette), p6 et tactique (bouton du bilan) | `.bataille` et planches plein écran à `calc(var(--z-fenetre) + 2)` (D-112) | r0 « zone de jeu 99.0 % de la scène (… canevas au premier plan 100.0 % …) » à 1366 et 4K ; tactique « sélection d'un soldat au clic (soldat:0) », « zoom à la molette (3.53 puis 3.07 px/m) » ; p6 conforme |
| map : `.bandeau__titre` en `text-transform: uppercase`, `innerText` « WALLS AND BLOOD » | `font-variant-caps: all-small-caps` | « OK langue EN : titre traduit (F-UIX-18) » |
| p8 : `kbd.touche` en police système (54 lignes) | `.touche { font-family: inherit }` | 0 ligne « polices hors projet » |
| p8 : dossier de province et options « textures sur 1 niveau » | en-têtes ombrés comme ceux des registres | « textures sur 2 niveaux » |
| p8 : humeur « tension » en paix : le contrôle du fil faisait avancer le temps | contrôle du fil sur une page à part | « humeur « calme » en paix » |
| p5 : l'entretien d'ODM (mécanique P9) est masqué depuis UX0 ; verrou attendu « N'existe pas encore » (fuite pour UX0) | étude sur les bouteilles de gaz compactes ; verrou attendu « Exige … » (D-112) | « étude lancée : Bouteilles de gaz compactes à l'étude » ; « verrou expliqué : … « Exige : … » » |

Reste KO : `smoke:tactique`, « KO  0 erreur console (pageerror: Cannot read properties of null (reading 'geometry') |
pageerror: Cannot read properties of null (reading 'clear')) ». Erreurs non interceptées de Pixi, la 1re juste après la
fermeture de la planche des figures, la 2e au début de la première bataille d'essai ; présentes aux deux passages. La phase UI
n'a touché aucun fichier de `src/ui/tactical` (`git diff 7146a98 --stat -- src/ui/tactical src/render` : seulement
`palette.ts`, deux constantes). Pas de correction tentée : dette n° 20 ; je ne sais pas si l'erreur existait avant UI.

Contrôles ajoutés en phase UI, tous OK : menu (« fond plein écran (rendu des murs au crépuscule), 4 entrées … 0 tampon ») ;
infobulle (« valeur « −2 561 / jour », 4 sous-totaux, 10 facteurs dont 9 colorés, 0 niveau au-delà du troisième ») ;
« infobulle d'un registre : « Personnages », touche C » ; « fil de notifications : 3 entrées en 3 groupe(s), 3 icônes,
3 catégories » ; « historique du fil : le journal s'ouvre » ; expedition « 1 entrée(s) avec lieu ; clic → dossier
« Maria-Est » » ; r0 « carte stratégique : zone de jeu 93.1 % » (1366) et « 96.8 % » (4K) entre les deux barres (D-108).

## Captures (12, lues une par une ; `docs/screenshots/ui-*.png`)
1. `ui-01-menu-1366` — Menu plein écran sur le chemin de ronde au crépuscule ; 4 entrées à gauche (Continuer grisé) ;
   scénarios illustrés à droite, choix de nation 854 ouvert. Défauts : titre sur deux lignes (capture antérieure à
   l'élargissement de la colonne) ; canon grossier au premier plan ; « Bac à sable — 845 » sonne technique.
2. `ui-02-menu-4k` (3840×2160) — Même menu, titre sur une ligne, panneau à droite. Défauts : fond 1920×1080 agrandi
   (flou) ; ciel vide au centre-haut ; panneau des scénarios petit à cette taille ; mention légale minuscule.
3. `ui-03-infobulle-1366` — Infobulle de la nourriture : titre et « −2561 / jour », sections et sous-totaux, facteurs
   verts ou rouges ; barre du bas regroupée. Défauts : « Variation du jour » répète les sous-totaux ; l'infobulle couvre
   la carte ; barre d'alertes presque vide (« Aucune alerte. ») ; zone droite vide au jour 1.
4. `ui-04-gestion-touche-1366` — Infobulle du bouton Personnages, « Raccourci C ». Défauts : l'infobulle recouvre le
   titre de groupe ; groupe « Recherche » d'un seul bouton ; « Bureau d'études » sous « Recherche » redondant.
5. `ui-05-personnages-1366` — Liste groupée avec portraits, fiche de Darius Zackly, touche C en tête. Défauts :
   « pragmatique » en minuscule ; vide sous les traits ; liste coupée sans signe de défilement ; `kbd` encore en police
   système (corrigé ensuite, dc09c21).
6. `ui-06-fil-1366` — Fil : groupe « Hier », entrée avec icône, catégorie « Dossier », infobulle du texte complet.
   Défauts : texte coupé à deux lignes ; infobulle qui masque la seconde entrée ; ligne de catégorie seule qui allonge.
7. `ui-07-cabinet-1366` — Salle (sièges, billes vertes et grises) à gauche ; motion « Conscription étendue », vote prévu
   6 pour, 2 abstentions, persuasion. Défauts : grand vide sous la salle ; noms des sièges petits ; « 0 or » dans le bouton.
8. `ui-08-recherche-4k` (3840×2160) — Arbre à liens (acquises, verrou, disponibles) et fiche « Bouteilles de gaz
   compactes ». Défauts : arbre petit, grand vide dessous ; noms et verrous coupés (« éclateme… ») ; onglets sur 2 lignes.
9. `ui-09-renseignement-1366` — Agents à gauche (couverture, loyauté, compétence, mission), rapports et secrets à droite.
   Défauts : colonne droite vide au départ ; moitié basse vide ; boutons « Envoyer » non alignés.
10. `ui-10-bataille-1366` — Bataille d'essai, canevas entier au-dessus du registre (correctif D-112), carnet à droite,
    escouades en bas. Défauts : carte de bataille au style papier beige (hors périmètre, R2) ; soldats en points minuscules ;
    « 1 Titan(s) ».
11. `ui-11-economie-1366` — Rationnement en tête ; ressources à gauche ; détail de la nourriture (réserve, variation,
    production, consommation, pertes, totaux). Défauts : consommation « +7800 » en rouge (signe ambigu) ; « Population »
    hors de vue sans défilement visible ; zéros redondants du niveau « Normal ».
12. `ui-12-chancellerie-1366` — Nations à blason à gauche, Hizuru choisi : axes, traité, proposition, guerre, embargo.
    Défauts : « Journal de raisonnement des nations (débogage) » visible du joueur ; « commerce » proposé alors qu'il est
    en vigueur ; grand vide sous la liste.

## Ce qui reste
1. `smoke:tactique` : erreurs Pixi `geometry` / `clear` après la fermeture de la planche des figures (dette n° 20).
2. Dette n° 19 et défauts des captures : mention « (débogage) » de la chancellerie, fond 4K du menu, textes anglais,
   légende de carte (dettes 13 et 14).
