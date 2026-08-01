// ─────────────────────────────────────────────────────────────
// Ecran.tsx — Le poste de travail, vu depuis la chaise.
//
// Tout ce qui se fait DEVANT un écran se fait maintenant ici : produire,
// regarder la bourse, jouer au casino. Ce n'est pas de la décoration.
// Trois raisons, dans l'ordre d'importance :
//
//  · ça donne un LIEU à ces actions. « Bosser » était un bouton dans un
//    panneau latéral, au même endroit que « prendre un café avec Marc » ;
//    maintenant il faut aller s'asseoir. Le plateau redevient l'endroit
//    où l'on décide, au lieu d'être une illustration du panneau de
//    droite ;
//  · ça explique pourquoi jouer au casino depuis le bureau se voit. On
//    est devant un écran, dans un open space, sous les yeux de six
//    personnes. La suspicion cesse d'être une règle arbitraire ;
//  · ça sépare enfin l'interface DU JEU (papier kraft, encre, formulaire
//    administratif) de l'interface DANS le jeu (un poste Windows de
//    2011). Les deux ne doivent surtout pas se ressembler.
//
// La fenêtre reste une fenêtre : barre de titre, bouton de fermeture,
// et le bureau derrière. On ne réinvente rien — c'est justement parce que
// tout le monde sait s'en servir que ça marche.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import type { ActionResult } from '@engine/actions';
import { previewBosser } from '@engine/preview';
import { euros } from '@engine/argent';
import { valeurPortefeuille } from '@engine/marche';
import { useGame } from './useGame';
import { Bourse, Casino } from './Marche';

type Appli = 'bureau' | 'tableur' | 'bourse' | 'casino' | 'messagerie';

interface Icone {
  id: Appli;
  nom: string;
  glyphe: string;
  legende: string;
}

const ICONES: Icone[] = [
  { id: 'tableur', nom: 'Consolidé_v7_FINAL.xlsx', glyphe: '▦', legende: 'Le fichier sur lequel on te juge.' },
  { id: 'bourse', nom: 'Marché', glyphe: '▲', legende: 'Le cours des quatre titres accessibles.' },
  { id: 'casino', nom: 'lucky‑spin.eu', glyphe: '◈', legende: 'Un onglet qu’on referme vite.' },
  { id: 'messagerie', nom: 'Messagerie', glyphe: '✉', legende: 'Ce qui s’est dit cette semaine.' },
];

export function Ecran({ onClose }: { onClose: () => void }) {
  const { state, store } = useGame();
  const [appli, setAppli] = useState<Appli>('bureau');
  const [toast, setToast] = useState<ActionResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Échap referme la fenêtre ouverte avant de quitter le poste :
      // c'est ce que fait n'importe quel système, donc ce que la main
      // attend.
      if (appli !== 'bureau') setAppli('bureau');
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appli, onClose]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const flash = (r: ActionResult) => {
    if (r.text) setToast(r);
  };

  const bosser = previewBosser(state);
  const journal = state.log.slice(-9).reverse();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="poste" onClick={(e) => e.stopPropagation()}>
        {/* Le cadre physique : c'est lui qui dit « tu regardes un
            moniteur », pas le contenu. */}
        <div className="poste__cadre">
          <div className="poste__ecran">
            <div className="poste__fond">
              <div className="poste__icones">
                {ICONES.map((ic) => (
                  <button
                    key={ic.id}
                    className={`icone ${appli === ic.id ? 'is-on' : ''}`}
                    onDoubleClick={() => setAppli(ic.id)}
                    onClick={() => setAppli(ic.id)}
                    title={ic.legende}
                  >
                    <span className="icone__glyphe" aria-hidden="true">
                      {ic.glyphe}
                    </span>
                    <span className="icone__nom">{ic.nom}</span>
                  </button>
                ))}
              </div>

              {appli !== 'bureau' && (
                <div className="fenetre">
                  <div className="fenetre__barre">
                    <span className="fenetre__titre">
                      {ICONES.find((i) => i.id === appli)?.nom}
                    </span>
                    <button
                      className="fenetre__fermer"
                      onClick={() => setAppli('bureau')}
                      aria-label="Fermer la fenêtre"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="fenetre__corps">
                    {appli === 'tableur' && (
                      <div className="tableur">
                        <p className="tableur__note">
                          Quatre heures dessus et personne ne saura jamais que tu l’as
                          fait. C’est le principe.
                        </p>
                        <button
                          className="act"
                          disabled={!bosser.available}
                          onClick={() => flash(store.perform(bosser.id))}
                        >
                          <span className="act__icon">▦</span>
                          <span className="act__body">
                            <span className="act__head">
                              <span className="act__label">{bosser.label}</span>
                            </span>
                            <span className="act__summary">
                              {bosser.reason ?? bosser.summary}
                            </span>
                            {bosser.available && (
                              <span className="act__lines">
                                {bosser.lines.map((l, i) => (
                                  <span key={i} className={`act__line act__line--${l.tone}`}>
                                    {l.label}
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                          <span className="act__cost">{bosser.cost} PA</span>
                        </button>
                      </div>
                    )}

                    {appli === 'bourse' && <Bourse onResult={flash} />}
                    {appli === 'casino' && <Casino onResult={flash} />}

                    {appli === 'messagerie' && (
                      <ul className="messagerie">
                        {journal.map((l, i) => (
                          <li key={i} className={`messagerie__ligne messagerie__ligne--${l.tone}`}>
                            <span className="messagerie__sem">S{l.week}</span> {l.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* La barre des tâches : le solde et les PA restants, parce
                  que ce sont les deux chiffres qui décident de tout ce
                  qu'on peut faire depuis ce fauteuil. */}
              <div className="poste__barre">
                <span className="poste__demarrer">Poste 3‑14</span>
                <span className="poste__zone">
                  {euros(state.argent)}
                  {valeurPortefeuille(state) > 0 && (
                    <em> · {euros(valeurPortefeuille(state))} en titres</em>
                  )}
                </span>
                <span className="poste__zone poste__zone--pa">
                  {state.actionPointsRemaining} PA
                </span>
              </div>
            </div>
          </div>
          <div className="poste__pied" />
        </div>

        <button className="btn btn--small poste__quitter" onClick={onClose}>
          Se lever du poste
        </button>

        {toast && <div className={`toast toast--${toast.tone} poste__toast`}>{toast.text}</div>}
      </div>
    </div>
  );
}
