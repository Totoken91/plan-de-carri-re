// ─────────────────────────────────────────────────────────────
// Parking.tsx — Ce qu'on gare devant l'immeuble.
//
// C'est le seul écran d'achat du jeu qui touche une statistique, donc le
// seul où il faut être parfaitement clair sur DEUX chiffres : le bonus
// d'Aura, qui est acquis une fois, et l'entretien, qui tombe chaque
// vendredi jusqu'à la revente. Le second est celui qui ruine les gens.
// ─────────────────────────────────────────────────────────────
import type { ActionResult } from '@engine/actions';
import { VOITURES, voitureDe } from '@engine/voitures';
import { euros, salaireDe } from '@engine/argent';
import { useGame } from './useGame';

export function Parking({ onResult }: { onResult: (r: ActionResult) => void }) {
  const { state, store } = useGame();
  const actuelle = voitureDe(state);
  const reprise = actuelle ? Math.round(actuelle.prix / 2) : 0;
  const salaire = salaireDe(state);

  return (
    <>
      <section className="sheet inspector__block">
        <h3 className="section-title">Ta place de parking</h3>
        {actuelle ? (
          <>
            <p className="parking__actuelle">
              <span className="parking__icone">{actuelle.icone}</span>
              <b>{actuelle.nom}</b> <em className="muted">{actuelle.marque}</em>
            </p>
            <p className="muted">{actuelle.description}</p>
            <p className="muted">
              +{actuelle.aura} d’Aura acquis · entretien <b>{euros(actuelle.entretien)}</b> par
              semaine
              {actuelle.entretien > salaire * 0.5 && (
                <span className="parking__alerte">
                  {' '}
                  — soit {Math.round((actuelle.entretien / salaire) * 100)} % de ton salaire
                </span>
              )}
            </p>
            <button className="btn btn--small" onClick={() => onResult(store.performRevendreVoiture())}>
              Revendre pour {euros(reprise)} (et perdre {actuelle.aura} d’Aura)
            </button>
          </>
        ) : (
          <p className="muted">
            Tu prends les transports. Personne ne sait ce que tu gagnes, et c’est
            exactement le problème.
          </p>
        )}
      </section>

      <section className="sheet inspector__block">
        <h3 className="section-title">Concession</h3>
        <div className="actlist actlist--tight">
          {VOITURES.map((v) => {
            const possede = actuelle?.id === v.id;
            const aPayer = Math.max(0, v.prix - reprise);
            const tropCher = state.argent < aPayer;
            const gain = v.aura - (actuelle?.aura ?? 0);
            return (
              <button
                key={v.id}
                className={`act ${possede ? 'act--possede' : ''} voiture voiture--${v.classe}`}
                disabled={possede || tropCher}
                onClick={() => onResult(store.performAcheterVoiture(v.id))}
              >
                <span className="act__icon">{v.icone}</span>
                <span className="act__body">
                  <span className="act__head">
                    <span className="act__label">{v.nom}</span>
                    <span className="act__chance">{v.marque}</span>
                  </span>
                  <span className="act__summary">
                    {possede
                      ? 'C’est celle que tu as.'
                      : tropCher
                        ? `Il te manque ${euros(aPayer - state.argent)}.`
                        : v.description}
                  </span>
                  <span className="act__lines">
                    <span className={`act__line act__line--${gain >= 0 ? 'good' : 'bad'}`}>
                      {gain >= 0 ? '+' : ''}
                      {gain} Aura
                    </span>
                    <span className="act__line act__line--bad">
                      entretien {euros(v.entretien)} / semaine
                    </span>
                  </span>
                </span>
                <span className="act__cost act__cost--euros">{euros(aPayer)}</span>
              </button>
            );
          })}
        </div>
        <p className="muted">
          Le bonus d’Aura est acquis au changement de véhicule ; l’entretien, lui,
          tombe tous les vendredis. C’est le second qui ruine les gens.
        </p>
      </section>
    </>
  );
}
