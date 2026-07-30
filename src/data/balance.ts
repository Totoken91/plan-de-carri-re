// Typage du fichier de tuning (mécanique des actions de base + plans).
import type { Stats } from '@state/schema';
import raw from './balance.json';

export interface Balance {
  actionPointsPerWeek: number;
  startStats: Stats;
  startSuspicion: number;
  suspicionAuditThreshold: number;
  burnoutGraceWeeks: number;
  winSurviveWeeks: number;
  actions: {
    bosser: { rendement: number; reputation: number; nerfs: number };
    cafe: { opinion: number; nerfs: number };
    fouiner: { suspicionRisk: number; suspicionOnCaught: number };
    comploter: { preparationGain: number; suspicionPerPrep: number };
    glander: { nerfs: number; fayotSuspicion: number };
  };
  plan: {
    combineWeight: number;
    vigilanceWeight: number;
    preparationWeight: number;
    suspicionVigilanceFactor: number;
    minSuccess: number;
    maxSuccess: number;
  };
}

export const balance: Balance = raw as Balance;
