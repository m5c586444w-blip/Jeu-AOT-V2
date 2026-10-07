# 21 — PLAN DE 10 JOURS (MAX 5x) : TERMINER SANS DÉRIVER

> Ce fichier **complète et, en cas de conflit, prime sur** le fichier 20 (périmètre, arrêts) et sur le fichier 18 (ordre des phases).
> Objectif des 10 jours : un jeu **jouable de bout en bout**, fidèle au lore, avec **déplacements militaires (façon *War on the Sea*), artillerie pour Paradis et Marley, bataille en 3D, lieux principaux faits à la main**. Le reste est reporté (§6), pas abandonné.
> Je ne peux pas garantir que tout tienne : voir les points de contrôle (§5) et la règle de repli.

---

## 1. AVANT DE PAYER (J0, 1 heure, gratuit)

1. **Jouer 20 minutes en 2D** (`npm run dev`, dossier `Murs-et-Sang`). Notez trois choses qui vous plaisent et trois qui vous déçoivent, et envoyez-les-moi. Si la 2D vous déçoit autant que le 3D, on change de plan avant de dépenser.
2. Déposer les fichiers **20 et 21** dans le dépôt, dans `docs/spec/` (dites à Claude Code de les committer, ou faites-le vous-même).
3. Réseau du cloud : repasser de « Complet » à « Personnalisé » (`polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org` + liste par défaut). Les textures sont déjà dans le dépôt : ce n'est plus nécessaire en Complet.
4. Relever dans Réglages > Utilisation le **pourcentage de quota hebdomadaire** avant de commencer (le point de départ des mesures du §5).
5. **Acheter Max 5x quand tout cela est prêt**, pas avant (les jours courent dès l'achat). Activer les crédits avec un **plafond de 30 €** en réserve.

---

## 2. RÈGLES ANTI-DÉRIVE (à coller dans CLAUDE.md, en plus du §9 du fichier 20)

```
## Règles de budget (décision de l'utilisateur, plan de 10 jours)
- Une phase = une session. Phase terminée = critères essentiels en OK ; le reste va dans docs/reports/dette.md. Jamais de sous-phase.
- Plafonds de tours par phase (voir le /goal de chaque phase). Au plafond : écris l'état dans PROGRESS.md, liste ce qui manque en dette, commite, ARRÊTE-TOI. Ne continue pas « un peu plus ».
- Un critère échoue deux fois : ne t'arrête pas (cela bloque la nuit). Note-le en dette avec la cause mesurée, passe à la tâche suivante. SEULE exception : un critère « bloquant » (verify, déterminisme/sim:selftest, sauvegardes, canon:check) : alors arrêt.
- Interdit : nouvel outil de mesure ; optimiser le rendu logiciel ; refaire un environnement déjà accepté ; polir une capture au-delà du défaut visé.
- Interdit : relancer verify plus d'une fois par tâche sans changement de code ; relancer une mesure sans correctif.
- Captures : au plus 12 par phase ; chacune lue avec l'outil d'image (3 lignes + 3 défauts) ; pas de planches « avant/après » pour tout.
- Rapports : 150 lignes maximum ; sorties collées seulement pour les commandes de critère.
- Chaque tâche : d'abord le plus petit changement qui satisfait le critère. Pas de refonte « au passage ».
- Lore : voir §9 du fichier 20 (jamais de nom ou chiffre inventé présenté comme canon).
```

---

## 3. PÉRIMÈTRE RÉDUIT (remplace les listes LC-B, LC-C, LC-D du fichier 20)

**Lieux faits à la main (N1), 7 en tout :**
1. **Shiganshina** + les **trois autres districts du mur Maria** (R1e).
2. **Trost** (mur Rose, porte sud, quartier général, rails et canons de rempart).
3. **Mitras** : château royal (plan, élévations, cour, salle d'audience), cathédrale, place du palais.
4. **Château d'Utgard** (états avant et après 850).
5. **Forêt des Arbres Géants**.
6. **Liberio** (Marley) : ghetto, port, quartier de l'armée.
7. **Un fort du front** (artillerie lourde, tranchées), qui sert aussi à la phase PA.

Tous les autres lieux du fichier 06 passent en **N2** (générés une fois, figés, §4 du fichier 20), avec un dossier court. Karanes, Utopia, Krolva, Stohess, Orvud, Ehrmich, Yarckel et la ville souterraine sont donc **reportés** (v2), pas oubliés.

Le §3 du fichier 20 (murs, portes, châteaux) reste **entièrement** exigé pour ces 7 lieux.

---

## 4. LES PHASES, DANS L'ORDRE (une session chacune)

| Jours | Phase | Effort | Plafond de tours | Arrêt de revue |
|---|---|---|---|---|
| J1–J2 | **R1e** (fichier 20 §6 et §8, version J1) | xhigh | 200 | OUI (vous : 15 min) |
| J3–J4 | **R2** (fichier 18 §1) | xhigh | 200 | OUI (vous : jouer une bataille) |
| J5 | **PA** : artillerie + déplacements militaires (§7 ci-dessous) | xhigh | 180 | OUI (vous : tester) |
| J6–J7 | **LC-lite** : lieux 2 à 7 du §3, un après l'autre | high | 250 | non |
| J8 | **R3-lite** : Titans et figures (fichier 18 §2, version courte §8) | xhigh | 150 | non |
| J9 | **P9** : scénarios, IA, équilibrage (fichier 18 §9) | xhigh | 200 | OUI (vous : un scénario complet) |
| J10 | **P10-lite** + marge (fichier 18 §10, sans l'accessibilité fine) | high | 120 | non (livraison) |

**Modèle** : Sonnet 5.5 pour LC-lite et P10-lite ; Opus 5.5 pour R1e, R2, PA, R3-lite, P9 (phases où l'erreur coûte cher). Ne changez pas de modèle en cours de phase.

**Commandes `/goal` (une par phase, à coller après le prompt)** :
- R1e : `/goal R1e terminée : docs/reports/R1e.md avec critères CR1e-01 à 12 en OK ou en dette, PROGRESS.md « R1e terminée, arrêt de revue », verify code 0. S'arrête au plafond de 200 tours ou à un arrêt bloquant.`
- R2 : `/goal R2 terminée : la bataille réelle se joue en 3D sur Shiganshina, docs/reports/R2.md, verify code 0, sim:selftest code 0. Plafond 200 tours.`
- PA : `/goal PA terminée : docs/reports/PA.md, critères CPA-01 à 10 en OK ou en dette, verify code 0, sim:selftest code 0. Plafond 180 tours.`
- LC-lite : `/goal LC-lite terminée : lieux 2 à 7 du §3 du fichier 21, un rapport court par lieu, dette notée pour les manques, verify code 0. Plafond 250 tours.`
- R3-lite : `/goal R3-lite terminée : Titans de 3 à 15 m + 3 variantes de peau et de proportions, soldats Paradis et Marley, docs/reports/R3.md, verify code 0. Plafond 150 tours.`
- P9 : voir fichier 18 §9 (plafond 200).
- P10-lite : voir fichier 18 §10 (plafond 120).

---

## 5. POINTS DE CONTRÔLE DU BUDGET (vous, 2 minutes chacun)

Relevez le **% de quota hebdomadaire** (Réglages > Utilisation) à ces moments :

| Moment | Que faire |
|---|---|
| Fin de R1e | Notez X = % consommé par R1e. Si X > 25 %, passez à **LC-lite à 4 lieux seulement** (Trost, Mitras, Utgard, forêt). |
| Fin de R2 | Si le cumul R1e + R2 dépasse 50 %, **supprimez R3-lite** et gardez PA, LC-lite (4 lieux), P9. |
| Fin de PA | Si le cumul dépasse 70 %, ne lancez plus que **P9 puis P10-lite**. Activez ou relevez les crédits. |
| Quota hebdomadaire atteint | L'IA s'arrête jusqu'à la remise à zéro. Ne relancez pas en boucle : activez les crédits seulement pour **terminer la phase en cours**. |

**Règle de repli** : si, à J7, PA n'est pas faite, **abandonnez LC-lite et R3-lite** : un jeu complet avec artillerie et mouvements vaut plus que de beaux lieux sans jeu.

---

## 6. CE QUI EST REPORTÉ EN V2 (explicite, hors des 10 jours)

R4 (effets en bataille poussés), R5 (carte stratégique refaite), R6 (portraits et interfaces refaits), R7 (identités de faction, menu, épilogue), R8 (audio et retours), R9 (monde extérieur : Hizuru, Alliés), accessibilité fine de P10, districts N1 restants (Karanes, Utopia, Krolva, Stohess, Orvud, Ehrmich, Yarckel, ville souterraine, chapelle Reiss), rendu des Titans « dérangeant » au plus haut niveau (T1 complet). La 2D déjà faite (P1 à P8) reste l'interface du jeu.

---

## 7. PROMPT DE LA PHASE PA : ARTILLERIE ET DÉPLACEMENTS MILITAIRES

À coller dans une session neuve, avec `/effort xhigh` :

```
PHASE PA : ARTILLERIE (PARADIS ET MARLEY) ET DÉPLACEMENTS MILITAIRES SUR LA CARTE.
Exception à « src/sim inchangé » : PA peut modifier src/sim et data/, de façon ADDITIVE, déterministe (graine, pas de Math.random ni Date.now), avec tests et sim:selftest au code 0. Les anciennes parties gardent leur hash tant qu'elles n'emploient pas les nouvelles règles.
Règles communes : CLAUDE.md (dont les règles de budget), un commit par tâche, verify avant chaque commit.
Lis d'abord, en entier : docs/spec/02 (systèmes), 03 (combat), 10 (catalogues d'unités), 11 (audit lore : prime), 12 (événements), 13 (technologies), docs/reports/P4 à P8 (ce qui existe), data/units/*.json, data/techs/*.json. Puis écris docs/phases/PA.md (une page : ce qui existe déjà, ce qui manque, tâches).

CONTEXTE : l'utilisateur veut (1) des déplacements militaires lisibles et stratégiques façon jeu de guerre navale/terrestre (ordres de mouvement, trajets, ravitaillement, interception, rencontres), et (2) de l'artillerie pour Paradis ET Marley, pas pour Marley seulement.

TÂCHES
 PA.1 Audit de l'existant (30 minutes de lecture, pas plus) : qu'est-ce qui existe déjà pour les déplacements (expéditions, flottes, armées) et pour l'artillerie ? Liste dans docs/phases/PA.md.
 PA.2 Déplacements : ordres de mouvement sur la carte stratégique (sélection, trajet affiché, vitesse selon terrain, gaz et vivres consommés, fatigue, moral). Détection et interception : deux unités ennemies qui se croisent déclenchent une rencontre résolue par la bataille tactique ou par un calcul rapide (au choix du joueur). Brouillard et renseignement : portée de vue. Marine : trajets maritimes, ports, blocus, débarquement (Marley, Alliés), escorte. Mur : garnison, relève, redéploiement.
 PA.3 Artillerie de Paradis [A selon le fichier 11] : canons de rempart (chemin de ronde), canons sur rails de Trost [C], artillerie de campagne, mortiers, munitions (boulets, mitraille, chaînes contre Titans), portée, cadence, dispersion, pénalité de moral, coût d'entretien. Respecter le calendrier technologique du fichier 11 : AUCUNE arme anachronique (les lances foudroyantes n'existent qu'à la fin de 850).
 PA.4 Artillerie de Marley : artillerie lourde et de campagne, artillerie navale (cuirassés et croiseurs), obusiers, train d'artillerie, entretien, ravitaillement en obus, tir de barrage, contre-batterie.
 PA.5 Intégration au combat tactique : unités d'artillerie en bataille (placement, tir indirect, zones de danger, effets sur Titans et soldats), visibles dans la scène (deux modèles simples par camp, détaillés plus tard).
 PA.6 Données : tout dans data/ (data/units/, data/artillery/…), Zod validé, canon: C/A/? sur chaque entrée ; aucune valeur de lore inventée présentée comme canon.
 PA.7 IA : Marley et Paradis utilisent déplacements et artillerie (règles simples, journal de raisonnement en debug).
 PA.8 Interface : ordre de mouvement, liste des unités en marche, alerte de rencontre, fiche d'artillerie ; style existant du jeu (pas de nouvel habillage).
 PA.9 Tests : déterminisme (même graine et mêmes commandes = même hash), un scénario d'invasion amphibie jouable, un siège avec artillerie.
CRITÈRES : CPA-01 verify code 0 ; CPA-02 sim:selftest code 0 ; CPA-03 canon:check code 0 et aucune arme anachronique ; CPA-04 un ordre de mouvement terrestre et un maritime fonctionnent (smoke) ; CPA-05 interception et rencontre ; CPA-06 artillerie des deux camps en bataille ; CPA-07 IA des deux camps l'emploie ; CPA-08 données validées ; CPA-09 déterminisme ; CPA-10 captures lues une par une.
Hors périmètre : refonte graphique de la carte, nouveau menu, audio.
ARRÊT DE REVUE : fin de PA. Je teste un déplacement, un siège et une rencontre.
```

---

## 8. VERSION COURTE DE R3 (R3-lite)

À la place du prompt complet du fichier 18 §2. Garder **uniquement** :
- Titans : galerie à 3, 5, 8, 12 et 15 m, **3 variantes de proportions** et **2 variantes de peau** par taille, dents et yeux crédibles, démarche non uniforme, silhouette dérangeante (jamais un mannequin lisse). Titan colossal, Titan-mur et Titan de Rod Reiss : **hors périmètre** si le budget manque (dette).
- Soldats : Paradis (Bataillon d'exploration, Garnison, Police militaire) et Marley (infanterie, officiers), tenue distincte, équipement visible.
- Poses et états : marche, course, chute, mort, attaque.
- Aucune retouche du corps humain de base (R1d).

---

## 9. ROUTINE QUOTIDIENNE (5 minutes)

1. Lire la dernière ligne de `docs/PROGRESS.md` et le tableau de critères du dernier rapport (pas le détail).
2. Ouvrir 2 captures au hasard : une qui devrait être belle, une qui devrait être un cas difficile.
3. Si une phase est terminée avec arrêt de revue : jouer 10 minutes à ce qu'elle a produit, puis me coller ce que vous avez vu (positif, négatif).
4. Si l'IA est arrêtée « à cause d'un échec » : me coller la raison, **ne pas relancer à l'identique**.
5. Relever le % de quota aux points du §5.

---

## 10. STATUT DES AFFIRMATIONS DE CE FICHIER (liste séparée)

**Sourcées** : tarifs, limites hebdomadaires et de session, crédits au tarif API (pages d'aide et de prix d'Anthropic, citées dans la conversation) ; lances foudroyantes à la fin de 850, canons sur rails de Trost (fichier 11).

**Interprétatives** : toutes les estimations de durée par phase et les plafonds de tours ; le pourcentage de quota (25 %, 50 %, 70 %) servant de seuil ; l'affectation Sonnet/Opus ; le contenu précis de PA (déplacements « façon *War on the Sea* », d'après votre demande, non défini plus finement) ; les sept lieux retenus.

**Non confirmées** : si 10 jours suffisent (aucune mesure de la consommation réelle) ; la taille exacte du quota hebdomadaire de Max 5x ; ce que le dépôt contient déjà comme déplacements et artillerie (audit PA.1 à faire).
