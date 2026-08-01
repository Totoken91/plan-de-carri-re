// ─────────────────────────────────────────────────────────────
// PauseMenu.tsx — Le menu en cours de partie.
//
// Il dit où en est l'enregistrement plutôt que de proposer un bouton
// « Sauvegarder » : la partie est déjà écrite dans son dossier au moment
// où ce menu s'ouvre. Un bouton qui ne ferait rien de plus serait un
// mensonge rassurant, et le jour où le joueur en aurait vraiment besoin,
// il ne saurait pas qu'il ne sert à rien.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react';

export function PauseMenu({
  slot,
  playerName,
  week,
  onClose,
  onMenu,
  onManual,
}: {
  slot: number | undefined;
  playerName: string;
  week: number;
  onClose: () => void;
  onMenu: () => void;
  onManual: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pause" onClick={(e) => e.stopPropagation()}>
        <div className="event__tag">Interruption de séance</div>
        <h2 className="pause__title">{playerName}</h2>
        <p className="pause__sub">
          Semaine {week}
          {slot !== undefined && ` · dossier ${slot + 1}`}
        </p>

        <p className="pause__saved">
          Dossier à jour. Tout est enregistré jusqu’à ta dernière action — tu peux fermer l’onglet.
        </p>

        <div className="pause__actions">
          <button className="btn btn--primary" onClick={onClose}>
            Reprendre
          </button>
          <button className="btn" onClick={onManual}>
            Règlement intérieur
          </button>
          <button className="btn" onClick={onMenu}>
            Retour aux dossiers
          </button>
        </div>
      </div>
    </div>
  );
}
