// ─────────────────────────────────────────────────────────────
// promotion.ts — Progression hiérarchique via la réputation.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { nextRank, topRank } from '@data/content';

/**
 * Promeut le joueur tant que sa réputation atteint le seuil du rang suivant.
 * Renvoie le nom du nouveau rang si promotion, sinon undefined.
 */
export function checkPromotion(state: GameState): string | undefined {
  let promotedTo: string | undefined;
  let next = nextRank(state.player.rank);
  while (next && state.player.reputation >= next.reputationRequired) {
    state.player.rank = next.id;
    promotedTo = next.name;
    next = nextRank(state.player.rank);
  }
  return promotedTo;
}

/** Le joueur a-t-il atteint le rang maximum (condition de victoire MVP) ? */
export function isAtTop(state: GameState): boolean {
  return state.player.rank === topRank().id;
}
