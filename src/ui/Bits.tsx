import type { StatKey } from '@state/schema';

export const STAT_LABELS: Record<StatKey, string> = {
  aura: 'Aura',
  rendement: 'Rendement',
  combine: 'Combine',
  nerfs: 'Nerfs',
};

export function StatBar({ stat, value }: { stat: StatKey; value: number }) {
  const low = stat === 'nerfs' && value <= 25;
  return (
    <div className="statbar">
      <span className="statbar__label">{STAT_LABELS[stat]}</span>
      <span className="statbar__track">
        <span
          className={`statbar__fill statbar__fill--${stat} ${low ? 'is-low' : ''}`}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="statbar__value">{Math.round(value)}</span>
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
