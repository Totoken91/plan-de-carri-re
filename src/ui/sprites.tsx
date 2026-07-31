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
import type { Colleague } from '@state/schema';
import { DESK_D, DESK_W, box, iso, quad } from './iso';

// ── Ombrage ──────────────────────────────────────────────────
// La face à l'ombre ne descend pas sous 0,74 : en dessous, les volumes
// sombres virent au noir absolu et se lisent comme des trous dans la
// géométrie plutôt que comme des faces éclairées de biais.
export const SHADE = { top: 1.2, left: 0.94, right: 0.74 };

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
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
// Parti pris : on ne cherche PAS le détail. À cette échelle (~50 px),
// un visage modelé tourne à la bouillie. On joue donc sur ce que le SVG
// fait le mieux — des formes nettes en aplat :
//
//   · une tête ronde, volontairement grosse, posée sans cou ;
//   · un buste en dôme, sans bras articulés ;
//   · deux tons par forme, séparés par une arête FRANCHE (jamais de
//     dégradé) — le même vocabulaire que les facettes du mobilier ;
//   · pour tout visage, deux points. Pas de bouche, pas de nez.
//
// Ce qui distingue les archétypes, c'est la SILHOUETTE : capuche, queue
// de cheval, col relevé, crâne dégarni. Un personnage doit se lire à
// 20 px, réduit à sa découpe.

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

// Géométrie : tête volumineuse, buste court. C'est cette proportion qui
// donne le charme — un corps réaliste ferait un pion sans caractère.
const HEAD_R = 11;
const HEAD_Y = -37;
const BODY_TOP = -28;
const BODY_W = 11;
/** Abscisse de l'arête d'ombre : décalée du centre, jamais pile au milieu. */
const EDGE = 3;

/** Moitié droite d'un disque, coupée net à l'abscisse EDGE. */
function discShadow(cy: number, r: number, fill: string) {
  const dy = Math.sqrt(r * r - EDGE * EDGE);
  return <path d={`M ${EDGE} ${cy - dy} A ${r} ${r} 0 0 1 ${EDGE} ${cy + dy} Z`} fill={fill} />;
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  const dark = shade(color, 0.74);
  // Calotte : un arc plein, posé bas sur le front.
  const cap = (
    <path
      d={`M ${-HEAD_R} ${HEAD_Y - 2.5} A ${HEAD_R} ${HEAD_R} 0 0 1 ${HEAD_R} ${HEAD_Y - 2.5} Z`}
      fill={color}
    />
  );

  switch (style) {
    case 'capuche':
      // La capuche se dessine autour de la tête, pas dessus.
      return (
        <g>
          <path
            d={`M ${-HEAD_R - 3} ${HEAD_Y + 6} A ${HEAD_R + 3} ${HEAD_R + 3} 0 0 1 ${HEAD_R + 3} ${HEAD_Y + 6}
                L ${HEAD_R + 1} ${HEAD_Y + 9} L ${-HEAD_R - 1} ${HEAD_Y + 9} Z`}
            fill={color}
          />
          <path d={`M ${EDGE} ${HEAD_Y - 11} A ${HEAD_R + 3} ${HEAD_R + 3} 0 0 1 ${HEAD_R + 1} ${HEAD_Y + 9}
                    L ${EDGE} ${HEAD_Y + 9} Z`} fill={dark} />
        </g>
      );
    case 'degarni':
      return (
        <g fill={color}>
          <path d={`M ${-HEAD_R} ${HEAD_Y - 1} A ${HEAD_R} ${HEAD_R} 0 0 1 ${-HEAD_R + 4} ${HEAD_Y - 8.5} L ${-HEAD_R + 4} ${HEAD_Y - 1} Z`} />
          <path d={`M ${HEAD_R} ${HEAD_Y - 1} A ${HEAD_R} ${HEAD_R} 0 0 0 ${HEAD_R - 4} ${HEAD_Y - 8.5} L ${HEAD_R - 4} ${HEAD_Y - 1} Z`} />
        </g>
      );
    case 'queue':
      return (
        <g>
          {cap}
          <path d={`M ${HEAD_R - 2} ${HEAD_Y - 4} L ${HEAD_R + 5} ${HEAD_Y + 1}
                    L ${HEAD_R + 3} ${HEAD_Y + 9} L ${HEAD_R - 3} ${HEAD_Y + 2} Z`} fill={dark} />
        </g>
      );
    case 'rideau':
      return (
        <g>
          <path d={`M ${-HEAD_R} ${HEAD_Y - 2} L ${-HEAD_R} ${HEAD_Y + 12} L ${-HEAD_R + 4.5} ${HEAD_Y + 12} L ${-HEAD_R + 4.5} ${HEAD_Y - 2} Z`} fill={dark} />
          <path d={`M ${HEAD_R} ${HEAD_Y - 2} L ${HEAD_R} ${HEAD_Y + 12} L ${HEAD_R - 4.5} ${HEAD_Y + 12} L ${HEAD_R - 4.5} ${HEAD_Y - 2} Z`} fill={dark} />
          {cap}
        </g>
      );
    case 'carre':
      return (
        <g>
          <path d={`M ${-HEAD_R - 1} ${HEAD_Y - 2} L ${-HEAD_R - 1} ${HEAD_Y + 7} L ${HEAD_R + 1} ${HEAD_Y + 7} L ${HEAD_R + 1} ${HEAD_Y - 2} Z`} fill={dark} />
          {cap}
        </g>
      );
    default:
      // Plaqué : la calotte, plus une pointe côté raie.
      return (
        <g>
          {cap}
          <path d={`M ${-HEAD_R + 1} ${HEAD_Y - 6} L ${-HEAD_R - 2.5} ${HEAD_Y - 1} L ${-HEAD_R + 2} ${HEAD_Y - 1.5} Z`} fill={color} />
        </g>
      );
  }
}

/**
 * Un collègue à son poste. Aplats francs, aucune ombre douce : tout le
 * relief vient de l'arête entre les deux tons.
 */
export function Person({ c }: { c: Colleague }) {
  const h = hashOf(c.id);
  const look = LOOKS[c.archetype] ?? LOOKS.nouveau!;
  const skin = SKINS[h % SKINS.length]!;
  const skinDark = shade(skin, 0.76);
  const shirtDark = shade(look.shirt, 0.76);
  // Les respirations se désynchronisent : rien de plus mort qu'un open
  // space qui bouge à l'unisson.
  const delay = `${((h % 20) / 10).toFixed(2)}s`;

  return (
    <g className={c.alive ? 'iso-person' : 'iso-person iso-gone'}>
      {/* ombre au sol : un aplat, pas un flou */}
      <ellipse rx="14" ry="5.5" fill="rgba(0,0,0,0.32)" />

      {/* Ordre de tracé : tête, puis cheveux, puis visage, et le buste EN
          DERNIER. Les épaules recouvrent ainsi le bas du crâne et retiennent
          les cheveux longs ; l'inverse faisait déborder le menton en pastille
          de peau sur la chemise. */}
      <g className="iso-person__body" style={{ animationDelay: delay }}>
        <circle cy={HEAD_Y} r={HEAD_R} fill={skin} />
        {discShadow(HEAD_Y, HEAD_R, skinDark)}

        <Hair style={look.style} color={look.hair} />

        {/* le visage tient en deux points */}
        <circle className="iso-person__eye" style={{ animationDelay: delay }}
          cx="-4" cy={HEAD_Y + 1} r="1.7" fill="#2b2620" />
        <circle className="iso-person__eye" style={{ animationDelay: delay }}
          cx="4" cy={HEAD_Y + 1} r="1.7" fill="#2b2620" />

        {look.glasses && (
          /* une barre pleine : à cette taille, deux verres cerclés bavent */
          <path d={`M -8.2 ${HEAD_Y - 0.6} L 8.2 ${HEAD_Y - 0.6} L 8.2 ${HEAD_Y + 2.8} L -8.2 ${HEAD_Y + 2.8} Z`}
            fill="#2b2620" opacity="0.85" />
        )}

        {/* buste en dôme, sans bras */}
        <path
          d={`M ${-BODY_W} -1 L ${-BODY_W} ${BODY_TOP + 9}
              A ${BODY_W} ${BODY_W} 0 0 1 ${BODY_W} ${BODY_TOP + 9}
              L ${BODY_W} -1 Z`}
          fill={look.shirt}
        />
        <path
          d={`M ${EDGE} ${BODY_TOP + 1.6} A ${BODY_W} ${BODY_W} 0 0 1 ${BODY_W} ${BODY_TOP + 9}
              L ${BODY_W} -1 L ${EDGE} -1 Z`}
          fill={shirtDark}
        />
        {/* col : une simple encoche */}
        <path d={`M -4.4 ${BODY_TOP - 1.4} L 0 ${BODY_TOP + 4.5} L 4.4 ${BODY_TOP - 1.4} Z`}
          fill={shade(look.shirt, 1.16)} />
        {look.tie && (
          <path d={`M 0 ${BODY_TOP + 3.5} L 2.6 ${BODY_TOP + 7.5} L 0 ${BODY_TOP + 19}
                    L -2.6 ${BODY_TOP + 7.5} Z`} fill={look.tie} />
        )}
        {look.mug && (
          <g>
            <rect x="-15.6" y="-13" width="5.6" height="6" fill="#e8e4d9" />
            <rect x="-10" y="-11.6" width="2" height="2.6" fill="#e8e4d9" />
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
}: {
  gx: number;
  gy: number;
  wood?: string;
  frame?: string;
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
      {/* plateau */}
      <IsoBox gx={gx} gy={gy} w={DESK_W} d={DESK_D} h={4} z0={TOP - 4} color={wood} />

      {/* clavier + souris, côté occupant */}
      <polygon points={quad(gx + 0.5, gy + 0.16, 0.92, 0.26, TOP + 0.5)} fill="#20242c" />
      <polygon points={quad(gx + 0.54, gy + 0.19, 0.84, 0.2, TOP + 1.2)} fill="#2c313b" />
      <ellipse {...(() => { const p = iso(gx + 1.58, gy + 0.28, TOP); return { cx: p.x, cy: p.y }; })()}
        rx="3.4" ry="2.1" fill="#2c313b" />

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
