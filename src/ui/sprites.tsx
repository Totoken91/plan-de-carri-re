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
import { useEffect, useRef } from 'react';
import type { Colleague } from '@state/schema';
import { DESK_D, DESK_W, box, iso, panelAlongX, quad } from './iso';
import {
  DEFAULT_RIG as RIG,
  makeMotion,
  phaseOf,
  poseFigure,
  postureFor,
  registerPainter,
} from './figure';

// ── Ombrage ──────────────────────────────────────────────────
// La face à l'ombre ne descend pas sous 0,74 : en dessous, les volumes
// sombres virent au noir absolu et se lisent comme des trous dans la
// géométrie plutôt que comme des faces éclairées de biais.
export const SHADE = { top: 1.2, left: 0.94, right: 0.74 };

/**
 * Lit aussi bien `#rrggbb` que `rgb(r,g,b)`.
 *
 * Indispensable : `shade()` renvoie du `rgb(...)`, et plusieurs meubles
 * lui repassent le résultat (un caisson tiré du ton du piètement, par
 * exemple). Quand le parseur ne gérait que l'hexadécimal, ces couleurs
 * ressortaient en NOIR PUR — d'où les masses opaques sous les bureaux.
 */
function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
}

export function shade(color: string, k: number): string {
  const [r, g, b] = parseColor(color);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
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

type HairStyle = 'plaque' | 'queue' | 'capuche' | 'rideau' | 'degarni' | 'carre';

interface Look {
  shirt: string;
  hair: string;
  style: HairStyle;
  glasses?: boolean;
  tie?: string;
  mug?: boolean;
}

const LOOKS: Record<string, Look> = {
  // Chemise claire, cravate : le seul qui s'habille pour le poste d'après.
  carrieriste: { shirt: '#dfe3ea', hair: '#332a20', style: 'plaque', tie: '#b4453b' },
  // Queue de cheval, lunettes, et un café qu'il porte à quelqu'un d'autre.
  fayot: { shirt: '#cf9a3c', hair: '#5a3f2c', style: 'queue', glasses: true, mug: true },
  // La capuche : reconnaissable même en ombre chinoise.
  glandeur: { shirt: '#4e9b68', hair: '#241f1c', style: 'capuche' },
  // Cheveux en rideau, lunettes : on ne voit jamais tout à fait son visage.
  parano: { shirt: '#7d68b8', hair: '#4b3728', style: 'rideau', glasses: true },
  // Quinze ans de maison, et le crâne qui va avec.
  veteran: { shirt: '#4a90ab', hair: '#b9bec4', style: 'degarni' },
  nouveau: { shirt: '#8b93a6', hair: '#8a6440', style: 'carre' },
};

const SKINS = ['#e9b78f', '#c98c62', '#8d5a3b', '#f0cba6', '#a9714a', '#6d4530'];

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// Tête volumineuse, buste court : c'est cette proportion qui donne le
// charme. Le repère de la tête est LOCAL — son centre est (0, 0) — pour
// que le groupe entier puisse être déplacé et incliné d'un coup.
const HEAD_R = 11;
/** Abscisse de l'arête d'ombre : décalée du centre, jamais pile au milieu. */
const EDGE = 3;

/** Moitié droite d'un disque, coupée net à l'abscisse EDGE. */
function discShadow(r: number, fill: string) {
  const dy = Math.sqrt(r * r - EDGE * EDGE);
  return <path d={`M ${EDGE} ${-dy} A ${r} ${r} 0 0 1 ${EDGE} ${dy} Z`} fill={fill} />;
}

/**
 * Coiffure, en DEUX couches. Une capuche, une frange ou un carré passent
 * DERRIÈRE le crâne ; seule la calotte passe devant. Tout peindre après
 * la tête revenait à masquer le visage — c'est ce qui rendait le
 * capuchonné entièrement noir.
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
  const dark = shade(color, 0.74);
  const cap = (
    <path d={`M ${-HEAD_R} ${-2.5} A ${HEAD_R} ${HEAD_R} 0 0 1 ${HEAD_R} ${-2.5} Z`} fill={color} />
  );

  if (layer === 'back') {
    switch (style) {
      case 'capuche':
        // La capuche encadre : une coque large derrière, rien devant.
        return (
          <path
            d={`M ${-HEAD_R - 3.5} 7 A ${HEAD_R + 3.5} ${HEAD_R + 3.5} 0 0 1 ${HEAD_R + 3.5} 7
                L ${HEAD_R + 2} 11 L ${-HEAD_R - 2} 11 Z`}
            fill={color}
          />
        );
      case 'rideau':
        return (
          <g fill={dark}>
            <path d={`M ${-HEAD_R - 1} -3 L ${-HEAD_R - 1} 12 L ${-HEAD_R + 4} 12 L ${-HEAD_R + 4} -3 Z`} />
            <path d={`M ${HEAD_R + 1} -3 L ${HEAD_R + 1} 12 L ${HEAD_R - 4} 12 L ${HEAD_R - 4} -3 Z`} />
          </g>
        );
      case 'carre':
        return (
          <path d={`M ${-HEAD_R - 1.5} -2 L ${-HEAD_R - 1.5} 8 L ${HEAD_R + 1.5} 8 L ${HEAD_R + 1.5} -2 Z`}
            fill={dark} />
        );
      case 'queue':
        return (
          <path d={`M ${HEAD_R - 2} -4 L ${HEAD_R + 5} 1 L ${HEAD_R + 3} 9 L ${HEAD_R - 3} 2 Z`}
            fill={dark} />
        );
      default:
        return null;
    }
  }

  switch (style) {
    case 'capuche':
      // Devant : juste le bord du capuchon sur le front.
      return (
        <path d={`M ${-HEAD_R - 0.5} -4 A ${HEAD_R + 0.5} ${HEAD_R + 0.5} 0 0 1 ${HEAD_R + 0.5} -4
                  L ${HEAD_R - 1} -6 A ${HEAD_R} ${HEAD_R} 0 0 0 ${-HEAD_R + 1} -6 Z`}
          fill={shade(color, 1.35)} />
      );
    case 'degarni':
      return (
        <g fill={color}>
          <path d={`M ${-HEAD_R} -1 A ${HEAD_R} ${HEAD_R} 0 0 1 ${-HEAD_R + 4} -8.5 L ${-HEAD_R + 4} -1 Z`} />
          <path d={`M ${HEAD_R} -1 A ${HEAD_R} ${HEAD_R} 0 0 0 ${HEAD_R - 4} -8.5 L ${HEAD_R - 4} -1 Z`} />
        </g>
      );
    case 'plaque':
      return (
        <g>
          {cap}
          <path d={`M ${-HEAD_R + 1} -6 L ${-HEAD_R - 2.5} -1 L ${-HEAD_R + 2} -1.5 Z`} fill={color} />
        </g>
      );
    default:
      return cap;
  }
}

/**
 * Un collègue à son poste.
 *
 * Le corps est décrit une fois en primitives ; chaque image ne fait que
 * réécrire leurs coordonnées. La posture, elle, est dictée par ce que le
 * personnage manigance — un comploteur se penche, un bavard gesticule,
 * un guetteur te fixe. L'animation devient de l'information.
 */
export function Person({ c }: { c: Colleague }) {
  const ref = useRef<SVGGElement>(null);
  const h = hashOf(c.id);
  const look = LOOKS[c.archetype] ?? LOOKS.nouveau!;
  const skin = SKINS[h % SKINS.length]!;
  const skinDark = shade(skin, 0.76);
  const shirtDark = shade(look.shirt, 0.72);
  const bodyId = `body-${c.id}`;
  const posture = postureFor(c.intent?.kind);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pick = (role: string) => root.querySelector<SVGElement>(`[data-r="${role}"]`);
    const hip = pick('hip');
    const torso = pick('torso');
    const head = pick('head');
    const kit = pick('kit');
    const hand = pick('hand');
    if (!hip || !torso || !head || !kit) return;

    const motion = makeMotion(phaseOf(c.id));

    return registerPainter((t, dt) => {
      const p = poseFigure(t, dt, motion, posture, RIG);
      hip.setAttribute('cx', p.hip.x.toFixed(2));
      hip.setAttribute('cy', p.hip.y.toFixed(2));
      torso.setAttribute('x1', p.hip.x.toFixed(2));
      torso.setAttribute('y1', p.hip.y.toFixed(2));
      torso.setAttribute('x2', p.chest.x.toFixed(2));
      torso.setAttribute('y2', p.chest.y.toFixed(2));
      // L'IK ne dessine plus de membre : elle place ce que la main tient.
      if (hand) {
        const m = p.arms[0]!.c;
        hand.setAttribute('transform', `translate(${m.x.toFixed(2)},${m.y.toFixed(2)})`);
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
  }, [c.id, posture]);

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
    </g>
  );


  return (
    <g ref={ref} className="iso-person">
      <ellipse rx="14" ry="5.5" fill="rgba(0,0,0,0.32)" />

      {/* Copie décalée en ton sombre : elle dépasse à droite et rend
          l'arête d'ombre franche du reste du décor. */}
      <g style={{ color: shirtDark }} transform="translate(3.4,0)">
        <use href={`#${bodyId}`} />
      </g>
      <g style={{ color: look.shirt }}>{body}</g>

      {/* Accessoires du buste : nets, donc hors fusion. */}
      <g data-r="kit">
        <path d="M -3.2 -2 L 0 2.6 L 3.2 -2 Z" fill={shade(look.shirt, 1.14)} />
        {look.tie && <path d="M 0 2 L 2.1 5.5 L 0 15 L -2.1 5.5 Z" fill={look.tie} />}
      </g>

      {look.mug && (
        /* Tenue par la main gauche, dont la position vient de l'IK. */
        <g data-r="hand">
          <rect x="-3" y="-3" width="5.4" height="5.8" fill="#e8e4d9" />
          <rect x="2.4" y="-1.6" width="1.9" height="2.6" fill="#e8e4d9" />
          <ellipse cy="-3" rx="2.7" ry="1" fill="#4a3a2c" />
        </g>
      )}

      {/* Tête : repère local, centre en (0,0). */}
      <g data-r="head">
        <Hair style={look.style} color={look.hair} layer="back" />
        <circle r={HEAD_R} fill={skin} />
        {discShadow(HEAD_R, skinDark)}
        <Hair style={look.style} color={look.hair} layer="front" />
        <circle className="iso-person__eye" cx="-4" cy="1" r="1.7" fill="#2b2620" />
        <circle className="iso-person__eye" cx="4" cy="1" r="1.7" fill="#2b2620" />
        {look.glasses && (
          /* Deux verres cerclés. La « barre pleine » que j'avais mise ici
             pour gagner en lisibilité se lisait comme un bandeau. */
          <g>
            <circle cx="-4.2" cy="1" r="3.4" fill="rgba(198,222,240,0.30)"
              stroke="#2b2620" strokeWidth="1.1" />
            <circle cx="4.2" cy="1" r="3.4" fill="rgba(198,222,240,0.30)"
              stroke="#2b2620" strokeWidth="1.1" />
            <path d="M -0.8 1 L 0.8 1" stroke="#2b2620" strokeWidth="1.1" />
          </g>
        )}
      </g>
    </g>
  );
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
  wood = '#8a7a5e',
  frame = '#48525f',
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
            fill="rgba(0,0,0,0.3)" />
          <polygon points={box(gx + DESK_W - 0.74, gy + 0.1, 0.6, 0.8, 0.8, z + 1).left}
            fill="rgba(255,255,255,0.07)" />
        </g>
      ))}
      {/* plateau — teinte légèrement décalée d'un poste à l'autre */}
      <IsoBox gx={gx} gy={gy} w={DESK_W} d={DESK_D} h={4} z0={TOP - 4}
        color={shade(wood, 0.93 + (seed % 3) * 0.055)} />

      {/* clavier + souris, côté occupant */}
      <polygon points={quad(gx + 0.5, gy + 0.16, 0.92, 0.26, TOP + 0.5)} fill="#20242c" />
      <polygon points={quad(gx + 0.54, gy + 0.19, 0.84, 0.2, TOP + 1.2)} fill="#2c313b" />
      <ellipse {...(() => { const p = iso(gx + 1.58, gy + 0.28, TOP); return { cx: p.x, cy: p.y }; })()}
        rx="3.4" ry="2.1" fill="#2c313b" />

      {/* Fouillis personnel — chaque poste tire le sien. */}
      {seed % 3 === 0 && (
        <g>
          <IsoBox gx={gx + 0.22} gy={gy + 0.6} w={0.17} d={0.17} h={5} z0={TOP} color="#d8d3c4" />
          <ellipse {...(() => { const p = iso(gx + 0.305, gy + 0.685, TOP + 5); return { cx: p.x, cy: p.y }; })()}
            rx="2.6" ry="1.3" fill="#4a3a2c" />
        </g>
      )}
      {seed % 2 === 0 && (
        <g>
          <polygon points={quad(gx + 1.5, gy + 0.62, 0.42, 0.34, TOP + 0.4)} fill="#cfc8b6" />
          <polygon points={quad(gx + 1.53, gy + 0.6, 0.42, 0.34, TOP + 1.6)} fill="#e2ddce" />
        </g>
      )}
      {seed % 5 === 1 && (
        <g>
          <IsoBox gx={gx + 1.72} gy={gy + 0.14} w={0.2} d={0.2} h={4} z0={TOP} color="#7d5940" />
          <ellipse {...(() => { const p = iso(gx + 1.82, gy + 0.24, TOP + 4); return { cx: p.x, cy: p.y }; })()}
            rx="4" ry="3" fill="#3f8a55" />
          <ellipse {...(() => { const p = iso(gx + 1.82, gy + 0.24, TOP + 7); return { cx: p.x, cy: p.y }; })()}
            rx="2.6" ry="2" fill="#4fa367" />
        </g>
      )}
      {seed % 4 === 1 && (
        /* pense-bête abandonné sur le plateau */
        <polygon points={quad(gx + 0.28, gy + 0.28, 0.19, 0.19, TOP + 0.4)} fill="#e8d24a" />
      )}

      {/* nappe de lumière projetée sur le plateau, côté occupant */}
      <ellipse cx={spill.x} cy={spill.y} rx="30" ry="13" fill="url(#screenPool)" className="iso-screen-pool" />

      {/* pied : socle + colonne */}
      <IsoBox gx={gx + 0.88} gy={gy + 0.7} w={0.34} d={0.22} h={2.5} z0={TOP} color="#39414d" />
      <IsoBox gx={gx + 1.0} gy={gy + 0.75} w={0.1} d={0.11} h={11} z0={TOP + 2} color="#434c59" />

      {/* panneau, dos tourné à la caméra */}
      <polygon points={mon.left} fill="#39414e" />
      <polygon points={mon.right} fill="#272d37" />
      <polygon points={mon.top} fill="#4a5361" />
      {/* grille d'aération + pastille de marque sur le dos */}
      {[0, 1, 2, 3].map((i) => (
        <polygon key={i}
          points={box(gx + 0.74 + i * 0.16, gy + 0.68, 0.1, 0.02, 1.6, STAND + 12 - i * 0).left}
          fill="rgba(0,0,0,0.28)" />
      ))}
      <ellipse {...(() => { const p = iso(gx + 1.05, gy + 0.68, STAND + 6); return { cx: p.x, cy: p.y }; })()}
        rx="2" ry="1.4" fill="rgba(255,255,255,0.13)" />
      {/* liseré clair du châssis, côté lumière */}
      <polygon points={mon.left} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.9" />

      {/* la lumière de la dalle déborde par le haut du châssis */}
      <polygon points={mon.top} fill="url(#screenEdge)" className="iso-screen" />
      <ellipse cx={crown.x} cy={crown.y - 2} rx="21" ry="6.5" fill="url(#screenPool)"
        className="iso-screen" />
    </g>
  );
}

/** Fauteuil de bureau : assise, dossier, vérin, étoile à roulettes. */
export function OfficeChair({ gx, gy, color = '#3d4654' }: { gx: number; gy: number; color?: string }) {
  const base = iso(gx + 0.35, gy + 0.35);
  return (
    <g>
      <ellipse cx={base.x} cy={base.y} rx="13" ry="5.5" fill="rgba(0,0,0,0.32)" />
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
      <ellipse rx="11" ry="4.8" fill="rgba(0,0,0,0.38)" />
      <path d="M -6.4 0 L -5 -13.5 L 5 -13.5 L 6.4 0 Z" fill="#6d4a33" />
      <path d="M -6.6 -13 L 6.6 -13 L 6 -10.4 L -6 -10.4 Z" fill="#835a3f" />
      <ellipse cy="-13" rx="5.6" ry="1.8" fill="#2f2318" />
      <path d="M 0 -13 C -16 -17, -14 -35, -1.5 -30 C -5 -23, -2 -17, 0 -13 Z" fill="#2f6b43" />
      <path d="M 0 -13 C 16 -18, 13 -36, 1.5 -30 C 5 -23, 2 -17, 0 -13 Z" fill="#3f8a55" />
      <path d="M 0 -15 C -6 -31, 1 -45, 4 -33 C 2.5 -25, 1 -19, 0 -15 Z" fill="#4fa367" />
      <path d="M 0 -14 C 8 -24, 12 -28, 9 -20 C 6 -17, 2 -15, 0 -14 Z" fill="#3a7d4d" />
      <path d="M -1 -29 C -1 -24, -0.5 -19, 0 -15" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
    </g>
  );
}

export function Shelf({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.56} d={1.9} h={64} color="#5a4f3c" />
      {[14, 28, 42, 56].map((z) => (
        <g key={z}>
          <polygon points={quad(gx + 0.04, gy + 0.05, 0.48, 1.8, z)} fill="#2a251d" />
          {[0.1, 0.6, 1.05].map((o, i) => (
            <IsoBox key={o} gx={gx + 0.1} gy={gy + 0.12 + o} w={0.34} d={0.42 - i * 0.06} h={11}
              z0={z} color={['#7e6a4a', '#6a5f7a', '#5d7a6a'][(i + z) % 3]!} />
          ))}
        </g>
      ))}
    </g>
  );
}

export function Sofa({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={2.4} d={1} h={11} color={'#3f4859'} />
      <IsoBox gx={gx + 0.16} gy={gy + 0.18} w={1} d={0.72} h={5} z0={11} color="#4c576c" />
      <IsoBox gx={gx + 1.24} gy={gy + 0.18} w={1} d={0.72} h={5} z0={11} color="#4c576c" />
      <IsoBox gx={gx} gy={gy} w={2.4} d={0.2} h={28} color="#47536a" />
      <IsoBox gx={gx} gy={gy + 0.18} w={0.24} d={0.84} h={19} color="#4c576c" />
      <IsoBox gx={gx + 2.16} gy={gy + 0.18} w={0.24} d={0.84} h={19} color="#3f4859" />
      <IsoBox gx={gx + 0.7} gy={gy + 0.16} w={0.42} d={0.12} h={11} z0={16} color="#7a5f62" />
    </g>
  );
}

export function CoffeeMachine({ gx, gy }: { gx: number; gy: number }) {
  const led = iso(gx + 0.5, gy + 0.55, 54);
  return (
    <g>
      <IsoBox gx={gx - 0.1} gy={gy - 0.1} w={1.2} d={1.1} h={30} color="#4a4f5e" />
      <IsoBox gx={gx} gy={gy} w={0.92} d={0.9} h={26} z0={30} color="#343a46" />
      <IsoBox gx={gx + 0.1} gy={gy + 0.62} w={0.7} d={0.24} h={13} z0={32} color="#1d2129" />
      <circle cx={led.x} cy={led.y} r="2.6" fill="#ffb54a" className="iso-blink" />
      {[0, 1].map((i) => (
        <IsoBox key={i} gx={gx + 0.2 + i * 0.34} gy={gy + 0.7} w={0.16} d={0.16} h={5} z0={32}
          color="#e8e4d9" />
      ))}
    </g>
  );
}

export function MeetingTable({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx + 0.3} gy={gy + 0.3} w={2.4} d={0.9} h={22} color="#3a4150" />
      <IsoBox gx={gx} gy={gy} w={3} d={1.5} h={4} z0={22} color="#7a6a52" />
      <polygon points={quad(gx + 1.2, gy + 0.5, 0.5, 0.5, 26)} fill="#2a2f39" />
      <polygon points={quad(gx + 0.3, gy + 0.4, 0.34, 0.4, 26)} fill="#d8d3c4" />
      <polygon points={quad(gx + 2.2, gy + 0.7, 0.34, 0.4, 26)} fill="#d8d3c4" />
    </g>
  );
}

export function Printer({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.8} d={0.9} h={22} color="#3a4150" />
      <IsoBox gx={gx + 0.04} gy={gy + 0.04} w={0.72} d={0.82} h={9} z0={22} color="#2b313c" />
      <polygon points={quad(gx + 0.1, gy + 0.5, 0.6, 0.34, 31.5)} fill="#e8e4d9" />
      <IsoBox gx={gx + 0.1} gy={gy + 0.06} w={0.6} d={0.14} h={2} z0={31} color="#20242c" />
    </g>
  );
}

export function WaterCooler({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.52} d={0.52} h={20} color="#e8e4d9" opacity={0.9} />
      <IsoBox gx={gx + 0.04} gy={gy + 0.04} w={0.44} d={0.44} h={17} z0={20} color="#5fa3c4" opacity={0.75} />
      <IsoBox gx={gx + 0.14} gy={gy + 0.46} w={0.24} d={0.08} h={4} z0={12} color="#3a4150" />
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
            <IsoBox gx={x} gy={gy} w={W} d={0.6} h={H} color="#4f5867" />
            {/* deux vantaux + poignées, sur la face avant */}
            {[
              [4, 26],
              [28, 50],
            ].map(([z1, z2]) => (
              <g key={z1}>
                <polygon
                  points={panelAlongX(x + 0.04, x + W - 0.04, gy + 0.601, z1!, z2!)}
                  fill="rgba(0,0,0,0.22)"
                />
                <polygon
                  points={panelAlongX(x + 0.06, x + W - 0.06, gy + 0.602, z1! + 1, z2! - 1)}
                  fill="rgba(255,255,255,0.05)"
                />
                <polygon
                  points={panelAlongX(x + W - 0.16, x + W - 0.09, gy + 0.603, z2! - 8, z2! - 6)}
                  fill="rgba(230,235,245,0.5)"
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
  const lids = ['#3d6d8a', '#6d8a3d', '#8a6d3d'];
  return (
    <g>
      {lids.map((lid, i) => (
        <g key={lid}>
          <IsoBox gx={gx + i * 0.4} gy={gy} w={0.34} d={0.34} h={17} color="#3f4653" />
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
      <IsoBox gx={gx + 0.06} gy={gy + 0.5} w={0.06} d={0.06} h={30} color="#6b5a42" />
      <IsoBox gx={gx + 0.62} gy={gy + 0.5} w={0.06} d={0.06} h={30} color="#5c4d38" />
      <polygon points={panelAlongX(gx, gx + 0.74, gy + 0.5, 28, 64)} fill="#3a4048" />
      <polygon points={panelAlongX(gx + 0.03, gx + 0.71, gy + 0.505, 30, 62)} fill="#cfcabb" />
      {[56, 50, 44].map((z, i) => (
        <polygon
          key={z}
          points={panelAlongX(gx + 0.09, gx + 0.09 + (i === 1 ? 0.5 : 0.36), gy + 0.51, z - 1.6, z)}
          fill="#8b93a0"
        />
      ))}
    </g>
  );
}

/** Écran de présentation sur pied, tourné vers la table de réunion. */
export function WallScreen({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy + 0.3} w={0.7} d={0.35} h={3} color="#333a45" />
      <IsoBox gx={gx + 0.3} gy={gy + 0.42} w={0.12} d={0.12} h={22} color="#3d4551" />
      <IsoBox gx={gx + 0.04} gy={gy + 0.44} w={0.06} d={1.5} h={30} z0={22} color="#2b313b" />
      <polygon points={box(gx + 0.04, gy + 0.44, 0.06, 1.5, 30, 22).right} fill="#1d222a" />
      <polygon points={box(gx + 0.05, gy + 0.5, 0.06, 1.38, 26, 24).right} fill="#38506b" />
    </g>
  );
}

/** Crédence basse : socle pour une plante, comble un angle mort. */
export function Credenza({ gx, gy, w = 1, d = 0.7 }: { gx: number; gy: number; w?: number; d?: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={w} d={d} h={19} color="#5c5140" />
      <IsoBox gx={gx - 0.03} gy={gy - 0.03} w={w + 0.06} d={d + 0.06} h={2} z0={19} color="#6d6150" />
      {[0.06, w / 2 + 0.02].map((o) => (
        <polygon key={o} points={panelAlongX(gx + o, gx + o + w / 2 - 0.08, gy + d + 0.001, 3, 16)}
          fill="rgba(0,0,0,0.2)" />
      ))}
    </g>
  );
}
