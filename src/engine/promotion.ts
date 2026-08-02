// ─────────────────────────────────────────────────────────────
// promotion.ts — Monter, quand quelqu'un occupe déjà la place.
//
// CE QUI A CHANGÉ, ET POURQUOI.
//
// La promotion ne dépendait que d'un seuil de réputation. Le banc
// d'essai a montré ce que ça produisait : une politique qui se contente
// de travailler cinq fois par semaine et de récupérer quand elle fatigue
// gagnait 100 % de ses parties, sans jamais parler à personne, sans un
// seul complot, sans un audit. Toute la moitié « intrigue » du jeu était
// facultative, et la stratégie dominante était la plus ennuyeuse.
//
// La cause n'était pas un chiffre mal réglé : c'est que la carrière
// n'était pas une COMPÉTITION. Remplir une barre ne devient un jeu
// d'intrigue que si quelqu'un occupe la place qu'on vise.
//
// D'où la règle : chaque rang a un nombre de sièges. Atteindre le seuil
// de réputation te rend éligible ; il faut encore qu'un siège se libère,
// ou que tu le libères. C'est ce qui donne enfin une raison mécanique
// aux plans, aux secrets, au bouc émissaire et aux ordres — tous
// servaient déjà à faire tomber quelqu'un, mais rien ne récompensait sa
// chute.
//
// Les rangs du bas ont 99 sièges : on ne bloque jamais un débutant, on
// bloque l'accès à l'encadrement. C'est là que se joue le jeu.
// ─────────────────────────────────────────────────────────────
import type { GameState, Rank } from '@state/schema';
import { getRank, nextRank, rankOrder, topRank } from '@data/content';

/**
 * Le rang est-il DISPUTÉ, c'est-à-dire ne reste-t-il qu'un siège ?
 *
 * C'est la garde qui manquait au concours. Sans elle, il s'appliquait
 * aussi aux rangs du bas — ceux qui ont 99 places — et un collègue au
 * meilleur dossier bloquait l'accès à « Junior », un titre que
 * l'entreprise distribue à qui le mérite. Résultat mesuré : toutes les
 * politiques s'acharnaient dès la semaine 2 à écarter quelqu'un pour une
 * place que personne ne leur disputait, et mouraient d'un audit.
 *
 * On ne se dispute que ce qui est rare.
 */
function estDispute(state: GameState, rank: Rank): boolean {
  return occupants(state, rank.id) + 1 >= rank.places;
}

/** Qui occupe ce rang, joueur compris. */
export function occupants(state: GameState, rankId: string): number {
  const npc = state.colleagues.filter((c) => c.alive && c.rank === rankId).length;
  return npc + (state.player.rank === rankId ? 1 : 0);
}

/** Les collègues qui tiennent le rang visé — ceux qu'il faudrait déplacer. */
export function tenantsDe(state: GameState, rankId: string) {
  return state.colleagues.filter((c) => c.alive && c.rank === rankId);
}

export interface Blocage {
  /** Le rang visé. */
  rang: Rank;
  /** Vrai si la réputation suffit déjà et que seul un siège manque. */
  siegeManquant: boolean;
  /** Le collègue qui passerait devant toi si la place se libérait ce soir. */
  concurrent?: string;
  /** Réputation encore nécessaire (0 si le seuil est atteint). */
  reputationManquante: number;
  /** Ceux qui tiennent la place, du plus faible au plus solide. */
  tenants: string[];
}

/**
 * Ce qui empêche la prochaine promotion, ou `undefined` au sommet.
 *
 * Lecture seule, destinée à l'interface : le joueur doit pouvoir lire
 * « il te manque 40 de réputation » ou « la place est prise par Sylvie »
 * sans avoir à le déduire.
 */
export function blocagePromotion(state: GameState): Blocage | undefined {
  const next = nextRank(state.player.rank);
  if (!next) return undefined;
  const manque = Math.max(0, next.reputationRequired - state.player.reputation);
  const libre = occupants(state, next.id) < next.places;
  const rival = estDispute(state, next) ? meilleurCandidat(state, next) : undefined;
  return {
    rang: next,
    siegeManquant: manque === 0 && !libre,
    concurrent:
      manque === 0 && rival && dossierPNJ(rival) > dossierJoueur(state) ? rival.name : undefined,
    reputationManquante: manque,
    tenants: tenantsDe(state, next.id)
      .slice()
      .sort((a, b) => a.stats.rendement - b.stats.rendement)
      .map((c) => c.name),
  };
}

/**
 * Promeut le joueur tant que sa réputation atteint le seuil du rang
 * suivant ET qu'un siège y est libre. Renvoie le nom du nouveau rang si
 * promotion, sinon undefined.
 */
export function checkPromotion(state: GameState): string | undefined {
  // Un échelon par vendredi, jamais deux. La boucle d'origine enchaînait
  // les promotions tant que la réputation suivait : on a mesuré des
  // parties où le poste de Senior se libérait et où le joueur ressortait
  // Team Lead le soir même, en sautant par-dessus le seul rang que
  // quelqu'un lui disputait. Monter deux marches d'un coup, ce n'est pas
  // une récompense, c'est un escalier qui manque.
  const next = nextRank(state.player.rank);
  if (!next) return undefined;
  if (state.player.reputation < next.reputationRequired) return undefined;
  if (occupants(state, next.id) >= next.places) return undefined; // la place est prise
  // Le siège est libre : encore faut-il qu'on te le donne à TOI — mais
  // seulement s'il est rare. On ne fait pas passer un entretien pour
  // « Junior ».
  if (estDispute(state, next)) {
    const rival = meilleurCandidat(state, next);
    if (rival && dossierPNJ(rival) > dossierJoueur(state)) return undefined;
  }
  state.player.rank = next.id;
  return next.name;
}

/**
 * Le concours, et pourquoi il existe.
 *
 * Avec les sièges limités, le banc d'essai a montré qu'une politique qui
 * ne fait que travailler gagnait encore neuf parties sur dix : elle
 * attendait qu'un poste se libère et le prenait, parce que personne ne
 * le lui disputait. Une place vacante n'est pas une place acquise.
 *
 * Le dossier du joueur pèse trois choses, et une seule s'obtient en
 * travaillant. Les deux autres — se faire voir, se faire des appuis —
 * exigent qu'on parle aux gens. C'est ce qui empêche la carrière d'être
 * une barre de progression solitaire.
 */
function dossierJoueur(state: GameState): number {
  const vivants = state.colleagues.filter((c) => c.alive);
  const soutien = vivants.length
    ? vivants.reduce((n, c) => n + c.opinion, 0) / vivants.length
    : 0;
  return (
    state.player.stats.rendement * 0.4 + state.player.stats.aura * 0.5 + soutien * 0.35
  );
}

/** Le même barème pour un PNJ. Son « soutien » est son ancienneté au rang. */
function dossierPNJ(c: { stats: { rendement: number; aura: number } }): number {
  return c.stats.rendement * 0.4 + c.stats.aura * 0.5;
}

/** Le collègue le mieux placé pour prendre ce rang avant toi. */
function meilleurCandidat(state: GameState, rank: Rank) {
  return state.colleagues
    .filter(
      (c) =>
        c.alive &&
        !c.flags.includes('discredite') &&
        rankOrder(c.rank) === rank.order - 1 &&
        c.stats.rendement >= seuilPNJ(rank),
    )
    .sort((a, b) => dossierPNJ(b) - dossierPNJ(a))[0];
}

/**
 * Les collègues montent aussi. Sans ça, les sièges du haut resteraient
 * ouverts et l'attente suffirait à les prendre — la concurrence doit
 * pousser dans les deux sens.
 *
 * Un collègue monte quand son rendement dépasse le seuil de son rang
 * courant et qu'il reste une place. Il ne prend jamais celle du joueur :
 * il prend celle qui reste, ce qui la lui retire.
 */
export interface MonteeNote {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export function tickCarrieresPNJ(state: GameState): MonteeNote[] {
  const notes: MonteeNote[] = [];
  // Du plus haut rendement au plus bas : le meilleur sert le premier.
  const candidats = state.colleagues
    .filter((c) => c.alive && !c.flags.includes('discredite'))
    .slice()
    .sort((a, b) => b.stats.rendement - a.stats.rendement);

  for (const c of candidats) {
    // Une montée par vendredi. Sans ce frein, tout l'étage se promouvait
    // le premier soir — les stats de départ des PNJ franchissaient
    // plusieurs seuils d'un coup — et le joueur trouvait les portes
    // fermées avant d'avoir joué un tour.
    if (notes.length > 0) break;
    const next = nextRank(c.rank);
    if (!next) continue;
    // Le rendement tient lieu de réputation pour un PNJ : c'est ce que
    // l'étage voit de lui, et c'est déjà ce que font monter ses
    // intentions « climb » et ses coups réussis.
    if (c.stats.rendement < seuilPNJ(next)) continue;
    if (occupants(state, next.id) >= next.places) continue;
    c.rank = next.id;
    notes.push({
      tone: state.player.rank === c.rank ? 'bad' : 'neutral',
      text: `${c.name} passe ${next.name}. Une place de moins au-dessus de toi.`,
    });
  }
  return notes;
}

/**
 * Le rendement qu'un PNJ doit atteindre pour prendre un rang.
 *
 * Dérivé du seuil de réputation plutôt que saisi à la main : un rang
 * ajouté au catalogue n'a rien de plus à renseigner, et les deux
 * échelles ne peuvent pas diverger.
 */
function seuilPNJ(rank: Rank): number {
  return 38 + rank.reputationRequired * 0.14;
}

/**
 * Le turn-over. Quelqu'un finit toujours par partir de lui-même.
 *
 * Sans ça, les sièges limités créaient une impasse mesurable : une
 * politique qui refuse de faire tomber qui que ce soit restait bloquée
 * soixante semaines à Confirmé. Un plafond qu'aucun jeu ne peut franchir
 * n'est pas une difficulté, c'est un bug de conception.
 *
 * La règle est donc : attendre FONCTIONNE, mais lentement. Le complot
 * n'est plus le seul chemin vers la place — il est le chemin rapide. Et
 * ça n'arrive que si le joueur a déjà la réputation : personne ne s'en va
 * pour libérer une place qu'on ne pourrait pas prendre.
 */
export function tickTurnover(
  state: GameState,
  rng: { chance(p: number): boolean; pick<T>(xs: T[]): T | undefined },
  chancePourCent: number,
): MonteeNote[] {
  const next = nextRank(state.player.rank);
  if (!next) return [];
  if (state.player.reputation < next.reputationRequired) return [];
  if (occupants(state, next.id) < next.places) return [];
  // Plus le poste est haut, moins on le quitte de gaieté de cœur. Un
  // Team Lead qui démissionne tout seul, ça arrive — pas tous les mois.
  if (!rng.chance(chancePourCent * Math.max(0.45, 1 - next.order * 0.16))) return [];

  const partant = rng.pick(tenantsDe(state, next.id));
  if (!partant) return [];
  partant.alive = false;
  partant.intent = undefined;
  return [
    {
      tone: 'good',
      text: `${partant.name} démissionne — « une opportunité ailleurs ». Le poste de ${next.name} se libère.`,
    },
  ];
}

/** Le joueur a-t-il atteint le rang maximum (condition de victoire MVP) ? */
export function isAtTop(state: GameState): boolean {
  return state.player.rank === topRank().id;
}

/** La charge nerveuse du rang courant, prélevée chaque vendredi. */
export const chargeDuRang = (state: GameState): number =>
  getRank(state.player.rank)?.charge ?? 0;

/** Le train de vie du rang courant, prélevé chaque vendredi. */
export const trainDeVie = (state: GameState): number =>
  getRank(state.player.rank)?.trainDeVie ?? 0;
