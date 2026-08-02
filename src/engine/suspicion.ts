// ─────────────────────────────────────────────────────────────
// suspicion.ts — Audit de conformité RH & conditions de défaite.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { balance } from '@data/balance';
import { burnScapegoat, scapegoatOf } from './scapegoat';
import { traitFactor } from './traits';
import { getRank } from '@data/content';

/**
 * TOUTE hausse de suspicion passe par ici.
 *
 * Elle était écrite en douze endroits sous la forme `clamp(suspicion + n)`.
 * Un trait qui modifie la discrétion n'avait alors aucun point
 * d'application : il aurait fallu le brancher douze fois, et le treizième
 * appel écrit plus tard l'aurait oublié en silence. Une hausse est une
 * règle du jeu, elle mérite une fonction.
 *
 * Renvoie la hausse RÉELLEMENT appliquée, pour que les messages
 * annoncent le bon chiffre.
 */
export function raiseSuspicion(state: GameState, amount: number): number {
  const applied = Math.round(amount * traitFactor(state, 'suspicionGain'));
  const before = state.suspicion;
  state.suspicion = Math.max(0, Math.min(100, state.suspicion + applied));
  return state.suspicion - before;
}

/** Baisse de suspicion : jamais modifiée par les traits (c'est un soulagement, pas une trace). */
export function easeSuspicion(state: GameState, amount: number): void {
  state.suspicion = Math.max(0, Math.min(100, state.suspicion - amount));
}

export interface AuditResult {
  triggered: boolean;
  survived: boolean;
  reason?: string;
}

/**
 * Vendredi : si la suspicion dépasse le seuil critique, un audit se déclenche.
 * On survit si on a un alibi (flag) ou (V2) un bouc émissaire prêt.
 * Sinon : licenciement pour faute grave = game over.
 */
/** Le seuil d'audit du rang courant : il descend à mesure qu'on monte. */
export function seuilAudit(state: GameState): number {
  const ordre = getRank(state.player.rank)?.order ?? 0;
  return Math.max(35, balance.suspicionAuditThreshold - ordre * balance.auditSeuilParRang);
}

export function runAudit(state: GameState): AuditResult {
  if (state.suspicion < seuilAudit(state)) {
    return { triggered: false, survived: true };
  }

  // L'alibi passe avant : il ne coûte personne. Le bouc émissaire est le
  // recours suivant, et il se paie — un innocent quitte l'entreprise.
  if (state.flags.includes('alibi_pret')) {
    state.flags = state.flags.filter((f) => f !== 'alibi_pret');
    state.suspicion = Math.max(0, state.suspicion - 40);
    return {
      triggered: true,
      survived: true,
      reason: "L'audit n'a rien trouvé : ton alibi tenait la route.",
    };
  }

  // On ne désigne pas deux coupables en deux mois.
  //
  // Sans cette clause, le bouc émissaire était une rente : le banc
  // d'essai a trouvé la boucle en quelques centaines de parties — monter
  // un dossier, laisser la Suspicion crever le plafond, encaisser le
  // soulagement de −45 et la place libérée, recommencer. Quatre départs
  // par partie sur six collègues, et l'audit devenait un allié.
  //
  // Un second audit rapproché ne se laisse plus faire : le dossier est
  // trop commode, et c'est précisément ce que l'auditeur remarque.
  const dernier = state.flags.find((f) => f.startsWith('bouc_brule:'));
  const recent =
    dernier !== undefined && state.week - Number(dernier.split(':')[1]) < balance.scapegoat.reciditeWeeks;

  if (scapegoatOf(state) && !recent) {
    const name = burnScapegoat(state);
    state.flags = state.flags.filter((f) => !f.startsWith('bouc_brule:'));
    state.flags.push(`bouc_brule:${state.week}`);
    return {
      triggered: true,
      survived: true,
      reason: `Le dossier a désigné ${name}. Accompagnement de sortie le soir même. Toi, tu es blanchi — et tout l'étage a compris.`,
    };
  }

  if (scapegoatOf(state) && recent) {
    state.status = 'fired';
    return {
      triggered: true,
      survived: false,
      reason:
        'Deuxième coupable désigné en deux mois. L’auditeur a relevé la coïncidence avant de relever les faits. Licenciement.',
    };
  }

  // Le premier audit sans couverture n'est pas la fin.
  //
  // Il l'était, et c'est ce qui rendait le jeu injouable une fois la
  // promotion devenue une compétition : écarter quelqu'un coûte de la
  // Suspicion, donc TOUTE partie qui jouait le jeu finissait licenciée —
  // 85 à 93 % selon la stratégie, toutes sur un seul audit.
  //
  // Une seule faute ne doit pas suffire. La mise à pied coûte cher — la
  // moitié du chemin vers la promotion suivante — et elle laisse une
  // trace : tant qu'on est en sursis, le suivant ne pardonne pas. C'est
  // la même règle que le loyer impayé, et c'est volontaire : le jeu n'a
  // que deux façons de finir mal, elles doivent se lire pareil.
  const sursis = state.flags.find((f) => f.startsWith('sursis:'));
  const enSursis =
    sursis !== undefined && state.week - Number(sursis.split(':')[1]) < balance.sursisWeeks;

  if (!enSursis) {
    const perte = Math.round(state.player.reputation * 0.35);
    state.player.reputation = Math.max(0, state.player.reputation - perte);
    state.suspicion = Math.max(0, state.suspicion - 30);
    state.flags = state.flags.filter((f) => !f.startsWith('sursis:'));
    state.flags.push(`sursis:${state.week}`);
    return {
      triggered: true,
      survived: true,
      reason: `Mise à pied conservatoire, trois jours. Tu reviens avec ${perte} points de réputation en moins et un dossier ouvert. Le prochain écart ne se discutera pas.`,
    };
  }

  state.status = 'fired';
  return {
    triggered: true,
    survived: false,
    reason:
      "Deuxième audit alors que ton dossier était encore ouvert. Licenciement pour faute grave, sans préavis.",
  };
}

/**
 * Vérifie l'effondrement par burn-out : Nerfs à 0 pendant trop longtemps.
 * On utilise un flag compteur simple stocké via le nombre de semaines.
 */
export function checkBurnout(state: GameState): boolean {
  // Le seuil était « exactement 0 ». Mesuré sur des milliers de parties :
  // zéro effondrement, jamais, quelle que soit la façon de jouer — parce
  // qu'on passe de 6 à 14 sans s'arrêter sur 0. Une fin de partie qui ne
  // se produit pas n'est pas une menace, c'est une ligne de code.
  if (state.player.stats.nerfs > balance.burnoutSeuil) {
    state.flags = state.flags.filter((f) => !f.startsWith('burnout_since:'));
    return false;
  }
  const marker = state.flags.find((f) => f.startsWith('burnout_since:'));
  if (!marker) {
    state.flags.push(`burnout_since:${state.week}`);
    return false;
  }
  const since = Number(marker.split(':')[1]);
  if (state.week - since >= balance.burnoutGraceWeeks) {
    state.status = 'burnout';
    return true;
  }
  return false;
}

// Re-export léger pour éviter un cycle d'import direct util <-> archetype.
export function suspicionTier(
  suspicion: number,
  seuil = balance.suspicionAuditThreshold,
): 'calme' | 'rumeurs' | 'surveillance' | 'critique' {
  if (suspicion < seuil * 0.36) return 'calme';
  if (suspicion < seuil * 0.64) return 'rumeurs';
  if (suspicion < seuil) return 'surveillance';
  return 'critique';
}
