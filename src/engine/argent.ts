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
import { trainDeVie } from './promotion';
import { entretienVoiture } from './voitures';

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
  /** Ce que le rang oblige à dépenser : costume, déjeuners, tournées. */
  train: number;
  /** Entretien, carburant, parking. */
  voiture: number;
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
  // Le train de vie n'est pas une taxe déguisée : c'est ce qui empêche
  // le salaire de rendre l'argent sans objet passé le premier tiers de
  // la partie. Sans lui, un Senior n'a plus aucune décision financière à
  // prendre — mesuré, et c'était le cas.
  const train = trainDeVie(state);
  // L'entretien de la voiture était prélevé APRÈS la paie, dans un
  // deuxième temps, avec un plancher à zéro : autrement dit il ne pouvait
  // structurellement jamais causer d'impayé. Sur des milliers de parties
  // simulées, y compris avec un joueur qui achetait systématiquement la
  // voiture la plus chère à sa portée, l'expulsion n'est jamais tombée
  // une seule fois. Une charge qui ne peut pas mettre en défaut n'est pas
  // une charge, c'est un affichage.
  const voiture = entretienVoiture(state);
  state.argent += salaire;
  const du = loyer + train + voiture;
  const decouvert = state.argent < du;
  state.argent = Math.max(0, state.argent - du);
  return { salaire, loyer, train, voiture, net: salaire - du, decouvert };
}
