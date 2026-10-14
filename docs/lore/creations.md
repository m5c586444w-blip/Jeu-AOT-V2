# Créations de lore (`canon: "A"`, `creation: true`) — ERRATA_V3 §2

Jamais présentées comme canon. Chaque entrée : identifiant, nature, raison, session, fichier.

| Id | Nature | Raison | Session | Fichier |
|---|---|---|---|---|
| rumeur « humanité éteinte hors des murs » | rumeur fausse (fait de jeu) | exemple de fait à véracité fausse pour le pilier Vérité ; cohérent avec le secret des murs (fait C non contredit) | A, 2026-10-14 (C8.1, D-163) | `data/balance/truth.json` |
| tables de noms de la troupe « paradis », « marley », « commun » (prénoms, noms de famille, sobriquets) | noms de personnages (créés, d'inspiration européenne début XXe) | nommer la troupe générée et promue ; aucun prénom ni nom de l'œuvre (liste d'exclusion étendue testée dans `tests/sim/registry/data.test.ts` ; « Ilse », « Frieda », « Dieter », « Bertram » remplacés par Irmgard, Felicitas, Dominik, Benedikt après revue) ; non canon | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › names` |
| titres de stèles (« Stèle de {lieu} », « Pierre du souvenir de {lieu} », « Mur des noms de {lieu} ») | lieux de mémoire (monuments) | rendre le registre des morts consultable avec stèle (26 §8) ; non canon | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › stele.titles` |
| épitaphes de stèles (4 phrases) | textes gravés | habillage des stèles ; ne contredit aucun fait C | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › stele.epitaphs` |
| rangs de la troupe (recrue, soldat, caporal, chef d'escouade, officier) et types de liens (ami, rival, amour, dette, haine) | vocabulaire de jeu | échelle de promotion et graphe de relations du pilier Registre ; génériques | A, 2026-10-14 (C8.2, P7) | `data/balance/registry.json › ranks, bonds` |
