import type { StatKey } from '@state/schema';
import { palierDe, palierSuivant } from '@engine/paliers';

export const STAT_LABELS: Record<StatKey, string> = {
  aura: 'Aura',
  rendement: 'Rendement',
  combine: 'Combine',
  nerfs: 'Nerfs',
};

/**
 * `palier` n'est vrai que pour le joueur. Sur la fiche d'un collègue on
 * affiche une valeur brute : les seuils nommés sont des OBJECTIFS, et on
 * ne donne pas d'objectifs à quelqu'un qu'on ne joue pas — ça ajouterait
 * quatre lignes de texte par collègue sans rien dire de plus.
 */
export function StatBar({
  stat,
  value,
  palier = false,
}: {
  stat: StatKey;
  value: number;
  palier?: boolean;
}) {
  const low = stat === 'nerfs' && value <= 25;
  const p = palier ? palierDe(value, stat) : undefined;
  const next = palier ? palierSuivant(value, stat) : undefined;
  return (
    <div className={`statbar ${palier ? 'statbar--palier' : ''}`}>
      <span className="statbar__label">{STAT_LABELS[stat]}</span>
      <span className="statbar__track">
        <span
          className={`statbar__fill statbar__fill--${stat} ${low ? 'is-low' : ''}`}
          style={{ width: `${value}%` }}
        />
        {/* Le seuil suivant, marqué sur la piste : on voit d'un coup
            d'œil s'il est à portée de la semaine ou hors de vue. */}
        {next && <span className="statbar__seuil" style={{ left: `${next.seuil}%` }} />}
      </span>
      <span className="statbar__value">{Math.round(value)}</span>
      {p && (
        <span className="statbar__palier" title={p.note}>
          <b>{p.nom}</b>
          {next ? (
            <em>
              {' '}
              — {next.seuil - Math.round(value)} avant {next.nom}
            </em>
          ) : (
            <em> — palier maximum</em>
          )}
        </span>
      )}
    </div>
  );
}

export function OpinionPip({ value }: { value: number }) {
  const tone = value >= 40 ? 'good' : value <= -40 ? 'bad' : value >= 0 ? 'neutral' : 'wary';
  const label =
    value >= 60 ? 'Allié' : value >= 20 ? 'Cordial' : value > -20 ? 'Neutre' : value > -60 ? 'Méfiant' : 'Hostile';
  return <span className={`pip pip--${tone}`}>{label} ({value > 0 ? '+' : ''}{value})</span>;
}

export function SuspicionGauge({ value, tier }: { value: number; tier: string }) {
  const danger = value >= 70 ? 'critique' : value >= 45 ? 'haute' : value >= 25 ? 'moyenne' : 'basse';
  return (
    <div className={`suspicion suspicion--${danger}`}>
      <div className="suspicion__head">
        <span>Suspicion</span>
        <span className="suspicion__tier">{tier}</span>
      </div>
      <div className="suspicion__track">
        <div className="suspicion__fill" style={{ width: `${value}%` }} />
        <div className="suspicion__threshold" style={{ left: '70%' }} title="Seuil d'audit" />
      </div>
      <div className="suspicion__value">{Math.round(value)} / 100</div>
    </div>
  );
}
