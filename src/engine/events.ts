// ─────────────────────────────────────────────────────────────
// events.ts — Sélection data-driven et résolution des événements.
// ─────────────────────────────────────────────────────────────
import type { EventChoice, GameEvent, GameState } from '@state/schema';
import { catalog } from '@data/content';
import { checkCondition } from './conditions';
import { applyEffect } from './effects';
import { findRival, aliveColleagues, fillNames } from './util';
import type { Rng } from './rng';

/** Résout la cible concrète d'un événement selon son mode. */
export function resolveEventTarget(event: GameEvent, state: GameState, rng: Rng): string | undefined {
  switch (event.target) {
    case 'rival':
      return findRival(state);
    case 'archetype': {
      const pool = aliveColleagues(state).filter((c) => c.archetype === event.targetArchetype);
      return rng.pick(pool)?.id;
    }
    case 'random':
      return rng.pick(aliveColleagues(state))?.id;
    default:
      return undefined;
  }
}

/** Un événement est-il éligible cette semaine ? */
export function isEventEligible(event: GameEvent, state: GameState): boolean {
  const t = event.trigger;
  if (t.minRank && !checkCondition({ minRank: t.minRank }, state)) return false;
  if (!checkCondition(t.conditions, state)) return false;

  const past = state.eventHistory.filter((h) => h.id === event.id);
  if (t.once && past.length > 0) return false;
  if (t.cooldownWeeks && past.length > 0) {
    const last = Math.max(...past.map((h) => h.week));
    if (state.week - last < t.cooldownWeeks) return false;
  }
  // Un événement ciblant le rival n'est éligible que s'il existe un rival.
  if (event.target === 'rival' && !findRival(state)) return false;
  if (event.target === 'archetype') {
    const has = aliveColleagues(state).some((c) => c.archetype === event.targetArchetype);
    if (!has) return false;
  }
  return true;
}

/** Tire l'événement de la semaine (pondéré), ou undefined si aucun éligible. */
export function pickWeeklyEvent(state: GameState, rng: Rng): GameEvent | undefined {
  const eligible = catalog.events.filter((e) => isEventEligible(e, state));
  return rng.weighted(eligible, (e) => e.trigger.weight);
}

/** Un choix est-il sélectionnable (prérequis remplis) pour la cible courante ? */
export function isChoiceAvailable(
  choice: EventChoice,
  state: GameState,
  targetId?: string,
): boolean {
  return checkCondition(choice.requires, state, targetId);
}

export interface ChoiceResolution {
  outcomeText: string;
  success: boolean;
}

/**
 * Applique un choix d'événement. Gère la branche incertaine (successChance).
 * Enregistre l'événement dans l'historique (une seule fois par résolution).
 */
export function resolveChoice(
  state: GameState,
  event: GameEvent,
  choiceIndex: number,
  targetId: string | undefined,
  rng: Rng,
): ChoiceResolution {
  const choice = event.choices[choiceIndex]!;

  let success = true;
  if (choice.successChance !== undefined) {
    success = rng.chance(choice.successChance);
  }

  if (success) {
    applyEffect(state, choice.effects, targetId);
  } else if (choice.failureEffects) {
    applyEffect(state, choice.failureEffects, targetId);
  }

  state.eventHistory.push({ id: event.id, week: state.week });

  const raw = success ? choice.outcomeText : (choice.failureText ?? choice.outcomeText);
  return { outcomeText: fillNames(raw, state, targetId), success };
}
