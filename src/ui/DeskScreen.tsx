import { useState } from 'react';
import { STAT_KEYS } from '@engine/util';
import { getRank } from '@data/content';
import { suspicionTier } from '@engine/suspicion';
import { useGame } from './useGame';
import { StatBar, SuspicionGauge, OpinionPip } from './Bits';
import { ColleagueSheet } from './ColleagueSheet';
import { archetypeName } from './selectors';

export function DeskScreen({ onEndWeek }: { onEndWeek: () => void }) {
  const { state, store } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = state.colleagues.find((c) => c.id === selectedId) ?? null;

  const canAct = state.status === 'playing' && state.actionPointsRemaining > 0 && !state.pendingEvent;
  const rank = getRank(state.player.rank);
  const lastLog = state.log.slice(-6).reverse();

  return (
    <div className="desk">
      {/* En-tête joueur */}
      <header className="topbar">
        <div className="topbar__id">
          <span className="topbar__rank">{rank?.name ?? state.player.rank}</span>
          <span className="topbar__name">{state.player.name}</span>
          <span className="topbar__rep">Réputation {state.player.reputation}</span>
        </div>
        <div className="topbar__week">
          <span className="topbar__weeknum">Semaine {state.week}</span>
          <span className="topbar__ap">
            {'●'.repeat(state.actionPointsRemaining)}
            {'○'.repeat(Math.max(0, 5 - state.actionPointsRemaining))}
            <em> {state.actionPointsRemaining} PA</em>
          </span>
        </div>
      </header>

      <div className="playerstats">
        {STAT_KEYS.map((k) => (
          <StatBar key={k} stat={k} value={state.player.stats[k]} />
        ))}
        <SuspicionGauge value={state.suspicion} tier={suspicionTier(state.suspicion)} />
      </div>

      <div className="desk__body">
        {/* Open space */}
        <section className="openspace">
          <h2 className="section-title">L'open space</h2>
          <div className="colleagues">
            {state.colleagues.map((c) => (
              <button
                key={c.id}
                className={`colleague-card ${selectedId === c.id ? 'is-selected' : ''} ${!c.alive ? 'is-gone' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="colleague-card__name">{c.name}</div>
                <div className="colleague-card__arch">{archetypeName(c.archetype)}</div>
                <OpinionPip value={c.opinion} />
              </button>
            ))}
          </div>

          <div className="global-actions">
            <button className="btn btn--big" disabled={!canAct} onClick={() => store.performAction('bosser')}>
              💼 Bosser <span className="cost">1 PA</span>
            </button>
            <button className="btn btn--big" disabled={!canAct} onClick={() => store.performAction('glander')}>
              🛋️ Glander <span className="cost">1 PA</span>
            </button>
            <button
              className="btn btn--big btn--primary"
              disabled={state.status !== 'playing' || !!state.pendingEvent}
              onClick={onEndWeek}
            >
              {state.actionPointsRemaining > 0 ? 'Terminer la semaine (skip PA)' : '→ Vendredi soir'}
            </button>
          </div>

          <div className="feed">
            <h3 className="section-title">Fil de la semaine</h3>
            <ul>
              {lastLog.map((l, i) => (
                <li key={i} className={`feed__line feed__line--${l.tone}`}>
                  <span className="feed__week">S{l.week}</span> {l.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Fiche collègue */}
        {selected && <ColleagueSheet colleague={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}
