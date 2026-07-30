// ─────────────────────────────────────────────────────────────
// actions.ts — Les 5 actions de base (lundi → vendredi).
// Chacune coûte 1 point d'action et mute l'état (cloné par le store).
// La mécanique est en code ; les magnitudes vivent dans balance.json.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { balance } from '@data/balance';
import { getPlanDef } from '@data/content';
import { clamp, getColleague } from './util';
import { canStartPlan, startPlan } from './plans';
import type { Rng } from './rng';

export type ActionKind = 'bosser' | 'cafe' | 'fouiner' | 'comploter' | 'glander';

export interface ActionResult {
  ok: boolean;
  text: string;
  tone: 'neutral' | 'good' | 'bad';
}

const good = (text: string): ActionResult => ({ ok: true, text, tone: 'good' });
const neutral = (text: string): ActionResult => ({ ok: true, text, tone: 'neutral' });
const bad = (text: string): ActionResult => ({ ok: true, text, tone: 'bad' });
const fail = (text: string): ActionResult => ({ ok: false, text, tone: 'neutral' });

const adjust = (state: GameState, key: keyof GameState['player']['stats'], delta: number) => {
  state.player.stats[key] = clamp(state.player.stats[key] + delta, 0, 100);
};

/**
 * Facteur de rendement décroissant : répéter la MÊME action de base dans la
 * semaine rapporte de moins en moins (1 → 0,6 → 0,36 …). L'anti-spam : la
 * variété et les opportunités deviennent le bon jeu.
 */
function diminishing(state: GameState, key: string): number {
  const count = state.weeklyActionCounts[key] ?? 0;
  state.weeklyActionCounts[key] = count + 1;
  return Math.pow(0.6, count);
}

/** Bosser un projet : +Rendement, +réputation légitime, −Nerfs (rendement décroissant). */
export function actBosser(state: GameState): ActionResult {
  const cfg = balance.actions.bosser;
  const f = diminishing(state, 'bosser');
  const rendement = Math.round(cfg.rendement * f);
  const reputation = Math.round(cfg.reputation * f);
  adjust(state, 'rendement', rendement);
  adjust(state, 'nerfs', cfg.nerfs); // le coût nerveux, lui, ne diminue pas
  state.player.reputation += reputation;
  const worn = f < 0.9 ? ' (rendement en baisse — tu tournes en rond)' : '';
  return good(`Tu abats du travail. +${rendement} Rendement, +${reputation} réput., ${cfg.nerfs} Nerfs.${worn}`);
}

/** Machine à café : réseauter avec un collègue → +son opinion. */
export function actCafe(state: GameState, targetId: string): ActionResult {
  const c = getColleague(state, targetId);
  if (!c || !c.alive) return fail('Ce collègue est introuvable près de la machine à café.');
  const cfg = balance.actions.cafe;
  c.opinion = clamp(c.opinion + cfg.opinion, -100, 100);
  adjust(state, 'nerfs', cfg.nerfs);
  return good(`Café avec ${c.name}. Son opinion grimpe (+${cfg.opinion}).`);
}

/** Fouiner : chercher un secret sur une cible. Risque de +Suspicion. */
export function actFouiner(state: GameState, targetId: string, rng: Rng): ActionResult {
  const c = getColleague(state, targetId);
  if (!c || !c.alive) return fail('Personne à fouiner ici.');
  const cfg = balance.actions.fouiner;

  // Se faire griller ?
  if (rng.chance(cfg.suspicionRisk)) {
    state.suspicion = clamp(state.suspicion + cfg.suspicionOnCaught, 0, 100);
    return bad(`On t'a vu fouiner ${c.name}. La Suspicion monte (+${cfg.suspicionOnCaught}).`);
  }

  const hidden = c.secrets.filter((s) => !s.discovered);
  if (hidden.length === 0) {
    return neutral(`Tu fouines ${c.name}, mais tu ne trouves plus rien de neuf.`);
  }
  const found = rng.pick(hidden)!;
  found.discovered = true;
  return good(`Tu découvres un secret sur ${c.name} : « ${found.label} »`);
}

/**
 * Comploter : lancer un plan ou faire avancer sa préparation.
 * Coût en Suspicion proportionnel à la préparation gagnée.
 */
export function actComploter(
  state: GameState,
  planDefId: string,
  targetId: string | undefined,
): ActionResult {
  const def = getPlanDef(planDefId);
  if (!def) return fail('Ce plan n’existe pas.');
  const cfg = balance.actions.comploter;

  let plan = state.activePlans.find((p) => p.defId === planDefId);
  if (!plan) {
    if (!canStartPlan(state, def, targetId)) {
      return fail(`Tu ne remplis pas les conditions pour lancer « ${def.name} ».`);
    }
    startPlan(state, planDefId, targetId);
    plan = state.activePlans.find((p) => p.defId === planDefId)!;
    state.suspicion = clamp(state.suspicion + cfg.suspicionPerPrep, 0, 100);
    return neutral(`Tu lances « ${def.name} ». Préparation en cours.`);
  }

  plan.preparation = clamp(plan.preparation + cfg.preparationGain, 0, 100);
  state.suspicion = clamp(state.suspicion + cfg.suspicionPerPrep, 0, 100);
  return neutral(`Tu avances « ${def.name} » (préparation ${plan.preparation}/100).`);
}

/** Glander : +Nerfs (récupération décroissante). Un Fayot peut te griller. */
export function actGlander(state: GameState, rng: Rng): ActionResult {
  const cfg = balance.actions.glander;
  const f = diminishing(state, 'glander');
  const nerfs = Math.round(cfg.nerfs * f);
  adjust(state, 'nerfs', nerfs);

  const fayotWatching = state.colleagues.some(
    (c) => c.alive && c.archetype === 'fayot' && c.opinion < 20,
  );
  if (fayotWatching && rng.chance(40)) {
    state.suspicion = clamp(state.suspicion + cfg.fayotSuspicion, 0, 100);
    return bad(`Tu récupères (+${nerfs} Nerfs)… mais un Fayot t'a repéré. +${cfg.fayotSuspicion} Suspicion.`);
  }
  const worn = f < 0.9 ? ' (tu culpabilises, ça repose moins)' : '';
  return good(`Tu glandes tranquillement. +${nerfs} Nerfs.${worn}`);
}
