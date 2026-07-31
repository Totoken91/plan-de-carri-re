import { useSyncExternalStore } from 'react';
import { GameStore, hasSave } from '@state/store';

// Lu AVANT de construire le store : `fromSaveOrNew` écrit une partie
// neuve en sauvegarde, donc après lui `hasSave()` répond toujours oui.
// C'est cette lecture-là qui décide si l'on passe par l'embauche.
export const bootedWithoutSave = !hasSave();

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
