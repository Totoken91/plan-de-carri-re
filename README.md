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

### Identité visuelle du plateau : « Plein jour »

L'open space est **diurne**. Ce n'est pas un goût, c'est une conséquence :
le plateau nocturne d'origine se lisait comme une bouillie, et la mesure le
disait — luminance moyenne **0,33**, **73 %** des surfaces dans le tiers
sombre, **10 %** seulement au-dessus de 0,6. Sans lumière à l'écran, rien
ne peut ressortir. En plein jour, la moyenne passe à **0,62** et les 10 %
sombres qui restent sont **les personnages** — exactement ce qu'on veut
voir en premier.

Le fond du cadre n'est pas « ce qui reste » : la pièce est un losange qui
n'occupe qu'environ **40 %** du plateau, donc plus de la moitié de ce qu'on
voit est du fond. Il est traité comme un **sous-main sombre** sur lequel la
maquette est posée — la pièce éclairée s'y détache, elle y déborde
légèrement (`fond.debord`), et le losange redevient une forme choisie
plutôt qu'un blanc résiduel.

Toute la palette vit dans `src/data/board.json`, rangée par **rôle** et non
par objet : ce n'est pas « la couleur du caisson », c'est « du métal de
structure ». Changer d'identité visuelle coûte un fichier JSON. Deux thèmes
y cohabitent — `plein_jour` (actif) et `nuit` (l'original, conservé pour
comparaison) — et `?theme=nuit` dans l'URL bascule sans rebuild.

**Les deux règles qui font tout le travail**, et qui ne sont pas
déclaratives : `npm run audit:palette` les vérifie, et le build échoue si
elles sont violées.

1. **Budget de valeurs.** Le décor tient dans une bande étroite
   (`bandeDecor`, 0,60–0,93) ; les acteurs vivent en dehors
   (`bandeActeurs`, 0,22–0,58). C'est ça qui règle le « trop chargé » :
   le problème n'était jamais le nombre d'objets — 1 240 formes peintes
   avant comme après — mais le fait que la plante verte, le caisson à
   tiroirs et le visage d'un collègue aient le même contraste. Quand tout
   crie au même volume, rien n'est lisible.
2. **Budget de saturation.** Le décor reste sous `satMaxDecor` (0,18).
   Seuls les personnages et les signaux de jeu ont le droit d'être
   saturés.

Les exceptions sont **déclarées et justifiées** (`horsBande`) — le terreau
d'une plante, le café dans une tasse, un post-it de 3 px. Une couleur hors
bande non déclarée est un bug, pas une question de goût.

Corollaire pour les personnages : c'est la bande du décor qui dicte celle
des acteurs, donc leur apparence vit dans le thème elle aussi. Le
Carriériste ne porte plus la chemise blanche qui le faisait disparaître sur
un sol clair, mais la veste sombre de celui qui s'habille pour le poste
d'après — ce qui le dit mieux de toute façon.

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

**Les bras ne sont pas dessinés.** Fusionnés près de l'axe, ils étaient
absorbés et ne produisaient qu'une bosse dans le ventre ; fusionnés
écartés, ils étalaient la silhouette en flaque ; peints par-dessus, l'IK
repliait le coude en boucle sur la poitrine. Un corps en dôme à ~50 px ne
supporte aucun des trois. L'IK sert donc à ce pour quoi elle est utile à
cette échelle : placer ce que la main tient (la tasse du Fayot).

**La posture dit ce qui se trame.** Un comploteur se penche, un bavard
gesticule, un guetteur te fixe : `postureFor()` traduit l'intention de jeu en
attitude corporelle. L'animation devient de l'information, pas de la
décoration.

**Amplitudes.** Premier réglage : la tête bougeait de 0,66 px à l'écran —
mesuré, donc invisible. Deux causes : des coefficients trop faibles, et
surtout un signe. Les ordonnées montant vers le haut de l'écran, un rebond
positif *descendait* la tête pendant que l'étirement la *remontait* : les
deux termes s'annulaient. Après correction, ~4,7 px verticaux.

Côté production :
- les poses sont écrites **directement dans le DOM**, hors du cycle React —
  re-rendre l'arbre à 60 Hz est intenable ;
- la boucle est **cadencée à 32 images/s**, parce qu'un mouvement d'attente
  n'a pas besoin de plus. Un A/B dans une même page (avec filtre, sans
  filtre, sans la copie d'ombre) donne des temps d'image identiques : la
  fusion ne coûte rien de mesurable.

La tête, elle, reste **hors fusion** : à ~50 px, un visage fondu redevient
une bouillie.

**Le reste n'essaie pas non plus d'être détaillé.** À ~50 px, un visage
modelé tourne à la bouillie ; on joue donc ce que le SVG fait le mieux —
des formes nettes en aplat. Tête ronde volontairement grosse posée sans
cou, buste en dôme sans bras, deux tons par forme séparés par une arête
franche (jamais de dégradé), et un visage réduit à deux points. Ce qui
**Les formes n'ont pas de bord droit.** Un plan qui traverse une boule
se lit comme une fissure, pas comme une ombre : l'ombre propre du visage
suit un **terminateur elliptique** qui passe par les deux pôles du crâne
et s'écarte au maximum à l'équateur. Même logique pour les cheveux — une
corde horizontale en travers du front donne un bord de casquette, une
nuque coupée à l'équerre donne une boîte posée derrière la tête. Toutes
les limites de coiffure sont des courbes.

Ces défauts ne se voyaient pas au premier jet parce qu'on les regardait
dans le jeu, à 20 px. Ils sautent aux yeux dès qu'on cadre sur une tête
— d'où la règle : **on vérifie une coiffure en gros plan ET à la taille
où elle vit**. Une couronne de cheveux réussie au zoom peut se lire comme
un casque audio à l'échelle de jeu, ce qui est arrivé au Vétéran.

Ce qui distingue un archétype, c'est sa **silhouette** : capuche, queue de
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

### Cadrage du plateau

Molette ou **pincement** (deux doigts, ou pavé tactile) pour zoomer, centré
sur le curseur, jusqu'à 4× ; glisser à un doigt pour se déplacer ;
double-clic ou bouton « Recadrer » pour revenir à la vue d'ensemble. Le cadrage est **borné** : impossible de dézoomer au-delà du
plateau ni de le faire sortir de l'écran — un joueur perdu dans du vide
noir n'a aucun moyen de comprendre comment revenir.

**Le geste ne déclenche rien d'autre.** Trois sources d'interférence, toutes
neutralisées : le pincement au pavé tactile n'est pas un événement tactile
mais un `wheel` portant `ctrlKey` — sans interception, le navigateur zoome
la page entière ; Safari émet en plus ses `gesture*` non standard ; et un
glissement sélectionne le texte alentour tant qu'on ne l'a pas interdit en
CSS. Le blocage de sélection est confiné au plateau : le reste de
l'interface reste sélectionnable.

Le `viewBox` est écrit directement sur le SVG, hors de l'état React :
repasser par un rendu à chaque cran de molette reconstruirait tout
l'open space. Un glissement avale le clic qui le suit, sinon relâcher la
souris au-dessus d'un collègue le sélectionnerait par accident.

### Création de personnage

Une partie commence par un **formulaire d'embauche** (`ui/CharacterCreation.tsx`) :
nom, carnation, coiffure, couleur de cheveux, tenue, cravate, lunettes.
Les palettes sont du contenu (`data/appearance.json`) — ajouter une teinte
ou un prénom ne touche ni le formulaire ni le rendu.

L'aperçu **n'est pas une illustration** : c'est le composant `Figure` qui
dessinera le personnage à son bureau, aux coordonnées exactes du plateau,
avec sa chaise, son bureau et le halo de son écran. Ce qu'on choisit est
ce qu'on aura — aucun intermédiaire ne peut mentir. Le cadrage vient d'une
mesure de la boîte englobante réelle de la scène, pas d'une estimation :
le visage doit être assez grand pour qu'on distingue une paire de lunettes
d'une absence de lunettes.

`Person` (le collègue, dont l'apparence découle de son archétype) et le
joueur passent par le même `Figure`. L'apparence vit dans `GameState` —
elle est sauvegardée avec la partie, ce n'est pas un réglage.

Le joueur est **assis à son poste** au premier plan, marqué d'un chevron
doré : dans un étage plein de gens qui se ressemblent, il faut pouvoir se
retrouver d'un coup d'œil. Cliquer dessus sélectionne la zone « Ton
bureau ». Attention au piège du chevron : une transformation **CSS**
l'emporte sur l'attribut `transform` d'un élément SVG, donc placement et
animation vivent sur deux groupes distincts — sinon l'animation renvoie
l'élément à l'origine du plateau.

### Apprendre le jeu

Deux dispositifs, deux usages :

**L'accueil guidé** (`ui/tutorial.ts` pour le script, `ui/Tutorial.tsx`
pour l'affichage) s'ouvre tout seul à la première partie et se rejoue
depuis le bouton « ? ». Treize étapes ; cinq d'entre elles ne passent à la
suivante que lorsque le joueur a **réellement** fait le geste — cliquer sur
un collègue, prendre un café, fouiner, terminer la semaine. Un joueur qui
ne comprend pas le jeu ne comprendra pas davantage un texte qui l'explique :
il faut qu'il ait fait le geste.

Le script ne connaît rien du moteur. Chaque consigne est un prédicat qui
compare l'état courant à l'état figé à l'entrée dans l'étape
(`done(now, start)`), ce qui permet de relancer le tuto à n'importe quel
moment d'une partie en cours sans qu'il se croie déjà terminé. C'est aussi
la raison pour laquelle `weeklyActionCounts` enregistre désormais **toutes**
les actions de la semaine et non plus seulement les deux au rendement
décroissant : l'état porte « ce que le joueur a fait cette semaine », dont
se servent l'anti-spam comme l'accueil. Le comptage a migré des fonctions
d'action vers le store, à effet mécanique identique.

Le voile est un **unique `<path>` à règle de remplissage `evenodd`** : le
rectangle de l'écran, puis un rectangle par élément à éclairer. Les trous
ne sont pas peints, et comme le test de survol suit le remplissage, ils
laissent aussi passer les clics. Un seul objet assombrit et verrouille,
sans découper l'écran en panneaux ni toucher aux `z-index` des composants
existants. La carte cherche une bande libre autour de l'élément éclairé
(dessous, dessus, à droite, à gauche), se rétrécit plutôt que de venir se
poser sur les personnages, et reste en toutes circonstances entièrement
visible.

**Le règlement intérieur** (`ui/Manual.tsx`), sous le bouton « ? », répond
aux questions qu'on se pose trois semaines plus tard. Tout ce qui y est
chiffré est lu dans `data/` : un équilibrage qui change met le manuel à
jour tout seul.

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

## Menu et dossiers de sauvegarde

Trois **dossiers du personnel** (`src/state/saves.ts`), chacun autonome.
Le menu les présente comme des chemises posées sur le bureau, avec la
trombine de leur titulaire — dessinée par le même composant `Figure` que
le plateau, donc on reconnaît son personnage avant de lire son nom.

**L'enregistrement est continu** : chaque action écrit dans le dossier
courant. Il n'y a donc volontairement aucun bouton « Sauvegarder ». Un
bouton qui ne ferait rien de plus que ce que le jeu fait déjà est un
mensonge rassurant, et le jour où le joueur en aurait vraiment besoin, il
ne saurait pas qu'il ne sert à rien. Ce que le menu offre à la place,
c'est ce que l'autosauvegarde ne sait pas faire : choisir un dossier, en
**dupliquer** un avant une manœuvre risquée, en **détruire** un.

Le store ne connaît qu'une chose de la persistance : **dans quel dossier
il écrit**. Tant qu'on est au menu, il n'est lié à aucun (`store.close()`)
— sinon un aller-retour par le menu écraserait un dossier avec la partie
fantôme que le store porte au démarrage.

Le résumé affiché sur une chemise est **dérivé de l'état**, jamais stocké
à part : deux sources pour la même vérité, c'est la garantie qu'elles
divergent.

Une sauvegarde d'avant les dossiers est reprise automatiquement dans le
premier emplacement (`migrateLegacySave`) : un changement de format ne
doit pas coûter sa partie à quelqu'un.

En partie, **Échap** (ou le bouton « Menu ») ouvre l'interruption de
séance : reprendre, consulter le règlement, revenir aux dossiers.

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
