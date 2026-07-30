// ─────────────────────────────────────────────────────────────
// plans.ts — Démarrage, avancement et résolution des plans.
//
// Taux de réussite = f(Combine joueur, vigilance de la cible, préparation),
// recalculé AU MOMENT de la résolution (le vendredi), pas figé au lancement.
// ─────────────────────────────────────────────────────────────
import type { ActivePlan, GameState, PlanDef } from '@state/schema';
import { getArchetype, getPlanDef } from '@data/content';
import { balance } from '@data/balance';
import { checkCondition } from './conditions';
import { applyEffect } from './effects';
import { clamp, getColleague } from './util';
import type { Rng } from './rng';

/** Peut-on lancer ce plan maintenant (rang, prérequis, cible) ? */
export function canStartPlan(state: GameState, def: PlanDef, targetId?: string): boolean {
  if (def.minRank && !checkCondition({ minRank: def.minRank }, state)) return false;
  if (!checkCondition(def.requires, state, targetId)) return false;
  // Un seul exemplaire du même plan en cours à la fois.
  if (state.activePlans.some((p) => p.defId === def.id)) return false;
  return true;
}

/** Ajoute un plan à l'état s'il est autorisé. Renvoie true si lancé. */
export function startPlan(state: GameState, defId: string, targetId?: string): boolean {
  const def = getPlanDef(defId);
  if (!def) return false;
  if (!canStartPlan(state, def, targetId)) return false;
  state.activePlans.push({
    defId,
    targetId,
    weeksRemaining: def.durationWeeks,
    preparation: 0,
  });
  return true;
}

/**
 * Taux de réussite courant d'un plan (0–100), affiché au joueur et
 * utilisé à la résolution. Cible absente → vigilance neutre.
 */
export function successChance(state: GameState, plan: ActivePlan): number {
  const def = getPlanDef(plan.defId);
  if (!def) return 0;
  const cfg = balance.plan;

  const target = getColleague(state, plan.targetId);
  const baseVigilance = target ? (getArchetype(target.archetype)?.baseVigilance ?? 40) : 40;
  // La suspicion globale met tout le monde sur ses gardes.
  const vigilance = baseVigilance + state.suspicion * cfg.suspicionVigilanceFactor;

  const raw =
    def.baseSuccess +
    state.player.stats.combine * cfg.combineWeight -
    vigilance * cfg.vigilanceWeight +
    plan.preparation * cfg.preparationWeight;

  return Math.round(clamp(raw, cfg.minSuccess, cfg.maxSuccess));
}

export interface PlanResolution {
  planName: string;
  success: boolean;
  chance: number;
}

/**
 * Résout tous les plans arrivés à terme (weeksRemaining <= 0 après décrément).
 * Les plans non échus voient juste leur compteur décrémenter.
 * Renvoie la liste des plans résolus cette semaine (pour le journal).
 */
export function resolveDuePlans(state: GameState, rng: Rng): PlanResolution[] {
  const resolutions: PlanResolution[] = [];
  const remaining: ActivePlan[] = [];

  for (const plan of state.activePlans) {
    plan.weeksRemaining -= 1;
    if (plan.weeksRemaining > 0) {
      remaining.push(plan);
      continue;
    }

    const def = getPlanDef(plan.defId);
    if (!def) continue;

    const chance = successChance(state, plan);
    const success = rng.chance(chance);

    if (success) {
      applyEffect(state, def.successEffects, plan.targetId);
      state.suspicion = clamp(state.suspicion + def.suspicionOnSuccess, 0, 100);
    } else {
      applyEffect(state, def.failureEffects, plan.targetId);
      state.suspicion = clamp(state.suspicion + def.suspicionOnFailure, 0, 100);
    }

    resolutions.push({ planName: def.name, success, chance });
  }

  state.activePlans = remaining;
  return resolutions;
}
