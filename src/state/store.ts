// ─────────────────────────────────────────────────────────────
// store.ts — Création d'état, save/load localStorage, et API mutative.
//
// Toutes les mutations passent par le store : il clone l'état, appelle
// le moteur (fonctions pures/mutatives sur le clone), persiste le curseur
// RNG, sauvegarde et notifie les abonnés (React).
// ─────────────────────────────────────────────────────────────
import type { GameEvent, GameState, Player } from './schema';
import { startingColleagues } from '@data/content';
import { balance } from '@data/balance';
import { Rng, randomSeed } from '@engine/rng';
import { getEvent } from '@data/content';
import {
  actBosser,
  actCafe,
  actComploter,
  actFouiner,
  actGlander,
  type ActionKind,
  type ActionResult,
} from '@engine/actions';
import { resolveChoice } from '@engine/events';
import { beginWeekend, finalizeWeek, type WeekSummary } from '@engine/week';
import { generateOpportunities, resolveOpportunity, type OppResolution } from '@engine/opportunities';
import { useHook, type HookMode } from '@engine/hooks';
import { abetScheme, assignIntents, defuseIntent, warnVictim } from '@engine/intents';
import { prepareScapegoat } from '@engine/scapegoat';
import type { ActionId } from '@engine/preview';

const SAVE_KEY = 'plan-de-carriere/save/v3';
export const SAVE_VERSION = 3;

// ── Création d'une partie ────────────────────────────────────
export function createInitialState(seed = randomSeed(), playerName = 'Toi'): GameState {
  const player: Player = {
    name: playerName,
    stats: { ...balance.startStats },
    rank: 'stagiaire',
    reputation: 0,
  };
  return {
    version: SAVE_VERSION,
    seed,
    rngCursor: 0,
    week: 1,
    actionPointsRemaining: balance.actionPointsPerWeek,
    player,
    colleagues: structuredClone(startingColleagues),
    suspicion: balance.startSuspicion,
    activePlans: [],
    opportunities: [],
    weeklyActionCounts: {},
    flags: [],
    eventHistory: [],
    pendingEvent: undefined,
    pendingTargetId: undefined,
    status: 'playing',
    log: [{ week: 1, text: 'Premier jour. L’open space t’attend. Le sommet aussi.', tone: 'neutral' }],
  };
}

// ── Persistance ──────────────────────────────────────────────
export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* quota / mode privé : on ignore silencieusement */
  }
}

export function loadState(): GameState | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== SAVE_VERSION) return undefined; // migration future
    return parsed;
  } catch {
    return undefined;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

// ── Store réactif ────────────────────────────────────────────
type Listener = () => void;

export interface EndWeekOutcome {
  pendingEvent?: GameEvent;
  summary?: WeekSummary; // présent si aucun événement (semaine bouclée direct)
}

export class GameStore {
  private state: GameState;
  private rng: Rng;
  private listeners = new Set<Listener>();
  /** Dernier message d'action, pour un retour immédiat à l'UI. */
  lastMessage: ActionResult | undefined;

  constructor(initial: GameState) {
    this.state = initial;
    this.rng = new Rng(initial.seed, initial.rngCursor);
    // Amorçage : une nouvelle partie n'a ni opportunités ni intentions ;
    // un save en cours de semaine conserve les siennes.
    if (this.state.status === 'playing') {
      let dirty = false;
      if (this.state.opportunities.length === 0) {
        generateOpportunities(this.state, this.rng);
        dirty = true;
      }
      if (this.state.colleagues.some((c) => c.alive && !c.intent)) {
        assignIntents(this.state, this.rng);
        dirty = true;
      }
      if (dirty) this.persist();
    }
  }

  static newGame(seed?: number, name?: string): GameStore {
    const store = new GameStore(createInitialState(seed, name));
    store.persist();
    return store;
  }

  static fromSaveOrNew(): GameStore {
    const saved = loadState();
    return saved ? new GameStore(saved) : GameStore.newGame();
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private persist(): void {
    this.state.rngCursor = this.rng.cursor;
    saveState(this.state);
  }

  /**
   * Enregistre qu'une action a été jouée cette semaine. Sert à deux
   * choses : le rendement décroissant (répéter la même action rapporte
   * moins) et l'accueil guidé, qui doit savoir si la consigne a été
   * exécutée sans avoir à deviner à partir du journal.
   */
  private tally(draft: GameState, key: string): void {
    draft.weeklyActionCounts[key] = (draft.weeklyActionCounts[key] ?? 0) + 1;
  }

  /** Applique une mutation sur un clone, persiste et notifie. */
  private commit(mutator: (draft: GameState) => void): void {
    const draft = structuredClone(this.state);
    mutator(draft);
    this.state = draft;
    this.persist();
    this.emit();
  }

  // ── Boucle de jeu ──────────────────────────────────────────
  private canAct(): boolean {
    return this.state.status === 'playing' && this.state.actionPointsRemaining > 0 && !this.state.pendingEvent;
  }

  /** Exécute une des 5 actions de base (coûte 1 PA). */
  performAction(
    kind: ActionKind,
    params: { targetId?: string; planId?: string } = {},
  ): ActionResult {
    if (!this.canAct()) {
      return { ok: false, text: 'Aucune action possible pour le moment.', tone: 'neutral' };
    }
    let result: ActionResult = { ok: false, text: '', tone: 'neutral' };
    this.commit((draft) => {
      switch (kind) {
        case 'bosser':
          result = actBosser(draft);
          break;
        case 'cafe':
          result = actCafe(draft, params.targetId!);
          break;
        case 'fouiner':
          result = actFouiner(draft, params.targetId!, this.rng);
          break;
        case 'comploter':
          result = actComploter(draft, params.planId!, params.targetId);
          break;
        case 'glander':
          result = actGlander(draft, this.rng);
          break;
      }
      if (result.ok) {
        draft.actionPointsRemaining -= 1;
        this.tally(draft, kind);
        draft.log.push({ week: draft.week, text: result.text, tone: result.tone });
      }
    });
    this.lastMessage = result;
    return result;
  }

  /** Saisit une opportunité de la semaine (coûte des PA). */
  performOpportunity(index: number): OppResolution {
    if (this.state.status !== 'playing' || this.state.pendingEvent) {
      return { ok: false, text: 'Impossible pour le moment.', tone: 'neutral' };
    }
    let result: OppResolution = { ok: false, text: '', tone: 'neutral' };
    this.commit((draft) => {
      result = resolveOpportunity(draft, index, this.rng);
      if (result.ok) this.tally(draft, 'opportunity');
      if (result.ok) draft.log.push({ week: draft.week, text: result.text, tone: result.tone });
    });
    return result;
  }

  /** Utilise un secret comme levier (chantage / divulgation). Coûte 1 PA. */
  performHook(colleagueId: string, secretId: string, mode: HookMode): ActionResult {
    if (!this.canAct()) {
      return { ok: false, text: 'Aucune action possible pour le moment.', tone: 'neutral' };
    }
    let result: ActionResult = { ok: false, text: '', tone: 'neutral' };
    this.commit((draft) => {
      result = useHook(draft, colleagueId, secretId, mode);
      if (result.ok) {
        draft.actionPointsRemaining -= 1;
        this.tally(draft, 'hook');
        draft.log.push({ week: draft.week, text: result.text, tone: result.tone });
      }
    });
    return result;
  }

  /**
   * Termine la semaine : ouvre le week-end. Si un événement est tiré,
   * il faut ensuite appeler chooseEventOption. Sinon la semaine est
   * directement finalisée.
   */
  endWeek(): EndWeekOutcome {
    if (this.state.status !== 'playing') return {};
    let outcome: EndWeekOutcome = {};
    this.commit((draft) => {
      const hasEvent = beginWeekend(draft, this.rng);
      if (!hasEvent) {
        const summary = finalizeWeek(draft, this.rng);
        outcome = { summary };
      }
    });
    const ev = this.state.pendingEvent ? getEvent(this.state.pendingEvent) : undefined;
    if (ev) outcome = { pendingEvent: ev };
    return outcome;
  }

  /** L'événement en attente (le cas échéant). */
  pendingEvent(): GameEvent | undefined {
    return this.state.pendingEvent ? getEvent(this.state.pendingEvent) : undefined;
  }

  /** Résout le choix de l'événement puis finalise la semaine. */
  chooseEventOption(choiceIndex: number): { outcomeText: string; summary: WeekSummary } {
    let outcomeText = '';
    let summary: WeekSummary = { lines: [] };
    this.commit((draft) => {
      const event = draft.pendingEvent ? getEvent(draft.pendingEvent) : undefined;
      if (!event) return;
      const res = resolveChoice(draft, event, choiceIndex, draft.pendingTargetId, this.rng);
      outcomeText = res.outcomeText;
      draft.log.push({ week: draft.week, text: `${event.title} — ${res.outcomeText}`, tone: res.success ? 'good' : 'bad' });
      summary = finalizeWeek(draft, this.rng);
    });
    return { outcomeText, summary };
  }

  /** Désamorce l'intention hostile d'un collègue. Coûte 1 PA. */
  performDefuse(colleagueId: string): ActionResult {
    if (!this.canAct()) {
      return { ok: false, text: 'Aucune action possible pour le moment.', tone: 'neutral' };
    }
    let result: ActionResult = { ok: false, text: '', tone: 'neutral' };
    this.commit((draft) => {
      result = defuseIntent(draft, colleagueId, this.rng);
      if (result.ok) {
        draft.actionPointsRemaining -= 1;
        this.tally(draft, 'defuse');
        draft.log.push({ week: draft.week, text: result.text, tone: result.tone });
      }
    });
    return result;
  }

  /** Monte un dossier sur un innocent, en vue du prochain audit. Coûte 1 PA. */
  performScapegoat(colleagueId: string): ActionResult {
    if (!this.canAct()) {
      return { ok: false, text: 'Aucune action possible pour le moment.', tone: 'neutral' };
    }
    let result: ActionResult = { ok: false, text: '', tone: 'neutral' };
    this.commit((draft) => {
      result = prepareScapegoat(draft, colleagueId, this.rng);
      if (result.ok) {
        draft.actionPointsRemaining -= 1;
        this.tally(draft, 'scapegoat');
        draft.log.push({ week: draft.week, text: result.text, tone: result.tone });
      }
    });
    return result;
  }

  /** Intervient dans le coup qu'un collègue monte contre un autre. Coûte 1 PA. */
  private performOnScheme(
    schemerId: string,
    key: string,
    fn: (draft: GameState, id: string) => ActionResult,
  ): ActionResult {
    if (!this.canAct()) {
      return { ok: false, text: 'Aucune action possible pour le moment.', tone: 'neutral' };
    }
    let result: ActionResult = { ok: false, text: '', tone: 'neutral' };
    this.commit((draft) => {
      result = fn(draft, schemerId);
      if (result.ok) {
        draft.actionPointsRemaining -= 1;
        this.tally(draft, key);
        draft.log.push({ week: draft.week, text: result.text, tone: result.tone });
      }
    });
    return result;
  }

  /**
   * Point d'entrée unique de l'UI : exécute l'action décrite par un
   * `ActionId` (celui-là même que `preview.ts` a chiffré). Garantit que
   * ce qui est annoncé au joueur et ce qui est exécuté ne divergent pas.
   */
  perform(id: ActionId): ActionResult {
    switch (id.kind) {
      case 'bosser':
        return this.performAction('bosser');
      case 'glander':
        return this.performAction('glander');
      case 'cafe':
        return this.performAction('cafe', { targetId: id.targetId });
      case 'fouiner':
        return this.performAction('fouiner', { targetId: id.targetId });
      case 'defuse':
        return this.performDefuse(id.targetId);
      case 'scapegoat':
        return this.performScapegoat(id.targetId);
      case 'warn':
        return this.performOnScheme(id.targetId, 'warn', warnVictim);
      case 'abet':
        return this.performOnScheme(id.targetId, 'abet', abetScheme);
      case 'hook':
        return this.performHook(id.targetId, id.secretId, id.mode);
    }
  }

  /** Redémarre une nouvelle partie (même store). */
  reset(seed?: number, name?: string): void {
    this.state = createInitialState(seed, name);
    this.rng = new Rng(this.state.seed, 0);
    generateOpportunities(this.state, this.rng);
    assignIntents(this.state, this.rng);
    this.persist();
    this.emit();
  }
}
