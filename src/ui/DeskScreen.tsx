// ─────────────────────────────────────────────────────────────
// DeskScreen.tsx — La coque du jeu. Un écran, zéro défilement.
//
// L'ancienne mise en page était un FLUX vertical : barre, HUD, plateau,
// agenda, journal, les uns sous les autres. Mesuré, ça donnait 1 398 px
// de contenu pour 937 px de fenêtre — 461 px hors de vue sur un écran de
// bureau ordinaire, 620 px sur un portable. Autrement dit, la moitié des
// informations n'existaient que pour qui pensait à faire défiler.
//
// La coque est maintenant une GRILLE de la hauteur exacte de la fenêtre,
// et rien n'en sort :
//
//   ┌── barre haute : identité, objectif, ressources, vendredi ──┐
//   │                                              ┌───────────┐ │
//   │              LE PLATEAU (tout l'espace)      │ alertes   │ │
//   │                                              └───────────┘ │
//   ├── barre basse : les panneaux ouvrables + le conseil ───────┤
//
// Le reste — agenda, opportunités, journal, statistiques, périmètre —
// vit dans des panneaux qui s'OUVRENT PAR-DESSUS le plateau et se
// referment. C'est le choix de fond : on ne rétrécit pas le plateau pour
// faire tenir des listes, on montre les listes quand on les demande.
//
// Un seul panneau à la fois, volontairement. Deux panneaux ouverts, c'est
// la même mise en page empilée qu'avant, avec des bordures en plus.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { STAT_KEYS } from '@engine/util';
import { catalog, getRank, nextRank, getOpportunity } from '@data/content';
import { seuilAudit, suspicionTier } from '@engine/suspicion';
import { scapegoatOf, scapegoatWeeksLeft } from '@engine/scapegoat';
import { blocagePromotion, occupants, tenantsDe, trainDeVie } from '@engine/promotion';
import { ORDRES, placesDeSubordonnes, subordonnesDe } from '@engine/subordonnes';
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
import { alertesDe, conseilDe, type Alerte, type PanneauId } from './alertes';
import { tutorialSeen } from './tutorial';
import type { Selection } from './iso';
import { Icone, Jetons } from './icones';

type Toast = { text: string; tone: 'good' | 'bad' | 'neutral' } | null;

const TIER_MEANING: Record<string, string> = {
  calme: 'Personne ne se pose de questions sur toi.',
  rumeurs: 'Ça jase un peu. Rien de formel.',
  surveillance: 'On te regarde faire. Un écart de plus et ça remonte.',
  critique: 'Audit imminent. Sans alibi ni bouc émissaire, c’est le licenciement.',
};

const PANNEAUX: Array<{ id: PanneauId; nom: string; icone: string }> = [
  { id: 'stats', nom: 'Ton dossier', icone: 'dossier-onglets' },
  { id: 'agenda', nom: 'Ce qui se trame', icone: 'drapeau' },
  { id: 'opportunites', nom: 'Opportunités', icone: 'losange' },
  { id: 'perimetre', nom: 'Ton équipe', icone: 'groupe' },
  { id: 'journal', nom: 'Journal', icone: 'plume' },
];

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
  const [tuto, setTuto] = useState(() => !tutorialSeen());
  const [manual, setManual] = useState(false);
  const [paused, setPaused] = useState(false);
  const [poste, setPoste] = useState(false);
  const [panneau, setPanneau] = useState<PanneauId | null>(null);
  const [conseilOuvert, setConseilOuvert] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Chaque surcouche a son propre Échap. Sans cette garde, fermer
      // l'écran du poste ouvrait le menu pause dans la foulée : deux
      // écouteurs sur `window` recevaient la même touche.
      if (tuto || manual || poste) return;
      // Échap referme d'abord ce qui est ouvert, et n'ouvre le menu que
      // s'il n'y a plus rien à fermer. C'est l'ordre que la main attend.
      if (panneau) return setPanneau(null);
      if (selection) return setSelection(null);
      setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tuto, manual, poste, panneau, selection]);

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
  const tier = suspicionTier(state.suspicion, seuilAudit(state));
  const scapegoat = scapegoatOf(state);
  const blocage = blocagePromotion(state);
  const alertes = alertesDe(state);
  const conseil = conseilDe(state);
  const landingFriday = alertes.find((a) => a.id === 'menaces')?.compte ?? 0;

  const suivreAlerte = (a: Alerte) => {
    if (a.selection) setSelection(a.selection);
    if (a.panneau) setPanneau(a.panneau);
  };

  return (
    <div className="coque">
      {/* ── Barre haute ────────────────────────────────────── */}
      <header className="barre">
        <div className="barre__id">
          <span className="barre__rang">{rank?.name ?? state.player.rank}</span>
          <span className="barre__nom">{state.player.name}</span>
        </div>

        <div className="objectif">
          <div className="objectif__tete">
            <span>
              {next ? (
                <>
                  Objectif : <b>{next.name}</b>
                </>
              ) : (
                <b>Au sommet — tiens la position</b>
              )}
            </span>
            <span className="objectif__num">
              {state.player.reputation}
              {next && ` / ${next.reputationRequired}`}
            </span>
          </div>
          <div className="objectif__rail">
            <div className="objectif__jauge" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>

        <div className="barre__ressources">
          <span
            className={`ressource ${state.loyersImpayes > 0 ? 'is-danger' : ''}`}
            title={`Loyer ${euros(loyerDe(state))} · salaire ${euros(salaireDe(state))} par semaine`}
          >
            <em>Trésorerie</em>
            {euros(state.argent)}
          </span>
          <span className="ressource" title="Points d’action restants cette semaine">
            <em>Semaine {state.week}</em>
            <Jetons
              pleins={state.actionPointsRemaining}
              total={balance.actionPointsPerWeek}
            />
          </span>
          <span
            className={`ressource ressource--${tier}`}
            title={TIER_MEANING[tier]}
          >
            <em>Suspicion</em>
            {state.suspicion}
          </span>
        </div>

        <div className="barre__boutons">
          <button className="btn btn--help" onClick={() => setManual(true)} aria-label="Aide">
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
          >
            {state.actionPointsRemaining > 0 ? 'Terminer la semaine' : '→ Vendredi soir'}
            {landingFriday > 0 && (
              <span className="btn__warn">
                <Icone nom="attention" /> {landingFriday}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── La scène : le plateau prend tout ───────────────── */}
      <main className="scene">
        <IsoOffice
          selection={selection}
          onSelect={(s) => {
            // Cliquer son propre poste, c'est s'y asseoir.
            if (s?.kind === 'zone' && s.id === 'player') setPoste(true);
            setSelection(s);
          }}
        />

        {/* Le rail d'alertes : ce qui réclame ton attention, du plus
            urgent au plus dormant. Chaque voyant MÈNE quelque part — un
            voyant qui n'ouvre rien est un reproche, pas une info. */}
        <aside className="rail" aria-label="Alertes">
          {alertes.map((a) => (
            <button key={a.id} className={`voyant voyant--${a.ton}`} onClick={() => suivreAlerte(a)}>
              <span className="voyant__icone"><Icone nom={a.icone} /></span>
              {a.compte !== undefined && a.compte > 1 && (
                <span className="voyant__compte">{a.compte}</span>
              )}
              <span className="voyant__bulle">
                <b>{a.titre}</b>
                <span>{a.detail}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* L'inspecteur : un tiroir par-dessus le plateau, pas une
            colonne qui le rétrécit en permanence. */}
        {selection && (
          <aside className="tiroir">
            <Inspector selection={selection} onSelect={setSelection} onResult={flash} />
          </aside>
        )}

        {/* Les panneaux : ouverts par la barre du bas, refermés par
            Échap ou par leur croix. */}
        {panneau && (
          <section className="panneau">
            <header className="panneau__tete">
              <h2>{PANNEAUX.find((p) => p.id === panneau)?.nom}</h2>
              <button className="btn btn--ghost" onClick={() => setPanneau(null)} aria-label="Fermer">
                <Icone nom="croix" />
              </button>
            </header>
            <div className="panneau__corps">
              {panneau === 'stats' && (
                <>
                  <div className="hud__stats">
                    {STAT_KEYS.map((k) => (
                      <StatBar key={k} stat={k} value={state.player.stats[k]} palier />
                    ))}
                  </div>
                  <SuspicionGauge value={state.suspicion} tier={tier} />
                  <p className="muted">{TIER_MEANING[tier]}</p>
                  <p className={`hud__cover ${scapegoat ? 'is-ready' : ''}`}>
                    {scapegoat
                      ? `Couverture : dossier monté sur ${scapegoat.name} · ${scapegoatWeeksLeft(state, scapegoat)} sem.`
                      : 'Aucune couverture. Un audit remonterait jusqu’à toi.'}
                  </p>
                  <dl className="fiche">
                    <div>
                      <dt>Salaire</dt>
                      <dd>{euros(salaireDe(state))} / semaine</dd>
                    </div>
                    <div>
                      <dt>Loyer</dt>
                      <dd>{euros(loyerDe(state))} / semaine</dd>
                    </div>
                    <div>
                      <dt>Trésorerie</dt>
                      <dd>{euros(state.argent)}</dd>
                    </div>
                    <div>
                      <dt>Train de vie</dt>
                      <dd>{euros(trainDeVie(state))} / semaine</dd>
                    </div>
                  </dl>

                  {/* L'organigramme. Il répond à la seule question que la
                      barre de réputation ne sait pas poser : « la place
                      est-elle libre ? » Un rang complet se lit d'un coup
                      d'œil, avec le nom de qui l'occupe. */}
                  <h3 className="section-title">L’échelle</h3>
                  <ul className="echelle echelle--rangs">
                    {catalog.ranks
                      .slice()
                      .reverse()
                      .map((r) => {
                        const tenants = tenantsDe(state, r.id);
                        const moi = state.player.rank === r.id;
                        const pris = occupants(state, r.id);
                        const complet = pris >= r.places && !moi;
                        return (
                          <li
                            key={r.id}
                            className={`echelle__pas ${moi ? 'is-on' : ''} ${complet ? 'is-complet' : ''}`}
                          >
                            <b>{r.name}</b>
                            <em className="muted">
                              {r.places > 6
                                ? 'places à volonté'
                                : `${pris} / ${r.places} place${r.places > 1 ? 's' : ''}`}
                              {tenants.length > 0 && ` · ${tenants.map((c) => c.name).join(', ')}`}
                              {moi && ' · toi'}
                            </em>
                          </li>
                        );
                      })}
                  </ul>
                  {blocage?.siegeManquant && (
                    <p className="hud__cover">
                      Tu as la réputation pour {blocage.rang.name}. Il n’y a pas la place.
                    </p>
                  )}
                </>
              )}

              {panneau === 'agenda' && (
                <>
                  {state.colleagues.filter((c) => c.alive && c.intent && c.intent.kind !== 'idle')
                    .length === 0 && (
                    <p className="muted">Personne ne complote cette semaine. Profites-en.</p>
                  )}
                  <ul className="agenda__list">
                    {state.colleagues
                      .filter((c) => c.alive && c.intent && c.intent.kind !== 'idle')
                      .map((c) => (
                        <li key={c.id}>
                          <button
                            className={`agendaitem agendaitem--${c.intent!.tone} agendaitem--${c.intent!.kind}`}
                            onClick={() => {
                              setSelection({ kind: 'colleague', id: c.id });
                              setPanneau(null);
                            }}
                          >
                            <span className="agendaitem__icon"><Icone nom={c.intent!.icon} /></span>
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
                </>
              )}

              {panneau === 'opportunites' && (
                <>
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
                            onClick={() => {
                              setSelection({ kind: 'opportunity', index: i });
                              setPanneau(null);
                            }}
                          >
                            <span className="agendaitem__icon"><Icone nom={def.icon} /></span>
                            <span className="agendaitem__body">
                              <b>{def.title}</b>
                              {target && <em> · {target.name}</em>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {panneau === 'perimetre' && (
                <>
                  <p className="muted">
                    {placesDeSubordonnes(state) === 0
                      ? 'À ton rang, tu n’encadres personne. Ça vient avec les promotions.'
                      : `${subordonnesDe(state).length} / ${placesDeSubordonnes(state)} place(s) occupée(s). Clique quelqu’un sur le plateau pour le rattacher.`}
                  </p>
                  <ul className="agenda__list">
                    {subordonnesDe(state).map((c) => (
                      <li key={c.id}>
                        <button
                          className="agendaitem agendaitem--neutral"
                          onClick={() => {
                            setSelection({ kind: 'colleague', id: c.id });
                            setPanneau(null);
                          }}
                        >
                          <span className="agendaitem__icon">
                            {c.ordre
                              ? (ORDRES.find((o) => o.kind === c.ordre!.kind)?.icone ??
                                'presse-papier')
                              : '·'}
                          </span>
                          <span className="agendaitem__body">
                            <b>{c.name}</b> —{' '}
                            {c.ordre
                              ? `${ORDRES.find((o) => o.kind === c.ordre!.kind)?.nom} (${c.ordre.semaines} sem.)`
                              : 'sans consigne'}
                          </span>
                          <span className="agendaitem__count">op. {c.opinion}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {panneau === 'journal' && (
                <ul className="feed__list">
                  {state.log
                    .slice(-40)
                    .reverse()
                    .map((l, i) => (
                      <li key={i} className={`feed__line feed__line--${l.tone}`}>
                        <span className="feed__week">S{l.week}</span> {l.text}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ── Barre basse : les panneaux, et le conseil ──────── */}
      <footer className="dock">
        <nav className="dock__onglets">
          {PANNEAUX.map((p) => {
            const compte = alertes.find((a) => a.panneau === p.id)?.compte;
            return (
              <button
                key={p.id}
                className={`dock__bouton ${panneau === p.id ? 'is-on' : ''}`}
                onClick={() => setPanneau((cur) => (cur === p.id ? null : p.id))}
              >
                <span className="dock__glyphe"><Icone nom={p.icone} /></span>
                {p.nom}
                {compte !== undefined && compte > 0 && (
                  <span className="dock__pastille">{compte}</span>
                )}
              </button>
            );
          })}
        </nav>

        {conseil && (
          <div className={`conseil ${conseilOuvert ? '' : 'is-replie'}`}>
            <button
              className="conseil__bascule"
              onClick={() => setConseilOuvert((o) => !o)}
              title={conseilOuvert ? 'Masquer le conseil' : 'Afficher le conseil'}
            >
              <Icone nom="main" />
            </button>
            {conseilOuvert && <p className="conseil__texte">{conseil}</p>}
          </div>
        )}
      </footer>

      {toast && <div className={`toast toast--${toast.tone}`}>{toast.text}</div>}

      {poste && <Ecran onClose={() => setPoste(false)} />}

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
