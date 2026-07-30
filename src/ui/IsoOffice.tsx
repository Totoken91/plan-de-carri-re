// ─────────────────────────────────────────────────────────────
// IsoOffice.tsx — Le plateau isométrique.
//
// Tout est vectoriel : net à toutes les densités, animable au CSS,
// aucun asset externe. Le dessin vit dans sprites.tsx ; ce fichier
// place les objets et gère l'ordre de rendu (fond → open space rang A
// → rang B → premier plan → surcouches).
//
// Rien n'est décidé ici : le plateau AFFICHE l'état et remonte les
// clics. Les règles vivent dans /engine.
// ─────────────────────────────────────────────────────────────
import type { Colleague } from '@state/schema';
import { getOpportunity } from '@data/content';
import { useGame } from './useGame';
import {
  CoffeeMachine,
  Desk,
  IsoBox,
  MeetingTable,
  OfficeChair,
  Person,
  Plant,
  Printer,
  Shelf,
  Sofa,
  WaterCooler,
} from './sprites';
import {
  DESK_SLOTS,
  DESK_W,
  GRID_D,
  GRID_W,
  VIEW_BOX,
  ZONES,
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

// ── Bulle d'intention ────────────────────────────────────────
function IntentBubble({ c, x, y }: { c: Colleague; x: number; y: number }) {
  const intent = c.intent;
  if (!intent || intent.kind === 'idle') return null;
  const threat = intent.tone === 'threat';
  const w = intent.weeksLeft > 1 ? 40 : 30;

  return (
    <g
      transform={`translate(${x},${y})`}
      className={`iso-intent iso-intent--${intent.tone} iso-intent--${intent.kind}`}
      filter={threat ? 'url(#glowThreat)' : undefined}
    >
      <rect x={-w / 2} y="-13" width={w} height="25" rx="3" className="iso-intent__box" />
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
            <OfficeChair gx={slot.gx + DESK_W / 2 - 0.36} gy={slot.gy - 1.32} />
            {c && isSelectedColleague(c.id) && (
              <ellipse
                cx={p.x}
                cy={p.y}
                rx="25"
                ry="11"
                className="iso-select-ring"
                filter="url(#glowSelect)"
              />
            )}
            {c && (
              <g transform={`translate(${p.x},${p.y})`}>
                <Person c={c} />
              </g>
            )}
            <Desk gx={slot.gx} gy={slot.gy} />
            {c && (
              /* zone cliquable généreuse (tap target ≥ 44px) */
              <rect
                x={p.x - 24}
                y={p.y - 68}
                width="48"
                height="76"
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
          <radialGradient id="screenPool">
            <stop offset="0%" stopColor="rgba(126,186,255,0.42)" />
            <stop offset="100%" stopColor="rgba(126,186,255,0)" />
          </radialGradient>
          <linearGradient id="screenEdge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(190,224,255,0.85)" />
            <stop offset="100%" stopColor="rgba(120,170,240,0.15)" />
          </linearGradient>
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
            <stop offset="0%" stopColor="#54718f" />
            <stop offset="55%" stopColor="#33465e" />
            <stop offset="100%" stopColor="#1f2b3c" />
          </linearGradient>
          <radialGradient id="ambient">
            <stop offset="0%" stopColor="rgba(150,180,225,0.13)" />
            <stop offset="100%" stopColor="rgba(150,180,225,0)" />
          </radialGradient>

          {/* Glow doré : hot core → corps ambre → halo décalé rouge */}
          <filter id="glowGold" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b1" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b2" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="13" result="b3" />
            <feColorMatrix in="b1" values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.86  0 0 0 1 0" result="c1" />
            <feColorMatrix in="b2" values="0 0 0 0 0.98  0 0 0 0 0.68  0 0 0 0 0.22  0 0 0 0.85 0" result="c2" />
            <feColorMatrix in="b3" values="0 0 0 0 0.88  0 0 0 0 0.26  0 0 0 0 0.12  0 0 0 0.5 0" result="c3" />
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
            <feColorMatrix in="b1" values="0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.9  0 0 0 0.9 0" result="c1" />
            <feColorMatrix in="b2" values="0 0 0 0 0.92  0 0 0 0 0.24  0 0 0 0 0.24  0 0 0 0.8 0" result="c2" />
            <feColorMatrix in="b3" values="0 0 0 0 0.55  0 0 0 0 0.15  0 0 0 0 0.6  0 0 0 0.5 0" result="c3" />
            <feMerge>
              <feMergeNode in="c3" />
              <feMergeNode in="c2" />
              <feMergeNode in="c1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glowSelect" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b" />
            <feColorMatrix in="b" values="0 0 0 0 0.42  0 0 0 0 0.72  0 0 0 0 0.7  0 0 0 0.9 0" result="c" />
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
        {/* plinthes */}
        <polygon points={panelAlongX(0, GRID_W, 0, 0, 5)} fill="#2e3543" />
        <polygon points={panelAlongY(0, GRID_D, 0, 0, 5)} fill="#262c38" />
        {/* baies vitrées, avec meneaux */}
        {[
          [0.6, 3.9],
          [4.8, 8.6],
          [9.6, 13.4],
        ].map(([a, b]) => (
          <g key={`win${a}`}>
            <polygon points={panelAlongX(a!, b!, 0, 26, 84)} fill="url(#windowGrad)" />
            <polygon points={panelAlongX(a! + (b! - a!) / 2 - 0.04, a! + (b! - a!) / 2 + 0.04, 0, 26, 84)}
              fill="#2b3342" />
            <polygon points={panelAlongX(a!, b!, 0, 26, 84)} fill="none"
              stroke="rgba(160,196,255,0.3)" strokeWidth="1.6" />
          </g>
        ))}
        {/* nappe de lumière des baies sur le sol */}
        <polygon points={quad(0.4, 0, 13.2, 2.8)} fill="url(#ambient)" />

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
          <OfficeChair gx={1.9} gy={0.35} color="#4a3f56" />
          <Desk gx={1} gy={1.2} wood="#6b5540" />
          <Plant gx={3.95} gy={2.9} />

          <CoffeeMachine gx={5.4} gy={0.7} />
          <IsoBox gx={7.3} gy={1.5} w={1} d={1} h={20} color="#3f4655" />
          <Plant gx={8.8} gy={0.6} scale={0.85} />

          <MeetingTable gx={10.4} gy={1.1} />
          {[0, 1, 2].map((i) => (
            <OfficeChair key={`mn${i}`} gx={10.7 + i * 0.95} gy={0.3} color="#3f4a58" />
          ))}
          {[0, 1, 2].map((i) => (
            <OfficeChair key={`ms${i}`} gx={10.7 + i * 0.95} gy={2.75} color="#3f4a58" />
          ))}
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
        <WaterCooler gx={6.95} gy={6.95} />
        {renderRow(rowB)}

        {/* ── Premier plan ── */}
        <g>
          <Shelf gx={0.4} gy={10} />
          <Shelf gx={1.4} gy={10} />
          <Shelf gx={2.4} gy={10} />
          <Printer gx={3.2} gy={10.1} />
          <Plant gx={3.7} gy={11.5} />

          {isSelectedZone('player') && (
            <polygon points={quad(5.6, 9.8, 3, 2.2)} className="iso-zone-ring" filter="url(#glowSelect)" />
          )}
          <OfficeChair gx={6.85} gy={9.7} color="#3d5449" />
          <Desk gx={6.2} gy={10.6} wood="#6e6250" frame="#39504a" />

          <Sofa gx={10.6} gy={10.4} />
          <Plant gx={13.2} gy={10.2} />
          {isSelectedZone('detente') && (
            <polygon points={quad(10, 9.6, 4, 2.4)} className="iso-zone-ring" filter="url(#glowSelect)" />
          )}
        </g>

        {/* Étiquettes : pancartes sur les cloisons pour les salles du fond,
            marquage au sol pour les zones de devant. Voir zoneLabelPoint. */}
        {ZONES.map((z) => {
          const l = zoneLabelPoint(z.id);
          return (
            <text key={`lbl-${z.id}`} x={l.x} y={l.y} textAnchor="middle" className="iso-zone__label">
              {z.label}
            </text>
          );
        })}

        {/* ── Surcouches ── */}
        {/* Les guerres internes : un trait animé du comploteur vers sa cible.
            C'est ce qui rend visible le fait que l'open space vit sans toi. */}
        {state.colleagues.map((c, i) => {
          if (!c.alive || c.intent?.kind !== 'scheme') return null;
          const vIdx = state.colleagues.findIndex((x) => x.id === c.intent!.victimId);
          const victim = state.colleagues[vIdx];
          if (vIdx < 0 || !victim?.alive) return null;

          const s = seatOf(i);
          const v = seatOf(vIdx);
          const a = iso(s.gx, s.gy);
          const b = iso(v.gx, v.gy);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 58;

          return (
            <g key={`scheme-${c.id}`} className={`iso-scheme ${c.intent.boost ? 'is-boosted' : ''}`}>
              <path d={`M ${a.x} ${a.y - 24} Q ${mx} ${my} ${b.x} ${b.y - 24}`} className="iso-scheme__link" />
              <circle cx={b.x} cy={b.y - 24} r="4.5" className="iso-scheme__mark" />
            </g>
          );
        })}

        {state.colleagues.map((c, i) => {
          if (!c.alive || !c.intent) return null;
          const seat = seatOf(i);
          const p = iso(seat.gx, seat.gy);
          return <IntentBubble key={`int-${c.id}`} c={c} x={p.x} y={p.y - 66} />;
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
