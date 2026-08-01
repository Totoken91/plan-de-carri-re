// ─────────────────────────────────────────────────────────────
// Courbe.tsx — Les graphes de la bourse.
//
// Trois décisions valent d'être écrites, parce qu'elles ne se devinent
// pas en lisant le code :
//
// 1. LES SÉRIES SONT INDEXÉES À 100, pas tracées en euros.
//    Kastel vaut 210 €, Novatek 12 €. Sur un axe commun en euros,
//    Novatek serait une ligne plate au ras du zéro et son doublement —
//    l'événement le plus intéressant du marché — serait invisible. Deux
//    échelles sur un même graphe (« double axe ») est le mensonge
//    classique : l'alignement des deux échelles est arbitraire, donc le
//    graphe invente une corrélation qui n'existe pas. Indexer à une base
//    commune est la seule façon honnête de comparer quatre titres sur un
//    seul axe, et c'est en plus ce que fait la finance réelle.
//
// 2. LES COULEURS SONT VALIDÉES, PAS CHOISIES À L'ŒIL.
//    Les quatre teintes du décor échouaient comme palette de séries :
//    #9e3428 contre #2f7048 donnent un ΔE de 4,6 en deutéranopie, c'est-
//    à-dire la même couleur pour 6 % des hommes. La palette retenue est
//    deux teintes × deux clartés — sous vision daltonienne, c'est la
//    CLARTÉ qui reste lisible. Toutes les paires passent, y compris non
//    adjacentes : sur un graphe à quatre courbes, elles sont toutes
//    visibles ensemble.
//
// 3. IL Y A UNE VUE TABLEAU, et ce n'est pas une politesse.
//    Deux des quatre couleurs passent sous 3:1 de contraste avec le
//    papier kraft. C'est acceptable pour un trait de 2 px accompagné
//    d'une étiquette directe, à condition que la valeur soit atteignable
//    autrement qu'à la couleur. Le tableau est cette autre façon.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { GameState, TitreDef } from '@state/schema';
import { serieDe, semaineDuPoint } from '@engine/marche';

// Rapport volontairement large : le graphe occupe la largeur de la
// fenêtre, donc un format carré le rendait plus haut qu'elle et le bas
// des courbes passait sous le bord. Un tracé temporel se lit de toute
// façon mieux étalé — c'est l'axe du temps qui doit avoir de la place.
const MARGE = { g: 34, d: 46, h: 12, b: 24 };
const W = 520;
const H = 190;
const PLOT_W = W - MARGE.g - MARGE.d;
const PLOT_H = H - MARGE.h - MARGE.b;

/** Série ramenée à 100 sur son premier point. */
function indexer(serie: number[]): number[] {
  const base = serie[0];
  if (!base) return serie.map(() => 100);
  return serie.map((v) => (v / base) * 100);
}

export function CourbeMarche({
  state,
  titres,
}: {
  state: GameState;
  titres: TitreDef[];
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [tableau, setTableau] = useState(false);

  const series = titres.map((t) => ({ t, brut: serieDe(state, t.id) }));
  const n = Math.max(...series.map((s) => s.brut.length));

  // Une seule mesure n'est pas une courbe. Le dire vaut mieux que
  // dessiner un point seul et laisser croire à un bug.
  if (n < 2) {
    return (
      <p className="muted courbe__vide">
        Le marché n’a pas encore bougé. Les cours sont relevés chaque vendredi —
        reviens après la première clôture.
      </p>
    );
  }

  const indexees = series.map((s) => ({ ...s, val: indexer(s.brut) }));
  const toutes = indexees.flatMap((s) => s.val);
  const min = Math.min(100, ...toutes);
  const max = Math.max(100, ...toutes);
  const marge = Math.max(2, (max - min) * 0.12);
  const bas = min - marge;
  const haut = max + marge;

  const px = (i: number) => MARGE.g + (i / (n - 1)) * PLOT_W;
  const py = (v: number) => MARGE.h + PLOT_H - ((v - bas) / (haut - bas)) * PLOT_H;

  // Quatre graduations, arrondies : un axe qui affiche 103,7 % n'aide
  // personne à lire une tendance.
  const ticks = [0, 1, 2, 3].map((k) => Math.round(bas + ((haut - bas) * k) / 3));

  const semaine = (i: number) => semaineDuPoint(state, i, n);

  // Les étiquettes de bout se posent à la hauteur de leur courbe — sauf
  // quand deux courbes finissent au même niveau, auquel cas elles se
  // superposent et deviennent illisibles toutes les deux. On les écarte
  // du minimum nécessaire, en partant du haut : l'ordre vertical des
  // étiquettes reste celui des courbes, ce qui est la seule chose qui
  // doit être vraie.
  const ECART = 11;
  const bouts = indexees
    .map((s, i) => ({ i, y: py(s.val[s.val.length - 1] ?? 100) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < bouts.length; k++) {
    const prec = bouts[k - 1]!;
    if (bouts[k]!.y - prec.y < ECART) bouts[k]!.y = prec.y + ECART;
  }
  const yBout = new Map(bouts.map((b) => [b.i, b.y]));

  if (tableau) {
    return (
      <div className="courbe">
        <div className="courbe__tete">
          <h4 className="courbe__titre">Base 100 à l’ouverture</h4>
          <button className="btn btn--small" onClick={() => setTableau(false)}>
            Voir la courbe
          </button>
        </div>
        <div className="courbe__tablewrap">
          <table className="courbe__table">
            <thead>
              <tr>
                <th scope="col">Sem.</th>
                {indexees.map((s) => (
                  <th key={s.t.id} scope="col">
                    {s.t.symbole}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: n }, (_, i) => (
                <tr key={i}>
                  <th scope="row">{semaine(i)}</th>
                  {indexees.map((s) => (
                    <td key={s.t.id}>{s.val[i] !== undefined ? Math.round(s.val[i]!) : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="courbe">
      <div className="courbe__tete">
        <h4 className="courbe__titre">Base 100 à l’ouverture</h4>
        <button className="btn btn--small" onClick={() => setTableau(true)}>
          Voir le tableau
        </button>
      </div>

      <svg
        className="courbe__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Évolution des quatre titres, indexée base 100"
      >
        {/* Grille : traits pleins et discrets. Des pointillés ajouteraient
            du bruit et se liraient comme « projection » ou « seuil ». */}
        <g className="courbe__grille">
          {ticks.map((v) => (
            <line key={v} x1={MARGE.g} x2={MARGE.g + PLOT_W} y1={py(v)} y2={py(v)} />
          ))}
        </g>
        {/* La ligne de base : au-dessus, on a gagné depuis l'ouverture. */}
        <line
          className="courbe__base"
          x1={MARGE.g}
          x2={MARGE.g + PLOT_W}
          y1={py(100)}
          y2={py(100)}
        />

        <g className="courbe__ticks">
          {ticks.map((v) => (
            <text key={v} x={MARGE.g - 6} y={py(v) + 3.5} textAnchor="end">
              {v}
            </text>
          ))}
          <text x={MARGE.g} y={H - 8}>
            S{semaine(0)}
          </text>
          <text x={MARGE.g + PLOT_W} y={H - 8} textAnchor="end">
            S{semaine(n - 1)}
          </text>
        </g>

        {indexees.map((s, idx) => {
          const d = s.val
            .map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
            .join(' ');
          return (
            <g key={s.t.id}>
              <path d={d} fill="none" stroke={s.t.couleur} strokeWidth="2" strokeLinejoin="round" />
              {/* Étiquette directe au bout : avec quatre séries, chacune
                  peut en porter une, et l'identité cesse de reposer sur
                  la seule couleur. */}
              <text
                className="courbe__bout"
                x={MARGE.g + PLOT_W + 5}
                y={(yBout.get(idx) ?? MARGE.h) + 3.5}
                fill={s.t.couleur}
              >
                {s.t.symbole}
              </text>
            </g>
          );
        })}

        {survol !== null && (
          <g className="courbe__viseur">
            <line x1={px(survol)} x2={px(survol)} y1={MARGE.h} y2={MARGE.h + PLOT_H} />
            {indexees.map((s) => {
              const v = s.val[survol];
              if (v === undefined) return null;
              return (
                <circle
                  key={s.t.id}
                  cx={px(survol)}
                  cy={py(v)}
                  r="4"
                  fill={s.t.couleur}
                  stroke="var(--paper)"
                  strokeWidth="2"
                />
              );
            })}
          </g>
        )}

        {/* La zone de capture couvre tout le tracé : viser un point de
            4 px serait injouable. */}
        <rect
          x={MARGE.g}
          y={MARGE.h}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const r = (e.clientX - box.left) / box.width;
            setSurvol(Math.max(0, Math.min(n - 1, Math.round(r * (n - 1)))));
          }}
          onPointerLeave={() => setSurvol(null)}
        />
      </svg>

      {survol !== null && (
        <div className="courbe__bulle">
          <b>Semaine {semaine(survol)}</b>
          {indexees.map((s) => (
            <span key={s.t.id} className="courbe__bulleligne">
              <i className="courbe__pastille" style={{ background: s.t.couleur }} />
              {s.t.symbole} {Math.round(s.val[survol] ?? 100)}
            </span>
          ))}
        </div>
      )}

      <ul className="courbe__legende">
        {indexees.map((s) => (
          <li key={s.t.id}>
            <i className="courbe__pastille" style={{ background: s.t.couleur }} />
            {s.t.nom}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Le tracé d'un seul titre, en euros, avec sa ligne d'entrée.
 *
 * Ici l'échelle absolue est légitime — il n'y a qu'une série, donc aucune
 * comparaison à fausser. Et c'est justement l'échelle qu'il faut pour
 * répondre à la seule question qui compte quand on détient une ligne :
 * est-ce que je suis au-dessus ou en dessous de ce que j'ai payé ?
 */
export function Trace({
  serie,
  couleur,
  revient,
}: {
  serie: number[];
  couleur: string;
  revient?: number;
}) {
  if (serie.length < 2) return null;
  const w = 104;
  const h = 30;
  const vals = revient ? [...serie, revient] : serie;
  const bas = Math.min(...vals);
  const haut = Math.max(...vals);
  const ecart = haut - bas || 1;
  const px = (i: number) => (i / (serie.length - 1)) * (w - 2) + 1;
  const py = (v: number) => h - 3 - ((v - bas) / ecart) * (h - 6);
  const d = serie
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
    .join(' ');
  const dernier = serie[serie.length - 1]!;

  return (
    <svg className="trace" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {revient !== undefined && (
        <line className="trace__revient" x1="0" x2={w} y1={py(revient)} y2={py(revient)} />
      )}
      <path d={d} fill="none" stroke={couleur} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={px(serie.length - 1)} cy={py(dernier)} r="2.4" fill={couleur} />
    </svg>
  );
}
