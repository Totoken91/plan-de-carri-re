import type { Colleague } from '@state/schema';
import { STAT_KEYS } from '@engine/util';
import { useGame } from './useGame';
import { StatBar, OpinionPip } from './Bits';
import { archetypeName, planViews } from './selectors';

export function ColleagueSheet({ colleague, onClose }: { colleague: Colleague; onClose: () => void }) {
  const { state, store } = useGame();
  const canAct = state.status === 'playing' && state.actionPointsRemaining > 0 && !state.pendingEvent;
  const plans = planViews(state, colleague.id);

  return (
    <aside className="sheet">
      <div className="sheet__header">
        <div>
          <h2>{colleague.name}</h2>
          <p className="sheet__arch">{archetypeName(colleague.archetype)}</p>
        </div>
        <button className="btn btn--ghost" onClick={onClose}>✕</button>
      </div>

      <div className="sheet__opinion">
        <OpinionPip value={colleague.opinion} />
      </div>

      <div className="sheet__stats">
        {STAT_KEYS.map((k) => (
          <StatBar key={k} stat={k} value={colleague.stats[k]} />
        ))}
      </div>

      <section className="sheet__block">
        <h3>Secrets</h3>
        {colleague.secrets.length === 0 && <p className="muted">Aucun secret connu.</p>}
        <ul className="secrets">
          {colleague.secrets.map((s) => (
            <li key={s.id} className={s.discovered ? 'secret secret--known' : 'secret secret--hidden'}>
              {s.discovered ? `« ${s.label} »` : '??? (à découvrir en fouinant)'}
            </li>
          ))}
        </ul>
      </section>

      <section className="sheet__block">
        <h3>Actions</h3>
        <div className="sheet__actions">
          <button
            className="btn"
            disabled={!canAct}
            onClick={() => store.performAction('cafe', { targetId: colleague.id })}
          >
            ☕ Machine à café <span className="cost">1 PA</span>
          </button>
          <button
            className="btn"
            disabled={!canAct}
            onClick={() => store.performAction('fouiner', { targetId: colleague.id })}
          >
            🔍 Fouiner <span className="cost">1 PA</span>
          </button>
        </div>
      </section>

      <section className="sheet__block">
        <h3>Comploter</h3>
        <ul className="plans">
          {plans.map((pv) => (
            <li key={pv.def.id} className="plan">
              <div className="plan__head">
                <span className="plan__name">{pv.def.name}</span>
                <span className="plan__chance">{pv.chance}%</span>
              </div>
              <p className="plan__desc muted">{pv.def.description}</p>
              <div className="plan__foot">
                {pv.inProgress ? (
                  <span className="plan__prep">Préparation {pv.preparation}/100 · {pv.def.durationWeeks} sem.</span>
                ) : (
                  <span className="plan__prep muted">Suspicion +{pv.def.suspicionOnSuccess}/{pv.def.suspicionOnFailure}</span>
                )}
                <button
                  className="btn btn--small"
                  disabled={!canAct || (!pv.inProgress && !pv.canStart)}
                  onClick={() => store.performAction('comploter', { planId: pv.def.id, targetId: colleague.id })}
                  title={!pv.canStart && !pv.inProgress ? 'Conditions non remplies (rang, secret, Combine…)' : ''}
                >
                  {pv.inProgress ? 'Avancer' : 'Lancer'} <span className="cost">1 PA</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
