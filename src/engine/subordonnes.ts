// ─────────────────────────────────────────────────────────────
// subordonnes.ts — Les gens qui te doivent des comptes.
//
// C'est le pendant hiérarchique du système d'intentions : jusqu'ici, les
// collègues fabriquaient des choses de leur côté et tu réagissais. À
// partir d'un certain rang, tu peux fabriquer des choses PAR EUX.
//
// La règle qui empêche que ce soit gratuit : un subordonné n'exécute pas
// parce qu'il t'aime, il exécute parce que tu notes son entretien annuel.
// Son opinion ne décide donc PAS s'il obéit — elle décide s'il le fait
// bien, et surtout ce qu'il raconte ensuite. En dessous d'un certain
// ressentiment, l'ordre part quand même, et il te dénonce avec.
//
// C'est ce qui rend la délégation dangereuse plutôt que confortable :
// déléguer le sale boulot met le sale boulot dans la bouche de quelqu'un.
// ─────────────────────────────────────────────────────────────
import type { Colleague, GameState, LogEntry, OrdreKind } from '@state/schema';
import { balance } from '@data/balance';
import { getRank, rankOrder } from '@data/content';
import { clamp } from './util';
import { raiseSuspicion } from './suspicion';
import type { Rng } from './rng';

const S = balance.subordonnes;

export interface OrdreDef {
  kind: OrdreKind;
  nom: string;
  description: string;
  icone: string;
  /** Un ordre qui vise quelqu'un d'autre que le subordonné lui-même. */
  cible: boolean;
  /** Semaines avant résolution. */
  semaines: number;
}

/**
 * Le catalogue des ordres vit ici et non dans un JSON : chacun a une
 * résolution qui lui est propre (un jet, une cible, un effet), donc le
 * sortir en données ne donnerait qu'une liste de noms doublée d'un
 * `switch` — deux endroits à tenir au lieu d'un.
 */
export const ORDRES: OrdreDef[] = [
  {
    kind: 'produire',
    nom: 'Produire pour toi',
    description: 'Son travail remonte sous ton nom. C’est la définition du management.',
    icone: '📈',
    cible: false,
    semaines: 1,
  },
  {
    kind: 'rapporter',
    nom: 'Rapporter sur quelqu’un',
    description: 'Il t’apporte ce qu’il entend. Il entend beaucoup, on se méfie moins de lui.',
    icone: '👂',
    cible: true,
    semaines: 1,
  },
  {
    kind: 'couvrir',
    nom: 'Endosser',
    description: 'Il prend une part de ce qu’on te reproche. Il ne le pardonne pas.',
    icone: '🧯',
    cible: false,
    semaines: 1,
  },
  {
    kind: 'charmer',
    nom: 'Plaider ta cause',
    description: 'Il dit du bien de toi à quelqu’un. Ça vaut plus venant de lui que de toi.',
    icone: '🗣',
    cible: true,
    semaines: 1,
  },
  {
    kind: 'abattre',
    nom: 'Faire le nécessaire',
    description: 'Le sale boulot, sans que tes mains y soient. Sans que les siennes soient propres non plus.',
    icone: '🔨',
    cible: true,
    semaines: 2,
  },
];

export const getOrdre = (kind: OrdreKind): OrdreDef | undefined =>
  ORDRES.find((o) => o.kind === kind);

/** Combien de collègues peuvent t'être rattachés au rang courant. */
export const placesDeSubordonnes = (state: GameState): number =>
  getRank(state.player.rank)?.subordonnes ?? 0;

export const subordonnesDe = (state: GameState): Colleague[] =>
  state.colleagues.filter((c) => c.alive && c.subordonne);

/**
 * Quelqu'un peut-il t'être rattaché ? Il faut qu'il soit STRICTEMENT sous
 * toi dans la hiérarchie. Rattacher son égal, ce n'est pas manager, c'est
 * fantasmer.
 */
export function peutEtreRattache(state: GameState, c: Colleague): boolean {
  return c.alive && !c.subordonne && rankOrder(c.rank) < rankOrder(state.player.rank);
}

export interface SubResult {
  ok: boolean;
  text: string;
  tone: LogEntry['tone'];
}

export function rattacher(state: GameState, colleagueId: string): SubResult {
  const c = state.colleagues.find((x) => x.id === colleagueId);
  if (!c) return { ok: false, text: 'Introuvable.', tone: 'neutral' };
  if (subordonnesDe(state).length >= placesDeSubordonnes(state)) {
    return {
      ok: false,
      text: `Ton périmètre ne porte que ${placesDeSubordonnes(state)} personne(s). Il faut monter, ou détacher quelqu’un.`,
      tone: 'neutral',
    };
  }
  if (!peutEtreRattache(state, c)) {
    return { ok: false, text: `${c.name} n’est pas sous ta responsabilité.`, tone: 'neutral' };
  }
  c.subordonne = true;
  return {
    ok: true,
    text: `${c.name} figure désormais dans ton périmètre. Tu écris son évaluation de fin d’année.`,
    tone: 'good',
  };
}

export function detacher(state: GameState, colleagueId: string): SubResult {
  const c = state.colleagues.find((x) => x.id === colleagueId);
  if (!c?.subordonne) return { ok: false, text: 'Cette personne n’est pas dans ton périmètre.', tone: 'neutral' };
  c.subordonne = false;
  c.ordre = undefined;
  c.opinion = clamp(c.opinion - 6, -100, 100);
  return { ok: true, text: `${c.name} repasse sous une autre responsabilité. Il l’apprend par le SIRH.`, tone: 'neutral' };
}

/** Donne un ordre. Un subordonné n'en porte qu'un à la fois. */
export function donnerOrdre(
  state: GameState,
  colleagueId: string,
  kind: OrdreKind,
  targetId?: string,
): SubResult {
  const c = state.colleagues.find((x) => x.id === colleagueId);
  if (!c?.subordonne || !c.alive) {
    return { ok: false, text: 'Cette personne n’est pas dans ton périmètre.', tone: 'neutral' };
  }
  const def = getOrdre(kind);
  if (!def) return { ok: false, text: 'Ordre inconnu.', tone: 'neutral' };
  if (c.ordre) {
    return { ok: false, text: `${c.name} a déjà quelque chose sur le feu.`, tone: 'neutral' };
  }
  if (def.cible && !targetId) {
    return { ok: false, text: 'Il faut désigner quelqu’un.', tone: 'neutral' };
  }
  c.ordre = { kind, targetId, semaines: def.semaines };
  return {
    ok: true,
    text: `${c.name} s’y met. « ${def.nom} » — retour dans ${def.semaines} semaine(s).`,
    tone: 'neutral',
  };
}

// ── Résolution du vendredi ───────────────────────────────────
export interface NoteOrdre {
  text: string;
  tone: LogEntry['tone'];
}

/**
 * Résout les ordres arrivés à terme.
 *
 * La trahison est vérifiée AVANT l'effet, et elle ne l'annule pas : le
 * subordonné fait ce qu'on lui a demandé, puis va le raconter. C'est plus
 * juste et bien plus désagréable que « il refuse » — le joueur obtient ce
 * qu'il voulait et le paie quand même.
 */
export function resolveOrdres(state: GameState, rng: Rng): NoteOrdre[] {
  const notes: NoteOrdre[] = [];

  for (const c of state.colleagues) {
    if (!c.alive || !c.subordonne || !c.ordre) continue;
    c.ordre.semaines -= 1;
    if (c.ordre.semaines > 0) continue;

    const { kind, targetId } = c.ordre;
    c.ordre = undefined;
    const cible = targetId ? state.colleagues.find((x) => x.id === targetId && x.alive) : undefined;
    // Une compétence propre : un subordonné doué fait mieux que les autres.
    const talent = (c.stats.combine + c.stats.rendement) / 2;

    switch (kind) {
      case 'produire': {
        const gain = Math.round(S.produireReputation * (0.6 + talent / 120));
        state.player.reputation += gain;
        c.opinion = clamp(c.opinion - 3, -100, 100);
        notes.push({ text: `${c.name} a livré. Ça remonte sous ton nom (+${gain} réputation).`, tone: 'good' });
        break;
      }

      case 'rapporter': {
        if (!cible) break;
        if (rng.chance(S.rapporterChance + talent * 0.2)) {
          const cache = cible.secrets.find((s) => !s.discovered);
          if (cache) {
            cache.discovered = true;
            notes.push({
              text: `${c.name} a entendu quelque chose sur ${cible.name} : ${cache.label}.`,
              tone: 'good',
            });
          } else {
            notes.push({ text: `${c.name} a écouté ${cible.name} toute la semaine. Rien de neuf.`, tone: 'neutral' });
          }
        } else {
          cible.opinion = clamp(cible.opinion - 5, -100, 100);
          notes.push({
            text: `${cible.name} a compris que ${c.name} posait beaucoup de questions. Pour ton compte.`,
            tone: 'bad',
          });
        }
        break;
      }

      case 'couvrir': {
        raiseSuspicion(state, S.couvrirSuspicion);
        c.opinion = clamp(c.opinion + S.couvrirOpinion, -100, 100);
        notes.push({
          text: `${c.name} a endossé une partie de ce qu’on te reprochait. Il sait exactement ce qu’il a fait.`,
          tone: 'good',
        });
        break;
      }

      case 'charmer': {
        if (!cible) break;
        cible.opinion = clamp(cible.opinion + S.charmerOpinion, -100, 100);
        notes.push({ text: `${c.name} a plaidé ta cause auprès de ${cible.name}. Ça a pris.`, tone: 'good' });
        break;
      }

      case 'abattre': {
        if (!cible) break;
        const chance = S.abattreChance + talent * 0.35 - cible.stats.combine * 0.2;
        raiseSuspicion(state, S.abattreSuspicion);
        if (rng.chance(chance)) {
          cible.alive = false;
          cible.intent = undefined;
          notes.push({
            text: `Le dossier monté par ${c.name} a produit son effet. ${cible.name} n’est plus là, et ton nom n’apparaît nulle part.`,
            tone: 'good',
          });
        } else {
          cible.opinion = clamp(cible.opinion - 25, -100, 100);
          c.opinion = clamp(c.opinion - 12, -100, 100);
          notes.push({
            text: `${c.name} s’est fait prendre en montant le dossier sur ${cible.name}. Les deux savent pour qui il travaillait.`,
            tone: 'bad',
          });
        }
        break;
      }
    }

    // La trahison : elle vient APRÈS. On a eu ce qu'on voulait.
    if (c.alive && c.opinion <= S.trahisonSousOpinion && rng.chance(35)) {
      raiseSuspicion(state, S.trahisonSuspicion);
      notes.push({
        text: `${c.name} est allé raconter aux RH ce que tu lui fais faire. Il n’avait plus rien à perdre.`,
        tone: 'bad',
      });
    }
  }

  return notes;
}
