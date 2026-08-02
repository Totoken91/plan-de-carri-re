// ─────────────────────────────────────────────────────────────
// ViePrivee.tsx — Les blocs de l'inspecteur qui ne parlent pas de travail :
// ce qui se passe entre toi et quelqu'un, ce que tu peux lui faire faire,
// et ce que tu peux acheter le concernant.
//
// Ils sont sortis de Inspector.tsx pour une raison simple : celui-ci
// décrivait déjà « qui est cette personne et comment lui nuire ». Y
// empiler trois systèmes de plus en aurait fait un fichier qu'on ne
// relit plus.
//
// Règle tenue ici comme ailleurs : aucun bouton muet. Un attachement
// s'affiche en chiffres, un ordre annonce son délai, une dépense annonce
// son prix ET la raison pour laquelle elle est grisée.
// ─────────────────────────────────────────────────────────────
import type { Colleague } from '@state/schema';
import { balance } from '@data/balance';
import { depenses } from '@data/vieprivee';
import { blocageDepense } from '@engine/vieprivee';
import { euros } from '@engine/argent';
import { conjointDe, romanceDe } from '@engine/romance';
import { ORDRES, peutEtreRattache, placesDeSubordonnes, subordonnesDe } from '@engine/subordonnes';
import { useGame } from './useGame';
import type { ActionResult } from '@engine/actions';
import { Icone } from './icones';

const R = balance.romance;

const LIBELLE_STATUT: Record<string, string> = {
  rien: 'Rien à signaler',
  flirt: 'Flirt',
  liaison: 'Liaison',
  couple: 'En couple',
  ex: 'Terminé',
};

/** La jauge d'attachement, avec ses trois paliers marqués. */
function JaugeAttachement({ niveau }: { niveau: number }) {
  return (
    <div className="attach">
      <div className="attach__track">
        <div className="attach__fill" style={{ width: `${niveau}%` }} />
        {[R.seuilFlirt, R.seuilLiaison, R.seuilCouple].map((s) => (
          <span key={s} className="attach__mark" style={{ left: `${s}%` }} />
        ))}
      </div>
      <span className="attach__num">{niveau}</span>
    </div>
  );
}

export function BlocRomance({
  c,
  onResult,
}: {
  c: Colleague;
  onResult: (r: ActionResult) => void;
}) {
  const { state, store } = useGame();
  const r = romanceDe(c);
  const conjoint = conjointDe(state);
  const bloque = state.status !== 'playing' || !!state.pendingEvent;
  const sansPA = bloque || state.actionPointsRemaining < 1;

  // Un « ex » ne se relance pas : afficher trois boutons morts serait
  // moins clair qu'une phrase.
  if (r.statut === 'ex') {
    return (
      <section className="inspector__block">
        <h3 className="section-title">Vie privée</h3>
        <p className="muted">Il y a eu quelque chose. Il n’y a plus rien.</p>
      </section>
    );
  }

  const prisAilleurs = conjoint && conjoint.id !== c.id;

  return (
    <section className="inspector__block">
      <h3 className="section-title">Vie privée</h3>

      <div className="romance__head">
        <span className={`romance__statut romance__statut--${r.statut}`}>
          {LIBELLE_STATUT[r.statut]}
          {r.connu && <em> · tout le monde sait</em>}
        </span>
      </div>
      <JaugeAttachement niveau={r.niveau} />
      <p className="muted romance__note">
        L’attachement n’est pas l’opinion. On peut plaire à quelqu’un qui ne vous
        estime pas — et l’inverse arrive tout autant.
      </p>

      <div className="actlist actlist--tight">
        <button
          className="act"
          disabled={sansPA || !!prisAilleurs}
          onClick={() => onResult(store.performDraguer(c.id))}
          title={prisAilleurs ? `Tu es avec ${conjoint!.name}.` : undefined}
        >
          <span className="act__icon"><Icone nom="bulle" /></span>
          <span className="act__body">
            <span className="act__head">
              <span className="act__label">Draguer</span>
            </span>
            <span className="act__summary">
              {prisAilleurs
                ? `Tu es officiellement avec ${conjoint!.name}.`
                : `+${R.draguerGain} attachement environ, majoré par l’Aura`}
            </span>
          </span>
          <span className="act__cost">1 PA</span>
        </button>

        <button
          className="act act--danger"
          disabled={sansPA || r.niveau < R.seuilLiaison}
          onClick={() => onResult(store.performToilettes(c.id))}
        >
          <span className="act__icon"><Icone nom="toilettes" /></span>
          <span className="act__body">
            <span className="act__head">
              <span className="act__label">Les toilettes du troisième</span>
              <span className="act__chance">
                {Math.round(Math.max(6, R.toilettesRisque - state.player.stats.combine * 0.35))}% de se
                faire prendre
              </span>
            </span>
            <span className="act__summary">
              {r.niveau < R.seuilLiaison
                ? `Il faut d’abord en arriver là (${r.niveau} / ${R.seuilLiaison})`
                : `+${R.toilettesGain} attachement, +${R.toilettesSuspicion} suspicion. Si ça se voit, tout l’étage le sait et les autres histoires tombent.`}
            </span>
          </span>
          <span className="act__cost">1 PA</span>
        </button>

        {r.statut !== 'couple' && (
          <button
            className="act"
            disabled={bloque || r.niveau < R.seuilCouple || !!conjoint}
            onClick={() => onResult(store.performOfficialiser(c.id))}
          >
            <span className="act__icon"><Icone nom="alliance" /></span>
            <span className="act__body">
              <span className="act__head">
                <span className="act__label">Officialiser</span>
              </span>
              <span className="act__summary">
                {conjoint
                  ? `Tu es déjà avec ${conjoint.name}.`
                  : r.niveau < R.seuilCouple
                    ? `Trop tôt (${r.niveau} / ${R.seuilCouple})`
                    : `Opinion plancher ${R.conjointOpinionPlancher}, +${R.conjointNerfs} nerfs par semaine. En échange, plus jamais de discrétion.`}
              </span>
            </span>
            <span className="act__cost">gratuit</span>
          </button>
        )}

        {r.statut !== 'rien' && (
          <button
            className="act act--danger"
            disabled={bloque}
            onClick={() => onResult(store.performRompre(c.id))}
          >
            <span className="act__icon"><Icone nom="ciseaux" /></span>
            <span className="act__body">
              <span className="act__head">
                <span className="act__label">Rompre</span>
              </span>
              <span className="act__summary">
                {r.connu
                  ? `Opinion ${R.rupture.opinion}, +${R.rupture.suspicion} suspicion, et l’étage en parle.`
                  : `Opinion ${R.rupture.opinion}. Personne ne saura que ça avait commencé.`}
              </span>
            </span>
            <span className="act__cost">gratuit</span>
          </button>
        )}
      </div>
    </section>
  );
}

// ── Périmètre : les gens qui te doivent des comptes ──────────
export function BlocSubordonne({
  c,
  onResult,
}: {
  c: Colleague;
  onResult: (r: ActionResult) => void;
}) {
  const { state, store } = useGame();
  const places = placesDeSubordonnes(state);
  const occupees = subordonnesDe(state).length;
  const bloque = state.status !== 'playing' || !!state.pendingEvent;

  if (places === 0) {
    return (
      <section className="inspector__block">
        <h3 className="section-title">Périmètre</h3>
        <p className="muted">
          À ton rang, tu n’encadres personne. Ça vient avec les promotions.
        </p>
      </section>
    );
  }

  if (!c.subordonne) {
    const possible = peutEtreRattache(state, c);
    return (
      <section className="inspector__block">
        <h3 className="section-title">
          Périmètre <em className="muted">{occupees} / {places}</em>
        </h3>
        <button
          className="btn btn--small"
          disabled={bloque || !possible || occupees >= places}
          onClick={() => onResult(store.performRattacher(c.id))}
        >
          Rattacher à mon équipe
        </button>
        {!possible && (
          <p className="muted">
            {c.name} n’est pas sous ta responsabilité — il faut être d’un rang
            strictement supérieur au sien.
          </p>
        )}
        {possible && occupees >= places && (
          <p className="muted">Ton périmètre est plein. Détache quelqu’un, ou monte.</p>
        )}
      </section>
    );
  }

  const cibles = state.colleagues.filter((x) => x.alive && x.id !== c.id);

  return (
    <section className="inspector__block">
      <h3 className="section-title">
        Dans ton équipe <em className="muted">{occupees} / {places}</em>
      </h3>

      {c.ordre ? (
        <p className="ordre__encours">
          En cours : <b>{ORDRES.find((o) => o.kind === c.ordre!.kind)?.nom}</b> ·{' '}
          {c.ordre.semaines} semaine(s)
        </p>
      ) : (
        <div className="ordres">
          {ORDRES.map((o) => (
            <div key={o.kind} className="ordre">
              <div className="ordre__head">
                <span className="ordre__icone"><Icone nom={o.icone} /></span>
                <b>{o.nom}</b>
                <em className="muted">{o.semaines} sem.</em>
              </div>
              <p className="ordre__desc muted">{o.description}</p>
              {o.cible ? (
                <select
                  className="ordre__cible"
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onResult(store.performOrdre(c.id, o.kind, e.target.value));
                    e.target.value = '';
                  }}
                  disabled={bloque}
                >
                  <option value="">Sur qui ?</option>
                  {cibles.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  className="btn btn--small"
                  disabled={bloque}
                  onClick={() => onResult(store.performOrdre(c.id, o.kind))}
                >
                  Ordonner
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="muted ordre__avert">
        Un subordonné obéit parce que tu notes son évaluation, pas parce qu’il
        t’aime. En dessous de {balance.subordonnes.trahisonSousOpinion} d’opinion,
        il fait quand même ce que tu demandes — puis il va le raconter.
      </p>

      <button
        className="btn btn--small btn--ghost"
        disabled={bloque}
        onClick={() => onResult(store.performDetacher(c.id))}
      >
        Détacher
      </button>
    </section>
  );
}

// ── Dépenses visant quelqu'un ────────────────────────────────
export function BlocDepenses({
  cible,
  lieu,
  onResult,
}: {
  /** Collègue visé, ou undefined pour les dépenses sans cible. */
  cible?: Colleague;
  lieu: 'bureau' | 'appart';
  onResult: (r: ActionResult) => void;
}) {
  const { state, store } = useGame();
  const liste = depenses.filter((d) => {
    if (d.lieu && d.lieu !== lieu) return false;
    return cible ? d.cible === 'colleague' : d.cible !== 'colleague';
  });
  if (liste.length === 0) return null;

  return (
    <section className="inspector__block">
      <h3 className="section-title">
        Ce que l’argent peut faire <em className="muted">{euros(state.argent)}</em>
      </h3>
      <div className="actlist actlist--tight">
        {liste.map((d) => {
          const raison = blocageDepense(state, d, cible?.id);
          return (
            <button
              key={d.id}
              className={`act ${d.successChance !== undefined ? 'act--danger' : ''}`}
              disabled={!!raison}
              onClick={() => onResult(store.performDepense(d.id, cible?.id))}
            >
              <span className="act__icon"><Icone nom={d.icone} /></span>
              <span className="act__body">
                <span className="act__head">
                  <span className="act__label">{d.nom}</span>
                  {d.successChance !== undefined && (
                    <span className="act__chance">{d.successChance}%</span>
                  )}
                </span>
                <span className="act__summary">{raison ?? d.description}</span>
              </span>
              <span className="act__cost act__cost--euros">{euros(d.prix)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Les toilettes, vues depuis le plateau ────────────────────
/**
 * Le lieu ne fait rien tout seul : il liste qui on peut y emmener.
 *
 * C'est le seul endroit du jeu où une zone propose une action VISANT
 * quelqu'un. Elle est donc rendue ici plutôt que dans le catalogue
 * d'actions d'un collègue : le joueur qui clique sur les toilettes se
 * demande « avec qui », pas « quoi faire ».
 */
export function BlocToilettes({ onResult }: { onResult: (r: ActionResult) => void }) {
  const { state, store } = useGame();
  const bloque =
    state.status !== 'playing' || state.actionPointsRemaining < 1 || !!state.pendingEvent;
  const risque = Math.round(Math.max(6, R.toilettesRisque - state.player.stats.combine * 0.35));

  const candidats = state.colleagues.filter(
    (c) => c.alive && romanceDe(c).niveau >= R.seuilLiaison && romanceDe(c).statut !== 'ex',
  );
  const amorces = state.colleagues.filter(
    (c) => c.alive && romanceDe(c).niveau > 0 && romanceDe(c).niveau < R.seuilLiaison,
  );

  return (
    <section className="inspector__block">
      <h3 className="section-title">Avec qui ?</h3>

      {candidats.length === 0 && (
        <p className="muted">
          Personne. Il faut au moins {R.seuilLiaison} d’attachement — c’est-à-dire
          une liaison, pas un flirt.
          {amorces.length > 0 && (
            <>
              {' '}
              Le plus avancé : <b>{amorces.sort((a, b) => romanceDe(b).niveau - romanceDe(a).niveau)[0]!.name}</b>{' '}
              ({romanceDe(amorces.sort((a, b) => romanceDe(b).niveau - romanceDe(a).niveau)[0]!).niveau}).
            </>
          )}
        </p>
      )}

      <div className="actlist actlist--tight">
        {candidats.map((c) => (
          <button
            key={c.id}
            className="act act--danger"
            disabled={bloque}
            onClick={() => onResult(store.performToilettes(c.id))}
          >
            <span className="act__icon"><Icone nom="toilettes" /></span>
            <span className="act__body">
              <span className="act__head">
                <span className="act__label">{c.name}</span>
                <span className="act__chance">{risque}% de se faire prendre</span>
              </span>
              <span className="act__summary">
                +{R.toilettesGain} attachement, +{R.toilettesSuspicion} suspicion. Si ça se
                voit : +{R.toilettesScandaleSuspicion} de plus, l’étage baisse de{' '}
                {Math.abs(R.toilettesScandaleOpinion)} d’opinion, et tes autres histoires
                s’arrêtent net.
              </span>
            </span>
            <span className="act__cost">1 PA</span>
          </button>
        ))}
      </div>

      <p className="muted romance__note">
        La Combine réduit le risque : {R.toilettesRisque} % de base, {risque} % au vu de
        la tienne.
      </p>
    </section>
  );
}
