

# 09 — CATALOGUE DE FONCTIONNALITÉS ÉTENDUES (≈ 330)

> Chaque fonction a un **ID** (`F-DOMAINE-NN`), une **priorité** (`P1` indispensable · `P2` important · `P3` luxe) et une **phase** suggérée (voir fichier 05).
> Les fonctions sont des **idées de design `A`** ; leur adoption dépend de ta phase de développement. L'IA doit **les implémenter dans l'ordre de priorité**, sans casser la cohérence avec le lore (fichier 01).
> Format : `ID [priorité/phase] — description`.

## 1. CARTE STRATÉGIQUE (STR)

- F-STR-01 [P1/P1] — Carte en 3 niveaux de zoom (Monde, Région, Province) avec LOD des toponymes.
- F-STR-02 [P1/P1] — 10 overlays : politique, moral, nourriture, gaz, Titans, religion, renseignement, population, légitimité, supply.
- F-STR-03 [P1/P1] — Survol = bulle courte ; clic = dossier ; double-clic = centrer.
- F-STR-04 [P1/P1] — Frontières provinciales dessinées à la main, lisibles, avec encre irrégulière.
- F-STR-05 [P2/P1] — Murs rendus en coupe stylisée avec état structurel visible.
- F-STR-06 [P2/P1] — Brouillard de guerre « papier froissé » avec dernières informations datées.
- F-STR-07 [P2/P1] — Marqueurs d'unités façon pions avec insignes et ombre papier.
- F-STR-08 [P2/P2] — Tracés de routes d'expéditions avec incertitude de position (cône).
- F-STR-09 [P2/P2] — Annotations manuscrites posables par le joueur (notes sur la carte).
- F-STR-10 [P2/P2] — Épingles et fils pour marquer des relations entre lieux (enquête).
- F-STR-11 [P2/P2] — Mesure de distance avec règle et compas, calcul des jours de marche.
- F-STR-12 [P3/P8] — Mode « atlas ancien » : carte statique imprimable en PNG/PDF.
- F-STR-13 [P2/P3] — Visualisation des zones de ravitaillement (rayons colorés).
- F-STR-14 [P2/P5] — Visualisation des flux (convois, réfugiés, rumeurs).
- F-STR-15 [P3/P8] — Variation saisonnière de la carte (neige, boue, récoltes).
- F-STR-16 [P2/P1] — Filtres : montrer/masquer unités, POI, routes, murs.
- F-STR-17 [P2/P2] — Raccourcis de navigation (touches, favoris, groupes de provinces).
- F-STR-18 [P3/P9] — Photographie de la carte à une date donnée (historique visuel).
- F-STR-19 [P2/P2] — Liste des provinces triable (pop, moral, risque, stock).
- F-STR-20 [P3/P8] — Ambiance sonore locale par province.

## 2. ÉCONOMIE (ECO)

- F-ECO-01 [P1/P1] — 9 ressources avec production/consommation par province.
- F-ECO-02 [P1/P1] — Tooltips « pourquoi ? » listant tous les facteurs d'un chiffre.
- F-ECO-03 [P1/P1] — Stocks avec capacités, pertes, vols.
- F-ECO-04 [P1/P1] — Rationnement 3 niveaux, avec effets visibles.
- F-ECO-05 [P2/P1] — Saisons : récoltes, hiver rigoureux, disettes.
- F-ECO-06 [P2/P2] — Marché : prix dynamiques selon l'offre/la demande.
- F-ECO-07 [P2/P2] — Impôts par strate sociale, avec réactions.
- F-ECO-08 [P2/P2] — Dette et prêts auprès des guildes.
- F-ECO-09 [P2/P2] — Corruption : fuite de ressources par échelon.
- F-ECO-10 [P2/P2] — Contrebande (Ville souterraine) : prix alternatifs, risques.
- F-ECO-11 [P2/P3] — Contrats d'approvisionnement avec marchands (livraison, pénalités).
- F-ECO-12 [P2/P3] — Réquisitions et indemnisations.
- F-ECO-13 [P2/P3] — Spéculation, accaparement, émeutes de la faim.
- F-ECO-14 [P3/P5] — Monnaie : réformes, dévaluation, billets (Marley).
- F-ECO-15 [P2/P2] — Budgets par organisation avec arbitrage annuel.
- F-ECO-16 [P2/P3] — Projets d'infrastructure (greniers, routes, rail) avec chantier visible.
- F-ECO-17 [P2/P3] — Planification de production (files de fabrication par atelier).
- F-ECO-18 [P2/P3] — Qualité des produits (lames, gaz) avec effets sur combat.
- F-ECO-19 [P3/P5] — Stockage secret (réserves cachées, risque de découverte).
- F-ECO-20 [P2/P7] — Économie industrielle Marley : charbon → acier → armements.
- F-ECO-21 [P2/P7] — Commerce maritime, blocus, embargo.
- F-ECO-22 [P3/P7] — Assurance, prix de guerre, rançons.
- F-ECO-23 [P2/P2] — Tableaux de bord économiques avec graphiques d'archives.
- F-ECO-24 [P3/P9] — Scénarios économiques de test (crise des récoltes, effondrement du gaz).

## 3. LOGISTIQUE (LOG)

- F-LOG-01 [P1/P3] — Chaîne d'approvisionnement avec dépôts, relais, convois.
- F-LOG-02 [P1/P3] — Attrition hors de la zone de ravitaillement.
- F-LOG-03 [P2/P3] — Convois vulnérables, escortables, interceptables.
- F-LOG-04 [P2/P3] — Dépôts avancés (installables sur le terrain).
- F-LOG-05 [P2/P3] — Chevaux : fatigue, fourrage, mortalité.
- F-LOG-06 [P2/P3] — Réparations d'équipement en campagne.
- F-LOG-07 [P2/P3] — Évacuation médicale, hôpitaux de campagne.
- F-LOG-08 [P2/P3] — Capacité de transport par route/rail/fleuve/mer.
- F-LOG-09 [P3/P5] — Goulots d'étranglement (ponts, portes) avec file d'attente.
- F-LOG-10 [P2/P5] — Sabotage de lignes (rails, télégraphes).
- F-LOG-11 [P2/P7] — Logistique ferroviaire Marley : horaires, gares, trains blindés.
- F-LOG-12 [P3/P7] — Logistique aérienne (dirigeables, parachutages).
- F-LOG-13 [P2/P3] — Rapports de stocks automatiques avec alerte seuil.
- F-LOG-14 [P3/P9] — Optimiseur de convois assisté (proposition du logisticien).
- F-LOG-15 [P2/P3] — Planificateur de relais pour expéditions longues.

## 4. POPULATION ET SOCIÉTÉ (POP)

- F-POP-01 [P1/P2] — Strates sociales (≥ 8) avec satisfaction/radicalisation propres.
- F-POP-02 [P1/P2] — Moral national et local, causes détaillées.
- F-POP-03 [P2/P2] — Réfugiés : afflux, camps, intégration, tensions.
- F-POP-04 [P2/P2] — Épidémies (typhus, choléra, grippe) avec propagation.
- F-POP-05 [P2/P2] — Criminalité par province, bandes, justice.
- F-POP-06 [P2/P2] — Émeutes, grèves, manifestations.
- F-POP-07 [P2/P3] — Mouvements politiques (réformistes, conservateurs, radicaux).
- F-POP-08 [P2/P3] — Opinion publique influencée par presse, rumeurs, faits.
- F-POP-09 [P2/P3] — Rumeurs : naissance, propagation, démenti, effet.
- F-POP-10 [P2/P3] — Éducation : écoles, alphabétisation, effet sur recherche.
- F-POP-11 [P2/P3] — Démographie : natalité, mortalité, vieillissement.
- F-POP-12 [P2/P3] — Mobilité sociale et migration interne.
- F-POP-13 [P3/P5] — Culture : fêtes, arts, journaux locaux, chansons.
- F-POP-14 [P2/P5] — Religion populaire : pèlerinages, sectes, dissidences.
- F-POP-15 [P2/P7] — Discrimination des Eldiens (Marley) : lois, ghettos, résistance.
- F-POP-16 [P3/P7] — Assimilation, collaboration, résistance culturelle.
- F-POP-17 [P3/P9] — Générations : jeunes vs anciens, tensions de valeurs.
- F-POP-18 [P2/P2] — Dossiers de villages avec noms, familles, histoires.
- F-POP-19 [P3/P8] — Récits individuels (journaux de civils).
- F-POP-20 [P2/P5] — Deuil collectif : monuments, commémorations.

## 5. POLITIQUE ET LÉGITIMITÉ (POL)

- F-POL-01 [P1/P2] — Légitimité (0–100) avec causes détaillées.
- F-POL-02 [P1/P2] — Lois/décrets (≥ 40) avec effets et contre-effets.
- F-POL-03 [P2/P2] — Conseil/Cabinet avec votes et cliques.
- F-POL-04 [P2/P2] — Nominations avec shortlist et dossiers.
- F-POL-05 [P2/P2] — Procès publics avec jurés, preuves, verdicts.
- F-POL-06 [P2/P3] — Amnisties, grâces, exils.
- F-POL-07 [P2/P3] — Élections locales (guildes, conseils) quand applicable.
- F-POL-08 [P2/P3] — Coups d'État : conditions, préparation, exécution.
- F-POL-09 [P2/P3] — Contre-coups, purges, procès politiques.
- F-POL-10 [P2/P3] — Régence, abdication, succession.
- F-POL-11 [P2/P5] — Secrets d'État (niveau rumeur/indice/preuve).
- F-POL-12 [P2/P5] — Fuites, scandales, chantage.
- F-POL-13 [P2/P5] — Propagande : campagnes, affiches, gazette.
- F-POL-14 [P2/P5] — Censure : périmètre, coût, réaction.
- F-POL-15 [P2/P5] — Réformes constitutionnelles (monarchie, régence, assemblée).
- F-POL-16 [P3/P7] — Politique étrangère interne (partis pro/anti-Marley).
- F-POL-17 [P3/P7] — Idéologie : Restaurationnisme, Yeagerisme, humanisme, etc.
- F-POL-18 [P2/P9] — Fins politiques variées (république, empire, dictature, paix).
- F-POL-19 [P3/P9] — Archives politiques consultables (historique des décisions).
- F-POL-20 [P2/P2] — Capital politique : gagner, dépenser, emprunter.

## 6. CONSEILLERS ET CABINET (ADV)

- F-ADV-01 [P1/P2] — 18 rôles de conseillers avec avis fiables/biaisés.
- F-ADV-02 [P1/P2] — Propositions « à signer » avec coûts/bénéfices.
- F-ADV-03 [P2/P2] — Veto, obstruction, démission.
- F-ADV-04 [P2/P3] — Agendas cachés et trahisons.
- F-ADV-05 [P2/P3] — Séances (16 types) avec débat/persuasion/vote.
- F-ADV-06 [P2/P3] — Cliques : alliances entre conseillers.
- F-ADV-07 [P2/P3] — Relations joueur ↔ conseiller (confiance, dette, rancune).
- F-ADV-08 [P2/P3] — Générateur d'avis ancrés dans l'état du monde.
- F-ADV-09 [P2/P3] — Recoupement d'avis : demander un second conseiller.
- F-ADV-10 [P3/P5] — Mentor : un conseiller forme un successeur.
- F-ADV-11 [P3/P5] — Jeux de pouvoir internes (intrigues de cour).
- F-ADV-12 [P3/P5] — Conseillers étrangers (diplomates, espions retournés).
- F-ADV-13 [P3/P7] — Conseiller « hanté » (trauma) : avis déformés.
- F-ADV-14 [P3/P9] — Statistiques d'influence (graphique des clans).
- F-ADV-15 [P2/P2] — Dossiers personnels de conseillers (biographie, secrets).

## 7. RENSEIGNEMENT (INT)

- F-INT-01 [P1/P5] — Brouillard de guerre avec dates de dernière observation.
- F-INT-02 [P1/P5] — Agents : couverture, loyauté, risque, spécialité.
- F-INT-03 [P2/P5] — Rapports bruités, retardés, parfois faux.
- F-INT-04 [P2/P5] — Contre-espionnage : détection de taupes, fausses pistes.
- F-INT-05 [P2/P5] — Interception de courrier et télégrammes.
- F-INT-06 [P2/P5] — Cryptographie : chiffres, clés, cassage.
- F-INT-07 [P2/P5] — Désinformation : fausses fuites, faux rapports.
- F-INT-08 [P2/P5] — Assassinats ciblés, enlèvements, sabotages.
- F-INT-09 [P2/P5] — Interrogatoires : méthodes, fiabilité, coût moral.
- F-INT-10 [P2/P5] — Informateurs civils et réseaux de quartier.
- F-INT-11 [P2/P5] — Tableau d'enquête (fils, épingles) pour recouper.
- F-INT-12 [P3/P7] — Espionnage Marley ↔ Paradis ↔ Hizuru.
- F-INT-13 [P3/P7] — Agents infiltrés dans les Guerriers.
- F-INT-14 [P3/P7] — Reconnaissance aérienne (Marley) : photos, délais.
- F-INT-15 [P2/P5] — Certitude des informations : rumeur/indice/preuve.
- F-INT-16 [P2/P5] — Archives secrètes consultables.
- F-INT-17 [P3/P9] — Théorie des jeux de renseignement (agents doubles).
- F-INT-18 [P3/P5] — Taupes dormantes activées par événement.
- F-INT-19 [P3/P5] — Coup de filet : arrestations coordonnées.
- F-INT-20 [P3/P9] — Compte rendu d'opération avec leçons tirées.

## 8. RECHERCHE ET TECHNOLOGIE (TEC)

- F-TEC-01 [P1/P5] — 9 arbres, ≥ 60 technologies.
- F-TEC-02 [P2/P5] — Expériences sur Titans (capture, tests, accidents).
- F-TEC-03 [P2/P5] — Doctrines mutuellement exclusives.
- F-TEC-04 [P2/P5] — Prototypes testables avant déploiement.
- F-TEC-05 [P2/P5] — Espionnage technologique (vol de plans).
- F-TEC-06 [P2/P5] — Contre-mesures adaptatives de l'ennemi.
- F-TEC-07 [P3/P7] — Progrès Marley (blindés, aviation, armes lourdes).
- F-TEC-08 [P3/P7] — Transferts de technologie via Hizuru.
- F-TEC-09 [P2/P5] — Brevets et monopoles d'ateliers.
- F-TEC-10 [P2/P5] — Manuel d'instruction (formation) pour nouvelles armes.
- F-TEC-11 [P3/P8] — Planches techniques animées (blueprint viewer).
- F-TEC-12 [P2/P5] — Accident de laboratoire (événements).
- F-TEC-13 [P3/P9] — Courbe d'apprentissage : adoption lente.
- F-TEC-14 [P2/P5] — Standardisation de pièces (ODM) et effets de maintenance.
- F-TEC-15 [P3/P7] — Armes combinées : synergies techno.
- F-TEC-16 [P1/P5] — **Gating par événement** : une technologie peut dépendre d'un événement canon (`unlock_event`), ex. Lances de foudre, bateau volant d'Hizuru, fusils anti-Titan de Marley.

## 9. PERSONNAGES (CHR)

- F-CHR-01 [P1/P2] — Fiches complètes (attributs, traits, relations, biographie).
- F-CHR-02 [P1/P2] — Stress, traumatisme, blessure psychique.
- F-CHR-03 [P2/P2] — Relations (amour, rivalité, dette, haine) avec effets.
- F-CHR-04 [P2/P2] — Mort définitive avec dossier d'enquête.
- F-CHR-05 [P2/P2] — Promotions, rétrogradations, exils.
- F-CHR-06 [P2/P3] — Traits évolutifs (acquérir, perdre).
- F-CHR-07 [P2/P3] — Événements de vie (mariage, naissance, deuil, trahison).
- F-CHR-08 [P2/P3] — Journal personnel généré (extraits en fin de partie).
- F-CHR-09 [P2/P3] — Lettres aux familles après un décès.
- F-CHR-10 [P2/P3] — Blessures et séquelles (perte d'un membre, cécité…).
- F-CHR-11 [P2/P3] — Âge : vieillissement, retraite, mort naturelle.
- F-CHR-12 [P3/P5] — Mentorat : transmission de compétences.
- F-CHR-13 [P3/P5] — Loyautés multiples (organisation, personne, idée).
- F-CHR-14 [P3/P5] — Désertion, mutinerie, refus d'ordre.
- F-CHR-15 [P2/P3] — Spécialisations avec arbres de compétences.
- F-CHR-16 [P3/P8] — Portrait évolutif (vieillissement, cicatrices).
- F-CHR-17 [P2/P3] — Générateur d'officiers et de civils (voir fichier 07).
- F-CHR-18 [P3/P9] — Mémorial : panthéon des morts avec histoires.
- F-CHR-19 [P2/P3] — Médailles et décorations avec effets de moral.
- F-CHR-20 [P3/P9] — Statistiques de carrière (tableaux d'honneur).

## 10. TITANS ET PORTEURS (TIT)

- F-TIT-01 [P1/P4] — 8 types de Titans purs, comportements variés.
- F-TIT-02 [P1/P6] — 9 Titans avec capacités signature.
- F-TIT-03 [P1/P6] — Horloge des 13 ans.
- F-TIT-04 [P2/P6] — Transformation : coûts, cooldown, risques.
- F-TIT-05 [P2/P6] — Héritage : préparation, ingestion, conséquences.
- F-TIT-06 [P2/P6] — Mémoire/Chemins : visions et informations partielles.
- F-TIT-07 [P2/P6] — Fondation : contrôle des Titans-Murs (scénario).
- F-TIT-08 [P2/P4] — Capture de Titan : pièges, filets, anesthésie `?`.
- F-TIT-09 [P2/P5] — Laboratoire de Titans : sujets numérotés, protocoles.
- F-TIT-10 [P2/P5] — Observation de comportement (statistiques).
- F-TIT-11 [P2/P4] — Titans anormaux : événements spéciaux.
- F-TIT-12 [P3/P5] — Titans à proximité des murs : densité, mouvements.
- F-TIT-13 [P3/P5] — Titans dans la nature : migrations saisonnières.
- F-TIT-14 [P2/P6] — Porteur dérive : perte de contrôle, purs créés.
- F-TIT-15 [P2/P7] — Porteurs comme armes stratégiques : doctrine d'emploi.
- F-TIT-16 [P3/P7] — Contre-mesures : armes anti-porteurs.
- F-TIT-17 [P2/P6] — Cristal et durcissement : coûts.
- F-TIT-18 [P3/P6] — Cri d'appel : attraction de purs.
- F-TIT-19 [P3/P6] — Vapeur, chaleur, aura (effets de zone).
- F-TIT-20 [P2/P6] — Réhabilitation : porteur retiré du service.

## 11. EXPÉDITIONS (EXP)

- F-EXP-01 [P1/P3] — Planificateur : objectif, itinéraire, composition.
- F-EXP-02 [P1/P3] — Formation de reconnaissance longue portée paramétrable.
- F-EXP-03 [P2/P3] — Signaux, relais, délais.
- F-EXP-04 [P2/P3] — Plan de retrait automatique/conditionnel.
- F-EXP-05 [P2/P3] — Météo et jour/nuit.
- F-EXP-06 [P2/P3] — Rapports de mission avec liste des morts.
- F-EXP-07 [P2/P3] — Coût politique de chaque expédition.
- F-EXP-08 [P2/P3] — Expéditions secrètes (budget occulte).
- F-EXP-09 [P2/P5] — Missions d'exploration cartographique.
- F-EXP-10 [P2/P5] — Missions de récupération (documents, personnes).
- F-EXP-11 [P2/P5] — Missions de capture.
- F-EXP-12 [P2/P5] — Opérations de reconquête de territoire.
- F-EXP-13 [P3/P5] — Aménagement de bases avancées.
- F-EXP-14 [P3/P5] — Chaînes de relais de signal.
- F-EXP-15 [P2/P3] — Pré-brief et post-brief.
- F-EXP-16 [P3/P5] — Archives d'expéditions (statistiques, cartes).
- F-EXP-17 [P3/P9] — Réplication d'une expédition en simulation.
- F-EXP-18 [P2/P3] — Choix : jouer ou auto-résoudre.
- F-EXP-19 [P2/P5] — Missions conjointes avec Garnison/Brigade.
- F-EXP-20 [P3/P7] — Missions de liaison avec Hizuru/Alliés.

## 12. COMBAT TACTIQUE (CMB)

- F-CMB-01 [P1/P4] — ODM : ancrage, rail, gaz, momentum.
- F-CMB-02 [P1/P4] — Coupe de nuque : angle, vitesse, usure de lame.
- F-CMB-03 [P1/P4] — IA de Titans (vision, ouïe, attraction).
- F-CMB-04 [P1/P4] — Escouades avec formations.
- F-CMB-05 [P1/P4] — Pause active avec ordres.
- F-CMB-06 [P2/P4] — Signaux visuels et erreurs de signal.
- F-CMB-07 [P2/P4] — Moral et panique.
- F-CMB-08 [P2/P4] — Journal de combat lisible.
- F-CMB-09 [P2/P5] — Lances de foudre : zone, fratricide ; **disponibles seulement après la saisie des technologies de la Police intérieure (fin 850)**.
- F-CMB-10 [P2/P4] — Canons mobiles/fixes.
- F-CMB-11 [P2/P4] — Incendies, effondrements, civils.
- F-CMB-12 [P2/P4] — Évacuation de civils pendant la bataille.
- F-CMB-13 [P2/P4] — Blessures détaillées (saignement, infection).
- F-CMB-14 [P2/P4] — Gaz : réapprovisionnement sur chariots.
- F-CMB-15 [P2/P4] — Chute et récupération.
- F-CMB-16 [P2/P4] — Combat de nuit/crépuscule.
- F-CMB-17 [P2/P4] — Pièges (fosses, câbles, appâts).
- F-CMB-18 [P2/P4] — Capture et sauvetage d'un camarade.
- F-CMB-19 [P2/P6] — Porteurs de Titans en combat.
- F-CMB-20 [P2/P6] — Capacités de commandement actives.
- F-CMB-21 [P2/P4] — Combat urbain : toits, ruelles, intérieurs.
- F-CMB-22 [P2/P4] — Combat en forêt : verticalité extrême.
- F-CMB-23 [P2/P4] — Combat sur mur : canons, vent.
- F-CMB-24 [P3/P4] — Duels (humains vs humains) avec ODM.
- F-CMB-25 [P2/P7] — Combat moderne (artillerie, mitrailleuses, avions).
- F-CMB-26 [P2/P7] — Combat naval simplifié.
- F-CMB-27 [P3/P7] — Combat aérien simplifié (dirigeables).
- F-CMB-28 [P2/P4] — Auto-résolution détaillée.
- F-CMB-29 [P3/P4] — Mode « vue de dessus » simplifié.
- F-CMB-30 [P2/P4] — Replays enregistrés, rejouables.
- F-CMB-31 [P2/P4] — Caméras multiples : libre, suiveuse, cinématique.
- F-CMB-32 [P3/P8] — Ralenti dramatique sur coupe réussie.
- F-CMB-33 [P2/P4] — Statistiques de bataille post-combat.
- F-CMB-34 [P3/P4] — Défis de manœuvre (entraînement jouable).
- F-CMB-35 [P3/P9] — Scénarios de combat « puzzle ».
- F-CMB-36 [P2/P4] — Réglages de difficulté tactique.
- F-CMB-37 [P3/P8] — Effets sonores réalistes.
- F-CMB-38 [P3/P4] — Stress/trauma post-combat.
- F-CMB-39 [P3/P4] — Équipements détruits/perdus.
- F-CMB-40 [P2/P4] — Cartes tactiques à ancrages configurables.

## 13. GUERRE MODERNE, MARLEY (WAR)

- F-WAR-01 [P2/P7] — Front, ligne de contact, tranchées.
- F-WAR-02 [P2/P7] — Artillerie lourde : portée, contre-batterie.
- F-WAR-03 [P2/P7] — Aviation : chasse, bombardement, reconnaissance.
- F-WAR-04 [P2/P7] — Marine : cuirassés, croiseurs, sous-marins `?`.
- F-WAR-05 [P2/P7] — Chemin de fer : trains blindés, ravitaillement.
- F-WAR-06 [P2/P7] — Troupes coloniales.
- F-WAR-07 [P2/P7] — Internement et rafles.
- F-WAR-08 [P2/P7] — Projection de Titan comme arme stratégique.
- F-WAR-09 [P3/P7] — Gaz de combat `?`, usage et réprobation.
- F-WAR-10 [P2/P7] — Siège de Fort Slava.
- F-WAR-11 [P2/P7] — Débarquements amphibies.
- F-WAR-12 [P3/P7] — Occupation et administration de territoires.
- F-WAR-13 [P3/P7] — Propagande de guerre (Tybur).
- F-WAR-14 [P3/P7] — Espionnage de guerre.
- F-WAR-15 [P3/P7] — Blocus de Paradis.

## 14. DIPLOMATIE (DIP)

- F-DIP-01 [P1/P7] — Relations bilatérales (confiance, peur, intérêt, idéologie).
- F-DIP-02 [P2/P7] — Traités : alliance, non-agression, commerce, renseignement.
- F-DIP-03 [P2/P7] — Ambassades et missions.
- F-DIP-04 [P2/P7] — Ultimatums, casus belli.
- F-DIP-05 [P2/P7] — Sommets (Hizuru, Alliés).
- F-DIP-06 [P2/P7] — Garanties, otages, mariages politiques.
- F-DIP-07 [P3/P7] — Sanctions, embargo, aide humanitaire.
- F-DIP-08 [P3/P7] — Rumeurs diplomatiques, fuites.
- F-DIP-09 [P2/P7] — Coalition fragile (Alliés) avec votes.
- F-DIP-10 [P3/P9] — Archives de traités et violations.

## 15. ÉVÉNEMENTS ET NARRATION (EVT)

- F-EVT-01 [P1/P5] — Moteur d'événements avec chaînes de conséquences.
- F-EVT-02 [P1/P5] — Mode Canon Fidèle : fenêtres et divergence.
- F-EVT-03 [P2/P5] — 60 événements canon + 150 génériques.
- F-EVT-04 [P2/P5] — Événements à choix multiples avec coûts visibles.
- F-EVT-05 [P2/P5] — Événements dépendant des traits et relations.
- F-EVT-06 [P2/P5] — Événements saisonniers.
- F-EVT-07 [P2/P5] — Événements de personnages (famille, deuil).
- F-EVT-08 [P3/P8] — Événements illustrés (gravures originales).
- F-EVT-09 [P3/P8] — Narration textuelle sobre, sans formules toutes faites.
- F-EVT-10 [P2/P9] — Épilogue généré à partir des décisions marquantes.
- F-EVT-11 [P3/P9] — Journal de partie (« chronique ») exportable.
- F-EVT-12 [P3/P9] — Statistiques de divergence par rapport au canon.
- F-EVT-13 [P3/P8] — Événements rares (très faible probabilité).
- F-EVT-14 [P2/P5] — Éditeur d'événements intégré (voir DEV).
- F-EVT-15 [P3/P9] — Chronologie interactive (frise).

## 16. INTERFACE ET EXPÉRIENCE (UIX)

- F-UIX-01 [P1/P1] — HUD sobre, papier-registre, tooltips partout.
- F-UIX-02 [P1/P2] — Dossier de province, fiche personnage, planificateur.
- F-UIX-03 [P1/P1] — Raccourcis clavier configurables.
- F-UIX-04 [P2/P2] — Pile d'alertes triées avec historique.
- F-UIX-05 [P2/P2] — Loupe : touche maintenue pour détails.
- F-UIX-06 [P2/P2] — Recherche globale (personnes, lieux, lois).
- F-UIX-07 [P2/P3] — Favoris et groupes d'unités.
- F-UIX-08 [P2/P8] — Interfaces-objets : dossiers, carnets, tableaux.
- F-UIX-09 [P2/P8] — Animations physiques (feuilles, tampons).
- F-UIX-10 [P2/P8] — Thème visuel par faction.
- F-UIX-11 [P2/P2] — Mode « conseil » : panneau de recommandations.
- F-UIX-12 [P2/P2] — Annuler les décisions non engagées.
- F-UIX-13 [P2/P2] — Confirmation pour décisions irréversibles.
- F-UIX-14 [P2/P8] — Tableau d'enquête interactif.
- F-UIX-15 [P2/P8] — Gazette : lecture et archivage.
- F-UIX-16 [P3/P8] — Salles diégétiques cliquables.
- F-UIX-17 [P2/P1] — Mise à l'échelle (100–200 %).
- F-UIX-18 [P2/P1] — Langues FR/EN.
- F-UIX-19 [P3/P10] — Tutoriel diégétique (lettres de mentors).
- F-UIX-20 [P3/P10] — Encyclopédie in-game (Archives) avec statuts C/A/?.
- F-UIX-21 [P2/P2] — Tooltips imbriqués (survol dans un tooltip).
- F-UIX-22 [P2/P2] — Comparateurs (provinces, personnages, unités).
- F-UIX-23 [P3/P8] — Mode « photo » (capture de scène).
- F-UIX-24 [P3/P10] — Mode « immersion » (HUD minimal).

## 17. AUDIO (AUD)

- F-AUD-01 [P2/P8] — Musique adaptative à 3–5 couches.
- F-AUD-02 [P2/P8] — Ambiances par lieu (ville, forêt, mur, océan).
- F-AUD-03 [P2/P8] — SFX ODM, lames, impacts, pas de Titans.
- F-AUD-04 [P3/P8] — Voix off facultative (lettres lues).
- F-AUD-05 [P3/P8] — Silence dramatique programmé.
- F-AUD-06 [P2/P8] — Mix ducking sur événements.
- F-AUD-07 [P3/P10] — Réglages d'accessibilité audio.
- F-AUD-08 [P3/P8] — Musiques par faction.

## 18. SAUVEGARDE, META, STATISTIQUES (SYS)

- F-SYS-01 [P1/P0] — Sauvegarde/chargement fiable (IndexedDB).
- F-SYS-02 [P1/P0] — Export/import de sauvegarde fichier.
- F-SYS-03 [P2/P1] — Sauvegardes automatiques rotatives.
- F-SYS-04 [P2/P1] — Versionnage des saves avec migration.
- F-SYS-05 [P2/P9] — Statistiques de partie (graphiques).
- F-SYS-06 [P2/P9] — Succès/accomplissements sobres (« Distinctions »).
- F-SYS-07 [P3/P9] — Mode ironman (une sauvegarde).
- F-SYS-08 [P3/P9] — Mode chronique : journal des décisions.
- F-SYS-09 [P2/P1] — Replays par commandes enregistrées.
- F-SYS-10 [P3/P10] — Écran « à propos » avec licences.

## 19. MODDING ET OUTILS (DEV)

- F-DEV-01 [P1/P0] — Données en JSON, validation Zod, messages d'erreur clairs.
- F-DEV-02 [P2/P1] — Éditeur de carte intégré (polygones, POI).
- F-DEV-03 [P2/P5] — Éditeur d'événements visuel.
- F-DEV-04 [P2/P3] — Éditeur de personnages/officiers.
- F-DEV-05 [P2/P9] — Simulateur d'équilibrage `sim:balance`.
- F-DEV-06 [P2/P0] — Console debug (commandes de triche et diagnostic).
- F-DEV-07 [P2/P0] — Overlays de debug (influence, portées, ancrages).
- F-DEV-08 [P3/P10] — Support de mods (dossiers `mods/`).
- F-DEV-09 [P3/P10] — Rechargement à chaud des données.
- F-DEV-10 [P2/P0] — Tests de déterminisme automatisés.
- F-DEV-11 [P3/P9] — Génération de rapports d'équilibrage HTML.
- F-DEV-12 [P3/P10] — Profileur intégré (ticks, rendu).

## 20. ACCESSIBILITÉ (ACC)

- F-ACC-01 [P2/P10] — Taille de police ajustable.
- F-ACC-02 [P2/P10] — Contrastes AA minimum, mode daltonien.
- F-ACC-03 [P2/P10] — Réduction des secousses/flashs.
- F-ACC-04 [P2/P10] — Sous-titres des sons importants.
- F-ACC-05 [P3/P10] — Navigation clavier complète.
- F-ACC-06 [P3/P10] — Vitesse de jeu et pause facilitées.
- F-ACC-07 [P3/P10] — Aide à la lecture (police dyslexie facultative).
- F-ACC-08 [P3/P10] — Options de difficulté fines.

## 21. LORE ET ARCHIVES (LOR)

- F-LOR-01 [P1/P10] — Onglet Archives avec statuts [C]/[A]/[?] sous forme de tampons.
- F-LOR-02 [P2/P10] — Fiches de lieux, personnages, organisations.
- F-LOR-03 [P2/P10] — Chronologie interactive.
- F-LOR-04 [P3/P10] — Glossaire (Titans, ODM, termes).
- F-LOR-05 [P3/P10] — Notes de l'utilisateur sur le lore (annotations personnelles).
- F-LOR-06 [P2/P10] — Alertes de contradiction avec le lore (mode dev).
- F-LOR-07 [P3/P10] — Découvertes progressives du lore (sécrets débloqués).
- F-LOR-08 [P3/P10] — Bibliothèque de documents d'époque (lettres, journaux).
- F-LOR-09 [P1/P2] — **Fenêtres de présence** des personnages (arrivée et sortie canon, événement de sortie) ; avertissement quand le joueur dévie.
- F-LOR-10 [P2/P10] — **Rapport de cohérence canon** (`npm run canon:check`) : détecte les anachronismes (ex. Lances de foudre avant fin 850, Utgard utilisé après sa destruction, personnage actif après sa mort canon).

## 22. RÈGLES DE MISE EN ŒUVRE

1. **Aucune fonction ne doit contredire un pilier** (fichier 00 §2).
2. **Chaque fonction P1** doit avoir un test automatisé ou un critère d'acceptation vérifiable.
3. **Chaque fonction P2/P3** peut être livrée dans une phase ultérieure, mais son **emplacement dans l'architecture** doit être prévu dès le début (hooks, événements, schémas).
4. **Chaque fonction touchant au lore** doit citer les faits utilisés dans `CANON_CHECK.md`.
5. **Aucune fonction ne doit créer un look « template »** (voir fichier 04 §2).



