# 06 — Commande vocale des escouades

> Statut : **PROPOSÉ**, faisabilité **PAR SPIKE (S3)**. Dépend de : `04` (V4-D10, V4-D19, V4-D21), `02` §5, `05` S3.
> Principe : la voix est une **entrée parmi d'autres**. Elle produit la même commande typée que le clavier ; tout ce qui se dit se fait aussi sans voix (accessibilité, repli si S3 échoue).
> Aucun moteur de reconnaissance n'est choisi ici : les candidats ci-dessous sont des **pistes à évaluer en S3**, leurs licences et leur qualité en français sont **à vérifier** (je ne les ai pas vérifiées).

## 1. Contrat

| Point | Règle `[A]` |
|---|---|
| Déclenchement | appui-pour-parler (une touche maintenue). Pas d'écoute permanente. |
| Où tourne la reconnaissance | **sur le PC du joueur**, hors ligne. L'audio n'est ni envoyé, ni conservé (V4-D21). |
| Sortie | une **commande typée** `{seat, tick, kind, payload}` (`02` §5) ou un refus explicite. Seule cette commande va au réseau. |
| Portée | uniquement les unités dont le joueur est `owner` (D-168). « Escouade Hange » ne désigne rien si elle n'appartient pas à son siège. |
| Grammaire | **fermée** : environ 60 énoncés-types (section 3) avec variantes. Pas de texte libre, pas de modèle de langage en V1. |
| Retour | à chaque énoncé : texte reconnu affiché, commande interprétée affichée, accusé de l'unité (texte, son bref). Sous-titres obligatoires. |
| Latence | fin de phrase → commande émise : **médiane ≤ 1,5 s** `[A]` (mesure S3). |
| Exactitude | **≥ 90 %** de commandes correctes sur 100 énoncés `[A]` (mesure S3). |
| Charge | ≤ 1 cœur en moyenne, sans ralentir le rendu (mesure S3). |
| Repli | menu radial + raccourcis clavier pour **chaque** commande. Si la voix échoue ou est coupée, rien n'est perdu. |
| Sécurité | un énoncé ambigu n'exécute rien : l'interface demande de confirmer (touche) ou de répéter. |

## 2. Chaîne de traitement

```
 micro ─▶ capture (touche tenue) ─▶ moteur de reconnaissance local ─▶ texte brut
                                                                        │
              retour visuel + accusé ◀── Command (typée) ◀── analyse par grammaire
                                              │                  (résolution des références)
                                              ▼
                                   journal de commandes ─▶ réseau (si multijoueur)
```
- Le projet `Voice` contient : la **grammaire**, l'**analyse** (texte → intention), la **résolution des références** (« mon escouade de gauche », « celle-là ») et le pont vers le moteur de reconnaissance. Il dépend de `Sim` uniquement pour les types de commandes. Il ne modifie jamais l'état.
- La résolution des références utilise l'état visible **par le siège local** (brouillard compris) : on ne peut pas viser par la voix une unité qu'on ne voit pas.
- La capture audio vit dans `game/` (Godot) ; le texte brut est transmis à `Voice`. Les tests de `Voice` partent du **texte** (pas de l'audio) : ils tournent dans le nuage, sans micro.

## 3. Grammaire d'essai (60 énoncés-types) `[A]`

Chaque ligne : énoncé-type (des variantes synonymes sont acceptées), commande résultante, paramètres. Les noms de commandes sont des propositions ; ils sont fixés en M5 avec `Tactical`.

### 3.1 Sélection et références (8)
| # | Énoncé | Effet |
|---|---|---|
| 1 | « Escouade [nom] » / « Section [n] » | sélectionne par nom ou numéro |
| 2 | « Toutes les escouades » | sélectionne tout ce qui m'appartient |
| 3 | « Mon escouade de gauche / de droite / de devant » | sélection relative à la vue |
| 4 | « Celle-là » | sélection de l'unité pointée par le curseur |
| 5 | « Les blessés » | filtre par état |
| 6 | « Les tireurs / les éclaireurs / les lames » | filtre par rôle |
| 7 | « Annule la sélection » | vide la sélection |
| 8 | « Reprends mon soldat » | repasse au niveau combattant sur le soldat incarné |

### 3.2 Déplacement (10)
| # | Énoncé | Commande |
|---|---|---|
| 9 | « Avancez » | `Order.Move` vers l'avant de l'escouade, courte distance |
| 10 | « Repliez-vous » | `Order.Fallback` vers le point de repli désigné |
| 11 | « Tenez la position » | `Order.Hold` |
| 12 | « Allez là-bas » | `Order.Move` vers le point visé par le curseur |
| 13 | « Allez à [lieu] » | `Order.Move` vers un repère nommé (porte, tour, place) |
| 14 | « Suivez-moi » | `Order.Follow` le soldat incarné |
| 15 | « Montez sur le toit / sur le mur » | `Order.Move` avec ancrage vertical |
| 16 | « Descendez » | `Order.Move` au sol |
| 17 | « Contournez par la gauche / la droite » | `Order.Flank` |
| 18 | « Dispersez-vous » | `Order.Spread` |

### 3.3 Formations (6)
| # | Énoncé | Commande |
|---|---|---|
| 19 | « En ligne » | `Formation.Set(line)` |
| 20 | « En colonne » | `Formation.Set(column)` |
| 21 | « En cercle autour de [cible] » | `Formation.Set(ring, target)` |
| 22 | « En V » | `Formation.Set(wedge)` |
| 23 | « Serrez les rangs » | `Formation.Tighten` |
| 24 | « Espacez-vous » | `Formation.Loosen` |

### 3.4 Combat (12)
| # | Énoncé | Commande |
|---|---|---|
| 25 | « Attaquez [cible] » / « Attaquez celui-là » | `Order.Attack(target)` |
| 26 | « Ciblez la nuque » | `Order.AttackPoint(nape)` (selon `26` §4) |
| 27 | « Visez les jambes » | `Order.AttackPoint(legs)` |
| 28 | « Concentrez vos tirs sur [cible] » | `Order.FocusFire` |
| 29 | « Cessez le feu » | `Order.CeaseFire` |
| 30 | « Libre de tirer » | `Order.WeaponsFree` |
| 31 | « Engagez au corps à corps » | `Order.Engage(melee)` |
| 32 | « Gardez vos distances » | `Order.Engage(ranged)` |
| 33 | « Protégez [escouade / personne] » | `Order.Guard(target)` |
| 34 | « Couvrez ma retraite » | `Order.Cover` |
| 35 | « Ne les affrontez pas » | `Order.Avoid` |
| 36 | « Dégagez un passage » | `Order.BreakThrough` |

### 3.5 ODM et gaz (6)
| # | Énoncé | Commande |
|---|---|---|
| 37 | « Utilisez vos dispositifs » / « ODM actif » | `Order.Mobility(odm_on)` |
| 38 | « Économisez le gaz » | `Order.GasPolicy(save)` |
| 39 | « Au sol, on économise » | `Order.Mobility(ground_only)` |
| 40 | « Rechargez » | `Order.Resupply` (si ravitaillement à portée, `26` P3) |
| 41 | « Ravitaillez à [point] » | `Order.Move` vers un point de ravitaillement |
| 42 | « Lames neuves » | `Order.ReplaceBlades` |

### 3.6 Signaux et communication (8)
| # | Énoncé | Commande |
|---|---|---|
| 43 | « Tirez une fusée rouge / verte / noire » | `Signal.Fire(color)` (P4 : portée, météo) |
| 44 | « Sonnez le repli » | `Signal.Fire(retreat)` |
| 45 | « Message à [escouade] : … » | **non supporté en V1** (texte libre) — l'interface propose une liste de messages prédéfinis |
| 46 | « Rapport » | `Query.Status` : réponse affichée (effectifs, gaz, moral) |
| 47 | « Où est [personne] ? » | `Query.Locate` (limité à ce que mon camp connaît) |
| 48 | « Repérage » | `Order.Scout` |
| 49 | « Silence radio » | `Signal.Mute` |
| 50 | « Répétez » | rejoue le dernier retour |

### 3.7 Soutien et logistique (6)
| # | Énoncé | Commande |
|---|---|---|
| 51 | « Soignez les blessés » | `Order.Medic` |
| 52 | « Évacuez les civils » | `Order.Evacuate` (P1) |
| 53 | « Fermez la porte » | `Order.SecureGate` |
| 54 | « Postez des guetteurs » | `Order.Lookout` |
| 55 | « Réparez le canon » | `Order.Repair` |
| 56 | « Chargez le canon » | `Order.LoadCannon` |

### 3.8 Meta (4)
| # | Énoncé | Commande |
|---|---|---|
| 57 | « Confirme » / « Oui » | valide la proposition en attente |
| 58 | « Annule » / « Non » | refuse ou annule la dernière commande |
| 59 | « Pause tactique » | proposition de pause (n'agit que selon la règle de pause de `27` §5, défaut `[A]` confirmé en `27` §10 point 3) |
| 60 | « Aide » | affiche la liste des énoncés disponibles |

## 4. Candidats de reconnaissance (à évaluer en S3, **non vérifiés**)

| Piste | Intérêt | À vérifier avant de la retenir |
|---|---|---|
| Moteur de transcription local de type Whisper en C++ (modèle « petit » ou « base ») | bonne qualité en français ; exécution locale | licence du code et des **poids du modèle** ; latence sans GPU dédié ; liaison avec .NET |
| Moteur de reconnaissance hors ligne léger de type Vosk | faible charge ; grammaires restreintes possibles | licence ; modèle français disponible et sa licence ; qualité sur énoncés courts et bruyants |
| Reconnaissance du système Windows | aucun poids à distribuer | disponibilité en français selon la configuration du joueur ; accès hors ligne ; risque que l'audio parte vers un service (à exclure si c'est le cas) |

Critère de choix en S3 : exactitude, latence, charge, **licence compatible avec un jeu privé distribué à des amis**, absence d'envoi réseau de l'audio, taille de l'installation. Aucun achat, aucun abonnement.

## 5. Protocole de test (rappel de S3)

1. 100 énoncés répartis sur les 60 énoncés-types, dits par Gabriel au micro de son PC, dans une pièce calme.
2. Mêmes énoncés avec le son du jeu actif (musique et bruitages à volume normal).
3. Pour chaque énoncé : texte reconnu, commande obtenue, correcte oui/non, latence.
4. Résultats : tableau dans `docs/v4/spikes/S3.md`, taux global et par catégorie ; les erreurs récurrentes alimentent des variantes de grammaire (pas de texte libre).
5. Charge : processeur mesuré pendant la scène de S2.

## 6. Décisions à confirmer par Gabriel (R-D1)

| # | Question | Défaut |
|---|---|---|
| 1 | Touche d'appui-pour-parler | maintenir une touche du clavier (à choisir), configurable |
| 2 | Les ordres vocaux s'adressent aux escouades IA **et** aux escouades d'autres joueurs que je dirige par prêt (27 §4.3) ? | oui, uniquement après un prêt explicite |
| 3 | Voix des unités (accusés) | texte et sons brefs en V1 ; pas de doublage |
| 4 | Pause tactique à plusieurs joueurs | règle de `27` §5 (défaut `[A]`, point 3 de `27` §10) ; la voix suit cette règle, sans règle propre |
