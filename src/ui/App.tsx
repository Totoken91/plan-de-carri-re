// ─────────────────────────────────────────────────────────────
// App.tsx — Les trois écrans et le passage de l'un à l'autre.
//
//   menu     : les dossiers du personnel
//   embauche : création du personnage, pour un dossier donné
//   partie   : le plateau
//
// Le store n'est lié à un dossier qu'à partir du moment où l'on ouvre ou
// crée une carrière ; au menu il n'écrit nulle part. C'est ce qui évite
// qu'un aller-retour par le menu n'écrase un dossier avec une partie
// fantôme.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { GameEvent } from '@state/schema';
import type { WeekSummary } from '@engine/week';
import { theme as boardTheme, themeVars } from '@data/board';
import { useGame } from './useGame';
import { CharacterCreation } from './CharacterCreation';
import { MainMenu } from './MainMenu';
import { Manual } from './Manual';
import { DeskScreen } from './DeskScreen';
import { Appart } from './Appart';
import { EventModal, SummaryLines } from './EventModal';
import { GameOver } from './GameOver';

// La palette du plateau descend depuis la racine : le formulaire
// d'embauche dessine la même scène que le plateau et doit y avoir accès.
const THEME_VARS = themeVars(boardTheme) as React.CSSProperties;

type Screen = { kind: 'menu' } | { kind: 'hiring'; slot: number } | { kind: 'playing' };

function hasSummaryContent(s: WeekSummary): boolean {
  return s.lines.length > 0 || !!(s.audit || s.promotion || s.won || s.gameOver);
}

export function App() {
  const { state, store } = useGame();
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  // Le règlement est consultable depuis le menu comme depuis la partie.
  const [manual, setManual] = useState(false);

  const handleEndWeek = () => {
    const outcome = store.endWeek();
    if (outcome.pendingEvent) {
      setActiveEvent(outcome.pendingEvent);
    } else if (outcome.summary && hasSummaryContent(outcome.summary)) {
      setWeekSummary(outcome.summary);
    }
  };

  const backToMenu = () => {
    store.close();
    setActiveEvent(null);
    setWeekSummary(null);
    setScreen({ kind: 'menu' });
  };

  // ── Menu ───────────────────────────────────────────────────
  if (screen.kind === 'menu') {
    return (
      <div className="app app--menu" style={THEME_VARS}>
        <MainMenu
          onResume={(slot) => {
            if (store.open(slot)) setScreen({ kind: 'playing' });
          }}
          onNewCareer={(slot) => setScreen({ kind: 'hiring', slot })}
          onManual={() => setManual(true)}
        />
        {manual && <Manual onClose={() => setManual(false)} />}
      </div>
    );
  }

  // ── Embauche ───────────────────────────────────────────────
  if (screen.kind === 'hiring') {
    const slot = screen.slot;
    return (
      <div className="app" style={THEME_VARS}>
        <CharacterCreation
          onHire={(name, appearance, traits) => {
            store.startCareer(slot, name, appearance, traits);
            setScreen({ kind: 'playing' });
          }}
          onCancel={backToMenu}
        />
      </div>
    );
  }

  // ── Le week-end ────────────────────────────────────────────
  // Il passe APRÈS le bilan : le joueur lit ce que la semaine a produit,
  // ferme, et se retrouve chez lui. L'inverse donnerait un bilan qui
  // s'ouvre par-dessus son propre salon.
  if (state.phase === 'weekend' && state.status === 'playing' && !activeEvent && !weekSummary) {
    return (
      <div className="app" style={THEME_VARS}>
        <Appart onLundi={() => store.startWeek()} />
      </div>
    );
  }

  // ── Partie ─────────────────────────────────────────────────
  const gameOverVisible = state.status !== 'playing' && !activeEvent && !weekSummary;

  return (
    <div className="app" style={THEME_VARS}>
      <DeskScreen onEndWeek={handleEndWeek} onMenu={backToMenu} />

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

      {/* Repostuler, c'est repasser par les RH : on revient aux dossiers
          plutôt que d'écraser celui-ci en douce. */}
      {gameOverVisible && <GameOver onRehire={backToMenu} />}
    </div>
  );
}
