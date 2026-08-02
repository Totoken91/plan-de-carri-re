// ─────────────────────────────────────────────────────────────
// intents.ts — Ce que chaque collègue fabrique cette semaine.
//
// C'est la pièce qui rend le jeu lisible : au lieu d'un chiffre
// « opinion » opaque, chaque PNJ affiche une INTENTION au-dessus de
// sa tête, avec un compte à rebours. Le joueur voit les menaces se
// former et dépense ses PA à choisir lesquelles désamorcer.
//
// Cycle : assignIntents (lundi) → le joueur peut désamorcer →
//         resolveIntents (vendredi).
// ─────────────────────────────────────────────────────────────
import type { Colleague, GameState, Intent } from '@state/schema';
import { getArchetype, getRank } from '@data/content';
import { aliveColleagues, clamp, getColleague } from './util';
import type { ActionResult } from './actions';
import type { Rng } from './rng';
import { raiseSuspicion } from './suspicion';
import { traitBonus } from './traits';

// ── Fabriques d'intentions (le texte porte le jeu) ───────────
const PLOT_LABELS: Array<{ label: string; detail: string }> = [
  {
    label: 'Monte un dossier sur toi',
    detail: 'À terme : ta réputation encaisse et la hiérarchie te regarde de travers.',
  },
  {
    label: 'Prépare une réunion où tu ne seras pas',
    detail: 'À terme : tes projets changent de propriétaire pendant ton absence.',
  },
  {
    label: 'Fait remonter tes « écarts »',
    detail: 'À terme : perte de réputation et Suspicion en hausse.',
  },
];

function plot(rng: Rng): Intent {
  const v = rng.pick(PLOT_LABELS)!;
  return { kind: 'plot', label: v.label, detail: v.detail, icon: '🗂️', tone: 'threat', weeksLeft: 2 };
}

// Coups montés entre collègues : l'open space a ses propres guerres, et
// elles se jouent que tu regardes ou non. Pour toi, ce sont des leviers.
const SCHEME_LABELS = [
  'Monte un coup contre {victim}',
  'Prépare un dossier sur {victim}',
  'Travaille à faire sauter {victim}',
  'Instruit le procès de {victim}',
];

const REVENGE_LABELS = [
  'Rend la monnaie à {victim}',
  'Prépare sa revanche sur {victim}',
  'N’a pas digéré {victim}',
];

function scheme(rng: Rng, victim: Colleague, revenge = false): Intent {
  const labels = revenge ? REVENGE_LABELS : SCHEME_LABELS;
  return {
    kind: 'scheme',
    label: rng.pick(labels)!.replace('{victim}', victim.name),
    detail: `Si ça aboutit, ${victim.name} y laisse sa réputation — et ne pèsera plus grand-chose comme appui.`,
    icon: revenge ? '⚔️' : '🎯',
    tone: 'neutral',
    weeksLeft: 2,
    victimId: victim.id,
  };
}

/**
 * Qui se fait viser : le concurrent le plus menaçant pour le comploteur,
 * pris parmi les trois meilleurs rendements. Jamais un déjà discrédité —
 * on n'achève pas un dossier clos.
 */
function pickVictim(state: GameState, schemer: Colleague, rng: Rng): Colleague | undefined {
  const pool = aliveColleagues(state).filter(
    (c) => c.id !== schemer.id && !c.flags.includes('discredite'),
  );
  if (pool.length === 0) return undefined;
  const ranked = [...pool].sort((a, b) => b.stats.rendement - a.stats.rendement);
  return rng.pick(ranked.slice(0, Math.min(3, ranked.length)));
}

const watch = (): Intent => ({
  kind: 'watch',
  label: 'Te surveille',
  detail: 'Chaque semaine sous son œil fait monter la Suspicion.',
  icon: '👁️',
  tone: 'threat',
  weeksLeft: 1,
});

const gossip = (): Intent => ({
  kind: 'gossip',
  label: 'Colporte des ragots',
  detail: 'Finira par te lâcher un secret sur quelqu’un d’autre.',
  icon: '💬',
  tone: 'good',
  weeksLeft: 1,
});

const climb = (): Intent => ({
  kind: 'climb',
  label: 'Pousse sa propre carrière',
  detail: 'Prend du terrain. Le prochain palier sera plus disputé.',
  icon: '📈',
  tone: 'neutral',
  weeksLeft: 1,
});

const bond = (): Intent => ({
  kind: 'bond',
  label: 'Se rapproche de toi',
  detail: 'Son opinion va continuer de monter toute seule.',
  icon: '🤝',
  tone: 'good',
  weeksLeft: 1,
});

const idle = (): Intent => ({
  kind: 'idle',
  label: 'Rien de notable',
  detail: 'Fait son travail. Ça arrive.',
  icon: '·',
  tone: 'neutral',
  weeksLeft: 1,
});

/**
 * Le facteur « cible dans le dos » du rang courant.
 *
 * Il était présent dans les données depuis le début, commenté « plus tu
 * montes, plus on te cible », et n'était branché nulle part. Le banc
 * d'essai a rendu ce trou visible : sans lui, un joueur qui monte ne
 * subit rien de plus qu'un stagiaire, et gravir l'échelle en travaillant
 * sans jamais parler à personne ne comporte aucun risque.
 *
 * Il élargit maintenant la fenêtre d'hostilité — au sommet, il suffit
 * d'une opinion tiède pour qu'on monte un dossier — et alourdit le coup
 * quand il tombe.
 */
const cible = (state: GameState): number =>
  getRank(state.player.rank)?.backstabMultiplier ?? 1;

/** Choisit l'intention d'un collègue selon son archétype, son opinion et ta Suspicion. */
function buildIntent(c: Colleague, state: GameState, rng: Rng): Intent {
  const susp = state.suspicion;
  const m = cible(state);

  // Un collègue sous emprise ne complote plus contre toi.
  if (c.flags.includes('sous_emprise')) return c.opinion >= 30 ? bond() : idle();

  // Vendetta : qui s'est fait sortir la semaine dernière rend les coups.
  // C'est ce qui empêche un seul comploteur de démonter tout l'étage.
  const grudge = c.flags.find((f) => f.startsWith('rancune:'));
  if (grudge) {
    c.flags = c.flags.filter((f) => f !== grudge);
    const foe = getColleague(state, grudge.slice('rancune:'.length));
    if (foe?.alive && foe.id !== c.id) return scheme(rng, foe, true);
  }

  // Un comploteur qui ne t'a pas dans le viseur ne se repose pas pour
  // autant : il s'occupe d'un autre concurrent.
  const schemeOrElse = (fallback: Intent): Intent => {
    const victim = pickVictim(state, c, rng);
    return victim ? scheme(rng, victim) : fallback;
  };

  switch (c.archetype) {
    case 'carrieriste':
      return c.opinion < 25 * m ? plot(rng) : schemeOrElse(climb());
    case 'fayot':
      // Couler un collègue est encore le plus court chemin pour briller.
      return susp >= 35 && c.opinion < 30 * m ? watch() : schemeOrElse(climb());
    case 'parano':
      return susp >= 25 || c.opinion < -20 * m ? watch() : idle();
    case 'glandeur':
      return c.opinion >= 15 ? gossip() : idle();
    case 'veteran':
      if (c.opinion <= 20 * m - 40) return plot(rng);
      if (c.opinion >= 40) return bond();
      return schemeOrElse(idle()); // le vétéran connaît les dossiers de tout le monde
    case 'nouveau':
      return c.opinion >= 10 ? bond() : idle();
    default:
      return idle();
  }
}

/** Attribue une intention à tout collègue qui n'en a pas déjà une en cours. */
export function assignIntents(state: GameState, rng: Rng): void {
  for (const c of aliveColleagues(state)) {
    if (!c.intent) c.intent = buildIntent(c, state, rng);
  }
}

export interface IntentOutcome {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Révèle un secret non découvert sur un AUTRE collègue (effet du ragot). */
function leakSecret(state: GameState, from: Colleague, rng: Rng): string | undefined {
  const pool = aliveColleagues(state).filter((c) => c.id !== from.id);
  const candidates = pool.flatMap((c) =>
    c.secrets.filter((s) => !s.discovered).map((s) => ({ c, s })),
  );
  const found = rng.pick(candidates);
  if (!found) return undefined;
  found.s.discovered = true;
  return `${from.name} n'a pas su tenir sa langue : « ${found.s.label} » (sur ${found.c.name}).`;
}

/**
 * Résout les intentions du vendredi.
 * Les intentions à plusieurs semaines (complots) décrémentent sans se résoudre ;
 * elles restent visibles sur la carte, donc désamorçables jusqu'au bout.
 */
export function resolveIntents(state: GameState, rng: Rng): IntentOutcome[] {
  const out: IntentOutcome[] = [];

  for (const c of aliveColleagues(state)) {
    const intent = c.intent;
    if (!intent) continue;

    intent.weeksLeft -= 1;
    if (intent.weeksLeft > 0) continue; // encore en préparation : reste affiché

    const arch = getArchetype(c.archetype);

    switch (intent.kind) {
      case 'plot': {
        // Ton Aura amortit le coup : savoir se défendre en réunion, ça compte.
        const raw = (10 + c.stats.combine * 0.15) * cible(state);
        const loss = Math.max(3, Math.round(raw - state.player.stats.aura * 0.1));
        state.player.reputation = Math.max(0, state.player.reputation - loss);
        raiseSuspicion(state, 5);
        out.push({
          tone: 'bad',
          text: `${c.name} a déposé son dossier. −${loss} réputation, +5 Suspicion.`,
        });
        break;
      }
      case 'scheme': {
        const victim = getColleague(state, intent.victimId);
        if (!victim || !victim.alive) break;
        const chance = schemeChance(c, victim, intent);
        if (rng.chance(chance)) {
          victim.flags = victim.flags.filter(
            (f) => !f.startsWith('discredite_since:') && !f.startsWith('rancune:'),
          );
          if (!victim.flags.includes('discredite')) victim.flags.push('discredite');
          victim.flags.push(`discredite_since:${state.week}`);
          victim.flags.push(`rancune:${c.id}`); // la victime rendra les coups
          victim.stats.rendement = clamp(victim.stats.rendement - 8, 0, 100);
          c.stats.rendement = clamp(c.stats.rendement + 4, 0, 100);
          out.push({
            tone: 'neutral',
            text: `${c.name} a eu la peau de ${victim.name}. Compte-rendu accablant, silence gêné en réunion.`,
          });
        } else {
          c.stats.rendement = clamp(c.stats.rendement - 3, 0, 100);
          victim.opinion = clamp(victim.opinion + 3, -100, 100);
          out.push({
            tone: 'neutral',
            text: `Le coup de ${c.name} contre ${victim.name} a fait long feu. Tout le monde a vu la manœuvre.`,
          });
        }
        break;
      }
      case 'watch': {
        const add = Math.round(3 * (arch?.suspicionSensitivity ?? 1));
        raiseSuspicion(state, add);
        out.push({
          tone: 'bad',
          text: `${c.name} t'a eu à l'œil toute la semaine. +${add} Suspicion.`,
        });
        break;
      }
      case 'gossip': {
        const leak = leakSecret(state, c, rng);
        if (leak) out.push({ tone: 'good', text: leak });
        break;
      }
      case 'climb': {
        c.stats.rendement = clamp(c.stats.rendement + 3, 0, 100);
        out.push({
          tone: 'neutral',
          text: `${c.name} a brillé cette semaine. Le prochain palier sera plus disputé.`,
        });
        break;
      }
      case 'bond': {
        c.opinion = clamp(c.opinion + 6, -100, 100);
        out.push({ tone: 'good', text: `${c.name} se range un peu plus de ton côté.` });
        break;
      }
      case 'idle':
        break;
    }

    c.intent = undefined; // consommée : une nouvelle sera tirée lundi
  }

  return out;
}

/** Nombre de semaines pendant lesquelles une réputation reste entamée. */
const DISGRACE_WEEKS = 3;

/** Ce qu'une semaine de disgrâce coûte à la tenue de poste. */
const USURE_HEBDO = 4;

/** En dessous, le poste est « redéfini » et son titulaire s'en va. */
const PLANCHER_POSTE = 18;

/**
 * Retour en grâce : sans ça, chaque victime reste discréditée à vie et
 * l'open space finit en champ de ruines où plus personne ne pèse rien.
 */
export function tickRecovery(state: GameState): IntentOutcome[] {
  const out: IntentOutcome[] = [];

  // L'USURE, avant le retour en grâce.
  //
  // C'est la voie lente pour libérer une place, et elle manquait
  // complètement : tous les moyens d'écarter quelqu'un étaient des coups
  // d'éclat à forte Suspicion — un plan lourd, un cabinet à 4 200 €, un
  // bouc émissaire. Le banc d'essai montrait toutes les politiques se
  // faire licencier en essayant, parce qu'il n'existait aucune façon
  // PATIENTE de faire tomber quelqu'un.
  //
  // Maintenant, une réputation entamée s'entretient : tant qu'on est
  // discrédité, la tenue de poste s'effrite. En dessous du plancher, on
  // ne licencie personne — on redéfinit le poste. C'est plus long, moins
  // spectaculaire, presque invisible pour la hiérarchie. Autrement dit :
  // le bon jeu.
  for (const c of aliveColleagues(state)) {
    if (!c.flags.includes('discredite')) continue;
    c.stats.rendement = clamp(c.stats.rendement - USURE_HEBDO, 0, 100);
    if (c.stats.rendement <= PLANCHER_POSTE) {
      c.alive = false;
      c.intent = undefined;
      out.push({
        tone: 'neutral',
        text: `Le poste de ${c.name} a été « redéfini ». Il n'a pas été reconduit dessus. Personne n'a eu à décider quoi que ce soit.`,
      });
    }
  }

  for (const c of aliveColleagues(state)) {
    const marker = c.flags.find((f) => f.startsWith('discredite_since:'));
    if (!marker) continue;
    if (state.week - Number(marker.split(':')[1]) < DISGRACE_WEEKS) continue;

    c.flags = c.flags.filter((f) => f !== marker && f !== 'discredite');
    c.stats.rendement = clamp(c.stats.rendement + 5, 0, 100);
    out.push({
      tone: 'neutral',
      text: `${c.name} a fini de purger l'affaire. On recommence à lui confier des dossiers.`,
    });
  }
  return out;
}

/** Chances (0–100) qu'un coup monté entre collègues aboutisse. */
export function schemeChance(schemer: Colleague, victim: Colleague, intent: Intent): number {
  const vigilance = getArchetype(victim.archetype)?.baseVigilance ?? 40;
  const raw = 45 + schemer.stats.combine * 0.5 - vigilance * 0.4 + (intent.boost ?? 0);
  return Math.round(clamp(raw, 10, 92));
}

/** Le collègue monte-t-il un coup contre un autre, exploitable par toi ? */
export function activeScheme(
  state: GameState,
  c: Colleague,
): { intent: Intent; victim: Colleague } | undefined {
  if (c.intent?.kind !== 'scheme') return undefined;
  const victim = getColleague(state, c.intent.victimId);
  if (!victim || !victim.alive) return undefined;
  return { intent: c.intent, victim };
}

/**
 * Prévenir la victime : tu grilles le comploteur pour te faire un obligé.
 * Le coup tombe à l'eau, la cible t'en sait gré, le comploteur beaucoup moins.
 */
export function warnVictim(state: GameState, schemerId: string): ActionResult {
  const schemer = getColleague(state, schemerId);
  if (!schemer) return { ok: false, text: 'Cible introuvable.', tone: 'neutral' };
  const found = activeScheme(state, schemer);
  if (!found) return { ok: false, text: `${schemer.name} ne monte aucun coup.`, tone: 'neutral' };

  schemer.intent = undefined;
  found.victim.opinion = clamp(found.victim.opinion + 18, -100, 100);
  schemer.opinion = clamp(schemer.opinion - 10, -100, 100);
  return {
    ok: true,
    tone: 'good',
    text: `Tu glisses un mot à ${found.victim.name} avant que ça ne parte. Un obligé de plus, un rival vexé.`,
  };
}

/**
 * Alimenter le coup : tu fournis la pièce manquante. Le comploteur te
 * revaut ça, la victime se doute de quelque chose, et ça finit par se voir.
 */
export function abetScheme(state: GameState, schemerId: string): ActionResult {
  const schemer = getColleague(state, schemerId);
  if (!schemer) return { ok: false, text: 'Cible introuvable.', tone: 'neutral' };
  const found = activeScheme(state, schemer);
  if (!found) return { ok: false, text: `${schemer.name} ne monte aucun coup.`, tone: 'neutral' };
  if (found.intent.boost) {
    return { ok: false, text: 'Tu as déjà fourni ce qu’il fallait.', tone: 'neutral' };
  }

  found.intent.boost = 25;
  schemer.opinion = clamp(schemer.opinion + 14, -100, 100);
  found.victim.opinion = clamp(found.victim.opinion - 12, -100, 100);
  raiseSuspicion(state, 3);
  return {
    ok: true,
    tone: 'neutral',
    text: `Tu fournis la pièce manquante à ${schemer.name}. Le dossier contre ${found.victim.name} s'alourdit (+25% de réussite).`,
  };
}

/** Le désamorçage est-il pertinent sur cette cible ? */
export function canDefuse(c: Colleague): boolean {
  return !!c.intent && c.intent.tone === 'threat';
}

/** Probabilité (0–100) de désamorcer l'intention d'un collègue. */
export function defuseChance(state: GameState, c: Colleague): number {
  const vigilance = getArchetype(c.archetype)?.baseVigilance ?? 40;
  // Le désamorçage est la réponse que le jeu ANNONCE aux menaces
  // visibles. Mesuré, il était perdant : 24 % en début de partie, et
  // chaque échec rendait le suivant plus difficile. Une réponse
  // officielle qui échoue trois fois sur quatre n'est pas une réponse.
  const raw =
    48 +
    state.player.stats.aura * 0.7 +
    c.opinion * 0.15 -
    vigilance * 0.25 -
    state.suspicion * 0.1 +
    traitBonus(state, 'defuseChance');
  return Math.round(clamp(raw, 25, 90));
}

/**
 * Désamorcer : tu vas voir la personne avant que ça ne parte.
 * Réussi → l'intention saute et l'opinion remonte. Raté → ça se remarque.
 */
export function defuseIntent(state: GameState, colleagueId: string, rng: Rng): ActionResult {
  const c = getColleague(state, colleagueId);
  if (!c || !c.alive) return { ok: false, text: 'Cible introuvable.', tone: 'neutral' };
  if (!canDefuse(c)) {
    return { ok: false, text: `${c.name} ne prépare rien contre toi.`, tone: 'neutral' };
  }
  if (c.flags.includes(MISE_AU_POINT)) {
    return {
      ok: false,
      text: `Tu as déjà tenté le coup avec ${c.name} cette semaine. Y revenir maintenant, c'est insister.`,
      tone: 'neutral',
    };
  }

  const chance = defuseChance(state, c);
  c.flags.push(MISE_AU_POINT);
  if (rng.chance(chance)) {
    c.intent = undefined;
    c.opinion = clamp(c.opinion + 8, -100, 100);
    return {
      ok: true,
      tone: 'good',
      text: `Mise au point avec ${c.name}. Le sujet est « clos ». (${chance}% — réussi)`,
    };
  }

  raiseSuspicion(state, 3);
  c.opinion = clamp(c.opinion - 3, -100, 100);
  return {
    ok: true,
    tone: 'bad',
    text: `${c.name} n'a pas apprécié ta démarche. +3 Suspicion. (${chance}% — raté)`,
  };
}

/**
 * Une mise au point par personne et par semaine.
 *
 * Le banc d'essai a produit des parties où le joueur retentait cinq fois
 * de suite le même désamorçage à 20 % : chaque échec coûtait de la
 * Suspicion ET de l'opinion, donc faisait baisser la chance du coup
 * suivant. Cinq essais, vingt points de Suspicion, un audit, licencié
 * semaine 3 — en n'ayant rien fait de mal.
 *
 * Ce n'était pas une erreur de réglage : le jeu proposait une boucle
 * strictement perdante sans jamais la signaler. On la ferme.
 */
export const MISE_AU_POINT = 'mise_au_point';

/** Lundi : on peut de nouveau aller voir les gens. */
export function resetMisesAuPoint(state: GameState): void {
  for (const c of state.colleagues) {
    if (c.flags.includes(MISE_AU_POINT)) {
      c.flags = c.flags.filter((f) => f !== MISE_AU_POINT);
    }
  }
}
