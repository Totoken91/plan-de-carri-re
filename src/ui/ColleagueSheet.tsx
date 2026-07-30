import type { Colleague } from '@state/schema';
import type { ActionResult } from '@engine/actions';
import { STAT_KEYS } from '@engine/util';
import { availableHooks } from '@engine/hooks';
import { useGame } from './useGame';
import { StatBar, OpinionPip } from './Bits';
import { archetypeName, planViews } from './selectors';

export function ColleagueSheet({
  colleague,
  onClose,
  onResult,
}: {
  colleague: Colleague;
  onClose: () => void;
  onResult: (r: ActionResult) => void;
}) {
  const { state, store } = useGame();
  const canAct = state.status === 'playing' && state.actionPointsRemaining > 0 && !state.pendingEvent;
  const plans = planViews(state, colleague.id);
  const hooks = availableHooks(state, colleague.id);

  return (
    <aside className="sheet">
      <div className="sheet__header">
        <div>
          <h2>{colleague.name}</h2>
          <p className="sheet__arch">
            {archetypeName(colleague.archetype)}
            {colleague.flags.includes('sous_emprise') && <span className="tag tag--hold"> ⛓️ sous emprise</span>}
            {colleague.flags.includes('discredite') && <span className="tag tag--bad"> discrédité</span>}
          </p>
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
            <li
              key={s.id}
              className={
                !s.discovered ? 'secret secret--hidden' : s.spent ? 'secret secret--spent' : 'secret secret--known'
              }
            >
              {s.discovered ? `« ${s.label} »${s.spent ? ' (levier utilisé)' : ''}` : '??? (à découvrir en fouinant)'}
            </li>
          ))}
        </ul>
      </section>

      {hooks.length > 0 && (
        <section className="sheet__block">
          <h3>Leviers</h3>
          <p className="muted sheet__leverhint">Un secret en main = un moyen de pression. Usage unique.</p>
          {hooks.map((h) => (
            <div key={h.id} className="lever">
              <span className="lever__label">« {h.label} »</span>
              <div className="lever__btns">
                <button
                  className="btn btn--small"
                  disabled={!canAct}
                  title="Le collègue passe dans ta poche (peur / loyauté)."
                  onClick={() => onResult(store.performHook(colleague.id, h.id, 'coerce'))}
                >
                  Faire chanter <span className="cost">1 PA</span>
                </button>
                <button
                  className="btn btn--small btn--danger"
                  disabled={!canAct}
                  title="Divulguer le secret : il en pâtit, mais ça se remarque."
                  onClick={() => onResult(store.performHook(colleague.id, h.id, 'expose'))}
                >
                  Balancer <span className="cost">1 PA</span>
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="sheet__block">
        <h3>Approche</h3>
        <div className="sheet__actions">
          <button className="btn" disabled={!canAct} onClick={() => onResult(store.performAction('cafe', { targetId: colleague.id }))}>
            ☕ Réseauter <span className="cost">1 PA</span>
          </button>
          <button className="btn" disabled={!canAct} onClick={() => onResult(store.performAction('fouiner', { targetId: colleague.id }))}>
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
                  onClick={() => onResult(store.performAction('comploter', { planId: pv.def.id, targetId: colleague.id }))}
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
