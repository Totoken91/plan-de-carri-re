// ─────────────────────────────────────────────────────────────
// store.ts — Création d'état, save/load localStorage, et API mutative.
//
// Toutes les mutations passent par le store : il clone l'état, appelle
// le moteur (fonctions pures/mutatives sur le clone), persiste le curseur
// RNG, sauvegarde et notifie les abonnés (React).
// ─────────────────────────────────────────────────────────────
import type { Appearance, GameEvent, GameState, Player, TraitId } from './schema';
import { startingColleagues } from '@data/content';
import { DEFAULT_APPEARANCE, randomName } from '@data/appearance';
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
import { applyTraitsAtStart } from '@engine/traits';
import type { ActionId } from '@engine/preview';

import { SAVE_VERSION, readSlot, writeSlot } from './saves';

export { SAVE_VERSION };

// ── Création d'une partie ────────────────────────────────────
export function createInitialState(
  seed = randomSeed(),
  playerName?: string,
  appearance: Appearance = DEFAULT_APPEARANCE,
  traits: TraitId[] = [],
): GameState {
  const player: Player = {
    name: playerName?.trim() || randomName(),
    stats: { ...balance.startStats },
    rank: 'stagiaire',
    reputation: 0,
    appearance,
    traits,
  };
  const state: GameState = {
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
  // Les traits posent leurs valeurs de départ AVANT que quoi que ce soit
  // d'autre ne touche à l'état : ce sont des conditions initiales, pas
  // des effets récurrents.
  applyTraitsAtStart(state);
  return state;
}

// La persistance vit dans saves.ts : le store ne sait qu'une chose,
// c'est dans QUEL dossier il écrit.

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
  /**
   * Dossier dans lequel ce store écrit. `undefined` = aucune partie
   * ouverte : le store existe (l'abonnement React est posé une fois pour
   * toutes) mais rien ne doit être enregistré. C'est l'état dans lequel
   * on se trouve tant qu'on est au menu.
   */
  private slot: number | undefined;
  /** Dernier message d'action, pour un retour immédiat à l'UI. */
  lastMessage: ActionResult | undefined;

  constructor(initial: GameState, slot?: number) {
    this.state = initial;
    this.slot = slot;
    this.rng = new Rng(initial.seed, initial.rngCursor);
    this.prime();
  }

  /**
   * Amorçage : une partie neuve n'a ni opportunités ni intentions ; un
   * dossier repris en cours de semaine conserve les siennes.
   */
  private prime(): void {
    if (this.state.status !== 'playing') return;
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

  /** Dossier courant, ou `undefined` si aucune partie n'est ouverte. */
  get openSlot(): number | undefined {
    return this.slot;
  }

  /** Ouvre un dossier existant. Faux s'il est vide ou illisible. */
  open(slot: number): boolean {
    const saved = readSlot(slot);
    if (!saved) return false;
    this.state = saved;
    this.slot = slot;
    this.rng = new Rng(saved.seed, saved.rngCursor);
    this.prime();
    this.emit();
    return true;
  }

  /** Démarre une carrière dans un dossier, en écrasant ce qu'il contenait. */
  startCareer(
    slot: number,
    name: string,
    appearance: Appearance,
    traits: TraitId[] = [],
    seed?: number,
  ): void {
    this.state = createInitialState(seed, name, appearance, traits);
    this.slot = slot;
    this.rng = new Rng(this.state.seed, 0);
    generateOpportunities(this.state, this.rng);
    assignIntents(this.state, this.rng);
    this.persist();
    this.emit();
  }

  /** Referme le dossier courant : plus rien ne s'enregistre. */
  close(): void {
    this.slot = undefined;
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
    // Aucun dossier ouvert = on est au menu : écrire ici écraserait le
    // dossier du joueur avec une partie fantôme.
    if (this.slot !== undefined) writeSlot(this.slot, this.state);
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

}
