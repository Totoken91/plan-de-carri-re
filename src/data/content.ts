// ─────────────────────────────────────────────────────────────
// content.ts — Point d'entrée unique du CONTENU.
// Charge les catalogues JSON et les expose typés au moteur.
// Le moteur n'importe jamais un .json directement : il passe par ici.
// ─────────────────────────────────────────────────────────────
import type {
  Archetype,
  Colleague,
  ContentCatalog,
  GameEvent,
  Opportunity,
  PlanDef,
  Rank,
} from '@state/schema';
import { apparts, casino, depenses, meubles, titres } from './vieprivee';

import archetypesRaw from './archetypes.json';
import plansRaw from './plans.json';
import ranksRaw from './ranks.json';
import eventsRaw from './events.json';
import colleaguesRaw from './colleagues.json';
import opportunitiesRaw from './opportunities.json';

export const catalog: ContentCatalog = {
  archetypes: archetypesRaw as Archetype[],
  plans: plansRaw as PlanDef[],
  ranks: (ranksRaw as Rank[]).slice().sort((a, b) => a.order - b.order),
  events: eventsRaw as GameEvent[],
  opportunities: opportunitiesRaw as Opportunity[],
  depenses,
  apparts,
  meubles,
  titres,
  casino,
};

/** Roster de collègues au démarrage d'une partie (deep-cloné à l'usage). */
export const startingColleagues = colleaguesRaw as Colleague[];

// ── Accès indexés (helpers de lecture) ───────────────────────
const archetypeById = new Map(catalog.archetypes.map((a) => [a.id, a]));
const planById = new Map(catalog.plans.map((p) => [p.id, p]));
const rankById = new Map(catalog.ranks.map((r) => [r.id, r]));
const eventById = new Map(catalog.events.map((e) => [e.id, e]));
const opportunityById = new Map(catalog.opportunities.map((o) => [o.id, o]));

export const getArchetype = (id: string): Archetype | undefined => archetypeById.get(id);
export const getPlanDef = (id: string): PlanDef | undefined => planById.get(id);
export const getRank = (id: string): Rank | undefined => rankById.get(id);
export const getEvent = (id: string): GameEvent | undefined => eventById.get(id);
export const getOpportunity = (id: string): Opportunity | undefined => opportunityById.get(id);

/** Ordre d'un rang (−1 si inconnu). Sert aux comparaisons minRank/maxRank. */
export function rankOrder(id: string | undefined): number {
  if (!id) return -1;
  return rankById.get(id)?.order ?? -1;
}

/** Rang suivant dans l'échelle, ou undefined si déjà au sommet. */
export function nextRank(id: string): Rank | undefined {
  const cur = rankById.get(id);
  if (!cur) return undefined;
  return catalog.ranks.find((r) => r.order === cur.order + 1);
}

/** Le rang le plus élevé défini (condition de victoire au MVP). */
export function topRank(): Rank {
  return catalog.ranks[catalog.ranks.length - 1]!;
}
