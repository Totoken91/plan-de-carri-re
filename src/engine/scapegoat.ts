// ─────────────────────────────────────────────────────────────
// scapegoat.ts — Le bouc émissaire.
//
// Pièce maîtresse du GDD (§6, §7) : avant un gros coup, on « prépare »
// un innocent — indices fabriqués, isolement. Quand l'audit tombe, la
// Suspicion se reporte sur lui. C'est ce qui rend les coups lourds
// jouables sans game over automatique.
//
// Trois garde-fous, sans lesquels la mécanique casserait le jeu :
//   1. la préparation est un JET, pas un achat ;
//   2. elle PÉRIME (un dossier monté il y a deux mois ne tient plus) ;
//   3. elle se CONSOMME à l'audit — et le prix, c'est qu'un innocent
//      part à ta place, ce que l'open space n'oublie pas.
// ─────────────────────────────────────────────────────────────
import type { Colleague, GameState } from '@state/schema';
import { getArchetype } from '@data/content';
import { balance } from '@data/balance';
import { aliveColleagues, clamp, getColleague } from './util';
import type { ActionResult } from './actions';
import type { Rng } from './rng';

export const SCAPEGOAT_FLAG = 'bouc_emissaire';
const SINCE_PREFIX = 'bouc_since:';

/** Le bouc émissaire actuellement prêt, s'il y en a un. */
export function scapegoatOf(state: GameState): Colleague | undefined {
  return aliveColleagues(state).find((c) => c.flags.includes(SCAPEGOAT_FLAG));
}

/** Semaines restantes avant que le montage ne se périme. */
export function scapegoatWeeksLeft(state: GameState, c: Colleague): number {
  const marker = c.flags.find((f) => f.startsWith(SINCE_PREFIX));
  if (!marker) return 0;
  const since = Number(marker.slice(SINCE_PREFIX.length));
  return Math.max(0, balance.scapegoat.staleWeeks - (state.week - since));
}

/** Peut-on monter un dossier sur cette personne maintenant ? */
export function canPrepareScapegoat(state: GameState, c: Colleague): boolean {
  if (!c.alive) return false;
  if (c.flags.includes(SCAPEGOAT_FLAG)) return false;
  // Un seul montage à la fois : deux coupables désignés, c'est aucun.
  if (scapegoatOf(state)) return false;
  return state.player.stats.combine >= balance.scapegoat.combineRequired;
}

/**
 * Probabilité (0–100) de réussir le montage.
 * Quelqu'un qui te fait confiance ne voit rien venir : l'opinion aide.
 * Un vigilant, lui, retrouve ses affaires déplacées.
 */
export function prepareChance(state: GameState, c: Colleague): number {
  const cfg = balance.scapegoat;
  const vigilance = getArchetype(c.archetype)?.baseVigilance ?? 40;
  const raw =
    cfg.baseChance +
    state.player.stats.combine * cfg.combineWeight +
    c.opinion * cfg.opinionWeight -
    vigilance * cfg.vigilanceWeight;
  return Math.round(clamp(raw, 10, 90));
}

/** Monte le dossier. Coûte 1 PA (débité par le store). */
export function prepareScapegoat(state: GameState, colleagueId: string, rng: Rng): ActionResult {
  const c = getColleague(state, colleagueId);
  if (!c || !canPrepareScapegoat(state, c)) {
    return { ok: false, text: 'Impossible de monter un dossier sur cette personne.', tone: 'neutral' };
  }
  const cfg = balance.scapegoat;
  const chance = prepareChance(state, c);

  if (!rng.chance(chance)) {
    state.suspicion = clamp(state.suspicion + cfg.suspicionOnFail, 0, 100);
    c.opinion = clamp(c.opinion + cfg.opinionOnFail, -100, 100);
    return {
      ok: true,
      tone: 'bad',
      text: `${c.name} t'a vu fouiller dans ses affaires. +${cfg.suspicionOnFail} Suspicion. (${chance}% — raté)`,
    };
  }

  c.flags.push(SCAPEGOAT_FLAG);
  c.flags.push(`${SINCE_PREFIX}${state.week}`);
  state.suspicion = clamp(state.suspicion + cfg.suspicionOnPrepare, 0, 100);
  return {
    ok: true,
    tone: 'neutral',
    text: `Le dossier sur ${c.name} tient debout. En cas d'audit, il partira à ta place. (${chance}% — réussi)`,
  };
}

/** Retire le montage d'une personne (péremption ou consommation). */
function clearScapegoat(c: Colleague): void {
  c.flags = c.flags.filter((f) => f !== SCAPEGOAT_FLAG && !f.startsWith(SINCE_PREFIX));
}

export interface ScapegoatNote {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Vendredi : un montage trop vieux ne tient plus devant un auditeur. */
export function tickScapegoat(state: GameState): ScapegoatNote[] {
  const c = scapegoatOf(state);
  if (!c) return [];
  if (scapegoatWeeksLeft(state, c) > 0) return [];
  clearScapegoat(c);
  return [
    {
      tone: 'bad',
      text: `Le dossier monté sur ${c.name} a pris la poussière. Il ne tiendrait plus devant un auditeur.`,
    },
  ];
}

/**
 * L'audit désigne le bouc émissaire. Il part ; toi, tu restes.
 * L'open space, lui, a des yeux : voir un innocent sauter coûte
 * de l'estime à tout le monde.
 */
export function burnScapegoat(state: GameState): string | undefined {
  const c = scapegoatOf(state);
  if (!c) return undefined;
  const cfg = balance.scapegoat;

  clearScapegoat(c);
  c.alive = false;
  c.intent = undefined;

  for (const other of aliveColleagues(state)) {
    other.opinion = clamp(other.opinion + cfg.auditWitnessOpinion, -100, 100);
  }
  state.suspicion = clamp(state.suspicion - cfg.auditSuspicionRelief, 0, 100);
  return c.name;
}
