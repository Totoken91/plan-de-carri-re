// ─────────────────────────────────────────────────────────────
// utilite.ts — Comment une IA de test estime « est-ce que c'est bon
// pour moi ? » à partir d'un Effect.
//
// C'est le seul endroit du banc d'essai qui a le droit d'avoir un avis.
// Tout le reste — les politiques, l'agrégation — s'appuie dessus, ce qui
// évite d'écrire douze barèmes légèrement différents et de comparer des
// stratégies qui ne mesuraient pas la même chose.
//
// L'échelle : 1 point d'utilité ≈ 1 point de réputation. Les autres
// grandeurs sont converties dans cette monnaie, avec des taux qui
// reflètent leur rareté plutôt que leur taille : la suspicion est chère
// parce qu'à 70 elle termine la partie, et l'argent est bon marché parce
// qu'un salaire hebdomadaire en apporte des centaines.
// ─────────────────────────────────────────────────────────────
import type { Effect, GameState } from '@state/schema';

/** Poids d'un point de stat, selon ce que la stat débloque réellement. */
const POIDS_STATS: Record<string, number> = {
  aura: 0.8,
  rendement: 0.9,
  combine: 1.1,
  nerfs: 0.55,
};

/**
 * La suspicion ne coûte pas le même prix selon l'endroit où l'on est.
 * À 10, un point est une abstraction ; à 65, c'est un pas de plus vers
 * l'audit. La courbe est volontairement raide au-dessus de 45 : c'est
 * là qu'un joueur humain commence à changer de comportement.
 */
export function prixSuspicion(state: GameState): number {
  const s = state.suspicion;
  if (s < 25) return 0.7;
  if (s < 45) return 1.4;
  if (s < 60) return 3;
  return 7;
}

/** Valeur d'un euro, en points de réputation. Faible, et c'est voulu. */
const PRIX_EURO = 0.004;

export function utilite(state: GameState, e: Effect | undefined): number {
  if (!e) return 0;
  let u = 0;
  u += e.reputation ?? 0;
  u += (e.argent ?? 0) * PRIX_EURO;
  u -= (e.suspicion ?? 0) * prixSuspicion(state);
  for (const [k, v] of Object.entries(e.stats ?? {})) {
    u += (v as number) * (POIDS_STATS[k] ?? 0.8);
  }
  u += (e.targetOpinion ?? 0) * 0.25;
  u += (e.globalOpinion ?? 0) * 0.9;
  u -= (e.rivalOpinion ?? 0) * 0.1; // le rival qui t'aime ne sert pas à grand-chose
  u += (e.romance ?? 0) * 0.2;
  u += (e.actionPoints ?? 0) * 9; // un PA vaut environ une action de travail
  if (e.removeTarget) u += 22;
  if (e.revealSecret) u += 8;
  if (e.startPlan) u += 6;
  return u;
}

/**
 * Utilité d'un choix à jet de dé : l'espérance, sans aversion au risque.
 * Une IA prudente serait un meilleur joueur, mais un moins bon
 * instrument de mesure — on veut savoir ce que le CONTENU rapporte, pas
 * ce qu'un tempérament en fait.
 */
export function esperanceChoix(
  state: GameState,
  effects: Effect,
  successChance: number | undefined,
  failureEffects: Effect | undefined,
): number {
  if (successChance === undefined) return utilite(state, effects);
  const p = successChance / 100;
  return p * utilite(state, effects) + (1 - p) * utilite(state, failureEffects);
}
