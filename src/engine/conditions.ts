// ─────────────────────────────────────────────────────────────
// conditions.ts — Évaluation d'une Condition contre le GameState.
// Utilisé pour : triggers d'événements, prérequis de choix, prérequis de plans.
// Pure : ne mute jamais l'état.
// ─────────────────────────────────────────────────────────────
import type { Condition, GameState, RomanceStatut, StatKey } from '@state/schema';
import { rankOrder } from '@data/content';
import { appartRang } from '@data/vieprivee';
import { getColleague } from './util';

/**
 * Ordre des statuts de relation, pour `minRomance`.
 *
 * `ex` vaut −1 et non 0 : une histoire terminée n'est pas « moins
 * qu'un flirt », elle est disqualifiante. Sans ce choix, un événement
 * exigeant `flirt` se serait déclenché sur quelqu'un qu'on a quitté.
 */
const ECHELLE: Record<RomanceStatut, number> = {
  ex: -1,
  rien: 0,
  flirt: 1,
  liaison: 2,
  couple: 3,
};
const rangRomance = (s: RomanceStatut | undefined): number => (s ? ECHELLE[s] : 0);

/**
 * `targetId` = cible contextuelle (collègue visé par l'événement/le plan).
 * Nécessaire pour `requiresSecretDiscovered` (secret sur CETTE cible).
 */
export function checkCondition(
  cond: Condition | undefined,
  state: GameState,
  targetId?: string,
): boolean {
  if (!cond) return true;

  const playerRank = rankOrder(state.player.rank);
  if (cond.minRank !== undefined && playerRank < rankOrder(cond.minRank)) return false;
  if (cond.maxRank !== undefined && playerRank > rankOrder(cond.maxRank)) return false;

  if (cond.stats) {
    for (const key of Object.keys(cond.stats) as StatKey[]) {
      const need = cond.stats[key];
      if (need !== undefined && state.player.stats[key] < need) return false;
    }
  }

  if (cond.minSuspicion !== undefined && state.suspicion < cond.minSuspicion) return false;
  if (cond.maxSuspicion !== undefined && state.suspicion > cond.maxSuspicion) return false;
  if (cond.minWeek !== undefined && state.week < cond.minWeek) return false;

  if (cond.flags) {
    for (const f of cond.flags) if (!state.flags.includes(f)) return false;
  }
  if (cond.notFlags) {
    for (const f of cond.notFlags) if (state.flags.includes(f)) return false;
  }

  if (cond.requiresArchetypeAlive !== undefined) {
    const exists = state.colleagues.some(
      (c) => c.alive && c.archetype === cond.requiresArchetypeAlive,
    );
    if (!exists) return false;
  }

  if (cond.requiresSecretDiscovered) {
    const target = getColleague(state, targetId);
    const hasSecret = target?.secrets.some((s) => s.discovered) ?? false;
    if (!hasSecret) return false;
  }

  if (cond.minArgent !== undefined && state.argent < cond.minArgent) return false;
  if (cond.maxArgent !== undefined && state.argent > cond.maxArgent) return false;

  if (cond.minRomance !== undefined) {
    const target = getColleague(state, targetId);
    if (rangRomance(target?.romance?.statut) < rangRomance(cond.minRomance)) return false;
  }

  if (cond.requiresRomanceConnue) {
    const publique = state.colleagues.some((c) => c.alive && c.romance?.connu);
    if (!publique) return false;
  }

  if (cond.requiresSubordonne) {
    if (!state.colleagues.some((c) => c.alive && c.subordonne)) return false;
  }

  if (cond.minLogement !== undefined) {
    if (appartRang(state.appart.niveau) < cond.minLogement) return false;
  }

  return true;
}
