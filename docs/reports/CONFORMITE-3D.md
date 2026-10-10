# Contrôle de conformité de la 3D (demande de l'utilisateur, 2026-10-10)

Question : « toute la 3D est-elle conforme à ce que je veux, comme énoncé dans les documents ? »
Référentiel : 138 exigences relevées (CLAUDE.md, ERRATA, 03, 04, 16 à 24, phases R1 à R3, décisions D-81 à D-165), lues dans
l'ordre de priorité de CLAUDE.md (décisions de l'utilisateur d'abord). Code contrôlé au commit `791da48`.

## Réponse courte
**Non, pas entièrement.** Les règles de fond sont tenues :
- droit d'auteur, licences, architecture ;
- corps MakeHuman, soldats au style de l'œuvre (dette n° 72), Titans à l'échelle ;
- environnements, Shiganshina et les districts de Maria.

Il reste des écarts :
- **décor de la bataille temps réel** très en dessous de la priorité « scènes réalistes et travaillées » ;
- lieux faits main limités à Shiganshina et aux districts de Maria (règle de coupe du fichier 24 §5.3) ;
- visages de Titans encore humains ;
- quelques fonctions de bataille absentes ;
- **aucune mesure sur GPU réel**.

## Verdict par thème
| Thème | Verdict | Preuves | Écarts |
|---|---|---|---|
| A. Architecture : three.js dans `tactical3d` seulement, chargé à la demande, repli 2D, vue en lecture seule | **Conforme** | `tests/lint/sim-purity.test.ts` (dans verify) ; `smoke:r3` : « bundle principal … sans three.js ni figures de R3 » ; `sim:selftest` 8 empreintes | — |
| B. Assets et licences : MakeHuman et Poly Haven seuls, 12 textures WebP 1024², aucun fichier de l'œuvre ou de fans | **Conforme** | `assets:check` : « 102 entrées, 102 fichiers ; licences, sources et empreintes conformes » ; `r1d.test.ts` (12 fichiers) ; emblèmes dessinés dans le code | — |
| C. Latence (04 §9, R1d) | **Partiel** | `mesure:r1d` (P10) : jeu à froid 2,72 s (< 8 s), scène tactique « prêt » 2,99 s (< 3 s), environnements 2,13 à 6,43 s (< 8 s) | bataille temps réel 4,5 s (> 3 s, dette n° 71) ; qualités moyenne et haute, GPU réel, mémoire < 2 Go : **jamais mesurés** (dettes n° 1, 49, 64, 73) |
| D. Environnements E01–E29 (17, R1b–R1d) | **Conforme, avec réserves** | `smoke:r1b` : 513 contrôles, 0 KO (P10) : distances ΔE, mur de 50 m, visibilité, cycle, météo, ruines | villes générées encore en damier (n° 3) ; triangle bleu du ciel (n° 5) |
| E. Lieux (20, 21 §3, 24) | **Partiel** | Shiganshina et trois districts faits main, village N2 figé ; 7 vues par porte ; `places:valider` | parement 0,50 contre 0,35, accepté (D-103) ; états 845-avant / 850-reprise ΔE 3,4 contre 6 (n° 9) ; 0,9 M triangles contre 250 000 (n° 4) ; habitants absents (n° 6) ; Trost, Mitras, Utgard (château), forêt, Liberio et le fort **non faits** (premiers sacrifiés, 24 §5.3) ; lieux non raccordés à la bataille (n° 7, D-147) |
| F. Soldats (CLAUDE.md § Style, D-163, D-165) | **Conforme pour l'essentiel** | `r3-soldats.test.ts`, `r3-poses.test.ts` (20 tests verts) ; planches `r3-uniformes`, `r3-ceremonie`, `r3-soldats` | tenues sombres de 854, équipement anti-personnel, lances de foudre, cérémonies en jeu, capuche liée à la météo, semelles (n° 72) ; ni cheval ni lames qui se brisent (hors R3-lite) |
| G. Titans (03 §5, 17 A.5, 21 §8) | **Partiel** | `smoke:r3` : 15 corps à l'échelle, hauteurs à 0,31 % près (±5 %) ; 30 corps (3 proportions × 2 peaux) ; nuque lumineuse ; vapeur ; pieds au sol à 0,26 % près | visages encore humains, calotte de cheveux (n° 63) ; Titans « réalistes » (T1) reportés en V2 (21 §6) ; Titans spéciaux (mur 50 m, Colossal 60 m, Reiss 120 m) seulement en primitives de R1b, hors bataille |
| H. Bataille 3D (18 R2, 23 §4) | **Partiel** | `smoke:r2` et `smoke:r3` : figures = état de la simulation (0 écart), niveaux de détail, foule, repères, suivi, ordres, artillerie, 0 erreur console | décor en **boîtes à toits sans façades ni matériaux de style** (nouvelle dette n° 74) ; pas de mur autour de la « Ville des Murs » (n° 55) ; ni bâtiment translucide au survol, ni icônes gaz / lames / stress (nouvelle dette n° 75) ; Titans qui traversent les bâtiments (n° 60) ; pas de météo ; aube et crépuscule partiels (n° 70) ; expéditions en 2D (n° 46) |
| I. Captures et critères visuels | **Conforme** | captures ouvertes et décrites, défauts listés (rapports R1e, R3, dette-72, ci-dessous) | — |
| J. Droit d'auteur, statut C/A/? | **Conforme** | formes d'après les descriptions ; `canon:check` : « « data » conforme (R1–R14, 845 entrées) » ; mention du menu (D-163) | — |

## Captures relues pour ce contrôle (ouvertes avec l'outil d'image)
1. **`places/shiganshina/etat-845-avant.png`** : vue d'ensemble de Shiganshina, saillie en demi-cercle contre le mur Maria, ~2 000 toits, rues rayonnantes, champs hors les murs.
   - Défauts : sol uniforme vert-brun sans relief au-delà ; brume blanche qui coupe l'horizon ; toits si petits qu'on ne distingue aucun repère (église, marché).
2. **`places/shiganshina/porte-exterieure-exterieure-face.png`** : porte extérieure à hauteur d'homme, arc de pierre, vantail de bois, deux tourelles et un treuil en haut du mur de 50 m.
   - Défauts : parement répétitif à grande échelle ; chaînes du treuil en pointillés ; raccord net entre l'herbe et le chemin.
3. **`screenshots/r3-titans.png`** : 15 Titans de 3 à 15 m, alignés par classe à côté d'un soldat de 1,7 m, deux peaux.
   - Défauts : corps lisses, presque humains ; étiquettes « b » sur une seconde ligne ; aucun mur de référence dans la planche.
4. **`screenshots/r3-visages.png`** : six têtes de Titans en gros plan (goitreux, échassier, chevelu, long cou, tête énorme, pantin).
   - Défauts : visages humains, sans dents de Titan ; cheveux en calotte à bord net ; étiquettes posées sur les torses.
5. **`screenshots/r2-suivi-1920.png`** et **`r3-bataille-paradis-1366.png`** : caméra de suivi dans une rue de la « Ville des Murs » et ligne de la Garnison.
   - Défauts : façades unies, sans fenêtres ni texture ; repères « E » à travers les murs ; aucun mur autour de la ville.

## Ce que je fais ensuite (dettes, mandat en cours)
1. Décor de bataille (n° 74) : bâtiments de la bataille habillés par les générateurs de R1b–R1d (matériaux, fenêtres, toits du profil de style), sans changer leur emprise ; c'est l'écart le plus visible.
2. Bâtiment translucide au survol et icônes au-dessus des escouades (n° 75).
3. Le reste (lieux N1 au-delà de Maria, Titans réalistes T1, météo en bataille, 854) dépasse le mandat. Ces choix relèvent de l'utilisateur ; ils sont listés ici, sans engagement.

## À faire sur ton PC (GPU réel)
- `npm run mesure:r1d -- scenes`, `R2_PARTIES=1 npm run smoke:r2` : latences en qualités moyenne et haute.
- Budget de 400 unités et 4 à 6 Titans sur RTX 3050 (23 §4). Mémoire < 2 Go (04 §9).
