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

/**
 * Remplace {target} / {rival} par de vrais noms.
 *
 * À faire DANS LE MOTEUR, pas dans l'affichage : ces textes finissent
 * aussi dans le journal et dans le bilan hebdo, qui ne passent par aucun
 * composant. Substituer côté UI laissait le gabarit brut sous les yeux
 * du joueur dès qu'un texte empruntait un autre chemin.
 */
export function fillNames(text: string, state: GameState, targetId?: string): string {
  const target = getColleague(state, targetId)?.name ?? 'un collègue';
  const rival = getColleague(state, findRival(state))?.name ?? 'ton rival';
  return text.replace(/\{target\}/g, target).replace(/\{rival\}/g, rival);
}
