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
/**
 * Cible DÉDUCTIBLE sans tirage.
 *
 * Elle existe pour une raison précise : le filtrage d'éligibilité tourne
 * avant tout tirage, donc sans cible. Une condition portant sur la cible
 * (« il faut une liaison ») y aurait été évaluée contre `undefined` et
 * aurait échoué systématiquement — l'événement n'aurait jamais pu se
 * déclencher, silencieusement.
 *
 * Ces trois modes n'ont pas besoin du RNG, on peut donc les résoudre
 * pendant le filtrage sans déplacer le curseur et casser la
 * reproductibilité d'une graine.
 */
export function staticTarget(event: GameEvent, state: GameState): string | undefined {
  switch (event.target) {
    case 'rival':
      return findRival(state);
    case 'romance':
      return partenairePrincipal(state)?.id;
    case 'subordonne':
      return state.colleagues.find((c) => c.alive && c.subordonne)?.id;
    default:
      return undefined;
  }
}

/** L'histoire la plus avancée en cours — ni « rien », ni terminée. */
function partenairePrincipal(state: GameState) {
  return state.colleagues
    .filter(
      (c) => c.alive && c.romance && c.romance.statut !== 'rien' && c.romance.statut !== 'ex',
    )
    .sort((a, b) => (b.romance!.niveau ?? 0) - (a.romance!.niveau ?? 0))[0];
}

export function resolveEventTarget(event: GameEvent, state: GameState, rng: Rng): string | undefined {
  const fixe = staticTarget(event, state);
  if (fixe !== undefined) return fixe;
  switch (event.target) {
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
  // La cible déductible est passée au filtre : sans elle, toute condition
  // portant sur la cible refuserait l'événement pour toujours.
  if (!checkCondition(t.conditions, state, staticTarget(event, state))) return false;

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
