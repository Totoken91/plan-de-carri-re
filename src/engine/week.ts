// ─────────────────────────────────────────────────────────────
// week.ts — Résolution du vendredi soir.
//
// Découpée en deux temps car l'événement hebdomadaire attend une
// décision du joueur (UI) :
//   1) beginWeekend  → tire l'événement, le met en attente
//   2) finalizeWeek  → plans, intentions, audit, promo, semaine+1
//
// Règle de lisibilité : TOUT ce qui touche le joueur produit une ligne
// dans le bilan, avec un responsable nommé. Pas de stat qui bouge sans
// que le joueur puisse dire qui l'a fait bouger.
// ─────────────────────────────────────────────────────────────
import type { GameState, LogEntry } from '@state/schema';
import { getArchetype } from '@data/content';
import { balance } from '@data/balance';
import { clamp } from './util';
import { pickWeeklyEvent, resolveEventTarget } from './events';
import { resolveDuePlans } from './plans';
import { assignIntents, resolveIntents } from './intents';
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

export interface SummaryLine {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface WeekSummary {
  lines: SummaryLine[]; // le récit complet de la semaine
  audit?: string;
  promotion?: string;
  gameOver?: GameState['status'];
  won?: boolean;
}

/**
 * Clôture la semaine après résolution de l'événement.
 * Ordre : plans → intentions des PNJ → opinions → audit → burn-out →
 *         promotion → victoire → semaine+1.
 */
export function finalizeWeek(state: GameState, rng: Rng): WeekSummary {
  const summary: WeekSummary = { lines: [] };
  const record = (text: string, tone: SummaryLine['tone']) => {
    summary.lines.push({ text, tone });
    log(state, text, tone);
  };

  // 1) Plans arrivés à terme.
  for (const r of resolveDuePlans(state, rng)) {
    record(
      r.success
        ? `Ton plan « ${r.planName} » a abouti (${r.chance}% de réussite).`
        : `Ton plan « ${r.planName} » a échoué (${r.chance}% de réussite).`,
      r.success ? 'good' : 'bad',
    );
  }

  // 2) Ce que les collègues fabriquaient de leur côté.
  for (const outcome of resolveIntents(state, rng)) {
    record(outcome.text, outcome.tone);
  }

  // 3) Dérive d'opinion (silencieuse : lente et diffuse).
  applyOpinionDrift(state);

  // 4) Audit de conformité RH.
  const audit = runAudit(state);
  if (audit.triggered) {
    summary.audit = audit.reason;
    record(`Audit de conformité RH : ${audit.reason}`, audit.survived ? 'good' : 'bad');
    if (!audit.survived) {
      summary.gameOver = 'fired';
      return summary;
    }
  }

  // 5) Burn-out prolongé.
  if (checkBurnout(state)) {
    record('Mise au placard : tes Nerfs t’ont lâché trop longtemps.', 'bad');
    summary.gameOver = 'burnout';
    return summary;
  }

  // 6) Promotion.
  const promo = checkPromotion(state);
  if (promo) {
    summary.promotion = promo;
    record(`Promotion : te voilà ${promo}. On te sourit. On t’observe aussi.`, 'good');
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
  generateOpportunities(state, rng); // nouvelles opportunités
  assignIntents(state, rng); // nouvelles intentions des collègues

  return summary;
}
