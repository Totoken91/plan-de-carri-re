// ─────────────────────────────────────────────────────────────
// traits.ts — Le catalogue des traits, et le budget d'embauche.
//
// Contenu pur : ajouter un trait, c'est ajouter un objet dans
// traits.json. Le moteur ne connaît aucun trait par son nom — il ne
// connaît que les quantités génériques listées dans `TraitModKey`.
// ─────────────────────────────────────────────────────────────
import type { TraitDef, TraitId } from '@state/schema';
import raw from './traits.json';

interface TraitFile {
  /** Points à dépenser exactement à l'embauche. */
  budget: number;
  /** Nombre maximal de défauts : sans plafond, on empile les tares. */
  maxDefauts: number;
  traits: TraitDef[];
}

const file = raw as TraitFile;

export const TRAIT_BUDGET = file.budget;
export const MAX_DEFAUTS = file.maxDefauts;
export const traits: TraitDef[] = file.traits;

const byId = new Map(traits.map((t) => [t.id, t]));
export const getTrait = (id: TraitId): TraitDef | undefined => byId.get(id);

/** Qualités (coût positif) et défauts (coût négatif), dans l'ordre du fichier. */
export const qualites = traits.filter((t) => t.cout > 0);
export const defauts = traits.filter((t) => t.cout < 0);

/** Points restants : le budget moins la somme des coûts. */
export function pointsLeft(chosen: TraitId[]): number {
  return chosen.reduce((n, id) => n - (getTrait(id)?.cout ?? 0), TRAIT_BUDGET);
}

export function countDefauts(chosen: TraitId[]): number {
  return chosen.filter((id) => (getTrait(id)?.cout ?? 0) < 0).length;
}

/**
 * Une sélection n'est valide QUE si le budget est dépensé exactement.
 * Laisser partir un joueur avec des points en poche, c'est lui faire
 * commencer une partie diminuée sans qu'il l'ait choisi.
 */
export function selectionValid(chosen: TraitId[]): boolean {
  return pointsLeft(chosen) === 0 && countDefauts(chosen) <= MAX_DEFAUTS;
}
