// ─────────────────────────────────────────────────────────────
// saves.ts — Les dossiers du personnel.
//
// Trois emplacements de sauvegarde, chacun autonome. Dans la fiction,
// ce sont des dossiers RH : on en ouvre un, on y travaille, il se met à
// jour tout seul.
//
// L'enregistrement est CONTINU — chaque action écrit dans le dossier
// courant. Il n'y a donc pas de bouton « Sauvegarder » : un bouton qui
// ne fait rien de plus que ce que le jeu fait déjà est un mensonge
// rassurant. Ce que le menu propose à la place, c'est ce que
// l'autosauvegarde ne sait pas faire : choisir un dossier, en ouvrir un
// autre, en dupliquer un avant une manœuvre risquée, en jeter un.
//
// Le résumé d'un dossier (`SaveSummary`) est dérivé de l'état, jamais
// stocké à part : deux sources pour la même vérité, c'est la garantie
// qu'elles divergent.
// ─────────────────────────────────────────────────────────────
import type { GameState } from './schema';

export const SAVE_VERSION = 5;
export const SLOT_COUNT = 3;

const slotKey = (slot: number) => `plan-de-carriere/dossier/${slot}`;
/** Emplacement mono-sauvegarde d'avant les dossiers. */
const LEGACY_KEY = 'plan-de-carriere/save/v4';
const LAST_SLOT_KEY = 'plan-de-carriere/dernier-dossier';

export interface SaveSummary {
  slot: number;
  name: string;
  rank: string;
  week: number;
  reputation: number;
  suspicion: number;
  status: GameState['status'];
  appearance: GameState['player']['appearance'];
  /** Horodatage de la dernière écriture, pour trier et afficher. */
  savedAt: number;
}

interface StoredSave {
  state: GameState;
  savedAt: number;
}

// ── Lecture / écriture ───────────────────────────────────────
function readRaw(key: string): StoredSave | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredSave | GameState;
    // Une sauvegarde d'avant les dossiers est un GameState nu.
    const stored: StoredSave =
      'state' in parsed ? parsed : { state: parsed as GameState, savedAt: 0 };
    if (stored.state?.version !== SAVE_VERSION) return undefined;
    return stored;
  } catch {
    return undefined;
  }
}

export function readSlot(slot: number): GameState | undefined {
  return readRaw(slotKey(slot))?.state;
}

export function writeSlot(slot: number, state: GameState): void {
  try {
    const payload: StoredSave = { state, savedAt: Date.now() };
    localStorage.setItem(slotKey(slot), JSON.stringify(payload));
    localStorage.setItem(LAST_SLOT_KEY, String(slot));
  } catch {
    /* quota ou mode privé : on ignore, la partie continue en mémoire */
  }
}

export function deleteSlot(slot: number): void {
  try {
    localStorage.removeItem(slotKey(slot));
  } catch {
    /* ignore */
  }
}

export function copySlot(from: number, to: number): boolean {
  const state = readSlot(from);
  if (!state) return false;
  writeSlot(to, structuredClone(state));
  return true;
}

// ── Vue d'ensemble ───────────────────────────────────────────
export function summarize(slot: number): SaveSummary | undefined {
  const stored = readRaw(slotKey(slot));
  if (!stored) return undefined;
  const s = stored.state;
  return {
    slot,
    name: s.player.name,
    rank: s.player.rank,
    week: s.week,
    reputation: s.player.reputation,
    suspicion: s.suspicion,
    status: s.status,
    appearance: s.player.appearance,
    savedAt: stored.savedAt,
  };
}

/** Les trois dossiers, dans l'ordre ; `undefined` = emplacement libre. */
export function listSlots(): Array<SaveSummary | undefined> {
  return Array.from({ length: SLOT_COUNT }, (_, i) => summarize(i));
}

/** Dossier ouvert en dernier, s'il est encore lisible. */
export function lastSlot(): number | undefined {
  try {
    const raw = localStorage.getItem(LAST_SLOT_KEY);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < SLOT_COUNT && readSlot(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

export function firstFreeSlot(): number | undefined {
  for (let i = 0; i < SLOT_COUNT; i++) if (!readSlot(i)) return i;
  return undefined;
}

// ── Reprise d'une sauvegarde d'avant les dossiers ────────────
/**
 * Une partie en cours ne doit pas disparaître parce que le format a
 * changé. La sauvegarde unique de l'ancienne version est déplacée dans
 * le premier dossier — une seule fois, puis l'ancienne clé est retirée.
 *
 * Elle porte la version précédente, donc `readRaw` la refuserait : on la
 * relit ici sans contrôle de version et on la marque à la version
 * courante. C'est légitime tant que le schéma n'a pas changé — et il n'a
 * pas changé, seul l'emballage a bougé.
 */
export function migrateLegacySave(): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    localStorage.removeItem(LEGACY_KEY);
    const state = JSON.parse(raw) as GameState;
    if (!state?.player || typeof state.week !== 'number') return false;
    if (readSlot(0)) return false; // un dossier occupe déjà la place
    state.version = SAVE_VERSION;
    writeSlot(0, state);
    return true;
  } catch {
    return false;
  }
}
