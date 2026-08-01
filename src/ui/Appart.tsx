// ─────────────────────────────────────────────────────────────
// Appart.tsx — Le week-end. Le seul écran du jeu où personne ne te note.
//
// Il obéit à la même règle que le plateau : ce qu'on peut faire est
// limité par un compteur visible, et chaque action annonce ce qu'elle
// coûte avant le clic. Ce qui change, c'est la MONNAIE de ce compteur —
// au bureau on dépense des points d'action, ici on dépense un week-end,
// et il n'y en a que deux ou trois selon l'endroit où l'on vit.
//
// C'est ce qui donne au logement sa raison d'être mécanique plutôt que
// décorative : déménager, ce n'est pas acheter un décor, c'est acheter
// du temps libre.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { ActionResult } from '@engine/actions';
import { activites, apparts, appartSuivant, getAppart, meubles } from '@data/vieprivee';
import { blocageActivite } from '@engine/vieprivee';
import { euros } from '@engine/argent';
import { romanceDe } from '@engine/romance';
import { useGame } from './useGame';
import { Bourse, Casino } from './Marche';
import { BlocDepenses } from './ViePrivee';
import { Figure } from './sprites';
import { Tutorial } from './Tutorial';
import { tutorialSeen } from './tutorial';
import { GooFilter } from './sprites';

type Onglet = 'week-end' | 'logement' | 'marche';

export function Appart({ onLundi }: { onLundi: () => void }) {
  const { state, store } = useGame();
  const [onglet, setOnglet] = useState<Onglet>('week-end');
  const [toast, setToast] = useState<ActionResult | null>(null);
  // L'accueil guidé continue ici : il a une note à donner sur le week-end,
  // et sans cette instance il n'aurait aucun moyen de la donner.
  const [tuto, setTuto] = useState(() => !tutorialSeen());
  // La cible des activités : une seule liste déroulante pour toutes,
  // plutôt qu'un sélecteur par carte. On choisit qui, puis quoi.
  const [cibleId, setCibleId] = useState<string>('');

  const flash = (r: ActionResult) => {
    if (r.text) setToast(r);
  };

  const logement = getAppart(state.appart.niveau);
  const suivant = appartSuivant(state.appart.niveau);
  const vivants = state.colleagues.filter((c) => c.alive);
  const cible = vivants.find((c) => c.id === cibleId);
  const installes = state.appart.meubles;

  return (
    <div className="appart">
      <header className="topbar topbar--appart">
        <div className="topbar__id">
          <span className="topbar__rank">Week-end</span>
          <span className="topbar__name">{logement?.nom ?? 'Chez toi'}</span>
        </div>

        <div className="appart__compteurs">
          <span className="appart__argent">{euros(state.argent)}</span>
          <span className="topbar__ap" title="Ce que tu peux faire de ton week-end">
            {'●'.repeat(state.weekendPointsRemaining)}
            {'○'.repeat(Math.max(0, (logement?.pointsWeekend ?? 2) - state.weekendPointsRemaining))}
            <em> {state.weekendPointsRemaining} week-end</em>
          </span>
        </div>

        <nav className="appart__onglets">
          {(['week-end', 'logement', 'marche'] as Onglet[]).map((o) => (
            <button
              key={o}
              className={`chip ${onglet === o ? 'is-on' : ''}`}
              onClick={() => setOnglet(o)}
            >
              {o === 'week-end' ? 'Le week-end' : o === 'logement' ? 'Chez toi' : 'Argent'}
            </button>
          ))}
        </nav>

        <button className="btn btn--primary btn--endweek" onClick={onLundi}>
          Lundi matin →
        </button>
      </header>

      <div className="appart__body">
        <section className="sheet appart__scene">
          <h3 className="section-title">{logement?.nom}</h3>
          <p className="muted">{logement?.description}</p>

          {/* La pièce, vue de face. Volontairement petite et large : c'est
              une vignette, pas une scène. Un grand cadre presque vide
              disait « il manque quelque chose » alors que le logement de
              départ est censé dire « il n'y a rien, et c'est le sujet ».

              Le personnage y est dessiné par le MÊME composant que sur le
              plateau — donc sans jambes, comme partout ailleurs : la
              ligne de sol lui sert de rebord, exactement comme le bureau. */}
          <svg className="appart__vue" viewBox="-130 -76 260 112" aria-hidden="true">
            <defs>
              <GooFilter />
              <linearGradient id="appartJour" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--iso-baie-haut, #eef3f8)" />
                <stop offset="1" stopColor="var(--iso-baie-bas, #cdd8e4)" />
              </linearGradient>
            </defs>

            <rect x="-130" y="-76" width="260" height="94" className="appart__mur" />
            {/* La fenêtre : le seul rappel qu'il existe un dehors. */}
            <g className="appart__fenetre">
              <rect x="-112" y="-62" width="62" height="46" fill="url(#appartJour)" />
              <path d="M -81 -62 L -81 -16 M -112 -39 L -50 -39" />
              <rect x="-114" y="-64" width="66" height="50" fill="none" strokeWidth="2" />
            </g>
            <line x1="-130" y1="18" x2="130" y2="18" className="appart__plinthe" />
            <rect x="-130" y="18" width="260" height="18" className="appart__sol" />

            {/* Ce qu'on a acheté, posé le long du mur. */}
            {installes.map((id, i) => {
              const m = meubles.find((x) => x.id === id);
              if (!m) return null;
              const x = -26 + (i % 5) * 34;
              const y = 10 - Math.floor(i / 5) * 30;
              return (
                <g key={id}>
                  <ellipse cx={x} cy={y + 3} rx="13" ry="3.4" className="appart__pose" />
                  <text className="appart__meuble" x={x} y={y} textAnchor="middle">
                    {m.icone}
                  </text>
                </g>
              );
            })}

            <g transform="translate(96,20) scale(0.92)">
              <Figure id="chez-soi" look={state.player.appearance} />
            </g>
          </svg>

          <p className="appart__places">
            {installes.length} / {logement?.places ?? 0} meuble(s) ·{' '}
            {logement?.pointsWeekend ?? 2} action(s) de week-end · standing{' '}
            {logement?.standing ?? 0}
          </p>
        </section>

        <div className="appart__col">
          {onglet === 'week-end' && (
            <>
              <section className="sheet inspector__block">
                <h3 className="section-title">Avec qui ?</h3>
                <select
                  className="ordre__cible"
                  value={cibleId}
                  onChange={(e) => setCibleId(e.target.value)}
                >
                  <option value="">Personne — je reste seul</option>
                  {vivants.map((c) => {
                    const r = romanceDe(c);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {r.statut !== 'rien' && r.statut !== 'ex' ? ` · ${r.statut}` : ''}
                      </option>
                    );
                  })}
                </select>
                {cible && (
                  <p className="muted">
                    Opinion {cible.opinion} · attachement {romanceDe(cible).niveau}
                  </p>
                )}
              </section>

              <section className="sheet inspector__block">
                <h3 className="section-title">Deux jours à toi</h3>
                <div className="actlist actlist--tight">
                  {activites.map((a) => {
                    const raison = blocageActivite(state, a, cibleId || undefined);
                    return (
                      <button
                        key={a.id}
                        className={`act ${a.successChance !== undefined ? 'act--danger' : ''}`}
                        disabled={!!raison}
                        onClick={() => flash(store.performActivite(a.id, cibleId || undefined))}
                      >
                        <span className="act__icon">{a.icone}</span>
                        <span className="act__body">
                          <span className="act__head">
                            <span className="act__label">{a.nom}</span>
                            {a.successChance !== undefined && (
                              <span className="act__chance">{a.successChance}%</span>
                            )}
                          </span>
                          <span className="act__summary">{raison ?? a.description}</span>
                        </span>
                        <span className="act__cost">{a.cout} ⬤</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <BlocDepenses lieu="appart" onResult={flash} />
            </>
          )}

          {onglet === 'logement' && (
            <>
              <section className="sheet inspector__block">
                <h3 className="section-title">Déménager</h3>
                {suivant ? (
                  <button
                    className="act"
                    disabled={state.argent < suivant.prix}
                    onClick={() => flash(store.performDemenager())}
                  >
                    <span className="act__icon">🔑</span>
                    <span className="act__body">
                      <span className="act__head">
                        <span className="act__label">{suivant.nom}</span>
                      </span>
                      <span className="act__summary">
                        {state.argent < suivant.prix
                          ? `Il te manque ${euros(suivant.prix - state.argent)}.`
                          : suivant.description}
                      </span>
                      <span className="act__lines">
                        <span className="act__line act__line--good">
                          {suivant.places} meubles · {suivant.pointsWeekend} actions
                        </span>
                        <span className="act__line act__line--bad">
                          loyer {euros(suivant.loyer)} / semaine
                        </span>
                      </span>
                    </span>
                    <span className="act__cost act__cost--euros">{euros(suivant.prix)}</span>
                  </button>
                ) : (
                  <p className="muted">Tu es tout en haut de l’immeuble, et de la liste.</p>
                )}
                <ul className="echelle">
                  {apparts.map((a) => (
                    <li
                      key={a.id}
                      className={`echelle__pas ${a.id === state.appart.niveau ? 'is-on' : ''}`}
                    >
                      <b>{a.nom}</b>
                      <em className="muted">
                        {a.prix === 0 ? 'départ' : euros(a.prix)} · loyer {euros(a.loyer)}
                      </em>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="sheet inspector__block">
                <h3 className="section-title">
                  Ameublement{' '}
                  <em className="muted">
                    {installes.length} / {logement?.places ?? 0}
                  </em>
                </h3>
                <div className="actlist actlist--tight">
                  {meubles.map((m) => {
                    const possede = installes.includes(m.id);
                    const plein = installes.length >= (logement?.places ?? 0);
                    const tropCher = state.argent < m.prix;
                    return (
                      <button
                        key={m.id}
                        className={`act ${possede ? 'act--possede' : ''}`}
                        disabled={!possede && (plein || tropCher)}
                        onClick={() =>
                          flash(
                            possede
                              ? store.performRevendreMeuble(m.id)
                              : store.performAcheterMeuble(m.id),
                          )
                        }
                      >
                        <span className="act__icon">{m.icone}</span>
                        <span className="act__body">
                          <span className="act__head">
                            <span className="act__label">{m.nom}</span>
                          </span>
                          <span className="act__summary">
                            {possede
                              ? `Installé. Revendre en rend ${euros(Math.round(m.prix / 2))} — la moitié, comme toujours.`
                              : plein
                                ? 'Plus de place ici.'
                                : tropCher
                                  ? `Il te manque ${euros(m.prix - state.argent)}.`
                                  : m.description}
                          </span>
                        </span>
                        <span className="act__cost act__cost--euros">
                          {possede ? 'Revendre' : euros(m.prix)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {onglet === 'marche' && (
            <>
              <section className="sheet inspector__block">
                <h3 className="section-title">Portefeuille</h3>
                <Bourse onResult={flash} />
              </section>
              <section className="sheet inspector__block">
                <h3 className="section-title">Casino en ligne</h3>
                <Casino onResult={flash} />
              </section>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className={`toast toast--${toast.tone}`} onAnimationEnd={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      {tuto && <Tutorial selection={null} onSelect={() => {}} onClose={() => setTuto(false)} />}
    </div>
  );
}
