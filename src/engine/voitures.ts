// ─────────────────────────────────────────────────────────────
// voitures.ts — Ce qu'on gare sur le parking, et ce que ça dit de toi.
//
// La voiture est le seul achat du jeu qui touche directement une STAT.
// C'est assumé : l'Aura, c'est ce que les gens croient savoir de toi
// avant que tu ouvres la bouche, et un parking d'entreprise est
// exactement l'endroit où cette croyance se forme.
//
// LE POINT DÉLICAT : comment un objet possédé modifie une stat.
//
// Trois façons, dont deux sont mauvaises. Ajouter le bonus chaque
// semaine ferait monter l'Aura à l'infini pour un achat unique. Calculer
// une « stat effective » dérivée obligerait à refaire passer tout le jeu
// — aperçus, plans, événements — par un accesseur, et le premier oubli
// donnerait un chiffre annoncé différent du chiffre appliqué.
//
// Retenu : le bonus est appliqué UNE FOIS, au changement de véhicule, et
// c'est la DIFFÉRENCE avec le précédent qui s'applique. Passer de la
// citadine (+3) au coupé (+17) donne +14 ; revendre le coupé rend −17.
// Le bilan est donc exact quel que soit le chemin, et la stat reste une
// valeur unique, lisible partout, sans accesseur à ne pas oublier.
//
// Le prix d'entretien, lui, tombe chaque vendredi. C'est ce qui empêche
// d'acheter au-dessus de ses moyens et de garder : une hypercar coûte
// 9 000 € par semaine, soit trois fois le salaire d'un Team Lead.
// ─────────────────────────────────────────────────────────────
import type { GameState, LogEntry } from '@state/schema';
import { euros, payer } from './argent';
import raw from '@data/voitures.json';

export interface VoitureDef {
  id: string;
  nom: string;
  marque: string;
  description: string;
  icone: string;
  prix: number;
  /** Prélevé chaque vendredi tant qu'on la possède. */
  entretien: number;
  /** Bonus d'Aura, appliqué au changement de véhicule. */
  aura: number;
  classe: 'épave' | 'banale' | 'cadre' | 'prestige' | 'obscène';
}

export const VOITURES: VoitureDef[] = raw as VoitureDef[];

export const getVoiture = (id: string | undefined): VoitureDef | undefined =>
  id ? VOITURES.find((v) => v.id === id) : undefined;

export const voitureDe = (state: GameState): VoitureDef | undefined =>
  getVoiture(state.player.voiture);

export const entretienVoiture = (state: GameState): number => voitureDe(state)?.entretien ?? 0;

export interface AchatResult {
  ok: boolean;
  text: string;
  tone: LogEntry['tone'];
}

const ajusterAura = (state: GameState, delta: number): void => {
  state.player.stats.aura = Math.max(0, Math.min(100, state.player.stats.aura + delta));
};

export function acheterVoiture(state: GameState, id: string): AchatResult {
  const v = getVoiture(id);
  if (!v) return { ok: false, text: 'Modèle inconnu.', tone: 'neutral' };
  const actuelle = voitureDe(state);
  if (actuelle?.id === v.id) return { ok: false, text: 'Tu l’as déjà.', tone: 'neutral' };

  // La reprise de l'ancienne : la moitié, comme pour le mobilier. Ce
  // n'est pas une punition, c'est ce qui empêche de traiter le parking
  // comme un compte d'épargne.
  const reprise = actuelle ? Math.round(actuelle.prix / 2) : 0;
  const aPayer = Math.max(0, v.prix - reprise);
  if (!payer(state, aPayer)) {
    return { ok: false, text: `Il te manque ${euros(aPayer - state.argent)}.`, tone: 'neutral' };
  }

  const avant = actuelle?.aura ?? 0;
  ajusterAura(state, v.aura - avant);
  state.player.voiture = v.id;

  return {
    ok: true,
    text: actuelle
      ? `${v.nom}. L’ancienne part en reprise pour ${euros(reprise)}. ${v.aura - avant >= 0 ? '+' : ''}${v.aura - avant} d’Aura.`
      : `${v.nom}. ${v.description} (+${v.aura} d’Aura)`,
    tone: 'good',
  };
}

export function revendreVoiture(state: GameState): AchatResult {
  const v = voitureDe(state);
  if (!v) return { ok: false, text: 'Tu n’as pas de voiture.', tone: 'neutral' };
  const rendu = Math.round(v.prix / 2);
  state.argent += rendu;
  ajusterAura(state, -v.aura);
  state.player.voiture = undefined;
  return {
    ok: true,
    text: `${v.nom} revendue ${euros(rendu)}. Tu reprends les transports, et −${v.aura} d’Aura avec.`,
    tone: 'neutral',
  };
}
