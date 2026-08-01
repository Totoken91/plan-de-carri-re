// ─────────────────────────────────────────────────────────────
// romance.ts — Ce qui se passe entre les gens, et ce que ça coûte.
//
// Décision de conception qui structure tout le module : l'ATTACHEMENT
// n'est pas l'OPINION. Une histoire peut monter avec quelqu'un qui te
// méprise professionnellement, et l'inverse arrive tout autant. Les
// confondre aurait ramené la romance à « une opinion qui monte plus
// vite », c'est-à-dire à rien.
//
// Ce qui les relie, en revanche, c'est le RISQUE. Tant que ça reste
// discret, une liaison ne produit aucun effet public. Dès que ça se sait
// — parce qu'on s'est fait surprendre, ou parce qu'on a officialisé —,
// trois choses arrivent d'un coup :
//
//   · les autres histoires en cours s'effondrent (la jalousie) ;
//   · l'open space a un avis, donc l'opinion générale bouge ;
//   · les RH ont un dossier, donc la suspicion monte.
//
// Un couple officiel, lui, garantit un plancher d'opinion et rend des
// nerfs chaque semaine. C'est la contrepartie : on gagne un allié qui ne
// vous lâchera pas, et on perd la discrétion pour toujours.
// ─────────────────────────────────────────────────────────────
import type { Colleague, GameState, LogEntry, Romance, RomanceStatut } from '@state/schema';
import { balance } from '@data/balance';
import { clamp } from './util';
import { raiseSuspicion } from './suspicion';
import type { Rng } from './rng';

const R = balance.romance;

export interface RomanceResult {
  ok: boolean;
  text: string;
  tone: LogEntry['tone'];
}

const VIDE: Romance = { niveau: 0, statut: 'rien', semaines: 0, connu: false };

export function romanceDe(c: Colleague): Romance {
  return c.romance ?? VIDE;
}

/**
 * Statut déduit de l'attachement.
 *
 * `couple` et `ex` ne s'en déduisent PAS : ce sont des décisions, pas des
 * seuils. On ne devient pas un couple parce qu'un compteur a dépassé 75,
 * on le devient parce que quelqu'un l'a annoncé.
 */
function statutPour(niveau: number, actuel: RomanceStatut): RomanceStatut {
  if (actuel === 'couple' || actuel === 'ex') return actuel;
  if (niveau >= R.seuilLiaison) return 'liaison';
  if (niveau >= R.seuilFlirt) return 'flirt';
  return 'rien';
}

function assure(c: Colleague): Romance {
  if (!c.romance) c.romance = { ...VIDE };
  return c.romance;
}

/** Fait bouger l'attachement et recalcule le statut. Renvoie le delta appliqué. */
export function ajusterAttachement(c: Colleague, delta: number): number {
  const r = assure(c);
  const avant = r.niveau;
  r.niveau = clamp(r.niveau + delta, 0, 100);
  const nouveau = statutPour(r.niveau, r.statut);
  if (nouveau !== r.statut) {
    r.statut = nouveau;
    r.semaines = 0;
  }
  return r.niveau - avant;
}

export const conjointDe = (state: GameState): Colleague | undefined =>
  state.colleagues.find((c) => c.alive && c.romance?.statut === 'couple');

/** Toutes les histoires en cours, hors celle qu'on vient de rendre publique. */
const autresHistoires = (state: GameState, saufId: string): Colleague[] =>
  state.colleagues.filter(
    (c) =>
      c.alive &&
      c.id !== saufId &&
      c.romance &&
      c.romance.statut !== 'rien' &&
      c.romance.statut !== 'ex',
  );

/**
 * Rendre une histoire publique. Le moment le plus cher du système.
 *
 * Toutes les autres liaisons en cours le prennent en pleine figure — pas
 * seulement leur attachement, leur opinion aussi. C'est la règle qui rend
 * le harem coûteux sans l'interdire : on peut mener trois histoires de
 * front, mais la première qui s'ébruite fait tomber les deux autres.
 */
function ebruiter(state: GameState, c: Colleague): string[] {
  const notes: string[] = [];
  const r = assure(c);
  if (r.connu) return notes;
  r.connu = true;

  for (const autre of autresHistoires(state, c.id)) {
    autre.opinion = clamp(autre.opinion + R.jalousieOpinion, -100, 100);
    const perdu = ajusterAttachement(autre, -autre.romance!.niveau);
    autre.romance!.statut = 'ex';
    if (perdu !== 0) {
      notes.push(`${autre.name} l'apprend en même temps que tout le monde. C'est terminé.`);
    }
  }
  return notes;
}

// ── Actions ──────────────────────────────────────────────────
/** Draguer : le premier pas, au bureau, sous les néons. Coûte 1 PA. */
export function draguer(state: GameState, colleagueId: string, rng: Rng): RomanceResult {
  const c = state.colleagues.find((x) => x.id === colleagueId && x.alive);
  if (!c) return { ok: false, text: 'Cette personne n’est plus dans les effectifs.', tone: 'neutral' };

  const conjoint = conjointDe(state);
  if (conjoint && conjoint.id !== c.id) {
    return {
      ok: false,
      text: `Tu es officiellement avec ${conjoint.name}. Il faudrait d’abord régler ça.`,
      tone: 'neutral',
    };
  }
  if (romanceDe(c).statut === 'ex') {
    return { ok: false, text: `${c.name} a déjà donné.`, tone: 'neutral' };
  }

  // L'opinion ne fait pas l'attachement, mais elle décide si la personne
  // vous écoute assez longtemps pour qu'il puisse naître.
  const seuil = R.draguerOpinionMin - state.player.stats.aura * 0.25;
  if (c.opinion < seuil) {
    c.opinion = clamp(c.opinion - 4, -100, 100);
    state.player.stats.nerfs = clamp(state.player.stats.nerfs - 5, 0, 100);
    return {
      ok: true,
      text: `${c.name} coupe court. Tu retournes à ton poste avec le sentiment d’avoir mal lu la pièce.`,
      tone: 'bad',
    };
  }

  const bonus = Math.round(state.player.stats.aura * 0.12 + rng.int(0, 6));
  const gagne = ajusterAttachement(c, R.draguerGain + bonus);
  state.player.stats.nerfs = clamp(state.player.stats.nerfs + R.draguerNerfs, 0, 100);
  const r = romanceDe(c);

  return {
    ok: true,
    text:
      r.statut === 'liaison'
        ? `Vous ne parlez plus vraiment de travail. (+${gagne} attachement — liaison)`
        : `${c.name} rit trop fort à quelque chose qui n’était pas drôle. (+${gagne} attachement)`,
    tone: 'good',
  };
}

/**
 * Les toilettes du troisième. Le plus gros gain d'attachement du jeu, et
 * la seule action qui peut rendre une histoire publique CONTRE ta volonté.
 *
 * Le risque n'est pas décoratif : se faire surprendre déclenche
 * l'ébruitement complet, avec la jalousie et l'audit qui vont avec.
 */
export function toilettes(state: GameState, colleagueId: string, rng: Rng): RomanceResult {
  const c = state.colleagues.find((x) => x.id === colleagueId && x.alive);
  if (!c) return { ok: false, text: 'Cette personne n’est plus dans les effectifs.', tone: 'neutral' };

  const r = romanceDe(c);
  if (r.niveau < R.seuilLiaison) {
    return {
      ok: false,
      text: `Il faut d’abord en arriver là. (${r.niveau} / ${R.seuilLiaison} d’attachement)`,
      tone: 'neutral',
    };
  }

  const gagne = ajusterAttachement(c, R.toilettesGain);
  raiseSuspicion(state, R.toilettesSuspicion);
  state.player.stats.nerfs = clamp(state.player.stats.nerfs + 6, 0, 100);

  // Discrétion : la Combine sert enfin à quelque chose d'utile.
  const risque = Math.max(6, R.toilettesRisque - state.player.stats.combine * 0.35);
  if (rng.chance(risque)) {
    const notes = ebruiter(state, c);
    raiseSuspicion(state, R.toilettesScandaleSuspicion);
    for (const autre of state.colleagues) {
      if (autre.alive && autre.id !== c.id) {
        autre.opinion = clamp(autre.opinion + R.toilettesScandaleOpinion, -100, 100);
      }
    }
    return {
      ok: true,
      text:
        `Quelqu’un attendait devant la porte. À midi, tout l’étage sait. ` +
        `(+${gagne} attachement, mais l’affaire est publique)` +
        (notes.length ? ` ${notes.join(' ')}` : ''),
      tone: 'bad',
    };
  }

  return {
    ok: true,
    text: `Sept minutes. Vous ressortez à deux minutes d’intervalle, comme des professionnels. (+${gagne} attachement)`,
    tone: 'good',
  };
}

/** Officialiser : on assume, et on en paie le prix une bonne fois. */
export function officialiser(state: GameState, colleagueId: string): RomanceResult {
  const c = state.colleagues.find((x) => x.id === colleagueId && x.alive);
  if (!c) return { ok: false, text: 'Cette personne n’est plus dans les effectifs.', tone: 'neutral' };

  const r = romanceDe(c);
  if (r.niveau < R.seuilCouple) {
    return {
      ok: false,
      text: `Trop tôt. (${r.niveau} / ${R.seuilCouple} d’attachement)`,
      tone: 'neutral',
    };
  }
  const deja = conjointDe(state);
  if (deja) {
    return {
      ok: false,
      text: `Tu es déjà officiellement avec ${deja.name}.`,
      tone: 'neutral',
    };
  }

  const notes = ebruiter(state, c);
  assure(c).statut = 'couple';
  assure(c).semaines = 0;
  c.opinion = clamp(c.opinion + R.officialiserOpinion, -100, 100);
  raiseSuspicion(state, R.officialiserSuspicion);

  return {
    ok: true,
    text:
      `Vous arrivez ensemble le lundi. Les RH prennent note, l’étage aussi. ` +
      `${c.name} est désormais ton point fixe.` +
      (notes.length ? ` ${notes.join(' ')}` : ''),
    tone: 'good',
  };
}

/** Rompre. Il faut parfois le faire, et ça ne se passe jamais bien. */
export function rompre(state: GameState, colleagueId: string): RomanceResult {
  const c = state.colleagues.find((x) => x.id === colleagueId && x.alive);
  if (!c?.romance || c.romance.statut === 'rien' || c.romance.statut === 'ex') {
    return { ok: false, text: 'Il n’y a rien à rompre.', tone: 'neutral' };
  }
  const etaitPublic = c.romance.connu;
  c.romance.niveau = 0;
  c.romance.statut = 'ex';
  c.romance.semaines = 0;
  c.opinion = clamp(c.opinion + balance.romance.rupture.opinion, -100, 100);
  if (etaitPublic) {
    raiseSuspicion(state, balance.romance.rupture.suspicion);
    for (const autre of state.colleagues) {
      if (autre.alive && autre.id !== c.id) autre.opinion = clamp(autre.opinion - 3, -100, 100);
    }
  }
  return {
    ok: true,
    text: etaitPublic
      ? `C’est fini avec ${c.name}, et tout le monde a un avis là-dessus.`
      : `C’est fini avec ${c.name}. Personne ne saura jamais que ça avait commencé.`,
    tone: 'bad',
  };
}

// ── Le vendredi soir ─────────────────────────────────────────
export interface NoteRomance {
  text: string;
  tone: LogEntry['tone'];
}

/**
 * Entretien hebdomadaire des histoires.
 *
 * Une liaison qu'on ne nourrit pas s'éteint : c'est ce qui empêche
 * d'accumuler des conquêtes en fond de tiroir et de les ressortir à la
 * semaine 30. Un couple officiel, lui, ne dérive pas — c'est précisément
 * ce qu'on achète en officialisant.
 */
export function tickRomance(state: GameState): NoteRomance[] {
  const notes: NoteRomance[] = [];

  for (const c of state.colleagues) {
    if (!c.alive || !c.romance) continue;
    const r = c.romance;
    r.semaines += 1;

    if (r.statut === 'couple') {
      // Le plancher d'opinion : un conjoint ne devient jamais un ennemi
      // ordinaire, même quand tout le reste s'écroule.
      if (c.opinion < R.conjointOpinionPlancher) c.opinion = R.conjointOpinionPlancher;
      state.player.stats.nerfs = clamp(state.player.stats.nerfs + R.conjointNerfs, 0, 100);
      continue;
    }
    if (r.statut === 'rien' || r.statut === 'ex') continue;

    const avant: RomanceStatut = r.statut;
    ajusterAttachement(c, R.derivePasEntretenue);
    // Relu par l'accesseur : `ajusterAttachement` mute le statut, mais le
    // typage l'a figé au moment du test précédent. Repasser par une
    // fonction est la seule relecture que le rétrécissement ne suit pas.
    const apres: RomanceStatut = romanceDe(c).statut;
    if (avant === 'liaison' && apres === 'flirt') {
      notes.push({ text: `Avec ${c.name}, ça retombe. On se recroise à la machine, c'est tout.`, tone: 'neutral' });
    } else if (avant === 'flirt' && apres === 'rien') {
      notes.push({ text: `${c.name} ne relance plus. L'histoire n'aura pas eu lieu.`, tone: 'neutral' });
    }
  }

  return notes;
}
