// ─────────────────────────────────────────────────────────────
// Appart.tsx — Le week-end. Le seul écran du jeu où personne ne te note.
//
// CE QUI A ÉTÉ REFAIT, ET POURQUOI.
//
// C'était une liste de boutons dans un panneau, avec une vignette
// décorative à côté qui ne servait à rien. Trois défauts, tous relevés
// en jouant :
//
//  · on ne savait pas ce qu'une activité ALLAIT faire. « Recevoir
//    quelqu'un » n'annonçait ni ce qu'elle rapportait, ni ce que le
//    mobilier y changeait ;
//  · on ne savait pas ce qu'elle AVAIT fait. Un message passait quatre
//    secondes en bas de l'écran, puis disparaissait — et avec lui la
//    seule trace de ce qu'on venait de dépenser ;
//  · la bourse et le casino s'ouvraient depuis un onglet « Argent »,
//    c'est-à-dire depuis nulle part. Au bureau il faut aller s'asseoir
//    devant un écran ; chez soi, on cliquait sur son solde.
//
// Maintenant l'appartement est une PIÈCE, dessinée comme le reste du
// jeu. On clique un endroit — le lit, l'ordinateur, le canapé — et le
// panneau de droite annonce exactement ce qui va se passer. Une fois
// fait, il ne passe pas : il AFFICHE LE BILAN, ligne par ligne, tant
// qu'on n'a pas cliqué ailleurs.
//
// La bourse et le casino sont derrière l'ordinateur, comme au bureau.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '@state/schema';
import { activites, apparts, appartSuivant, getAppart, getMeuble, meubles } from '@data/vieprivee';
import { blocageActivite, bonusMobilier } from '@engine/vieprivee';
import { euros } from '@engine/argent';
import { describeEffect } from '@engine/preview';
import { valeurPortefeuille } from '@engine/marche';
import { romanceDe } from '@engine/romance';
import { useGame } from './useGame';
import { Parking } from './Parking';
import { Ecran } from './Ecran';
import { AppartIso, COINS } from './AppartIso';
import { Figure, GooFilter } from './sprites';
import { iso } from './iso';
import { Icone, Jetons } from './icones';
import { Manual } from './Manual';
import { Tutorial } from './Tutorial';
import { tutorialSeen } from './tutorial';

type Panneau = 'ameublement' | 'logement' | 'parking' | 'journal' | null;

// ── Le bilan d'une action ────────────────────────────────────
/**
 * Ce que l'action a VRAIMENT fait, mesuré sur l'état.
 *
 * On aurait pu réutiliser le texte de résultat du moteur, mais il
 * raconte — il ne chiffre pas. Or la question qu'on se pose après avoir
 * dépensé un week-end n'est pas « qu'est-ce qui s'est passé », c'est
 * « qu'est-ce que ça m'a rapporté ». On photographie donc l'état avant,
 * on compare après, et on affiche la différence. Aucune arithmétique
 * dupliquée : c'est le moteur qui a calculé, on se contente de lire.
 */
interface Ligne {
  texte: string;
  ton: 'good' | 'bad' | 'neutral';
}

function photo(s: GameState) {
  return {
    argent: s.argent,
    reputation: s.player.reputation,
    suspicion: s.suspicion,
    stats: { ...s.player.stats },
    opinions: Object.fromEntries(s.colleagues.map((c) => [c.id, c.opinion])),
    romance: Object.fromEntries(s.colleagues.map((c) => [c.id, romanceDe(c).niveau])),
    noms: Object.fromEntries(s.colleagues.map((c) => [c.id, c.name])),
    secrets: s.colleagues.reduce((n, c) => n + c.secrets.filter((x) => x.discovered).length, 0),
  };
}

const LABELS: Record<string, string> = {
  aura: 'Aura',
  rendement: 'Rendement',
  combine: 'Combine',
  nerfs: 'Nerfs',
};

function bilan(avant: ReturnType<typeof photo>, apres: ReturnType<typeof photo>): Ligne[] {
  const out: Ligne[] = [];
  // Une jauge déjà au plafond n'encaisse rien, et le bilan affichait
  // alors « rien n'a bougé » juste après avoir promis « +18 Nerfs ».
  // C'est la pire réponse possible : elle donne l'impression d'un bug
  // alors que la règle est parfaitement normale. On la nomme.
  for (const k of ['nerfs', 'aura', 'rendement', 'combine'] as const) {
    if (apres.stats[k] === avant.stats[k] && (avant.stats[k] >= 100 || avant.stats[k] <= 0)) {
      out.push({
        texte: `${LABELS[k]} déjà ${avant.stats[k] >= 100 ? 'au maximum' : 'à zéro'} : rien à gagner ici`,
        ton: 'neutral',
      });
    }
  }
  const chiffre = (v: number, nom: string, inverse = false) => {
    if (v === 0) return;
    const bon = inverse ? v < 0 : v > 0;
    out.push({ texte: `${v > 0 ? '+' : ''}${v} ${nom}`, ton: bon ? 'good' : 'bad' });
  };
  for (const k of ['nerfs', 'aura', 'rendement', 'combine'] as const) {
    chiffre(apres.stats[k] - avant.stats[k], LABELS[k]!);
  }
  chiffre(apres.reputation - avant.reputation, 'réputation');
  chiffre(apres.suspicion - avant.suspicion, 'Suspicion', true);
  if (apres.argent !== avant.argent) {
    const d = apres.argent - avant.argent;
    out.push({ texte: `${d > 0 ? '+' : '−'}${euros(Math.abs(d))}`, ton: d > 0 ? 'good' : 'bad' });
  }
  for (const [id, v] of Object.entries(apres.opinions)) {
    const d = (v as number) - (avant.opinions[id] ?? 0);
    if (d !== 0) {
      out.push({
        texte: `${d > 0 ? '+' : ''}${d} opinion de ${apres.noms[id]}`,
        ton: d > 0 ? 'good' : 'bad',
      });
    }
  }
  for (const [id, v] of Object.entries(apres.romance)) {
    const d = (v as number) - (avant.romance[id] ?? 0);
    if (d !== 0) {
      out.push({
        texte: `${d > 0 ? '+' : ''}${d} d’attachement · ${apres.noms[id]}`,
        ton: d > 0 ? 'good' : 'bad',
      });
    }
  }
  if (apres.secrets > avant.secrets) {
    out.push({ texte: `${apres.secrets - avant.secrets} secret(s) découvert(s)`, ton: 'good' });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
export function Appart({ onLundi }: { onLundi: () => void }) {
  const { state, store } = useGame();
  const [coin, setCoin] = useState<string | null>(null);
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [poste, setPoste] = useState(false);
  const [cibleId, setCibleId] = useState<string>('');
  const [resultat, setResultat] = useState<{ texte: string; ton: string; lignes: Ligne[] } | null>(
    null,
  );
  const [tuto, setTuto] = useState(() => !tutorialSeen());
  const [manuel, setManuel] = useState(false);

  const logement = getAppart(state.appart.niveau);
  const suivant = appartSuivant(state.appart.niveau);
  const vivants = state.colleagues.filter((c) => c.alive);
  const installes = state.appart.meubles;
  const def = coin && coin !== 'poste' ? activites.find((a) => a.id === coin) : undefined;
  const laCible = vivants.find((c) => c.id === cibleId);

  // Une cible par défaut : celle avec qui l'histoire est la plus avancée.
  // Sans ça, chaque activité à deux commençait par « il faut choisir
  // quelqu'un » — vrai, mais désagréable.
  useEffect(() => {
    if (cibleId || vivants.length === 0) return;
    const meilleur = [...vivants].sort((a, b) => romanceDe(b).niveau - romanceDe(a).niveau)[0];
    setCibleId(meilleur!.id);
  }, [cibleId, vivants]);

  useEffect(() => setResultat(null), [coin]);

  const faire = (id: string, cible?: string) => {
    const avant = photo(store.getState());
    const r = store.performActivite(id, cible);
    setResultat({ texte: r.text, ton: r.tone, lignes: r.ok ? bilan(avant, photo(store.getState())) : [] });
  };

  const achat = (fn: () => { ok: boolean; text: string; tone: string }) => {
    const avant = photo(store.getState());
    const r = fn();
    setResultat({ texte: r.text, ton: r.tone, lignes: r.ok ? bilan(avant, photo(store.getState())) : [] });
  };

  // Le personnage se place devant le coin choisi : c'est le seul retour
  // dont on a besoin pour comprendre qu'on a sélectionné un endroit et
  // pas une ligne de menu.
  const place = useMemo(() => {
    const c = COINS.find((x) => x.id === coin);
    return c ? iso(c.gx + c.w / 2, c.gy + c.d + 0.4) : iso(5.3, 3.0);
  }, [coin]);

  const bloque = def ? blocageActivite(state, def, cibleId || undefined) : undefined;

  return (
    <div className="coque coque--appart appart">
      <header className="barre">
        <div className="barre__id">
          <span className="barre__rang">Week-end · semaine {state.week}</span>
          <span className="barre__nom">{logement?.nom ?? 'Chez toi'}</span>
        </div>

        <p className="appart__flavor">{logement?.description}</p>

        <div className="barre__ressources">
          <span className="ressource" title="Ce que tu as sur ton compte">
            <em>Trésorerie</em>
            {euros(state.argent)}
          </span>
          <span className="ressource" title="Ce que tu peux encore faire de ton week-end">
            <em>Ton week-end</em>
            <Jetons pleins={state.weekendPointsRemaining} total={logement?.pointsWeekend ?? 2} />
          </span>
        </div>

        <div className="barre__boutons">
          <button className="btn btn--help" onClick={() => setManuel(true)} aria-label="Aide">
            ?
          </button>
          <button className="btn btn--primary btn--endweek" onClick={onLundi}>
            Lundi matin →
          </button>
        </div>
      </header>

      <div className="scene scene--appart">
        <AppartIso
          meubles={installes}
          selection={coin}
          onSelect={(id) => setCoin((c) => (c === id ? null : id))}
          enfant={
            <g transform={`translate(${place.x},${place.y})`}>
              <GooFilter />
              <Figure id="chez-soi" look={state.player.appearance} />
            </g>
          }
        />

        {/* ── Le panneau : ce qui va se passer, puis ce qui s'est passé ── */}
        <aside className="tiroir tiroir--appart">
          <div className="inspector">
          {!coin && (
            <div className="inspector__empty">
              <h3 className="section-title">Deux jours à toi</h3>
              <p className="muted">
                Clique un endroit de la pièce. Chaque coin fait quelque chose même
                sans le meuble qui va avec — on dort très bien sur un matelas par
                terre, simplement moins bien.
              </p>
              <ul className="howto">
                {COINS.map((c) => {
                  const a = activites.find((x) => x.id === c.id);
                  return (
                    <li key={c.id}>
                      <b>{c.nom}</b> —{' '}
                      {c.id === 'poste'
                        ? 'bourse, casino, et le dossier du dimanche soir.'
                        : a?.description}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {coin === 'poste' && (
            <>
              <header className="inspector__head">
                <h2 className="inspector__title">L’ordinateur</h2>
                <button className="btn btn--ghost" onClick={() => setCoin(null)}>
                  <Icone nom="croix" />
                </button>
              </header>
              <p className="inspector__flavor">
                Le marché, le casino, et le document que tu enverras demain matin daté
                d’aujourd’hui. Tout ce qui se fait devant un écran se fait devant un
                écran — ici comme au bureau.
              </p>
              <button className="btn btn--primary btn--faire" onClick={() => setPoste(true)}>
                Ouvrir l’ordinateur
              </button>
              {valeurPortefeuille(state) > 0 && (
                <p className="muted">Portefeuille : {euros(valeurPortefeuille(state))}.</p>
              )}
            </>
          )}

          {def && (
            <>
              <header className="inspector__head">
                <div>
                  <h2 className="inspector__title">{def.nom}</h2>
                  <p className="inspector__sub">{COINS.find((c) => c.id === coin)?.nom}</p>
                </div>
                <button className="btn btn--ghost" onClick={() => setCoin(null)}>
                  <Icone nom="croix" />
                </button>
              </header>

              <p className="inspector__flavor">{def.description}</p>

              {def.cible === 'colleague' && (
                <section className="inspector__block">
                  <h3 className="section-title">Avec qui ?</h3>
                  <select
                    className="ordre__cible"
                    value={cibleId}
                    onChange={(e) => setCibleId(e.target.value)}
                  >
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
                  {laCible && (
                    <p className="muted">
                      Opinion {laCible.opinion} · attachement {romanceDe(laCible).niveau}
                    </p>
                  )}
                </section>
              )}

              {/* Ce que ça va faire : les mêmes lignes chiffrées que sur le
                  plateau. Un joueur ne doit jamais avoir à traduire. */}
              <section className="inspector__block">
                <h3 className="section-title">Ce que ça donne</h3>
                <span className="act__lines act__lines--bloc">
                  {describeEffect(def.effects, laCible?.name ?? 'la personne').map((l, i) => (
                    <span key={i} className={`act__line act__line--${l.tone}`}>
                      {l.label}
                    </span>
                  ))}
                </span>
                {def.successChance !== undefined && (
                  <p className="muted">
                    {def.successChance + bonusMobilier(state, def.id)} % de réussite
                    {bonusMobilier(state, def.id) > 0 &&
                      ` (dont +${bonusMobilier(state, def.id)} de mobilier)`}
                    .
                  </p>
                )}
                {def.successChance === undefined && bonusMobilier(state, def.id) > 0 && (
                  <p className="muted">
                    Ton mobilier ajoute {bonusMobilier(state, def.id)} % d’intensité.
                  </p>
                )}
                {(() => {
                  const m = COINS.find((c) => c.id === coin)?.meuble;
                  const md = m ? getMeuble(m) : undefined;
                  if (!md || installes.includes(md.id)) return null;
                  return (
                    <p className="appart__manque">
                      Sans <b>{md.nom}</b>, tu fais ça comme tu peux.{' '}
                      <button className="lien" onClick={() => setPanneau('ameublement')}>
                        {euros(md.prix)} pour arranger ça
                      </button>
                    </p>
                  );
                })()}
              </section>

              <button
                className="btn btn--primary btn--faire"
                disabled={!!bloque}
                onClick={() => faire(def.id, def.cible === 'colleague' ? cibleId : undefined)}
              >
                {bloque ?? `${def.nom} · ${def.cout} action(s)`}
              </button>
            </>
          )}

          {/* Le bilan RESTE affiché. C'est tout l'objet du changement : on
              ne rate plus ce qu'on vient de faire. */}
          {resultat && (
            <section className={`bilan bilan--${resultat.ton}`}>
              <h3 className="section-title">Ce que ça a donné</h3>
              <p className="bilan__texte">{resultat.texte}</p>
              {resultat.lignes.length > 0 ? (
                <ul className="bilan__lignes">
                  {resultat.lignes.map((l, i) => (
                    <li key={i} className={`bilan__ligne bilan__ligne--${l.ton}`}>
                      {l.texte}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Rien de chiffrable n’a bougé.</p>
              )}
            </section>
          )}
          </div>
        </aside>
      </div>

      {/* ── La barre basse : mêmes panneaux ouvrables qu'au bureau ── */}
      <footer className="dock">
        <nav className="dock__onglets">
          {(
            [
              ['ameublement', 'Ameublement', 'canape'],
              ['logement', 'Déménager', 'cle'],
              ['parking', 'Parking', 'berline'],
              ['journal', 'Journal', 'plume'],
            ] as const
          ).map(([id, nom, ic]) => (
            <button
              key={id}
              className={`dock__bouton ${panneau === id ? 'is-on' : ''}`}
              onClick={() => setPanneau((p) => (p === id ? null : id))}
            >
              <span className="dock__glyphe">
                <Icone nom={ic} />
              </span>
              {nom}
              {id === 'ameublement' && (
                <span className="dock__pastille">
                  {installes.length}/{logement?.places ?? 0}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="conseil">
          <p className="conseil__texte">
            {state.weekendPointsRemaining === 0
              ? 'Ton week-end est fini. Lundi matin, en haut à droite.'
              : `Il te reste ${state.weekendPointsRemaining} chose(s) à faire de ces deux jours.`}
          </p>
        </div>
      </footer>

      {panneau && (
        <section className="panneau panneau--appart">
          <header className="panneau__tete">
            <h2>
              {panneau === 'ameublement'
                ? 'Ameublement'
                : panneau === 'logement'
                  ? 'Déménager'
                  : panneau === 'parking'
                    ? 'Parking'
                    : 'Journal'}
            </h2>
            <button className="btn btn--ghost" onClick={() => setPanneau(null)}>
              <Icone nom="croix" />
            </button>
          </header>
          <div className="panneau__corps">
            {panneau === 'ameublement' && (
              <>
                <p className="muted">
                  {installes.length} / {logement?.places ?? 0} place(s) occupée(s). Chaque
                  meuble améliore un coin précis de la pièce — et se voit dedans.
                </p>
                <div className="actlist actlist--tight">
                  {meubles.map((m) => {
                    const possede = installes.includes(m.id);
                    const plein = installes.length >= (logement?.places ?? 0);
                    const tropCher = state.argent < m.prix;
                    const coinDuMeuble = COINS.find((c) => c.meuble === m.id);
                    return (
                      <button
                        key={m.id}
                        className={`act ${possede ? 'act--possede' : ''}`}
                        disabled={!possede && (plein || tropCher)}
                        onClick={() =>
                          achat(() =>
                            possede ? store.performRevendreMeuble(m.id) : store.performAcheterMeuble(m.id),
                          )
                        }
                      >
                        <span className="act__icon">
                          <Icone nom={m.icone} />
                        </span>
                        <span className="act__body">
                          <span className="act__head">
                            <span className="act__label">{m.nom}</span>
                            {coinDuMeuble && <span className="act__chance">{coinDuMeuble.nom}</span>}
                          </span>
                          <span className="act__summary">
                            {possede
                              ? `Installé. Revendre en rend ${euros(Math.round(m.prix / 2))}.`
                              : plein
                                ? 'Plus de place ici — il faut déménager.'
                                : tropCher
                                  ? `Il te manque ${euros(m.prix - state.argent)}.`
                                  : m.description}
                          </span>
                          <span className="act__lines">
                            {Object.entries(m.bonus ?? {}).map(([k, v]) => (
                              <span key={k} className="act__line act__line--good">
                                +{v} % · {activites.find((a) => a.id === k)?.nom ?? k}
                              </span>
                            ))}
                            {Object.entries(m.hebdo?.stats ?? {}).map(([k, v]) => (
                              <span key={k} className="act__line act__line--good">
                                +{v} {LABELS[k] ?? k} par semaine
                              </span>
                            ))}
                            {m.hebdo?.suspicion !== undefined && (
                              <span className="act__line act__line--good">
                                {m.hebdo.suspicion} Suspicion par semaine
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="act__cost act__cost--euros">
                          {possede ? 'Revendre' : euros(m.prix)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {panneau === 'logement' && (
              <>
                {suivant ? (
                  <button
                    className="act"
                    disabled={state.argent < suivant.prix}
                    onClick={() => achat(() => store.performDemenager())}
                  >
                    <span className="act__icon">
                      <Icone nom="cle" />
                    </span>
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
                          {suivant.places} meubles · {suivant.pointsWeekend} choses par week-end
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
                        {a.prix === 0 ? 'départ' : euros(a.prix)} · loyer {euros(a.loyer)} ·{' '}
                        {a.pointsWeekend} actions
                      </em>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {panneau === 'parking' && (
              <Parking onResult={(r) => setResultat({ texte: r.text, ton: r.tone, lignes: [] })} />
            )}

            {panneau === 'journal' && (
              <ul className="messagerie">
                {state.log
                  .slice(-24)
                  .reverse()
                  .map((l, i) => (
                    <li key={i} className={`messagerie__ligne messagerie__ligne--${l.tone}`}>
                      <span className="messagerie__sem">S{l.week}</span> {l.text}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {poste && (
        <Ecran lieu="appart" onClose={() => setPoste(false)} onDossiers={() => faire('dossiers')} />
      )}

      {manuel && <Manual onClose={() => setManuel(false)} />}

      {tuto && (
        <Tutorial lieu="appart" selection={null} onSelect={() => {}} onClose={() => setTuto(false)} />
      )}
    </div>
  );
}
