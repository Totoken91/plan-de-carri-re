// ─────────────────────────────────────────────────────────────
// Inspector.tsx — Le panneau contextuel : « qui/quoi est sélectionné,
// qu'est-ce que je peux en faire, et ça me coûte quoi ».
//
// Principe : AUCUN bouton d'action n'est muet. Chaque action affiche
// ses deltas chiffrés et, s'il y a un jet, sa probabilité — avant le
// clic. Les nombres viennent de @engine/preview, qui relit la même
// arithmétique que le moteur.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import type { ActionOption } from '@engine/preview';
import type { ActionResult } from '@engine/actions';
import { colleagueActions, describeEffect, previewBosser, previewGlander } from '@engine/preview';
import { STAT_KEYS } from '@engine/util';
import { getOpportunity } from '@data/content';
import { useGame } from './useGame';
import { StatBar, OpinionPip } from './Bits';
import { archetypeName, planViews } from './selectors';
import { BlocDepenses, BlocRomance, BlocSubordonne, BlocToilettes } from './ViePrivee';
import { zoneById, type Selection, type ZoneId } from './iso';
import { Icone } from './icones';

const ZONE_TEXT: Record<ZoneId, string> = {
  manager:
    'C’est ici que se décident les promotions. Le Fayot y passe tous les vendredis soir, sans qu’on l’ait invité.',
  cafe: 'Le vrai centre de pouvoir de l’étage. Tout ce qui se sait dans cette boîte est passé par cette machine.',
  meeting: 'Là où les projets changent discrètement de propriétaire, entre deux points d’avancement.',
  archive: 'Papier, imprimante, et tout ce que les gens y oublient. Un fouineur patient y trouve son bonheur.',
  player: 'Ton poste. La voie propre : produire, se rendre indispensable, monter sans faire de vagues.',
  detente: 'Canapé, plante verte, silence. Le seul endroit où tes Nerfs remontent.',
  toilettes:
    'Deux cabines, un sèche-mains bruyant, et la seule porte de l’étage qui ferme. Ce n’est pas un hasard si tout le monde sait ce qui s’y passe.',
};

// ── Bouton d'action auto-documenté ───────────────────────────
function ActionButton({
  opt,
  blocked,
  onRun,
}: {
  opt: ActionOption;
  blocked: boolean;
  onRun: () => void;
}) {
  const disabled = blocked || !opt.available;
  return (
    <button
      className={`act ${opt.danger ? 'act--danger' : ''}`}
      disabled={disabled}
      onClick={onRun}
      title={opt.reason ?? opt.summary}
    >
      <span className="act__icon"><Icone nom={opt.icon} /></span>
      <span className="act__body">
        <span className="act__head">
          <span className="act__label">{opt.label}</span>
          {opt.chance !== undefined && <span className="act__chance">{opt.chance}%</span>}
        </span>
        <span className="act__summary">{opt.reason ?? opt.summary}</span>
        {opt.available && opt.lines.length > 0 && (
          <span className="act__lines">
            {opt.lines.map((l, i) => (
              <span key={i} className={`act__line act__line--${l.tone}`}>
                {l.label}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="act__cost">{opt.cost} PA</span>
    </button>
  );
}

// ── Les onglets de la fiche d'un collègue ────────────────────
/**
 * Pourquoi découper.
 *
 * Tout était empilé : identité, opinion, intention, quatre jauges,
 * actions, secrets, romance, encadrement, dépenses, et six plans. Mesuré
 * sur un collègue ordinaire, ça faisait plus de deux écrans et demi dans
 * un tiroir large de 380 px — donc on ne trouvait rien sans faire défiler
 * en aveugle, et surtout on ne savait jamais ce qu'on n'avait pas vu.
 *
 * Quatre onglets, et le choix des groupes n'est pas cosmétique : il
 * répond à quatre QUESTIONS différentes qu'on se pose devant quelqu'un.
 *   · Qui est-ce, et qu'est-ce qu'il prépare ?   → Fiche
 *   · Qu'est-ce que je fais de mon temps ?       → Agir
 *   · Comment je le fais tomber ?                → Manœuvres
 *   · Qu'est-ce qu'on est l'un pour l'autre ?    → Lien
 */
type Onglet = 'fiche' | 'agir' | 'manoeuvres' | 'lien';

const ONGLETS: Array<{ id: Onglet; nom: string; icone: string }> = [
  { id: 'agir', nom: 'Agir', icone: 'mallette' },
  { id: 'manoeuvres', nom: 'Manœuvres', icone: 'cible' },
  { id: 'lien', nom: 'Lien', icone: 'rapprochement' },
  { id: 'fiche', nom: 'Fiche', icone: 'personne' },
];

// ── Vues par type de sélection ───────────────────────────────
// Rien de sélectionné : trois rappels, pas un cours. Le reste est dans
// le règlement intérieur, sous le bouton « ? ».
function EmptyView() {
  return (
    <div className="inspector__empty">
      <h3 className="section-title">Rien de sélectionné</h3>
      <ol className="howto">
        <li>
          <b>Clique sur un collègue</b> pour voir ce qu’il prépare et ce que tu peux lui faire.
        </li>
        <li>
          <b>Les bulles au-dessus des têtes</b> sont leurs intentions. Une bulle rouge te vise —
          le chiffre est le nombre de semaines avant qu’elle ne tombe.
        </li>
        <li>
          <b>Les balises dorées</b> sont les opportunités de la semaine. Elles disparaissent
          vendredi.
        </li>
      </ol>
      <p className="inspector__helpnote">
        Règles complètes et tutoriel : bouton <b>?</b>, en haut à droite.
      </p>
    </div>
  );
}

export function Inspector({
  selection,
  onSelect,
  onResult,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
  onResult: (r: { text: string; tone: 'good' | 'bad' | 'neutral' }) => void;
}) {
  const { state, store } = useGame();
  const [onglet, setOnglet] = useState<Onglet>('agir');
  const cible = selection?.kind === 'colleague' ? selection.id : null;
  // Changer de personne remet la fiche au début : rester sur « Manœuvres »
  // en passant à quelqu'un d'autre donne l'impression d'un menu qui a
  // gardé une intention qu'on n'a pas eue.
  useEffect(() => setOnglet('agir'), [cible]);

  const blocked =
    state.status !== 'playing' || state.actionPointsRemaining < 1 || !!state.pendingEvent;

  const run = (r: ActionResult) => {
    onResult(r);
  };

  if (!selection) {
    return (
      <aside className="inspector">
        <EmptyView />
      </aside>
    );
  }

  // ── Un collègue ────────────────────────────────────────────
  if (selection.kind === 'colleague') {
    const c = state.colleagues.find((x) => x.id === selection.id);
    if (!c) return <aside className="inspector" />;
    const actions = colleagueActions(state, c);
    const plans = planViews(state, c.id);

    return (
      <aside className="inspector">
        <header className="inspector__head">
          <div>
            <h2 className="inspector__title">{c.name}</h2>
            <p className="inspector__sub">
              {archetypeName(c.archetype)}
              {c.flags.includes('sous_emprise') && (
              <span className="tag tag--hold">
                <Icone nom="chaine" /> sous emprise
              </span>
            )}
              {c.flags.includes('discredite') && (
                <span className="tag tag--bad"> réputation entamée</span>
              )}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={() => onSelect(null)}>
            <Icone nom="croix" />
          </button>
        </header>

        {c.flags.includes('discredite') && (
          <span className="stampmark stampmark--file" aria-hidden="true">
            Mis en cause
          </span>
        )}

        <nav className="fiches" role="tablist">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={onglet === o.id}
              className={`fiches__onglet ${onglet === o.id ? 'is-on' : ''}`}
              onClick={() => setOnglet(o.id)}
            >
              <Icone nom={o.icone} />
              {o.nom}
              {o.id === 'agir' && actions.filter((a) => a.available).length > 0 && (
                <span className="fiches__compte">{actions.filter((a) => a.available).length}</span>
              )}
              {o.id === 'manoeuvres' && plans.filter((p) => p.canStart || p.inProgress).length > 0 && (
                <span className="fiches__compte">
                  {plans.filter((p) => p.canStart || p.inProgress).length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Hors onglets : l'opinion et ce qu'il prépare. Ce sont les deux
            choses dont on a besoin QUOI QU'ON VIENNE FAIRE — les cacher
            derrière un onglet obligerait à faire l'aller-retour avant
            chaque décision. */}
        <OpinionPip value={c.opinion} />

        {c.intent && c.intent.kind !== 'idle' && (
          <div className={`intentcard intentcard--${c.intent.tone} intentcard--${c.intent.kind}`}>
            <span className="intentcard__icon"><Icone nom={c.intent.icon} /></span>
            <div>
              <div className="intentcard__label">
                {c.intent.label}
                {c.intent.weeksLeft > 1 && (
                  <em> · tombe dans {c.intent.weeksLeft} semaines</em>
                )}
                {c.intent.weeksLeft <= 1 && <em> · se résout vendredi</em>}
              </div>
              <div className="intentcard__detail">{c.intent.detail}</div>
            </div>
          </div>
        )}

        {onglet === 'fiche' && (
        <>
        <div className="inspector__stats">
          {STAT_KEYS.map((k) => (
            <StatBar key={k} stat={k} value={c.stats[k]} />
          ))}
        </div>

        <section className="inspector__block">
          <h3 className="section-title">Secrets</h3>
          {c.secrets.length === 0 && <p className="muted">Aucun secret connu.</p>}
          <ul className="secrets">
            {c.secrets.map((s) => (
              <li
                key={s.id}
                className={
                  !s.discovered
                    ? 'secret secret--hidden'
                    : s.spent
                      ? 'secret secret--spent'
                      : 'secret secret--known'
                }
              >
                {s.discovered
                  ? `« ${s.label} »${s.spent ? ' (levier utilisé)' : ''}`
                  : '??? — à découvrir en fouinant'}
              </li>
            ))}
          </ul>
        </section>
        </>
        )}

        {onglet === 'agir' && (
          <section className="inspector__block">
            <div className="actlist">
              {actions.map((opt) => (
                <ActionButton
                  key={opt.key}
                  opt={opt}
                  blocked={blocked}
                  onRun={() => run(store.perform(opt.id))}
                />
              ))}
            </div>
          </section>
        )}

        {onglet === 'lien' && (
          <>
            <BlocRomance c={c} onResult={run} />
            <BlocSubordonne c={c} onResult={run} />
          </>
        )}

        {onglet === 'manoeuvres' && (
        <>
        <BlocDepenses cible={c} lieu="bureau" onResult={run} />

        <section className="inspector__block">
          <h3 className="section-title">Comploter contre {c.name.split(' ')[0]}</h3>
          <ul className="plans">
            {plans.map((pv) => (
              <li key={pv.def.id} className="plan">
                <div className="plan__head">
                  <span className="plan__name">{pv.def.name}</span>
                  <span className="plan__chance">{pv.chance}%</span>
                </div>
                <p className="plan__desc muted">{pv.def.description}</p>
                <div className="plan__foot">
                  {pv.inProgress ? (
                    <span className="plan__prep">
                      Préparation {pv.preparation}/100 · {pv.def.durationWeeks} sem.
                    </span>
                  ) : pv.lockReason ? (
                    <span className="plan__prep plan__prep--locked">{pv.lockReason}</span>
                  ) : (
                    <span className="plan__prep muted">
                      Suspicion +{pv.def.suspicionOnSuccess} si réussi / +
                      {pv.def.suspicionOnFailure} si raté
                    </span>
                  )}
                  <button
                    className="btn btn--small"
                    disabled={blocked || (!pv.inProgress && !pv.canStart)}
                    onClick={() =>
                      run(store.performAction('comploter', { planId: pv.def.id, targetId: c.id }))
                    }
                    title={pv.lockReason ?? ''}
                  >
                    {pv.inProgress ? 'Avancer' : 'Lancer'} <span className="cost">1 PA</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        </>
        )}
      </aside>
    );
  }

  // ── Une zone du plateau ────────────────────────────────────
  if (selection.kind === 'zone') {
    const zone = zoneById(selection.id);
    const opt: ActionOption | null =
      zone.action === 'bosser'
        ? previewBosser(state)
        : zone.action === 'glander'
          ? previewGlander(state)
          : null;

    return (
      <aside className="inspector">
        <header className="inspector__head">
          <h2 className="inspector__title">{zone.label}</h2>
          <button className="btn btn--ghost" onClick={() => onSelect(null)}>
            <Icone nom="croix" />
          </button>
        </header>
        <p className="inspector__flavor">{ZONE_TEXT[zone.id]}</p>
        {zone.id === 'toilettes' && <BlocToilettes onResult={run} />}
        {opt ? (
          <div className="actlist">
            <ActionButton opt={opt} blocked={blocked} onRun={() => run(store.perform(opt.id))} />
          </div>
        ) : zone.id === 'toilettes' ? null : (
          <p className="muted">Rien à y faire directement — mais il s’y passe des choses.</p>
        )}
      </aside>
    );
  }

  // ── Une opportunité de la semaine ──────────────────────────
  const active = state.opportunities[selection.index];
  const def = active ? getOpportunity(active.defId) : undefined;
  if (!active || !def) {
    return (
      <aside className="inspector">
        <p className="muted">Cette opportunité n’est plus disponible.</p>
      </aside>
    );
  }
  const target = state.colleagues.find((c) => c.id === active.targetId);
  const targetName = target?.name ?? 'un collègue';
  const cost = def.cost ?? 1;

  return (
    <aside className="inspector">
      <header className="inspector__head">
        <div>
          <span className="inspector__tag">Opportunité · expire vendredi</span>
          <h2 className="inspector__title">
            <><Icone nom={def.icon} /> {def.title}</>
          </h2>
          {target && <p className="inspector__sub">Concerne {target.name}</p>}
        </div>
        <button className="btn btn--ghost" onClick={() => onSelect(null)}>
          <Icone nom="croix" />
        </button>
      </header>

      <p className="inspector__flavor">{def.description.replace('{target}', targetName)}</p>

      <div className="actlist">
        <ActionButton
          opt={{
            key: 'opp',
            id: { kind: 'bosser' }, // non utilisé : on passe par performOpportunity
            label: 'Saisir',
            icon: def.icon,
            cost,
            available: true,
            summary: def.successChance !== undefined ? 'Issue incertaine.' : 'Effet garanti.',
            chance: def.successChance,
            lines: describeEffect(def.effects, targetName),
          }}
          blocked={state.status !== 'playing' || !!state.pendingEvent || state.actionPointsRemaining < cost}
          onRun={() => {
            run(store.performOpportunity(selection.index));
            onSelect(null); // les index glissent après consommation
          }}
        />
      </div>

      {def.failureEffects && (
        <div className="oppfail">
          <h3 className="section-title">Si ça tourne mal</h3>
          <span className="act__lines">
            {describeEffect(def.failureEffects, targetName).map((l, i) => (
              <span key={i} className={`act__line act__line--${l.tone}`}>
                {l.label}
              </span>
            ))}
          </span>
        </div>
      )}
    </aside>
  );
}
