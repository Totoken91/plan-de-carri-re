// ─────────────────────────────────────────────────────────────
// MainMenu.tsx — L'écran d'accueil et les dossiers du personnel.
//
// Un menu de jeu, mais pas une liste de boutons : trois dossiers RH
// posés sur le bureau, chacun avec la trombine de son titulaire, son
// grade et sa semaine. Le portrait vient du même composant que le
// plateau — on reconnaît son personnage avant de lire son nom.
//
// L'enregistrement étant continu, aucun bouton « Sauvegarder » ici : ce
// que ce menu offre, c'est ce que l'autosauvegarde ne sait pas faire —
// choisir un dossier, en dupliquer un avant une manœuvre risquée, en
// jeter un.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { getRank, startingColleagues } from '@data/content';
import { theme as T } from '@data/board';
import { suspicionTier } from '@engine/suspicion';
import {
  SLOT_COUNT,
  copySlot,
  deleteSlot,
  firstFreeSlot,
  lastSlot,
  listSlots,
  type SaveSummary,
} from '@state/saves';
import { Figure, GooFilter } from './sprites';

/** Lu dans le roster : un chiffre en dur mentirait au premier ajout. */
const HEADCOUNT = startingColleagues.filter((c) => c.alive).length;

const STATUS_LABEL: Record<string, string> = {
  playing: 'En poste',
  won: 'Au sommet',
  fired: 'Licencié',
  burnout: 'Burn-out',
};

function Portrait({ s }: { s: SaveSummary }) {
  return (
    <svg className="dossier__portrait" viewBox="-26 -54 52 46" aria-hidden="true">
      <defs>
        <GooFilter />
      </defs>
      <g transform="translate(0,-8)">
        <Figure id={`slot-${s.slot}`} look={{ ...s.appearance }} />
      </g>
    </svg>
  );
}

function Dossier({
  slot,
  summary,
  onOpen,
  onNew,
  onCopy,
  onDelete,
  freeSlotExists,
}: {
  slot: number;
  summary: SaveSummary | undefined;
  onOpen: () => void;
  onNew: () => void;
  onCopy: () => void;
  onDelete: () => void;
  freeSlotExists: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!summary) {
    return (
      <li className="dossier dossier--vide">
        <span className="dossier__num">Dossier {slot + 1}</span>
        <p className="dossier__vacant">Emplacement libre</p>
        <button className="btn btn--small btn--primary" onClick={onNew}>
          Nouvelle carrière
        </button>
      </li>
    );
  }

  const rank = getRank(summary.rank)?.name ?? summary.rank;
  const tier = suspicionTier(summary.suspicion);
  const fini = summary.status !== 'playing';

  return (
    <li className={`dossier ${fini ? 'dossier--clos' : ''}`}>
      <span className="dossier__num">Dossier {slot + 1}</span>
      <Portrait s={summary} />
      <h3 className="dossier__name">{summary.name}</h3>
      <p className="dossier__rank">
        {rank} · semaine {summary.week}
      </p>
      <dl className="dossier__facts">
        <div>
          <dt>Réput.</dt>
          <dd>{summary.reputation}</dd>
        </div>
        <div>
          <dt>Suspicion</dt>
          <dd className={summary.suspicion >= 70 ? 'is-hot' : ''}>{Math.round(summary.suspicion)}</dd>
        </div>
        <div>
          <dt>Statut</dt>
          <dd>{STATUS_LABEL[summary.status] ?? summary.status}</dd>
        </div>
      </dl>
      <p className="dossier__tier">{fini ? 'Collaboration terminée.' : `Climat : ${tier}.`}</p>

      <div className="dossier__actions">
        <button className="btn btn--small btn--primary" onClick={onOpen}>
          {fini ? 'Consulter' : 'Reprendre'}
        </button>
        <button
          className="btn btn--small"
          onClick={onCopy}
          disabled={!freeSlotExists}
          title={
            freeSlotExists
              ? 'Copier ce dossier dans un emplacement libre'
              : 'Aucun emplacement libre'
          }
        >
          Dupliquer
        </button>
        {confirming ? (
          <>
            <button
              className="btn btn--small btn--danger"
              onClick={() => {
                onDelete();
                setConfirming(false);
              }}
            >
              Confirmer
            </button>
            <button className="btn btn--small" onClick={() => setConfirming(false)}>
              Annuler
            </button>
          </>
        ) : (
          <button className="btn btn--small" onClick={() => setConfirming(true)}>
            Détruire
          </button>
        )}
      </div>
    </li>
  );
}

export function MainMenu({
  onResume,
  onNewCareer,
  onManual,
}: {
  onResume: (slot: number) => void;
  onNewCareer: (slot: number) => void;
  onManual: () => void;
}) {
  // Les dossiers vivent dans localStorage ; ce compteur force la
  // relecture après une copie ou une destruction.
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const slots = listSlots();
  const dernier = lastSlot();
  const libre = firstFreeSlot();
  void tick;

  return (
    <div className="menu">
      <header className="menu__head">
        <p className="menu__eyebrow">Groupe · direction des ressources humaines</p>
        <h1 className="menu__title">Plan de Carrière</h1>
        <p className="menu__sub">
          Vous êtes stagiaire au troisième étage. {HEADCOUNT} personnes vous séparent du bureau du
          fond, et aucune n’a l’intention de bouger.
        </p>
      </header>

      {dernier !== undefined && (
        <button className="btn btn--primary menu__resume" onClick={() => onResume(dernier)}>
          Reprendre — {slots[dernier]?.name}, semaine {slots[dernier]?.week}
        </button>
      )}

      <h2 className="section-title menu__section">Dossiers du personnel</h2>
      <ul className="dossiers">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <Dossier
            key={i}
            slot={i}
            summary={slots[i]}
            freeSlotExists={libre !== undefined}
            onOpen={() => onResume(i)}
            onNew={() => onNewCareer(i)}
            onCopy={() => {
              if (libre !== undefined) copySlot(i, libre);
              refresh();
            }}
            onDelete={() => {
              deleteSlot(i);
              refresh();
            }}
          />
        ))}
      </ul>

      <footer className="menu__foot">
        <button className="btn btn--small" onClick={onManual}>
          Règlement intérieur
        </button>
        <span className="menu__note" style={{ color: T.signal.encre }}>
          Les dossiers s’enregistrent tout seuls, à chaque action.
        </span>
      </footer>
    </div>
  );
}
