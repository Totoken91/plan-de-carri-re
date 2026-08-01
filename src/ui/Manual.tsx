// ─────────────────────────────────────────────────────────────
// Manual.tsx — Le règlement intérieur, consultable à tout moment.
//
// Le tuto guidé apprend les gestes ; ce document répond aux questions
// qu'on se pose trois semaines plus tard (« il fallait combien de
// réputation, déjà ? »). Tout ce qui est chiffré ici est lu dans les
// données, jamais recopié : un équilibrage qui change met le manuel à
// jour tout seul.
// ─────────────────────────────────────────────────────────────
import { catalog } from '@data/content';
import { balance } from '@data/balance';
import { MAX_DEFAUTS, TRAIT_BUDGET, defauts, qualites } from '@data/traits';

export function Manual({
  onClose,
  onReplay,
}: {
  onClose: () => void;
  /** Absent hors partie : sans plateau, il n'y a rien à rejouer. */
  onReplay?: () => void;
}) {
  const ranks = [...catalog.ranks].sort((a, b) => a.order - b.order);
  const ap = balance.actionPointsPerWeek;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manual" onClick={(e) => e.stopPropagation()}>
        <div className="event__tag">Document interne · diffusion restreinte</div>
        <header className="manual__head">
          <h2 className="manual__title">Règlement intérieur</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>

        <div className="manual__body">
          <section>
            <h3 className="section-title">Le but</h3>
            <p>
              Atteindre le grade de <b>{ranks[ranks.length - 1]?.name}</b>, puis tenir la position{' '}
              {balance.winSurviveWeeks} semaines sans se faire éjecter. Seule la{' '}
              <b>réputation</b> fait monter en grade.
            </p>
            <ul className="manual__ranks">
              {ranks.map((r) => (
                <li key={r.id}>
                  <span>{r.name}</span>
                  <em>{r.reputationRequired} réput.</em>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="section-title">Le tour</h3>
            <p>
              Une semaine = <b>{ap} points d’action</b>. Toute action coûte 1 PA. Répéter la même
              action dans la semaine rapporte de moins en moins (×0,6 à chaque répétition).
            </p>
            <p>
              Vendredi soir, tout se résout : tes plans avancent, les intentions des collègues
              tombent, les opportunités non saisies disparaissent, la suspicion évolue, et un
              événement peut t’imposer un choix. Le bilan détaille chaque ligne.
            </p>
          </section>

          <section>
            <h3 className="section-title">Les quatre chiffres</h3>
            <dl className="manual__dl">
              <dt>Aura</dt>
              <dd>On t’écoute. Améliore l’opinion qu’on a de toi et le poids de tes interventions.</dd>
              <dt>Rendement</dt>
              <dd>
                Tu produis. C’est lui qui transforme une semaine de travail en réputation (
                {balance.actions.bosser.reputation} de base par « Bosser »).
              </dd>
              <dt>Combine</dt>
              <dd>Tu manœuvres. Augmente la réussite des complots et la discrétion.</dd>
              <dt>Nerfs</dt>
              <dd>
                Ton carburant. « Bosser » en consomme {Math.abs(balance.actions.bosser.nerfs)},
                « Glander » en rend {balance.actions.glander.nerfs}. À zéro pendant{' '}
                {balance.burnoutGraceWeeks} semaines, c’est le burn-out et la partie s’arrête.
              </dd>
            </dl>
          </section>

          <section>
            <h3 className="section-title">Suspicion et audit</h3>
            <p>
              Chaque manœuvre laisse une trace. À <b>{balance.suspicionAuditThreshold}</b> de
              suspicion, un audit se déclenche. Il te faut alors un alibi ou un{' '}
              <b>bouc émissaire</b> — un dossier monté d’avance sur un innocent, valable{' '}
              {balance.scapegoat.staleWeeks} semaines. L’audit le consomme : la personne saute à ta
              place, l’étage t’en veut un peu, et ta suspicion retombe. Sans couverture, c’est toi
              qui pars.
            </p>
          </section>

          <section>
            <h3 className="section-title">Les intentions</h3>
            <p>
              La bulle au-dessus d’une tête dit ce que la personne fabrique cette semaine, et le
              chiffre dit dans combien de semaines ça tombe. Tu peux :
            </p>
            <ul className="manual__list">
              <li>
                <b>Désamorcer</b> une manœuvre qui te vise (1 PA, jet de dés).
              </li>
              <li>
                <b>Prévenir</b> la victime d’un coup monté entre collègues : elle te le rendra.
              </li>
              <li>
                <b>Alimenter</b> ce coup en douce : la victime tombe plus sûrement, ton nom
                n’apparaît pas — mais ta suspicion, si.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="section-title">Les secrets</h3>
            <p>
              « Fouiner » cherche ce qu’on te cache. Un secret trouvé s’utilise une fois :
              <b> chantage</b> (la personne t’obéit, discrètement) ou <b>divulgation</b> (tout
              l’étage l’apprend, elle est discréditée, ta suspicion monte).
            </p>
          </section>

          <section>
            <h3 className="section-title">Qui est qui</h3>
            <dl className="manual__dl">
              {catalog.archetypes.map((a) => (
                <div key={a.id} className="manual__pair">
                  <dt>{a.name}</dt>
                  <dd>{a.description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="section-title">Traits</h3>
            <p>
              À l’embauche, tu places exactement <b>{TRAIT_BUDGET} points</b> : les qualités en
              coûtent, les défauts en rendent, et tu ne peux pas prendre plus de {MAX_DEFAUTS}{' '}
              défauts. Un trait ne se change plus ensuite.
            </p>
            <dl className="manual__dl">
              {[...qualites, ...defauts].map((t) => (
                <div key={t.id} className="manual__pair">
                  <dt>
                    {t.nom} <em className="manual__cout">{t.cout > 0 ? `−${t.cout}` : `+${-t.cout}`}</em>
                  </dt>
                  <dd>{t.detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="section-title">Le plateau</h3>
            <ul className="manual__list">
              <li>Molette (ou pincement) : zoomer.</li>
              <li>Glisser : déplacer la vue.</li>
              <li>Double-clic, ou « Recadrer » : revenir à la vue d’ensemble.</li>
              <li>Clic sur un personnage, une zone ou une balise dorée : ouvrir sa fiche.</li>
            </ul>
          </section>
        </div>

        <footer className="manual__foot">
          {onReplay ? (
            <button className="btn btn--small" onClick={onReplay}>
              Refaire le tutoriel guidé
            </button>
          ) : (
            <span />
          )}
          <button className="btn btn--small btn--primary" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
