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
    argent.ts      Salaire, loyer, et l'interdiction du crédit
    romance.ts     Attachement, statuts, jalousie, ébruitement
    subordonnes.ts Périmètre hiérarchique et ordres hebdomadaires
    marche.ts      Bourse (dérive positive, historique) et casino
                   (espérance négative)
    vieprivee.ts   Résolveur commun des dépenses et des activités
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
    depenses.json      Ce que l'argent achète, au bureau comme chez soi
    appart.json        Logements et mobilier
    weekend.json       Activités du week-end
    marche.json        Titres cotés et tables de casino
    vieprivee.ts       Charge les catalogues ci-dessus
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
    ViePrivee.tsx      Blocs d'inspecteur : romance, périmètre, dépenses
    Appart.tsx         Le week-end : chez soi, logement, mobilier
    Marche.tsx         Bourse et casino (au poste comme à la maison)
    Courbe.tsx         Les graphes : séries indexées, tracés par titre
    Ecran.tsx          Le poste de travail : un écran DANS la fiction
    ...                événement, résolution hebdo, game over
```

### L'ombre n'est pas la couleur de base en plus sombre

Ombrer était une multiplication RGB : `couleur × 0,74`. La teinte ne
bougeait jamais, d'où l'aspect « aplat assombri ». Une face à l'ombre
n'est pourtant pas éclairée par *rien* : elle est éclairée par la lumière
**ambiante**, qui a sa propre couleur. Sa teinte dérive donc vers celle de
cet ambiant, pendant que la face éclairée dérive vers celle de la source.
Lumière et ombre ne diffèrent pas seulement en valeur, elles diffèrent en
**température**.

Le modèle vit dans `ui/shading.ts`, ses réglages dans `board.json`
(`ombrages`), et `?ombrage=neon` bascule sans rebuild. Trois décisions
valent d'être notées :

1. **Le mélange se fait en Oklab, pas en sRGB.** Interpoler un beige vers
   un bleu en sRGB traverse un gris boueux ; Oklab est construit pour que
   le chemin le plus court soit aussi le plus joli.
2. **La chroma remonte dans l'ombre** (×1,14). Contre-intuitif, mais c'est
   ce qu'on observe : une zone à l'ombre n'est plus lavée par la lumière
   directe, sa couleur propre ressort. Une ombre grise est une ombre morte.
3. **L'exposant de valeur est 0,722**, et ce n'est pas un réglage à l'œil :
   c'est la valeur qui reproduit *exactement* la réponse en clarté perçue
   de l'ancien multiply RGB. Mesurée sur six teintes et trois facteurs
   d'éclairement, elle sort identique à trois décimales près. Elle garantit
   que passer à l'ombrage coloré ne change **que** la teinte, jamais la
   lecture du volume — sans elle, les ombres s'éclaircissent et le relief
   s'aplatit.

Conséquence sur le budget de saturation : le plafond de 0,18 porte sur les
**jetons** de la palette, pas sur les couleurs calculées. Une face à
l'ombre peut le dépasser, et c'est voulu — c'est là que la couleur doit
vivre.

### Le grain, et les trois pièges qui le rendaient invisible

Tout est grainé : le plateau, les feuilles de papier, le sous-main. Le
bruit est **fractal, généré par le navigateur** (`feTurbulence` dans une
URI de données, `styles.css`) — aucun asset externe, comme le reste du
jeu. Deux calibres : serré pour le film du plateau, plus large pour la
fibre du papier.

La couche du plateau (`.iso__grain`) vit dans le DOM, **hors du SVG**, et
c'est délibéré : un grain posé dans le plan du plateau grossirait au
zoom. Ce ne serait plus du grain, ce serait des cailloux.

Trois pièges, tous silencieux, tous trouvés à la mesure et pas à la
lecture :

1. **Le `#` de `url(#n)` doit s'écrire `%23`.** Dans une URI de données,
   un `#` nu ouvre un fragment : la suite est coupée, le SVG devient
   invalide, l'image ne se décode pas. La couche s'affichait donc
   parfaitement — en n'affichant rien du tout.
2. **`color-interpolation-filters` vaut `linearRGB` par défaut.** Un bruit
   symétrique autour de 0,5 en lumière linéaire ressort centré sur 0,73
   en sRGB. Le « grain » éclaircissait l'image de 5 à 23 niveaux selon le
   fond : ce n'était plus une texture, c'était une correction d'exposition
   clandestine. En `sRGB`, la dérive mesurée tombe **sous 0,6 niveau**.
3. **L'alpha sortant de `feTurbulence` est lui aussi du bruit.** On le
   force à 1 dans la matrice, sinon l'opacité de la couche ne pilote plus
   rien de lisible.

Amplitude retenue, mesurée à l'échelle 1:1 (une capture réduite moyenne le
bruit et ment) : **+1,5 à +2,4** d'écart-type sur le plateau, **+5,9**
niveaux d'étendue sur le papier, pour une dérive de valeur de −0,5. Le
grain texture, il ne réexpose pas.

Il coûte **3,5 ms par image** (séries alternées, cinq paires) — c'est le
mélange `overlay` sur toute la surface du plateau. `fond.grain` à 0 dans
`board.json` ne rend pas la couche du tout, plutôt que de composer une
couche invisible pour rien.

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
**La silhouette se règle sur deux axes indépendants** (`rigFor`) : le
**genre** ne touche qu'à l'équilibre épaules / hanches, la **carrure** ne
touche qu'à la masse générale. Les mélanger donnerait « une femme est plus
petite », ce qui est faux et, à cette échelle, illisible de toute façon.
La hauteur, elle, ne bouge jamais : des têtes à des altitudes différentes
derrière une rangée de bureaux se liraient comme un défaut d'alignement,
pas comme de la variété.

L'écart de genre porte surtout sur les **épaules**, et pas par hasard : en
jeu, le bureau masque le bas du corps. Une différence jouée sur les hanches
serait invisible là où les personnages vivent, et ne se verrait que dans
l'aperçu de l'embauche. Mesuré : rapport épaules/hanches de 1,45 contre
0,98, constant à toutes les carrures, pour une largeur d'épaules qui va de
15 à 26 selon le curseur.

Les archétypes ont eux aussi une silhouette (dans le thème) : sans ça,
l'étage entier est six clones dont seuls les cheveux changent. Écart
d'épaules mesuré sur le plateau : 6,5 unités entre le plus large et le plus
étroit.

**Aucune primitive à dessus plat.** Les épaules étaient une capsule
horizontale à bouts ronds : entre ses deux bouts, le dessus est
rigoureusement plat, d'où une coupe nette au-dessus des épaules. C'est
une **ellipse** — elle n'a de plat nulle part, et sa pente naturelle du
cou vers les bras est justement celle d'une épaule.

**Le corps se lit par ses proportions, pas par ses détails.** La
silhouette est bâtie sur trois primitives fusionnées : bassin, buste, et
une **capsule d'épaules horizontale** qui est la plus large de la figure.
Sans elle, le tronc est un tube de largeur constante coiffé d'un dôme —
un pion d'échecs. Mais l'écart doit rester mesuré : un premier réglage à
6,4 de demi-buste contre 21 d'épaules donnait une taille de guêpe et deux
lobes séparés par un étranglement. Cible tenue : **19 aux épaules, 15 à
la taille, 16 aux hanches**.

Deux corollaires appris à l'image : le col est un **trait** et non un
aplat (un triangle plein sur la poitrine se lit comme une serviette de
table), et il doit rester *dans* la masse du buste — débordant au-dessus
des épaules, il devient un harnais. La cravate, elle, a un **nœud** puis
un pan qui s'élargit avant de finir en pointe : le losange symétrique,
pointu aux deux bouts, donnait un poignard planté sur le torse.

**Les formes n'ont pas de bord droit** — sauf le tissu repassé (le pan de
la cravate), où l'arête est juste.

Un plan qui traverse une boule
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

## L'argent, et les quatre systèmes qu'il porte

Le salaire est la colonne vertébrale de tout ce qui suit. Une règle le
tient : **rien ne se paie à crédit**. Une dépense qu'on ne peut pas
couvrir est refusée, jamais empruntée — un jeu où l'on peut toujours agir
n'a pas de décisions, seulement des séquences.

Le salaire dépend du rang, le loyer du logement, et la paie est calculée
**avant** le prélèvement : personne ne doit se faire expulser le jour
d'une promotion. `Effect` a gagné `argent`, donc n'importe quel événement
existant peut désormais coûter ou rapporter sans une ligne de moteur.

### La vie privée : l'attachement n'est pas l'opinion

C'est la décision qui structure `engine/romance.ts`. On peut plaire à
quelqu'un qui vous méprise professionnellement, et l'inverse arrive tout
autant. Les confondre aurait ramené la romance à « une opinion qui monte
plus vite », c'est-à-dire à rien.

Ce qui les relie, c'est le **risque**. Tant que ça reste discret, une
liaison ne produit aucun effet public. Dès que ça se sait — surpris aux
toilettes, ou officialisé — trois choses arrivent d'un coup : les autres
histoires en cours s'effondrent (la jalousie), l'étage a un avis, les RH
ont un dossier. C'est la règle qui rend le harem coûteux **sans
l'interdire** : on peut mener trois histoires de front, mais la première
qui s'ébruite fait tomber les deux autres.

Officialiser garantit un plancher d'opinion et rend des nerfs chaque
semaine. Le marché est explicite : un allié définitif contre la
discrétion, pour toujours.

Les toilettes sont le seul volume **opaque** d'un étage entièrement
vitré, et c'est tout ce qu'il faut dire pour expliquer pourquoi les gens
y vont. Conséquence technique qu'il a fallu corriger : en projection
isométrique, leurs cloisons recouvrent intégralement leur propre sol, donc
la surface cliquable générique des zones était rigoureusement
inatteignable. On clique la **porte**. Une zone qu'on ne peut pas
sélectionner n'existe pas.

### Le week-end : une phase, pas un écran de plus

Après le bilan du vendredi, on rentre chez soi, avec une monnaie de temps
distincte. Le logement n'est donc pas un décor : il détermine combien
d'actions le week-end contient. **Déménager, c'est acheter du temps
libre.** Le mobilier majore ce que les activités rapportent sans jamais
leur ajouter un effet qu'elles n'avaient pas — un canapé rend une soirée
plus efficace, il n'invente pas une soirée.

Le week-end appartient à la semaine qui *commence*, pas à celle qui
finit : les opportunités de lundi sont déjà tirées quand on rentre, et ce
qu'on fait à la maison peut les préparer.

### Bourse et casino : deux formes mathématiques opposées

Elles ne racontent pas la même chose, donc elles n'ont pas la même
espérance, et c'est délibéré.

- **La bourse** a une dérive positive. C'est un placement, pas un pari.
  Ce qu'elle prend en échange, c'est de la *liquidité* — un titre ne paie
  pas un cabinet de conseil le jour où il en faudrait un. Le cours vit
  dans l'état sauvegardé : sinon il repartirait de zéro à chaque
  rechargement et le joueur pourrait relancer le dé en rouvrant l'onglet.
  Marche multiplicative, pour qu'une variation de 5 % pèse pareil sur un
  titre à 12 € et sur un titre à 210 €.
- **Le casino** a une espérance négative sur les quatre tables, écrite en
  clair sur chacune. Ce n'est pas de la pédagogie, c'est de la lisibilité :
  une table dont on ne peut pas évaluer le prix n'est pas un choix, c'est
  un bouton. Il ne sert jamais à s'enrichir — il sert à convertir un petit
  capital en une petite chance d'un gros capital, tout de suite. Joué
  depuis le poste de travail, il fait monter la suspicion, gagné ou perdu :
  c'est ce qui lui donne une place **dans** le jeu plutôt qu'à côté.

### Le poste de travail : un écran DANS le jeu

Produire, regarder la bourse et jouer au casino se font maintenant en
s'asseyant à son bureau, dans une fenêtre qui imite un poste de travail.
Trois raisons, dans l'ordre :

1. **Ça donne un lieu à ces actions.** « Bosser » était un bouton dans un
   panneau latéral, au même endroit que « prendre un café avec Marc ». Le
   plateau redevient l'endroit où l'on décide, au lieu d'être une
   illustration du panneau de droite.
2. **Ça explique la règle du casino.** On est devant un écran, dans un
   open space, sous les yeux de six personnes : la suspicion cesse d'être
   arbitraire.
3. **Ça sépare l'interface DU jeu de l'interface DANS le jeu.** Le reste
   est du papier kraft, de l'encre et des angles vifs ; l'écran est du
   verre, de la lumière et des coins arrondis. C'est le contraste qui
   fait comprendre qu'on regarde un objet de la fiction.

Un défaut est apparu à la vérification : **deux écouteurs d'Échap sur
`window`**. Fermer l'écran ouvrait le menu pause dans la foulée, parce
que le second écouteur n'avait aucun moyen de savoir que le premier
venait de se servir de la touche. L'écran du bureau garde donc la même
garde que le tutoriel et le règlement.

### Les graphes de la bourse

Trois décisions, toutes prises avant d'écrire le premier trait :

- **Les séries sont indexées à 100, pas tracées en euros.** Kastel vaut
  210 €, Novatek 12 €. Sur un axe commun en euros, Novatek serait une
  ligne plate au ras du zéro et son doublement — l'événement le plus
  intéressant du marché — serait invisible. Deux échelles sur un même
  graphe est le mensonge classique : leur alignement est arbitraire, donc
  le graphe invente une corrélation qui n'existe pas.
- **Les couleurs sont validées, pas choisies à l'œil.** Les quatre
  teintes du décor échouaient comme palette de séries : `#9e3428` contre
  `#2f7048` donnent un **ΔE de 4,6 en deutéranopie**, c'est-à-dire la même
  couleur pour 6 % des hommes. La palette retenue est deux teintes × deux
  clartés — sous vision daltonienne, c'est la clarté qui reste lisible.
  Toutes les paires passent, y compris **non adjacentes** : sur un graphe
  à quatre courbes, elles sont toutes visibles ensemble. Le rouge du
  tampon est écarté par principe — c'est une couleur de statut, elle ne
  peut pas désigner « la série 4 ».
- **Il y a une vue tableau, et ce n'est pas une politesse.** Deux des
  quatre couleurs passent sous 3:1 de contraste avec le kraft. C'est
  acceptable pour un trait de 2 px portant une étiquette directe, à
  condition que la valeur soit atteignable autrement qu'à la couleur.

Le tracé par titre, lui, est en euros absolus : une seule série, donc
aucune comparaison à fausser, et c'est la seule échelle qui réponde à la
question qui compte quand on détient une ligne — suis-je au-dessus de ce
que j'ai payé ? D'où le prix de revient stocké dans l'état, et le trait
horizontal qui le matérialise.

### Les enjeux : quatre façons de finir

L'audit RH et le burn-out existaient. S'y ajoute l'**expulsion**, après
deux loyers impayés consécutifs. Deux, et pas un : le premier impayé doit
être un avertissement rattrapable — en vendant des titres, en revendant
un meuble, en reprenant plus petit. Une fin de partie qui tombe sans
qu'on ait pu réagir n'est pas un enjeu, c'est un piège. Le compteur
s'affiche en rouge dans la barre du haut dès le premier impayé.

Le loyer du dernier étage dépasse le salaire d'un Senior. Ce n'est pas un
oubli d'équilibrage : c'est ce qui rend le train de vie dangereux.

### Cliquer sur le plateau

Le mobilier interceptait les clics destinés aux pièces — les surfaces
cliquables des zones sont posées **au sol**, donc sous tout ce qui est
peint ensuite. Sélectionner la salle de réunion demandait de viser les
quelques pixels de moquette qu'aucun meuble ne couvrait.

La règle est donc inversée : par défaut, rien dans le plateau ne reçoit
d'événement de pointeur, et seuls les éléments explicitement interactifs
le réactivent. Un meuble ne peut plus voler un clic quel que soit son
ordre de rendu, et il n'y a plus qu'un endroit à tenir à jour quand on
ajoute du décor. Mesuré après coup : 5 zones sur 7 atteignables en visant
leur centre exact, les deux autres étant couvertes en leur centre par une
balise d'opportunité — qui doit précisément prendre le clic.

### Les subordonnés : déléguer met le sale boulot dans une bouche

Un subordonné n'exécute pas parce qu'il t'aime, il exécute parce que tu
notes son entretien annuel. Son opinion ne décide donc **pas** s'il obéit
— elle décide s'il le fait bien, et surtout ce qu'il raconte ensuite.

La trahison est vérifiée *après* l'effet et ne l'annule pas : le
subordonné fait ce qu'on lui a demandé, puis va le raconter. C'est plus
juste, et bien plus désagréable, que « il refuse » — on obtient ce qu'on
voulait et on le paie quand même.

### Le résolveur commun

Une dépense coûte de l'argent et des points d'action ; une activité coûte
des points de week-end. Tout le reste — le jet, l'application de
l'`Effect`, le texte d'issue — est identique, donc n'existe **qu'une
fois** (`engine/vieprivee.ts`). Deux résolveurs séparés auraient fini par
diverger sur un détail comme l'ordre entre paiement et effet, et cette
divergence-là ne se voit qu'en jeu, tard.

L'ordre est d'ailleurs le point délicat : on vérifie tout, on **paie**,
puis on applique. Payer après l'effet laisserait passer une dépense
insolvable ; appliquer avant de vérifier la cible laisserait un effet
orphelin.

### L'accueil guidé, et la note qui n'arrivait jamais

Le script (`ui/tutorial.ts`) compte dix-huit notes de service, dont la
moitié ne passent à la suivante que lorsque le geste a été fait — pas
quand on a cliqué « Suivant ».

Deux pièges tenaient au fait que le week-end est un **autre écran** :

1. Le composant du tuto vit dans l'écran du bureau. Passer vendredi soir
   le démonte, donc l'accueil repartait de la note 00 — juste après avoir
   demandé de terminer la semaine, c'est-à-dire exactement au moment où
   il devient utile. L'étape en cours est donc mémorisée, **par
   identifiant et non par numéro** : insérer une note au milieu du script
   ne doit pas renvoyer les parties en cours au mauvais endroit.
2. La consigne « termine la semaine » n'était jamais validée : React
   démonte le composant avant que l'effet qui la surveille n'ait pu
   tourner. Elle accepte donc aussi « on est passé en week-end ».

### Conditionner un événement sur ce qui ne se voyait pas

`Condition` sait désormais lire un solde (`minArgent`), un statut de
relation avec la cible (`minRomance`), une histoire devenue publique, un
périmètre non vide, et le rang du logement.

Un piège s'y cachait, silencieux : le filtrage d'éligibilité tourne
**avant tout tirage**, donc sans cible. Une condition portant sur la
cible y aurait été évaluée contre `undefined` et aurait échoué
systématiquement — l'événement n'aurait jamais pu se déclencher, sans que
rien ne le signale. Les modes de ciblage déductibles sans hasard (`rival`,
`romance`, `subordonne`) sont donc résolus **pendant** le filtrage, ce
qui est possible précisément parce qu'ils ne consomment pas le RNG et ne
déplacent donc pas le curseur d'une graine.

Dans l'échelle des statuts, `ex` vaut −1 et non 0 : une histoire terminée
n'est pas « moins qu'un flirt », elle est disqualifiante. Sans ce choix,
un événement exigeant `flirt` se serait déclenché sur quelqu'un qu'on
vient de quitter.

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

## Traits : un budget à placer exactement

À l'embauche, on place **4 points** : les qualités en coûtent, les défauts
en rendent, trois défauts au maximum. On ne peut pas signer tant que le
budget n'est pas dépensé **exactement** — laisser partir quelqu'un avec
des points en poche, c'est lui faire commencer une partie diminuée sans
qu'il l'ait choisi.

Le contenu vit dans `data/traits.json`. **Le moteur ne connaît aucun trait
par son nom** : il connaît des quantités génériques (`TraitModKey`) — « les
hausses de suspicion », « les gains d'opinion », « la réussite des
complots » — et demande au catalogue quel coefficient s'y applique.
« Discret » et « Maladroit » n'existent que dans le JSON.

Deux natures de modificateur, et le moteur doit savoir laquelle :
**multiplicatif** pour ce qui est une quantité (un gain, un coût), qu'on
compose par produit ; **additif** pour ce qui est déjà un pourcentage de
réussite, où ajouter 8 points à une chance de 40 % est lisible alors que
la multiplier ne l'est pas.

Cette fonctionnalité a forcé un nettoyage utile : les hausses de suspicion
étaient écrites **en quatorze endroits** sous la forme
`clamp(suspicion + n)`. Un trait qui modifie la discrétion n'avait alors
aucun point d'application — il aurait fallu le brancher quatorze fois, et
le quinzième appel écrit plus tard l'aurait oublié en silence. Tout passe
désormais par `raiseSuspicion()`. Une hausse de suspicion est une règle du
jeu, elle mérite une fonction.

Corollaire de la règle « aucun bouton muet » : `preview.ts` appelle les
**mêmes fonctions** que les actions (`nerfCost`, `opinionGain`,
`caughtRisk`) plutôt que de refaire le calcul. Deux formules pour la même
chose, c'est la garantie qu'elles divergent. Même exigence sur l'écran
d'embauche, où les « conditions d'entrée » affichent les stats **traits
compris**, mises à jour à chaque case cochée.

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
