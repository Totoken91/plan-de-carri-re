import type { GameState, StatKey } from '@state/schema';

export const STAT_KEYS: StatKey[] = ['aura', 'rendement', 'combine', 'nerfs'];

export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

/** Le rival = le premier Carriériste vivant (MVP). */
export function findRival(state: GameState): string | undefined {
  return state.colleagues.find((c) => c.alive && c.archetype === 'carrieriste')?.id;
}

export const aliveColleagues = (state: GameState) => state.colleagues.filter((c) => c.alive);

export const getColleague = (state: GameState, id: string | undefined) =>
  id ? state.colleagues.find((c) => c.id === id) : undefined;
