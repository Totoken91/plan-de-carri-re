// ─────────────────────────────────────────────────────────────
// traits.ts — Ce que les traits changent, côté moteur.
//
// Règle de la maison respectée à la lettre : le moteur ne connaît AUCUN
// trait par son nom. Il connaît des quantités génériques — « les hausses
// de suspicion », « les gains d'opinion » — et demande au catalogue quel
// coefficient s'y applique. « Discret » et « Maladroit » n'existent que
// dans traits.json.
//
// Deux natures de modificateur, et le moteur doit savoir laquelle :
//   · MULTIPLICATIF pour ce qui est une quantité (gain, coût) — on
//     compose par produit, 1 = neutre ;
//   · ADDITIF pour ce qui est déjà un pourcentage de réussite — ajouter
//     8 points à une chance de 40 % est lisible, la multiplier ne l'est
//     pas (elle plafonnerait différemment selon la situation).
// ─────────────────────────────────────────────────────────────
import type { GameState, TraitId, TraitModKey } from '@state/schema';
import { getTrait } from '@data/traits';

/** Les clés qui s'additionnent (points de %). Toutes les autres se multiplient. */
const ADDITIVE: ReadonlySet<TraitModKey> = new Set<TraitModKey>([
  'planSuccess',
  'defuseChance',
  'secretChance',
]);

export function hasTrait(state: GameState, id: TraitId): boolean {
  return state.player.traits.includes(id);
}

/** Somme des modificateurs additifs. 0 si aucun trait ne joue. */
export function traitBonus(state: GameState, key: TraitModKey): number {
  if (!ADDITIVE.has(key)) return 0;
  let sum = 0;
  for (const id of state.player.traits) sum += getTrait(id)?.mods?.[key] ?? 0;
  return sum;
}

/** Produit des modificateurs multiplicatifs. 1 si aucun trait ne joue. */
export function traitFactor(state: GameState, key: TraitModKey): number {
  if (ADDITIVE.has(key)) return 1;
  let f = 1;
  for (const id of state.player.traits) f *= getTrait(id)?.mods?.[key] ?? 1;
  return f;
}

/**
 * Applique la part « premier jour » des traits : stats, suspicion de
 * départ, opinion initiale de l'étage. À n'appeler qu'une fois, à la
 * création — ce sont des valeurs de départ, pas des effets récurrents.
 */
export function applyTraitsAtStart(state: GameState): void {
  for (const id of state.player.traits) {
    const t = getTrait(id);
    if (!t) continue;
    for (const [k, v] of Object.entries(t.stats ?? {})) {
      const key = k as keyof typeof state.player.stats;
      state.player.stats[key] = Math.max(0, Math.min(100, state.player.stats[key] + v));
    }
    if (t.suspicion) state.suspicion = Math.max(0, Math.min(100, state.suspicion + t.suspicion));
    if (t.opinion) {
      for (const c of state.colleagues) {
        c.opinion = Math.max(-100, Math.min(100, c.opinion + t.opinion));
      }
    }
  }
}
