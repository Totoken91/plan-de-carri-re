// ─────────────────────────────────────────────────────────────
// argent.ts — Le salaire, ce qu'il permet, et ce qu'il coûte de le garder.
//
// L'argent n'est pas une sixième statistique. Une statistique se dépense
// en s'usant ; l'argent se dépense en DISPARAISSANT, et cette différence
// est tout le sujet. Une stat à 12 remonte toute seule ; 12 € ne
// remontent que le vendredi suivant.
//
// Deux conséquences tenues partout :
//
//  · rien ne se paie à crédit. Une dépense qu'on ne peut pas couvrir est
//    refusée, pas empruntée. Un jeu où l'on peut toujours agir n'a pas de
//    décisions, seulement des séquences ;
//
//  · le loyer tombe avant le salaire dans la lecture du joueur, mais
//    après dans le calcul. Autrement dit on ne peut pas être expulsé le
//    jour d'une promotion — la trésorerie est évaluée une fois tout
//    encaissé.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { getRank } from '@data/content';
import { apparts } from '@data/vieprivee';

/** Format monétaire unique du jeu. Un seul endroit, donc un seul style. */
export function euros(n: number): string {
  const arrondi = Math.round(n);
  return `${arrondi.toLocaleString('fr-FR')} €`;
}

export const salaireDe = (state: GameState): number => getRank(state.player.rank)?.salaire ?? 0;

export const loyerDe = (state: GameState): number =>
  apparts.find((a) => a.id === state.appart.niveau)?.loyer ?? 0;

/** Peut-on payer ce montant ? Jamais de découvert. */
export const peutPayer = (state: GameState, montant: number): boolean => state.argent >= montant;

/**
 * Débite. Renvoie faux — et ne touche à rien — si la somme n'y est pas.
 * Le booléen est le contrat : tout appelant DOIT le lire avant d'appliquer
 * quoi que ce soit d'autre, sinon on obtient l'effet sans le paiement.
 */
export function payer(state: GameState, montant: number): boolean {
  if (montant <= 0) {
    state.argent -= montant;
    return true;
  }
  if (state.argent < montant) return false;
  state.argent -= montant;
  return true;
}

export function crediter(state: GameState, montant: number): void {
  state.argent += Math.max(0, montant);
}

export interface LigneDePaie {
  salaire: number;
  loyer: number;
  net: number;
  decouvert: boolean;
}

/**
 * La paie du vendredi. Le loyer est prélevé dans la foulée.
 *
 * Si le solde ne suffit pas, on ne descend PAS sous zéro : le manque est
 * signalé et le joueur commence la semaine à sec. Un solde négatif serait
 * un crédit gratuit déguisé, c'est-à-dire l'inverse de la contrainte.
 */
export function verserSalaire(state: GameState): LigneDePaie {
  const salaire = salaireDe(state);
  const loyer = loyerDe(state);
  state.argent += salaire;
  const decouvert = state.argent < loyer;
  state.argent = Math.max(0, state.argent - loyer);
  return { salaire, loyer, net: salaire - loyer, decouvert };
}
