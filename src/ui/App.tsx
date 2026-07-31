import { useState } from 'react';
import type { GameEvent } from '@state/schema';
import type { WeekSummary } from '@engine/week';
import { theme as boardTheme, themeVars } from '@data/board';
import { bootedWithoutSave, useGame } from './useGame';
import { CharacterCreation } from './CharacterCreation';
import { DeskScreen } from './DeskScreen';
import { EventModal, SummaryLines } from './EventModal';
import { GameOver } from './GameOver';

// La palette du plateau descend depuis la racine : le formulaire
// d'embauche dessine la même scène que le plateau et doit y avoir accès.
const THEME_VARS = themeVars(boardTheme) as React.CSSProperties;

function hasSummaryContent(s: WeekSummary): boolean {
  return s.lines.length > 0 || !!(s.audit || s.promotion || s.won || s.gameOver);
}

export function App() {
  const { state, store } = useGame();
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  // Pas de sauvegarde au démarrage = première visite : on passe par
  // l'embauche avant de montrer l'étage.
  const [hiring, setHiring] = useState(bootedWithoutSave);

  const handleEndWeek = () => {
    const outcome = store.endWeek();
    if (outcome.pendingEvent) {
      setActiveEvent(outcome.pendingEvent);
    } else if (outcome.summary && hasSummaryContent(outcome.summary)) {
      setWeekSummary(outcome.summary);
    }
  };

  if (hiring) {
    return (
      <div className="app" style={THEME_VARS}>
        <CharacterCreation
          onHire={(name, appearance) => {
            store.reset(undefined, name, appearance);
            setHiring(false);
          }}
        />
      </div>
    );
  }

  const gameOverVisible = state.status !== 'playing' && !activeEvent && !weekSummary;

  return (
    <div className="app" style={THEME_VARS}>
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

      {/* Repostuler, c'est repasser par les RH : nouveau dossier, donc
          nouveau personnage. */}
      {gameOverVisible && <GameOver onRehire={() => setHiring(true)} />}
    </div>
  );
}
