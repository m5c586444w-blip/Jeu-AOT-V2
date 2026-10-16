# Trost (`trost`) — lore

Lieu créé en C15 (tranche 1). Plan d'auteur : `src/tools/places/auteur/trost.ts` ; données : `data/places/trost.json`.

| Élément | Statut | Source / note |
|---|---|---|
| Trost, district sud du mur Rose | [C] | docs/spec/01 §3.1, docs/spec/11 §2, atlas 06 S01 |
| Forme en saillie à deux portes (porte sud vers Maria, porte intérieure) | [C] forme, [A] tracé | forme établie pour Shiganshina et Trost ; rayon 1 560 m déduit de la population (Q4) |
| Quartier général de la Garnison | [C] existence, [A] emplacement | atlas 06 S01, `poi_qg_garnison_trost` ; seul l'emplacement est posé ici, le plan intérieur est une tranche ultérieure |
| Entrepôt de gaz de Trost | [A] | `poi_entrepot_gaz_trost` (`data/geo/paradis.json`), cible de sabotage (atlas 06) |
| Grenier, marché | [A] | `bld_grenier`, `bld_marche` dans `prov_trost` (scénario 845) |
| Garnison de 2 500 soldats | [C] présence, [A] chiffre | `data/scenarios/sandbox_845.json` |
| Brèche de 850 à la porte sud, zone de bouchage | [C] | atlas 06 W05, docs/spec/03, docs/spec/20 (LC-B) ; étendue des ruines et taille du rocher [A] |
| Canons de rempart sur rails | [C] fait, [A] affût et espacement (24 m) | docs/spec/20, Q11 |
| Rue de l'Évacuation (845 puis 850) | [A] | docs/spec/20 demande « rue des évacuations » ; tracé et nom créés |
| Population : 95 652 (`prov_trost`), 90 % intra-muros, 10 % au faubourg | [C] province, [A] parts | lecture de `scn_sandbox_845` |
| Densité 250 hab/ha (faubourg : 100) | [A] | classe « cœur » 150–300 |
| Noms de rues, de places, de quartiers, de bâtiments | [A] | créations (`docs/lore/creations.md`) ; aucun nom canon connu |
| Identifiant d'état de porte `brisee_845` utilisé pour 850 | [A] | identifiant historique du schéma, valeur « brisée » |
