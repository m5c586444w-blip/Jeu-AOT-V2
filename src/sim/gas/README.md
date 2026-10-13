# src/sim/gas

Pilier P3 (spec 26 §4) : réseau d'ancrage (registre de pertes séparé de la carte), carte d'ancrage réelle/estimée, fenêtre de coupe, coût stratégique du gaz. Paramètres : `data/balance/gas.json` `[A]`. API pure, **non branchée au tick** (aucune empreinte de référence modifiée) ; le branchement à `battle.ts`/conseil est une tâche ultérieure de C4.
