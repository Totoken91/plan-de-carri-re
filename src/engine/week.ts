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
import { assignIntents, resolveIntents, tickRecovery } from './intents';
import { tickScapegoat } from './scapegoat';
import { runAudit, checkBurnout } from './suspicion';
import { checkPromotion, isAtTop } from './promotion';
import { generateOpportunities } from './opportunities';
import { euros, verserSalaire, type LigneDePaie } from './argent';
import { appliquerMobilierHebdo, pointsWeekend } from './vieprivee';
import { tickRomance } from './romance';
import { resolveOrdres } from './subordonnes';
import { tickMarche } from './marche';
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
  paie?: LigneDePaie;
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

  // Qui était encore là avant la résolution : on compare après, pour
  // qu'un départ soit toujours raconté, quelle qu'en soit la cause.
  const presentBefore = new Set(state.colleagues.filter((c) => c.alive).map((c) => c.id));

  // 1) Plans arrivés à terme.
  for (const r of resolveDuePlans(state, rng)) {
    record(
      r.success
        ? `Ton plan « ${r.planName} » a abouti (${r.chance}% de réussite).`
        : `Ton plan « ${r.planName} » a échoué (${r.chance}% de réussite).`,
      r.success ? 'good' : 'bad',
    );
  }

  // 1 bis) Ce que tes subordonnés ont fait de leur semaine. AVANT les
  // intentions : un ordre qui fait tomber quelqu'un doit le faire tomber
  // avant que celui-ci ne résolve son propre coup, sinon on encaisse un
  // complot venu d'un absent.
  for (const note of resolveOrdres(state, rng)) {
    record(note.text, note.tone);
  }

  // 2) Ce que les collègues fabriquaient de leur côté.
  for (const outcome of resolveIntents(state, rng)) {
    record(outcome.text, outcome.tone);
  }

  // 2 bis) Fin de disgrâce pour ceux qui ont purgé leur affaire.
  for (const outcome of tickRecovery(state)) {
    record(outcome.text, outcome.tone);
  }

  // 2 ter) Un dossier de bouc émissaire trop vieux ne tient plus.
  for (const note of tickScapegoat(state)) {
    record(note.text, note.tone);
  }

  // 2 quater) Départs. Le ton reste administratif — c'est la règle du jeu.
  for (const c of state.colleagues) {
    if (!c.alive && presentBefore.has(c.id)) {
      record(`${c.name} ne fait plus partie des effectifs. Son poste sera republié.`, 'neutral');
    }
  }

  // 2 quinquies) Les histoires en cours. Elles peuvent s'éteindre toutes
  // seules — c'est ce qui empêche d'accumuler des conquêtes en réserve.
  for (const note of tickRomance(state)) {
    record(note.text, note.tone);
  }

  // 3) Dérive d'opinion (silencieuse : lente et diffuse).
  applyOpinionDrift(state);

  // 3 bis) La paie, puis le loyer. Dans cet ordre : personne ne doit se
  // faire expulser le jour d'une promotion.
  const paie = verserSalaire(state);
  summary.paie = paie;
  record(
    paie.decouvert
      ? `Paie : ${euros(paie.salaire)}. Loyer : ${euros(paie.loyer)}. Le compte ne suivait pas.`
      : `Paie : ${euros(paie.salaire)}, moins ${euros(paie.loyer)} de loyer. Net : ${euros(paie.net)}.`,
    paie.decouvert ? 'bad' : 'neutral',
  );

  // Les impayés s'enchaînent, ou ils s'effacent. C'est la SUITE qui fait
  // l'expulsion — un mois difficile ne met personne à la rue, et un
  // avertissement qu'on ne peut pas rattraper n'est pas un enjeu, c'est
  // un piège.
  if (paie.decouvert) {
    state.loyersImpayes += 1;
    if (state.loyersImpayes >= balance.expulsionApres) {
      record(
        `Deuxième loyer impayé. Le bailleur ne relance plus : il fait constater. Tu dors chez un collègue, puis chez personne.`,
        'bad',
      );
      state.status = 'expulse';
      summary.gameOver = 'expulse';
      return summary;
    }
    record(
      `Loyer impayé (${state.loyersImpayes} / ${balance.expulsionApres}). Une lettre recommandée arrive samedi. Il reste une semaine pour trouver l’argent.`,
      'bad',
    );
  } else if (state.loyersImpayes > 0) {
    state.loyersImpayes = 0;
    record('Loyer à jour. Le bailleur retire son courrier.', 'good');
  }

  appliquerMobilierHebdo(state);

  // 3 ter) Un pas de marché. Il tourne même sans portefeuille : le cours
  // doit exister avant qu'on décide d'y entrer.
  tickMarche(state, rng);

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
  state.depensesSemaine = {};
  generateOpportunities(state, rng); // nouvelles opportunités
  assignIntents(state, rng); // nouvelles intentions des collègues

  // 9) Le week-end. Il appartient à la semaine qui commence, pas à celle
  // qui finit : on rentre chez soi avec les opportunités de lundi déjà
  // tirées, et ce qu'on fait à la maison peut les préparer.
  state.phase = 'weekend';
  state.weekendPointsRemaining = pointsWeekend(state);

  return summary;
}
