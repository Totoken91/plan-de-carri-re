// ─────────────────────────────────────────────────────────────
// paliers.ts — Les stats ont des SEUILS nommés, pas seulement une valeur.
//
// Une barre qui va de 0 à 100 dit combien, jamais quoi. « Aura 62 » ne
// veut rien dire tant qu'on ne sait pas si 62 est beaucoup. Un palier
// nommé répond à la question d'un mot — « Influent » — et surtout il
// donne un OBJECTIF : il reste trois points avant le palier suivant, on
// sait quoi faire de sa semaine.
//
// La règle qui les empêche d'être décoratifs : chaque palier porte un
// effet mécanique réel. Le nom n'est pas une récompense de vitrine, c'est
// l'étiquette d'un bonus qu'on peut lire dans les chiffres annoncés par
// les boutons.
//
// Les effets passent par les MÊMES clés génériques que les traits, donc
// tous les consommateurs existants en profitent sans une ligne de plus :
// une chance de réussite de plan, un coût en nerfs, un gain d'opinion
// tiennent déjà compte des traits, ils tiendront compte des paliers.
// ─────────────────────────────────────────────────────────────
import type { GameState, StatKey, Stats, TraitModKey } from '@state/schema';
import raw from '@data/paliers.json';

export interface PalierDef {
  seuil: number;
  nom: string;
  note: string;
  mods?: Partial<Record<TraitModKey, number>>;
  /** Appliqué chaque vendredi, tant que le palier est tenu. */
  hebdo?: Partial<Stats>;
}

export const PALIERS = raw as Record<StatKey, PalierDef[]>;

/** Le palier atteint pour cette stat. Toujours défini — le premier vaut 0. */
export function palierDe(valeur: number, stat: StatKey): PalierDef {
  const liste = PALIERS[stat];
  let cur = liste[0]!;
  for (const p of liste) if (valeur >= p.seuil) cur = p;
  return cur;
}

/** Le palier suivant, ou `undefined` si l'on est au sommet. */
export function palierSuivant(valeur: number, stat: StatKey): PalierDef | undefined {
  return PALIERS[stat].find((p) => p.seuil > valeur);
}

const STATS: StatKey[] = ['aura', 'rendement', 'combine', 'nerfs'];

/** Somme des modificateurs additifs apportés par les paliers atteints. */
export function palierBonus(state: GameState, key: TraitModKey): number {
  let sum = 0;
  for (const s of STATS) sum += palierDe(state.player.stats[s], s).mods?.[key] ?? 0;
  return sum;
}

/** Produit des modificateurs multiplicatifs apportés par les paliers. */
export function palierFactor(state: GameState, key: TraitModKey): number {
  let f = 1;
  for (const s of STATS) f *= palierDe(state.player.stats[s], s).mods?.[key] ?? 1;
  return f;
}

/**
 * Régénération hebdomadaire des paliers hauts.
 *
 * C'est ce qui rend les hauts paliers durables plutôt que fragiles : une
 * Aura d'« Incontournable » remonte un peu toute seule, donc une mauvaise
 * semaine ne fait pas retomber deux paliers d'un coup. Sans cette
 * clémence, les seuils hauts seraient traversés dans les deux sens toutes
 * les semaines et le nom afficherait du bruit.
 */
export function tickPaliers(state: GameState): void {
  const gains: Partial<Stats> = {};
  for (const s of STATS) {
    const h = palierDe(state.player.stats[s], s).hebdo;
    if (!h) continue;
    for (const [k, v] of Object.entries(h)) {
      gains[k as StatKey] = (gains[k as StatKey] ?? 0) + v;
    }
  }
  for (const [k, v] of Object.entries(gains)) {
    const key = k as StatKey;
    state.player.stats[key] = Math.max(0, Math.min(100, state.player.stats[key] + v));
  }
}
