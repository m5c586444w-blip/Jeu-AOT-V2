# U14 — Implications pour le jeu

> Dossier d'univers V4 — fichier U14 de la série U00–U15 (sans U13). Étiquettes `[C]` `[I]` `[?]` : voir `U00_LISEZ_MOI.md`. **Ce fichier est le seul du dossier qui contient des choix de conception : ils sont étiquetés `A`** (convention du projet : `docs/v4/00_INDEX.md` §3). Rien ici n'est du lore.
> Il ne contient **aucune source externe nouvelle** : tout renvoie aux fichiers U01–U12 et aux documents du dépôt. **Abréviations de ce fichier** : `01` = `docs/spec/01_LORE_MONDE_CANON.md` ; `11` = `docs/spec/11_AUDIT_LORE_ET_CORRECTIONS.md` ; `12` = `docs/spec/12_EVENEMENTS_CANON.md` ; `26` = `docs/spec/26_MECANIQUES_THEORIQUES.md` ; `27` = `docs/spec/27_MULTIJOUEUR_9_JOUEURS.md` ; `V4-Dnn` = `docs/v4/04_REGISTRE_DES_DECISIONS.md` ; `data/` = les JSON du dépôt. Les « Ch. n » sont ceux cités par les pages de wiki, non relus.
> **Sources.** Aucune source nouvelle ; le registre des sources du dossier est `U15_REGISTRE_SOURCES_ET_INCERTITUDES.md` §1.
> **Statut : PROPOSÉ.** Chaque ligne de ce fichier est une proposition à valider par Gabriel ; aucune donnée du dépôt n'a été modifiée.

## 1. Règles de passage du dossier aux données

| # | Règle proposée (`A`) | Raison |
|---|---|---|
| R-1 | Un fait du dossier étiqueté `[C]` n'est **pas** automatiquement un fait canon du projet : `[C]` veut dire « rapporté par une page de wiki qui cite un chapitre ». Il ne devient `canon: "C"` dans `data/` que s'il est déjà dans `11` ou `01`, ou si Gabriel le valide (journal `D-nnn`). | Les pages sont des synthèses de fans, parfois tronquées ou contradictoires (U15). |
| R-2 | Un fait `[C]` du dossier absent de `11` entre dans les données avec `canon: "?"` et un champ de référence `source_ref` (ex. `"FW:Kenny_Ackerman"`). Il est promu en `C` par décision. | Traçabilité sans fausse certitude. Le champ est à ajouter au schéma Zod puis au schéma C# (V4-D05). |
| R-3 | Un fait `[I]` ou `[?]` du dossier n'entre jamais dans les données comme `C`. Un `[I]` utile devient `A` avec une raison ; un `[?]` devient un **paramètre** (valeur par défaut + alternatives), jamais une valeur unique. | Règle de `11` §8 point 3 : pas d'invention. |
| R-4 | Toute date ou durée dont le dossier donne deux valeurs (843/844, 250 000 / 20 %, 40 m / 120 m…) est codée comme **paramètre à deux valeurs**, choisie par scénario, et la raison est consignée. | Évite de trancher en silence. |
| R-5 | Les identifiants du dossier (`T-nnn`, codes `FW:`) ne sont **pas** des identifiants de données. Les événements restent `E01`–`E60` (`docs/spec/12_EVENEMENTS_CANON.md`). | En-tête de `U08`. |
| R-6 | Les noms inventés par le projet (créations autorisées, `docs/lore/creations.md`) ne sont **jamais** mêlés aux noms de ce dossier ; le dossier ne contient aucune création. | Ligne éditoriale (V4-D12). |

---

## 2. Corrections et ajouts proposés à `01`, `11` et `12`

Ordre de priorité du dépôt : `11` prime sur `12` et sur `01`. « Écart » ne veut pas dire « erreur » : le dossier n'a que des sources de seconde main (wiki).

| # | Document, passage | Texte actuel | Ce que dit le dossier | Proposition (`A`) |
|---|---|---|---|---|
| K-01 | `12` E50 | Guerre du Moyen-Orient « 851–854 » | FW:Marley_Mid-East_War et le Timeline : **850–854** (titre de la page donné par des fans). Le `11` §5 dit déjà « ≈ 850–854 ». `data/techs/marley.json` et `hizuru.json` utilisent `evt_851_middle_east_war`. | Corriger la date de E50 en 850–854. **Garder l'identifiant** de l'événement (stabilité des références) et corriger seulement son champ de date. |
| K-02 | `12` E48 | Visite d'Hizuru et chemin de fer « 851–852 ? » | Kiyomi rencontre Zeke entre 850 et 852 (intervalle) ; **visite de Paradis en 852** (FW:Kiyomi_Azumabito, FW:Timeline) ; chemin de fer : « 853 » (FW:Armin_Arlert), tandis que le `11` §5 écrit « ≈ 852–853 ». | Visite = 852 (`?` sur l'année exacte) ; chantier ferroviaire = paramètre 852/853. Idem pour `evt_851_hizuru_visit` (technologies d'Hizuru) : l'identifiant reste, la date change. |
| K-03 | `12` E31 | Kenny transmet un sérum à Levi avant de mourir `?` | FW:Kenny_Ackerman : il donne à Levi le sérum qu'il avait volé (U09). | Passer l'élément en `C?` (`source_ref`), sans toucher au reste. |
| K-04 | `12` E06 | Chiffre « ≈ 250 000 `?` » pour l'opération de 846 | Version manga / Timeline : « environ 20 % de la population de Paradis », dont le grand-père d'Armin ; version anime : « environ 250 000 » réfugiés (U08 T-044 ; FW:Timeline ; WP:S1 ép. 2). Les deux chiffres ne sont pas conciliables sans la population totale, qui est inconnue. | Paramètre à deux valeurs : « part de la population » (20 %) ou « nombre » (250 000), selon la version suivie. |
| K-05 | `12` E35 | Rod Reiss « ≈ 120 m » | FW:Rod_Reiss cite 120 m **et** 40 m au garrot sans les relier. | Hauteur = paramètre (120 m par défaut ; 40 m en variante). |
| K-06 | `11` §1 | Utgard « détruit en 850 » | FW:Utgard_Castle : une tour est **abattue par Ymir** ; l'état du château ensuite n'est pas indiqué. | Garder la règle « Utgard n'est plus utilisable après E26 » **mais** comme règle de jeu `A`, non comme fait `C`. |
| K-07 | `11` §3 | Hannes « Titan souriant » | FW:Clash_of_the_Titans_arc : **dévoré** (Ch. 50), en défendant Eren et Mikasa ; FW:Dina_Fritz : Dina l'a tué, mais la même page écrit aussi qu'il a été dévoré. | Mort en 850 : `C`. Cause : `?` (Dina n'est pas écartée). |
| K-08 | `11` §9 point 1 | Morts d'Eld, Gunther, Oluo, Petra, Moblit, Nick, Sasha, Magath, Shadis « à vérifier » | **850** : Eld, Gunther, Oluo, Petra (57ᵉ expédition, FW:The_Female_Titan_arc) ; **850** : Moblit (explosion du Colossal à Shiganshina, FW:Moblit_Berner) ; **850** : Nick (FW:Wall_Rose_invasion, FW:Royal_Government_arc) ; **854** : Sasha (Liberio, FW:Sasha_Blouse) ; **854** : Magath et Shadis « morts au port » (FW:Battle_of_Heaven_and_Earth), mais leurs fiches personnelles ne confirment pas. | Écrire les dates ci-contre avec `source_ref` ; Magath et Shadis restent `?` tant que les fiches ne confirment pas. |
| K-09 | `11` §3-4 | Ymir (stagiaire) mangée par Porco « entre 850 et 854 `?` » | FW:Porco_Galliard : « 850 : l'opération est abandonnée, Galliard consomme Ymir » ; le Timeline : « inconnu ». | Paramètre : « vers 850 ». |
| K-10 | `11` §4 | Mâchoire : Marcel « 843–845 » | FW:Warrior_Unit : héritage en **844** ; FW:Reiner_Braun et FW:Porco_Galliard : **843**. | Paramètre 843 / 844 pour **tous** les héritages de la génération de Reiner (cohérence entre Titans). |
| K-11 | `11` §6 | « Blindés, sous-marins, gaz de combat (Marley) non confirmés » | Les **trains blindés** (alliés) et la **tourelle de 100 mm** sont documentés (U06 §8). Les chars routiers, sous-marins et gaz de combat de Marley ne le sont pas. | Scinder la ligne : trains blindés = `C?` ; chars, sous-marins, gaz = `?` (inchangé). |
| K-12 | `11` §5, `12` | « Alliance mondiale anti-Eldia » | Le Timeline écrit « A Global Alliance forms » ; FW:Raid_on_Liberio parle de « nations promettant une alliance militaire mondiale » ; **composition non indiquée** (U07 §10). | Nom d'usage « Alliance mondiale » (commodité), composition paramétrable ; ne pas l'afficher comme nom officiel. |
| K-13 | `11` §9 point 7 | Durée du Grondement « jusqu'en 857 selon une source » | Le Timeline donne le Grondement en « jours 1 à 4 » ; 857 est l'année où les ambassadeurs naviguent (« trois ans plus tard »). | Séparer : Grondement = quelques jours (`C?`) ; 857 = pourparlers. |
| K-14 | `11` §9 point 3 | « 743 » donné par une chronologie de seconde main | Trois pages du même wiki concordent (Timeline, Paradis_Island, Great_Titan_War_(Anime)) et 743 + 107 = 850 (U02 §4.5). Toujours aucune source officielle. | Garder `?` mais noter « 3 pages concordantes ». |
| K-15 | `01`/`11` | « 7 Titans pris par Marley » et « 6 Guerriers » | Les pages disent à la fois « sept » (Nine_Titans) et « six » (Warrior_Unit, Timeline) ; conciliation par la direction : 6 + le Marteau des Tybur (`[I]`, U01 §3). | Données : `marley_titans = 7`, dont `war_hammer.holder_family = "tybur"` ; `warrior_slots = 6`. Raison consignée. |
| K-16 | `11` §3 | Fenêtres de présence | Voir §3 du présent fichier (écarts entre `data/characters/` et le dossier). | — |
| K-17 | `11` §4 | Colossal « Bertholdt (845) → Armin (850) » | Cohérent. Ajout : Armin le reçoit en **mangeant Bertolt** (FW:Battle_of_Shiganshina_District, WP:Chars) après que le sérum de Levi l'a sauvé ; c'est le choix E42. | Aucune correction. |
| K-18 | `12` E55 | « Eren hérite du Marteau de guerre » | FW:Lara_Tybur : Eren broie le cristal puis **dévore** Lara et obtient le pouvoir du Marteau de guerre ; FW:Raid_on_Liberio : « la mort de Lara nourrit son Titan » ; U01 §3 : Lara → Eren (854). | Aucune correction ; conserver la mention de la source. |


---

## 3. Fenêtres de présence : écarts entre `data/characters/*.json` et le dossier

Constat fait en lisant les champs `active_from`, `active_until` et `death_event` des fichiers `paradis.json` et `world.json`. Les autres personnages (fonctionnaires, officiers de la Garnison…) n'ont pas de fiche dans ce dossier et ne sont pas traités.

| Personnage (`id`) | Données actuelles | Dossier (source) | Écart | Proposition (`A`) |
|---|---|---|---|---|
| `char_moblit_berner` | jusqu'à : vide ; mort : vide | 850, Shiganshina (FW:Moblit_Berner, FW:Battle_of_Shiganshina_District) | oui | `active_until: 850` ; `death_event: evt_850_shiganshina_battle` |
| `char_pasteur_nick` | vide ; vide | 850 (FW:Wall_Rose_invasion, FW:Royal_Government_arc) | oui | `active_until: 850` ; événement de l'arc du gouvernement royal |
| `char_sasha_blouse` | jusqu'à 854 ; mort : vide | 854, Liberio (FW:Sasha_Blouse, FW:Raid_on_Liberio) | partiel | `death_event: evt_854_liberio_raid` |
| `char_hange_zoe` | jusqu'à 854 ; mort : vide | 854, Grondement (FW:Hange_Zoë, FW:Rumbling) | partiel | `death_event` = événement du Grondement (E59 ; U10) |
| `char_keith_shadis` | vide ; vide | 854 « au port » (FW:Battle_of_Heaven_and_Earth) ; non confirmé par sa fiche | oui | `active_until: 854` **paramétrable** (`?`) |
| `char_theo_magath` | vide ; vide | idem (page de bataille) ; sa fiche ne l'enregistre pas | oui | idem (`?`) |
| `char_ymir` | vide ; vide | quitte Paradis en 850 (FW:Timeline) ; mangée par Porco vers 850 (K-09) | oui | `active_until: 850` côté Paradis |
| `char_porco_galliard` | vide ; vide | sacrifice et dévoré par Falco à Shiganshina, 854 (FW:War_for_Paradis_arc, Ch. 119) | oui | `death_event: evt_854_marley_counterattack` |
| `char_colt_grice` | vide ; vide | tué au Ch. 119 pendant la riposte de Marley à Shiganshina, par l'explosion de la transformation de Falco (FW:Colt_Grice) ; **désigné prochain héritier du Bestial, sans l'avoir reçu** | oui | `active_until: 854` ; `death_event: evt_854_marley_counterattack` (E58) ; statut « héritier désigné du Bestial » |
| `char_zeke_yeager` | vide ; vide | mort pendant le Grondement (FW:Zeke_Yeager, FW:Battle_of_Heaven_and_Earth) | oui | `death_event` = événement du Ciel et de la Terre (E60) |
| `char_annie_leonhart` | vide ; vide | cristallisée à la fin de la 57ᵉ expédition (E22), libérée en 854 (FW:Annie_Leonhart) | oui | fenêtre d'**indisponibilité** 850–854 (état « cristal »), sans mort |
| `char_yelena`, `char_onyankopon` | `active_from: 845` | arrivent à **Paradis en 851** (FW:Yelena, FW:Onyankopon ; `11` §5) | oui | garder 845 comme présence côté Marley, ajouter une arrivée à Paradis en 851 (`arrives_at`) |
| `char_falco_grice` | `active_from: 853` | l'année de naissance est inconnue ; hérite de la Mâchoire en 854 | `?` | pas de correction sans date de naissance |
| Erwin, Mike, Nanaba, Gelgar, Hannes, Eld, Gunther, Oluo, Petra, Rod, Kenny, Zackly, Pixis, Nile, Willy, Lara, Bertolt | conformes | conformes (U11, U12) | non | rien |

> `char_levi_ackerman`, `char_reiner_braun`, `char_jean_kirstein`, `char_connie_springer`, `char_armin_arlert`, `char_mikasa_ackerman`, `char_eren_yeager`, `char_historia_reiss` : aucune sortie avant la fin de 857 dans le dossier ; Eren meurt en 854 (le champ de mort d'Eren est à vérifier côté données).

---

## 4. Titans et héritage

| # | Fait du dossier | Source | Implication proposée (`A`) |
|---|---|---|---|
| T-1 | Chaque porteur d'un des Neuf meurt environ 13 ans après l'héritage (« Malédiction d'Ymir »). Les chaînes de D11 §4 respectent 13 ans (819→832→845 ; 829→842 ; 842→854…). | U01 §5 ; U08 §5 | C'est déjà le pilier **P5 (« L'Horloge »)** de `26`. Le compteur est une **donnée** par porteur (`inherited_year`), pas une durée codée en dur. Un porteur qui dépasse 13 ans est un cas de divergence signalé. |
| T-2 | Le Fondateur ne s'exerce pleinement que par le **sang royal** ; un porteur non royal l'utilise en touchant un Titan de sang royal (Eren, par Zeke). | U01 §5.1, §6.2 | La condition de sang royal est un champ de la chaîne d'héritage ; le « contact avec un royal » est une condition d'activation explicite. |
| T-3 | Les Ackerman et le « clan asiatique » résistent à la manipulation de mémoire. | U01 §8 | Immunité à l'effet « effacement de mémoire », rattachée au pilier **P6 (« La Vérité »)** de `26`. L'origine des Ackerman est **contestée** : ne pas l'afficher comme un fait. |
| T-4 | Un porteur est dévoré par son successeur (ou se laisse dévorer). | U01 ; U11 ; U12 | Transmission par commande « consommer » (Titan pur ou porteur) avec condition de contact ; jamais par un jet de dés seul. |
| T-5 | Les Titans purs dépendent du soleil et sont inactifs sans lui (Ch. 20) ; les Neuf Titans et les Titans commandés par le Bestial de Zeke n'en ont pas besoin (« actifs la nuit », Utgard). | U01 §5.1, §7.1 ; FW:Utgard_Castle | Cohérent avec le pilier **P2 (« La Marée »)** de `26` (la marée s'apaise la nuit) ; ajouter l'exception « Titans de Zeke et porteurs » comme règle explicite. |
| T-6 | Le Grondement libère les Titans des Murs ; la mort d'Eren met fin au pouvoir des Titans. | U10 ; U01 §10 | Fin de scénario scriptée ; le jeu ne propose pas de « Titans après 857 ». |
| T-7 | `27` : les porteurs sont commandés directement par leurs joueurs jusqu'à une « époque charnière » (« ≈ 854, à confirmer dans 11 et 12 », seuil = paramètre de données), puis deviennent des atouts spéciaux sous ordres généraux. Le dossier appuie 854 comme année de bascule : Slava (artillerie de 100 mm, trains blindés, Cuirassé gravement atteint : U06 §8), Magath qui juge la technologie moderne capable de rendre les Titans obsolètes (FW:Marley_arc ; U10), fusils anti-Titan, dirigeables. | `27` ; U06 §8 ; U10 | Confirmer 854 comme **valeur par défaut du seuil** (paramètre) ; question Q-3. |

---

## 5. Scénarios et sièges (propositions)

Scénarios existants dans `data/scenarios/` : `sandbox_845`, `sandbox_850`, `scn_854`.

| Départ | Contexte du dossier | Camps jouables (`A`) | Contraintes de présence | Écarts à traiter |
|---|---|---|---|---|
| **845** (chute de Maria) | Brèche de Shiganshina ; Warriors sur Paradis ; Shadis cède le commandement à Erwin le jour même ; la famille royale cachée est massacrée par Grisha (E03) | Paradis (conseil des Murs) ; Marley (Guerriers) | Eren, Mikasa, Armin sont des enfants ; Frieda, Grisha, Carla sortent à 845 ; Marcel est dévoré le premier jour | K-10 (843/844) |
| **846** (reconquête) | Opération qui élimine une partie de la population (20 % ou 250 000) | Paradis | idem | K-04 |
| **847–849** (formation) | 104ᵉ promotion ; Kenny crée l'escouade anti-personnel (847) ; Levi et Hange trouvent le journal d'Ilse (849) ; Zeke commence à distribuer son liquide (849) | Paradis (administration) | — | peu de sources datées |
| **850** (Trost) | Brèche de Trost, 57ᵉ expédition, invasion de Rose, coup d'État, Orvud, Shiganshina | Paradis ; Marley (opération de reprise du Fondateur) | morts de 850 (§3) | K-06, K-07, K-08 |
| **851–853** (après Shiganshina) | Port, océan, première flotte marleyenne (851), Volontaires, Hizuru (852), guerre du Moyen-Orient (850–854) | Paradis ; Marley ; Hizuru | Yelena et Onyankopon à Paradis dès 851 | K-01, K-02 |
| **854** (Liberio → Grondement) | Raid sur Liberio, coup yeagériste, contre-attaque de Marley, Grondement, Ciel et Terre | Paradis ; Marley ; Yeagéristes ; Volontaires | morts de 854 (§3) | K-08, K-13 |
| **857** (pourparlers) | Ambassadeurs de la paix ; Historia et Kiyomi attendent | Diplomatie uniquement `A` | — | Gabriel décide s'il existe |

**Camps et sièges (`27`).** Dans le dossier, les camps réels sont : le gouvernement royal des Murs (façade, réel et gestion : U04) ; les trois corps (U05) ; la Marley des Tybur et de son armée (U07) ; les Guerriers (programme à part, U07 §3) ; les Volontaires anti-marleyens (sous-faction de Marley, U07 §8) ; Hizuru (U07 §11) ; les Forces alliées du Moyen-Orient (ennemies de Marley, jouables en IA uniquement, `A`) ; les Yeagéristes (faction **interne** de Paradis qui se détache en 854, U10). Les sièges multiples d'une faction doivent respecter `owner` (V4-D22).

---

## 6. Mécaniques que le lore permet (propositions `A`)

| Mécanique | Ancrage dans le dossier | Idée de règle | Donnée à créer |
|---|---|---|---|
| **Politique d'information** | Karl Fritz efface les souvenirs ; les Ackerman et le clan asiatique résistent (U02 §4.2, U01 §8) ; Erwin soupçonne l'altération des mémoires (U11) | Un « niveau de connaissance du monde » par faction et par siège ; les révélations (sous-sol de Grisha, chapelle Reiss, Titans des Murs) le font monter | `knowledge_level` par faction et par siège |
| **Pouvoir à trois étages** | façade / réel / gestion (U04) | Trois jauges d'influence par institution | `power_tier` |
| **Police parallèle** | Première Brigade intérieure, escouade anti-personnel (847) (U05 §4) | Une institution dont les ordres échappent au conseil | `parallel_police` |
| **Citoyenneté et ville souterraine** | surface contre souterrain, mobilité bloquée (U03 §4, U04) | Classe sociale à mobilité conditionnelle ; réfugiés envoyés au sous-sol en cas de crise | `citizenship_status` |
| **Crises alimentaires** | chute de Maria, réfugiés, disette de 846 (U09 ; E05–E07) | Cycle de rationnement ; opération de 846 comme choix | événements existants |
| **Propagande** | Helos, héros inventé (U02 §4.5, U07 §2) | Action de propagande ; un récit d'État peut être « démasqué » | `narrative_state` |
| **Programme des Guerriers** | brassards jaune/rouge, terme de 13 ans (U07 §3) | File de candidats et d'héritiers ; coût d'un héritage | `warrior_pipeline` |
| **Zones d'internement** | Liberio, brassards, analyses de sang, PSA (U07 §1, §5) | Contrôle de population de Marley ; risque de révolte | `internment_zone` |
| **Technologie par événement** | Lances de foudre fin 850, ODM refondu ≈ 854, bateau volant 852–853 (U06 §10) | `unlock_event` obligatoire pour les technologies tardives (D11 §7) | champ existant |
| **Alliances d'opportunité** | Volontaires, Hizuru et la pierre à éclatement de glace (U07 §8, §11 ; U06 §2) | Traités à conditions asymétriques | `treaty` |
| **Guerre de trois fronts** | guerre du Moyen-Orient pendant que Marley surveille Paradis (U07 §9 ; flotte interceptée en 851) | Marley gère deux fronts ; la pression sur Paradis dépend de la guerre | `front` |

> **Ton.** Plusieurs de ces mécaniques représentent des persécutions (internement d'un peuple, effacement de mémoire, massacres). Le dossier les rapporte comme des faits de l'œuvre ; le jeu doit les traiter avec le même sérieux, sans les rendre plaisantes ni les présenter comme un mode d'emploi. Décision à confirmer par Gabriel (voir §8).

---

## 7. Technologie : écarts avec les données

Le tableau de déblocage est dans `U06` §10 (colonne « règle de jeu proposée »). Écarts relevés :

| # | Donnée actuelle | Dossier | Proposition (`A`) |
|---|---|---|---|
| TE-1 | `evt_851_middle_east_war` (techs Marley et Hizuru) | guerre 850–854 (K-01) | garder l'identifiant, corriger la date |
| TE-2 | `evt_851_hizuru_visit` | visite 852 (K-02) | idem |
| TE-3 | `evt_850_thunder_spears_first_use` pour les Lances de foudre | première utilisation à Shiganshina, fin 850 (FW:Thunder_Spear ; U06 §3) | conforme |
| TE-4 | `tech_allied_countermeasures` (T-ANT-13, `paradis.json`, `evt_854_fort_slava`, année minimale 854) | Slava est en 854 (FW:Fort_Slava) ; artillerie de 100 mm et trains blindés alliés (U06 §8). `12` (liste des technologies) la décrit comme « côté Marley » mais le fichier est `paradis.json` | vérifier quelle faction la détient ; conforme sur la date |
| TE-5 | Chars, sous-marins, gaz de combat | `?` (K-11) | ne pas créer sans décision |

---

## 8. Décisions demandées à Gabriel

| # | Question | Défaut proposé |
|---|---|---|
| Q-1 | Valider R-1 et R-2 (champ `source_ref`) | oui |
| Q-2 | Hange : l'auteur laisse le genre **volontairement ouvert** (FW:Hange_Zoë). Textes joueur neutres, ou choix d'une forme ? | formulation neutre quand c'est possible ; sinon choix `A` consigné |
| Q-3 | Seuil de l'« époque charnière » (`27`) pour les porteurs commandés par leurs joueurs (T-7) | 854, comme paramètre de données |
| Q-4 | Scénario 857 (diplomatie) : le créer ? | non |
| Q-5 | Appliquer K-01 à K-18 en une passe, avec une décision `D-nnn` | oui |
| Q-6 | Ton des mécaniques de persécution (§6) | sérieux, sans mode d'emploi |
| Q-7 | Hizuru : « nation en difficulté économique » (`11` §5) est une paraphrase de la page ; la conserver ? | oui, avec `source_ref` |

---

## 9. Ce que le dossier ne permet pas de décider

Populations, économie, portée des armes, consommation de gaz, distances entre murs, plan des villes : **aucune source**. Toute valeur est `A`, dans `/data` (jamais en dur), avec raison. Voir `U15` pour la liste complète des lacunes.
