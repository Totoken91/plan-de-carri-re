// ─────────────────────────────────────────────────────────────
// opportunities.ts — Opportunités hebdomadaires (le cœur du tour).
//
// Chaque semaine, le moteur tire quelques situations ciblées et
// éphémères et les place sur la carte. Le joueur dépense ses PA à
// réagir à ce qui se présente plutôt qu'à marteler une action.
// ─────────────────────────────────────────────────────────────
import type { ActiveOpportunity, GameState, Opportunity, OppPlace } from '@state/schema';
import { catalog, getOpportunity } from '@data/content';
import { checkCondition } from './conditions';
import { applyEffect } from './effects';
import { aliveColleagues, findRival } from './util';
import type { Rng } from './rng';

const OPPS_PER_WEEK = 3;

function resolveTarget(opp: Opportunity, state: GameState, rng: Rng): string | undefined {
  switch (opp.target) {
    case 'rival':
      return findRival(state);
    case 'archetype':
      return rng.pick(aliveColleagues(state).filter((c) => c.archetype === opp.targetArchetype))?.id;
    case 'random':
      return rng.pick(aliveColleagues(state))?.id;
    default:
      return undefined;
  }
}

function isEligible(opp: Opportunity, state: GameState): boolean {
  if (opp.minRank && !checkCondition({ minRank: opp.minRank }, state)) return false;
  if (!checkCondition(opp.conditions, state)) return false;
  if (opp.target === 'rival' && !findRival(state)) return false;
  if (opp.target === 'archetype') {
    const has = aliveColleagues(state).some((c) => c.archetype === opp.targetArchetype);
    if (!has) return false;
  }
  return true;
}

function placeOf(opp: Opportunity): OppPlace {
  if (opp.place) return opp.place;
  return opp.target && opp.target !== 'none' ? 'target' : 'desk';
}

/** (Re)génère les opportunités de la semaine. Tirage pondéré sans doublon. */
export function generateOpportunities(state: GameState, rng: Rng): void {
  const pool = catalog.opportunities.filter((o) => isEligible(o, state));
  const chosen: ActiveOpportunity[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < OPPS_PER_WEEK && pool.length > usedIds.size; i++) {
    const candidates = pool.filter((o) => !usedIds.has(o.id));
    const opp = rng.weighted(candidates, (o) => o.weight);
    if (!opp) break;
    usedIds.add(opp.id);
    chosen.push({ defId: opp.id, targetId: resolveTarget(opp, state, rng), place: placeOf(opp) });
  }
  state.opportunities = chosen;
}

export interface OppResolution {
  ok: boolean;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Résout une opportunité (par son index) : dépense PA, applique l'effet. */
export function resolveOpportunity(state: GameState, index: number, rng: Rng): OppResolution {
  const active = state.opportunities[index];
  if (!active) return { ok: false, text: 'Opportunité expirée.', tone: 'neutral' };
  const def = getOpportunity(active.defId);
  if (!def) return { ok: false, text: 'Opportunité inconnue.', tone: 'neutral' };

  const cost = def.cost ?? 1;
  if (state.actionPointsRemaining < cost) {
    return { ok: false, text: 'Pas assez de points d’action.', tone: 'neutral' };
  }

  let success = true;
  if (def.successChance !== undefined) success = rng.chance(def.successChance);

  if (success) applyEffect(state, def.effects, active.targetId);
  else if (def.failureEffects) applyEffect(state, def.failureEffects, active.targetId);

  state.actionPointsRemaining -= cost;
  state.opportunities.splice(index, 1); // consommée

  const text = success ? def.outcomeText : (def.failureText ?? def.outcomeText);
  return { ok: true, text, tone: success ? 'good' : 'bad' };
}
