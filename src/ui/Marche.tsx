// ─────────────────────────────────────────────────────────────
// Marche.tsx — La bourse et le casino, dans le même panneau parce qu'ils
// répondent à la même question : « j'ai de l'argent, qu'est-ce que j'en
// fais ? » — avec deux réponses opposées.
//
// Le panneau assume de dire au joueur ce qu'un vrai casino lui cache :
// l'espérance de chaque table est affichée en clair, et elle est négative
// partout. Ce n'est pas de la pédagogie, c'est de la lisibilité de jeu —
// une table dont on ne peut pas évaluer le prix n'est pas un choix, c'est
// un bouton.
//
// Même panneau au bureau et à la maison, à une différence près, qui est
// justement l'intérêt de la chose : jouer depuis son poste fait monter la
// suspicion, gagné ou perdu.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { ActionResult } from '@engine/actions';
import { casino, titres } from '@data/vieprivee';
import { coursDe, esperance, valeurPortefeuille } from '@engine/marche';
import { euros } from '@engine/argent';
import { useGame } from './useGame';

/**
 * L'historique n'est pas stocké : on ne garde que le cours courant, et le
 * cours de base sert de référence. Afficher une courbe fabriquée à partir
 * de rien serait un joli mensonge — la variation depuis l'origine, elle,
 * est vraie.
 */
function Variation({ courant, base }: { courant: number; base: number }) {
  const pct = ((courant - base) / base) * 100;
  const signe = pct >= 0 ? '+' : '';
  return (
    <span className={`titre__var titre__var--${pct >= 0 ? 'haut' : 'bas'}`}>
      {signe}
      {pct.toFixed(1)} %
    </span>
  );
}

export function Marche({ onResult }: { onResult: (r: ActionResult) => void }) {
  const { state, store } = useGame();
  const [lots, setLots] = useState<Record<string, number>>({});
  const [multiple, setMultiple] = useState(1);
  const auBureau = state.phase === 'bureau';

  const qte = (id: string) => lots[id] ?? 1;
  const setQte = (id: string, n: number) => setLots((l) => ({ ...l, [id]: Math.max(1, n) }));

  const valeur = valeurPortefeuille(state);

  return (
    <>
      <section className="sheet inspector__block">
        <h3 className="section-title">
          Portefeuille <em className="muted">{euros(state.argent)} en liquide</em>
        </h3>
        <p className="muted">
          Titres détenus : <b>{euros(valeur)}</b>. Les cours bougent chaque vendredi,
          après la paie.
        </p>

        <ul className="titres">
          {titres.map((t) => {
            const cours = coursDe(state, t.id);
            const detenu = state.portefeuille[t.id] ?? 0;
            const n = qte(t.id);
            return (
              <li key={t.id} className="titre">
                <div className="titre__head">
                  <span className="titre__pastille" style={{ background: t.couleur }} />
                  <b className="titre__nom">{t.nom}</b>
                  <span className="titre__sym">{t.symbole}</span>
                  <span className="titre__cours">{euros(cours)}</span>
                  <Variation courant={cours} base={t.base} />
                </div>
                <div className="titre__ligne muted">
                  volatilité {(t.volatilite * 100).toFixed(0)} % ·{' '}
                  {detenu > 0 ? `${detenu} détenu(s), ${euros(detenu * cours)}` : 'aucun titre'}
                </div>
                <div className="titre__ordres">
                  <input
                    className="titre__qte"
                    type="number"
                    min={1}
                    value={n}
                    onChange={(e) => setQte(t.id, Number(e.target.value))}
                    aria-label={`Quantité ${t.symbole}`}
                  />
                  <button
                    className="btn btn--small"
                    disabled={state.argent < cours * n}
                    onClick={() => onResult(store.performAcheterTitre(t.id, n))}
                  >
                    Acheter · {euros(cours * n)}
                  </button>
                  <button
                    className="btn btn--small"
                    disabled={detenu < n}
                    onClick={() => onResult(store.performVendreTitre(t.id, n))}
                  >
                    Vendre
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sheet inspector__block">
        <h3 className="section-title">Casino en ligne</h3>
        <p className="muted">
          {auBureau
            ? 'Tu joues depuis ton poste. Chaque mise fait monter la suspicion, que tu gagnes ou non.'
            : 'Chez toi, personne ne regarde ton écran.'}
        </p>

        <div className="mise">
          <span className="field__label">Mise</span>
          {[1, 2, 5, 10].map((m) => (
            <button
              key={m}
              className={`chip ${multiple === m ? 'is-on' : ''}`}
              onClick={() => setMultiple(m)}
            >
              ×{m}
            </button>
          ))}
        </div>

        <div className="actlist actlist--tight">
          {casino.map((j) => {
            const mise = j.mise * multiple;
            return (
              <button
                key={j.id}
                className="act act--danger"
                disabled={state.argent < mise}
                onClick={() => onResult(store.performMiser(j.id, multiple))}
              >
                <span className="act__icon">{j.icone}</span>
                <span className="act__body">
                  <span className="act__head">
                    <span className="act__label">{j.nom}</span>
                    <span className="act__chance">{j.chance}%</span>
                  </span>
                  <span className="act__summary">{j.description}</span>
                  <span className="act__lines">
                    <span className="act__line act__line--good">
                      gain ×{j.gain} — {euros(mise * j.gain)}
                    </span>
                    <span className="act__line act__line--bad">
                      espérance {esperance(j.id)} %{auBureau ? ` · +${j.suspicionAuBureau} suspicion` : ''}
                    </span>
                  </span>
                </span>
                <span className="act__cost act__cost--euros">{euros(mise)}</span>
              </button>
            );
          })}
        </div>

        <p className="muted">
          Les quatre tables ont une espérance négative. Le casino ne sert pas à
          s’enrichir : il sert à transformer un petit capital en une petite chance
          d’un gros capital, tout de suite.
        </p>
      </section>
    </>
  );
}
