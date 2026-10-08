# Rapport AUD — musique et sons

Branche `claude/v2-aud` (depuis d12a8d2). Règle : l'écoute revient à Gabriel ; ce rapport ne contient que du mesuré.
Réseau : les domaines de musique sont refusés (403 du proxy) : aucun enregistrement téléchargé (D-114).

## 1. Diagnostic de l'audio d'avant AUD (CAUD-02)

Code lu : `src/ui/audio.ts` (608 lignes, état d12a8d2). Mesures : `scoreBar(humeur, "paradis", 0..7)` sur 8 mesures,
tempo de chaque humeur, notes en dessous de mi3 (MIDI < 52).

| Cause | Preuve (ligne) | Mesure |
|---|---|---|
| Bourdon grave continu | l.110 : `orgue` en ré2 (MIDI 38, 73 Hz), `dur: 8` temps, une mesure sur deux ; onde carrée filtrée à 900 Hz (l.387-393) | humeur calme : note la plus longue sous mi3 = **8,0 s**, couverture du grave **100 %** du temps ; tension : 6,0 s, 100 % ; combat : 0,5 s, 60 % |
| Pouls grave de la tension | l.116 : `pulse` sinus en ré2, 4 coups par mesure, `lowpass 300` (l.431) | un battement grave à chaque temps, 80 par minute |
| Couche calme qui persiste sous les autres | l.63-64 : `layerTargets` garde calme à 0,3 sous la tension et tension à 0,45 sous le combat | le bourdon de l.110 continue pendant tension et combat |
| Harmonie sombre et tendue | l.94-99 : ré mineur / si♭ / fa / do ; tension en **mi♭ phrygien** (l.97, mi♭-si♭-mi♭-sol puis mi♭-sol-mi♭-fa♯) ; combat finit sur la majeur sur fond de ré mineur (l.99) | accord de l.97 (4e) : sol3 sous fa♯4 = neuvième mineure composée ; commentaire du code : « l'inquiétude » |
| Aucun silence | l.109, 118, 130 : cordes `dur: 4` = la mesure entière ; l.321-330 : mesures plantées l'une après l'autre sans pause | **0,00 s** de silence sur 8 mesures, dans les trois humeurs |
| Boucles courtes | l.93-99 : 4 accords ; l.322-328 : 4 mesures | boucle de **16,0 s** (calme), **12,0 s** (tension), **8,1 s** (combat) |
| Tempo et pulsation | l.90 : 60 / 80 / 118 battements par minute ; l.124 : timbales sur 0, 1,5, 2 et 3 (sinus 110 → 48 Hz, l.414-418) | timbales à 48 Hz et caisse sans mélodie : aucun thème, aucun « peps » |
| Cuivres hors du cadre | l.127-128 : cuivres en quintes de fanfare, en dents de scie filtrés 500 → 2600 Hz (l.394-403) | seulement en combat : conforme à E-UX-4, mais sans marche ni mélodie |
| Volume | `src/ui/settings.ts` l.20 : `volMaster: 70, volMusic: 60` | gain de musique par défaut 0,70 × 0,60 = **0,42** (> 0,35) |
| Effets graves | l.496-500 `pas_titan` sinus 52 → 28 Hz (0,55 de gain) toutes les 0,45 s ; l.544-551 `transformation` 90 → 30 Hz sur 1,8 s | sous-grave répété en bataille |
| Aucun réglage fin | `Volumes` (l.26-31) : général, musique, effets seulement | pas d'ambiances, pas de volume d'interface, pas de « musique en combat seulement », pas de pistes de l'utilisateur |

Conclusion : l'oppression venait d'un bourdon grave sans interruption, d'un mode sombre aux couleurs phrygiennes, d'une boucle de
8 à 16 s sans silence ni mélodie, et d'un volume par défaut de 0,42.

## 2. Réseau refusé et conséquence (D-114)

Le réseau du cloud refuse commons.wikimedia.org, upload.wikimedia.org, archive.org, musopen.org, freepd.com, marineband.marines.mil
(« CONNECT tunnel failed, response 403 », politique du proxy). Rien n'a été contourné ni téléchargé : la musique est **synthétisée**
(WebAudio) à partir de partitions transcrites dans le code. **Domaines à autoriser** pour une phase future d'enregistrements libres :
`commons.wikimedia.org`, `upload.wikimedia.org`, `archive.org` et `*.archive.org`, `musopen.org`, `freepd.com`, `marineband.marines.mil`.
**Procédure de dépôt** (Gabriel) : copier des fichiers `.mp3` ou `.ogg` dans `assets_user/musique/` (hors dépôt, `.gitignore`), relancer le jeu
(`npm run dev` ; version construite : `npm run build`), puis Options > Musique : source (pièces du jeu, mixte, pistes personnelles seulement)
et état de chaque piste (paix, guerre, combat, écartée). Préfixes `calme-`, `tension-`, `combat-` pour l'état proposé. Notice : `assets_user/musique/LISEZ-MOI.md`.

## 3. Pièces retenues (11 ; durées mesurées par `renderCached`)

| Pièce | Origine | États (tempo, durée) |
|---|---|---|
| `ode_joie` Ode à la joie | Beethoven 1824, thème transcrit de mémoire | calme 104 bpm 102 s ; tension (en marche) 108 bpm 98 s |
| `menuet_sol` Menuet en sol | Petzold vers 1725 | calme 112 bpm 64 s |
| `petite_musique` Petite musique de nuit | Mozart, K. 525 (1787, publiée 1827), 4 mesures + suite du projet | calme 126 bpm 61 s |
| `andante_haydn` Andante en do | Haydn 1791, sans l'accord fort | calme 100 bpm 58 s |
| `rondo_turque` Rondo à la turque | Mozart 1784, thème + épisode du projet | tension 108 bpm 71 s ; combat 130 bpm 59 s |
| `aube_remparts`, `canon_matin` | originales (salon classique) | calme 96 bpm 80 s ; 92 bpm 83 s |
| `marche_garnison`, `marche_bataillons` | originales (forme de marche à la Sousa) | tension 104/100 bpm, 97/79 s ; combat 124/126 bpm, 81/63 s |
| `galop_eclaireurs`, `marche_legion` | originales | combat 138 bpm 64 s ; 126 bpm 63 s |

Non transcrites (thèmes pas restitués avec assez de fidélité de mémoire) : Sousa, Schubert (Marche militaire), Elgar, Boccherini, Beethoven (marche turque).
Les transcriptions « domaine public » sont faites de mémoire : elles peuvent s'écarter de l'original (dit dans `docs/ASSETS_LICENSES.md`).
Orchestration : timbres synthétisés (flûte, hautbois, clarinette, violon, cor, trompette, piccolo, cordes, piano, harpe, pizzicato, tuba, percussions) ; réverbération légère, compresseur.
États : calme = classique, filtre passe-bas 3200 Hz, niveau 0,80, silences de 6 à 11 s ; tension = marches en bois et cordes, 5200 Hz, 0,92, 3 à 6 s ; combat = marches avec cuivres et caisse claire, 9500 Hz, 1,00, 1,5 à 3,5 s.

## 4. Critères (sorties réelles ; `docs/reports/AUD-verify.log`)

| ID | Résultat | Preuve |
|---|---|---|
| CAUD-01 | **OK** | `npm run verify` : `Test Files 88 passed (88)`, `Tests 559 passed (559)`, `assets:check : 102 entrées, 102 fichiers`, `sim:selftest : OK`, `EXIT=0` |
| CAUD-02 | **OK** | §1 : lignes 87-133, 321-330, 414-440, 496-551 de `src/ui/audio.ts` (d12a8d2) et `settings.ts` l.20 ; mesures sur 8 mesures |
| CAUD-03 | **OK** | `gain de musique par défaut : 0.315` (70 % × 45 %), test ≤ 0,35 |
| CAUD-04 | **OK** | `note la plus longue 2.45 s ; grave (< sol3) la plus longue 0.40 s ; couverture continue du grave 0.40 s` ; `3139 paires de notes tenues ensemble plus d'une seconde, aucune en seconde mineure, triton ou septième majeure` ; `581 oscillateurs graves joués, le plus long 1.10 s` (musique et effets) |
| CAUD-05 | **OK** | `calme : tour 497 s, 6 pièces, écart minimal entre deux reprises 404 s` ; `tension : tour 361 s, 4 pièces, 259 s` ; `combat : tour 342 s, 5 pièces, 277 s` ; session simulée de 20 min : `15 pièces, silence minimal 6.5 s, reprise la plus proche à 406 s` ; rendus identiques à l'octet près, aucun `Math.random` / `Date.now` dans `src/audio` |
| CAUD-06 | **OK** | `docs/ASSETS_LICENSES.md` « Musique de AUD » : 11 entrées ; le test vérifie titre, compositeur, date < 1929 et mort > 70 ans ; `assets:check` code 0 |
| CAUD-07 | **OK** | `tests/audio/engine.test.ts` (index, dossier, préférences, lecteur injecté) ; navigateur réel : voir §5 |

Tests ajoutés : `tests/audio/music.test.ts` (14), `tests/audio/engine.test.ts` (14), `tests/ui/audio.test.ts` (10, adapté). Total du dépôt : 530 → 559.
`git diff origin/claude/attack-on-titan-strategy-game-4ukom6 --stat -- src/sim` : vide.

## 5. Navigateur réel (Chromium, serveur Vite ; sonde jetable, non versionnée) et capture

- Menu, préférences par défaut : `audio=calme`, pièce `menuet_sol`, 118 notes en 9 s, `audioMusic=0.32`, ambiance `vent`. Jeu (carte) : idem, 103 notes en 8 s.
- Pas d'erreur de console liée à l'audio (4 avertissements « GPU stall » de WebGL, sans rapport).
- Piste déposée (4 s, sinus généré pour le test, supprimée ensuite) : `/musique-utilisateur/index.json` → `{"fichiers":[{"fichier":"calme-test.ogg","octets":10357}]}` ;
  source « pistes personnelles » : `audioPiece=u:calme-test.ogg`, 0 note synthétisée (lecture du fichier) ; options : 5 curseurs, 3 cases, 1 piste listée.
- Capture `docs/screenshots/aud-options.png` (lue) : (1) le dossier Options s'ouvre sur le menu et montre les cinq curseurs (général 70 %, musique 45 %,
  ambiances 50 %, effets 80 %, interface 60 %), la case « Musique en combat seulement », la source de la musique et une piste « test » réglée sur « Paix » ;
  (2) défauts relevés : curseur « Interface et notifications » décalé avant correction (libellé plus long, largeur portée à 11,5 rem, recapturé : aligné) ;
  le sous-titre « Pistes personnelles » est gris alors que « Son » et « Musique » sont dorés (mineur) ; la liste des raccourcis est coupée en bas (défilement, existant) ;
  le titre du menu est masqué à moitié par le dossier (modal, voulu).

## 6. Ce qui n'est pas mesuré (écoute : Gabriel)

Fidélité des transcriptions, justesse des timbres, équilibre des niveaux entre pièces, effet de la réverbération et du filtre par état, agrément
des ambiances : non écoutés. Les niveaux relatifs des timbres sont des estimations (aucun rendu audio hors navigateur). Points à écouter en premier : la marche de la Légion et le galop (cuivres),
le canon du matin (cordes pincées), les ambiances de forêt et de ville.

## 7. Dettes et incidents (voir `docs/reports/dette.md`, n° 22 à 26)

Premier `verify` (AUD.1) : une suite en échec (délai de 10 s d'un hook de `titans-r1c`, 6/6 relancée seule en 9,2 s : fragile sous charge) ; second :
`tokens.test` a refusé la graine `0xa11b1e` (ressemble à une couleur), changée en décimal ; troisième : code 0. Tours : ≈ 95 sur 120.
