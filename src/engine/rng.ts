// ─────────────────────────────────────────────────────────────
// rng.ts — Générateur pseudo-aléatoire seedé et sérialisable.
//
// On stocke uniquement la graine + le nombre d'appels (cursor)
// dans le GameState. Rejouer les mêmes appels reproduit la partie
// à l'identique (debug / replay).
// ─────────────────────────────────────────────────────────────

/** mulberry32 : PRNG rapide et déterministe, 32 bits. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * RNG déterministe reconstruit à partir de (seed, cursor).
 * Chaque appel à `next()` incrémente le curseur ; on peut lire
 * le curseur courant via `cursor` pour le sauvegarder.
 */
export class Rng {
  readonly seed: number;
  private _cursor: number;
  private gen: () => number;

  constructor(seed: number, cursor = 0) {
    this.seed = seed;
    this._cursor = 0;
    this.gen = mulberry32(seed);
    // Avance jusqu'au curseur sauvegardé pour reprendre l'état exact.
    for (let i = 0; i < cursor; i++) this.next();
  }

  get cursor(): number {
    return this._cursor;
  }

  /** Flottant dans [0, 1). */
  next(): number {
    this._cursor++;
    return this.gen();
  }

  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Renvoie true avec une probabilité `percent` (0–100). */
  chance(percent: number): boolean {
    return this.next() * 100 < percent;
  }

  /** Élément aléatoire d'un tableau (undefined si vide). */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  /**
   * Tirage pondéré : chaque item a un poids > 0.
   * Renvoie undefined si la liste est vide ou tous les poids nuls.
   */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T | undefined {
    const total = items.reduce((sum, it) => sum + Math.max(0, weightOf(it)), 0);
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, weightOf(it));
      if (roll < 0) return it;
    }
    return items[items.length - 1];
  }
}

/** Graine « aléatoire » quand le joueur n'en fournit pas. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
