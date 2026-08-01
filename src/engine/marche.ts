// ─────────────────────────────────────────────────────────────
// marche.ts — La bourse et le casino, c'est-à-dire deux façons de
// transformer du salaire en autre chose que du salaire.
//
// Elles ne racontent pas la même chose et ne doivent donc pas avoir la
// même forme mathématique :
//
//  · la BOURSE a une dérive positive. Sur la durée, y laisser son argent
//    rapporte — c'est un placement, pas un pari. Ce qu'elle prend en
//    échange, c'est du TEMPS : l'argent immobilisé n'achète pas de
//    consultant le jour où il en faudrait un. Le cours vit dans l'état
//    sauvegardé, sinon il repartirait de zéro à chaque rechargement et le
//    joueur pourrait relancer le dé en rouvrant l'onglet ;
//
//  · le CASINO a une espérance négative, et c'est écrit noir sur blanc
//    dans les données (chance × gain < 100 % partout). Il ne sert donc
//    jamais à s'enrichir : il sert à convertir un petit capital en une
//    petite chance d'un gros capital, tout de suite. C'est la seule
//    manière d'acheter un consultant à 4 200 € quand on est Junior — et
//    c'est censé être une mauvaise idée la plupart du temps.
//
// Le tirage du cours passe par le RNG seedé du jeu, pas par Math.random :
// une même graine rejouée doit produire la même semaine boursière.
// ─────────────────────────────────────────────────────────────
import type { GameState, LogEntry } from '@state/schema';
import { balance } from '@data/balance';
import { getJeu, getTitre, titres } from '@data/vieprivee';
import { euros, payer, crediter } from './argent';
import type { Rng } from './rng';

const M = balance.marche;

/** Cours de départ : ceux du catalogue. */
export function coursInitiaux(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of titres) out[t.id] = t.base;
  return out;
}

export const coursDe = (state: GameState, id: string): number =>
  state.cours[id] ?? getTitre(id)?.base ?? 0;

/** Ce que vaut le portefeuille, au cours du jour. */
export function valeurPortefeuille(state: GameState): number {
  let total = 0;
  for (const [id, n] of Object.entries(state.portefeuille)) total += n * coursDe(state, id);
  return total;
}

/**
 * Un pas de marché, joué chaque vendredi.
 *
 * Marche aléatoire multiplicative : le cours ne peut pas devenir négatif,
 * et une même variation en pourcentage a le même poids qu'il vaille 12 €
 * ou 210 €. Un pas additif aurait fait vivre Novatek à 12 € et Kastel à
 * 210 € dans deux mondes différents.
 */
export function tickMarche(state: GameState, rng: Rng): void {
  for (const t of titres) {
    const cours = coursDe(state, t.id);
    // Somme de deux tirages : une cloche grossière, plutôt qu'un uniforme
    // qui rendrait les extrêmes aussi fréquents que le calme plat.
    const bruit = (rng.next() + rng.next() - 1) * t.volatilite;
    const suivant = cours * (1 + t.derive + bruit);
    // Plancher : un titre qui touche zéro ne remonte jamais dans un
    // modèle multiplicatif, et il resterait dans la liste pour rien.
    state.cours[t.id] = Math.max(t.base * 0.12, Math.round(suivant * 100) / 100);
  }
}

export interface OpMarche {
  ok: boolean;
  text: string;
  tone: LogEntry['tone'];
}

const frais = (montant: number) => Math.round((montant * M.fraisTransaction) / 100);

export function acheter(state: GameState, id: string, quantite: number): OpMarche {
  const t = getTitre(id);
  if (!t || quantite <= 0) return { ok: false, text: 'Ordre invalide.', tone: 'neutral' };
  const prix = coursDe(state, id) * quantite;
  const total = prix + frais(prix);
  if (!payer(state, total)) {
    return { ok: false, text: `Il te manque ${euros(total - state.argent)}.`, tone: 'neutral' };
  }
  state.portefeuille[id] = (state.portefeuille[id] ?? 0) + quantite;
  return {
    ok: true,
    text: `${quantite} ${t.symbole} à ${euros(coursDe(state, id))} — ${euros(total)} frais compris.`,
    tone: 'neutral',
  };
}

export function vendre(state: GameState, id: string, quantite: number): OpMarche {
  const t = getTitre(id);
  const detenu = state.portefeuille[id] ?? 0;
  if (!t || quantite <= 0) return { ok: false, text: 'Ordre invalide.', tone: 'neutral' };
  if (detenu < quantite) return { ok: false, text: `Tu n’en as que ${detenu}.`, tone: 'neutral' };
  const prix = coursDe(state, id) * quantite;
  const net = prix - frais(prix);
  state.portefeuille[id] = detenu - quantite;
  if (state.portefeuille[id] === 0) delete state.portefeuille[id];
  crediter(state, net);
  return { ok: true, text: `${quantite} ${t.symbole} vendus. ${euros(net)} encaissés.`, tone: 'neutral' };
}

// ── Casino ───────────────────────────────────────────────────
/**
 * Un tour. `auBureau` n'est pas une nuance d'ambiance : jouer depuis son
 * poste fait monter la suspicion, gagné ou perdu. C'est ce qui donne au
 * casino une place dans le jeu plutôt qu'à côté.
 */
export function jouer(
  state: GameState,
  jeuId: string,
  multiple: number,
  auBureau: boolean,
  rng: Rng,
): OpMarche & { suspicion: number } {
  const jeu = getJeu(jeuId);
  if (!jeu || multiple <= 0) {
    return { ok: false, text: 'Table inconnue.', tone: 'neutral', suspicion: 0 };
  }
  const mise = jeu.mise * multiple;
  if (!payer(state, mise)) {
    return { ok: false, text: `Il te manque ${euros(mise - state.argent)}.`, tone: 'neutral', suspicion: 0 };
  }
  const suspicion = auBureau ? jeu.suspicionAuBureau : 0;

  if (rng.chance(jeu.chance)) {
    const gain = Math.round(mise * jeu.gain);
    crediter(state, gain);
    return {
      ok: true,
      text: `${jeu.nom} : ça tombe. ${euros(gain - mise)} de plus qu’il y a trente secondes.`,
      tone: 'good',
      suspicion,
    };
  }
  return {
    ok: true,
    text: `${jeu.nom} : perdu. ${euros(mise)} qui ne reviendront pas.`,
    tone: 'bad',
    suspicion,
  };
}

/** Espérance d'une table, en % de la mise. Affichée sans fard au joueur. */
export const esperance = (jeuId: string): number => {
  const j = getJeu(jeuId);
  return j ? Math.round((j.chance * j.gain - 100) * 10) / 10 : 0;
};
