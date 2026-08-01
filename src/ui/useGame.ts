import { useSyncExternalStore } from 'react';
import { GameStore, createInitialState } from '@state/store';
import { migrateLegacySave } from '@state/saves';

// Une partie en cours ne doit pas disparaître parce que le format de
// sauvegarde a changé : l'ancienne sauvegarde unique devient le premier
// dossier. À faire AVANT toute lecture de dossier.
migrateLegacySave();

/**
 * Singleton : une seule partie en cours par onglet.
 *
 * Il démarre SANS dossier ouvert — l'état qu'il porte est un brouillon
 * jetable qui ne sera jamais enregistré. C'est le menu qui décide quel
 * dossier ouvrir ou créer. Construire le store ici plutôt qu'à
 * l'ouverture d'un dossier permet à l'abonnement React d'être posé une
 * fois pour toutes, sans démontage de l'arbre entre deux parties.
 */
export const gameStore = new GameStore(createInitialState());

/** Abonne un composant React à l'état du jeu. */
export function useGame() {
  const state = useSyncExternalStore(
    (cb) => gameStore.subscribe(cb),
    () => gameStore.getState(),
  );
  return { state, store: gameStore };
}
