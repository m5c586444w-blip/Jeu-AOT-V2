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
