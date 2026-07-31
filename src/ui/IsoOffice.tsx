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
  Bins,
  CoffeeMachine,
  Credenza,
  Desk,
  FlipChart,
  IsoBox,
  Lockers,
  MeetingTable,
  OfficeChair,
  Person,
  Plant,
  Printer,
  Shelf,
  Sofa,
  WallScreen,
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
      <text x={intent.weeksLeft > 1 ? -6 : 0} y="4" textAnchor="middle" fontSize="13"
        className="iso-glyph">
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

/**
 * Cloison vitrée : traverses haute et basse, montants réguliers, et un
 * voile de verre à peine teinté. Peinte en dalle pleine translucide,
 * elle se lisait comme un grand plan flottant en travers de la pièce.
 */
function GlassRun({
  along,
  from,
  to,
  at,
  h = 70,
}: {
  along: 'x' | 'y';
  from: number;
  to: number;
  at: number;
  h?: number;
}) {
  const seg = (a: number, b: number, z1: number, z2: number) =>
    along === 'x' ? panelAlongX(a, b, at, z1, z2) : panelAlongY(a, b, at, z1, z2);

  const posts: number[] = [];
  for (let p = from; p <= to + 0.001; p += 1.5) posts.push(Number(p.toFixed(2)));
  if (posts[posts.length - 1] !== to) posts.push(to);

  return (
    <g className="iso-glass">
      <polygon className="iso-glass__pane" points={seg(from, to, 3, h - 2)} />
      <polygon className="iso-glass__rail" points={seg(from, to, h - 2.5, h)} />
      <polygon className="iso-glass__rail" points={seg(from, to, 0, 3)} />
      {posts.map((p) => (
        <polygon key={p} className="iso-glass__post" points={seg(p - 0.045, p + 0.045, 0, h)} />
      ))}
    </g>
  );
}

// ── Balise d'opportunité ─────────────────────────────────────
function Beacon({
  x,
  y,
  onClick,
  disabled,
}: {
  x: number;
  y: number;
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
      {/* Losange nu : l'emoji du contenu, plaqué dessus, restait un
          autocollant sur un décor en aplats. Il vit dans l'agenda et
          l'inspecteur, à taille d'interface, où il est lisible. */}
      <g className="iso-beacon__float">
        <polygon points="0,-50 9,-37 0,-24 -9,-37" fill="url(#oppGrad)" filter="url(#glowGold)" />
        <polygon points="0,-44 4,-37 0,-30 -4,-37" fill="rgba(60,32,8,0.55)" />
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
            {/* Une personne partie ne reste pas grisée à son poste : le
                bureau vide dit la même chose, en mieux. */}
            {c?.alive && (
              <g transform={`translate(${p.x},${p.y})`}>
                {c.flags.includes('bouc_emissaire') && (
                  <ellipse cx="0" cy="0" rx="21" ry="9.5" className="iso-scapegoat-ring" />
                )}
                <Person c={c} />
              </g>
            )}
            <Desk gx={slot.gx} gy={slot.gy} seed={i + 1} />
            {c?.alive && (
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
          {/* Nappe d'un luminaire de plafond. Les néons eux-mêmes ne sont
              pas dessinés : sans plafond, ils flotteraient. On ne garde
              que leur trace au sol, qui suffit à rythmer la pièce. */}
          <radialGradient id="ceilPool">
            <stop offset="0%" stopColor="rgba(228,232,240,0.115)" />
            <stop offset="55%" stopColor="rgba(228,232,240,0.045)" />
            <stop offset="100%" stopColor="rgba(228,232,240,0)" />
          </radialGradient>
          <linearGradient id="cityGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,190,120,0)" />
            <stop offset="100%" stopColor="rgba(255,178,96,0.38)" />
          </linearGradient>
          {/* Un tableau blanc dans une pièce éteinte n'est pas blanc :
              il rend un gris bleuté. Peint clair, il crevait l'image. */}
          <linearGradient id="boardFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d757f" />
            <stop offset="100%" stopColor="#525a64" />
          </linearGradient>

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

          {/* Fusion metaball des primitives d'un personnage.
              C'est un smooth-min : on floute l'alpha, puis on la seuille
              durement. Le rayon du flou EST le k du smin — plus il est
              large, plus les membres se soudent mollement au tronc.
              Le seuil (18 / −8) règle la netteté du contour obtenu. */}
          <filter id="goo" x="-22%" y="-18%" width="144%" height="136%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11"
            />
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
        {/* lueur de la ville en bas des baies */}
        {[
          [0.6, 3.9],
          [4.8, 8.6],
          [9.6, 13.4],
        ].map(([a, b]) => (
          <polygon key={`glow${a}`} points={panelAlongX(a!, b!, 0, 26, 52)} fill="url(#cityGlow)" />
        ))}
        {/* nappe de lumière des baies sur le sol */}
        <polygon points={quad(0.4, 0, 13.2, 2.8)} fill="url(#ambient)" />

        {/* tableau blanc sur le mur du fond-gauche, qui sonnait creux */}
        <g>
          <polygon points={panelAlongY(4.6, 8.4, 0.05, 40, 82)} fill="#2f3742" />
          <polygon points={panelAlongY(4.75, 8.25, 0.06, 43, 79)} fill="url(#boardFace)" />
          {[
            [5.1, 6.4, 70],
            [5.1, 7.5, 63],
            [5.1, 6.0, 56],
            [6.9, 8.0, 49],
          ].map(([a, b, z]) => (
            <polygon key={`wb${z}`} points={panelAlongY(a!, b!, 0.07, z! - 1.4, z!)} fill="#8d959f" />
          ))}
        </g>

        {/* ── Moquettes des zones ── */}
        {ZONES.map((z) => (
          <polygon key={z.id} points={quad(z.gx, z.gy, z.w, z.d)} fill={z.carpet} />
        ))}

        {/* Traces des luminaires : c'est ce qui donne du rythme à un sol
            qui, uniformément sombre, se lit comme un trou. */}
        <g className="iso-lights">
          {[
            [2.4, 2.0], [7.0, 2.0], [11.6, 2.0],
            [2.4, 6.0], [7.0, 6.0], [11.6, 6.0],
            [2.4, 10.0], [7.0, 10.0], [11.6, 10.0],
          ].map(([gx, gy]) => {
            const p = iso(gx!, gy!);
            return <ellipse key={`L${gx}-${gy}`} cx={p.x} cy={p.y} rx="112" ry="56" fill="url(#ceilPool)" />;
          })}
        </g>

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

          {/* Salle de réunion : écran de présentation contre la cloison,
              paperboard dans l'angle, et de quoi tenir deux heures. */}
          <WallScreen gx={9.72} gy={1.1} />
          <MeetingTable gx={10.4} gy={1.1} />
          {[0, 1, 2].map((i) => (
            <OfficeChair key={`mn${i}`} gx={10.7 + i * 0.95} gy={0.3} color="#3f4a58" />
          ))}
          {[0, 1, 2].map((i) => (
            <OfficeChair key={`ms${i}`} gx={10.7 + i * 0.95} gy={2.75} color="#3f4a58" />
          ))}
          {[0.75, 1.9, 2.6].map((o, i) => (
            <IsoBox key={o} gx={10.4 + o} gy={1.35 + (i % 2) * 0.55} w={0.16} d={0.16} h={5}
              z0={26} color="#e2ddce" />
          ))}
          <FlipChart gx={13.0} gy={0.25} />
          <Plant gx={13.6} gy={2.9} scale={0.8} />
        </g>

        {/* ── Cloisons vitrées (après le mobilier qu'elles recouvrent) ── */}
        <GlassRun along="x" from={0} to={4.5} at={3.5} />
        <GlassRun along="y" from={0} to={3.5} at={4.5} />
        <GlassRun along="x" from={9.5} to={14} at={3.5} />
        <GlassRun along="y" from={0} to={3.5} at={9.5} />

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
          {/* Couloir de circulation entre archives et poste du joueur : sans
              rien, tout ce bas de plateau restait une dalle vide. */}
          <Lockers gx={4.35} gy={9.75} count={2} />
          <Bins gx={4.35} gy={11.15} />
          <Plant gx={3.66} gy={11.6} />

          {isSelectedZone('player') && (
            <polygon points={quad(5.6, 9.8, 3, 2.2)} className="iso-zone-ring" filter="url(#glowSelect)" />
          )}
          <OfficeChair gx={6.85} gy={9.7} color="#3d5449" />
          <Desk gx={6.2} gy={10.6} wood="#6e6250" frame="#39504a" />

          {/* angle mort entre ton poste et le coin détente */}
          <Credenza gx={8.85} gy={10.15} w={1} d={0.7} />
          <Plant gx={9.35} gy={10.5} scale={0.72} />

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
          // Le trait passe AU-DESSUS des têtes (crâne ≈ −48) et sous les
          // bulles (−66). Plus bas, il traversait les bustes et son
          // marqueur se lisait comme une tache sur la chemise de la cible.
          const LIFT = 52;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - LIFT - 34;

          return (
            <g key={`scheme-${c.id}`} className={`iso-scheme ${c.intent.boost ? 'is-boosted' : ''}`}>
              <path
                d={`M ${a.x} ${a.y - LIFT} Q ${mx} ${my} ${b.x} ${b.y - LIFT}`}
                className="iso-scheme__link"
              />
              {/* cible : un réticule, pas un disque plein */}
              <g className="iso-scheme__mark" transform={`translate(${b.x},${b.y - LIFT})`}>
                <circle r="5" fill="none" strokeWidth="1.6" />
                <circle r="1.6" strokeWidth="0" />
              </g>
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
              disabled={!canAct}
              onClick={() => onSelect({ kind: 'opportunity', index: i })}
            />
          );
        })}
      </svg>
    </div>
  );
}
