// ─────────────────────────────────────────────────────────────
// preview.ts — Ce qu'une action VA faire, annoncé avant le clic.
//
// Aucune mutation ici : on relit exactement la même arithmétique que
// actions.ts / intents.ts pour afficher les deltas et les probabilités.
// Règle : si le moteur change une magnitude, elle doit venir de
// balance.json des deux côtés — jamais d'un nombre recopié à la main.
// ─────────────────────────────────────────────────────────────
import type { Colleague, Effect, GameState, StatKey } from '@state/schema';
import { balance } from '@data/balance';
import { getPlanDef } from '@data/content';
import { caughtRisk, diminishingFactor, nerfCost, opinionGain } from './actions';
import { traitFactor } from './traits';
import { activeScheme, canDefuse, defuseChance, schemeChance } from './intents';
import { SCAPEGOAT_FLAG, prepareChance, scapegoatOf, scapegoatWeeksLeft } from './scapegoat';
import { availableHooks } from './hooks';
import { STAT_KEYS } from './util';

export interface PreviewLine {
  label: string;
  tone: 'good' | 'bad' | 'neutral';
}

export type ActionId =
  | { kind: 'bosser' }
  | { kind: 'glander' }
  | { kind: 'cafe'; targetId: string }
  | { kind: 'fouiner'; targetId: string }
  | { kind: 'defuse'; targetId: string }
  | { kind: 'scapegoat'; targetId: string }
  | { kind: 'warn'; targetId: string } // targetId = le comploteur
  | { kind: 'abet'; targetId: string } // targetId = le comploteur
  | { kind: 'hook'; targetId: string; secretId: string; mode: 'coerce' | 'expose' };

export interface ActionOption {
  key: string; // identifiant stable pour React
  id: ActionId;
  label: string;
  icon: string;
  cost: number;
  available: boolean;
  reason?: string; // pourquoi c'est grisé
  summary: string; // une ligne : à quoi ça sert
  lines: PreviewLine[]; // les deltas chiffrés
  chance?: number; // % de réussite si l'issue est incertaine
  danger?: boolean;
}

// ── Formatage ────────────────────────────────────────────────
// Vrai signe moins (U+2212), pas un trait d'union : les colonnes de
// chiffres doivent s'aligner et se lire comme des écritures comptables.
const sign = (n: number): string => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const good = (label: string): PreviewLine => ({ label, tone: 'good' });
const bad = (label: string): PreviewLine => ({ label, tone: 'bad' });
const flat = (label: string): PreviewLine => ({ label, tone: 'neutral' });

/** Un collègue est-il approchable (vivant) ? */
const reachable = (c: Colleague): boolean => c.alive;

// ── Actions solo (zones de la carte) ─────────────────────────

export function previewBosser(state: GameState): ActionOption {
  const cfg = balance.actions.bosser;
  const f = diminishingFactor(state, 'bosser');
  const rendement = Math.round(cfg.rendement * f);
  // Mêmes formules que l'action elle-même, appelées depuis actions.ts :
  // un chiffre annoncé qui ne serait pas celui qu'on applique ferait
  // mentir tous les boutons du jeu.
  const reputation = Math.round(cfg.reputation * f * traitFactor(state, 'reputationGain'));
  const nerfs = nerfCost(state, cfg.nerfs);
  const worn = f < 0.9;

  return {
    key: 'bosser',
    id: { kind: 'bosser' },
    label: 'Bosser',
    icon: '💼',
    cost: 1,
    available: true,
    summary: 'La voie propre : tu produis, ta réputation monte.',
    lines: [
      good(`${sign(reputation)} réputation`),
      good(`${sign(rendement)} Rendement`),
      bad(`${sign(nerfs)} Nerfs`),
      ...(worn ? [flat(`Rendement en baisse (${Math.round(f * 100)}% cette semaine)`)] : []),
    ],
  };
}

export function previewGlander(state: GameState): ActionOption {
  const cfg = balance.actions.glander;
  const f = diminishingFactor(state, 'glander');
  const nerfs = Math.round(cfg.nerfs * f);
  const fayotWatching = state.colleagues.some(
    (c) => c.alive && c.archetype === 'fayot' && c.opinion < 20,
  );

  return {
    key: 'glander',
    id: { kind: 'glander' },
    label: 'Glander',
    icon: '🛋️',
    cost: 1,
    available: true,
    summary: 'Récupérer des Nerfs. Le burn-out te coûte la partie.',
    lines: [
      good(`${sign(nerfs)} Nerfs`),
      ...(fayotWatching
        ? [bad(`40% de risque : un Fayot te repère (+${cfg.fayotSuspicion} Suspicion)`)]
        : []),
      ...(f < 0.9 ? [flat(`Repos moins efficace (${Math.round(f * 100)}%)`)] : []),
    ],
  };
}

// ── Actions ciblées (sur un collègue) ────────────────────────

export function previewCafe(state: GameState, c: Colleague): ActionOption {
  const cfg = balance.actions.cafe;
  const gain = opinionGain(state, cfg.opinion);
  const nerfs = nerfCost(state, cfg.nerfs);
  return {
    key: `cafe:${c.id}`,
    id: { kind: 'cafe', targetId: c.id },
    label: 'Réseauter',
    icon: '☕',
    cost: 1,
    available: reachable(c),
    reason: reachable(c) ? undefined : 'Ce collègue n’est plus là.',
    summary: 'Un café, deux banalités. Son opinion monte.',
    lines: [good(`${sign(gain)} opinion de ${c.name}`), bad(`${sign(nerfs)} Nerfs`)],
  };
}

export function previewFouiner(state: GameState, c: Colleague): ActionOption {
  const cfg = balance.actions.fouiner;
  const risk = caughtRisk(state, cfg.suspicionRisk);
  const hidden = c.secrets.filter((s) => !s.discovered).length;
  return {
    key: `fouiner:${c.id}`,
    id: { kind: 'fouiner', targetId: c.id },
    label: 'Fouiner',
    icon: '🔍',
    cost: 1,
    available: reachable(c) && hidden > 0,
    reason: hidden > 0 ? undefined : `Plus rien à trouver sur ${c.name}.`,
    summary: 'Chercher un secret : un secret en main devient un levier.',
    chance: 100 - risk,
    danger: true,
    lines: [
      good(`${hidden} secret${hidden > 1 ? 's' : ''} encore à découvrir`),
      bad(`${risk}% de te faire voir (+${cfg.suspicionOnCaught} Suspicion)`),
    ],
  };
}

export function previewDefuse(state: GameState, c: Colleague): ActionOption {
  const possible = canDefuse(c);
  const chance = possible ? defuseChance(state, c) : 0;
  return {
    key: `defuse:${c.id}`,
    id: { kind: 'defuse', targetId: c.id },
    label: 'Désamorcer',
    icon: '🛡️',
    cost: 1,
    available: reachable(c) && possible,
    reason: possible ? undefined : `${c.name} ne prépare rien contre toi.`,
    summary: possible ? `Couper court à : « ${c.intent!.label} »` : 'Rien à désamorcer.',
    chance,
    danger: true,
    lines: possible
      ? [
          good('Réussi : la manœuvre est annulée, +8 opinion'),
          bad('Raté : +4 Suspicion, −5 opinion'),
        ]
      : [],
  };
}

/**
 * Monter un dossier sur un innocent. C'est l'assurance-vie du jeu : sans
 * elle, les coups lourds sont injouables ; avec elle, quelqu'un paiera.
 */
export function previewScapegoat(state: GameState, c: Colleague): ActionOption | null {
  const cfg = balance.scapegoat;
  const already = c.flags.includes(SCAPEGOAT_FLAG);
  const other = scapegoatOf(state);

  // On ne propose l'action que si elle a du sens sur cette personne.
  if (already) {
    return {
      key: `sg:${c.id}`,
      id: { kind: 'scapegoat', targetId: c.id },
      label: 'Bouc émissaire prêt',
      icon: '🗃️',
      cost: 0,
      available: false,
      reason: `Le dossier tient encore ${scapegoatWeeksLeft(state, c)} semaine(s). En cas d'audit, ${c.name} partira à ta place.`,
      summary: '',
      lines: [],
    };
  }
  if (other) return null; // un seul montage à la fois
  if (!c.alive) return null;

  const enough = state.player.stats.combine >= cfg.combineRequired;
  return {
    key: `sg:${c.id}`,
    id: { kind: 'scapegoat', targetId: c.id },
    label: 'Monter un dossier',
    icon: '🗃️',
    cost: 1,
    available: enough,
    reason: enough ? undefined : `Exige Combine ${cfg.combineRequired}.`,
    summary: `Fabriquer des indices contre ${c.name}, pour l'audit qui viendra.`,
    chance: enough ? prepareChance(state, c) : undefined,
    danger: true,
    lines: [
      good(`Réussi : couvre un audit pendant ${cfg.staleWeeks} semaines`),
      bad(`Réussi : ${sign(cfg.suspicionOnPrepare)} Suspicion`),
      bad(`Raté : ${sign(cfg.suspicionOnFail)} Suspicion, ${sign(cfg.opinionOnFail)} opinion`),
      flat('À l’audit, cette personne quitte l’entreprise à ta place'),
    ],
  };
}

/** Interventions dans le coup qu'un collègue monte contre un autre. */
export function previewScheme(state: GameState, c: Colleague): ActionOption[] {
  const found = activeScheme(state, c);
  if (!found) return [];
  const chance = schemeChance(c, found.victim, found.intent);
  const boosted = !!found.intent.boost;

  return [
    {
      key: `warn:${c.id}`,
      id: { kind: 'warn', targetId: c.id },
      label: `Prévenir ${found.victim.name.split(' ')[0]}`,
      icon: '🕊️',
      cost: 1,
      available: true,
      summary: `Faire capoter le coup et te faire un obligé.`,
      lines: [
        good(`+18 opinion de ${found.victim.name}`),
        good('Le coup est annulé'),
        bad(`−10 opinion de ${c.name}`),
      ],
    },
    {
      key: `abet:${c.id}`,
      id: { kind: 'abet', targetId: c.id },
      label: 'Alimenter le coup',
      icon: '🔥',
      cost: 1,
      available: !boosted,
      reason: boosted ? 'Tu as déjà fourni ce qu’il fallait.' : undefined,
      danger: true,
      summary: `Fournir la pièce manquante (${chance}% → ${Math.min(92, chance + 25)}%).`,
      lines: [
        good(`+14 opinion de ${c.name}`),
        bad(`−12 opinion de ${found.victim.name}`),
        bad('+3 Suspicion'),
      ],
    },
  ];
}

export function previewHooks(state: GameState, c: Colleague): ActionOption[] {
  return availableHooks(state, c.id).flatMap((s) => {
    const coerceGain = Math.round(30 + s.severity * 0.2);
    const exposeLoss = Math.round(20 + s.severity * 0.3);
    const repGain = Math.round(s.severity * 0.15);
    return [
      {
        key: `coerce:${c.id}:${s.id}`,
        id: { kind: 'hook', targetId: c.id, secretId: s.id, mode: 'coerce' } as ActionId,
        label: 'Faire chanter',
        icon: '⛓️',
        cost: 1,
        available: true,
        summary: `Levier : « ${s.label} »`,
        lines: [
          good(`+${coerceGain} opinion — il passe dans ta poche`),
          flat('Il cesse de comploter contre toi'),
          bad('Consomme définitivement le secret'),
        ],
      },
      {
        key: `expose:${c.id}:${s.id}`,
        id: { kind: 'hook', targetId: c.id, secretId: s.id, mode: 'expose' } as ActionId,
        label: 'Balancer',
        icon: '📢',
        cost: 1,
        available: true,
        danger: true,
        summary: `Divulguer : « ${s.label} »`,
        lines: [
          good(`+${repGain} réputation — tu parais presque vertueux`),
          good(`${c.name} est discrédité`),
          bad(`−${exposeLoss} opinion, +4 Suspicion`),
        ],
      },
    ];
  });
}

// ── Lecture d'un Effect en clair ─────────────────────────────
const STAT_LABELS: Record<StatKey, string> = {
  aura: 'Aura',
  rendement: 'Rendement',
  combine: 'Combine',
  nerfs: 'Nerfs',
};

/**
 * Traduit un `Effect` de contenu (opportunité, choix d'événement, plan)
 * en lignes lisibles. Sert à ce qu'aucun choix ne soit fait à l'aveugle.
 */
export function describeEffect(effect: Effect, targetName = 'la cible'): PreviewLine[] {
  const lines: PreviewLine[] = [];
  const push = (label: string, positive: boolean) =>
    lines.push(positive ? good(label) : bad(label));

  for (const k of STAT_KEYS) {
    const v = effect.stats?.[k];
    if (v) push(`${sign(v)} ${STAT_LABELS[k]}`, v > 0);
  }
  if (effect.reputation) push(`${sign(effect.reputation)} réputation`, effect.reputation > 0);
  // La Suspicion est la seule jauge où monter est mauvais.
  if (effect.suspicion) push(`${sign(effect.suspicion)} Suspicion`, effect.suspicion < 0);
  if (effect.targetOpinion)
    push(`${sign(effect.targetOpinion)} opinion de ${targetName}`, effect.targetOpinion > 0);
  if (effect.rivalOpinion)
    push(`${sign(effect.rivalOpinion)} opinion de ton rival`, effect.rivalOpinion > 0);
  if (effect.globalOpinion)
    push(`${sign(effect.globalOpinion)} opinion de tout l’open space`, effect.globalOpinion > 0);
  for (const [id, v] of Object.entries(effect.colleagueOpinions ?? {})) {
    if (v) push(`${sign(v)} opinion (${id})`, v > 0);
  }
  if (effect.actionPoints) push(`${sign(effect.actionPoints)} PA`, effect.actionPoints > 0);
  if (effect.startPlan) {
    const def = getPlanDef(effect.startPlan);
    lines.push(flat(`Lance le plan « ${def?.name ?? effect.startPlan} »`));
  }

  return lines;
}

/** Toutes les actions proposées au clic sur un collègue, dans l'ordre utile. */
export function colleagueActions(state: GameState, c: Colleague): ActionOption[] {
  const scapegoat = previewScapegoat(state, c);
  return [
    previewDefuse(state, c),
    ...previewScheme(state, c),
    previewCafe(state, c),
    previewFouiner(state, c),
    ...(scapegoat ? [scapegoat] : []),
    ...previewHooks(state, c),
  ].filter((a) => a.available || a.id.kind !== 'defuse'); // « Désamorcer » ne s'affiche que s'il y a de quoi
}
