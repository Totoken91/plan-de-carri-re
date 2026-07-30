import { useSyncExternalStore } from 'react';
import { GameStore } from '@state/store';

// Singleton : une seule partie en cours par onglet.
export const gameStore = GameStore.fromSaveOrNew();

/** Abonne un composant React à l'état du jeu. */
export function useGame() {
  const state = useSyncExternalStore(
    (cb) => gameStore.subscribe(cb),
    () => gameStore.getState(),
  );
  return { state, store: gameStore };
}
