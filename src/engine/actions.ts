// ─────────────────────────────────────────────────────────────
// actions.ts — Les 5 actions de base (lundi → vendredi).
// Chacune coûte 1 point d'action et mute l'état (cloné par le store).
// La mécanique est en code ; les magnitudes vivent dans balance.json.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { balance } from '@data/balance';
import { getPlanDef } from '@data/content';
import { clamp, getColleague } from './util';
import { traitBonus, traitFactor } from './traits';
import { canStartPlan, startPlan } from './plans';
import type { Rng } from './rng';
import { easeSuspicion, raiseSuspicion } from './suspicion';

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
 *
 * Lecture SEULE — l'UI s'en sert pour annoncer l'impact avant le clic.
 */
export function diminishingFactor(state: GameState, key: string): number {
  return Math.pow(0.6, state.weeklyActionCounts[key] ?? 0);
}

// Le comptage lui-même n'est plus fait ici : le store enregistre TOUTES
// les actions de la semaine, pas seulement les deux qui s'émoussent.
// L'état porte donc « ce que le joueur a fait cette semaine », ce dont
// se servent aussi bien l'anti-spam que l'accueil guidé.
const diminishing = diminishingFactor;

// ── Quantités que les traits peuvent moduler ─────────────────
// Exposées en lecture seule : `preview.ts` les rappelle pour annoncer
// AVANT le clic exactement ce que l'action fera. Deux formules pour la
// même chose, c'est la garantie qu'elles divergent.

/** Coût en Nerfs (négatif) après traits. */
export function nerfCost(state: GameState, base: number): number {
  return -Math.round(Math.abs(base) * traitFactor(state, 'nerfsCost'));
}

/** Gain d'opinion après traits. */
export function opinionGain(state: GameState, base: number): number {
  return Math.round(base * traitFactor(state, 'opinionGain'));
}

/** Risque de se faire surprendre en fouinant, après traits. */
export function caughtRisk(state: GameState, base: number): number {
  return clamp(base - traitBonus(state, 'secretChance'), 0, 100);
}

/** Bosser un projet : +Rendement, +réputation légitime, −Nerfs (rendement décroissant). */
export function actBosser(state: GameState): ActionResult {
  const cfg = balance.actions.bosser;
  const f = diminishing(state, 'bosser');
  const rendement = Math.round(cfg.rendement * f);
  const reputation = Math.round(cfg.reputation * f * traitFactor(state, 'reputationGain'));
  const nerfs = nerfCost(state, cfg.nerfs);
  adjust(state, 'rendement', rendement);
  adjust(state, 'nerfs', nerfs); // le coût nerveux, lui, ne diminue pas
  state.player.reputation += reputation;

  // Le travail visible est le meilleur alibi qui existe, et c'est la
  // SEULE façon de faire redescendre la Suspicion sans sortir le
  // carnet de chèques. Le banc d'essai avait rendu le trou évident :
  // la Suspicion ne savait que monter, donc toute partie qui touchait
  // aux complots finissait licenciée, sans exception. Une jauge qu'on ne
  // peut pas redescendre n'est pas une tension, c'est un compte à
  // rebours.
  //
  // Le soulagement ne s'émousse PAS avec la répétition : c'est le
  // contraire du rendement décroissant, parce que ce qui rassure la
  // hiérarchie, c'est justement la régularité.
  const cfg2 = balance.actions.bosser;
  easeSuspicion(state, -cfg2.suspicion);

  const worn = f < 0.9 ? ' (rendement en baisse — tu tournes en rond)' : '';
  return good(
    `Tu abats du travail. +${rendement} Rendement, +${reputation} réput., ${nerfs} Nerfs, ${cfg2.suspicion} Suspicion.${worn}`,
  );
}

/** Machine à café : réseauter avec un collègue → +son opinion. */
export function actCafe(state: GameState, targetId: string): ActionResult {
  const c = getColleague(state, targetId);
  if (!c || !c.alive) return fail('Ce collègue est introuvable près de la machine à café.');
  const cfg = balance.actions.cafe;
  const gain = opinionGain(state, cfg.opinion);
  c.opinion = clamp(c.opinion + gain, -100, 100);
  adjust(state, 'nerfs', nerfCost(state, cfg.nerfs));
  return good(`Café avec ${c.name}. Son opinion grimpe (+${gain}).`);
}

/**
 * Fouiner : chercher un secret sur une cible. Risque de +Suspicion.
 *
 * C'est aussi la seule ÉCOLE de Combine du jeu, et ça n'a rien d'un
 * détail : les plans, les montages et les hauts paliers de Combine
 * étaient jusqu'ici verrouillés derrière une statistique qu'aucune
 * action ne faisait monter. La moitié « intrigue » du jeu existait sur
 * le papier et restait fermée en pratique.
 *
 * On apprend même en se faisant prendre — surtout en se faisant prendre.
 */
export function actFouiner(state: GameState, targetId: string, rng: Rng): ActionResult {
  const c = getColleague(state, targetId);
  if (!c || !c.alive) return fail('Personne à fouiner ici.');
  const cfg = balance.actions.fouiner;
  // Rendement décroissant DANS la semaine, et rendement décroissant sur
  // la carrière : on n'apprend plus grand-chose à fouiller des tiroirs
  // quand on sait déjà tout faire. Sans ce second frein, cinq fouilles
  // par semaine amenaient au plus haut palier de Combine en huit
  // semaines, et les plans devenaient presque gratuits.
  const f = diminishing(state, 'fouiner');
  const marge = Math.max(0.15, 1 - state.player.stats.combine / 110);
  const metier = Math.max(1, Math.round(cfg.combine * f * marge));

  // Se faire griller ? Un fouineur aguerri se fait moins voir.
  if (rng.chance(caughtRisk(state, cfg.suspicionRisk))) {
    raiseSuspicion(state, cfg.suspicionOnCaught);
    adjust(state, 'combine', metier);
    return bad(
      `On t'a vu fouiner ${c.name}. +${cfg.suspicionOnCaught} Suspicion — et +${metier} Combine, parce qu'on retient surtout ce genre de leçon.`,
    );
  }

  adjust(state, 'combine', metier);
  const hidden = c.secrets.filter((s) => !s.discovered);
  if (hidden.length === 0) {
    return neutral(`Tu fouines ${c.name} sans rien trouver de neuf. +${metier} Combine tout de même.`);
  }
  const found = rng.pick(hidden)!;
  found.discovered = true;
  return good(`Tu découvres un secret sur ${c.name} : « ${found.label} » (+${metier} Combine)`);
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
    raiseSuspicion(state, cfg.suspicionPerPrep);
    adjust(state, 'combine', cfg.combine);
    return neutral(`Tu lances « ${def.name} ». Préparation en cours. +${cfg.combine} Combine.`);
  }

  plan.preparation = clamp(plan.preparation + cfg.preparationGain, 0, 100);
  raiseSuspicion(state, cfg.suspicionPerPrep);
  adjust(state, 'combine', cfg.combine);
  return neutral(
    `Tu avances « ${def.name} » (préparation ${plan.preparation}/100). +${cfg.combine} Combine.`,
  );
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
    raiseSuspicion(state, cfg.fayotSuspicion);
    return bad(`Tu récupères (+${nerfs} Nerfs)… mais un Fayot t'a repéré. +${cfg.fayotSuspicion} Suspicion.`);
  }
  const worn = f < 0.9 ? ' (tu culpabilises, ça repose moins)' : '';
  return good(`Tu glandes tranquillement. +${nerfs} Nerfs.${worn}`);
}
