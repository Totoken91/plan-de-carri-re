// ─────────────────────────────────────────────────────────────
// effects.ts — Application d'un Effect au GameState.
// MUTE l'état passé (le store travaille toujours sur un clone).
// C'est le seul endroit qui traduit une donnée déclarative en mutation.
// ─────────────────────────────────────────────────────────────
import type { Effect, GameState, StatKey } from '@state/schema';
import { clamp } from './util';
import { findRival } from './util';
import { startPlan } from './plans';

const STAT_MIN = 0;
const STAT_MAX = 100;

function applyStatDelta(state: GameState, key: StatKey, delta: number): void {
  state.player.stats[key] = clamp(state.player.stats[key] + delta, STAT_MIN, STAT_MAX);
}

function applyOpinion(state: GameState, id: string | undefined, delta: number): void {
  if (!id) return;
  const c = state.colleagues.find((x) => x.id === id);
  if (c) c.opinion = clamp(c.opinion + delta, -100, 100);
}

/**
 * Applique un Effect.
 * @param targetId cible contextuelle (pour targetOpinion / startPlan).
 */
export function applyEffect(state: GameState, effect: Effect, targetId?: string): void {
  if (effect.stats) {
    for (const key of Object.keys(effect.stats) as StatKey[]) {
      const delta = effect.stats[key];
      if (delta !== undefined) applyStatDelta(state, key, delta);
    }
  }

  if (effect.suspicion !== undefined) {
    state.suspicion = clamp(state.suspicion + effect.suspicion, 0, 100);
  }

  if (effect.reputation !== undefined) {
    state.player.reputation = Math.max(0, state.player.reputation + effect.reputation);
  }

  if (effect.actionPoints !== undefined) {
    state.actionPointsRemaining = Math.max(0, state.actionPointsRemaining + effect.actionPoints);
  }

  if (effect.targetOpinion !== undefined) applyOpinion(state, targetId, effect.targetOpinion);

  if (effect.rivalOpinion !== undefined) applyOpinion(state, findRival(state), effect.rivalOpinion);

  if (effect.globalOpinion !== undefined) {
    for (const c of state.colleagues) {
      if (c.alive) c.opinion = clamp(c.opinion + effect.globalOpinion, -100, 100);
    }
  }

  if (effect.colleagueOpinions) {
    for (const [id, delta] of Object.entries(effect.colleagueOpinions)) {
      applyOpinion(state, id, delta);
    }
  }

  if (effect.setFlags) {
    for (const f of effect.setFlags) if (!state.flags.includes(f)) state.flags.push(f);
  }
  if (effect.clearFlags) {
    state.flags = state.flags.filter((f) => !effect.clearFlags!.includes(f));
  }

  if (effect.startPlan) {
    startPlan(state, effect.startPlan, targetId);
  }

  // « Départ non planifié » : la cible quitte l'entreprise. On se contente
  // de la retirer ; c'est week.ts qui repère les absences et les raconte,
  // pour qu'un départ soit signalé quelle qu'en soit la source.
  if (effect.removeTarget && targetId) {
    const c = state.colleagues.find((x) => x.id === targetId);
    if (c) {
      c.alive = false;
      c.intent = undefined;
    }
  }
}
