# Château d'Utgard (`chateau-utgard`) — lore

Lieu créé en C17 (tranche 1). Plan d'auteur : `src/tools/places/auteur/chateau-utgard.ts` ; données : `data/places/chateau-utgard.json`.

| Élément | Statut | Source / note |
|---|---|---|
| Le château d'Utgard est un château abandonné dans Wall Rose, près du périmètre intérieur | [C] | docs/spec/01 §3.1, docs/spec/11 §1 et §2, atlas 06 S06 ; `prov_utgard`, `poi_chateau_utgard` |
| Détruit en 850 à l'issue d'un combat de nuit | [C] | atlas 06 S06 et T08 ; `prov_utgard.destroyed_year` = 850, `evt_850_utgard_battle` ; ne peut plus servir de base après (11 §1) |
| Position exacte sur la carte | [?] | `prov_utgard` : notes_canon ; `data/geo/paradis.json` le place au nord-est de l'intérieur de Rose [A] |
| Déroulement du combat | [?] | non posé ; l'état 850 montre seulement le résultat (ruines 95 %, incendies, habitants nuls) |
| Plan carré de 180 m (cellules de 45 m), cour d'honneur, donjon, tours d'angle, châtelet, logis, chapelle, écuries ; douves à 100 m ; bois alentour | [A] | création C17 (Q31) |
| Courtines et enceinte propre : non modélisables | [A] | le schéma ne connaît que les murs Maria, Rose et Sina : tours, châtelet et donjon sont des bâtiments (dette) |
| Population : 24 occupants précaires (valeur `?`), densité 9,5 hab/ha (classe ferme) | [?] / [A] | `prov_utgard` a une population de simulation nulle ; bâti 2,9 ha pour 2,5 ha (+14,4 %) |
| États : « 845-abandonne » (par défaut) et « 850-detruit » | [C] / [A] | abandon et destruction [C] ; degré d'abandon et étendue des ruines [A] |
