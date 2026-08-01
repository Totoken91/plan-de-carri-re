// ─────────────────────────────────────────────────────────────
// sprites.tsx — Le dessin. Personnages et mobilier, en SVG pur.
//
// Convention d'orientation, valable partout dans ce fichier :
//   gy croissant = vers la caméra (bas-gauche de l'écran).
// Un poste de travail se lit donc, du fond vers l'avant :
//   chaise → occupant → clavier → écran (dos tourné à la caméra).
// L'écran fait face à qui l'utilise, pas au joueur ; on récupère la
// lumière par le halo qu'il projette sur le bureau et sur le visage.
//
// Éclairage : source unique venue du fond-gauche (les baies vitrées).
// Face +gy éclairée, face +gx dans l'ombre, liseré clair sur les
// contours tournés vers la lumière.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import type { Appearance, Colleague, HairStyle } from '@state/schema';
import { shading, theme as T } from '@data/board';
import { shadeWith } from './shading';
import { DESK_D, DESK_W, box, iso, panelAlongX, quad } from './iso';
import {
  makeMotion,
  phaseOf,
  poseFigure,
  postureFor,
  registerPainter,
  rigFor,
} from './figure';

// ── Ombrage ──────────────────────────────────────────────────
// La face à l'ombre ne descend pas sous 0,74 : en dessous, les volumes
// sombres virent au noir absolu et se lisent comme des trous dans la
// géométrie plutôt que comme des faces éclairées de biais.
export const SHADE = { top: 1.2, left: 0.94, right: 0.74 };

/**
 * Ombre une couleur selon le modèle d'éclairage du thème.
 *
 * Ce n'est plus une multiplication RGB : la teinte dérive vers celle de
 * la source du côté éclairé, vers celle de l'ambiant du côté ombré. Voir
 * shading.ts pour le pourquoi — en deux mots, une ombre n'est pas une
 * absence de lumière, c'est une lumière d'une AUTRE couleur.
 */
export function shade(color: string, k: number): string {
  return shadeWith(shading, color, k);
}

export function IsoBox({
  gx,
  gy,
  w,
  d,
  h,
  z0 = 0,
  color,
  opacity,
}: {
  gx: number;
  gy: number;
  w: number;
  d: number;
  h: number;
  z0?: number;
  color: string;
  opacity?: number;
}) {
  const f = box(gx, gy, w, d, h, z0);
  return (
    <g opacity={opacity}>
      <polygon points={f.left} fill={shade(color, SHADE.left)} />
      <polygon points={f.right} fill={shade(color, SHADE.right)} />
      <polygon points={f.top} fill={shade(color, SHADE.top)} />
    </g>
  );
}

// ── Personnages ──────────────────────────────────────────────
// 100 % procéduraux : aucun sprite, aucune keyframe. Le corps est une
// poignée de primitives (un disque pour le bassin, des capsules pour le
// buste et les bras) fusionnées entre elles de façon organique.
//
// La fusion est un vrai smooth-min : on floute l'alpha puis on la
// seuille durement (filtre #goo). Le rayon du flou joue exactement le
// rôle du k d'un smin polynomial — plus il est large, plus les membres
// se soudent mollement au tronc. Et une capsule SDF n'étant qu'un
// segment doté d'un rayon, on la restitue par un trait à bout rond :
// même géométrie, sans shader ni second contexte de rendu.
//
// La TÊTE reste hors fusion, nette. À ~50 px, un visage fondu redevient
// la bouillie qu'on cherchait à éviter.
//
// Les positions viennent de figure.ts et sont réécrites directement
// dans le DOM à chaque image, hors du cycle de rendu React.

/**
 * Ce qu'il faut pour dessiner quelqu'un : son apparence, plus les rares
 * accessoires qui tiennent au rôle et non au personnage (la tasse que le
 * Fayot porte à quelqu'un d'autre).
 */
export interface Look extends Appearance {
  mug?: boolean;
}

/**
 * Apparence des collègues, déduite de leur archétype — et lue dans le
 * thème du plateau. Ce n'est pas un caprice de rangement : c'est la
 * bande de valeurs du décor qui dicte celle des acteurs. Sur un plateau
 * clair, la chemise blanche du Carriériste devenait un trou blanc ; il
 * porte maintenant la veste sombre de celui qui s'habille pour le poste
 * d'après, ce qui le dit mieux de toute façon.
 */
const LOOKS = T.personnages.archetypes;

const SKINS = T.personnages.peaux;

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// Tête volumineuse, buste court : c'est cette proportion qui donne le
// charme. Le repère de la tête est LOCAL — son centre est (0, 0) — pour
// que le groupe entier puisse être déplacé et incliné d'un coup.
const HEAD_R = 11;
/** Largeur de la zone éclairée avant que l'ombre ne commence, à l'équateur. */
const EDGE = 3;

/**
 * Rayon des mains flottantes.
 *
 * 3,8 pour une tête de 11 : assez pour se lire à l'échelle de jeu, pas
 * assez pour concurrencer le visage. Au-delà de 4,5, la silhouette
 * devient trois boules de taille comparable et on ne sait plus où
 * regarder.
 */
const HAND_R = 3.8;

/**
 * Ombre propre d'une sphère.
 *
 * Le terminateur d'une sphère est une ELLIPSE, pas une droite : il passe
 * par les deux pôles et s'écarte au maximum à l'équateur. La version
 * précédente coupait le disque par une corde verticale — à 20 px ça
 * passait, mais dès qu'on zoome, le visage se lit comme fendu en deux
 * par une fissure. C'est ça, le « truc chelou » : un plan qui traverse
 * une boule.
 *
 * Ici l'ombre est le croissant compris entre le bord droit du disque et
 * ce terminateur elliptique. Elle enveloppe le volume au lieu de le
 * trancher, et disparaît naturellement en haut et en bas du crâne.
 */
function discShadow(r: number, fill: string) {
  return (
    <path
      d={`M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${EDGE} ${r} 0 0 0 0 ${-r} Z`}
      fill={fill}
    />
  );
}

// ── Coiffures ────────────────────────────────────────────────
//
// Le défaut d'avant : la calotte était un arc de CERCLE de rayon R —
// exactement le crâne — refermé par une corde presque horizontale. Deux
// erreurs dans un seul geste.
//
//  · Des cheveux ont une ÉPAISSEUR. Épouser le crâne au millimètre près,
//    c'est dessiner ce qui se moule sur un crâne : un bonnet de bain. Il
//    faut sortir de R, et pas uniformément — la masse est plus haute sur
//    le dessus que sur les tempes.
//
//  · Une naissance de cheveux n'est jamais un arc régulier. Elle a deux
//    golfes aux tempes et redescend au milieu du front. C'est cette
//    irrégularité, et elle seule, qui fait lire « cheveux » plutôt que
//    « couvre-chef ».
//
// Tout part donc de deux courbes composables : une COQUE (le dessus, plus
// large que le crâne) et une LISIÈRE (la naissance). Chaque style choisit
// son épaisseur de coque et sa lisière, plus ce qui tombe derrière.

/**
 * Point de raccord entre la coque et la lisière : sur le CÔTÉ du crâne,
 * à hauteur d'oreille, et un demi-pixel EN DEHORS du disque.
 *
 * C'était l'autre moitié de l'erreur du bonnet de bain. En posant ce
 * raccord à la tempe (x ±10,2 pour un crâne de rayon 11), la masse
 * s'arrêtait à l'intérieur de la silhouette : il restait un liseré de
 * peau tout autour, et la coiffure se lisait comme un couvre-chef posé
 * dessus. Des cheveux DÉBORDENT du crâne et redescendent devant les
 * oreilles.
 */
const COTE_X = HEAD_R + 0.6;
const COTE_Y = 2.2;

/**
 * Bord extérieur de la masse, côté DROIT → côté GAUCHE par le dessus.
 * `t` est l'épaisseur ajoutée au crâne : 0,8 pour des cheveux ras, 3,4
 * pour une masse bouclée.
 */
function coque(t: number): string {
  // La base part de R + 0,6 — l'épaisseur d'une coupe à la tondeuse — et
  // `t` s'ajoute à partir de là. Avec un plancher plus haut, une coupe
  // ras avait autant de volume qu'un carré et les treize coiffures se
  // ressemblaient toutes.
  const flanc = 11.9 + t * 0.85;
  const cote = 11.6 + t;
  const haut = 12.2 + t;
  return (
    `Q ${flanc} -2.6 ${cote} -7.4` +
    ` Q ${cote - 2.4} ${-haut} 0 ${-haut}` +
    ` Q ${-(cote - 2.4)} ${-haut} ${-cote} -7.4` +
    ` Q ${-flanc} -2.6 ${-COTE_X} ${COTE_Y}`
  );
}

/** Naissance des cheveux, côté GAUCHE → côté DROIT. */
const LISIERES = {
  /** Deux golfes et une pointe au milieu du front. */
  classique: `Q -10.6 -3 -6.2 -4.6 Q -2.6 -5.8 0 -3.6 Q 2.6 -5.8 6.2 -4.6 Q 10.6 -3 ${COTE_X} ${COTE_Y}`,
  /** Bas sur le front, à peine ondulée : une frange. */
  basse: `Q -10.8 0.4 -6 -0.4 Q -2.4 -1 0 -0.2 Q 2.6 -1 6 -0.6 Q 10.8 0.2 ${COTE_X} ${COTE_Y}`,
  /** Haute et creusée : le front a gagné du terrain. */
  haute: `Q -10.4 -5 -5.4 -7.4 Q -2 -8.6 0 -6.6 Q 2 -8.6 5.4 -7.4 Q 10.4 -5 ${COTE_X} ${COTE_Y}`,
  /** Raie sur le côté : la mèche traverse le front en diagonale. */
  cote: `Q -10.8 -1.6 -7 -3.2 Q -2 -6 3.6 -6.4 Q 8.6 -6.2 ${COTE_X} ${COTE_Y}`,
} as const;

const masse = (t: number, lisiere: string) =>
  `M ${COTE_X} ${COTE_Y} ${coque(t)} ${lisiere} Z`;

/**
 * Reflet sur la masse. Les cheveux ne sont pas mats : c'est la seule
 * surface du personnage qui accroche vraiment la lumière, et sans ce
 * reflet la coiffure redevient une découpe de papier. Placé en haut à
 * GAUCHE, comme tout le reste de l'éclairage du jeu.
 */
function reflet(t: number, color: string) {
  const e = t * 0.55;
  return (
    <path
      d={`M ${-8.6 - e} ${-5 - e * 0.4}
          Q ${-11 - e} ${-10.4 - e} ${-2.6} ${-12.2 - e}
          Q ${-6.2 - e * 0.4} ${-9.2 - e * 0.6} ${-5.6 - e * 0.3} ${-4.4 - e * 0.3} Z`}
      fill={shade(color, 1.26)}
      opacity="0.75"
    />
  );
}

/**
 * Coiffure, en DEUX couches. Ce qui tombe (capuche, nattes, carré,
 * chignon) passe DERRIÈRE le crâne ; seule la masse du dessus passe
 * devant. Tout peindre après la tête revenait à masquer le visage.
 */
function Hair({
  style,
  color,
  layer,
}: {
  style: HairStyle;
  color: string;
  layer: 'back' | 'front';
}) {
  const R = HEAD_R;
  const dark = shade(color, 0.74);
  const mid = shade(color, 0.88);

  if (layer === 'back') {
    switch (style) {
      case 'capuche':
        // La capuche encadre : une coque large derrière, rien devant.
        // Sa base est arrondie — coupée net, elle donnait une cloche
        // posée sur les épaules.
        return (
          <path
            d={`M ${-R - 3.5} 5
                A ${R + 3.5} ${R + 3.5} 0 0 1 ${R + 3.5} 5
                Q ${R + 3} 11 ${R - 2.5} 12.5
                Q 0 14.5 ${-R + 2.5} 12.5
                Q ${-R - 3} 11 ${-R - 3.5} 5 Z`}
            fill={color}
          />
        );
      case 'rideau':
        // Deux mèches longues. Elles ne tombent pas droit : elles suivent
        // la joue, s'écartent, et s'affinent en bout. Deux rectangles à
        // bouts ronds faisaient des bandes de scotch.
        //
        // Elles doivent tomber EN DEHORS du disque du crâne : posées à
        // ±12 elles passaient derrière la tête et on n'en voyait rien.
        return (
          <g fill={dark}>
            <path
              d={`M -12.6 -5 Q -15.6 3 -13.6 11 Q -12.8 15.6 -9.6 15.2
                  Q -7 14.6 -7.8 10.4 Q -9.4 3 -8 -5 Z`}
            />
            <path
              d={`M 12.6 -5 Q 15.6 3 13.6 11 Q 12.8 15.6 9.6 15.2
                  Q 7 14.6 7.8 10.4 Q 9.4 3 8 -5 Z`}
            />
          </g>
        );
      case 'carre':
        // Un carré, donc une masse franche — mais qui se resserre sous la
        // mâchoire avant de retomber. À bords parallèles, c'était une
        // boîte posée derrière la tête.
        return (
          <path
            d={`M -12.4 -3 Q -13.6 3.4 -12 8.4 Q -11.4 11 -8.4 11.2
                L 8.4 11.2 Q 11.4 11 12 8.4 Q 13.6 3.4 12.4 -3 Z`}
            fill={dark}
          />
        );
      case 'queue':
        // Une queue de cheval : l'élastique la pince, puis elle s'évase
        // et retombe en pointe. Le quadrilatère d'avant faisait un éclat
        // de verre planté dans le crâne.
        return (
          <g>
            <path
              d={`M ${R - 4} -5.5 Q ${R + 2} -6 ${R + 3} -3
                  Q ${R + 8} 1 ${R + 5.5} 7.5 Q ${R + 4} 11.5 ${R + 1} 11
                  Q ${R + 4} 5 ${R + 1.5} 0 Q ${R} -2.5 ${R - 4} -2 Z`}
              fill={dark}
            />
            <ellipse cx={R - 1.4} cy="-3.4" rx="2" ry="2.6" fill={mid} />
          </g>
        );
      case 'chignon':
        // Un chignon : une boule nouée haut derrière, plus quelques
        // cheveux ramenés qui la rejoignent.
        return (
          <g>
            <ellipse cx="1" cy="-14.4" rx="5.6" ry="4.8" fill={dark} />
            <ellipse cx="-0.6" cy="-15.4" rx="2.8" ry="2" fill={mid} opacity="0.8" />
            <path d={`M -11 -6 Q -6 -13 2 -13.6 L 2 -8 Z`} fill={dark} opacity="0.85" />
          </g>
        );
      case 'bouffante':
        // Volume qui descend jusqu'aux épaules, en s'élargissant : c'est
        // l'évasement qui fait la coiffure, une masse à flancs parallèles
        // ferait un casque.
        return (
          <path
            d={`M -13 -5 Q -16.4 3 -14.6 10 Q -13.8 13.6 -10 13.4
                Q -5 12.6 0 12.8 Q 5 12.6 10 13.4
                Q 13.8 13.6 14.6 10 Q 16.4 3 13 -5 Z`}
            fill={dark}
          />
        );
      case 'tresses':
        // Deux nattes, et pas trois : celle du milieu tombait derrière le
        // crâne, donc n'existait pas à l'écran. Les nœuds successifs sont
        // ce qui les distingue d'un simple boudin — sans eux, ce sont des
        // cordes.
        return (
          <g fill={dark}>
            {[-12.4, 12.4].map((x) => (
              <g key={x} transform={`translate(${x},-3)`}>
                <path
                  d={`M -3 -1 Q -4 7 -2.4 14.6 Q -1.6 17.6 0 17.6 Q 1.6 17.6 2.4 14.6
                      Q 4 7 3 -1 Z`}
                />
                {[3.2, 7.6, 12, 15.6].map((y) => (
                  <ellipse key={y} cy={y} rx="3.3" ry="1.2" fill={mid} opacity="0.5" />
                ))}
              </g>
            ))}
          </g>
        );
      case 'boucle':
        // Une masse bouclée se lit à son CONTOUR : festonné, jamais lisse.
        // Une grosse ellipse bien nette ferait un ballon. Les boucles sont
        // donc posées SUR le bord, à cheval dessus, pas à l'intérieur.
        return (
          <g fill={dark}>
            <ellipse cy="-3" rx="14.2" ry="13" />
            {[
              [-13.6, -6.6], [-13, 1.4], [-9.4, 7.4], [-3.4, 10], [3.4, 10],
              [9.4, 7.4], [13, 1.4], [13.6, -6.6], [-10.4, -12.6], [-3.6, -15.4],
              [3.6, -15.4], [10.4, -12.6],
            ].map(([x, y]) => (
              <circle key={`${x},${y}`} cx={x} cy={y} r="3.8" />
            ))}
          </g>
        );
      case 'crete':
        // Côtés rasés : derrière, presque rien — juste la nuque dégradée.
        return <path d="M -9.5 -2 Q -10.5 4 -7.5 6.5 L 7.5 6.5 Q 10.5 4 9.5 -2 Z" fill={dark} opacity="0.8" />;
      case 'frange':
        return (
          <path
            d={`M -12 -4 Q -13.4 2.6 -11.8 7.6 Q -11.2 10 -8.6 10.2
                L 8.6 10.2 Q 11.2 10 11.8 7.6 Q 13.4 2.6 12 -4 Z`}
            fill={dark}
          />
        );
      default:
        return null;
    }
  }

  switch (style) {
    case 'capuche':
      // Devant : le BORD du capuchon, c'est-à-dire un anneau de tissu qui
      // encadre le visage et redescend le long des joues. La version
      // précédente n'était qu'un croissant posé sur le front : elle
      // laissait un grand ovale de peau nu et le personnage avait l'air
      // de porter une visière. Lui a le droit d'être lisse — c'est du
      // tissu, pas des cheveux.
      return (
        <g>
          <path
            d={`M -14 4.5 Q -14.8 -8 -6 -13 Q 0 -15.2 6 -13 Q 14.8 -8 14 4.5
                L 10 4.5 Q 10.6 -6.2 4.6 -9.6 Q 0 -11.4 -4.6 -9.6
                Q -10.6 -6.2 -10 4.5 Z`}
            fill={shade(color, 1.28)}
          />
          {/* Le cordon : deux embouts qui pendent. C'est le détail qui dit
              « sweat à capuche » plutôt que « cape ». */}
          <g fill={shade(color, 1.5)}>
            <rect x="-8.2" y="4" width="1.5" height="4.6" rx="0.7" />
            <rect x="6.7" y="4" width="1.5" height="3.4" rx="0.7" />
          </g>
        </g>
      );

    case 'degarni':
      // Ce qui reste sur un crâne dégarni : deux golfes qui remontent le
      // long des tempes. La bande doit rester MINCE et coller au bord du
      // crâne — épaisse et posée à hauteur d'oreille, elle se lisait
      // comme un casque audio à 20 px, ce qui est la taille où ces
      // personnages vivent réellement.
      return (
        <g fill={color}>
          <path
            d={`M ${-R + 0.4} 1.5 Q ${-R - 0.9} -5.5 ${-R + 5.4} -10
                Q ${-R + 4.6} -6.5 ${-R + 2.8} -1.5 Q ${-R + 1.7} 1.4 ${-R + 0.4} 1.5 Z`}
          />
          <path
            d={`M ${R - 0.4} 1.5 Q ${R + 0.9} -5.5 ${R - 5.4} -10
                Q ${R - 4.6} -6.5 ${R - 2.8} -1.5 Q ${R - 1.7} 1.4 ${R - 0.4} 1.5 Z`}
          />
        </g>
      );

    case 'rase':
      // Ras : la masse la plus fine du jeu (0,8), mais elle SORT quand
      // même du crâne, et sa lisière est haute et creusée. C'est ce qui
      // sépare une coupe courte d'un bonnet.
      return (
        <g>
          <path d={masse(0.15, LISIERES.haute)} fill={color} />
          {reflet(0.15, color)}
        </g>
      );

    case 'plaque':
      // Plaqués en arrière : masse fine, lisière haute, et les stries du
      // peigne qui filent vers l'arrière — sans elles, « plaqué » ne se
      // distingue pas de « ras ». Elles suivent la courbure du crâne et
      // restent FINES : trop larges, elles se lisaient comme une tache de
      // gel plutôt que comme un coup de peigne.
      return (
        <g>
          <path d={masse(1.4, LISIERES.haute)} fill={color} />
          <g stroke={shade(color, 1.32)} strokeWidth="0.6" strokeLinecap="round" fill="none" opacity="0.5">
            <path d="M -8.6 -6.4 Q -4.6 -10.6 1.6 -11.4" />
            <path d="M -9.4 -4.2 Q -5.6 -8.8 0.2 -9.8" />
            <path d="M -9.8 -2 Q -6.8 -6.6 -1.6 -8" />
          </g>
        </g>
      );

    case 'crete':
      // La crête : côtés rasés très courts, et une masse relevée qui
      // dépasse franchement du crâne sur le dessus.
      return (
        <g>
          <path d={masse(0.4, LISIERES.haute)} fill={mid} />
          <path
            d={`M -6.4 -8.4 Q -8 -15.6 -1.6 -18.4 Q 2.2 -20 5.4 -17.6
                Q 2.6 -16 1.6 -12.6 Q 0.8 -9.6 1.4 -7.6 Z`}
            fill={color}
          />
          <path
            d={`M -3.4 -10.6 Q -4.2 -15.4 0.4 -17.2 Q -1.4 -14.4 -1.2 -10.4 Z`}
            fill={shade(color, 1.3)}
            opacity="0.7"
          />
        </g>
      );

    case 'frange':
      // Une frange, c'est une lisière BASSE sur le front, découpée en
      // mèches. Les séparations valent autant que la ligne elle-même :
      // sans elles, c'est un bandeau.
      return (
        <g>
          <path d={masse(2.2, LISIERES.basse)} fill={color} />
          <g stroke={dark} strokeWidth="0.85" strokeLinecap="round" fill="none" opacity="0.6">
            <path d="M -6.8 -8.8 L -5.6 -1" />
            <path d="M -1.6 -9.6 L -1 -0.6" />
            <path d="M 3.8 -9.2 L 4.2 -1.2" />
          </g>
          {reflet(2.2, color)}
        </g>
      );

    case 'boucle':
      // Devant : même principe, un contour festonné. Les boucles sont
      // posées SUR la silhouette — à l'intérieur de la masse elles se
      // fondaient dans l'aplat et on retrouvait un ballon lisse.
      return (
        <g fill={color}>
          <path d={masse(2.6, LISIERES.classique)} />
          {[
            [-12.6, -3.4], [-10.6, -9.6], [-5.6, -13.6], [1.2, -14.8],
            [7.6, -12.6], [11.8, -7.6], [13, -1.6], [-11.6, 1.6], [12, 1.8],
          ].map(([x, y]) => (
            <circle key={`${x},${y}`} cx={x} cy={y} r="3.4" />
          ))}
          {/* Deux boucles qui mordent sur le front : sans elles la lisière
              redevient un arc régulier. */}
          <circle cx="-5.4" cy="-4.6" r="2.6" />
          <circle cx="4.6" cy="-4.8" r="2.6" />
          <circle cx="-6.4" cy="-10" r="2.6" fill={shade(color, 1.26)} opacity="0.55" />
        </g>
      );

    case 'chignon':
      return (
        <g>
          <path d={masse(1.4, LISIERES.cote)} fill={color} />
          {/* Les cheveux tirés vers l'arrière : des stries qui convergent
              vers le nœud, pas un aplat. */}
          <g stroke={shade(color, 1.28)} strokeWidth="0.85" strokeLinecap="round" fill="none" opacity="0.5">
            <path d="M -8.6 -4.6 Q -4.4 -10.4 2.6 -12.2" />
            <path d="M -8 -1.8 Q -3 -8.4 3 -10.4" />
          </g>
        </g>
      );

    case 'bouffante':
      return (
        <g>
          <path d={masse(3, LISIERES.cote)} fill={color} />
          {reflet(3, color)}
        </g>
      );

    case 'tresses':
      return (
        <g>
          <path d={masse(1.4, LISIERES.classique)} fill={color} />
          {/* La raie du milieu : sans elle, trois nattes sortent d'un
              casque uni. */}
          <path d="M 0 -13.2 L 0 -4.2" stroke={dark} strokeWidth="0.9" strokeLinecap="round" opacity="0.65" />
        </g>
      );

    case 'carre':
    case 'queue':
    case 'rideau':
    default:
      return (
        <g>
          <path d={masse(2, LISIERES.classique)} fill={color} />
          {reflet(2, color)}
        </g>
      );
  }
}

/**
 * Fusion metaball des primitives d'un personnage.
 *
 * C'est un smooth-min : on floute l'alpha, puis on la seuille durement.
 * Le rayon du flou EST le k du smin — plus il est large, plus les
 * membres se soudent mollement au tronc. Le seuil règle la netteté du
 * contour obtenu.
 *
 * À déclarer dans les `defs` de TOUT SVG qui dessine un `Figure` : sans
 * lui, le filtre est introuvable et le corps disparaît purement et
 * simplement dans Chrome.
 */
export function GooFilter() {
  return (
    <filter id="goo" x="-22%" y="-18%" width="144%" height="136%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.3" result="blur" />
      <feColorMatrix
        in="blur"
        type="matrix"
        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11"
      />
    </filter>
  );
}

/**
 * Quelqu'un, debout ou assis, animé.
 *
 * Le corps est décrit une fois en primitives ; chaque image ne fait que
 * réécrire leurs coordonnées. La posture, elle, est dictée par ce que le
 * personnage manigance — un comploteur se penche, un bavard gesticule,
 * un guetteur te fixe. L'animation devient de l'information.
 *
 * Le même composant sert au collègue à son poste, au joueur au sien, et
 * à l'aperçu du formulaire d'embauche : trois endroits, un seul dessin,
 * donc aucune chance qu'on se choisisse une tête qu'on n'aura pas.
 */
export function Figure({
  id,
  look,
  posture = postureFor(undefined),
}: {
  /** Identité de dessin : sert aux `id` SVG et au déphasage de l'animation. */
  id: string;
  look: Look;
  posture?: ReturnType<typeof postureFor>;
}) {
  const ref = useRef<SVGGElement>(null);
  const skin = look.skin;
  const skinDark = shade(skin, 0.76);
  const shirtDark = shade(look.shirt, 0.72);
  const bodyId = `body-${id}`;
  // La silhouette dépend du personnage, pas d'un gabarit unique.
  // Mémoïsé : un objet neuf à chaque rendu ferait démonter et
  // réenregistrer le peintre en boucle, et l'animation repartirait de
  // zéro à chaque image.
  const RIG = useMemo(() => rigFor(look.gender, look.build), [look.gender, look.build]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pick = (role: string) => root.querySelector<SVGElement>(`[data-r="${role}"]`);
    const hip = pick('hip');
    const torso = pick('torso');
    const shoulders = pick('shoulders');
    const head = pick('head');
    const kit = pick('kit');
    const mug = pick('mug');
    const mains = [pick('main0'), pick('main1')];
    if (!hip || !torso || !head || !kit) return;

    const motion = makeMotion(phaseOf(id));

    return registerPainter((t, dt) => {
      const p = poseFigure(t, dt, motion, posture, RIG);
      hip.setAttribute('cx', p.hip.x.toFixed(2));
      hip.setAttribute('cy', p.hip.y.toFixed(2));
      hip.setAttribute('r', p.hipR.toFixed(2));
      torso.setAttribute('stroke-width', (p.bodyR * 2).toFixed(2));
      torso.setAttribute('x1', p.hip.x.toFixed(2));
      torso.setAttribute('y1', p.hip.y.toFixed(2));
      torso.setAttribute('x2', p.chest.x.toFixed(2));
      torso.setAttribute('y2', p.chest.y.toFixed(2));
      if (shoulders) {
        shoulders.setAttribute('cx', p.chest.x.toFixed(2));
        shoulders.setAttribute('cy', p.chest.y.toFixed(2));
        shoulders.setAttribute('rx', (p.shoulderHalf + p.shoulderR).toFixed(2));
        shoulders.setAttribute('ry', p.shoulderR.toFixed(2));
      }
      // L'IK ne dessine aucun membre : elle place les MAINS, qui flottent
      // détachées du corps. Le coude qu'elle calcule sert quand même —
      // c'est lui qui donne aux mains une trajectoire d'avant-bras et
      // non un simple va-et-vient horizontal.
      for (let i = 0; i < mains.length; i++) {
        const el = mains[i];
        if (!el) continue;
        const m = p.arms[i]!.c;
        el.setAttribute('transform', `translate(${m.x.toFixed(2)},${m.y.toFixed(2)})`);
      }
      if (mug) {
        const m = p.arms[0]!.c;
        mug.setAttribute('transform', `translate(${m.x.toFixed(2)},${m.y.toFixed(2)})`);
      }
      head.setAttribute(
        'transform',
        `translate(${p.head.x.toFixed(2)},${p.head.y.toFixed(2)}) rotate(${p.headTilt.toFixed(2)})`,
      );
      kit.setAttribute(
        'transform',
        `translate(${p.chest.x.toFixed(2)},${p.chest.y.toFixed(2)})`,
      );
    });
  }, [id, posture, RIG]);

  // Le corps : quelques primitives, une seule couleur. `currentColor`
  // permet d'en tirer la copie d'ombre par <use>, sans dupliquer ni les
  // formes ni les mises à jour.
  const body = (
    <g id={bodyId} filter="url(#goo)">
      <circle data-r="hip" cx="0" cy={RIG.hipY} r={RIG.hipR} fill="currentColor" />
      <line
        data-r="torso"
        x1="0" y1={RIG.hipY} x2="0" y2={RIG.chestY}
        stroke="currentColor" strokeWidth={RIG.bodyR * 2} strokeLinecap="round"
      />
      {/* Les ÉPAULES : la primitive la plus large de la figure. C'est le
          rapport épaules / taille qui fait lire un corps.
          Une capsule horizontale à bouts ronds a un dessus PLAT entre ses
          deux bouts — d'où la coupe nette au-dessus des épaules. Une
          ellipse n'a de plat nulle part, et sa pente naturelle depuis le
          cou vers les bras est justement celle d'une épaule. */}
      <ellipse
        data-r="shoulders"
        cx="0" cy={RIG.chestY}
        rx={RIG.shoulderHalf + RIG.shoulderR} ry={RIG.shoulderR}
        fill="currentColor"
      />
    </g>
  );


  return (
    <g ref={ref} className="iso-person">
      <ellipse rx="14" ry="5.5" fill={T.ombre.contact} />

      {/* Copie décalée en ton sombre : elle dépasse à droite et rend
          l'arête d'ombre franche du reste du décor. */}
      <g style={{ color: shirtDark }} transform="translate(3.4,0)">
        <use href={`#${bodyId}`} />
      </g>
      <g style={{ color: look.shirt }}>{body}</g>

      {/* Accessoires du buste : nets, donc hors fusion. */}
      <g data-r="kit">
        {/* Le col est un TRAIT, pas un aplat : un triangle plein posé sur
            la poitrine se lisait comme une serviette de table. Tracé, il
            devient l'ouverture d'une chemise. Il doit rester DANS la
            masse du buste — débordant au-dessus des épaules, il devenait
            un harnais. */}
        <path
          d="M -4 -1.4 L 0 3.1 L 4 -1.4"
          fill="none"
          stroke={shade(look.shirt, 1.2)}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {look.tie && (
          /* Une cravate a un NŒUD puis un pan qui s'élargit avant de
             finir en pointe. Le losange symétrique d'avant, pointu aux
             deux bouts, donnait un poignard planté sur le torse. */
          <g>
            <path d="M -1.6 2.2 Q 0 1.3 1.6 2.2 L 2 4.5 Q 0 5.2 -2 4.5 Z"
              fill={shade(look.tie, 1.14)} />
            {/* Le pan : bords droits et pointe franche. Ici les droites
                sont justes — c'est du tissu repassé, pas un volume rond. */}
            <path d="M -2 4.7 L 2 4.7 L 2.5 9.3 L 0 14.2 L -2.5 9.3 Z" fill={look.tie} />
          </g>
        )}
      </g>

      {/* LES MAINS, à la Rayman : deux boules détachées du corps.
          Elles ne sont PAS dans le filtre de fusion — c'est tout le
          principe. Fusionnées, elles auraient reformé des bras, et des
          bras sur un buste de cette proportion donnent des moignons.
          Détachées, la lecture est immédiate et le mouvement devient
          lisible : ce sont elles qui portent la cadence de frappe.

          Chacune a sa copie d'ombre décalée, comme le corps, sinon elles
          flottent sans poids au-dessus d'un buste qui, lui, en a un. */}
      {[0, 1].map((i) => (
        <g key={i} data-r={`main${i}`}>
          <circle cx="2.2" cy="0.6" r={HAND_R} fill={skinDark} />
          <circle r={HAND_R} fill={skin} />
        </g>
      ))}

      {look.mug && (
        /* Tenue par la main gauche, dont la position vient de l'IK. */
        <g data-r="mug">
          <rect x="-3" y="-3" width="5.4" height="5.8" fill={T.personnages.tasse} />
          <rect x="2.4" y="-1.6" width="1.9" height="2.6" fill={T.personnages.tasse} />
          <ellipse cy="-3" rx="2.7" ry="1" fill={T.personnages.tasseCafe} />
        </g>
      )}

      {/* Tête : repère local, centre en (0,0). */}
      <g data-r="head">
        <Hair style={look.hairStyle} color={look.hair} layer="back" />
        <circle r={HEAD_R} fill={skin} />
        {discShadow(HEAD_R, skinDark)}
        <Hair style={look.hairStyle} color={look.hair} layer="front" />
        <circle className="iso-person__eye" cx="-4" cy="1" r="1.7" fill={T.personnages.oeil} />
        <circle className="iso-person__eye" cx="4" cy="1" r="1.7" fill={T.personnages.oeil} />
        {look.glasses && (
          /* Deux verres cerclés. La « barre pleine » que j'avais mise ici
             pour gagner en lisibilité se lisait comme un bandeau. */
          <g>
            <circle cx="-4.2" cy="1" r="3.4" fill={T.personnages.verre}
              stroke={T.personnages.oeil} strokeWidth="1.1" />
            <circle cx="4.2" cy="1" r="3.4" fill={T.personnages.verre}
              stroke={T.personnages.oeil} strokeWidth="1.1" />
            <path d="M -0.8 1 L 0.8 1" stroke={T.personnages.oeil} strokeWidth="1.1" />
          </g>
        )}
      </g>
    </g>
  );
}

/** Un collègue à son poste : son apparence découle de son archétype. */
export function Person({ c }: { c: Colleague }) {
  const base = LOOKS[c.archetype] ?? LOOKS.nouveau!;
  const look: Look = { ...base, skin: SKINS[hashOf(c.id) % SKINS.length]! };
  return <Figure id={c.id} look={look} posture={postureFor(c.intent?.kind)} />;
}

// ── Poste de travail ─────────────────────────────────────────
/**
 * Le poste, du fond vers l'avant : clavier côté occupant, écran au bord
 * avant, dos tourné à la caméra. C'est la seule disposition cohérente —
 * l'inverse ferait taper les gens à travers leur moniteur.
 */
export function Desk({
  gx,
  gy,
  wood = T.structure.bois,
  frame = T.structure.metal,
  seed = 0,
}: {
  gx: number;
  gy: number;
  wood?: string;
  frame?: string;
  /** Fait varier le fouillis d'un poste à l'autre : huit bureaux
   *  rigoureusement identiques trahissent le copier-coller. */
  seed?: number;
}) {
  const TOP = 26;
  const STAND = TOP + 12; // hauteur du pied : le panneau démarre là
  const PANEL_H = 20;
  const mon = box(gx + 0.62, gy + 0.68, 0.86, 0.09, PANEL_H, STAND);
  // Le halo se répand vers le fond : c'est l'occupant que l'écran éclaire.
  const spill = iso(gx + 1.05, gy + 0.34, TOP);
  const crown = iso(gx + 1.05, gy + 0.72, STAND + PANEL_H);

  return (
    <g>
      {/* piètement + voile de bureau */}
      <IsoBox gx={gx + 0.06} gy={gy + 0.08} w={0.12} d={0.9} h={TOP - 3} color={frame} />
      <IsoBox gx={gx + DESK_W - 0.18} gy={gy + 0.08} w={0.12} d={0.9} h={TOP - 3} color={frame} />
      <IsoBox gx={gx + 0.2} gy={gy + DESK_D - 0.08} w={DESK_W - 0.4} d={0.06} h={TOP - 12} color={shade(frame, 1.05)} />
      {/* caisson à tiroirs — AVANT le plateau : il passe dessous, donc il
          doit être peint avant, sinon il troue la table. */}
      <IsoBox gx={gx + DESK_W - 0.72} gy={gy + 0.12} w={0.6} d={0.78} h={TOP - 5} color={shade(frame, 1.5)} />
      {[6, 13].map((z) => (
        <g key={z}>
          <polygon points={box(gx + DESK_W - 0.74, gy + 0.1, 0.6, 0.8, 0.8, z).left}
            fill={T.ombre.creux} />
          <polygon points={box(gx + DESK_W - 0.74, gy + 0.1, 0.6, 0.8, 0.8, z + 1).left}
            fill={T.ombre.lisere} />
        </g>
      ))}
      {/* plateau — teinte légèrement décalée d'un poste à l'autre */}
      <IsoBox gx={gx} gy={gy} w={DESK_W} d={DESK_D} h={4} z0={TOP - 4}
        color={shade(wood, 0.93 + (seed % 3) * 0.055)} />

      {/* clavier + souris, côté occupant */}
      <polygon points={quad(gx + 0.5, gy + 0.16, 0.92, 0.26, TOP + 0.5)} fill={T.structure.ecranArete} />
      <polygon points={quad(gx + 0.54, gy + 0.19, 0.84, 0.2, TOP + 1.2)} fill={T.structure.metal} />
      <ellipse {...(() => { const p = iso(gx + 1.58, gy + 0.28, TOP); return { cx: p.x, cy: p.y }; })()}
        rx="3.4" ry="2.1" fill={T.structure.metal} />

      {/* Fouillis personnel — chaque poste tire le sien. */}
      {seed % 3 === 0 && (
        <g>
          <IsoBox gx={gx + 0.22} gy={gy + 0.6} w={0.17} d={0.17} h={5} z0={TOP} color={T.personnages.tasse} />
          <ellipse {...(() => { const p = iso(gx + 0.305, gy + 0.685, TOP + 5); return { cx: p.x, cy: p.y }; })()}
            rx="2.6" ry="1.3" fill={T.personnages.tasseCafe} />
        </g>
      )}
      {seed % 2 === 0 && (
        <g>
          <polygon points={quad(gx + 1.5, gy + 0.62, 0.42, 0.34, TOP + 0.4)} fill={T.habillage.papierOmbre} />
          <polygon points={quad(gx + 1.53, gy + 0.6, 0.42, 0.34, TOP + 1.6)} fill={T.habillage.papier} />
        </g>
      )}
      {seed % 5 === 1 && (
        <g>
          <IsoBox gx={gx + 1.72} gy={gy + 0.14} w={0.2} d={0.2} h={4} z0={TOP} color={T.habillage.terre} />
          <ellipse {...(() => { const p = iso(gx + 1.82, gy + 0.24, TOP + 4); return { cx: p.x, cy: p.y }; })()}
            rx="4" ry="3" fill={T.habillage.vegetal} />
          <ellipse {...(() => { const p = iso(gx + 1.82, gy + 0.24, TOP + 7); return { cx: p.x, cy: p.y }; })()}
            rx="2.6" ry="2" fill={T.habillage.vegetalClair} />
        </g>
      )}
      {seed % 4 === 1 && (
        /* pense-bête abandonné sur le plateau */
        <polygon points={quad(gx + 0.28, gy + 0.28, 0.19, 0.19, TOP + 0.4)} fill={T.habillage.postIt} />
      )}

      {/* nappe de lumière projetée sur le plateau, côté occupant */}
      <ellipse cx={spill.x} cy={spill.y} rx="30" ry="13" fill="url(#screenPool)" className="iso-screen-pool" />

      {/* pied : socle + colonne */}
      <IsoBox gx={gx + 0.88} gy={gy + 0.7} w={0.34} d={0.22} h={2.5} z0={TOP} color={T.structure.ecranPied} />
      <IsoBox gx={gx + 1.0} gy={gy + 0.75} w={0.1} d={0.11} h={11} z0={TOP + 2} color={T.structure.ecranPied} />

      {/* panneau, dos tourné à la caméra */}
      <polygon points={mon.left} fill={T.structure.ecranDos} />
      <polygon points={mon.right} fill={T.structure.ecranArete} />
      <polygon points={mon.top} fill={T.structure.metalClair} />
      {/* grille d'aération + pastille de marque sur le dos */}
      {[0, 1, 2, 3].map((i) => (
        <polygon key={i}
          points={box(gx + 0.74 + i * 0.16, gy + 0.68, 0.1, 0.02, 1.6, STAND + 12 - i * 0).left}
          fill={T.ombre.creux} />
      ))}
      <ellipse {...(() => { const p = iso(gx + 1.05, gy + 0.68, STAND + 6); return { cx: p.x, cy: p.y }; })()}
        rx="2" ry="1.4" fill={T.ombre.lisere} />
      {/* liseré clair du châssis, côté lumière */}
      <polygon points={mon.left} fill="none" stroke={T.ombre.lisere} strokeWidth="0.9" />

      {/* la lumière de la dalle déborde par le haut du châssis */}
      <polygon points={mon.top} fill="url(#screenEdge)" className="iso-screen" />
      <ellipse cx={crown.x} cy={crown.y - 2} rx="21" ry="6.5" fill="url(#screenPool)"
        className="iso-screen" />
    </g>
  );
}

/** Fauteuil de bureau : assise, dossier, vérin, étoile à roulettes. */
export function OfficeChair({ gx, gy, color = T.structure.tissu }: { gx: number; gy: number; color?: string }) {
  const base = iso(gx + 0.35, gy + 0.35);
  return (
    <g>
      <ellipse cx={base.x} cy={base.y} rx="13" ry="5.5" fill={T.ombre.contact} />
      {[0, 72, 144, 216, 288].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line key={a} x1={base.x} y1={base.y - 3} x2={base.x + Math.cos(r) * 11}
            y2={base.y - 3 + Math.sin(r) * 5.5} stroke={shade(color, 0.8)} strokeWidth="2.2"
            strokeLinecap="round" />
        );
      })}
      <IsoBox gx={gx + 0.28} gy={gy + 0.28} w={0.14} d={0.14} h={11} color={shade(color, 0.75)} />
      <IsoBox gx={gx} gy={gy} w={0.72} d={0.72} h={4} z0={11} color={shade(color, 1.25)} />
      <IsoBox gx={gx + 0.02} gy={gy - 0.02} w={0.68} d={0.1} h={22} z0={13} color={color} />
      <IsoBox gx={gx + 0.06} gy={gy - 0.03} w={0.6} d={0.06} h={16} z0={17} color={shade(color, 1.35)} />
    </g>
  );
}

export function Plant({ gx, gy, scale = 1 }: { gx: number; gy: number; scale?: number }) {
  const p = iso(gx, gy);
  return (
    <g transform={`translate(${p.x},${p.y}) scale(${scale})`}>
      <ellipse rx="11" ry="4.8" fill={T.ombre.contactForte} />
      <path d="M -6.4 0 L -5 -13.5 L 5 -13.5 L 6.4 0 Z" fill={T.habillage.terre} />
      <path d="M -6.6 -13 L 6.6 -13 L 6 -10.4 L -6 -10.4 Z" fill={shade(T.habillage.terre, 1.16)} />
      <ellipse cy="-13" rx="5.6" ry="1.8" fill={shade(T.habillage.terre, 0.52)} />
      <path d="M 0 -13 C -16 -17, -14 -35, -1.5 -30 C -5 -23, -2 -17, 0 -13 Z" fill={T.habillage.vegetalFonce} />
      <path d="M 0 -13 C 16 -18, 13 -36, 1.5 -30 C 5 -23, 2 -17, 0 -13 Z" fill={T.habillage.vegetal} />
      <path d="M 0 -15 C -6 -31, 1 -45, 4 -33 C 2.5 -25, 1 -19, 0 -15 Z" fill={T.habillage.vegetalClair} />
      <path d="M 0 -14 C 8 -24, 12 -28, 9 -20 C 6 -17, 2 -15, 0 -14 Z" fill={shade(T.habillage.vegetal, 0.9)} />
      <path d="M -1 -29 C -1 -24, -0.5 -19, 0 -15" fill="none" stroke={T.ombre.lisere} strokeWidth="0.8" />
    </g>
  );
}

export function Shelf({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.56} d={1.9} h={64} color={T.structure.boisFonce} />
      {[14, 28, 42, 56].map((z) => (
        <g key={z}>
          <polygon points={quad(gx + 0.04, gy + 0.05, 0.48, 1.8, z)} fill={shade(T.structure.boisFonce, 0.72)} />
          {[0.1, 0.6, 1.05].map((o, i) => (
            <IsoBox key={o} gx={gx + 0.1} gy={gy + 0.12 + o} w={0.34} d={0.42 - i * 0.06} h={11}
              z0={z} color={T.habillage.casiers[(i + z) % T.habillage.casiers.length]!} />
          ))}
        </g>
      ))}
    </g>
  );
}

export function Sofa({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={2.4} d={1} h={11} color={T.structure.tissu} />
      <IsoBox gx={gx + 0.16} gy={gy + 0.18} w={1} d={0.72} h={5} z0={11} color={T.structure.metalClair} />
      <IsoBox gx={gx + 1.24} gy={gy + 0.18} w={1} d={0.72} h={5} z0={11} color={T.structure.metalClair} />
      <IsoBox gx={gx} gy={gy} w={2.4} d={0.2} h={28} color={T.structure.tissuFonce} />
      <IsoBox gx={gx} gy={gy + 0.18} w={0.24} d={0.84} h={19} color={T.structure.metalClair} />
      <IsoBox gx={gx + 2.16} gy={gy + 0.18} w={0.24} d={0.84} h={19} color={T.structure.tissu} />
      <IsoBox gx={gx + 0.7} gy={gy + 0.16} w={0.42} d={0.12} h={11} z0={16} color={T.habillage.cartonFonce} />
    </g>
  );
}

export function CoffeeMachine({ gx, gy }: { gx: number; gy: number }) {
  const led = iso(gx + 0.5, gy + 0.55, 54);
  return (
    <g>
      <IsoBox gx={gx - 0.1} gy={gy - 0.1} w={1.2} d={1.1} h={30} color={T.structure.metalFonce} />
      <IsoBox gx={gx} gy={gy} w={0.92} d={0.9} h={26} z0={30} color={T.structure.ecranArete} />
      <IsoBox gx={gx + 0.1} gy={gy + 0.62} w={0.7} d={0.24} h={13} z0={32} color={shade(T.structure.ecranArete, 0.8)} />
      <circle cx={led.x} cy={led.y} r="2.6" fill={T.signal.orClair} className="iso-blink" />
      {[0, 1].map((i) => (
        <IsoBox key={i} gx={gx + 0.2 + i * 0.34} gy={gy + 0.7} w={0.16} d={0.16} h={5} z0={32}
          color={T.personnages.tasse} />
      ))}
    </g>
  );
}

export function MeetingTable({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx + 0.3} gy={gy + 0.3} w={2.4} d={0.9} h={22} color={T.structure.metalFonce} />
      <IsoBox gx={gx} gy={gy} w={3} d={1.5} h={4} z0={22} color={T.structure.bois} />
      <polygon points={quad(gx + 1.2, gy + 0.5, 0.5, 0.5, 26)} fill={T.structure.ecranArete} />
      <polygon points={quad(gx + 0.3, gy + 0.4, 0.34, 0.4, 26)} fill={T.habillage.papier} />
      <polygon points={quad(gx + 2.2, gy + 0.7, 0.34, 0.4, 26)} fill={T.habillage.papier} />
    </g>
  );
}

export function Printer({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.8} d={0.9} h={22} color={T.structure.metalFonce} />
      <IsoBox gx={gx + 0.04} gy={gy + 0.04} w={0.72} d={0.82} h={9} z0={22} color={T.structure.ecranArete} />
      <polygon points={quad(gx + 0.1, gy + 0.5, 0.6, 0.34, 31.5)} fill={T.habillage.papier} />
      <IsoBox gx={gx + 0.1} gy={gy + 0.06} w={0.6} d={0.14} h={2} z0={31} color={shade(T.structure.ecranArete, 0.82)} />
    </g>
  );
}

export function WaterCooler({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.52} d={0.52} h={20} color={T.structure.metalClair} opacity={0.9} />
      <IsoBox gx={gx + 0.04} gy={gy + 0.04} w={0.44} d={0.44} h={17} z0={20} color={T.signal.ecranLueur} opacity={0.75} />
      <IsoBox gx={gx + 0.14} gy={gy + 0.46} w={0.24} d={0.08} h={4} z0={12} color={T.structure.metalFonce} />
    </g>
  );
}

/** Rangée de casiers : meuble la zone de circulation devant les archives. */
export function Lockers({ gx, gy, count = 2 }: { gx: number; gy: number; count?: number }) {
  const W = 0.54;
  const H = 54;
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = gx + i * (W + 0.03);
        return (
          <g key={i}>
            <IsoBox gx={x} gy={gy} w={W} d={0.6} h={H} color={T.structure.metal} />
            {/* deux vantaux + poignées, sur la face avant */}
            {[
              [4, 26],
              [28, 50],
            ].map(([z1, z2]) => (
              <g key={z1}>
                <polygon
                  points={panelAlongX(x + 0.04, x + W - 0.04, gy + 0.601, z1!, z2!)}
                  fill={T.ombre.creux}
                />
                <polygon
                  points={panelAlongX(x + 0.06, x + W - 0.06, gy + 0.602, z1! + 1, z2! - 1)}
                  fill={T.ombre.lisere}
                />
                <polygon
                  points={panelAlongX(x + W - 0.16, x + W - 0.09, gy + 0.603, z2! - 8, z2! - 6)}
                  fill={T.structure.metalClair}
                />
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

/** Bacs de tri — le détail qui dit « couloir de bureau » sans rien expliquer. */
export function Bins({ gx, gy }: { gx: number; gy: number }) {
  const lids = T.habillage.poubelles;
  return (
    <g>
      {lids.map((lid, i) => (
        <g key={lid}>
          <IsoBox gx={gx + i * 0.4} gy={gy} w={0.34} d={0.34} h={17} color={T.structure.metalFonce} />
          <IsoBox gx={gx + i * 0.4 - 0.02} gy={gy - 0.02} w={0.38} d={0.38} h={2.5} z0={17} color={lid} />
        </g>
      ))}
    </g>
  );
}

/** Paperboard sur chevalet, pour la salle de réunion. */
export function FlipChart({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx + 0.06} gy={gy + 0.5} w={0.06} d={0.06} h={30} color={T.structure.bois} />
      <IsoBox gx={gx + 0.62} gy={gy + 0.5} w={0.06} d={0.06} h={30} color={T.structure.boisFonce} />
      <polygon points={panelAlongX(gx, gx + 0.74, gy + 0.5, 28, 64)} fill={T.structure.metalFonce} />
      <polygon points={panelAlongX(gx + 0.03, gx + 0.71, gy + 0.505, 30, 62)} fill={T.habillage.papier} />
      {[56, 50, 44].map((z, i) => (
        <polygon
          key={z}
          points={panelAlongX(gx + 0.09, gx + 0.09 + (i === 1 ? 0.5 : 0.36), gy + 0.51, z - 1.6, z)}
          fill={T.structure.ecranArete}
        />
      ))}
    </g>
  );
}

/** Écran de présentation sur pied, tourné vers la table de réunion. */
export function WallScreen({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy + 0.3} w={0.7} d={0.35} h={3} color={T.structure.metalFonce} />
      <IsoBox gx={gx + 0.3} gy={gy + 0.42} w={0.12} d={0.12} h={22} color={T.structure.ecranPied} />
      <IsoBox gx={gx + 0.04} gy={gy + 0.44} w={0.06} d={1.5} h={30} z0={22} color={T.structure.ecranDos} />
      <polygon points={box(gx + 0.04, gy + 0.44, 0.06, 1.5, 30, 22).right} fill={T.structure.ecranArete} />
      <polygon points={box(gx + 0.05, gy + 0.5, 0.06, 1.38, 26, 24).right} fill={T.signal.ecranLueur} />
    </g>
  );
}

/** Crédence basse : socle pour une plante, comble un angle mort. */
export function Credenza({ gx, gy, w = 1, d = 0.7 }: { gx: number; gy: number; w?: number; d?: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={w} d={d} h={19} color={T.structure.boisFonce} />
      <IsoBox gx={gx - 0.03} gy={gy - 0.03} w={w + 0.06} d={d + 0.06} h={2} z0={19} color={T.structure.bois} />
      {[0.06, w / 2 + 0.02].map((o) => (
        <polygon key={o} points={panelAlongX(gx + o, gx + o + w / 2 - 0.08, gy + d + 0.001, 3, 16)}
          fill={T.ombre.creux} />
      ))}
    </g>
  );
}
