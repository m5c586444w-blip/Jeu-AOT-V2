# src/sim/wall

Pilier P1 (spec 26 §2) : pression `population / capacité alimentaire` par district et par anneau, brèche, évacuation (portes d'accueil), reconquête progressive, désengorgement systémique à trois branches. Paramètres : `data/balance/wall.json` `[A]`. API pure (états clonés, aléa injecté), **non branchée au tick** (aucune empreinte de référence modifiée). `pressure` de `armies` (occupation) est un autre concept : non utilisé ici.
