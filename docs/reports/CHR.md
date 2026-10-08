# Rapport de phase CHR — chronologie complète (fichier 22 §7)

Branche `claude/v2-chr` (depuis `39a31df`). Tâches CHR.1 à CHR.5 faites ; commits `e255e1a` (CHR.1, CHR.2, CHR.5) puis le commit de CHR.3, CHR.4 et de ce rapport.
`verify` code 0 avant chaque commit de code. Sorties : `docs/reports/CHR-verify-1.log` (premier commit), `CHR-verify.log` (second).

## CHR.1 — couverture des 60 événements du fichier 12 (CCHR-03)
Les 60 sont présents (60/60 par code E01 à E60) ; **aucun n'était absent** : ce qui manquait, c'étaient les 20 squelettes sans résumé,
sans thème et jamais montrés au joueur. Ajouts : thème (politique, militaire, Titans, famille, monde), année approximative (`date_approx`),
résumé de chaque squelette (`evt.*.body`), E03 caché jusqu'à la chapelle Reiss (`known_after`). Dates : années seules, aucune date inventée.

| Bloc du fichier 12 | Présents | Jouables (choix, effets) | Texte seul |
|---|---|---|---|
| A. Chute de Maria et conséquences (845–847) | 8/8 | 0 | E01, E02, E03, E04, E05, E06, E07, E08 |
| B. Trost (850) | 7/7 | 7 | — |
| C. Expédition 57 et Stohess (850) | 8/8 | 8 | — |
| D. Invasion de Wall Rose (850) | 6/6 | 6 | — |
| E. Gouvernement royal et coup d'État (850) | 8/8 | 8 | — |
| F. Retour à Shiganshina (850) et ouverture | 8/8 | 5 | E43, E44, E45 |
| G. Années de transition (851–853) | 7/7 | 0 | E46, E47, E48, E49, E50, E51, E52 |
| H. Guerre et Grondement (854) | 8/8 | 6 | E59, E60 |
| **Total** | **60/60** | **40** | **20** |

Autres entrées : `evt_850_marley_antititan_rifle` (`?`, hors des 60, errata Q1), 30 génériques à décision, **94 faits de fond** (nouveau). Les 20 textes seuls
restent tels (hors-périmètre ; dette n° 29) : ils figurent sur la frise et suivent le récit (D-120).

## CHR.2 — événements de fond (CCHR-04)
`data/events/fond.json` : 94 entrées `canon: "A"`, sans choix, sans personnage nommé, sans anachronisme (test), 7 familles de la vie du royaume
(politique, cabinet, famille, rumeurs, récoltes et saisons, incidents du mur, casernes). Tirage : `fondDays` (3 à 4 jours par mois, une tranche chacun),
un événement de l'époque non repris depuis 360 jours, famille différente de la précédente ; 3 faits datés du premier jour. **Modification de `src/sim` :
`events/engine.ts` (additive, D-118) et `strategic/world.ts` (+ `fond`)** ; sans `fond` dans l'équilibrage rien ne change ; le tirage des génériques
est inchangé (test). `sim:year` (`docs/reports/CHR-sim-year.log`) :
```
sim:year : scn_sandbox_845 … fond : pas de couche d'événements dans ce scénario (bac à sable économique)
sim:year : scn_sandbox_850 … fond : 43 événements en 12 mois (3, 4, 4, 4, 3, 4, 3, 3, 3, 4, 4, 4 par mois), moyenne 3.58, 43 textes distincts, 97 autres entrées de chronique
sim:year : OK.   EXIT 0
```
Le bac à sable 845 n'a pas de couche d'événements (D-121, dette n° 28) : CCHR-04 est mesuré en 850 (et 854 par `tests/sim/fond.test.ts`).

## CHR.3 — frise « Chronologie » · CHR.4 — dossiers
`src/ui/timeline.ts` (modèle pur) et `src/ui/panels/chroniclePanel.ts` : axe 845 à 854+ (un repère par événement : plein = survenu, vert = en cours,
pointillé = annoncé, barré = évité, liseré ambre = écart au récit connu), liste par année, fiche (date, statut, résumé, écart, décision, effets),
filtre par thème, onglet « Vie du royaume » (faits de fond). Annonces selon le renseignement (D-120) ; rien d'annoncé sans renseignement.
Dossiers (`eventDossier.ts`, `eventArt.ts`) : illustration d'archétype (5 vignettes au trait), trois effets sous chaque choix, **infobulle listant tous les effets**
(signe de gain ou de coût) et ce que le choix engage. Aucun statut canon, code ou identifiant à l'écran (E-UX-1).

## Critères
| Id | Statut | Preuve |
|---|---|---|
| CCHR-01 `verify` | **OK** | `Test Files 92 passed (92)`, `Tests 587 passed (587)`, `EXIT 0` (`CHR-verify.log`) |
| CCHR-02 `canon:check` | **OK** | `canon:check : « data » conforme (R1–R12, 686 entrées).` |
| CCHR-03 60 couverts | **OK** | `tests/data/events-coverage.test.ts` 6/6 ; échoue si un code manque (test négatif inclus) |
| CCHR-04 ≥ 3 par mois | **OK en 850** (43 en 12 mois, minimum 3) ; 845 sans événements (dette n° 28) | `CHR-sim-year.log`, `tests/sim/fond.test.ts` 9/9 |
| CCHR-05 déterminisme | **OK** | `sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée).` |
| CCHR-06 frise capturée et lue | **OK** (§ captures) | `docs/screenshots/chr-*.png` |
Smoke : `smoke:chr` OK (`CHR-smoke-chr.log`, 20 contrôles, 0 KO) ; `smoke:ux0` « 137 écrans contrôlés ; 0 échec(s). » ; `smoke:p5` « tout est conforme. ».
Tests ajoutés : `events-coverage` (6), `fond` (9), `timeline` (10), `event-art` (2).

## Captures (5 sur 12 permises ; chacune ouverte avec l'outil d'image)
1. `chr-frise-850.png` (1366×768, 850 jour 118). Vu : frise 845–854 aux repères pleins, trois pointillés (annoncés) et un vert (en cours) à la fin de 850 ; liste « An 845 » cochée ; fiche « Titans dans Wall Rose », en cours, avec son bouton de dossier.
   Défauts : « Renseignement : certitudes » trop généreux à 118 jours (dette n° 30) ; fiche coupée en bas (défilement) ; « Des officiers nommés seront exposés » reste au futur.
2. `chr-quotidien-850.png` (onglet « Vie du royaume »). Vu : liste des faits récents (Retour d'un fils, Tir d'entraînement…), fiche « Retour d'un fils », effet « Moral +1 ». Défauts :
   « revient à Camp d'entraînement » (nom de province inséré tel quel) ; liste sans séparation par mois ; zone de fiche à moitié vide.
3. `chr-frise-854-1366.png` (854 après 300 jours). Vu : 60 repères, 854 surligné avec deux verts (en cours), liste par année, fiche « Contre-attaque de Marley à Shiganshina », conforme.
   Défauts : 37 repères tassés sous 850 (0,5 rem chacun, peu cliquables) ; années 847–849 presque vides ; 1re ligne de la liste « Brèche de Shiganshina » alors que l'événement est antérieur au jeu (affiché « survenu »).
4. `chr-frise-854-4k.png` (3840×2160). Vu : même écran, panneau en haut à gauche, fond de carte sombre, fil et calques à droite. Défauts : panneau étroit (largeur en rem) avec 60 % de l'écran vide ;
   liste longue sans repère de position ; marqueurs minuscules en 4K.
5. `chr-dossier.png` (850, dossier générique ouvert). Vu : illustration « foyer » (maison, cheminée), corps, effets, deux choix, infobulle « Tous les effets » du second choix avec « Satisfaction : Noblesse des murs −1 » et la règle de décision libre.
   Défauts : « sous 0 jours » dans l'intitulé alors que le choix s'applique demain ; illustration petite et décorative ; infobulle recouvre le bas du dossier.

## Modifications de `src/sim`
`src/sim/events/engine.ts` (fondDays, fondTick, seedBackstory, plafond de chronique 800) et `src/sim/strategic/world.ts` (`ChronicleWorld.fond`) : additives, déterministes (graine et jour, aucun `Math.random`/`Date.now`), sans `any`, testées ; `sim:selftest` code 0. Décision D-118.

## Passe de revue (D-122)
Faits de fond actifs par défaut (`data/balance/events.json`), à effets économiques : 5 scénarios du selftest sur 7 changent d'empreinte (« sans monde » et bac à sable 845 identiques ; valeurs dans D-122). Anciennes sauvegardes : chargées, mais elles recevront des faits de fond ; plafond de chronique 800 : change l'empreinte au-delà de 200 entrées. Réversible (retirer `fond`).
Correctifs : (1) spoiler : fiche d'un événement en cours ou annoncé sans résumé d'issue ni effets, accroche neutre, test ajouté ; (2) famille « titans » sans `subject: province`, sans effet de province, textes sans nom de province, « revient à / familles de {province} » reformulés ; (3) « Décision attendue (aujourd'hui) » au lieu de « sous 0 jours ». Capture 1 (fiche « en cours ») et 5 (« sous 0 jours ») : défauts corrigés, non refaites. Capture 2 : défaut « revient à Camp d'entraînement » corrigé.
Non corrigé : autres textes « à {province} » avec un nom de lieu non urbain (cosmétique).
Verify de la passe (`CHR-verify-revue.log`) : `Test Files  92 passed (92)`, `Tests  588 passed (588)`, `EXIT 0`.

## Dettes ouvertes
n° 28 à 32 (`docs/reports/dette.md`). Décisions : D-118 à D-121.
