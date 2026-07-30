// ─────────────────────────────────────────────────────────────
// IsoOffice.tsx — Le plateau isométrique.
//
// Tout est vectoriel (SVG) : net à toutes les densités, animable au
// CSS, aucun asset externe. L'ordre de rendu suit la profondeur
// (fond → open space rang A → rang B → premier plan → surcouches).
//
// Rien n'est décidé ici : le plateau AFFICHE l'état et remonte les
// clics. Les règles vivent dans /engine.
// ─────────────────────────────────────────────────────────────
import type { Colleague } from '@state/schema';
import { getOpportunity } from '@data/content';
import { useGame } from './useGame';
import {
  DESK_D,
  DESK_SLOTS,
  DESK_W,
  GRID_D,
  GRID_W,
  VIEW_BOX,
  ZONES,
  box,
  iso,
  opportunityPoint,
  panelAlongX,
  panelAlongY,
  quad,
  seatOf,
  zoneLabelPoint,
  type Selection,
  type ZoneId,
} from './iso';

// ── Palette & ombrage ────────────────────────────────────────
// Lumière venue du fond-gauche (les baies vitrées) : la face +gy est
// éclairée, la face +gx retombe dans l'ombre.
const SHADE = { top: 1.18, left: 0.88, right: 0.62 };

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}

const SHIRT: Record<string, string> = {
  carrieriste: '#b8453c',
  fayot: '#c2862c',
  glandeur: '#3d8a58',
  parano: '#7860b0',
  veteran: '#3d83a0',
  nouveau: '#68718a',
};
const SKINS = ['#e8b48c', '#c98c62', '#8d5a3b', '#f0c9a4', '#a9714a'];
const HAIRS = ['#2b2320', '#4a3428', '#6b5140', '#1c1a19', '#7d5c3f'];

/** Hash stable : deux parties donnent les mêmes visages. */
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// ── Primitives ───────────────────────────────────────────────
function IsoBox({
  gx,
  gy,
  w,
  d,
  h,
  z0 = 0,
  color,
}: {
  gx: number;
  gy: number;
  w: number;
  d: number;
  h: number;
  z0?: number;
  color: string;
}) {
  const f = box(gx, gy, w, d, h, z0);
  return (
    <g>
      <polygon points={f.left} fill={shade(color, SHADE.left)} />
      <polygon points={f.right} fill={shade(color, SHADE.right)} />
      <polygon points={f.top} fill={shade(color, SHADE.top)} />
    </g>
  );
}

function Plant({ gx, gy, scale = 1 }: { gx: number; gy: number; scale?: number }) {
  const p = iso(gx, gy);
  return (
    <g transform={`translate(${p.x},${p.y}) scale(${scale})`}>
      <ellipse rx="10" ry="4.5" fill="rgba(0,0,0,0.42)" />
      <path d="M -6 0 L -4.6 -13 L 4.6 -13 L 6 0 Z" fill="#6b4a35" />
      <path d="M -6 -13 L 6 -13 L 5.4 -10 L -5.4 -10 Z" fill="#7d5940" />
      <path d="M 0 -13 C -15 -17, -13 -34, -1 -29 C -4 -22, -1 -17, 0 -13 Z" fill="#357048" />
      <path d="M 0 -13 C 15 -17, 13 -34, 1 -29 C 4 -22, 1 -17, 0 -13 Z" fill="#448a58" />
      <path d="M 0 -15 C -5 -30, 1 -42, 3.5 -32 C 2 -24, 1 -19, 0 -15 Z" fill="#54a468" />
    </g>
  );
}

function Desk({ gx, gy, accent = '#3d4557' }: { gx: number; gy: number; accent?: string }) {
  const screen = box(gx + 0.52, gy + 0.14, 0.85, 0.1, 19, 26);
  const pool = iso(gx + 0.95, gy + 0.4, 26);
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={DESK_W} d={DESK_D} h={26} color={accent} />
      {/* écran + sa dalle émissive */}
      <IsoBox gx={gx + 0.52} gy={gy + 0.14} w={0.85} d={0.1} h={19} z0={26} color="#1d212a" />
      <polygon points={screen.left} fill="url(#screenGrad)" className="iso-screen" />
      {/* nappe de lumière de l'écran sur le plateau */}
      <ellipse
        cx={pool.x}
        cy={pool.y}
        rx="26"
        ry="12"
        fill="url(#screenPool)"
        className="iso-screen-pool"
      />
      {/* clavier + dossiers */}
      <polygon points={quad(gx + 0.42, gy + 0.62, 0.95, 0.28, 26.4)} fill="#22262f" />
      <polygon points={quad(gx + 1.6, gy + 0.25, 0.4, 0.45, 26.4)} fill="#8e8877" />
      <polygon points={quad(gx + 1.62, gy + 0.28, 0.36, 0.4, 27.2)} fill="#a8a290" />
    </g>
  );
}

function Chair({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.62} d={0.58} h={11} color="#282d39" />
      <IsoBox gx={gx} gy={gy - 0.02} w={0.62} d={0.1} h={24} color="#313746" />
    </g>
  );
}

function Shelf({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.55} d={1.9} h={62} color="#4a4232" />
      {[16, 30, 44].map((z) => (
        <polygon key={z} points={quad(gx + 0.04, gy + 0.05, 0.47, 1.8, z)} fill="#2c2822" />
      ))}
    </g>
  );
}

function Sofa({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={2.4} d={1} h={13} color="#414a5e" />
      <IsoBox gx={gx} gy={gy} w={2.4} d={0.2} h={28} color="#4a556b" />
      <IsoBox gx={gx} gy={gy + 0.2} w={0.22} d={0.8} h={20} color="#4a556b" />
      <IsoBox gx={gx + 2.18} gy={gy + 0.2} w={0.22} d={0.8} h={20} color="#4a556b" />
    </g>
  );
}

function CoffeeMachine({ gx, gy }: { gx: number; gy: number }) {
  const p = iso(gx + 0.45, gy + 0.5, 52);
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={0.9} d={0.9} h={34} color="#3a3f4d" />
      <IsoBox gx={gx + 0.05} gy={gy + 0.05} w={0.8} d={0.8} h={22} z0={34} color="#23272f" />
      <circle cx={p.x} cy={p.y} r="3.2" fill="#ffb54a" className="iso-blink" />
    </g>
  );
}

function MeetingTable({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <IsoBox gx={gx} gy={gy} w={3} d={1.5} h={24} color="#4a4034" />
      {[0, 1, 2].map((i) => (
        <Chair key={`n${i}`} gx={gx + 0.35 + i * 1} gy={gy - 0.75} />
      ))}
      {[0, 1, 2].map((i) => (
        <Chair key={`s${i}`} gx={gx + 0.35 + i * 1} gy={gy + 1.65} />
      ))}
    </g>
  );
}

// ── Personnage ───────────────────────────────────────────────
function Person({ c, x, y }: { c: Colleague; x: number; y: number }) {
  const h = hashOf(c.id);
  const shirt = SHIRT[c.archetype] ?? '#68718a';
  const skin = SKINS[h % SKINS.length]!;
  const hair = HAIRS[(h >> 3) % HAIRS.length]!;

  return (
    <g transform={`translate(${x},${y}) scale(1.08)`} className={c.alive ? '' : 'iso-gone'}>
      <ellipse rx="14" ry="6" fill="rgba(0,0,0,0.45)" />
      {/* buste */}
      <path
        d="M -9.5 -2 C -10.5 -22, -6.5 -28, 0 -28 C 6.5 -28, 10.5 -22, 9.5 -2 Z"
        fill={shirt}
      />
      {/* rim light côté fenêtres */}
      <path
        d="M -9.5 -2 C -10.5 -22, -6.5 -28, 0 -28"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* col */}
      <path d="M -3.4 -27 L 0 -21 L 3.4 -27 Z" fill={shade(shirt, 0.7)} />
      <rect x="-2.8" y="-33" width="5.6" height="7" rx="2" fill={shade(skin, 0.85)} />
      {/* tête */}
      <circle cy="-37.5" r="8.4" fill={skin} />
      <path d="M -8.4 -38.5 A 8.4 8.4 0 0 1 8.4 -38.5 Z" fill={hair} />
      <circle cx="-3.2" cy="-40" r="2.4" fill="rgba(255,255,255,0.16)" />
    </g>
  );
}

// ── Bulle d'intention ────────────────────────────────────────
function IntentBubble({ c, x, y }: { c: Colleague; x: number; y: number }) {
  const intent = c.intent;
  if (!intent || intent.kind === 'idle') return null;
  const threat = intent.tone === 'threat';
  const w = intent.weeksLeft > 1 ? 40 : 30;

  return (
    <g
      transform={`translate(${x},${y})`}
      className={`iso-intent iso-intent--${intent.tone}`}
      filter={threat ? 'url(#glowThreat)' : undefined}
    >
      <rect x={-w / 2} y="-13" width={w} height="25" rx="8" className="iso-intent__box" />
      <path d="M -4 11.5 L 0 18 L 4 11.5 Z" className="iso-intent__tail" />
      <text x={intent.weeksLeft > 1 ? -6 : 0} y="4" textAnchor="middle" fontSize="13">
        {intent.icon}
      </text>
      {intent.weeksLeft > 1 && (
        <text x="11" y="4" textAnchor="middle" className="iso-intent__count">
          {intent.weeksLeft}
        </text>
      )}
    </g>
  );
}

// ── Balise d'opportunité ─────────────────────────────────────
function Beacon({
  x,
  y,
  icon,
  onClick,
  disabled,
}: {
  x: number;
  y: number;
  icon: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <g
      transform={`translate(${x},${y})`}
      className={`iso-beacon ${disabled ? 'is-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <ellipse rx="24" ry="11" fill="url(#oppPool)" className="iso-beacon__pool" />
      <g className="iso-beacon__float">
        <polygon points="0,-46 7,-36 0,-26 -7,-36" fill="url(#oppGrad)" filter="url(#glowGold)" />
        <text y="-32" textAnchor="middle" fontSize="12">
          {icon}
        </text>
      </g>
      <circle r="26" fill="transparent" className="iso-hit" />
    </g>
  );
}

// ── Le plateau ───────────────────────────────────────────────
export function IsoOffice({
  selection,
  onSelect,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const { state } = useGame();
  const canAct =
    state.status === 'playing' && state.actionPointsRemaining > 0 && !state.pendingEvent;

  const seatIndexOf = (id: string | undefined) =>
    id ? state.colleagues.findIndex((c) => c.id === id) : -1;

  const isSelectedColleague = (id: string) =>
    selection?.kind === 'colleague' && selection.id === id;
  const isSelectedZone = (id: ZoneId) => selection?.kind === 'zone' && selection.id === id;

  // Tous les postes de l'open space : les vides sont meublés aussi, sinon
  // le plateau sonne creux. L'occupant, lui, suit l'ordre du roster.
  const posts = DESK_SLOTS.map((slot, i) => ({
    slot,
    i,
    c: state.colleagues[i] as Colleague | undefined,
  }));
  const rowA = posts.filter((p) => p.slot.gy < 6);
  const rowB = posts.filter((p) => p.slot.gy >= 6);

  const renderRow = (row: typeof posts) => (
    <>
      {row.map(({ c, i, slot }) => {
        const seat = seatOf(i);
        const p = iso(seat.gx, seat.gy);
        return (
          <g key={`post-${i}`}>
            <Chair gx={slot.gx + DESK_W / 2 - 0.31} gy={slot.gy - 1.6} />
            {c && isSelectedColleague(c.id) && (
              <ellipse
                cx={p.x}
                cy={p.y}
                rx="24"
                ry="11"
                className="iso-select-ring"
                filter="url(#glowSelect)"
              />
            )}
            {c && <Person c={c} x={p.x} y={p.y} />}
            <Desk gx={slot.gx} gy={slot.gy} />
            {c && (
              /* zone cliquable généreuse (tap target ≥ 44px) */
              <rect
                x={p.x - 24}
                y={p.y - 66}
                width="48"
                height="74"
                fill="transparent"
                className="iso-hit"
                onClick={() => onSelect({ kind: 'colleague', id: c.id })}
              />
            )}
          </g>
        );
      })}
    </>
  );

  return (
    <div className={`iso ${state.suspicion >= 70 ? 'iso--alert' : ''}`}>
      <svg className="iso__svg" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fc4ff" />
            <stop offset="100%" stopColor="#3f6dc4" />
          </linearGradient>
          <radialGradient id="screenPool">
            <stop offset="0%" stopColor="rgba(120,180,255,0.5)" />
            <stop offset="100%" stopColor="rgba(120,180,255,0)" />
          </radialGradient>
          <radialGradient id="oppPool">
            <stop offset="0%" stopColor="rgba(255,190,90,0.55)" />
            <stop offset="100%" stopColor="rgba(255,190,90,0)" />
          </radialGradient>
          <linearGradient id="oppGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="55%" stopColor="#f5a623" />
            <stop offset="100%" stopColor="#c2621a" />
          </linearGradient>
          <linearGradient id="windowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4d6a94" />
            <stop offset="100%" stopColor="#243349" />
          </linearGradient>
          <radialGradient id="ambient">
            <stop offset="0%" stopColor="rgba(120,150,200,0.10)" />
            <stop offset="100%" stopColor="rgba(120,150,200,0)" />
          </radialGradient>

          {/* Glow doré : hot core → corps ambre → halo décalé rouge */}
          <filter id="glowGold" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b1" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b2" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="13" result="b3" />
            <feColorMatrix
              in="b1"
              values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.86  0 0 0 1 0"
              result="c1"
            />
            <feColorMatrix
              in="b2"
              values="0 0 0 0 0.98  0 0 0 0 0.68  0 0 0 0 0.22  0 0 0 0.85 0"
              result="c2"
            />
            <feColorMatrix
              in="b3"
              values="0 0 0 0 0.88  0 0 0 0 0.26  0 0 0 0 0.12  0 0 0 0.5 0"
              result="c3"
            />
            <feMerge>
              <feMergeNode in="c3" />
              <feMergeNode in="c2" />
              <feMergeNode in="c1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Glow menace : hot core → rouge → halo violet */}
          <filter id="glowThreat" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b1" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" result="b2" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="11" result="b3" />
            <feColorMatrix
              in="b1"
              values="0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.9  0 0 0 0.9 0"
              result="c1"
            />
            <feColorMatrix
              in="b2"
              values="0 0 0 0 0.92  0 0 0 0 0.24  0 0 0 0 0.24  0 0 0 0.8 0"
              result="c2"
            />
            <feColorMatrix
              in="b3"
              values="0 0 0 0 0.55  0 0 0 0 0.15  0 0 0 0 0.6  0 0 0 0.5 0"
              result="c3"
            />
            <feMerge>
              <feMergeNode in="c3" />
              <feMergeNode in="c2" />
              <feMergeNode in="c1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glowSelect" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b" />
            <feColorMatrix
              in="b"
              values="0 0 0 0 0.42  0 0 0 0 0.62  0 0 0 0 1  0 0 0 0.9 0"
              result="c"
            />
            <feMerge>
              <feMergeNode in="c" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Sol ── */}
        <polygon points={quad(0, 0, GRID_W, GRID_D)} fill="#1b2029" />
        <g className="iso-grid">
          {Array.from({ length: GRID_W + 1 }, (_, i) => {
            const a = iso(i, 0);
            const b = iso(i, GRID_D);
            return <line key={`gx${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
          {Array.from({ length: GRID_D + 1 }, (_, i) => {
            const a = iso(0, i);
            const b = iso(GRID_W, i);
            return <line key={`gy${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>

        {/* ── Murs du fond ── */}
        <polygon points={panelAlongX(0, GRID_W, 0, 0, 96)} fill="#232936" />
        <polygon points={panelAlongY(0, GRID_D, 0, 0, 96)} fill="#1d222d" />
        {/* baies vitrées du mur fond-droit */}
        {[
          [0.6, 3.9],
          [4.8, 8.6],
          [9.6, 13.4],
        ].map(([a, b]) => (
          <g key={`win${a}`}>
            <polygon points={panelAlongX(a!, b!, 0, 26, 84)} fill="url(#windowGrad)" />
            <polygon
              points={panelAlongX(a!, b!, 0, 26, 84)}
              fill="none"
              stroke="rgba(150,190,255,0.28)"
              strokeWidth="1.5"
            />
          </g>
        ))}
        {/* nappe de lumière des baies sur le sol */}
        <polygon points={quad(0.4, 0, 13.2, 2.6)} fill="url(#ambient)" />

        {/* ── Moquettes des zones ── */}
        {ZONES.map((z) => (
          <polygon key={z.id} points={quad(z.gx, z.gy, z.w, z.d)} fill={z.carpet} />
        ))}

        {/* Surfaces cliquables des zones : AU SOL, donc sous le mobilier.
            Un clic sur un collègue ou une balise touche l'objet, pas la pièce. */}
        {ZONES.map((z) => (
          <g
            key={`hit-${z.id}`}
            className={`iso-zone ${z.action ? 'is-actionable' : ''}`}
            onClick={() => onSelect({ kind: 'zone', id: z.id })}
          >
            <polygon points={quad(z.gx, z.gy, z.w, z.d)} className="iso-zone__hit" />
          </g>
        ))}


        {/* ── Mobilier des salles du fond ── */}
        <g>
          {/* Bureau du manager */}
          <IsoBox gx={1} gy={1.2} w={2.4} d={1.2} h={26} color="#4a4034" />
          <Chair gx={2} gy={0.4} />
          <Plant gx={3.9} gy={2.9} />
          {/* Coin café */}
          <CoffeeMachine gx={5.4} gy={0.8} />
          <IsoBox gx={7.2} gy={1.6} w={1} d={1} h={22} color="#3f4655" />
          <Plant gx={8.7} gy={0.6} scale={0.9} />
          {/* Salle de réunion */}
          <MeetingTable gx={10.4} gy={1.1} />
        </g>

        {/* ── Vitrages des salles (après le mobilier qu'ils recouvrent) ── */}
        <g className="iso-glass">
          <polygon points={panelAlongX(0, 4.5, 3.5, 0, 70)} />
          <polygon points={panelAlongY(0, 3.5, 4.5, 0, 70)} />
          <polygon points={panelAlongX(9.5, 14, 3.5, 0, 70)} />
          <polygon points={panelAlongY(0, 3.5, 9.5, 0, 70)} />
        </g>

        {/* ── Open space ── */}
        {renderRow(rowA)}
        {/* fontaine à eau, dans l'allée centrale */}
        <g>
          <IsoBox gx={6.95} gy={6.95} w={0.5} d={0.5} h={16} color="#3a4150" />
          <IsoBox gx={6.99} gy={6.99} w={0.42} d={0.42} h={16} z0={16} color="#4d7fa8" />
        </g>
        {renderRow(rowB)}

        {/* ── Premier plan ── */}
        <g>
          <Shelf gx={0.4} gy={10} />
          <Shelf gx={1.4} gy={10} />
          <Shelf gx={2.4} gy={10} />
          {/* photocopieuse */}
          <IsoBox gx={3.2} gy={10.1} w={0.7} d={0.8} h={30} color="#3c4250" />
          <IsoBox gx={3.26} gy={10.16} w={0.58} d={0.68} h={5} z0={30} color="#282d38" />
          <Plant gx={3.7} gy={11.5} />

          {/* Ton poste */}
          {isSelectedZone('player') && (
            <polygon
              points={quad(5.6, 9.8, 3, 2.2)}
              className="iso-zone-ring"
              filter="url(#glowSelect)"
            />
          )}
          <Chair gx={6.9} gy={9.9} />
          <Desk gx={6.2} gy={10.6} accent="#3f5a4d" />

          <Sofa gx={10.6} gy={10.4} />
          <Plant gx={13.2} gy={10.2} />
          {isSelectedZone('detente') && (
            <polygon
              points={quad(10, 9.6, 4, 2.4)}
              className="iso-zone-ring"
              filter="url(#glowSelect)"
            />
          )}
        </g>

        {/* ── Zones cliquables + étiquettes ── */}

        {/* Étiquettes : pancartes sur les cloisons pour les salles du fond,
            marquage au sol pour les zones de devant. Voir zoneLabelPoint. */}
        {ZONES.map((z) => {
          const l = zoneLabelPoint(z.id);
          return (
            <text
              key={`lbl-${z.id}`}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              className="iso-zone__label"
            >
              {z.label}
            </text>
          );
        })}

        {/* ── Surcouches : intentions puis opportunités ── */}
        {state.colleagues.map((c, i) => {
          if (!c.alive || !c.intent) return null;
          const seat = seatOf(i);
          const p = iso(seat.gx, seat.gy);
          return <IntentBubble key={`int-${c.id}`} c={c} x={p.x} y={p.y - 62} />;
        })}

        {state.opportunities.map((opp, i) => {
          const def = getOpportunity(opp.defId);
          if (!def) return null;
          const seatIdx = seatIndexOf(opp.targetId);
          const pt = opportunityPoint(opp.place, seatIdx >= 0 ? seatIdx : undefined);
          return (
            <Beacon
              key={`${opp.defId}-${i}`}
              x={pt.x}
              y={pt.y}
              icon={def.icon}
              disabled={!canAct}
              onClick={() => onSelect({ kind: 'opportunity', index: i })}
            />
          );
        })}
      </svg>
    </div>
  );
}
