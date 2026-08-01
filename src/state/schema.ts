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
  /** Trésorerie minimale / maximale, en euros. */
  minArgent?: number;
  maxArgent?: number;
  /**
   * Statut minimal de la relation avec la CIBLE, dans l'ordre
   * flirt → liaison → couple. `ex` n'est jamais « au-dessus » de rien :
   * une histoire finie ne remplit aucun prérequis.
   */
  minRomance?: RomanceStatut;
  /** Une histoire, quelle qu'elle soit, est publique. */
  requiresRomanceConnue?: boolean;
  /** Au moins un collègue est rattaché à ton périmètre. */
  requiresSubordonne?: boolean;
  /** Rang minimal du logement occupé (0 = la coloc). */
  minLogement?: number;
}

// ── Effect — mutation déclarative générique ──────────────────
// Utilisée par : résolution d'un choix d'événement, résolution d'un plan.
export interface Effect {
  argent?: number; // delta en euros (peut être négatif)
  romance?: number; // delta d'attachement envers la cible
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
  removeTarget?: boolean; // la cible quitte l'entreprise (« départ non planifié »)
  revealSecret?: boolean; // découvre un secret encore caché de la cible
}

// ── Collègues (état) & Archétypes (données) ──────────────────
export interface Secret {
  id: SecretId;
  label: string; // « Marc truque ses notes de frais »
  severity: number; // 0–100, poids comme levier
  discovered: boolean;
  spent?: boolean; // levier (hook) déjà consommé par un chantage
}

// ── Intentions des PNJ — le « qui complote quoi », rendu VISIBLE ──
// C'est le cœur de la lisibilité façon CK3 : le joueur voit les menaces
// se former au-dessus des têtes et choisit lesquelles désamorcer.
export type IntentKind =
  | 'plot' // monte un coup contre toi (compte à rebours)
  | 'scheme' // monte un coup contre un AUTRE collègue (l'open space vit sans toi)
  | 'watch' // te surveille : fait monter la Suspicion chaque semaine
  | 'gossip' // colporte : peut te livrer un secret
  | 'climb' // grimpe pour son compte : devient un rival plus dur
  | 'bond' // se rapproche de toi
  | 'idle'; // rien de notable

export interface Intent {
  kind: IntentKind;
  label: string; // « Monte un dossier sur toi »
  detail: string; // ce qui se passe si ça aboutit
  icon: string;
  tone: 'threat' | 'neutral' | 'good';
  weeksLeft: number; // 0 = se résout ce vendredi
  victimId?: ColleagueId; // cible d'un 'scheme' — un collègue, pas toi
  boost?: number; // bonus de réussite si tu as alimenté le coup
}

// ── Vie privée ───────────────────────────────────────────────
// L'opinion dit ce qu'un collègue pense de toi au travail. L'attachement
// dit tout autre chose, et les deux ne bougent pas ensemble : on peut
// coucher avec quelqu'un qui vous méprise professionnellement, et c'est
// même une bonne partie du sujet.
export type RomanceStatut = 'rien' | 'flirt' | 'liaison' | 'couple' | 'ex';

export interface Romance {
  /** Attachement, 0–100. Ce n'est PAS l'opinion. */
  niveau: number;
  statut: RomanceStatut;
  /** Semaines écoulées depuis le dernier changement de statut. */
  semaines: number;
  /** L'open space est au courant. Change tout : jalousie, RH, réputation. */
  connu: boolean;
}

// ── Subordonnés ──────────────────────────────────────────────
// À partir d'un certain rang, certains collègues te sont rattachés. Un
// subordonné n'exécute pas parce qu'il t'aime : il exécute parce que tu
// notes son entretien annuel. Sa loyauté (opinion) décide seulement s'il
// le fait BIEN, ou s'il te balance.
export type OrdreKind =
  | 'rapporter' // te ramène des informations sur quelqu'un
  | 'abattre' // fait le sale boulot à ta place sur une cible
  | 'couvrir' // endosse ta suspicion
  | 'produire' // bosse pour ta réputation
  | 'charmer'; // travaille l'opinion d'un tiers en ta faveur

export interface Ordre {
  kind: OrdreKind;
  targetId?: ColleagueId;
  /** Semaines restantes avant que l'ordre ne produise son effet. */
  semaines: number;
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
  intent?: Intent; // ce qu'il fabrique cette semaine (visible sur la carte)
  romance?: Romance; // ce qui se passe en dehors des heures de bureau
  subordonne?: boolean; // rattaché à ton périmètre
  ordre?: Ordre; // ce que tu lui as demandé de faire (s'il t'est rattaché)
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

export type EventTargetMode =
  | 'rival'
  | 'random'
  | 'archetype'
  /** La personne avec qui tu as l'histoire la plus avancée. */
  | 'romance'
  /** Un de tes subordonnés. */
  | 'subordonne';

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
  /** Salaire hebdomadaire net, versé le vendredi. */
  salaire: number;
  /** Combien de collègues peuvent t'être rattachés à ce rang. */
  subordonnes: number;
}

// ── Argent et vie privée : définitions (données) ─────────────
/**
 * Une dépense : de l'argent contre un effet, avec parfois un jet.
 *
 * C'est le pendant payant des actions gratuites. Le moteur ne connaît
 * aucune dépense par son nom — il lit un prix, une `Condition`, un
 * `Effect`, exactement comme pour une opportunité.
 */
export interface DepenseDef {
  id: string;
  nom: string;
  description: string;
  icone: string;
  prix: number;
  /** Coût en points d'action ; 0 = gratuit en temps. */
  cout?: number;
  /** `bureau`, `appart`, ou les deux si absent. */
  lieu?: 'bureau' | 'appart';
  /** Se rattache à un collègue choisi par le joueur. */
  cible?: 'colleague' | 'none';
  requires?: Condition;
  minRank?: RankId;
  effects: Effect;
  outcomeText: string;
  successChance?: number;
  failureEffects?: Effect;
  failureText?: string;
  /** Nombre maximal d'usages par semaine. */
  maxParSemaine?: number;
}

export interface AppartDef {
  id: string;
  nom: string;
  description: string;
  prix: number; // 0 = celui où l'on commence
  loyer: number; // prélevé chaque vendredi
  /** Nombre de meubles qu'on peut y installer. */
  places: number;
  /** Points d'action du week-end offerts par le logement. */
  pointsWeekend: number;
  /** Ce qu'il vaut aux yeux de quelqu'un qu'on y invite. */
  standing: number;
}

export interface MeubleDef {
  id: string;
  nom: string;
  description: string;
  icone: string;
  prix: number;
  /** Effets appliqués chaque vendredi, tant qu'il est installé. */
  hebdo?: Effect;
  /** Bonus permanent aux actions du week-end, par identifiant d'action. */
  bonus?: Record<string, number>;
}

export interface TitreDef {
  id: string;
  nom: string;
  symbole: string;
  /** Cours de départ, en euros. */
  base: number;
  /** Amplitude typique d'une variation hebdomadaire, en fraction. */
  volatilite: number;
  /** Dérive moyenne par semaine, en fraction. */
  derive: number;
  couleur: string;
}

export interface JeuCasinoDef {
  id: string;
  nom: string;
  description: string;
  icone: string;
  /** Mise minimale. */
  mise: number;
  /** Probabilité de gain, en points de %. */
  chance: number;
  /** Multiplicateur de la mise en cas de gain (mise comprise). */
  gain: number;
  /** Suspicion prise si l'on joue depuis le bureau. */
  suspicionAuBureau: number;
}

// ── Apparence ────────────────────────────────────────────────
// Purement descriptive : le moteur ne la lit jamais, seul le rendu s'en
// sert. Elle vit malgré tout dans l'état parce qu'elle est sauvegardée
// avec la partie — c'est le personnage du joueur, pas un réglage.
export type HairStyle =
  | 'plaque'
  | 'queue'
  | 'capuche'
  | 'rideau'
  | 'degarni'
  | 'carre'
  | 'rase'
  | 'frange'
  | 'boucle'
  | 'chignon'
  | 'crete'
  | 'tresses'
  | 'bouffante';

export type Gender = 'homme' | 'femme';

export interface Appearance {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  tie?: string; // absent = pas de cravate
  glasses: boolean;
  /** Équilibre épaules / hanches de la silhouette. */
  gender: Gender;
  /** Corpulence, 0 (mince) → 1 (corpulent). Indépendante du genre. */
  build: number;
}

// ── Traits de personnage ─────────────────────────────────────
// Un trait modifie des QUANTITÉS que le moteur connaît par leur nom
// générique (« les gains de réputation », « les hausses de suspicion »),
// jamais par le nom du trait. Le moteur ignore donc qui est « Discret » :
// il sait seulement qu'un facteur s'applique aux hausses de suspicion.
export type TraitModKey =
  | 'reputationGain' // ×
  | 'opinionGain' // ×
  | 'suspicionGain' // ×
  | 'nerfsCost' // ×
  | 'planSuccess' // + points de %
  | 'defuseChance' // + points de %
  | 'secretChance'; // + points de %

export type TraitId = string;

export interface TraitDef {
  id: TraitId;
  nom: string;
  description: string;
  /** Ce que ça change concrètement, en clair, pour l'écran d'embauche. */
  detail: string;
  /** > 0 : coûte des points. < 0 : en rend. */
  cout: number;
  stats?: Partial<Stats>;
  /** Suspicion au premier jour. */
  suspicion?: number;
  /** Opinion de départ de TOUS les collègues. */
  opinion?: number;
  mods?: Partial<Record<TraitModKey, number>>;
}

// ── État global du jeu (sérialisé en localStorage) ───────────
export interface Player {
  name: string;
  stats: Stats;
  rank: RankId;
  reputation: number; // progression légitime vers la promotion
  appearance: Appearance;
  traits: TraitId[];
}

export type GameStatus = 'playing' | 'won' | 'fired' | 'burnout';

export interface LogEntry {
  week: number;
  text: string;
  tone: 'neutral' | 'good' | 'bad';
}

/**
 * Où l'on se trouve dans la semaine.
 *
 * `bureau` du lundi au vendredi ; `weekend` chez soi, avec ses propres
 * points d'action. Ce n'est pas un écran de plus posé à côté : le
 * week-end consomme un temps qui lui est propre et rend ce qu'on n'a pas
 * le droit de faire au bureau.
 */
export type Phase = 'bureau' | 'weekend';

export interface Appart {
  /** Identifiant du logement occupé, réf. appart.json. */
  niveau: string;
  /** Meubles installés, réf. appart.json → meubles. */
  meubles: string[];
}

export interface GameState {
  version: number; // pour migrations de save
  seed: number; // graine RNG d'origine
  rngCursor: number; // curseur PRNG (reproductibilité)
  week: number;
  phase: Phase;
  actionPointsRemaining: number; // 0–5
  /** Points d'action du week-end, chez soi. */
  weekendPointsRemaining: number;
  argent: number; // en euros
  appart: Appart;
  /** Titres détenus, par identifiant. */
  portefeuille: Record<string, number>;
  /** Cours courant de chaque titre. Il vit dans l'état : sans ça, la
   *  bourse repartirait de zéro à chaque rechargement. */
  cours: Record<string, number>;
  /** Usages de dépenses cette semaine, pour les plafonds. */
  depensesSemaine: Record<string, number>;
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
  depenses: DepenseDef[];
  apparts: AppartDef[];
  meubles: MeubleDef[];
  titres: TitreDef[];
  casino: JeuCasinoDef[];
}
