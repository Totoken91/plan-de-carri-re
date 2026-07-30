// ─────────────────────────────────────────────────────────────
// suspicion.ts — Audit de conformité RH & conditions de défaite.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { balance } from '@data/balance';

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
export function runAudit(state: GameState): AuditResult {
  if (state.suspicion < balance.suspicionAuditThreshold) {
    return { triggered: false, survived: true };
  }

  const hasAlibi = state.flags.includes('alibi_pret');
  const hasScapegoat = state.colleagues.some((c) => c.alive && c.flags.includes('bouc_emissaire'));

  if (hasAlibi || hasScapegoat) {
    // On s'en sort, mais l'alibi est consommé et la suspicion retombe.
    state.flags = state.flags.filter((f) => f !== 'alibi_pret');
    state.suspicion = Math.max(0, state.suspicion - 40);
    return {
      triggered: true,
      survived: true,
      reason: hasAlibi
        ? "L'audit n'a rien trouvé : ton alibi tenait la route."
        : 'Le dossier a désigné un autre coupable. Pas toi.',
    };
  }

  state.status = 'fired';
  return {
    triggered: true,
    survived: false,
    reason: "Licenciement pour faute grave. L'audit n'a laissé aucune place au doute.",
  };
}

/**
 * Vérifie l'effondrement par burn-out : Nerfs à 0 pendant trop longtemps.
 * On utilise un flag compteur simple stocké via le nombre de semaines.
 */
export function checkBurnout(state: GameState): boolean {
  if (state.player.stats.nerfs > 0) {
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
export function suspicionTier(suspicion: number): 'calme' | 'rumeurs' | 'surveillance' | 'critique' {
  if (suspicion < 25) return 'calme';
  if (suspicion < 45) return 'rumeurs';
  if (suspicion < balance.suspicionAuditThreshold) return 'surveillance';
  return 'critique';
}
