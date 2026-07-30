import { useMemo, useState } from 'react';
import type { GameEvent } from '@state/schema';
import type { WeekSummary } from '@engine/week';
import { describeEffect } from '@engine/preview';
import { useGame } from './useGame';
import { availableChoiceFlags, fillTemplate } from './selectors';

export function EventModal({ event, onDone }: { event: GameEvent; onDone: () => void }) {
  const { state, store } = useGame();
  const [resolved, setResolved] = useState<{ text: string; summary: WeekSummary } | null>(null);

  const flags = useMemo(() => availableChoiceFlags(event, state), [event, state]);
  const body = fillTemplate(event.body, state);
  const targetName =
    state.colleagues.find((c) => c.id === state.pendingTargetId)?.name ?? 'la cible';

  const choose = (index: number) => {
    const res = store.chooseEventOption(index);
    setResolved({ text: fillTemplate(res.outcomeText, state), summary: res.summary });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal event">
        <div className="event__tag">Vendredi · Événement de la semaine</div>
        <h2 className="event__title">{event.title}</h2>

        {!resolved ? (
          <>
            <p className="event__body">{body}</p>
            <div className="event__choices">
              {event.choices.map((c, i) => {
                const gains = describeEffect(c.effects, targetName);
                const losses = c.failureEffects
                  ? describeEffect(c.failureEffects, targetName)
                  : [];
                return (
                  <button
                    key={i}
                    className="choice"
                    disabled={!flags[i]}
                    onClick={() => choose(i)}
                    title={!flags[i] ? 'Prérequis non rempli' : ''}
                  >
                    <span className="choice__head">
                      <span className="choice__label">
                        {c.label}
                        {!flags[i] && <span className="lock"> 🔒</span>}
                      </span>
                      {c.successChance !== undefined && (
                        <span className="choice__chance">{c.successChance}%</span>
                      )}
                    </span>
                    <span className="act__lines">
                      {gains.map((l, k) => (
                        <span key={`g${k}`} className={`act__line act__line--${l.tone}`}>
                          {l.label}
                        </span>
                      ))}
                    </span>
                    {losses.length > 0 && (
                      <span className="choice__fail">
                        <span className="choice__faillabel">Si ça rate :</span>
                        <span className="act__lines">
                          {losses.map((l, k) => (
                            <span key={`f${k}`} className={`act__line act__line--${l.tone}`}>
                              {l.label}
                            </span>
                          ))}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="event__outcome">{resolved.text}</p>
            <SummaryLines summary={resolved.summary} />
            <button className="btn btn--primary" onClick={onDone}>
              Continuer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Le bilan du vendredi : tout ce qui a bougé, avec son responsable. */
export function SummaryLines({ summary }: { summary: WeekSummary }) {
  const lines = [...summary.lines];
  if (summary.won) lines.push({ text: 'Tu tiens le sommet. Partie gagnée.', tone: 'good' });
  if (lines.length === 0) {
    return <p className="muted">Semaine sans histoire. Ça arrive une fois par carrière.</p>;
  }
  return (
    <ul className="summary">
      {lines.map((l, i) => (
        <li key={i} className={`summary__line summary__line--${l.tone}`}>
          {l.text}
        </li>
      ))}
    </ul>
  );
}
