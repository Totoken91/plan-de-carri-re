import { useEffect, useState } from 'react';
import { STAT_KEYS } from '@engine/util';
import { getRank, getOpportunity } from '@data/content';
import { suspicionTier } from '@engine/suspicion';
import type { OppResolution } from '@engine/opportunities';
import type { ActionResult } from '@engine/actions';
import { useGame } from './useGame';
import { StatBar, SuspicionGauge } from './Bits';
import { ColleagueSheet } from './ColleagueSheet';
import { OfficeMap } from './OfficeMap';

type Toast = { text: string; tone: 'good' | 'bad' | 'neutral' } | null;

export function DeskScreen({ onEndWeek }: { onEndWeek: () => void }) {
  const { state, store } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const selected = state.colleagues.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const flash = (r: ActionResult | OppResolution) => {
    if (r.text) setToast({ text: r.text, tone: r.tone });
  };

  const canAct = state.status === 'playing' && state.actionPointsRemaining > 0 && !state.pendingEvent;
  const rank = getRank(state.player.rank);
  const lastLog = state.log.slice(-6).reverse();

  return (
    <div className="desk">
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
        <button
          className="btn btn--primary btn--endweek"
          disabled={state.status !== 'playing' || !!state.pendingEvent}
          onClick={onEndWeek}
        >
          {state.actionPointsRemaining > 0 ? 'Terminer la semaine' : '→ Vendredi soir'}
        </button>
      </header>

      <div className="playerstats">
        {STAT_KEYS.map((k) => (
          <StatBar key={k} stat={k} value={state.player.stats[k]} />
        ))}
        <SuspicionGauge value={state.suspicion} tier={suspicionTier(state.suspicion)} />
      </div>

      <div className="desk__body">
        <section className="mapcol">
          <OfficeMap
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAction={(a) => flash(store.performAction(a))}
            onOpportunity={flash}
          />

          <div className="oppbar">
            <h3 className="section-title">Opportunités de la semaine</h3>
            {state.opportunities.length === 0 && (
              <p className="muted">Rien à saisir cette semaine. Bosse, réseaute, ou complote.</p>
            )}
            <ul className="opplist">
              {state.opportunities.map((opp, i) => {
                const def = getOpportunity(opp.defId);
                if (!def) return null;
                const target = state.colleagues.find((c) => c.id === opp.targetId);
                const desc = def.description.replace('{target}', target?.name ?? 'un collègue');
                return (
                  <li key={`${opp.defId}-${i}`} className="oppitem">
                    <span className="oppitem__icon">{def.icon}</span>
                    <span className="oppitem__body">
                      <span className="oppitem__title">
                        {def.title}
                        {target && <em> · {target.name}</em>}
                      </span>
                      <span className="oppitem__desc">{desc}</span>
                    </span>
                    <button
                      className="btn btn--small"
                      disabled={!canAct}
                      onClick={() => flash(store.performOpportunity(i))}
                    >
                      Saisir <span className="cost">1 PA</span>
                    </button>
                  </li>
                );
              })}
            </ul>
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

        {selected && (
          <ColleagueSheet colleague={selected} onClose={() => setSelectedId(null)} onResult={flash} />
        )}
      </div>

      {toast && <div className={`toast toast--${toast.tone}`}>{toast.text}</div>}
    </div>
  );
}
