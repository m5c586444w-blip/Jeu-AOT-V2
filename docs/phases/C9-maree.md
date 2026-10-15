# C9.7 — La Marée : grille régionale à la demande (suite de D-173)

## Problème
Une grille mondiale de la Marée compterait ≈ 316 000 cellules (cellule de 2 km) avec un pas par heure de campagne : inabordable. Les Titans n'importent, pour la partie stratégique, que là où des humains sont présents.

## Conception
- **Région** = fenêtre carrée de `region.half_cells` cellules de chaque côté du nœud d'une province où se trouve au moins une armée **exposée** (province non tenue par Paradis, densité de Titans > 0). Au plus `region.max_regions` régions (ordre des identifiants, déterministe).
- **Création** : densité de chaque cellule = `titanDensity(province) × region.per_density` (Titans par cellule), capacité de repeuplement = `titanDensity × region.capacity_per_density`. Sans humains, la grille est à l'équilibre : `eff = local / per_density` redonne exactement la densité statique.
- **Pas quotidien** : `region.hours.length` pas de `24 / hours.length` h, aux heures indiquées (jour/nuit, saison). Piles = armées de la province, effectifs par arme (`region.kind_weapon`), bruit de marche si en mouvement (`region.march_noise`), sinon `region.halt_noise`. Pic d'attention `combat` le jour d'une rencontre.
- **Effet** : pour les rencontres et l'usure des armées, la densité statique `d` devient `eff = min(1, d × min(amplify_max, facteur))`, où `facteur = localDensity / (d × per_density)` (1 à l'équilibre) ; une province sans Titans (`d = 0`) n'en reçoit pas ; sans région, `d` s'applique (`ctx.tideDensity`). Le plafond `amplify_max` (4) évite qu'un séjour de quelques jours fasse passer 0,02 à 1. L'attention humaine attire les Titans ; la nuit et l'hiver ils sont moins mobiles (P2).
- **Oubli** : après `region.idle_days` jours sans armée, la région est supprimée (la densité statique reprend) ; aucune trace n'est conservée (choix `[A]`, réversible).
- **Activation** : `EnableTide` (commande stricte, idempotente), `pillars.tide`, désactivé par défaut ⇒ empreintes de référence inchangées.

## Critères d'acceptation
- Aucune donnée morte (`tide.json › region.*` toutes lues) ; test d'intégration : région créée, densité d'équilibre = statique, attraction mesurable autour d'une armée, oubli après `idle_days`, déterminisme (2 exécutions), aller-retour de sauvegarde, rejeu.
- `npm run sim:selftest` : empreintes de référence inchangées pilier désactivé ; `npm run verify` code 0.

## Hors périmètre
Écran de la Marée (carte de chaleur), piles tactiques de Titans dans la bataille issues de la grille, mémoire des régions entre deux séjours.
