# Créations de lore (`canon: "A"`, `creation: true`) — ERRATA_V3 §2

Jamais présentées comme canon. Chaque entrée : identifiant, nature, raison, session, fichier.

| Id | Nature | Raison | Session | Fichier |
|---|---|---|---|---|
| rumeur « humanité éteinte hors des murs » | rumeur fausse (fait de jeu) | exemple de fait à véracité fausse pour le pilier Vérité ; cohérent avec le secret des murs (fait C non contredit) | A, 2026-10-14 (C8.1, D-163) | `data/balance/truth.json` |
| tables de noms de la troupe « paradis », « marley », « commun » (prénoms, noms de famille, sobriquets) | noms de personnages (créés, d'inspiration européenne début XXe) | nommer la troupe générée et promue ; aucun prénom ni nom de l'œuvre (liste d'exclusion étendue testée dans `tests/sim/registry/data.test.ts` ; « Ilse », « Frieda », « Dieter », « Bertram » remplacés par Irmgard, Felicitas, Dominik, Benedikt après revue) ; non canon | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › names` |
| titres de stèles (« Stèle de {lieu} », « Pierre du souvenir de {lieu} », « Mur des noms de {lieu} ») | lieux de mémoire (monuments) | rendre le registre des morts consultable avec stèle (26 §8) ; non canon | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › stele.titles` |
| épitaphes de stèles (4 phrases) | textes gravés | habillage des stèles ; ne contredit aucun fait C | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › stele.epitaphs` |
| rangs de la troupe (recrue, soldat, caporal, chef d'escouade, officier) et types de liens (ami, rival, amour, dette, haine) | vocabulaire de jeu | échelle de promotion et graphe de relations du pilier Registre ; génériques | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › ranks, bonds` |
| emb_fac_paradis | emblème (faction) | blason de nation redessiné en trois enceintes concentriques et une porte (04 §8.5) | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_fac_marley | emblème (faction) | tour d'acier couronnée d'une étoile à huit branches ; dessin du projet | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_fac_hizuru | emblème (faction) | disque solaire au-dessus de trois vagues ; dessin du projet | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_fac_allies | emblème (faction) | deux sabres croisés sous une étoile ; dessin du projet | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_survey_corps | emblème (organisation) | ailes de la Liberté stylisées : fait de concept C (10 §9), forme redessinée par le projet (paire d'ailes ouvertes, plumes en entailles, non croisées ; réduites pour tenir dans l'écu, marge ≥ 2,8 unités) | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_garrison | emblème (organisation) | emblème de Garnison : fait de concept C (10 §9), forme redessinée par le projet (rempart crénelé et porte) | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_military_police | emblème (organisation) | licorne de la Police militaire : fait fourni par Gabriel (ERRATA_V3 §2.8), dessin du projet (tête de licorne de profil, corne et crinière) | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_training_corps | emblème (organisation) | emblème du Corps d'Entraînement : fait de concept C (10 §9), forme créée : trois chevrons ascendants sur un jeune plant (échelle des grades) | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_culte | emblème (organisation) | disque au-dessus de trois piliers : religion d'État (01 §5.1), dessin du projet | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_cabinet | emblème (organisation) | plume sur deux lignes de registre : dessin du projet | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_cour | emblème (organisation) | couronne à trois pointes sur un socle : dessin du projet | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| emb_org_guildes | emblème (organisation) | balance à deux plateaux : dessin du projet | A, 2026-10-15 (C2) | `data/emblems/emblems.json` |
| tenues_c10 | uniformes (7) et coloris | tenues du Bataillon d'exploration, de la Garnison, de la Police militaire, du Corps d'entraînement, de la Police intérieure, soldat et officier de Marley : coloris et coupes d'après le fichier 10, dessin du projet (cape verte du Bataillon : fait `C` E-P11) | A, 2026-10-16 (C10) | `tools/blender/tenues.py` |
