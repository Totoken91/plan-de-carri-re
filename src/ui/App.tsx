import { useState } from 'react';
import type { GameEvent } from '@state/schema';
import type { WeekSummary } from '@engine/week';
import { useGame } from './useGame';
import { DeskScreen } from './DeskScreen';
import { EventModal, SummaryLines } from './EventModal';
import { GameOver } from './GameOver';

function hasSummaryContent(s: WeekSummary): boolean {
  return s.lines.length > 0 || !!(s.audit || s.promotion || s.won || s.gameOver);
}

export function App() {
  const { state, store } = useGame();
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);

  const handleEndWeek = () => {
    const outcome = store.endWeek();
    if (outcome.pendingEvent) {
      setActiveEvent(outcome.pendingEvent);
    } else if (outcome.summary && hasSummaryContent(outcome.summary)) {
      setWeekSummary(outcome.summary);
    }
  };

  const gameOverVisible = state.status !== 'playing' && !activeEvent && !weekSummary;

  return (
    <div className="app">
      <DeskScreen onEndWeek={handleEndWeek} />

      {activeEvent && <EventModal event={activeEvent} onDone={() => setActiveEvent(null)} />}

      {weekSummary && (
        <div className="modal-backdrop">
          <div className="modal weekend">
            <div className="event__tag">Vendredi soir · Bilan de la semaine</div>
            <SummaryLines summary={weekSummary} />
            <button className="btn btn--primary" onClick={() => setWeekSummary(null)}>
              Continuer
            </button>
          </div>
        </div>
      )}

      {gameOverVisible && <GameOver />}
    </div>
  );
}
