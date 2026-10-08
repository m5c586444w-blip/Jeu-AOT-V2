# Phase UI — interface de jeu de stratégie moderne

Source : `docs/spec/22_PLAN_V2_EXPERIENCE_DE_JEU.md` §5 (principes U1 à U11), `ERRATA_UX.md` (prime sur le fichier 04),
fichier 24 §2.4 et §4. Branche `claude/v2-ui`. Plafond : 280 tours. Arrêt de revue en fin de phase.

## Tâches (un commit par tâche, `npm run verify` avant chaque commit)
| Tâche | Contenu | Livrables |
|---|---|---|
| UI.1 | Jetons de style, composants de base, page de contrôle | `src/ui/styles/tokens.css` (seule source de couleurs), `components.css`, `base.css`, `screen.css` refaites en thème sombre ; `src/ui/kit.ts` ; `/ui-kit.html` (développement seulement) ; portraits peints (U7) ; tests `tokens`, `contrast` |
| UI.2 | Jeu d'icônes dessinées (U6) | `src/ui/icons.ts` : ≥ 60 icônes SVG sur grille 24 px, trait 1,6, deux tailles ; section de `/ui-kit.html` ; test `icons` |
| UI.3 | Barre supérieure, alertes, menu de gestion, panneaux latéraux (U2) | barre : date, vitesse, pause, 8 valeurs clés avec variation ; barre d'alertes ; menu de gestion en bas, regroupé (Gouvernement, Armée, Recherche, Renseignement, Diplomatie, Monde), icône + étiquette ; dossier de province à gauche ; fil de notifications à droite |
| UI.4 | Écrans maître-détail (U5) | personnages, cabinet, recherche (arbre à liens), renseignement, expéditions, chancellerie, législation, économie (nouvel écran), journal |
| UI.5 | Menu principal, choix de nation, épilogue (U8) | plein écran, murs au crépuscule (rendu de la scène 3D existante), 4 entrées, scénarios à droite |
| UI.6 | Notifications (U9), infobulles de calcul (U4) | fil trié et regroupé, clic = lieu ; infobulles à trois niveaux, bonus et malus colorés, raccourcis (U10) |
| UI.7 | Contrôles et revue | tous les `smoke:*`, no-leaks, 12 captures lues, rapport `docs/reports/UI.md` |

## Critères d'acceptation et commandes
| Id | Critère | Commande / preuve |
|---|---|---|
| CUI-01 | verify code 0 | `npm run verify` |
| CUI-02 | `src/sim` inchangé | `git diff origin/claude/attack-on-titan-strategy-game-4ukom6 --stat -- src/sim` vide |
| CUI-03 | tous les `smoke:*` OK | `npm run smoke:map`, `smoke:politique`, `smoke:expedition`, `smoke:tactique`, `smoke:p5` à `smoke:p8`, `smoke:r0`, `smoke:ux0` (et `smoke:r1`, `smoke:r1b` : 3D, hors périmètre, relancés si le temps le permet) |
| CUI-04 | no-leaks vert | `npx vitest run tests/ui/no-leaks.test.ts` et `npm run smoke:ux0` |
| CUI-05 | aucun écran de la liste en grille de cartes identiques | `smoke:p8` : contrôle « grille de cartes » sur chaque écran de la liste |
| CUI-06 | ≥ 60 icônes | `npx vitest run tests/ui/icons.test.ts` |
| CUI-07 | lisible à 1366×768 et 3840×2160 | `smoke:p8` (quatre passes : débordement, texte coupé, corps minimal) ; captures 1366 et 4K |
| CUI-08 | chaque écran capturé et lu (3 lignes, 3 défauts) | `docs/screenshots/ui-*.png` (12 au plus), rapport § captures |
| CUI-09 | contrastes AA | `npx vitest run tests/ui/contrast.test.ts` |

## Hors périmètre
- Carte (rendu Pixi, terrain, calques) : phase MAP ; seules la légende et la position du panneau « Calques » changent ici
  (dettes n° 13 et 14 reprises si simple).
- Musique et sons : phase AUD. Scène 3D et bataille 3D : R2. Frise chronologique : CHR.
- Aucune règle de simulation (`src/sim` inchangé), aucun nouvel outil de mesure, aucun asset externe nouveau.
- Les contrôles automatiques existants qui vérifiaient l'ancien habillage papier (« tampon », « tiroir », « textures »)
  sont adaptés à la nouvelle structure, sans être affaiblis.
