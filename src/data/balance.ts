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
  scapegoat: {
    combineRequired: number;
    baseChance: number;
    combineWeight: number;
    opinionWeight: number;
    vigilanceWeight: number;
    suspicionOnPrepare: number;
    suspicionOnFail: number;
    opinionOnFail: number;
    /** Semaines avant qu'un montage ne se périme. */
    staleWeeks: number;
    auditSuspicionRelief: number;
    auditWitnessOpinion: number;
  };
  plan: {
    combineWeight: number;
    vigilanceWeight: number;
    preparationWeight: number;
    suspicionVigilanceFactor: number;
    minSuccess: number;
    maxSuccess: number;
  };
  /** Trésorerie de départ, avant le premier salaire. */
  argentDepart: number;
  /**
   * Loyers impayés consécutifs avant expulsion.
   *
   * Deux, et pas un : le premier impayé doit être un avertissement qu'on
   * peut encore rattraper — en vendant des titres, en revendant un
   * meuble, en déménageant plus petit. Une fin de partie qui tombe sans
   * qu'on ait pu réagir n'est pas un enjeu, c'est un piège.
   */
  expulsionApres: number;
  romance: {
    /** Seuils d'attachement qui font passer d'un statut au suivant. */
    seuilFlirt: number;
    seuilLiaison: number;
    seuilCouple: number;
    draguerGain: number;
    draguerNerfs: number;
    draguerOpinionMin: number;
    toilettesGain: number;
    toilettesSuspicion: number;
    /** Probabilité, en %, de se faire surprendre. */
    toilettesRisque: number;
    toilettesScandaleSuspicion: number;
    toilettesScandaleOpinion: number;
    /** Ce que perd l'opinion d'une autre liaison quand une histoire s'ébruite. */
    jalousieOpinion: number;
    officialiserOpinion: number;
    officialiserSuspicion: number;
    /** Attachement perdu par semaine sans rien faire. */
    derivePasEntretenue: number;
    conjointOpinionPlancher: number;
    conjointNerfs: number;
    rupture: { opinion: number; suspicion: number };
  };
  subordonnes: {
    opinionMinimum: number;
    rapporterChance: number;
    abattreChance: number;
    abattreSuspicion: number;
    couvrirSuspicion: number;
    couvrirOpinion: number;
    produireReputation: number;
    charmerOpinion: number;
    /** En dessous de cette opinion, un subordonné peut te trahir. */
    trahisonSousOpinion: number;
    trahisonSuspicion: number;
  };
  marche: {
    /** Frais de courtage, en % du montant. */
    fraisTransaction: number;
    /** Biais ajouté au tirage d'un titre quand on a un tuyau. */
    tuyauBonus: number;
  };
}

export const balance: Balance = raw as Balance;
