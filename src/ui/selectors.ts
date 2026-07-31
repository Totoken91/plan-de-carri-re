// Helpers de lecture pour l'UI (aucune mutation).
import type { GameEvent, GameState, PlanDef } from '@state/schema';
import { catalog, getArchetype } from '@data/content';
import { rankOrder } from '@data/content';
import { canStartPlan, planLockReason, successChance } from '@engine/plans';
import { isChoiceAvailable } from '@engine/events';

/** Plans dont le rang minimum est atteint (affichables). */
export function unlockedPlans(state: GameState): PlanDef[] {
  const rank = rankOrder(state.player.rank);
  return catalog.plans.filter((p) => !p.minRank || rank >= rankOrder(p.minRank));
}

export interface PlanView {
  def: PlanDef;
  inProgress: boolean;
  preparation: number;
  chance: number; // taux de réussite estimé contre la cible
  canStart: boolean;
  lockReason?: string; // pourquoi c'est grisé, en clair
}

/** Vue des plans pour une cible donnée (bureau → fiche collègue). */
export function planViews(state: GameState, targetId: string): PlanView[] {
  return unlockedPlans(state).map((def) => {
    const active = state.activePlans.find((p) => p.defId === def.id);
    const probe = active ?? { defId: def.id, targetId, weeksRemaining: def.durationWeeks, preparation: 0 };
    return {
      def,
      inProgress: !!active,
      preparation: active?.preparation ?? 0,
      chance: successChance(state, probe),
      canStart: !active && canStartPlan(state, def, targetId),
      lockReason: active ? undefined : planLockReason(state, def, targetId),
    };
  });
}

export function archetypeName(archId: string): string {
  return getArchetype(archId)?.name ?? archId;
}

/** Substitue {target} et {rival} dans un texte d'événement. */
export function fillTemplate(text: string, state: GameState): string {
  const target = state.colleagues.find((c) => c.id === state.pendingTargetId);
  const name = target?.name ?? 'un collègue';
  return text.replace(/\{target\}/g, name).replace(/\{rival\}/g, name);
}

/** Indices des choix disponibles pour l'événement en cours. */
export function availableChoiceFlags(event: GameEvent, state: GameState): boolean[] {
  return event.choices.map((c) => isChoiceAvailable(c, state, state.pendingTargetId));
}
