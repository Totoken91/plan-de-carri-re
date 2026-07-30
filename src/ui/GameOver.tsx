import type { GameState } from '@state/schema';
import { useGame } from './useGame';

const ENDINGS: Record<Exclude<GameState['status'], 'playing'>, { title: string; sub: string }> = {
  won: {
    title: 'Sommet atteint',
    sub: 'Tu as survécu au sommet de la hiérarchie. La direction te craint autant qu’elle te doit. Bravo — enfin, façon de parler.',
  },
  fired: {
    title: 'Licenciement pour faute grave',
    sub: 'L’audit de conformité RH a tranché. Un carton, un badge désactivé, un accompagnement de sortie « bienveillant ».',
  },
  burnout: {
    title: 'Indisponibilité définitive',
    sub: 'Tes Nerfs ont cédé trop longtemps. Placard, lumière blafarde, fougère en plastique. On ne t’attend plus en réunion.',
  },
};

export function GameOver() {
  const { state, store } = useGame();
  if (state.status === 'playing') return null;
  const end = ENDINGS[state.status];

  return (
    <div className="modal-backdrop">
      <div className={`modal gameover gameover--${state.status}`}>
        <div className="gameover__tag">Compte-rendu de fin de collaboration</div>
        <h1>{end.title}</h1>
        <p className="gameover__sub">{end.sub}</p>
        <dl className="gameover__stats">
          <div><dt>Semaines survécues</dt><dd>{state.week}</dd></div>
          <div><dt>Rang final</dt><dd>{state.player.rank}</dd></div>
          <div><dt>Suspicion finale</dt><dd>{Math.round(state.suspicion)}</dd></div>
        </dl>
        <button className="btn btn--primary" onClick={() => store.reset()}>
          Repostuler (nouvelle partie)
        </button>
      </div>
    </div>
  );
}
