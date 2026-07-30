// ─────────────────────────────────────────────────────────────
// week.ts — Résolution du vendredi soir.
//
// Découpée en deux temps car l'événement hebdomadaire attend une
// décision du joueur (UI) :
//   1) beginWeekend  → tire l'événement, le met en attente
//   2) finalizeWeek  → plans, PNJ, opinions, audit, promo, semaine+1
// ─────────────────────────────────────────────────────────────
import type { GameState, LogEntry } from '@state/schema';
import { getArchetype } from '@data/content';
import { balance } from '@data/balance';
import { clamp } from './util';
import { pickWeeklyEvent, resolveEventTarget } from './events';
import { resolveDuePlans } from './plans';
import { runAudit, checkBurnout } from './suspicion';
import { checkPromotion, isAtTop } from './promotion';
import { generateOpportunities } from './opportunities';
import type { Rng } from './rng';

const log = (state: GameState, text: string, tone: LogEntry['tone'] = 'neutral') =>
  state.log.push({ week: state.week, text, tone });

/**
 * Ouvre le week-end : sélectionne l'événement hebdomadaire et le met en
 * attente de décision. Renvoie true si un événement attend le joueur.
 */
export function beginWeekend(state: GameState, rng: Rng): boolean {
  const event = pickWeeklyEvent(state, rng);
  if (!event) {
    state.pendingEvent = undefined;
    state.pendingTargetId = undefined;
    return false;
  }
  state.pendingEvent = event.id;
  state.pendingTargetId = resolveEventTarget(event, state, rng);
  return true;
}

/** Dérive naturelle des opinions selon l'archétype. */
function applyOpinionDrift(state: GameState): void {
  for (const c of state.colleagues) {
    if (!c.alive) continue;
    const drift = getArchetype(c.archetype)?.weeklyOpinionDrift ?? 0;
    if (drift !== 0) c.opinion = clamp(c.opinion + drift, -100, 100);
  }
}

/**
 * Actions des PNJ (MVP minimal) : les archétypes sensibles à la suspicion
 * la font monter quand ils te trouvent louche et t'apprécient peu.
 */
function npcReactions(state: GameState): void {
  const tier = state.suspicion;
  for (const c of state.colleagues) {
    if (!c.alive) continue;
    const arch = getArchetype(c.archetype);
    if (!arch) continue;
    // Un Fayot ou un Parano hostile qui te trouve suspect en rajoute une couche.
    if (arch.denounceThreshold !== undefined && tier >= arch.denounceThreshold && c.opinion < 10) {
      const add = Math.round(2 * arch.suspicionSensitivity);
      state.suspicion = clamp(state.suspicion + add, 0, 100);
      log(state, `${c.name} a glissé un mot sur toi en réunion. La Suspicion monte.`, 'bad');
    }
  }
}

export interface WeekSummary {
  audit?: string;
  promotion?: string;
  gameOver?: GameState['status'];
  won?: boolean;
}

/**
 * Clôture la semaine après résolution de l'événement.
 * Ordre : plans → PNJ → opinions → audit → burn-out → promotion → semaine+1.
 */
export function finalizeWeek(state: GameState, rng: Rng): WeekSummary {
  const summary: WeekSummary = {};

  // 1) Plans arrivés à terme.
  const resolutions = resolveDuePlans(state, rng);
  for (const r of resolutions) {
    log(
      state,
      r.success
        ? `Plan « ${r.planName} » : réussi (${r.chance}%).`
        : `Plan « ${r.planName} » : échoué (${r.chance}%).`,
      r.success ? 'good' : 'bad',
    );
  }

  // 2) Réactions des PNJ.
  npcReactions(state);

  // 3) Dérive d'opinion.
  applyOpinionDrift(state);

  // 4) Audit de conformité RH.
  const audit = runAudit(state);
  if (audit.triggered) {
    summary.audit = audit.reason;
    log(state, `Audit de conformité RH : ${audit.reason}`, audit.survived ? 'good' : 'bad');
    if (!audit.survived) {
      summary.gameOver = 'fired';
      return summary;
    }
  }

  // 5) Burn-out prolongé.
  if (checkBurnout(state)) {
    log(state, 'Mise au placard : tes Nerfs t’ont lâché trop longtemps.', 'bad');
    summary.gameOver = 'burnout';
    return summary;
  }

  // 6) Promotion.
  const promo = checkPromotion(state);
  if (promo) {
    summary.promotion = promo;
    log(state, `Promotion : te voilà ${promo}. On te sourit. On t’observe aussi.`, 'good');
  }

  // 7) Victoire : rester au sommet X semaines.
  if (isAtTop(state)) {
    const marker = state.flags.find((f) => f.startsWith('top_since:'));
    if (!marker) {
      state.flags.push(`top_since:${state.week}`);
    } else {
      const since = Number(marker.split(':')[1]);
      if (state.week - since >= balance.winSurviveWeeks) {
        state.status = 'won';
        summary.won = true;
        summary.gameOver = 'won';
        return summary;
      }
    }
  }

  // 8) Passage à la semaine suivante.
  state.week += 1;
  state.actionPointsRemaining = balance.actionPointsPerWeek;
  state.pendingEvent = undefined;
  state.pendingTargetId = undefined;
  state.weeklyActionCounts = {}; // reset anti-spam
  generateOpportunities(state, rng); // nouvelles opportunités de la semaine

  return summary;
}
