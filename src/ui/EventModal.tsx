import { useMemo, useState } from 'react';
import type { GameEvent } from '@state/schema';
import type { WeekSummary } from '@engine/week';
import { useGame } from './useGame';
import { availableChoiceFlags, fillTemplate } from './selectors';

export function EventModal({ event, onDone }: { event: GameEvent; onDone: () => void }) {
  const { state, store } = useGame();
  const [resolved, setResolved] = useState<{ text: string; summary: WeekSummary } | null>(null);

  const flags = useMemo(() => availableChoiceFlags(event, state), [event, state]);
  const body = fillTemplate(event.body, state);

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
              {event.choices.map((c, i) => (
                <button
                  key={i}
                  className="btn btn--choice"
                  disabled={!flags[i]}
                  onClick={() => choose(i)}
                  title={!flags[i] ? 'Prérequis non rempli' : ''}
                >
                  {c.label}
                  {!flags[i] && <span className="lock"> 🔒</span>}
                </button>
              ))}
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

export function SummaryLines({ summary }: { summary: WeekSummary }) {
  const lines: { text: string; tone: string }[] = [];
  if (summary.audit) lines.push({ text: `Audit RH : ${summary.audit}`, tone: 'bad' });
  if (summary.promotion) lines.push({ text: `Promotion : ${summary.promotion} !`, tone: 'good' });
  if (summary.won) lines.push({ text: 'Tu tiens le sommet. Partie gagnée.', tone: 'good' });
  if (lines.length === 0) return null;
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
