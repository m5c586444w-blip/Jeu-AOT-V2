# src/sim/clock

Pilier P5 « L'Horloge » (spec 26 §6) : suspicion par faction observatrice (témoin, anomalie, fuite, interrogatoire, transformation vue), couverture des infiltrés, démasquage (événement) et fausse accusation, contrôle (volonté, stress, liens, ordre contraire), autonomie et désobéissance, modèles d'action par Titan, porte de transformation, extraction (capture contre mort), roster de Marley (usure, coût de projection, utiliser/garder), invariant des Neuf. Paramètres : `data/balance/clock.json` `[A]` (horloge de 13 ans, nuque, arme de contention : `[C]`).

API pure, aléa injecté (`Rng` ou tirage `roll`). Lien avec l'horloge existante (`src/sim/shifters/shifters.ts`) : même formule d'années restantes, jamais modifiée (l'usure est une horloge « utile » séparée) ; `applyCapture` marque `captured` (héritage préparé) ; `syncBearers` suit les héritages et morts. **Non branchée au tick** : aucune empreinte modifiée. Connaissance par faction, vue par siège (`viewForSeat`) ; un porteur non démasqué n'apparaît jamais.
Hors module : perte de contrôle en combat (`tactical/shifters.ts`), exécution des ordres généraux en bataille.
