# C18 — Couverture des lieux (rapport généré)

Généré par `npm run places:couverture` (src/tools/places-couverture.ts). Atlas : `data/provinces/paradis.json` (74) ; monde : `data/world_provinces/world.json` (61). Population : celle de `scn_sandbox_845` pour Paradis, `n/d` pour le monde (la simulation ne porte pas de population par province du monde). POI : lignes du tableau « POI canon » de docs/spec/06 §2. Un lieu couvre une province par `province`, `population.province` ou zone annexe ; un segment de mur par `_murs.json` ; une province du monde par la table `RATTACHEMENTS_MONDE`.

## Totaux

| Région | Provinces | Couvertes | Non couvertes | Sans objet (mer, agrégat) |
|---|---|---|---|---|
| Paradis (murs et anneaux) | 64 | 44 | 20 | 0 |
| Hors-murs | 10 | 0 | 10 | 0 |
| Marley | 30 | 1 | 29 | 0 |
| Hizuru | 8 | 0 | 8 | 0 |
| Alliés | 14 | 0 | 14 | 0 |
| Mers | 0 | 0 | 0 | 8 |
| Résumé de Paradis | 0 | 0 | 0 | 1 |
| **Total** | **126** | **45** | **81** | **9** |

## Paradis (murs et anneaux)

| Id | Code | Nom | Nature | Population | POI | Lieu jouable |
|---|---|---|---|---|---|---|
| prov_maria_nord | M01 | Maria-Nord | segment | 0 | 0 | _murs (maria) |
| prov_maria_nord_est | M02 | Maria-Nord-Est | segment | 0 | 0 | _murs (maria) |
| prov_maria_est | M03 | Maria-Est | segment | 0 | 0 | _murs (maria) |
| prov_maria_sud_est | M04 | Maria-Sud-Est | segment | 0 | 0 | _murs (maria) |
| prov_maria_sud | M05 | Maria-Sud — porte de Shiganshina | segment | 0 | 1 | _murs (maria) |
| prov_maria_sud_ouest | M06 | Maria-Sud-Ouest | segment | 0 | 0 | _murs (maria) |
| prov_maria_ouest | M07 | Maria-Ouest | segment | 0 | 0 | _murs (maria) |
| prov_maria_nord_ouest | M08 | Maria-Nord-Ouest | segment | 0 | 0 | _murs (maria) |
| prov_shiganshina | R01 | Shiganshina | province | 60 870 | 1 | shiganshina |
| prov_faubourgs_shiganshina | R02 | Faubourgs de Shiganshina | province | 34 783 | 0 | shiganshina |
| prov_plaines_interieures_maria_sud | R03 | Plaines intérieures de Maria — Sud | province | 34 783 | 0 | ferme-campagne |
| prov_bourg_minier_maria | R04 | Bourg minier de Maria | province | 17 391 | 0 | **manquant** |
| prov_hameaux_ouest_maria | R05 | Hameaux de l'Ouest de Maria | province | 8 696 | 0 | village-des-saules |
| prov_foret_arbres_geants | R06 | Forêt des Arbres Géants | province | 0 | 1 | foret-arbres-geants |
| prov_plaines_cerealieres_sud | R07 | Plaines céréalières du Sud | province | 34 783 | 1 | **manquant** |
| prov_plaines_du_nord | R08 | Plaines du Nord | province | 17 391 | 0 | **manquant** |
| prov_collines_minieres | R09 | Collines minières | province | 17 391 | 0 | **manquant** |
| prov_ville_usine | R10 | Ville-usine et cavernes de glace | province | 17 391 | 1 | **manquant** |
| prov_haras_maria | R11 | Haras de Maria | province | 8 696 | 0 | **manquant** |
| prov_vallee_du_moulin | R12 | Vallée du Moulin | province | 17 391 | 0 | **manquant** |
| prov_carrefour_du_sud | R13 | Carrefour du Sud | province | 8 696 | 0 | **manquant** |
| prov_lac_des_reflets | R14 | Lac des Reflets | province | 8 696 | 0 | **manquant** |
| prov_fort_avance_maria | R15 | Fort avancé de Maria | province | 8 696 | 0 | fort-du-front |
| prov_hameaux_est | R16 | Hameaux de l'Est | province | 17 391 | 0 | **manquant** |
| prov_monts_brumeux | R17 | Monts Brumeux | province | 0 | 0 | **manquant** |
| prov_gorge_du_silence | R18 | Gorge du Silence | province | 0 | 0 | **manquant** |
| prov_vergers_ouest | R19 | Vergers de l'Ouest | province | 17 391 | 0 | **manquant** |
| prov_relais_poste_maria | R20 | Relais de poste de Maria | province | 8 696 | 0 | **manquant** |
| prov_rose_nord | W01 | Rose-Nord | segment | 0 | 0 | _murs (rose) |
| prov_rose_nord_est | W02 | Rose-Nord-Est | segment | 0 | 0 | _murs (rose) |
| prov_rose_est | W03 | Rose-Est — porte de Karanes | segment | 0 | 0 | _murs (rose) |
| prov_rose_sud_est | W04 | Rose-Sud-Est | segment | 0 | 0 | _murs (rose) |
| prov_rose_sud | W05 | Rose-Sud — porte de Trost | segment | 0 | 1 | _murs (rose) |
| prov_rose_sud_ouest | W06 | Rose-Sud-Ouest | segment | 0 | 0 | _murs (rose) |
| prov_rose_ouest | W07 | Rose-Ouest | segment | 0 | 0 | _murs (rose) |
| prov_rose_nord_ouest | W08 | Rose-Nord-Ouest | segment | 0 | 0 | _murs (rose) |
| prov_trost | S01 | Trost | province | 95 652 | 2 | qg-garnison, trost |
| prov_karanes | S02 | Karanes | province | 60 870 | 0 | karanes |
| prov_utopia | S03 | Utopia | province | 34 783 | 0 | utopia |
| prov_krolva | S04 | Krolva | province | 34 783 | 0 | krolva |
| prov_ragako | S05 | Ragako | province | 8 696 | 0 | ragako |
| prov_utgard | S06 | Château d'Utgard | province | 0 | 1 | chateau-utgard |
| prov_qg_corps | S07 | QG du Corps de Reconnaissance | province | 8 696 | 1 | **manquant** |
| prov_camp_entrainement | S08 | Camp d'entraînement | province | 17 391 | 1 | camp-entrainement |
| prov_champs_du_centre | S09 | Champs du Centre | province | 34 783 | 0 | **manquant** |
| prov_dauper | S10 | Dauper | province | 8 696 | 0 | dauper |
| prov_forges_rose | S11 | Forges de Rose | province | 17 391 | 0 | **manquant** |
| prov_poudriere_rose | S12 | Poudrière de Rose | province | 8 696 | 0 | **manquant** |
| prov_jinae | S13 | Jinae | province | 17 391 | 0 | jinae |
| prov_relais_ferroviaire | S14 | Relais ferroviaire (en projet) | province | 8 696 | 0 | **manquant** |
| prov_sina_nord | N01 | Sina-Nord | segment | 0 | 0 | _murs (sina) |
| prov_sina_nord_est | N02 | Sina-Nord-Est | segment | 0 | 0 | _murs (sina) |
| prov_sina_est | N03 | Sina-Est | segment | 0 | 0 | _murs (sina) |
| prov_sina_sud | N04 | Sina-Sud | segment | 0 | 0 | _murs (sina) |
| prov_sina_ouest | N05 | Sina-Ouest | segment | 0 | 0 | _murs (sina) |
| prov_sina_nord_ouest | N06 | Sina-Nord-Ouest | segment | 0 | 0 | _murs (sina) |
| prov_mitras | I01 | Mitras | province | 95 652 | 2 | mitras |
| prov_palais_royal | I02 | Palais royal | province | 8 696 | 1 | **manquant** |
| prov_stohess | I03 | Stohess | province | 60 870 | 1 | stohess |
| prov_orvud | I04 | Orvud | province | 34 783 | 0 | orvud |
| prov_yarckel | I05 | Yarckel | province | 34 783 | 0 | yarckel |
| prov_ville_souterraine | I06 | Ville souterraine | province | 34 783 | 1 | ville-souterraine |
| prov_domaine_reiss | I07 | Domaine Reiss et chapelle souterraine | province | 0 | 1 | chapelle-reiss |
| prov_ehrmich | I08 | Ehrmich | province | 34 783 | 0 | ehrmich |

## Hors-murs

| Id | Code | Nom | Nature | Population | POI | Lieu jouable |
|---|---|---|---|---|---|---|
| prov_plaines_meurtries | O01 | Plaines Meurtries | outre | 0 | 0 | **manquant** |
| prov_ruines_premier_cordon | O02 | Ruines du Premier Cordon | outre | 0 | 0 | **manquant** |
| prov_riviere_des_cendres | O03 | Rivière des Cendres | outre | 0 | 0 | **manquant** |
| prov_falaises_cote_sud | O04 | Falaises de la Côte Sud | outre | 0 | 0 | **manquant** |
| prov_marais_brumeux | O05 | Marais Brumeux | outre | 0 | 0 | **manquant** |
| prov_foret_morte | O06 | Forêt Morte | outre | 0 | 0 | **manquant** |
| prov_steppe_orientale | O07 | Steppe Orientale | outre | 0 | 0 | **manquant** |
| prov_cote_est | O08 | Côte Est | outre | 0 | 0 | **manquant** |
| prov_plateau_du_nord | O09 | Plateau du Nord | outre | 0 | 0 | **manquant** |
| prov_vallee_oubliee | O10 | Vallée Oubliée | outre | 0 | 0 | **manquant** |

## Marley

| Id | Code | Nom | Nature | Population | POI | Lieu jouable |
|---|---|---|---|---|---|---|
| wprov_capitale_marley | MA01 | Capitale de Marley | urbain | n/d | 0 | **manquant** |
| wprov_liberio | MA02 | Liberio | urbain | n/d | 0 | **manquant** |
| wprov_liberio_internement | MA03 | Zone d'internement de Liberio | urbain | n/d | 0 | liberio |
| wprov_fort_slava | MA04 | Fort Slava | fort | n/d | 0 | **manquant** |
| wprov_port_liberio | MA05 | Port militaire de Liberio | port | n/d | 0 | **manquant** |
| wprov_academie_guerriers | MA06 | Académie des Guerriers | militaire | n/d | 0 | **manquant** |
| wprov_domaine_tybur | MA07 | Domaine des Tybur | fort | n/d | 0 | **manquant** |
| wprov_bassin_houiller | MA08 | Bassin houiller | industriel | n/d | 0 | **manquant** |
| wprov_acieries_nord | MA09 | Aciéries du Nord | industriel | n/d | 0 | **manquant** |
| wprov_raffineries_sud | MA10 | Raffineries du Sud | industriel | n/d | 0 | **manquant** |
| wprov_chantiers_est | MA11 | Chantiers navals de l'Est | port | n/d | 0 | **manquant** |
| wprov_aerodrome_central | MA12 | Aérodrome central | militaire | n/d | 0 | **manquant** |
| wprov_rail_nord | MA13 | Nœud ferroviaire Nord | urbain | n/d | 0 | **manquant** |
| wprov_rail_sud | MA14 | Nœud ferroviaire Sud | urbain | n/d | 0 | **manquant** |
| wprov_plaines_ouest | MA15 | Plaines agricoles de l'Ouest | rural | n/d | 0 | **manquant** |
| wprov_plaines_est | MA16 | Plaines agricoles de l'Est | rural | n/d | 0 | **manquant** |
| wprov_vignobles_sud | MA17 | Vignobles du Sud | rural | n/d | 0 | **manquant** |
| wprov_mines_nord | MA18 | Province minière du Nord | industriel | n/d | 0 | **manquant** |
| wprov_forets | MA19 | Province forestière | foret | n/d | 0 | **manquant** |
| wprov_camp_armee | MA20 | Camp d'entraînement de l'armée | militaire | n/d | 0 | **manquant** |
| wprov_camps_internement | MA21 | Camps d'internement secondaires | urbain | n/d | 0 | **manquant** |
| wprov_colonies_nord | MA22 | Colonies d'outre-mer (nord) | colonie | n/d | 0 | **manquant** |
| wprov_colonies_sud | MA23 | Colonies d'outre-mer (sud) | colonie | n/d | 0 | **manquant** |
| wprov_ville_universitaire | MA24 | Ville universitaire | urbain | n/d | 0 | **manquant** |
| wprov_quartier_affaires | MA25 | Quartier d'affaires | urbain | n/d | 0 | **manquant** |
| wprov_arsenal_central | MA26 | Arsenal central | industriel | n/d | 0 | **manquant** |
| wprov_poudrieres_ouest | MA27 | Poudrières de l'Ouest | industriel | n/d | 0 | **manquant** |
| wprov_artillerie_cotiere | MA28 | Bases d'artillerie côtière | fort | n/d | 0 | **manquant** |
| wprov_espionnage_marley | MA29 | Réseau d'espionnage Marley | special | n/d | 0 | **manquant** |
| wprov_ministeres | MA30 | Ministères | urbain | n/d | 0 | **manquant** |

## Hizuru

| Id | Code | Nom | Nature | Population | POI | Lieu jouable |
|---|---|---|---|---|---|---|
| wprov_capitale_hizuru | HZ01 | Capitale d'Hizuru | urbain | n/d | 0 | **manquant** |
| wprov_domaine_azumabito | HZ02 | Domaine Azumabito | fort | n/d | 0 | **manquant** |
| wprov_port_hizuru | HZ03 | Port principal d'Hizuru | port | n/d | 0 | **manquant** |
| wprov_chantiers_hizuru | HZ04 | Chantiers navals d'Hizuru | port | n/d | 0 | **manquant** |
| wprov_ile_est_hizuru | HZ05 | Île de l'Est | ile | n/d | 0 | **manquant** |
| wprov_plaines_hizuru | HZ06 | Plaines agricoles d'Hizuru | rural | n/d | 0 | **manquant** |
| wprov_montagnes_hizuru | HZ07 | Montagnes d'Hizuru | rural | n/d | 0 | **manquant** |
| wprov_diplomatique_hizuru | HZ08 | Quartier diplomatique d'Hizuru | urbain | n/d | 0 | **manquant** |

## Alliés

| Id | Code | Nom | Nature | Population | POI | Lieu jouable |
|---|---|---|---|---|---|---|
| wprov_cite_desert | AL01 | Cité du Désert | urbain | n/d | 0 | **manquant** |
| wprov_port_oriental | AL02 | Port Oriental | port | n/d | 0 | **manquant** |
| wprov_oasis_centrale | AL03 | Oasis Centrale | rural | n/d | 0 | **manquant** |
| wprov_haut_plateau | AL04 | Haut-Plateau | rural | n/d | 0 | **manquant** |
| wprov_forteresse_passage | AL05 | Forteresse du Passage | fort | n/d | 0 | **manquant** |
| wprov_ville_marche | AL06 | Ville-Marché | urbain | n/d | 0 | **manquant** |
| wprov_cote_voiliers | AL07 | Côte des Voiliers | port | n/d | 0 | **manquant** |
| wprov_province_nord_alliee | AL08 | Province du Nord (Alliés) | rural | n/d | 0 | **manquant** |
| wprov_province_est_alliee | AL09 | Province de l'Est (Alliés) | rural | n/d | 0 | **manquant** |
| wprov_depot_allie | AL10 | Dépôt logistique commun | militaire | n/d | 0 | **manquant** |
| wprov_qg_coalition | AL11 | QG de coalition | militaire | n/d | 0 | **manquant** |
| wprov_camps_refugies | AL12 | Camps de réfugiés | urbain | n/d | 0 | **manquant** |
| wprov_raffinerie_alliee | AL13 | Raffinerie alliée | industriel | n/d | 0 | **manquant** |
| wprov_aerodrome_allie | AL14 | Aérodrome allié | militaire | n/d | 0 | **manquant** |

## Mers

| Id | Code | Nom | Nature | Population | POI | Lieu jouable |
|---|---|---|---|---|---|---|
| wprov_detroit_slava | SE01 | Détroit de Slava | mer | n/d | 0 | sans objet |
| wprov_mer_interieure | SE02 | Mer intérieure | mer | n/d | 0 | sans objet |
| wprov_ocean_ouest | SE03 | Océan Ouest | mer | n/d | 0 | sans objet |
| wprov_ocean_est | SE04 | Océan Est | mer | n/d | 0 | sans objet |
| wprov_passage_sud | SE05 | Passage Sud | mer | n/d | 0 | sans objet |
| wprov_passage_nord | SE06 | Passage Nord | mer | n/d | 0 | sans objet |
| wprov_routes_marchandes | SE07 | Routes marchandes | mer | n/d | 0 | sans objet |
| wprov_cotes_paradis | SE08 | Zone de Paradis (côtes) | mer | n/d | 0 | sans objet |

## Résumé de Paradis

| Id | Code | Nom | Nature | Population | POI | Lieu jouable |
|---|---|---|---|---|---|---|
| wprov_paradis | PA00 | Île Paradis | ile | n/d | 0 | sans objet |

