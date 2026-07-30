// ─────────────────────────────────────────────────────────────
// Inspector.tsx — Le panneau contextuel : « qui/quoi est sélectionné,
// qu'est-ce que je peux en faire, et ça me coûte quoi ».
//
// Principe : AUCUN bouton d'action n'est muet. Chaque action affiche
// ses deltas chiffrés et, s'il y a un jet, sa probabilité — avant le
// clic. Les nombres viennent de @engine/preview, qui relit la même
// arithmétique que le moteur.
// ─────────────────────────────────────────────────────────────
import type { ActionOption } from '@engine/preview';
import type { ActionResult } from '@engine/actions';
import { colleagueActions, describeEffect, previewBosser, previewGlander } from '@engine/preview';
import { STAT_KEYS } from '@engine/util';
import { getOpportunity } from '@data/content';
import { useGame } from './useGame';
import { StatBar, OpinionPip } from './Bits';
import { archetypeName, planViews } from './selectors';
import { zoneById, type Selection, type ZoneId } from './iso';

const ZONE_TEXT: Record<ZoneId, string> = {
  manager:
    'C’est ici que se décident les promotions. Le Fayot y passe tous les vendredis soir, sans qu’on l’ait invité.',
  cafe: 'Le vrai centre de pouvoir de l’étage. Tout ce qui se sait dans cette boîte est passé par cette machine.',
  meeting: 'Là où les projets changent discrètement de propriétaire, entre deux points d’avancement.',
  archive: 'Papier, imprimante, et tout ce que les gens y oublient. Un fouineur patient y trouve son bonheur.',
  player: 'Ton poste. La voie propre : produire, se rendre indispensable, monter sans faire de vagues.',
  detente: 'Canapé, plante verte, silence. Le seul endroit où tes Nerfs remontent.',
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
      <span className="act__icon">{opt.icon}</span>
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

// ── Vues par type de sélection ───────────────────────────────
function EmptyView() {
  return (
    <div className="inspector__empty">
      <h3 className="section-title">Comment on joue</h3>
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
        <li>
          Tu as <b>5 points d’action</b> par semaine. Chaque bouton annonce son effet exact avant
          que tu cliques.
        </li>
      </ol>
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
              {c.flags.includes('sous_emprise') && <span className="tag tag--hold"> ⛓️ sous emprise</span>}
              {c.flags.includes('discredite') && (
                <span className="tag tag--bad"> réputation entamée</span>
              )}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={() => onSelect(null)}>
            ✕
          </button>
        </header>

        {c.flags.includes('discredite') && (
          <span className="stampmark stampmark--file" aria-hidden="true">
            Mis en cause
          </span>
        )}

        <OpinionPip value={c.opinion} />

        {c.intent && c.intent.kind !== 'idle' && (
          <div className={`intentcard intentcard--${c.intent.tone} intentcard--${c.intent.kind}`}>
            <span className="intentcard__icon">{c.intent.icon}</span>
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

        <div className="inspector__stats">
          {STAT_KEYS.map((k) => (
            <StatBar key={k} stat={k} value={c.stats[k]} />
          ))}
        </div>

        <section className="inspector__block">
          <h3 className="section-title">Actions</h3>
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
                    title={
                      !pv.canStart && !pv.inProgress
                        ? 'Conditions non remplies (rang, secret, Combine…)'
                        : ''
                    }
                  >
                    {pv.inProgress ? 'Avancer' : 'Lancer'} <span className="cost">1 PA</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
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
            ✕
          </button>
        </header>
        <p className="inspector__flavor">{ZONE_TEXT[zone.id]}</p>
        {opt ? (
          <div className="actlist">
            <ActionButton opt={opt} blocked={blocked} onRun={() => run(store.perform(opt.id))} />
          </div>
        ) : (
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
            {def.icon} {def.title}
          </h2>
          {target && <p className="inspector__sub">Concerne {target.name}</p>}
        </div>
        <button className="btn btn--ghost" onClick={() => onSelect(null)}>
          ✕
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
