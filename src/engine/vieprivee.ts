// ─────────────────────────────────────────────────────────────
// vieprivee.ts — Le résolveur commun des dépenses et des activités.
//
// Une dépense coûte de l'argent et des points d'action au bureau ; une
// activité coûte des points de week-end et rien d'autre. Tout le reste —
// le jet, l'application de l'`Effect`, le texte d'issue — est
// rigoureusement identique, donc il n'existe qu'une fois. Deux
// résolveurs séparés auraient fini par diverger sur un détail (l'ordre
// entre paiement et effet, par exemple), et cette divergence-là ne se
// voit qu'en jeu, tard.
//
// L'ordre est le point délicat : on VÉRIFIE tout, on PAIE, puis on
// applique. Payer après l'effet laisserait passer une dépense
// insolvable ; appliquer avant de vérifier la cible laisserait un effet
// orphelin.
// ─────────────────────────────────────────────────────────────
import type { DepenseDef, GameState, LogEntry } from '@state/schema';
import { getRank, rankOrder } from '@data/content';
import {
  appartRang,
  appartSuivant,
  getActivite,
  getAppart,
  getDepense,
  getMeuble,
  type ActiviteDef,
} from '@data/vieprivee';
import { euros, payer } from './argent';
import { applyEffect } from './effects';
import { checkCondition } from './conditions';
import { fillNames } from './util';
import type { Rng } from './rng';

export interface VieResult {
  ok: boolean;
  text: string;
  tone: LogEntry['tone'];
}

/** Pourquoi une dépense est indisponible — ou `undefined` si elle l'est. */
export function blocageDepense(state: GameState, d: DepenseDef, targetId?: string): string | undefined {
  if (d.minRank && rankOrder(state.player.rank) < rankOrder(d.minRank)) {
    return `Réservé aux ${getRank(d.minRank)?.name ?? d.minRank}.`;
  }
  if (d.requires && !checkCondition(d.requires, state, targetId)) return 'Tu n’as pas ce qu’il faut.';
  if (d.cible === 'colleague' && !targetId) return 'Il faut désigner quelqu’un.';
  if (state.argent < d.prix) return `Il te manque ${euros(d.prix - state.argent)}.`;
  if ((d.cout ?? 1) > state.actionPointsRemaining) return 'Plus assez de temps cette semaine.';
  const max = d.maxParSemaine ?? Infinity;
  if ((state.depensesSemaine[d.id] ?? 0) >= max) return 'Déjà fait cette semaine.';
  return undefined;
}

/**
 * Exécute une dépense. Le point d'action est débité par l'appelant (le
 * store), comme pour toutes les autres actions — sinon deux endroits
 * décideraient du coût en temps.
 */
export function resolveDepense(
  state: GameState,
  id: string,
  targetId: string | undefined,
  rng: Rng,
): VieResult {
  const d = getDepense(id);
  if (!d) return { ok: false, text: 'Dépense inconnue.', tone: 'neutral' };
  const blocage = blocageDepense(state, d, targetId);
  if (blocage) return { ok: false, text: blocage, tone: 'neutral' };

  if (!payer(state, d.prix)) return { ok: false, text: 'Fonds insuffisants.', tone: 'neutral' };
  state.depensesSemaine[d.id] = (state.depensesSemaine[d.id] ?? 0) + 1;

  const reussi = d.successChance === undefined || rng.chance(d.successChance);
  const effets = reussi ? d.effects : (d.failureEffects ?? {});
  applyEffect(state, effets, targetId);
  const texte = reussi ? d.outcomeText : (d.failureText ?? d.outcomeText);

  return {
    ok: true,
    text: `${fillNames(texte, state, targetId)} (−${euros(d.prix)})`,
    tone: reussi ? 'good' : 'bad',
  };
}

// ── Activités du week-end ────────────────────────────────────
export function blocageActivite(
  state: GameState,
  a: ActiviteDef,
  targetId?: string,
): string | undefined {
  if (a.cout > state.weekendPointsRemaining) return 'Le week-end n’est pas extensible.';
  if (a.cible === 'colleague' && !targetId) return 'Il faut choisir quelqu’un.';
  return undefined;
}

/**
 * Le bonus de mobilier : chaque meuble installé peut favoriser une
 * activité, en points de % ajoutés au jet ou en intensité de l'effet.
 * C'est ce qui fait que meubler n'est pas une collection mais un choix.
 */
export function bonusMobilier(state: GameState, cle: string): number {
  let total = 0;
  for (const id of state.appart.meubles) total += getMeuble(id)?.bonus?.[cle] ?? 0;
  return total;
}

export function resolveActivite(
  state: GameState,
  id: string,
  targetId: string | undefined,
  rng: Rng,
): VieResult {
  const a = getActivite(id);
  if (!a) return { ok: false, text: 'Activité inconnue.', tone: 'neutral' };
  const blocage = blocageActivite(state, a, targetId);
  if (blocage) return { ok: false, text: blocage, tone: 'neutral' };

  state.weekendPointsRemaining -= a.cout;
  const bonus = bonusMobilier(state, a.id);

  const reussi = a.successChance === undefined || rng.chance(a.successChance + bonus);
  const base = reussi ? a.effects : (a.failureEffects ?? {});

  // Le mobilier majore ce que l'activité rapporte, sans jamais changer sa
  // nature : un canapé rend une soirée plus efficace, il n'invente pas un
  // effet que l'activité n'avait pas.
  const effets =
    reussi && bonus > 0
      ? {
          ...base,
          targetOpinion: base.targetOpinion ? Math.round(base.targetOpinion * (1 + bonus / 50)) : undefined,
          romance: base.romance ? Math.round(base.romance * (1 + bonus / 50)) : undefined,
          reputation: base.reputation ? Math.round(base.reputation * (1 + bonus / 50)) : undefined,
        }
      : base;
  applyEffect(state, effets, targetId);

  // « Fouiller les réseaux » réussit : on découvre un secret. C'est
  // l'unique activité à effet non chiffrable, d'où le passage par le
  // drapeau générique plutôt que par un cas particulier ici.
  if (reussi && a.id === 'reseaux' && targetId) {
    applyEffect(state, { revealSecret: true }, targetId);
  }

  const texte = reussi ? a.outcomeText : (a.failureText ?? a.outcomeText);
  return { ok: true, text: fillNames(texte, state, targetId), tone: reussi ? 'good' : 'bad' };
}

// ── Logement et mobilier ─────────────────────────────────────
export function demenager(state: GameState): VieResult {
  const suivant = appartSuivant(state.appart.niveau);
  if (!suivant) return { ok: false, text: 'Tu es déjà tout en haut.', tone: 'neutral' };
  if (!payer(state, suivant.prix)) {
    return { ok: false, text: `Il te manque ${euros(suivant.prix - state.argent)}.`, tone: 'neutral' };
  }
  state.appart.niveau = suivant.id;
  return {
    ok: true,
    text: `Tu emménages : ${suivant.nom}. ${suivant.description}`,
    tone: 'good',
  };
}

export function acheterMeuble(state: GameState, id: string): VieResult {
  const m = getMeuble(id);
  if (!m) return { ok: false, text: 'Article inconnu.', tone: 'neutral' };
  if (state.appart.meubles.includes(id)) {
    return { ok: false, text: 'Tu l’as déjà.', tone: 'neutral' };
  }
  const places = getAppart(state.appart.niveau)?.places ?? 0;
  if (state.appart.meubles.length >= places) {
    return {
      ok: false,
      text: `Plus de place. ${places} meuble(s) maximum ici — il faudrait un logement plus grand.`,
      tone: 'neutral',
    };
  }
  if (!payer(state, m.prix)) {
    return { ok: false, text: `Il te manque ${euros(m.prix - state.argent)}.`, tone: 'neutral' };
  }
  state.appart.meubles.push(id);
  return { ok: true, text: `${m.nom} livré et installé. ${m.description}`, tone: 'good' };
}

/**
 * Revendre : moitié prix. Ce n'est pas une punition, c'est ce qui
 * empêche de traiter le mobilier comme une réserve de trésorerie.
 */
export function revendreMeuble(state: GameState, id: string): VieResult {
  const m = getMeuble(id);
  if (!m || !state.appart.meubles.includes(id)) {
    return { ok: false, text: 'Tu n’as pas ça.', tone: 'neutral' };
  }
  state.appart.meubles = state.appart.meubles.filter((x) => x !== id);
  const rendu = Math.round(m.prix / 2);
  state.argent += rendu;
  return { ok: true, text: `${m.nom} revendu pour ${euros(rendu)}. La moitié, comme toujours.`, tone: 'neutral' };
}

/** Effets hebdomadaires du mobilier, appliqués le vendredi. */
export function appliquerMobilierHebdo(state: GameState): void {
  for (const id of state.appart.meubles) {
    const hebdo = getMeuble(id)?.hebdo;
    if (hebdo) applyEffect(state, hebdo);
  }
}

/** Points d'action du week-end à venir, logement compris. */
export const pointsWeekend = (state: GameState): number =>
  getAppart(state.appart.niveau)?.pointsWeekend ?? 2;

/** Le standing du logement : ce qu'il vaut aux yeux d'un invité. */
export const standing = (state: GameState): number =>
  getAppart(state.appart.niveau)?.standing ?? 0;

export const rangLogement = (state: GameState): number => appartRang(state.appart.niveau);
