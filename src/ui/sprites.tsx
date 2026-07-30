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

// ── Identité visuelle des archétypes ─────────────────────────
type HairStyle = 'court' | 'chignon' | 'degarni' | 'long' | 'boucle' | 'queue';
type Extra = 'cravate' | 'badge' | 'casque' | 'echarpe' | 'mug';

interface Look {
  shirt: string;
  hair: string;
  style: HairStyle;
  glasses?: boolean;
  extra?: Extra;
}

/** Chaque archétype doit être reconnaissable à sa silhouette seule. */
const LOOKS: Record<string, Look> = {
  // Chemise impeccable, cravate rouge : celui qui s'habille pour le poste d'après.
  carrieriste: { shirt: '#d9dce3', hair: '#2a221e', style: 'court', extra: 'cravate' },
  // Pull moutarde, lunettes, et toujours un café à porter à quelqu'un.
  fayot: { shirt: '#c2862c', hair: '#4a3428', style: 'queue', glasses: true, extra: 'mug' },
  // Hoodie et casque : injoignable, donc au courant de tout.
  glandeur: { shirt: '#3d8a58', hair: '#1c1a19', style: 'boucle', extra: 'casque' },
  // Gilet sombre, écharpe gardée à l'intérieur, lunettes.
  parano: { shirt: '#6b57a0', hair: '#5f4736', style: 'long', glasses: true, extra: 'echarpe' },
  // Quinze ans de maison, et les cheveux qui vont avec.
  veteran: { shirt: '#3d83a0', hair: '#9aa0a6', style: 'degarni' },
  // Badge visiteur jamais retiré.
  nouveau: { shirt: '#6b7488', hair: '#7d5c3f', style: 'chignon', extra: 'badge' },
};

const SKINS = ['#e9b78f', '#c98c62', '#8d5a3b', '#f0cba6', '#a9714a', '#6d4530'];

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// ── Coiffures ────────────────────────────────────────────────
const HEAD_Y = -46.5;
const HEAD_R = 9;

function Hair({ style, color }: { style: HairStyle; color: string }) {
  const dark = shade(color, 0.72);
  const cap = (
    <path d={`M ${-HEAD_R} ${HEAD_Y - 1} A ${HEAD_R} ${HEAD_R} 0 0 1 ${HEAD_R} ${HEAD_Y - 1} Z`} fill={color} />
  );

  switch (style) {
    case 'degarni':
      return (
        <g>
          <path d={`M ${-HEAD_R} ${HEAD_Y + 1} A ${HEAD_R} ${HEAD_R} 0 0 1 ${-HEAD_R + 3.4} ${HEAD_Y - 7}`}
            fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d={`M ${HEAD_R} ${HEAD_Y + 1} A ${HEAD_R} ${HEAD_R} 0 0 0 ${HEAD_R - 3.4} ${HEAD_Y - 7}`}
            fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'chignon':
      return (
        <g>
          {cap}
          <circle cy={HEAD_Y - 9.5} r="4.2" fill={color} />
          <circle cx="-1.2" cy={HEAD_Y - 10.6} r="1.6" fill={shade(color, 1.35)} />
        </g>
      );
    case 'long':
      return (
        <g>
          <path d={`M ${-HEAD_R - 0.8} ${HEAD_Y - 0.5} L ${-HEAD_R - 0.8} ${HEAD_Y + 16}
                    Q ${-HEAD_R + 1.5} ${HEAD_Y + 18} ${-HEAD_R + 3.4} ${HEAD_Y + 14}
                    L ${-HEAD_R + 3.4} ${HEAD_Y} Z`} fill={dark} />
          <path d={`M ${HEAD_R + 0.8} ${HEAD_Y - 0.5} L ${HEAD_R + 0.8} ${HEAD_Y + 16}
                    Q ${HEAD_R - 1.5} ${HEAD_Y + 18} ${HEAD_R - 3.4} ${HEAD_Y + 14}
                    L ${HEAD_R - 3.4} ${HEAD_Y} Z`} fill={dark} />
          {cap}
        </g>
      );
    case 'boucle':
      return (
        <g fill={color}>
          {cap}
          {[-7, -3.5, 0, 3.5, 7].map((x, i) => (
            <circle key={x} cx={x} cy={HEAD_Y - 6.5 - (i % 2 ? 1.6 : 0)} r="3.4" />
          ))}
        </g>
      );
    case 'queue':
      return (
        <g>
          {cap}
          <path d={`M ${HEAD_R - 1} ${HEAD_Y - 3} Q ${HEAD_R + 6} ${HEAD_Y + 2} ${HEAD_R + 3.5} ${HEAD_Y + 10}
                    Q ${HEAD_R + 1} ${HEAD_Y + 5} ${HEAD_R - 2.5} ${HEAD_Y + 2} Z`} fill={dark} />
        </g>
      );
    default:
      return (
        <g>
          {cap}
          <rect x={-HEAD_R - 0.4} y={HEAD_Y - 2} width="2.2" height="6" rx="1" fill={color} />
          <rect x={HEAD_R - 1.8} y={HEAD_Y - 2} width="2.2" height="6" rx="1" fill={color} />
        </g>
      );
  }
}

// ── Accessoires ──────────────────────────────────────────────
function Extra({ kind }: { kind: Extra }) {
  switch (kind) {
    case 'cravate':
      return (
        <g>
          <path d="M 0 -32 L 2.6 -29.5 L 0 -27 L -2.6 -29.5 Z" fill="#b8453c" />
          <path d="M 0 -27 L 2.2 -25 L 1.4 -13 L -1.4 -13 L -2.2 -25 Z" fill="#a13d35" />
        </g>
      );
    case 'badge':
      return (
        <g>
          <path d="M -5 -32 L -1.6 -22" stroke="#c9cdd6" strokeWidth="1" fill="none" />
          <path d="M 5 -32 L 1.6 -22" stroke="#c9cdd6" strokeWidth="1" fill="none" />
          <rect x="-3.2" y="-22" width="6.4" height="4.6" rx="0.8" fill="#e8e4d9" />
          <rect x="-2.3" y="-20.9" width="4.6" height="0.9" fill="#8b93a3" />
        </g>
      );
    case 'casque':
      return (
        <g>
          <path d={`M ${-HEAD_R - 1.6} ${HEAD_Y - 1} A ${HEAD_R + 1.6} ${HEAD_R + 1.6} 0 0 1 ${HEAD_R + 1.6} ${HEAD_Y - 1}`}
            fill="none" stroke="#2a2e36" strokeWidth="2.4" />
          <rect x={-HEAD_R - 3.4} y={HEAD_Y - 3.4} width="3.6" height="7" rx="1.7" fill="#343a44" />
          <rect x={HEAD_R - 0.2} y={HEAD_Y - 3.4} width="3.6" height="7" rx="1.7" fill="#343a44" />
        </g>
      );
    case 'echarpe':
      return (
        <g>
          <path d="M -7.5 -31 Q 0 -26.5 7.5 -31 L 7.5 -27 Q 0 -22.5 -7.5 -27 Z" fill="#8d4f52" />
          <path d="M 4.5 -27.5 L 7.2 -17 L 3.6 -17.6 Z" fill="#7a4245" />
        </g>
      );
    case 'mug':
      return (
        <g>
          <rect x="-14.5" y="-16" width="5.4" height="5.6" rx="1" fill="#e8e4d9" />
          <path d="M -9.1 -14.6 q 2.2 1.2 0 2.6" fill="none" stroke="#e8e4d9" strokeWidth="1" />
          <ellipse cx="-11.8" cy="-16" rx="2.7" ry="1" fill="#4a3a2c" />
        </g>
      );
    default:
      return null;
  }
}

/**
 * Un collègue à son poste, vu de trois quarts face.
 * Le visage porte la lecture : on doit distinguer qui est qui d'un
 * coup d'œil sur le plateau, sans lire d'étiquette.
 */
export function Person({ c }: { c: Colleague }) {
  const h = hashOf(c.id);
  const look = LOOKS[c.archetype] ?? LOOKS.nouveau!;
  const skin = SKINS[h % SKINS.length]!;
  const shirt = look.shirt;
  const shirtDark = shade(shirt, 0.7);
  const skinDark = shade(skin, 0.82);
  // Les respirations se désynchronisent : rien de plus mort qu'un
  // open space qui bouge à l'unisson.
  const delay = `${((h % 20) / 10).toFixed(2)}s`;

  return (
    <g className={c.alive ? 'iso-person' : 'iso-person iso-gone'}>
      {/* ombre portée : un noyau dense + une diffusion large */}
      <ellipse rx="16" ry="6.5" fill="rgba(0,0,0,0.30)" />
      <ellipse rx="9.5" ry="4" fill="rgba(0,0,0,0.34)" />

      <g className="iso-person__body" style={{ animationDelay: delay }}>
        {/* bassin */}
        <path d="M -8.5 -4 L 8.5 -4 L 7.5 -12 L -7.5 -12 Z" fill={shade(shirt, 0.5)} />

        {/* buste : épaules marquées, taille resserrée */}
        <path d="M -9.4 -6 C -10 -20, -8.6 -28.5, -5.4 -31.4 Q 0 -33.4 5.4 -31.4
                 C 8.6 -28.5, 10 -20, 9.4 -6 Z" fill={shirt} />
        {/* moitié à l'ombre */}
        <path d="M 0 -32.6 Q 3.4 -32.6 5.4 -31.4 C 8.6 -28.5, 10 -20, 9.4 -6 L 0 -6 Z"
          fill={shirtDark} opacity="0.5" />
        {/* liseré de lumière côté baies */}
        <path d="M -9.4 -8 C -10 -20, -8.6 -28.5, -5.4 -31.4" fill="none"
          stroke="rgba(255,255,255,0.20)" strokeWidth="1.1" strokeLinecap="round" />

        {/* bras : épaule → coude serré → avant-bras vers le clavier */}
        <path d="M -8.6 -29 C -11.6 -24, -11.8 -18, -7.6 -14.5" fill="none" stroke={shirt}
          strokeWidth="4.2" strokeLinecap="round" />
        <path d="M 8.6 -29 C 11.6 -24, 11.8 -18, 7.6 -14.5" fill="none" stroke={shirtDark}
          strokeWidth="4.2" strokeLinecap="round" />
        <ellipse cx="-6.8" cy="-13.6" rx="2.5" ry="2" fill={skin} transform="rotate(-18 -6.8 -13.6)" />
        <ellipse cx="6.8" cy="-13.6" rx="2.5" ry="2" fill={skinDark} transform="rotate(18 6.8 -13.6)" />

        {/* col */}
        <path d="M -4.6 -32.6 L 0 -26.5 L 4.6 -32.6 L 2.4 -33.4 L 0 -29.6 L -2.4 -33.4 Z"
          fill={shade(shirt, 1.22)} />
        {look.extra && <Extra kind={look.extra} />}

        {/* cou */}
        <path d="M -3 -33 L 3 -33 L 3.4 -38 L -3.4 -38 Z" fill={skinDark} />

        {/* tête */}
        <path d={`M 0 ${HEAD_Y - HEAD_R} A ${HEAD_R} ${HEAD_R} 0 0 1 ${HEAD_R * 0.86} ${HEAD_Y + 4.4}
                  Q 0 ${HEAD_Y + 10.4} ${-HEAD_R * 0.86} ${HEAD_Y + 4.4}
                  A ${HEAD_R} ${HEAD_R} 0 0 1 0 ${HEAD_Y - HEAD_R} Z`} fill={skin} />
        {/* joue à l'ombre */}
        <path d={`M 0 ${HEAD_Y - HEAD_R} A ${HEAD_R} ${HEAD_R} 0 0 1 ${HEAD_R * 0.86} ${HEAD_Y + 4.4}
                  Q ${HEAD_R * 0.4} ${HEAD_Y + 7.6} 0 ${HEAD_Y + 8} Z`} fill={skinDark} opacity="0.5" />
        {/* oreilles */}
        <ellipse cx={-HEAD_R + 0.4} cy={HEAD_Y + 1} rx="1.7" ry="2.4" fill={skinDark} />
        <ellipse cx={HEAD_R - 0.4} cy={HEAD_Y + 1} rx="1.7" ry="2.4" fill={shade(skin, 0.7)} />

        <Hair style={look.style} color={look.hair} />

        {/* sourcils, yeux, bouche */}
        <path d="M -5.4 -49.4 L -1.8 -50" stroke={shade(look.hair, 0.85)} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 5.4 -49.4 L 1.8 -50" stroke={shade(look.hair, 0.85)} strokeWidth="1.2" strokeLinecap="round" />
        <ellipse className="iso-person__eye" style={{ animationDelay: delay }}
          cx="-3.5" cy={HEAD_Y - 0.4} rx="1.15" ry="1.5" fill="#2b2b30" />
        <ellipse className="iso-person__eye" style={{ animationDelay: delay }}
          cx="3.5" cy={HEAD_Y - 0.4} rx="1.15" ry="1.5" fill="#2b2b30" />
        <path d={`M -2 ${HEAD_Y + 5} Q 0 ${HEAD_Y + 6.4} 2 ${HEAD_Y + 5}`} fill="none"
          stroke={shade(skin, 0.6)} strokeWidth="1" strokeLinecap="round" />

        {look.glasses && (
          <g stroke="#20242c" strokeWidth="1.1" fill="rgba(180,210,235,0.20)">
            <rect x="-6.6" y={HEAD_Y - 3} width="5.9" height="5.2" rx="1.6" />
            <rect x="0.7" y={HEAD_Y - 3} width="5.9" height="5.2" rx="1.6" />
            <path d="M -0.7 -47.4 L 0.7 -47.4" />
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
