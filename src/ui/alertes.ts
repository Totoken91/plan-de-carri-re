// ─────────────────────────────────────────────────────────────
// alertes.ts — Ce qui réclame ton attention, et le conseil du jour.
//
// C'est le pendant lisible du « tout est à l'écran » : si rien ne défile,
// il faut que ce qui compte vienne à toi plutôt que d'attendre d'être
// trouvé. Les alertes sont donc DÉRIVÉES de l'état, jamais stockées —
// deux sources pour la même vérité, et elles divergent.
//
// Trois règles tenues ici :
//
//  · une alerte porte toujours un GESTE. Elle dit ce qui va mal ET
//    ouvre l'endroit où l'on peut y répondre. Un voyant qui ne mène
//    nulle part est un reproche, pas une information ;
//
//  · l'ordre est celui de l'urgence réelle, pas celui du code. Ce qui
//    peut terminer la partie cette semaine passe avant ce qui coûtera
//    quelques points ;
//
//  · le CONSEIL est unique. Une liste de dix recommandations, c'est
//    l'inverse d'un conseil — on en donne un seul, celui qui répond à
//    la question « et maintenant je fais quoi ».
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { balance } from '@data/balance';
import { getRank, nextRank } from '@data/content';
import { suspicionTier } from '@engine/suspicion';
import { scapegoatOf } from '@engine/scapegoat';
import { placesDeSubordonnes, subordonnesDe } from '@engine/subordonnes';
import { romanceDe } from '@engine/romance';
import { plusValue, valeurPortefeuille } from '@engine/marche';
import { euros, loyerDe } from '@engine/argent';
import type { Selection } from './iso';

/** Les panneaux ouvrables depuis la barre du bas. */
export type PanneauId = 'stats' | 'agenda' | 'opportunites' | 'journal' | 'perimetre';

export interface Alerte {
  id: string;
  icone: string;
  ton: 'danger' | 'attention' | 'bon' | 'info';
  titre: string;
  detail: string;
  /** Nombre affiché en pastille, s'il y a lieu. */
  compte?: number;
  /** Où le clic emmène. */
  panneau?: PanneauId;
  selection?: Selection;
}

export function alertesDe(state: GameState): Alerte[] {
  const a: Alerte[] = [];
  if (state.status !== 'playing') return a;

  // ── Ce qui peut finir la partie ────────────────────────────
  if (state.loyersImpayes > 0) {
    a.push({
      id: 'loyer',
      icone: '🏚',
      ton: 'danger',
      titre: `Loyer impayé (${state.loyersImpayes}/${balance.expulsionApres})`,
      detail: `Encore un et tu es expulsé. Il faut trouver ${euros(loyerDe(state))} avant vendredi — vendre des titres, revendre un meuble, ou reprendre plus petit.`,
      compte: state.loyersImpayes,
    });
  }

  const tier = suspicionTier(state.suspicion);
  if (tier === 'critique' || tier === 'surveillance') {
    const couvert = scapegoatOf(state);
    a.push({
      id: 'suspicion',
      icone: '🔍',
      ton: tier === 'critique' ? 'danger' : 'attention',
      titre: tier === 'critique' ? 'Audit imminent' : 'On te surveille',
      detail: couvert
        ? `Suspicion ${state.suspicion}. Tu as un dossier monté sur ${couvert.name} : l'audit tomberait sur lui.`
        : `Suspicion ${state.suspicion}, et aucune couverture. Un audit remonterait jusqu'à toi.`,
    });
  }

  if (state.player.stats.nerfs <= 20) {
    a.push({
      id: 'nerfs',
      icone: '🫠',
      ton: state.player.stats.nerfs <= 8 ? 'danger' : 'attention',
      titre: `Nerfs à ${state.player.stats.nerfs}`,
      detail: `À zéro pendant ${balance.burnoutGraceWeeks} semaines, c'est le placard. Le coin détente les fait remonter.`,
      selection: { kind: 'zone', id: 'detente' },
    });
  }

  // ── Ce qui tombe vendredi ──────────────────────────────────
  const menaces = state.colleagues.filter(
    (c) => c.alive && c.intent?.tone === 'threat' && (c.intent?.weeksLeft ?? 2) <= 1,
  );
  if (menaces.length > 0) {
    a.push({
      id: 'menaces',
      icone: '⚠',
      ton: 'danger',
      titre: `${menaces.length} manœuvre(s) se résolvent vendredi`,
      detail: menaces.map((c) => `${c.name} — ${c.intent!.label}`).join(' · '),
      compte: menaces.length,
      panneau: 'agenda',
      selection: { kind: 'colleague', id: menaces[0]!.id },
    });
  }

  // ── Ce qu'on va perdre en laissant filer ───────────────────
  if (state.opportunities.length > 0) {
    a.push({
      id: 'opportunites',
      icone: '◆',
      ton: 'attention',
      titre: `${state.opportunities.length} opportunité(s)`,
      detail: 'Elles disparaissent vendredi soir, saisies ou non.',
      compte: state.opportunities.length,
      panneau: 'opportunites',
    });
  }

  if (state.actionPointsRemaining > 0) {
    a.push({
      id: 'pa',
      icone: '●',
      ton: 'info',
      titre: `${state.actionPointsRemaining} point(s) d'action`,
      detail: 'Les points d’action ne se reportent pas d’une semaine sur l’autre.',
      compte: state.actionPointsRemaining,
    });
  }

  // ── Ce qui dort ────────────────────────────────────────────
  const places = placesDeSubordonnes(state);
  const libres = places - subordonnesDe(state).length;
  if (libres > 0) {
    a.push({
      id: 'perimetre',
      icone: '👥',
      ton: 'info',
      titre: `${libres} place(s) dans ton équipe`,
      detail: 'Un subordonné produit pour toi, rapporte, ou endosse. Il faut le rattacher.',
      compte: libres,
      panneau: 'perimetre',
    });
  }

  const sansOrdre = subordonnesDe(state).filter((c) => !c.ordre);
  if (sansOrdre.length > 0) {
    a.push({
      id: 'ordres',
      icone: '📋',
      ton: 'info',
      titre: `${sansOrdre.length} subordonné(s) sans consigne`,
      detail: sansOrdre.map((c) => c.name).join(' · '),
      compte: sansOrdre.length,
      panneau: 'perimetre',
    });
  }

  // Une liaison qui va retomber sous son palier : c'est la seule chose
  // du jeu qui se perd en NE FAISANT RIEN, donc elle mérite un voyant.
  const qui = state.colleagues.filter((c) => {
    const r = romanceDe(c);
    if (!c.alive || r.statut === 'rien' || r.statut === 'ex' || r.statut === 'couple') return false;
    const seuil = r.statut === 'liaison' ? balance.romance.seuilLiaison : balance.romance.seuilFlirt;
    return r.niveau + balance.romance.derivePasEntretenue < seuil;
  });
  if (qui.length > 0) {
    a.push({
      id: 'romance',
      icone: '💬',
      ton: 'attention',
      titre: `${qui.length} histoire(s) sur le point de retomber`,
      detail: qui.map((c) => `${c.name} (${romanceDe(c).niveau})`).join(' · '),
      compte: qui.length,
      selection: { kind: 'colleague', id: qui[0]!.id },
    });
  }

  // ── Ce qui va bien ─────────────────────────────────────────
  const suivant = nextRank(state.player.rank);
  if (suivant && state.player.reputation >= suivant.reputationRequired) {
    a.push({
      id: 'promo',
      icone: '↑',
      ton: 'bon',
      titre: `Promotion acquise : ${suivant.name}`,
      detail: 'Elle tombe à la clôture de vendredi.',
    });
  }

  const latente = Object.keys(state.portefeuille).reduce((s, id) => s + plusValue(state, id), 0);
  if (valeurPortefeuille(state) > 0 && Math.abs(latente) >= 300) {
    a.push({
      id: 'bourse',
      icone: latente >= 0 ? '▲' : '▼',
      ton: latente >= 0 ? 'bon' : 'attention',
      titre: `${latente >= 0 ? '+' : '−'}${euros(Math.abs(latente))} sur ton portefeuille`,
      detail: 'Une plus-value ne devient de l’argent qu’une fois vendue.',
    });
  }

  return a;
}

/**
 * Le conseil du moment. Un seul, celui qui répond à « et maintenant ? ».
 *
 * L'ordre des tests EST la hiérarchie du conseil : on parle d'abord de ce
 * qui peut terminer la partie, puis de ce qui la fait avancer, puis de ce
 * qui la rend confortable.
 */
export function conseilDe(state: GameState): string | undefined {
  if (state.status !== 'playing') return undefined;
  const p = state.player;

  if (state.loyersImpayes > 0) {
    return `Un loyer de plus et c’est l’expulsion. Vends des titres, revends un meuble, ou reprends un logement plus petit — avant vendredi.`;
  }
  if (p.stats.nerfs <= 12) {
    return `Tes Nerfs sont à ${p.stats.nerfs}. Va glander au coin détente : à zéro trop longtemps, c’est le placard, et ça ne prévient pas.`;
  }
  if (suspicionTier(state.suspicion) === 'critique' && !scapegoatOf(state)) {
    return `Suspicion ${state.suspicion} et aucune couverture. Monte un dossier sur quelqu’un avant vendredi, ou arrête tout ce qui est risqué cette semaine.`;
  }
  const menace = state.colleagues.find(
    (c) => c.alive && c.intent?.tone === 'threat' && (c.intent?.weeksLeft ?? 2) <= 1,
  );
  if (menace) {
    return `${menace.name} boucle son coup vendredi. Désamorcer coûte un point d’action ; encaisser coûte plus cher.`;
  }
  if (state.opportunities.length > 0 && state.actionPointsRemaining > 0) {
    return `Il reste ${state.opportunities.length} opportunité(s) sur le plateau. Elles disparaissent vendredi, saisies ou non.`;
  }

  const suivant = nextRank(state.player.rank);
  if (suivant) {
    const manque = suivant.reputationRequired - p.reputation;
    if (manque > 0 && manque <= 20) {
      return `Encore ${manque} de réputation et tu passes ${suivant.name}. Bosser à ton poste est le chemin le plus court.`;
    }
  }

  const places = placesDeSubordonnes(state) - subordonnesDe(state).length;
  if (places > 0) {
    return `Tu peux rattacher ${places} personne(s) à ton équipe. Un subordonné qui produit pour toi rapporte plus qu’une semaine de travail.`;
  }
  const sansOrdre = subordonnesDe(state).find((c) => !c.ordre);
  if (sansOrdre) {
    return `${sansOrdre.name} attend une consigne. Un subordonné sans ordre, c’est une semaine perdue pour toi.`;
  }
  if (p.stats.combine < 25) {
    return `Ta Combine est basse (${p.stats.combine}) : les plans échouent et fouiner se voit. Elle monte en fouinant et en complotant.`;
  }
  if (state.argent > 5000 && valeurPortefeuille(state) === 0) {
    return `${euros(state.argent)} dorment sur ton compte. La bourse monte lentement mais sûrement — ou un logement plus grand te rendrait du temps.`;
  }
  const rang = getRank(state.player.rank);
  return `Rien d’urgent. C’est le bon moment pour prendre un risque : ${rang?.name ?? 'ton rang'} ne mène nulle part tout seul.`;
}
