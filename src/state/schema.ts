// ─────────────────────────────────────────────────────────────
// schema.ts — Modèle de données typé (contrat moteur ↔ contenu)
//
// Le moteur ne connaît le contenu que par ses `id` et par les
// structures génériques `Condition` / `Effect`. Ajouter du contenu
// (événement, archétype, plan, rang) = ajouter du JSON, jamais du code.
// ─────────────────────────────────────────────────────────────

// ── Primitives & identifiants ────────────────────────────────
export type StatKey = 'aura' | 'rendement' | 'combine' | 'nerfs';
export type Stats = Record<StatKey, number>; // chaque stat 0–100

export type RankId = string; // réf. ranks.json
export type ArchetypeId = string; // réf. archetypes.json
export type ColleagueId = string;
export type PlanDefId = string; // réf. plans.json
export type EventId = string; // réf. events.json
export type SecretId = string;

// ── Condition — filtre déclaratif générique ──────────────────
// Utilisée par : trigger d'événement, prérequis d'un choix, prérequis d'un plan.
export interface Condition {
  minRank?: RankId;
  maxRank?: RankId;
  stats?: Partial<Stats>; // seuils MINIMUM sur les stats joueur
  minSuspicion?: number;
  maxSuspicion?: number;
  minWeek?: number;
  flags?: string[]; // drapeaux requis (présents)
  notFlags?: string[]; // drapeaux interdits (absents)
  requiresArchetypeAlive?: ArchetypeId; // un collègue vivant de cet archétype existe
  requiresSecretDiscovered?: boolean; // au moins un secret découvert sur la cible
}

// ── Effect — mutation déclarative générique ──────────────────
// Utilisée par : résolution d'un choix d'événement, résolution d'un plan.
export interface Effect {
  stats?: Partial<Stats>; // deltas stats joueur (peut être négatif)
  suspicion?: number; // delta suspicion globale
  reputation?: number; // delta vers la prochaine promotion
  targetOpinion?: number; // delta opinion de la cible de l'événement
  rivalOpinion?: number; // delta opinion du rival (Carriériste)
  globalOpinion?: number; // delta opinion de TOUS les collègues (rumeur)
  colleagueOpinions?: Record<ColleagueId, number>; // deltas ciblés explicites
  setFlags?: string[];
  clearFlags?: string[];
  startPlan?: PlanDefId; // démarre un plan (cible = cible de l'événement)
  actionPoints?: number; // +/- PA exceptionnels (bonus ou coût)
}

// ── Collègues (état) & Archétypes (données) ──────────────────
export interface Secret {
  id: SecretId;
  label: string; // « Marc truque ses notes de frais »
  severity: number; // 0–100, poids comme levier
  discovered: boolean;
  spent?: boolean; // levier (hook) déjà consommé par un chantage
}

export interface Colleague {
  id: ColleagueId;
  name: string;
  archetype: ArchetypeId;
  rank: RankId;
  stats: Stats;
  opinion: number; // −100 (te déteste) … +100 (allié dévoué)
  secrets: Secret[];
  alive: boolean; // false = « départ non planifié » (V2)
  flags: string[]; // état par-collègue (isolé, préparé comme bouc, …)
}

export interface Archetype {
  id: ArchetypeId;
  name: string; // « Le Fayot »
  description: string;
  baseVigilance: number; // 0–100, résistance aux plans / à la détection
  suspicionSensitivity: number; // vitesse de montée de suspicion contre toi (multiplicateur)
  denounceThreshold?: number; // suspicion à laquelle il te dénonce (Fayot)
  plotsOnOwn?: boolean; // avance ses propres complots (Carriériste, V2)
  weeklyOpinionDrift?: number; // dérive naturelle d'opinion / semaine
}

// ── Plans : définition (données) vs instance (état) ──────────
export interface PlanDef {
  id: PlanDefId;
  name: string; // « Voler le crédit d'un projet »
  description: string;
  tier: number; // 1 (bénin) … 6 (nucléaire)
  durationWeeks: number; // pas instantané
  baseSuccess: number; // % de base avant modif Combine/vigilance/préparation
  suspicionOnSuccess: number;
  suspicionOnFailure: number;
  minRank?: RankId; // débloqué par promotion
  requires?: Condition; // prérequis (secret, allié placé…)
  requiresScapegoat?: boolean; // « départ non planifié » (V2)
  successEffects: Effect;
  failureEffects: Effect;
}

export interface ActivePlan {
  defId: PlanDefId;
  targetId?: ColleagueId;
  scapegoatId?: ColleagueId; // bouc émissaire préparé (V2)
  weeksRemaining: number;
  preparation: number; // 0–100, accumulé par l'action « Comploter »
}

// ── Opportunités (données) — le cœur du tour, façon CK3 ──────
// Situations éphémères tirées chaque semaine et placées sur la carte.
// Réutilise Condition (éligibilité) et Effect (conséquences).
export type OppPlace = 'desk' | 'cafe' | 'archive' | 'manager' | 'meeting' | 'target';

export interface Opportunity {
  id: string;
  title: string; // « Session restée ouverte »
  description: string;
  icon: string; // emoji marqueur sur la carte
  weight: number;
  minRank?: RankId;
  conditions?: Condition;
  target?: EventTargetMode | 'none'; // à qui se rattache l'opportunité
  targetArchetype?: ArchetypeId;
  place?: OppPlace; // où poser le marqueur (défaut : près de la cible / bureau)
  cost?: number; // coût en PA (défaut 1)
  effects: Effect;
  outcomeText: string;
  successChance?: number; // issue incertaine optionnelle
  failureEffects?: Effect;
  failureText?: string;
}

export interface ActiveOpportunity {
  defId: string;
  targetId?: ColleagueId;
  place: OppPlace;
}

// ── Événements (données) ─────────────────────────────────────
export interface EventTrigger {
  weight: number; // poids pour le tirage pondéré
  minRank?: RankId;
  conditions?: Condition; // filtre étendu
  once?: boolean; // ne se déclenche qu'une seule fois
  cooldownWeeks?: number; // délai minimal avant redéclenchement
}

export interface EventChoice {
  label: string;
  requires?: Condition; // sélectionnable seulement si rempli
  effects: Effect; // conséquences (branche succès si successChance)
  outcomeText: string;
  successChance?: number; // 0–100 ; si présent → jet, sinon déterministe
  failureEffects?: Effect;
  failureText?: string;
}

export type EventTargetMode = 'rival' | 'random' | 'archetype';

export interface GameEvent {
  id: EventId;
  title: string;
  body: string;
  trigger: EventTrigger;
  target?: EventTargetMode; // comment résoudre la « cible » de l'événement
  targetArchetype?: ArchetypeId; // si target === 'archetype'
  choices: EventChoice[];
}

// ── Rangs (données) ──────────────────────────────────────────
export interface Rank {
  id: RankId;
  name: string; // « Stagiaire »
  order: number; // 0 … N
  reputationRequired: number; // réputation cumulée pour l'atteindre
  unlocksActions?: string[]; // ex. ['fire_directly', 'access_files']
  backstabMultiplier: number; // plus tu montes, plus on te cible
}

// ── État global du jeu (sérialisé en localStorage) ───────────
export interface Player {
  name: string;
  stats: Stats;
  rank: RankId;
  reputation: number; // progression légitime vers la promotion
}

export type GameStatus = 'playing' | 'won' | 'fired' | 'burnout';

export interface LogEntry {
  week: number;
  text: string;
  tone: 'neutral' | 'good' | 'bad';
}

export interface GameState {
  version: number; // pour migrations de save
  seed: number; // graine RNG d'origine
  rngCursor: number; // curseur PRNG (reproductibilité)
  week: number;
  actionPointsRemaining: number; // 0–5
  player: Player;
  colleagues: Colleague[];
  suspicion: number; // 0–100 globale
  activePlans: ActivePlan[];
  opportunities: ActiveOpportunity[]; // opportunités de la semaine en cours
  weeklyActionCounts: Record<string, number>; // anti-spam : usages/semaine par action
  flags: string[]; // drapeaux narratifs globaux
  eventHistory: Array<{ id: EventId; week: number }>; // pour once/cooldown
  pendingEvent?: EventId; // événement du vendredi en attente de résolution
  pendingTargetId?: ColleagueId; // cible résolue de l'événement en attente
  status: GameStatus;
  log: LogEntry[]; // fil lisible par le joueur
}

// ── Catalogues chargés depuis /src/data ──────────────────────
export interface ContentCatalog {
  archetypes: Archetype[];
  plans: PlanDef[];
  ranks: Rank[];
  events: GameEvent[];
  opportunities: Opportunity[];
}
