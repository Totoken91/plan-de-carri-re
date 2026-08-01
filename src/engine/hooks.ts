// ─────────────────────────────────────────────────────────────
// hooks.ts — Utiliser un secret découvert comme levier (façon « hook » CK3).
// Un secret non dépensé permet un coup social fort, puis se consomme.
// ─────────────────────────────────────────────────────────────
import type { GameState, Secret } from '@state/schema';
import { clamp, getColleague } from './util';
import type { ActionResult } from './actions';
import { raiseSuspicion } from './suspicion';

export type HookMode = 'coerce' | 'expose';

/** Secrets exploitables (découverts et non encore consommés) d'une cible. */
export function availableHooks(state: GameState, colleagueId: string): Secret[] {
  const c = getColleague(state, colleagueId);
  if (!c) return [];
  return c.secrets.filter((s) => s.discovered && !s.spent);
}

/**
 * Utilise un secret. `coerce` : le collègue passe dans ta poche (peur/loyauté).
 * `expose` : tu balances le secret, il en pâtit — mais ça se remarque.
 * Coûte 1 PA et consomme le secret.
 */
export function useHook(
  state: GameState,
  colleagueId: string,
  secretId: string,
  mode: HookMode,
): ActionResult {
  const c = getColleague(state, colleagueId);
  if (!c || !c.alive) return { ok: false, text: 'Cible introuvable.', tone: 'neutral' };
  const secret = c.secrets.find((s) => s.id === secretId && s.discovered && !s.spent);
  if (!secret) return { ok: false, text: 'Aucun levier exploitable.', tone: 'neutral' };

  secret.spent = true;
  const weight = secret.severity;

  if (mode === 'coerce') {
    c.opinion = clamp(c.opinion + Math.round(30 + weight * 0.2), -100, 100);
    if (!c.flags.includes('sous_emprise')) c.flags.push('sous_emprise');
    return {
      ok: true,
      tone: 'neutral',
      text: `Tu fais comprendre à ${c.name} que tu sais. Te voilà avec un appui contraint (+opinion, sous emprise).`,
    };
  }

  // expose
  c.opinion = clamp(c.opinion - Math.round(20 + weight * 0.3), -100, 100);
  if (!c.flags.includes('discredite')) c.flags.push('discredite');
  raiseSuspicion(state, 4);
  state.player.reputation += Math.round(weight * 0.15);
  return {
    ok: true,
    tone: 'bad',
    text: `Le secret de ${c.name} fuite « par accident ». Sa cote s'effondre. Toi, tu parais presque vertueux.`,
  };
}
