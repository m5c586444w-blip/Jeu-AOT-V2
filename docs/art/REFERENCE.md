# Fiche de proportions des figures (R3)

Source des valeurs : `data/art/titans.json` (classes de R1b) et `data/art/figures_r3.json` (corps de R3). **Tout est un choix de
design du projet (`A`)** : aucune mesure ni forme n'est tirée de l'œuvre ; aucun Titan, uniforme ni emblème n'est reproduit (D-83).
Les hauteurs de classe reprennent les bornes des types de Titans du jeu (`data/titans/classes.json` : petit 3–5 m, moyen 6–9 m,
grand 10–15 m). Titans spéciaux (inchangés depuis R1c) : Titan-Mur ≈ 50 m (buste), Titan de Rod Reiss ≈ 120 m (allongé),
Colossal 60 m (vapeur permanente).

## Titans : 5 classes × 3 corps × 2 peaux
Fractions de la hauteur debout : jambes / torse / cou / tête (somme 1), demi-carrure, ventre ; voussure (rad). Posture (rad) :
`lean` buste penché, `drop` épaule tombante (> 0 gauche), `armOut` bras écartés g/d, `kneeBend` genoux pliés, `headRoll` tête de
travers. Démarche : `limp` boiterie (jambe gauche), `sway` roulis, `drag` bras droit traînant, `jerk` cadence heurtée ; chaque
individu y ajoute un tirage de sa graine (boiterie 0–0,25, à-coups 0,05–0,3, cadence ×0,85–1,15). Dents (×) ; yeux g/d (×).
La hauteur debout est mesurée sur la peau, posture comprise, et le corps est remis à l'échelle de sa classe.

| Classe | Corps | Jambes / torse / cou / tête | Carrure | Ventre | Voussure | Expression | Posture | Démarche | Dents ; yeux | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 m | a — Nabot à grosse tête, de travers | 0,33 / 0,39 / 0,03 / 0,25 | 0,15 | 0,14 | 0,22 | rictus | armOut 0,35/0,05, headRoll -0,20, lean -0,12 | — | 1,00 ; 1,00/1,00 | A |
| 3 m | b — Goitreux aux bras traînants | 0,30 / 0,39 / 0,03 / 0,28 | 0,15 | 0,14 | 0,42 | beant | lean 0,20, headRoll 0,25, kneeBend 0,25 | limp 0,50, drag 0,60 | 1,40 ; 1,15/0,90 | A |
| 3 m | c — Efflanqué | 0,39 / 0,35 / 0,06 / 0,20 | 0,12 | 0,00 | 0,22 | neutre | drop 0,25, armOut 0,25/0,00 | sway 0,10, jerk 0,50 | 1,00 ; 1,00/1,12 | A |
| 5 m | a — Trapu voûté, genoux pliés | 0,35 / 0,38 / 0,04 / 0,23 | 0,15 | 0,13 | 0,20 | rictus | kneeBend 0,35, lean 0,10, armOut 0,12/0,12 | sway 0,06 | 1,00 ; 1,00/1,00 | A |
| 5 m | b — Large d'épaules | 0,36 / 0,41 / 0,02 / 0,20 | 0,20 | 0,13 | 0,35 | neutre | armOut 0,35/0,35, kneeBend 0,20 | sway 0,12, limp 0,20 | 1,25 ; 1,00/1,00 | A |
| 5 m | c — Échassier ventru | 0,47 / 0,31 / 0,04 / 0,18 | 0,15 | 0,16 | 0,20 | beant | headRoll -0,30, lean -0,10 | limp 0,30, jerk 0,60 | 1,00 ; 0,90/1,10 | A |
| 8 m | a — Chevelu au regard fixe | 0,43 / 0,33 / 0,06 / 0,18 | 0,12 | 0,06 | 0,15 | neutre | — | — | 1,00 ; 1,00/1,00 | A |
| 8 m | b — Obèse | 0,39 / 0,36 / 0,04 / 0,21 | 0,12 | 0,16 | 0,15 | rictus | lean 0,08, armOut 0,30/0,30 | sway 0,15 | 1,30 ; 1,00/1,00 | A |
| 8 m | c — Long cou, tête basse | 0,43 / 0,31 / 0,11 / 0,15 | 0,12 | 0,06 | 0,50 | beant | drop 0,30, headRoll 0,20 | drag 0,80, limp 0,40 | 1,00 ; 1,20/1,00 | A |
| 12 m | a — Grand au rictus | 0,47 / 0,31 / 0,07 / 0,14 | 0,11 | 0,02 | 0,12 | rictus | — | — | 1,00 ; 1,00/1,00 | A |
| 12 m | b — Tête énorme | 0,42 / 0,30 / 0,07 / 0,21 | 0,13 | 0,02 | 0,12 | beant | headRoll 0,35, kneeBend 0,15 | jerk 0,50, limp 0,20 | 1,50 ; 1,00/1,00 | A |
| 12 m | c — Bossu | 0,45 / 0,33 / 0,07 / 0,14 | 0,14 | 0,07 | 0,57 | neutre | armOut 0,00/0,45, drop -0,25, lean -0,15 | limp 0,70, sway 0,12 | 1,00 ; 0,85/1,20 | A |
| 15 m | a — Filiforme béant, épaule basse | 0,50 / 0,29 / 0,09 / 0,12 | 0,10 | 0,00 | 0,10 | beant | headRoll 0,20, armOut 0,12/0,30, drop 0,15 | drag 0,40 | 1,00 ; 1,00/1,00 | A |
| 15 m | b — Massif | 0,47 / 0,33 / 0,04 / 0,15 | 0,14 | 0,00 | 0,10 | rictus | armOut 0,20/0,20 | sway 0,08 | 1,30 ; 1,00/1,00 | A |
| 15 m | c — Pantin désarticulé | 0,54 / 0,26 / 0,09 / 0,12 | 0,10 | 0,00 | 0,10 | creuse | lean 0,30, headRoll -0,45, drop 0,30, armOut 0,50/-0,05, kneeBend 0,15 | jerk 0,80, drag 0,50 | 1,00 ; 1,00/1,00 | A |

Peaux (deux par taille, même corps) : **pâle et marbrée** (teinte #C7B9AC mêlée à 55 %, veines bleutées, dents #C9BE9A) ;
**rougeaude et tachée** (#C27D66 à 45 %, plaques rougeâtres, dents #B8A578). Statut `A`.
Expressions : rictus (coins de bouche tirés, lèvres retroussées), béant (bouche ouverte, yeux exorbités), neutre (regard fixe),
creuse (orbites sombres) : jamais tous souriants. Marque rouge de la nuque : repère de lisibilité du point faible (03 §4.2).

## Soldats : 5 tenues (`A`)
| Tenue | Camp | Silhouette et accessoires |
|---|---|---|
| Bataillon d'exploration | Paradis | veste gris pierre, pantalon sombre, **cape verte** (10 E-P11), équipement tridimensionnel, lames en main |
| Garnison | Paradis | veste gris bleuté, **écharpe rouge** à la taille, sans cape, **fusil à l'épaule**, lames au fourreau |
| Police militaire | Paradis | **manteau long** sombre, **képi**, pantalon clair, équipement tridimensionnel, lames au fourreau |
| Infanterie de Marley | Marley | **casque**, vareuse olive, **bandes molletières**, **sac**, **fusil à baïonnette** en main, sans équipement tridimensionnel |
| Officier de Marley | Marley | **casquette** à bandeau, **manteau long**, **baudrier**, **étui de pistolet**, bottes |

Taille : 1,7 m au banc (R1b) ; en jeu, tirée de la graine (1,58–1,86 m). Corpulence par tenue : `data/art/figures_r3.json`.
Emblèmes : aucun (04 §113 : redessinés seulement ; non faits en R3).
