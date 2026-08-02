// ─────────────────────────────────────────────────────────────
// Marche.tsx — La bourse et le casino, deux applications du poste.
//
// Elles sont séparées en deux composants parce qu'elles vivent dans deux
// fenêtres distinctes de l'écran, et parce qu'elles répondent à la même
// question avec deux réponses opposées : la bourse a une dérive positive
// et prend de la liquidité ; le casino a une espérance négative, écrite
// en clair sur chaque table.
//
// Cette dernière décision mérite d'être défendue : un vrai casino cache
// son espérance. La cacher ici aurait fait de chaque table un bouton
// plutôt qu'un choix — on ne peut pas décider entre deux options dont on
// ne connaît pas le prix. Le jeu affiche donc ce que le monde réel tait.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { ActionResult } from '@engine/actions';
import { casino, titres } from '@data/vieprivee';
import { coursDe, esperance, plusValue, serieDe, valeurPortefeuille } from '@engine/marche';
import { euros } from '@engine/argent';
import { useGame } from './useGame';
import { CourbeMarche, Trace } from './Courbe';
import { Icone } from './icones';

/**
 * Variation depuis l'ouverture. On ne stocke que la fenêtre glissante
 * des cours, donc « depuis l'ouverture » veut dire depuis le premier
 * point encore conservé — et c'est exactement la même origine que celle
 * du graphe indexé, ce qui évite deux vérités pour un même écran.
 */
function Variation({ serie }: { serie: number[] }) {
  const base = serie[0];
  const fin = serie[serie.length - 1];
  if (!base || fin === undefined) return null;
  const pct = ((fin - base) / base) * 100;
  return (
    <span className={`titre__var titre__var--${pct >= 0 ? 'haut' : 'bas'}`}>
      {pct >= 0 ? '+' : ''}
      {pct.toFixed(1)} %
    </span>
  );
}

export function Bourse({ onResult }: { onResult: (r: ActionResult) => void }) {
  const { state, store } = useGame();
  const [lots, setLots] = useState<Record<string, number>>({});

  const qte = (id: string) => lots[id] ?? 1;
  const setQte = (id: string, n: number) => setLots((l) => ({ ...l, [id]: Math.max(1, n) }));
  const valeur = valeurPortefeuille(state);
  const latente = titres.reduce((s, t) => s + plusValue(state, t.id), 0);

  return (
    <div className="bourse">
      <div className="bourse__entete">
        <span>
          Liquide <b>{euros(state.argent)}</b>
        </span>
        <span>
          Titres <b>{euros(valeur)}</b>
        </span>
        {valeur > 0 && (
          <span className={`bourse__pv bourse__pv--${latente >= 0 ? 'haut' : 'bas'}`}>
            {latente >= 0 ? '+' : '−'}
            {euros(Math.abs(latente))} latents
          </span>
        )}
      </div>

      <CourbeMarche state={state} titres={titres} />

      <ul className="titres">
        {titres.map((t) => {
          const cours = coursDe(state, t.id);
          const detenu = state.portefeuille[t.id] ?? 0;
          const revient = state.prixRevient?.[t.id];
          const n = qte(t.id);
          const pv = plusValue(state, t.id);
          return (
            <li key={t.id} className="titre">
              <div className="titre__head">
                <span className="titre__pastille" style={{ background: t.couleur }} />
                <b className="titre__nom">{t.nom}</b>
                <span className="titre__sym">{t.symbole}</span>
                <span className="titre__cours">{euros(cours)}</span>
                <Variation serie={serieDe(state, t.id)} />
              </div>

              <div className="titre__corps">
                {/* Le tracé d'un seul titre, en euros : ici l'échelle
                    absolue est légitime — une série, aucune comparaison
                    à fausser — et c'est la seule qui réponde à « suis-je
                    au-dessus de ce que j'ai payé ». */}
                <Trace serie={serieDe(state, t.id)} couleur={t.couleur} revient={revient} />
                <div className="titre__infos muted">
                  <span>volatilité {(t.volatilite * 100).toFixed(0)} %</span>
                  {detenu > 0 ? (
                    <>
                      <span>
                        {detenu} × {euros(revient ?? cours)} de revient
                      </span>
                      <span className={pv >= 0 ? 'titre__var--haut' : 'titre__var--bas'}>
                        {pv >= 0 ? '+' : '−'}
                        {euros(Math.abs(pv))}
                      </span>
                    </>
                  ) : (
                    <span>aucune ligne</span>
                  )}
                </div>
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

      <p className="muted">
        Les cours sont relevés à chaque clôture du vendredi, après la paie. Le trait
        horizontal sur un tracé est ton prix de revient.
      </p>
    </div>
  );
}

export function Casino({ onResult }: { onResult: (r: ActionResult) => void }) {
  const { state, store } = useGame();
  const [multiple, setMultiple] = useState(1);
  const auBureau = state.phase === 'bureau';

  return (
    <div className="casino">
      <p className={auBureau ? 'casino__alerte' : 'muted'}>
        {auBureau
          ? 'Tu joues depuis ton poste, dans un open space. Chaque mise fait monter la suspicion, que tu gagnes ou non.'
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
              <span className="act__icon"><Icone nom={j.icone} /></span>
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
                    espérance {esperance(j.id)} %
                    {auBureau ? ` · +${j.suspicionAuBureau} suspicion` : ''}
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
    </div>
  );
}
