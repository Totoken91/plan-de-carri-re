// ─────────────────────────────────────────────────────────────
// politiques.ts — Les joueurs artificiels du banc d'essai.
//
// Chacun est une CARICATURE d'un style de jeu, et c'est le point : un
// jeu est équilibré quand aucune caricature ne gagne beaucoup plus
// souvent que les autres, et quand aucune ne perd toujours de la même
// façon. Une IA « optimale » unique ne dirait rien de tout ça — elle
// dirait seulement à quel score on peut monter.
//
// Ils partagent une même boucle : tant qu'il reste des points d'action,
// demander le meilleur coup, le jouer, recommencer. Ce qui les distingue
// tient dans `coup()` — l'ordre des priorités — et dans quelques réglages
// de seuils.
// ─────────────────────────────────────────────────────────────
import type { GameStore } from '@state/store';
import type { Colleague, GameState } from '@state/schema';
import { getArchetype, getPlanDef, getRank, nextRank } from '@data/content';
import { catalog } from '@data/content';
import { activites, getAppart, meubles } from '@data/vieprivee';
import { balance } from '@data/balance';
import { aliveColleagues, findRival, getColleague } from '@engine/util';
import { canDefuse } from '@engine/intents';
import { canPrepareScapegoat, prepareChance, scapegoatOf } from '@engine/scapegoat';
import { availableHooks } from '@engine/hooks';
import { seuilAudit } from '@engine/suspicion';
import { canStartPlan, successChance } from '@engine/plans';
import { blocageActivite } from '@engine/vieprivee';
import { romanceDe } from '@engine/romance';
import { peutEtreRattache, placesDeSubordonnes, subordonnesDe } from '@engine/subordonnes';
import { blocagePromotion } from '@engine/promotion';
import { VOITURES, voitureDe } from '@engine/voitures';
import { salaireDe } from '@engine/argent';
import { esperanceChoix, utilite } from './utilite';

/** Un coup au bureau : une fermeture qui consomme au moins 1 PA. */
export type Coup = (store: GameStore) => void;

export interface Politique {
  id: string;
  nom: string;
  /** Le prochain coup à jouer, ou undefined pour passer la main. */
  coup(store: GameStore, state: GameState): Coup | undefined;
}

// ── Briques communes ─────────────────────────────────────────

const vivants = (s: GameState) => aliveColleagues(s);
const rivalDe = (s: GameState): Colleague | undefined => getColleague(s, findRival(s));

/** Le collègue dont l'opinion est la plus basse — le prochain problème. */
function plusHostile(s: GameState, sauf?: string): Colleague | undefined {
  return vivants(s)
    .filter((c) => c.id !== sauf)
    .slice()
    .sort((a, b) => a.opinion - b.opinion)[0];
}

/** Une menace en cours qu'on peut encore désamorcer. */
const menace = (s: GameState): Colleague | undefined => vivants(s).find((c) => canDefuse(c));

/**
 * La meilleure opportunité de la semaine, si elle vaut son prix.
 *
 * Le seuil par PA est ce qui empêche les IA de tout ramasser : une
 * opportunité à 1 PA qui rapporte moins qu'une action de travail est un
 * mauvais coup, même si elle est gratuite en apparence.
 */
function meilleureOpportunite(
  s: GameState,
  seuilParPA: number,
): { index: number; score: number } | undefined {
  let best: { index: number; score: number } | undefined;
  s.opportunities.forEach((active, index) => {
    const def = catalog.opportunities.find((o) => o.id === active.defId);
    if (!def) return;
    const cost = def.cost ?? 1;
    if (cost > s.actionPointsRemaining) return;
    const score =
      esperanceChoix(s, def.effects, def.successChance, def.failureEffects) / cost;
    if (score >= seuilParPA && (!best || score > best.score)) best = { index, score };
  });
  return best;
}

/** Le plan le plus rentable qu'on puisse lancer sur cette cible. */
function meilleurPlan(s: GameState, cible: Colleague | undefined): string | undefined {
  if (!cible) return undefined;
  let best: { id: string; score: number } | undefined;
  for (const def of catalog.plans) {
    if (!canStartPlan(s, def, cible.id)) continue;
    // Estimation à la volée : la chance qu'aurait le plan s'il partait
    // maintenant, sans préparation.
    const chance = successChance(s, {
      defId: def.id,
      targetId: cible.id,
      weeksRemaining: def.durationWeeks,
      preparation: 0,
    });
    const score =
      (chance / 100) * utilite(s, def.successEffects) +
      (1 - chance / 100) * utilite(s, def.failureEffects) -
      (chance / 100) * def.suspicionOnSuccess -
      (1 - chance / 100) * def.suspicionOnFailure;
    if (chance >= 35 && (!best || score > best.score)) best = { id: def.id, score };
  }
  return best?.id;
}

/** Le plan en cours qui gagne le plus à être encore préparé. */
function planAPreparer(s: GameState): { planId: string; targetId?: string } | undefined {
  const p = s.activePlans.find((x) => successChance(s, x) < 80);
  if (!p) return undefined;
  return { planId: p.defId, targetId: p.targetId };
}

/** Une cible de fouille : quelqu'un dont il reste un secret à trouver. */
function aFouiller(s: GameState, prefere?: Colleague): Colleague | undefined {
  const reste = (c: Colleague) => c.secrets.some((x) => !x.discovered);
  if (prefere && reste(prefere)) return prefere;
  return vivants(s).find(reste);
}

/** Un levier prêt à servir, avec le mode qui convient à la situation. */
function levier(s: GameState): { id: string; secretId: string; coerce: boolean } | undefined {
  for (const c of vivants(s)) {
    const hooks = availableHooks(s, c.id);
    const h = hooks[0];
    if (!h) continue;
    // Sur un adversaire déclaré, on expose ; sur les autres, on recrute.
    const coerce = c.opinion > -30;
    return { id: c.id, secretId: h.id, coerce };
  }
  return undefined;
}

// ── Gestion, romance, argent : communes à toutes les politiques ──
// Ce ne sont pas des « coups » : elles ne coûtent pas de point d'action.
// Toutes les IA les jouent, sinon on comparerait des stratégies qui
// n'ont pas accès aux mêmes systèmes.

/** Rattacher qui peut l'être, puis donner un ordre à chacun. Gratuit. */
export function gererEquipe(store: GameStore): void {
  let s = store.getState();
  if (placesDeSubordonnes(s) === 0) return;

  for (const c of vivants(s)) {
    s = store.getState();
    if (subordonnesDe(s).length >= placesDeSubordonnes(s)) break;
    if (peutEtreRattache(s, c) && c.opinion >= balance.subordonnes.opinionMinimum) {
      store.performRattacher(c.id);
    }
  }

  s = store.getState();
  const rival = rivalDe(s);
  for (const sub of subordonnesDe(s)) {
    if (sub.ordre) continue;
    const st = store.getState();
    // Une suspicion haute change ce qu'on demande à son équipe : on
    // arrête de produire pour faire endosser.
    if (st.suspicion >= 50) store.performOrdre(sub.id, 'couvrir');
    else if (rival && st.player.stats.combine >= 40) {
      store.performOrdre(sub.id, 'rapporter', rival.id);
    } else store.performOrdre(sub.id, 'produire');
  }
}

/** Officialiser quand c'est mûr : gratuit, et ça stabilise une opinion. */
export function gererRomance(store: GameStore): void {
  const s = store.getState();
  for (const c of vivants(s)) {
    const r = romanceDe(c);
    if (r.statut === 'liaison' && r.niveau >= balance.romance.seuilCouple) {
      store.performOfficialiser(c.id);
      return;
    }
  }
}

/**
 * L'argent. Toutes les IA suivent la même règle simple, parce qu'on
 * cherche à savoir si l'économie tient, pas quel trader on est : garder
 * de quoi payer quatre loyers, meubler ensuite, et ne monter en gamme de
 * voiture que si l'entretien reste sous le tiers du salaire.
 */
export function gererArgent(store: GameStore): void {
  const s = store.getState();
  const logement = getAppart(s.appart.niveau);
  const reserve = (logement?.loyer ?? 0) * 4 + 500;
  const salaire = salaireDe(s);

  // 1) Une voiture, tant que l'entretien reste soutenable.
  const actuelle = voitureDe(s);
  const reprise = actuelle ? Math.round(actuelle.prix / 2) : 0;
  const candidates = VOITURES.filter(
    (v) =>
      v.aura > (actuelle?.aura ?? -1) &&
      v.entretien <= salaire * 0.33 &&
      Math.max(0, v.prix - reprise) <= s.argent - reserve,
  );
  const cible = candidates[candidates.length - 1];
  if (cible) {
    store.performAcheterVoiture(cible.id);
    return;
  }

  // 2) Meubler : c'est le seul achat qui rend des stats chaque semaine.
  const st = store.getState();
  const place = (getAppart(st.appart.niveau)?.places ?? 0) - st.appart.meubles.length;
  if (place > 0) {
    const m = meubles
      .filter((x) => !st.appart.meubles.includes(x.id) && x.prix <= st.argent - reserve)
      .sort((a, b) => b.prix - a.prix)[0];
    if (m) {
      store.performAcheterMeuble(m.id);
      return;
    }
  }

  // 3) Déménager : plus de temps libre, plus de place, plus de loyer.
  const s3 = store.getState();
  const suivant = catalog.apparts[catalog.apparts.findIndex((a) => a.id === s3.appart.niveau) + 1];
  if (suivant && s3.argent >= suivant.prix + suivant.loyer * 6) {
    store.performDemenager();
  }
}

/**
 * Le coup de fin de partie : écarter celui qui occupe la place.
 *
 * Sans lui, les IA butaient contre le siège occupé et restaient
 * soixante semaines Senior — 87 % de parties sans fin pour la politique
 * qui travaille. Ce n'est pas que le jeu était bloqué : c'est qu'aucune
 * IA ne pensait à faire ce que le jeu demande. Un joueur humain, lui,
 * regarde qui est assis là et cherche comment l'en sortir.
 *
 * L'ordre des recours va du moins cher au plus voyant, et chacun a déjà
 * sa place dans le jeu — c'est le test que ces outils SERVENT à quelque
 * chose une fois qu'on a une raison de s'en servir.
 */
function ecarterLeTitulaire(s: GameState): Coup | undefined {
  const b = blocagePromotion(s);
  if (!b || (!b.siegeManquant && !b.concurrent)) return undefined;
  // On ne dégage pas une place depuis le bureau de l'auditeur. Sans
  // cette garde, les IA vidaient leurs cinq points d'action par semaine
  // en complots jusqu'au licenciement — mesuré : 100 % de parties
  // perdues, au même rang, à la même semaine.
  if (s.suspicion > seuilAudit(s) - 26) return undefined;
  const nom = b.concurrent ?? b.tenants[0];
  const gene = vivants(s).find((c) => c.name === nom);
  if (!gene) return undefined;

  // 1) Le faire faire par quelqu'un d'autre : gratuit en points d'action.
  const sbires = subordonnesDe(s).filter((x) => !x.ordre && x.id !== gene.id);
  if (sbires[0]) {
    const sbire = sbires[0];
    return (st) => st.performOrdre(sbire.id, 'abattre', gene.id);
  }

  // 2) Le chéquier, si la Combine suit et que la caisse est pleine.
  const conso = catalog.depenses.find((d) => d.id === 'consultant');
  if (
    conso &&
    s.player.stats.combine >= 45 &&
    s.argent >= conso.prix + 3000 &&
    s.actionPointsRemaining >= (conso.cout ?? 1)
  ) {
    return (st) => st.performDepense('consultant', gene.id);
  }

  // 3) Un plan monté sur lui.
  const plan = meilleurPlan(s, gene);
  if (plan) return (st) => st.performAction('comploter', { planId: plan, targetId: gene.id });

  const enCours = s.activePlans.find((p) => p.targetId === gene.id);
  if (enCours && successChance(s, enCours) < 80) {
    return (st) =>
      st.performAction('comploter', { planId: enCours.defId, targetId: enCours.targetId });
  }

  // 4) Le désigner coupable : l'audit fera le reste.
  if (canPrepareScapegoat(s, gene) && prepareChance(s, gene) >= 45) {
    return (st) => st.performScapegoat(gene.id);
  }

  // 5) À défaut, apprendre sur lui — un secret ouvre les plans lourds.
  if (gene.secrets.some((x) => !x.discovered) && s.suspicion < seuilAudit(s) - 25) {
    return (st) => st.performAction('fouiner', { targetId: gene.id });
  }
  return undefined;
}

// ── Les politiques ───────────────────────────────────────────

/** Seuil d'utilité par PA sous lequel une opportunité ne vaut pas le coup. */
const SEUIL_OPP = 4;

/**
 * L'équilibré : la référence. Il fait ce qu'un joueur attentif ferait —
 * il éteint les incendies d'abord, saisit ce qui passe, et travaille le
 * reste du temps. Les autres politiques se mesurent à lui.
 */
const equilibre: Politique = {
  id: 'equilibre',
  nom: 'Équilibré',
  coup(_store, s) {
    if (s.player.stats.nerfs <= 22) return (st) => st.performAction('glander');

    if (s.suspicion >= 52 && !scapegoatOf(s)) {
      const c = vivants(s)
        .filter((x) => canPrepareScapegoat(s, x))
        .sort((a, b) => prepareChance(s, b) - prepareChance(s, a))[0];
      if (c && prepareChance(s, c) >= 50) return (st) => st.performScapegoat(c.id);
    }

    const m = menace(s);
    if (m) return (st) => st.performDefuse(m.id);

    const fin = ecarterLeTitulaire(s);
    if (fin) return fin;

    const opp = meilleureOpportunite(s, SEUIL_OPP);
    if (opp) return (st) => st.performOpportunity(opp.index);

    const prep = planAPreparer(s);
    if (prep && s.suspicion < 45) {
      return (st) => st.performAction('comploter', { planId: prep.planId, targetId: prep.targetId });
    }

    const rival = rivalDe(s);
    if (s.player.stats.combine >= 30 && s.suspicion < 40) {
      const plan = meilleurPlan(s, rival);
      if (plan) return (st) => st.performAction('comploter', { planId: plan, targetId: rival!.id });
    }

    const l = levier(s);
    if (l) return (st) => st.performHook(l.id, l.secretId, l.coerce ? 'coerce' : 'expose');

    const hostile = plusHostile(s);
    if (hostile && hostile.opinion < -20) return (st) => st.performAction('cafe', { targetId: hostile.id });

    return (st) => st.performAction('bosser');
  },
};

/** Le bourreau de travail : la réputation, rien d'autre. */
const bourreau: Politique = {
  id: 'bourreau',
  nom: 'Bourreau de travail',
  coup(_store, s) {
    if (s.player.stats.nerfs <= 25) return (st) => st.performAction('glander');
    const fin = ecarterLeTitulaire(s);
    if (fin) return fin;
    const opp = meilleureOpportunite(s, 9);
    if (opp) return (st) => st.performOpportunity(opp.index);
    return (st) => st.performAction('bosser');
  },
};

/** Le mondain : tout par l'opinion, jamais par le dossier. */
const mondain: Politique = {
  id: 'mondain',
  nom: 'Mondain',
  coup(_store, s) {
    if (s.player.stats.nerfs <= 20) return (st) => st.performAction('glander');
    const m = menace(s);
    if (m) return (st) => st.performDefuse(m.id);
    const fin = ecarterLeTitulaire(s);
    if (fin) return fin;
    const opp = meilleureOpportunite(s, SEUIL_OPP);
    if (opp) return (st) => st.performOpportunity(opp.index);
    const cible = plusHostile(s);
    if (cible && cible.opinion < 55) return (st) => st.performAction('cafe', { targetId: cible.id });
    return (st) => st.performAction('bosser');
  },
};

/** Le serpent : secrets, leviers, plans. Il ne travaille qu'en dernier recours. */
const serpent: Politique = {
  id: 'serpent',
  nom: 'Serpent',
  coup(_store, s) {
    if (s.player.stats.nerfs <= 20) return (st) => st.performAction('glander');

    // Se couvrir avant de recommencer. Un comploteur qui laisse la
    // Suspicion s'installer n'est pas une stratégie, c'est un suicide —
    // et le banc mesurait exactement ça : 100 % de licenciements.
    if (s.suspicion >= seuilAudit(s) - 22) return (st) => st.performAction('bosser');

    if (s.suspicion >= 45 && !scapegoatOf(s)) {
      const c = vivants(s)
        .filter((x) => canPrepareScapegoat(s, x))
        .sort((a, b) => prepareChance(s, b) - prepareChance(s, a))[0];
      if (c) return (st) => st.performScapegoat(c.id);
    }

    const fin = ecarterLeTitulaire(s);
    if (fin) return fin;

    const l = levier(s);
    if (l) return (st) => st.performHook(l.id, l.secretId, l.coerce ? 'coerce' : 'expose');

    const prep = planAPreparer(s);
    if (prep) {
      return (st) => st.performAction('comploter', { planId: prep.planId, targetId: prep.targetId });
    }

    const rival = rivalDe(s);
    const plan = meilleurPlan(s, rival);
    if (plan) return (st) => st.performAction('comploter', { planId: plan, targetId: rival!.id });

    const cible = aFouiller(s, rival);
    if (cible && s.suspicion < 55) return (st) => st.performAction('fouiner', { targetId: cible.id });

    const opp = meilleureOpportunite(s, SEUIL_OPP);
    if (opp) return (st) => st.performOpportunity(opp.index);

    return (st) => st.performAction('bosser');
  },
};

/** L'opportuniste : il ne fait que ce que la semaine lui propose. */
const opportuniste: Politique = {
  id: 'opportuniste',
  nom: 'Opportuniste',
  coup(_store, s) {
    if (s.player.stats.nerfs <= 22) return (st) => st.performAction('glander');
    const opp = meilleureOpportunite(s, -999);
    if (opp) return (st) => st.performOpportunity(opp.index);
    const fin = ecarterLeTitulaire(s);
    if (fin) return fin;
    const m = menace(s);
    if (m) return (st) => st.performDefuse(m.id);
    return (st) => st.performAction('bosser');
  },
};

/**
 * Le hasard : le plancher de la mesure. Si une politique réfléchie ne
 * fait pas nettement mieux que lui, ce sont les décisions du jeu qui ne
 * servent à rien — c'est le test le plus important du lot.
 */
function auHasard(seed: () => number): Politique {
  return {
    id: 'hasard',
    nom: 'Au hasard',
    coup(_store, s) {
      const options: Coup[] = [
        (st) => st.performAction('bosser'),
        (st) => st.performAction('glander'),
      ];
      const gens = vivants(s);
      for (const c of gens) {
        options.push((st) => st.performAction('cafe', { targetId: c.id }));
        options.push((st) => st.performAction('fouiner', { targetId: c.id }));
      }
      s.opportunities.forEach((_, i) => options.push((st) => st.performOpportunity(i)));
      const i = Math.floor(seed() * options.length);
      return options[Math.min(i, options.length - 1)];
    },
  };
}

/**
 * Le flambeur : il joue bien au bureau et mal avec son argent.
 *
 * Il n'est pas là pour gagner, il est là pour prouver qu'on PEUT perdre
 * autrement qu'en se faisant licencier. Sans lui, on ne saurait pas si
 * l'expulsion est une vraie fin de partie ou une ligne de code jamais
 * exécutée — les autres politiques gardent toutes une réserve, donc
 * aucune n'y touche jamais.
 */
const flambeur: Politique = {
  id: 'flambeur',
  nom: 'Flambeur',
  coup: equilibre.coup,
};

/** Ce que le flambeur fait de sa paie : la plus grosse voiture possible. */
export function flamber(store: GameStore): void {
  const s = store.getState();
  const actuelle = voitureDe(s);
  const reprise = actuelle ? Math.round(actuelle.prix / 2) : 0;
  const cible = VOITURES.filter(
    (v) => v.aura > (actuelle?.aura ?? -1) && Math.max(0, v.prix - reprise) <= s.argent,
  ).pop();
  if (cible) {
    store.performAcheterVoiture(cible.id);
    return;
  }
  // Pas de voiture à sa portée : la table de casino la plus chère.
  const jeu = catalog.casino[catalog.casino.length - 1];
  if (jeu && s.argent >= jeu.mise) store.performMiser(jeu.id, Math.min(5, Math.floor(s.argent / jeu.mise)));
}

export function politiques(seed: () => number): Politique[] {
  return [equilibre, bourreau, mondain, serpent, opportuniste, flambeur, auHasard(seed)];
}

// ── Décisions hors boucle de PA ──────────────────────────────

/** Le choix d'un événement : la meilleure espérance parmi les options ouvertes. */
export function choisirEvenement(store: GameStore, aleatoire: () => number): number {
  const s = store.getState();
  const ev = store.pendingEvent();
  if (!ev) return 0;
  let best = 0;
  let bestScore = -Infinity;
  ev.choices.forEach((choix, i) => {
    const score = esperanceChoix(s, choix.effects, choix.successChance, choix.failureEffects);
    // Un bruit léger casse les égalités sans changer le classement :
    // sans lui, tout un lot de parties suivrait la même branche.
    const bruit = aleatoire() * 0.5;
    if (score + bruit > bestScore) {
      bestScore = score + bruit;
      best = i;
    }
  });
  return best;
}

/**
 * Le week-end. Deux ou trois actions, et une règle : on se soigne
 * d'abord, on entretient une histoire ensuite, on travaille le reste.
 */
export function jouerWeekend(store: GameStore): void {
  let garde = 0;
  while (store.getState().weekendPointsRemaining > 0 && garde++ < 8) {
    const s = store.getState();
    const avant = s.weekendPointsRemaining;

    let id = 'dossiers';
    let cible: string | undefined;

    if (s.player.stats.nerfs < 45) id = 'repos';
    else {
      // Entretenir l'histoire la plus avancée : sans ça elle s'éteint.
      const amoureux = vivants(s)
        .map((c) => ({ c, r: romanceDe(c) }))
        .filter((x) => x.r.niveau > 0)
        .sort((a, b) => b.r.niveau - a.r.niveau)[0];
      if (amoureux && avant >= 2) {
        id = 'diner';
        cible = amoureux.c.id;
      } else if (amoureux) {
        id = 'recevoir';
        cible = amoureux.c.id;
      } else if (s.player.stats.nerfs < 70) id = 'sport';
    }

    const def = activites.find((a) => a.id === id);
    if (!def || blocageActivite(s, def, cible)) {
      // Repli : la première activité jouable, sinon on arrête.
      const repli = activites.find((a) => !blocageActivite(s, a, undefined) && a.cible !== 'colleague');
      if (!repli) break;
      store.performActivite(repli.id);
    } else {
      store.performActivite(id, cible);
    }

    if (store.getState().weekendPointsRemaining >= avant) break;
  }
}

/** Rang courant, en ordre hiérarchique — pour les statistiques. */
export const ordreDuRang = (s: GameState): number => getRank(s.player.rank)?.order ?? 0;

/** Réputation manquante avant le rang suivant (0 si au sommet). */
export function resteAvantPromo(s: GameState): number {
  const n = nextRank(s.player.rank);
  return n ? Math.max(0, n.reputationRequired - s.player.reputation) : 0;
}

/** Le nom d'un archétype, pour les tableaux de sortie. */
export const nomArchetype = (id: string): string => getArchetype(id)?.name ?? id;

/** Le nom d'un plan, idem. */
export const nomPlan = (id: string): string => getPlanDef(id)?.name ?? id;
