# Rapport de phase UI — refonte de l'interface (fichier 22 §5)

Branche `claude/v2-ui` (depuis `7146a98`). Tâches UI.1 à UI.6 faites, un commit chacune, `verify` code 0 avant chaque commit.
UI.7 (passage des `smoke:*`) **incomplet** : 4 smoke OK, 6 KO ; causes mesurées ci-dessous, corrections non faites
(arrêt demandé par la direction à 10 h 30 UTC). Phase **en revue**, pas terminée.

## Commits
| Tâche | Commit | Contenu |
|---|---|---|
| UI.1 | f50f61a | jetons de style (`tokens.css` seule source de couleurs), composants, `/ui-kit.html`, portraits peints |
| UI.2 | 3e3616b | 90 icônes SVG dessinées (`src/ui/icons.ts`), blasons, test `icons` |
| UI.3 | 77ba299 | barre supérieure (6 ressources + variation), alertes, menu de gestion en bas regroupé, fil de notifications, écran Économie |
| UI.4 | f73769b | écrans maître-détail : personnages, cabinet, arbre de recherche, renseignement, expéditions, chancellerie, décrets, journal |
| UI.5 | 35efdec | menu principal plein écran (rendu 3D des murs au crépuscule), 4 entrées, scénarios illustrés, épilogue |
| UI.6 | 5713f29 | infobulles de calcul à 3 niveaux (`whyModel`), raccourcis dans les infobulles, fil (icône, catégorie, lieu) |
| UI.7 | (ce commit) | journaux des smoke, 6 captures, ce rapport, dette, décisions D-108 à D-111 |

## Critères
| Id | Statut | Preuve |
|---|---|---|
| CUI-01 verify code 0 | **OK** | `docs/reports/UI-verify.log` (après UI.6) : extrait ci-dessous |
| CUI-02 `src/sim` inchangé | **OK** | `git diff origin/claude/attack-on-titan-strategy-game-4ukom6 --stat -- src/sim` : sortie vide |
| CUI-03 tous les `smoke:*` | **KO** | 4 OK (politique, expedition, p7, ux0), 6 KO (map, tactique, p5, p6, p8, r0) ; § Smoke |
| CUI-04 no-leaks | **OK** | `smoke:ux0` : « 119 écrans contrôlés ; 0 échec(s). » ; `tests/ui/no-leaks.test.ts` vert dans verify |
| CUI-05 pas de grille de cartes | **OK sur le contrôle** | smoke:p8, 4 passes : aucun problème « grille de cartes » sur les 9 écrans U5 ; les lignes de ces écrans sont KO pour une autre cause (police du `kbd`, § Smoke) |
| CUI-06 ≥ 60 icônes | **OK** | `tests/ui/icons.test.ts` (90 icônes) vert |
| CUI-07 lisible 1366 et 4K | **KO partiel** | smoke:p8 : débordement, texte coupé et corps minimal sans problème signalé ; KO : `kbd.touche` en police système (54 lignes), « textures sur 1 niveau » (dossier de province, options) |
| CUI-08 écrans capturés et lus | **KO partiel** | 6 captures lues (§ Captures) ; manquent cabinet, recherche, renseignement, expéditions, chancellerie, décrets, économie, journal, épilogue |
| CUI-09 contraste AA | **OK** | `tests/ui/contrast.test.ts` vert |

Sortie réelle (`docs/reports/UI-verify.log`) :
```
 Test Files  86 passed (86)
      Tests  530 passed (530)
assets:check : 102 entrées, 102 fichiers ; licences, sources et empreintes conformes.
canon:check : « data » conforme (R1–R12, 592 entrées).
sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée).
✓ built in 1.87s
EXIT 0
```
Contrôle ciblé après coup : `npx vitest run tests/ui/no-leaks.test.ts tests/ui/icons.test.ts tests/ui/contrast.test.ts tests/ui/why.test.ts`
→ `Test Files  4 passed (4)` / `Tests  19 passed (19)`.

## Smoke (un seul passage, journaux `docs/reports/UI-smoke-*.log`)
```
smoke:map EXIT 1 (140 s)
smoke:politique EXIT 0 (162 s)
smoke:expedition EXIT 0 (110 s)
smoke:tactique EXIT 1 (178 s)
smoke:p5 EXIT 1 (144 s)
smoke:p6 EXIT 1 (104 s)
smoke:p7 EXIT 0 (102 s)
smoke:p8 EXIT 1 (1841 s)
smoke:r0 EXIT 1 (637 s)
smoke:ux0 EXIT 0 (610 s)
```
Contrôles ajoutés en phase UI, tous OK : menu (« fond plein écran (rendu des murs au crépuscule), 4 entrées (Nouvelle partie,
Continuer, Options, Quitter), 3 scénarios illustrés, 0 tampon ») ; infobulle (« valeur « −2 561 / jour », 4 sous-totaux,
10 facteurs dont 9 colorés, 0 niveau au-delà du troisième ») ; « infobulle d'un registre : « Personnages », touche C » ;
fil (« 1 entrées en 1 groupe(s), 1 icônes, 1 catégories ») ; « historique du fil : le journal s'ouvre » ;
smoke:expedition « fil de notifications : 1 entrée(s) avec lieu ; clic → dossier « Maria-Est » » ;
smoke:r0 « carte stratégique : zone de jeu 93.1 % » (1366) et « 96.8 % » (4K) entre les deux barres (D-108).

Échecs et causes **mesurées** (aucune correction faite, aucun second passage) :
| Smoke | Sortie | Cause |
|---|---|---|
| map | `KO  langue EN : titre traduit (F-UIX-18)` | `.bandeau__titre` en `text-transform: uppercase` (UI.3) : `innerText` rend « WALLS AND BLOOD ». Correctif d'une ligne : `font-variant-caps: all-small-caps` |
| p8 | `smoke:p8 : ÉCHEC (66)` | 54 lignes « polices hors projet : kbd.touche (monospace) » : le `kbd` de la tête de registre (UI.6) garde la police système ; correctif : `.touche { font-family: inherit }`. 8 lignes « textures sur 1 niveau(x) » (dossier de province, options), toutes passes. 4 lignes « audio : humeur « tension » en paix » : le contrôle du fil ajouté en UI.6 fait avancer le temps à la vitesse 5 avant le contrôle audio (à déplacer après, ou recharger la page) |
| r0 | `KO  3. bataille : zone de jeu 7.3 % de la scène (… canevas au premier plan 7.4 % …)` (33,5 % en 4K) | un élément recouvre le canevas de bataille ; non identifié (hypothèse non vérifiée : barre de gestion, fil ou carte placés par la nouvelle grille `.ecran` au-dessus de `.bataille`) |
| tactique | `KO  sélection d'un soldat au clic (aucune)` ; `KO  caméra : zoom à la molette (3.07 puis 3.07 px/m)` ; puis `Timeout` sur `.bilan [data-action="valider"]` (« waiting for element to be visible, enabled and stable ») | même symptôme que r0 : clics et molette n'atteignent pas le canevas ; le bouton du bilan est trouvé mais jamais cliquable |
| p6 | `Timeout` sur `.bilan [data-action="valider"]` (même message) | même cause que tactique |
| p5 | `Timeout` : `waiting for locator('.planche[data-tech='tech_odm_maintenance'] [data-action='etudier']')` | arbre de recherche refait en UI.4 : le bouton « étudier » de ce nœud n'est pas trouvé (sélecteur ou nœud non rendu ; non établi) |

## Captures (lues une par une ; `docs/screenshots/ui-*.png`)
1. `ui-01-menu-1366.png` (1366×768) — Menu plein écran : chemin de ronde de Shiganshina au crépuscule, titre et 4 entrées à
   gauche (Continuer grisé), panneau « Scénarios » à droite avec 3 vignettes tirées du rendu, choix de nation 854 ouvert.
   Défauts : titre sur deux lignes (capture prise avant l'élargissement de la colonne fait dans UI.5) ; canon du premier plan
   grossier ; « Bac à sable — 845 » sonne technique ; ligne Paradis surlignée par le survol.
2. `ui-02-menu-4k.png` (3840×2160) — Même menu en 4K, titre sur une ligne, panneau de scénarios à droite, entrées lisibles.
   Défauts : fond 1920×1080 agrandi (flou) ; grand vide de ciel au centre-haut ; panneau des scénarios petit à cette taille ;
   mention légale en très petit.
3. `ui-03-infobulle-1366.png` — Infobulle de la nourriture : titre et « −2561 / jour », sections Variation, Production,
   Consommation, Pertes avec sous-totaux, facteurs en vert ou rouge ; barre du bas regroupée, calques à droite.
   Défauts : la section « Variation du jour » répète les sous-totaux suivants ; l'infobulle couvre la carte ; « Aucune
   alerte. » laisse la barre d'alertes presque vide ; fil absent au jour 1 (zone droite vide).
4. `ui-04-gestion-touche-1366.png` — Infobulle du bouton Personnages : « Personnages », « Raccourci C » ; bouton survolé
   dans le groupe Gouvernement. Défauts : l'infobulle déborde au-dessus du titre de groupe ; groupe « Recherche » d'un seul
   bouton ; libellés « Bureau d'études » et « Recherche » redondants.
5. `ui-05-personnages-1366.png` — Registre Personnages maître-détail : onglets Vivants/Morts/Tous, liste groupée (Cabinet,
   Corps de Reconnaissance) avec portraits, fiche de Darius Zackly à droite, touche C en tête avec son infobulle.
   Défauts : « Programme : pragmatique » en minuscule ; colonne Traits avec grand vide sous Programme ; liste coupée en bas
   sans indication de défilement ; `kbd` en police système (cause du KO de smoke:p8).
6. `ui-06-fil-1366.png` — Fil de notifications à droite : groupe « Hier », entrée « Remise des diplômes… » avec icône,
   catégorie « Dossier », infobulle du texte complet. Défauts : texte coupé à deux lignes ; infobulle qui masque la seconde
   entrée ; ligne de catégorie seule (pas de lieu) qui allonge l'entrée.

## Ce qui reste (prochaine session)
1. Correctifs d'une ligne : `.bandeau__titre` (petites capitales), `.touche { font-family: inherit }`, contrôle du fil de
   smoke:p8 après le contrôle audio.
2. Identifier l'élément au-dessus du canevas de bataille (`document.elementFromPoint` au centre de `.bataille-scene`) et le
   corriger : débloque r0, tactique et p6 (probablement une seule cause).
3. smoke:p5 : aligner le sélecteur `.planche[data-tech] [data-action=etudier]` sur l'arbre d'UI.4.
4. « Textures sur 1 niveau » du dossier de province et des options (smoke:p8).
5. Relancer les seuls smoke KO, puis compléter les captures (12 au plus) et CUI-08.
