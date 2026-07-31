# Plan de Carrière

Jeu d'intrigue narratif au tour par tour — *Crusader Kings dans un open space*.
Comédie noire corporate : tu grimpes la hiérarchie par l'alliance, la trahison et
le « départ non planifié » d'un collègue gênant. Tout passe par des menus et du texte.

> Voir `GDD_plan_de_carriere.md` pour le concept complet.

## Stack

- **Vite + TypeScript**, **React** léger pour l'UI (menus / fiches).
- Aucun backend. Sauvegarde en `localStorage`.
- RNG **seedé** et sérialisable (parties reproductibles).

## Démarrer

```bash
npm install
npm run dev        # serveur de dev
npm run build      # typecheck + build de production
npm run preview    # sert le build
```

## Principe d'architecture : moteur ≠ contenu

Règle non négociable : **le MOTEUR (code) ne connaît jamais le CONTENU par son nom.**
Le code manipule des `id` et deux structures génériques — `Condition` et `Effect`.
Le contenu (événements, archétypes, plans, rangs, collègues) vit en **JSON** dans
`src/data`. **Ajouter du contenu ne demande jamais de toucher au code.**

```
src/
  engine/      Moteur (fonctions pures/mutatives, jamais de contenu en dur)
    rng.ts         PRNG seedé mulberry32, sérialisable via un curseur
    conditions.ts  Évalue une Condition contre le GameState
    effects.ts     Applique un Effect au GameState
    actions.ts     Les 5 actions de base (Bosser, Café, Fouiner, Comploter, Glander)
    plans.ts       Démarrage / résolution des plans (Combine vs vigilance)
    events.ts      Filtrage + tirage pondéré + résolution des choix
    suspicion.ts   Audit de conformité RH, burn-out, game over
    promotion.ts   Progression de rang via réputation
    intents.ts     Intentions hebdo des PNJ : complots contre toi (désamorçage)
                   et guerres entre collègues (prévenir / alimenter)
    scapegoat.ts   Montage d'un bouc émissaire, péremption, consommation
                   à l'audit
    preview.ts     Chiffre l'impact d'une action AVANT le clic (lecture seule)
    week.ts        Orchestration de la résolution du vendredi
  state/
    schema.ts      TOUTES les interfaces typées (le contrat moteur ↔ contenu)
    store.ts       État, save/load localStorage, API mutative (pub/sub React)
  data/            LE CONTENU
    events.json        Catalogue d'événements
    opportunities.json Opportunités hebdo (situations éphémères sur la carte)
    archetypes.json    Définitions des archétypes (comportement des PNJ)
    plans.json         Définitions des plans
    ranks.json         Échelle hiérarchique
    colleagues.json    Roster de départ
    balance.json       Tuning mécanique des actions de base (magnitudes)
    content.ts         Charge et expose les catalogues typés (point d'entrée unique)
  engine/
    opportunities.ts   Génère/résout les opportunités de la semaine
    hooks.ts           Chantage : utiliser un secret comme levier
  ui/            Écrans React
    iso.ts             Projection isométrique 2:1 + plan du plateau (zones, postes)
    figure.ts          Personnages procéduraux : rig, IK, ressorts, postures
                       (aucun rendu — ne renvoie que des coordonnées)
    sprites.tsx        Le dessin : personnages et mobilier en SVG pur
    IsoOffice.tsx      Le plateau : placement des objets et ordre de rendu
    Inspector.tsx      Panneau contextuel : actions auto-documentées et chiffrées
    DeskScreen.tsx     Écran principal (HUD, plateau, agenda, journal)
    ...                événement, résolution hebdo, game over
```

### Direction artistique

Le jeu se joue dans des dossiers RH : **l'interface est la paperasse.** Des
feuilles kraft posées sur un sous-main sombre ; le seul endroit qui reste
dans le noir est le plateau — le monde qu'on observe.

Ce qui tient la cohérence :

- **Trois familles typographiques, trois rôles.** Serif pour les noms et
  titres (registre officiel), sans pour le corps, **monospace** pour les
  libellés de formulaire et tous les chiffres.
- **Angles vifs, filets d'1 px.** Aucun coin arrondi décoratif, aucune
  ombre portée douce : les feuilles se distinguent par leur filet.
- **Les valeurs chiffrées ne sont jamais des pastilles colorées** — ce sont
  des nombres alignés séparés par des points médians, avec un vrai signe
  moins (U+2212) pour que les colonnes se lisent comme des écritures.
- **Une seule couleur d'alerte**, le rouge tampon. Le vert de registre
  et l'ambre de note ne servent qu'aux effets.

Côté plateau, la lumière vient d'une source unique (les baies vitrées du
fond-gauche) et la face à l'ombre ne descend jamais sous 0,74 du ton de
base : plus bas, les volumes virent au noir et se lisent comme des trous
dans la géométrie.

### Personnages 100 % procéduraux

Aucun sprite, aucune image, aucune keyframe. Un collègue est une liste de
primitives — un disque pour le bassin, des capsules pour le buste et les
bras — dont les paramètres sont **recalculés à chaque image** :

- **sinusoïdes déphasées** pour les cycles (respiration, frappe au clavier).
  Deux périodes non multiples ne se resynchronisent jamais, ce qui suffit à
  casser l'aspect métronome ; un déphasage dérivé de l'identifiant évite en
  plus que tout l'étage bouge à l'unisson ;
- **ressorts amortis** pour le secondary motion : la tête suit le buste avec
  du retard, et c'est ce décalage qui donne l'impression de masse ;
- **IK à 2 segments** : les mains visent un point du plan de travail, les
  coudes sont déduits. Aucune position d'articulation n'est écrite à la main.

La **fusion** entre primitives est un vrai smooth-min : on floute l'alpha
puis on la seuille durement (filtre SVG `#goo`). Le rayon du flou joue
exactement le rôle du `k` d'un smin polynomial — plus il est large, plus les
membres se soudent mollement au tronc. Et une capsule SDF n'étant qu'un
segment doté d'un rayon, on la restitue par un trait à bout rond : même
géométrie, sans shader ni second contexte de rendu, donc l'occlusion par le
mobilier et le clic sur un personnage continuent de fonctionner.

**La posture dit ce qui se trame.** Un comploteur se penche, un bavard
gesticule, un guetteur te fixe : `postureFor()` traduit l'intention de jeu en
attitude corporelle. L'animation devient de l'information, pas de la
décoration.

Deux contraintes de production, mesurées :
- les poses sont écrites **directement dans le DOM**, hors du cycle React —
  re-rendre l'arbre à 60 Hz est intenable ;
- la boucle est **cadencée à 32 images/s**. Chaque personnage porte un filtre
  que le navigateur réévalue dès qu'une primitive bouge ; à 60 Hz le 95e
  centile décrochait à 30 fps, à 32 Hz il tient les 60.

La tête, elle, reste **hors fusion** : à ~50 px, un visage fondu redevient
une bouillie.

**Le reste n'essaie pas non plus d'être détaillé.** À ~50 px, un visage
modelé tourne à la bouillie ; on joue donc ce que le SVG fait le mieux —
des formes nettes en aplat. Tête ronde volontairement grosse posée sans
cou, buste en dôme sans bras, deux tons par forme séparés par une arête
franche (jamais de dégradé), et un visage réduit à deux points. Ce qui
distingue un archétype, c'est sa **silhouette** : capuche, queue de
cheval, cheveux en rideau, crâne dégarni. Un collègue doit se reconnaître
à 20 px, réduit à sa découpe.

### Deux règles d'interface

1. **Aucun bouton muet.** Toute action affiche ses deltas exacts et sa
   probabilité *avant* le clic. Les nombres sortent de `engine/preview.ts`,
   qui relit l'arithmétique du moteur — jamais de valeur recopiée à la main.
2. **Rien ne bouge sans responsable.** Ce qui touche le joueur produit une
   ligne de journal nommant l'auteur et le montant.

Le plateau est **100 % vectoriel** (SVG + CSS, aucun asset externe) : net à
toutes les densités et animable au CSS.

## Ajouter du contenu

### Un événement
Ajoute un objet dans `src/data/events.json` :

```json
{
  "id": "mon_event",
  "title": "Titre",
  "body": "Texte. Utilise {rival} ou {target} pour insérer le nom de la cible.",
  "trigger": { "weight": 10, "minRank": "junior", "conditions": { "minSuspicion": 20 } },
  "target": "rival",
  "choices": [
    {
      "label": "Un choix",
      "requires": { "stats": { "combine": 25 } },
      "effects": { "suspicion": 10, "rivalOpinion": -15, "reputation": 8 },
      "outcomeText": "Ce qui se passe.",
      "successChance": 60,
      "failureEffects": { "suspicion": 5 },
      "failureText": "En cas d'échec du jet."
    }
  ]
}
```

- `trigger.weight` : poids pour le tirage. `conditions` : filtre (`Condition`).
- `target` : `rival` (le Carriériste), `random`, ou `archetype` (+ `targetArchetype`).
- `effects` / `failureEffects` : structure `Effect` (deltas de stats, suspicion,
  opinions, drapeaux, lancement de plan…). `successChance` rend le choix incertain.

### Une opportunité
Ajoute un objet dans `src/data/opportunities.json`. Chaque semaine le moteur en
tire quelques-unes (pondérées, filtrées) et les place sur la carte. Même logique
`Condition`/`Effect` que les événements, plus un `icon` et un `place` (zone où
poser le marqueur : `cafe`, `archive`, `manager`, `meeting`, `desk`, ou `target`
pour le coller au bureau de la cible).

### Un archétype, un plan, un rang, un collègue
Ajoute une entrée dans le JSON correspondant. Les champs sont typés dans
`src/state/schema.ts` (`Archetype`, `PlanDef`, `Rank`, `Colleague`) — le compilateur
te guide.

### `Condition` (filtre) et `Effect` (mutation)
Ce sont les deux briques réutilisées partout. Tout ce qu'un événement, un choix ou
un plan peut exiger ou provoquer s'exprime avec elles — voir `schema.ts`.

## Boucle de jeu

Une semaine = **5 points d'action** (Bosser, Café, Fouiner, Comploter, Glander,
Désamorcer), plus les opportunités éphémères posées sur le plateau.

Chaque lundi, tout collègue vivant reçoit une **intention** affichée au-dessus de
sa tête : complot contre toi (compte à rebours de 2 semaines), surveillance,
ragot, ascension, rapprochement. C'est le cœur de la tension : on voit les coups
arriver et on choisit lesquels payer pour désamorcer.

### Le bouc émissaire et le départ non planifié

C'est le cœur du GDD (§6, §7). Avant un coup lourd, tu **montes un dossier**
sur un innocent : indices fabriqués, isolement. Quand l'audit tombe, la
Suspicion se reporte sur lui.

Trois garde-fous, sans lesquels la mécanique casserait le jeu :

1. la préparation est un **jet**, pas un achat (Combine, opinion de la
   cible, vigilance de son archétype) ;
2. elle **périme** au bout de 4 semaines — un dossier monté il y a deux
   mois ne tient plus devant un auditeur ;
3. elle se **consomme** à l'audit, et le prix est lourd : un innocent
   quitte l'entreprise à ta place, et tout l'étage perd de l'estime pour
   toi (`auditWitnessOpinion`).

Le **« départ non planifié »** (plan de rang 6) exige un bouc émissaire
déjà prêt, un secret sur la cible, Combine 55 et le rang Senior. Sans
coupable de rechange, l'audit qui suit remonte jusqu'à toi. Le panneau
affiche toujours la raison exacte du verrou, jamais un simple grisé.

Un poste vidé le reste : le collègue disparaît du plateau, son bureau
demeure. Le bandeau d'état indique en permanence si tu es couvert.

### L'open space vit sans toi

Un comploteur qui ne t'a pas dans le viseur s'occupe d'un **autre collègue**
(intention `scheme`). Le plateau relie alors l'agresseur à sa cible par un trait
animé. Ces guerres se résolvent que tu regardes ou non — mais elles t'offrent
deux leviers, tous deux à 1 PA :

| Levier | Effet |
|---|---|
| **Prévenir la cible** | Le coup capote. La victime t'est redevable (+18 opinion), le comploteur t'en veut (−10). |
| **Alimenter le coup** | +25 % de réussite. Le comploteur te revaut ça (+14), la victime se doute (−12), +3 Suspicion. |

Une victime qui tombe garde une **réputation entamée** : elle perd du Rendement
et vaut nettement moins comme appui. Choisir qui protéger, c'est choisir ses
alliés futurs.

Le vendredi : événement hebdomadaire → résolution des plans → résolution des
intentions → audit RH → promotion. **Suspicion** trop haute → audit ; sans alibi
ni bouc émissaire → licenciement. **Nerfs** à zéro trop longtemps → placard.

## Périmètre

MVP jouable de bout en bout (§11 du GDD) : 6 rangs (Stagiaire → Team Lead),
6 archétypes, 5 collègues, 15 événements, save/load.

**V2 livrée :** IA de complot des PNJ (ils se ciblent entre eux, avec
vendettas et retour en grâce), bouc émissaire complet, « départ non
planifié », 6 plans.

**V2 restante :** suspicion par-collègue (qui a vu quoi), romances de
bureau, échelle hiérarchique jusqu'à DG. Le schéma les prévoit.
