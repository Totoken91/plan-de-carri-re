import { useEffect, useState } from 'react';
import { STAT_KEYS } from '@engine/util';
import { getRank, nextRank, getOpportunity } from '@data/content';
import { suspicionTier } from '@engine/suspicion';
import { scapegoatOf, scapegoatWeeksLeft } from '@engine/scapegoat';
import { useGame } from './useGame';
import { StatBar, SuspicionGauge } from './Bits';
import { IsoOffice } from './IsoOffice';
import { Inspector } from './Inspector';
import { Tutorial } from './Tutorial';
import { Manual } from './Manual';
import { PauseMenu } from './PauseMenu';
import { Ecran } from './Ecran';
import { euros, loyerDe, salaireDe } from '@engine/argent';
import { balance } from '@data/balance';
import { tutorialSeen } from './tutorial';
import type { Selection } from './iso';

type Toast = { text: string; tone: 'good' | 'bad' | 'neutral' } | null;

const TIER_MEANING: Record<string, string> = {
  calme: 'Personne ne se pose de questions sur toi.',
  rumeurs: 'Ça jase un peu. Rien de formel.',
  surveillance: 'On te regarde faire. Un écart de plus et ça remonte.',
  critique: 'Audit imminent. Sans alibi ni bouc émissaire, c’est le licenciement.',
};

export function DeskScreen({
  onEndWeek,
  onMenu,
}: {
  onEndWeek: () => void;
  onMenu: () => void;
}) {
  const { state, store } = useGame();
  const [selection, setSelection] = useState<Selection>(null);
  const [toast, setToast] = useState<Toast>(null);
  // Le tuto s'ouvre tout seul à la toute première visite, jamais ensuite.
  const [tuto, setTuto] = useState(() => !tutorialSeen());
  const [manual, setManual] = useState(false);
  const [paused, setPaused] = useState(false);
  // Le poste de travail : bosser, la bourse et le casino s'y font, parce
  // que ce sont trois choses qu'on fait devant un écran.
  const [poste, setPoste] = useState(false);

  // Échap : le raccourci que tout le monde essaie en premier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Le tuto, le règlement et le poste ont déjà leur propre Échap.
      // Sans cette garde, fermer l'écran du poste ouvrait le menu pause
      // dans la foulée : deux écouteurs sur `window` recevaient la même
      // touche, et le second n'avait aucun moyen de savoir que le premier
      // venait de s'en servir.
      if (tuto || manual || poste) return;
      setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tuto, manual, poste]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const flash = (r: { text: string; tone: 'good' | 'bad' | 'neutral' }) => {
    if (r.text) setToast({ text: r.text, tone: r.tone });
  };

  const rank = getRank(state.player.rank);
  const next = nextRank(state.player.rank);
  const from = rank?.reputationRequired ?? 0;
  const to = next?.reputationRequired ?? state.player.reputation;
  const progress = to > from ? ((state.player.reputation - from) / (to - from)) * 100 : 100;
  const tier = suspicionTier(state.suspicion);

  const scapegoat = scapegoatOf(state);
  const threats = state.colleagues.filter((c) => c.alive && c.intent?.tone === 'threat');
  const landingFriday = threats.filter((c) => (c.intent?.weeksLeft ?? 2) <= 1);
  const lastLog = state.log.slice(-7).reverse();

  return (
    <div className="desk">
      <header className="topbar">
        <div className="topbar__id">
          <span className="topbar__rank">{rank?.name ?? state.player.rank}</span>
          <span className="topbar__name">{state.player.name}</span>
        </div>
        <span className="stampmark stampmark--corner" aria-hidden="true">
          Confidentiel
        </span>

        <div className="objective">
          <div className="objective__head">
            <span>
              {next ? (
                <>
                  Objectif : <b>{next.name}</b>
                </>
              ) : (
                <b>Au sommet — tiens la position</b>
              )}
            </span>
            <span className="objective__num">
              {state.player.reputation}
              {next && ` / ${next.reputationRequired}`} réput.
            </span>
          </div>
          <div className="objective__track">
            <div className="objective__fill" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>

        <div className="topbar__week">
          <span className="topbar__weeknum">Semaine {state.week}</span>
          <span
            className={`topbar__argent ${state.loyersImpayes > 0 ? 'is-danger' : ''}`}
            title={`Loyer ${euros(loyerDe(state))} · salaire ${euros(salaireDe(state))} par semaine`}
          >
            {euros(state.argent)}
          </span>
          {/* Un impayé doit se voir AVANT le vendredi suivant : une fin
              de partie qu'on n'a pas vue venir n'est pas un enjeu. */}
          {state.loyersImpayes > 0 && (
            <span className="topbar__expulsion">
              Loyer impayé {state.loyersImpayes}/{balance.expulsionApres}
            </span>
          )}
          <span className="topbar__ap" title="Points d'action restants">
            {'●'.repeat(state.actionPointsRemaining)}
            {'○'.repeat(Math.max(0, 5 - state.actionPointsRemaining))}
            <em> {state.actionPointsRemaining} PA</em>
          </span>
        </div>

        <button
          className="btn btn--help"
          onClick={() => setManual(true)}
          title="Règlement intérieur et tutoriel"
          aria-label="Aide"
        >
          ?
        </button>

        <button
          className="btn btn--small btn--menu"
          onClick={() => setPaused(true)}
          title="Menu · Échap"
        >
          Menu
        </button>

        <button
          className="btn btn--primary btn--endweek"
          disabled={state.status !== 'playing' || !!state.pendingEvent}
          onClick={onEndWeek}
          title={
            landingFriday.length > 0
              ? `${landingFriday.length} manœuvre(s) se résolvent ce vendredi`
              : 'Passer au vendredi soir'
          }
        >
          {state.actionPointsRemaining > 0 ? 'Terminer la semaine' : '→ Vendredi soir'}
          {landingFriday.length > 0 && <span className="btn__warn">⚠ {landingFriday.length}</span>}
        </button>
      </header>

      <div className="hud">
        <div className="hud__stats">
          {STAT_KEYS.map((k) => (
            <StatBar key={k} stat={k} value={state.player.stats[k]} />
          ))}
        </div>
        <div className="hud__susp">
          <SuspicionGauge value={state.suspicion} tier={tier} />
          <p className="hud__meaning">{TIER_MEANING[tier]}</p>
          {/* Savoir si on est couvert change toute la lecture du risque. */}
          <p className={`hud__cover ${scapegoat ? 'is-ready' : ''}`}>
            {scapegoat
              ? `Couverture : dossier monté sur ${scapegoat.name} · ${scapegoatWeeksLeft(state, scapegoat)} sem.`
              : 'Aucune couverture. Un audit remonterait jusqu’à toi.'}
          </p>
        </div>
      </div>

      <div className="desk__body">
        <section className="board">
          <IsoOffice
            selection={selection}
            onSelect={(s) => {
              // Cliquer son propre poste, c'est s'y asseoir. C'est le
              // seul endroit du jeu où une zone ouvre un écran plutôt que
              // de remplir l'inspecteur — parce que c'est le seul endroit
              // où le personnage a quelque chose devant les yeux.
              if (s?.kind === 'zone' && s.id === 'player') setPoste(true);
              setSelection(s);
            }}
          />

          <div className="agenda">
            <div className="agenda__col">
              <h3 className="section-title">Ce qui se trame</h3>
              {threats.length === 0 && (
                <p className="muted">Personne ne complote contre toi cette semaine. Profites-en.</p>
              )}
              <ul className="agenda__list">
                {state.colleagues
                  .filter((c) => c.alive && c.intent && c.intent.kind !== 'idle')
                  .map((c) => (
                    <li key={c.id}>
                      <button
                        className={`agendaitem agendaitem--${c.intent!.tone} agendaitem--${c.intent!.kind}`}
                        onClick={() => setSelection({ kind: 'colleague', id: c.id })}
                      >
                        <span className="agendaitem__icon">{c.intent!.icon}</span>
                        <span className="agendaitem__body">
                          <b>{c.name}</b> — {c.intent!.label}
                        </span>
                        {c.intent!.weeksLeft > 1 && (
                          <span className="agendaitem__count">{c.intent!.weeksLeft} sem.</span>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="agenda__col">
              <h3 className="section-title">Opportunités — expirent vendredi</h3>
              {state.opportunities.length === 0 && (
                <p className="muted">Rien à saisir. Bosse, réseaute, ou complote.</p>
              )}
              <ul className="agenda__list">
                {state.opportunities.map((opp, i) => {
                  const def = getOpportunity(opp.defId);
                  if (!def) return null;
                  const target = state.colleagues.find((c) => c.id === opp.targetId);
                  return (
                    <li key={`${opp.defId}-${i}`}>
                      <button
                        className="agendaitem agendaitem--opp"
                        onClick={() => setSelection({ kind: 'opportunity', index: i })}
                      >
                        <span className="agendaitem__icon">{def.icon}</span>
                        <span className="agendaitem__body">
                          <b>{def.title}</b>
                          {target && <em> · {target.name}</em>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="feed">
            <h3 className="section-title">Journal</h3>
            <ul>
              {lastLog.map((l, i) => (
                <li key={i} className={`feed__line feed__line--${l.tone}`}>
                  <span className="feed__week">S{l.week}</span> {l.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Inspector selection={selection} onSelect={setSelection} onResult={flash} />
      </div>

      {poste && <Ecran onClose={() => setPoste(false)} />}

      {toast && <div className={`toast toast--${toast.tone}`}>{toast.text}</div>}

      {tuto && (
        <Tutorial selection={selection} onSelect={setSelection} onClose={() => setTuto(false)} />
      )}

      {paused && (
        <PauseMenu
          slot={store.openSlot}
          playerName={state.player.name}
          week={state.week}
          traits={state.player.traits}
          onClose={() => setPaused(false)}
          onMenu={onMenu}
          onManual={() => {
            setPaused(false);
            setManual(true);
          }}
        />
      )}

      {manual && (
        <Manual
          onClose={() => setManual(false)}
          onReplay={() => {
            setManual(false);
            setTuto(true);
          }}
        />
      )}
    </div>
  );
}
