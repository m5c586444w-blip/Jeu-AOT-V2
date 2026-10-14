# src/sim/truth

Pilier P6 « La Vérité » (spec 26 §7). Paramètres : `data/balance/truth.json` `[A]` (schéma `TruthBalanceSchema`). Faits canon `C` repris (Titans = humains, Murs contenant des Titans, monde extérieur, Marley moderne, Chemins ; marine/aviation jamais pour Paradis) ; la rumeur doctrinale « humanité éteinte hors des murs » est une création `A` (fausse).

- **Dossier** (`dossier.ts`) : le monde a une véracité par fait ; chaque faction a un dossier de pièces (source, affirmation, origine, qualité, jour). `assess` donne croyance + fiabilité A–D (poids de source × qualité × vieillissement ; corroboration d'origines **distinctes** plafonnée ; pénalité de la version adverse ; sous `min_margin` aucune croyance). Ne lit jamais la véracité, sauf fait **vérifié** (`reveal`). `decide` : coût réel d'une croyance fausse (plus fort si jugée sûre) ou d'un acte à l'aveugle. Visions : `mental_cost` renvoyé à l'appelant.
- **Actes** (`acts.ts`) : par faction ; l'acte suivant exige la **connaissance vraie** de ses faits à `min_grade` ; ne se perd jamais ; capacités réservées par faction (marine, aviation).
- **Attracteurs** (`attractors.ts`) : `stepAttractors` (une fois par jour) programme dans le moteur (`events/engine.ts` : `ready`, `schedule`) les canons dont la fenêtre est ouverte, avec une probabilité = base × attraction(divergence) × proximité^exposant ; les écarts aux conditions cumulent un `drift` ajouté à la divergence ; au seuil la branche bascule. `factionPulls` : attracteurs des factions (`data/factions`).
- **Vue** (`view.ts`) : dossier par faction/siège ; événements filtrés (`eventsForFaction`).

**Non branché au tick** : aucun champ `truth` dans `GameState`, aucune empreinte modifiée. Un appelant doit tenir un `TruthState`, appeler `stepAttractors` avant `dailyEvents` avec `holds = conditionHolds(ctx, c)`, puis `advanceActs`.
Limites assumées [A] : les actes ne changent pas encore les règles du tick (les capacités sont exposées, non consommées) ; l'écart de `drift` est mesuré sur les seules conditions des canons prêts en fenêtre.
