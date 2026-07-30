import type { OppResolution } from '@engine/opportunities';
import { getOpportunity } from '@data/content';
import { useGame } from './useGame';
import { ZONES, SEATS, opportunityPoint, type Zone } from './office';

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function opinionColor(op: number): string {
  if (op >= 40) return 'var(--good)';
  if (op <= -40) return 'var(--bad)';
  if (op < 0) return 'var(--warn)';
  return 'var(--muted)';
}

export function OfficeMap({
  selectedId,
  onSelect,
  onAction,
  onOpportunity,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAction: (action: 'bosser' | 'glander') => void;
  onOpportunity: (res: OppResolution) => void;
}) {
  const { state, store } = useGame();
  const canAct = state.status === 'playing' && state.actionPointsRemaining > 0 && !state.pendingEvent;

  // index de siège = position dans le roster
  const seatIndexOf = (id: string) => state.colleagues.findIndex((c) => c.id === id);

  const handleZone = (z: Zone) => {
    if (z.action && canAct) onAction(z.action);
  };

  return (
    <div className={`office ${state.suspicion >= 70 ? 'office--alert' : ''}`}>
      <div className="office__floor">
        {/* Zones / pièces */}
        {ZONES.map((z) => (
          <div
            key={z.id}
            className={`zone zone--${z.id} ${z.action && canAct ? 'zone--clickable' : ''}`}
            style={{ left: `${z.rect.x}%`, top: `${z.rect.y}%`, width: `${z.rect.w}%`, height: `${z.rect.h}%` }}
            onClick={() => handleZone(z)}
            title={z.hint ?? z.label}
          >
            <span className="zone__icon">{z.icon}</span>
            <span className="zone__label">{z.label}</span>
            {z.hint && z.action && <span className="zone__hint">{z.hint}</span>}
          </div>
        ))}

        {/* Bureaux des collègues */}
        {state.colleagues.map((c, i) => {
          const seat = SEATS[i] ?? SEATS[SEATS.length - 1]!;
          return (
            <button
              key={c.id}
              className={`seat ${selectedId === c.id ? 'is-selected' : ''} ${!c.alive ? 'is-gone' : ''}`}
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
              onClick={() => onSelect(c.id)}
              title={c.name}
            >
              <span className="seat__token" style={{ borderColor: opinionColor(c.opinion) }}>
                {initials(c.name)}
              </span>
              <span className="seat__name">{c.name.split(' ')[0]}</span>
              {c.flags.includes('sous_emprise') && <span className="seat__badge" title="Sous emprise">⛓️</span>}
            </button>
          );
        })}

        {/* Marqueurs d'opportunités */}
        {state.opportunities.map((opp, i) => {
          const def = getOpportunity(opp.defId);
          if (!def) return null;
          const seatIdx = opp.targetId ? seatIndexOf(opp.targetId) : -1;
          const pt = opportunityPoint(opp.place, seatIdx >= 0 ? seatIdx : undefined);
          const target = state.colleagues.find((c) => c.id === opp.targetId);
          return (
            <button
              key={`${opp.defId}-${i}`}
              className="opp"
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
              disabled={!canAct}
              onClick={() => onOpportunity(store.performOpportunity(i))}
              title={`${def.title}${target ? ` — ${target.name}` : ''}\n${def.description.replace('{target}', target?.name ?? '')}`}
            >
              <span className="opp__pulse" />
              <span className="opp__icon">{def.icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
