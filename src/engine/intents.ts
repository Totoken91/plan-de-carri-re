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
import { getArchetype } from '@data/content';
import { aliveColleagues, clamp, getColleague } from './util';
import type { ActionResult } from './actions';
import type { Rng } from './rng';

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

/** Choisit l'intention d'un collègue selon son archétype, son opinion et ta Suspicion. */
function buildIntent(c: Colleague, state: GameState, rng: Rng): Intent {
  const susp = state.suspicion;

  // Un collègue sous emprise ne complote plus contre toi.
  if (c.flags.includes('sous_emprise')) return c.opinion >= 30 ? bond() : idle();

  switch (c.archetype) {
    case 'carrieriste':
      return c.opinion < 25 ? plot(rng) : climb();
    case 'fayot':
      return susp >= 35 && c.opinion < 30 ? watch() : climb();
    case 'parano':
      return susp >= 25 || c.opinion < -20 ? watch() : idle();
    case 'glandeur':
      return c.opinion >= 15 ? gossip() : idle();
    case 'veteran':
      if (c.opinion <= -30) return plot(rng);
      return c.opinion >= 40 ? bond() : idle();
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
        const raw = 10 + Math.round(c.stats.combine * 0.15);
        const loss = Math.max(3, raw - Math.round(state.player.stats.aura * 0.1));
        state.player.reputation = Math.max(0, state.player.reputation - loss);
        state.suspicion = clamp(state.suspicion + 5, 0, 100);
        out.push({
          tone: 'bad',
          text: `${c.name} a déposé son dossier. −${loss} réputation, +5 Suspicion.`,
        });
        break;
      }
      case 'watch': {
        const add = Math.round(3 * (arch?.suspicionSensitivity ?? 1));
        state.suspicion = clamp(state.suspicion + add, 0, 100);
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

/** Le désamorçage est-il pertinent sur cette cible ? */
export function canDefuse(c: Colleague): boolean {
  return !!c.intent && c.intent.tone === 'threat';
}

/** Probabilité (0–100) de désamorcer l'intention d'un collègue. */
export function defuseChance(state: GameState, c: Colleague): number {
  const vigilance = getArchetype(c.archetype)?.baseVigilance ?? 40;
  const raw =
    35 + state.player.stats.aura * 0.6 + c.opinion * 0.15 - vigilance * 0.3 - state.suspicion * 0.1;
  return Math.round(clamp(raw, 10, 90));
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

  const chance = defuseChance(state, c);
  if (rng.chance(chance)) {
    c.intent = undefined;
    c.opinion = clamp(c.opinion + 8, -100, 100);
    return {
      ok: true,
      tone: 'good',
      text: `Mise au point avec ${c.name}. Le sujet est « clos ». (${chance}% — réussi)`,
    };
  }

  state.suspicion = clamp(state.suspicion + 4, 0, 100);
  c.opinion = clamp(c.opinion - 5, -100, 100);
  return {
    ok: true,
    tone: 'bad',
    text: `${c.name} n'a pas apprécié ta démarche. +4 Suspicion. (${chance}% — raté)`,
  };
}
