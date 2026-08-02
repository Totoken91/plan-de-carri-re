// ─────────────────────────────────────────────────────────────
// lancer.ts — Le banc d'essai d'équilibrage.
//
// Il fait tourner le VRAI moteur, sans interface : le même store, les
// mêmes données, le même générateur seedé. C'est la condition pour que
// ce qu'il mesure vaille quelque chose — un simulateur qui réimplémente
// les règles ne mesure que lui-même.
//
//   npm run simuler            → 400 parties par politique
//   npm run simuler -- 1200    → 1 200 parties par politique
//   npm run simuler -- 400 csv → ajoute une sortie CSV par partie
//
// Ce qu'on cherche à lire dans la sortie :
//   · aucune politique ne doit gagner presque toujours ni presque jamais ;
//   · les trois défaites doivent toutes exister, sans qu'une seule
//     ramasse 90 % des fins ;
//   · une politique réfléchie doit battre nettement « Au hasard », sinon
//     les décisions du jeu ne décident de rien ;
//   · la durée médiane d'une partie doit tenir dans une soirée.
// ─────────────────────────────────────────────────────────────

// Le store persiste dans localStorage. En Node il n'y en a pas, et le
// banc n'a rien à sauvegarder : un objet muet suffit et évite de tordre
// le code de production pour l'occasion.
const memoire = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => void memoire.set(k, v),
  removeItem: (k: string) => void memoire.delete(k),
  clear: () => memoire.clear(),
  key: () => null,
  length: 0,
};

import { createInitialState, GameStore } from '@state/store';
import type { GameState } from '@state/schema';
import { valeurPortefeuille } from '@engine/marche';
import { palierDe } from '@engine/paliers';

import {
  choisirEvenement,
  gererArgent,
  gererEquipe,
  flamber,
  gererRomance,
  jouerWeekend,
  ordreDuRang,
  politiques,
  type Politique,
} from './politiques';

/** Au-delà, on considère que la partie ne se termine pas. */
const SEMAINES_MAX = 60;

type Fin = 'won' | 'fired' | 'burnout' | 'expulse' | 'interminable';

interface Partie {
  politique: string;
  seed: number;
  fin: Fin;
  semaines: number;
  rang: number;
  reputation: number;
  suspicionMax: number;
  suspicionMoyenne: number;
  nerfsMin: number;
  argentFin: number;
  argentMin: number;
  impayes: number;
  plansLances: number;
  plansReussis: number;
  secretsTrouves: number;
  audits: number;
  boucsBrules: number;
  departs: number;
  /** Semaine de chaque promotion : le rythme de la montée. */
  promos: number[];
  /** Nom du palier atteint pour chaque stat, en fin de partie. */
  paliers: Record<string, string>;
}

const STATS_SUIVIES = ['aura', 'rendement', 'combine', 'nerfs'] as const;

/** Un générateur seedé indépendant du jeu, pour ce que l'IA doit tirer. */
function alea(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jouerUnePartie(politique: Politique, seed: number, aleatoire: () => number): Partie {
  const store = new GameStore(createInitialState(seed, 'Sujet'));
  const p: Partie = {
    politique: politique.id,
    seed,
    fin: 'interminable',
    semaines: 0,
    rang: 0,
    reputation: 0,
    suspicionMax: 0,
    suspicionMoyenne: 0,
    nerfsMin: 100,
    argentFin: 0,
    argentMin: Infinity,
    impayes: 0,
    plansLances: 0,
    plansReussis: 0,
    secretsTrouves: 0,
    audits: 0,
    boucsBrules: 0,
    departs: 0,
    promos: [],
    paliers: {},
  };

  let sommeSuspicion = 0;
  let rangPrecedent = 0;
  let plansEnCoursPrecedent = 0;

  for (let semaine = 0; semaine < SEMAINES_MAX; semaine++) {
    let s = store.getState();
    if (s.status !== 'playing') break;

    // Lundi : le management et l'argent d'abord, ils ne coûtent pas de
    // temps et changent ce que les points d'action rapportent.
    gererEquipe(store);
    gererRomance(store);
    if (politique.id === 'flambeur') flamber(store);
    else gererArgent(store);

    // Du lundi au vendredi : dépenser les points d'action.
    let garde = 0;
    while (garde++ < 12) {
      s = store.getState();
      if (s.status !== 'playing' || s.actionPointsRemaining <= 0) break;
      const avant = s.actionPointsRemaining;
      const coup = politique.coup(store, s);
      if (!coup) break;
      coup(store);
      // Un coup qui ne consomme rien signale une impasse : on arrête
      // plutôt que de boucler sur un refus.
      if (store.getState().actionPointsRemaining >= avant) break;
    }

    s = store.getState();
    sommeSuspicion += s.suspicion;
    p.suspicionMax = Math.max(p.suspicionMax, s.suspicion);
    p.nerfsMin = Math.min(p.nerfsMin, s.player.stats.nerfs);
    p.argentMin = Math.min(p.argentMin, s.argent);
    const plansMaintenant = s.activePlans.length;
    if (plansMaintenant > plansEnCoursPrecedent) {
      p.plansLances += plansMaintenant - plansEnCoursPrecedent;
    }
    plansEnCoursPrecedent = plansMaintenant;

    // Vendredi soir.
    const issue = store.endWeek();
    if (issue.pendingEvent) {
      store.chooseEventOption(choisirEvenement(store, aleatoire));
    }

    s = store.getState();
    // Après la résolution : c'est là que les intentions des collègues et
    // les plans versent leur Suspicion. Mesurer avant, c'était ignorer
    // la moitié de la pression de la semaine.
    p.suspicionMax = Math.max(p.suspicionMax, s.suspicion);
    plansEnCoursPrecedent = s.activePlans.length;
    p.semaines = s.week;
    if (s.status !== 'playing') {
      p.fin = s.status as Fin;
      break;
    }

    const rang = ordreDuRang(s);
    if (rang > rangPrecedent) {
      for (let i = rangPrecedent; i < rang; i++) p.promos.push(s.week);
      rangPrecedent = rang;
    }

    // Le week-end, puis lundi matin.
    if (s.phase === 'weekend') {
      if (politique.id === 'flambeur') flamber(store);
      else gererArgent(store);
      jouerWeekend(store);
      store.startWeek();
    }
  }

  const s = store.getState();
  p.semaines = s.week;
  p.rang = ordreDuRang(s);
  p.reputation = s.player.reputation;
  p.suspicionMoyenne = sommeSuspicion / Math.max(1, s.week);
  p.argentFin = s.argent + valeurPortefeuille(s);
  if (p.argentMin === Infinity) p.argentMin = s.argent;
  p.impayes = s.loyersImpayes;
  p.secretsTrouves = s.colleagues.reduce(
    (n, c) => n + c.secrets.filter((x) => x.discovered).length,
    0,
  );
  p.departs = s.colleagues.filter((c) => !c.alive).length;
  for (const stat of STATS_SUIVIES) {
    p.paliers[stat] = palierDe(s.player.stats[stat], stat).nom;
  }
  for (const l of s.log) {
    if (l.text.startsWith('Audit de conformité')) p.audits += 1;
    if (l.text.includes('Accompagnement de sortie')) p.boucsBrules += 1;
    if (l.text.includes('a abouti')) p.plansReussis += 1;
  }
  if (s.status === 'playing') p.fin = 'interminable';
  return p;
}

// ── Agrégation ───────────────────────────────────────────────

const mediane = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const t = xs.slice().sort((a, b) => a - b);
  const i = Math.floor(t.length / 2);
  return t.length % 2 ? t[i]! : (t[i - 1]! + t[i]!) / 2;
};
const moyenne = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const pourcent = (n: number, total: number): number => (total ? (n * 100) / total : 0);

const pad = (s: string, n: number) => s.padEnd(n);

function tableau(parties: Partie[]): void {
  const parPolitique = new Map<string, Partie[]>();
  for (const p of parties) {
    const l = parPolitique.get(p.politique) ?? [];
    l.push(p);
    parPolitique.set(p.politique, l);
  }

  console.log('');
  console.log('══ ISSUES ' + '═'.repeat(68));
  console.log(
    pad('politique', 14) +
      ['gagne', 'viré', 'burn', 'expul', 'inter'].map((h) => pad(h, 8)).join('') +
      pad('sem. méd.', 11) +
      pad('rang méd.', 10),
  );
  for (const [id, lot] of parPolitique) {
    const n = lot.length;
    const c = (f: Fin) => lot.filter((p) => p.fin === f).length;
    console.log(
      pad(id, 14) +
        pad(`${pourcent(c('won'), n).toFixed(1)}%`, 8) +
        pad(`${pourcent(c('fired'), n).toFixed(1)}%`, 8) +
        pad(`${pourcent(c('burnout'), n).toFixed(1)}%`, 8) +
        pad(`${pourcent(c('expulse'), n).toFixed(1)}%`, 8) +
        pad(`${pourcent(c('interminable'), n).toFixed(1)}%`, 8) +
        pad(mediane(lot.map((p) => p.semaines)).toFixed(0), 11) +
        pad(mediane(lot.map((p) => p.rang)).toFixed(1), 10),
    );
  }

  console.log('');
  console.log('══ PRESSIONS ' + '═'.repeat(65));
  console.log(
    pad('politique', 14) +
      pad('susp.moy', 10) +
      pad('susp.max', 10) +
      pad('nerfs min', 11) +
      pad('audits/p', 10) +
      pad('€ fin méd.', 12) +
      pad('€ min méd.', 12),
  );
  for (const [id, lot] of parPolitique) {
    console.log(
      pad(id, 14) +
        pad(moyenne(lot.map((p) => p.suspicionMoyenne)).toFixed(1), 10) +
        pad(moyenne(lot.map((p) => p.suspicionMax)).toFixed(1), 10) +
        pad(moyenne(lot.map((p) => p.nerfsMin)).toFixed(1), 11) +
        pad(moyenne(lot.map((p) => p.audits)).toFixed(2), 10) +
        pad(mediane(lot.map((p) => p.argentFin)).toFixed(0), 12) +
        pad(mediane(lot.map((p) => p.argentMin)).toFixed(0), 12),
    );
  }

  console.log('');
  console.log('══ CONTENU JOUÉ ' + '═'.repeat(62));
  console.log(
    pad('politique', 14) +
      pad('plans/p', 10) +
      pad('réussis', 10) +
      pad('secrets/p', 12) +
      pad('départs/p', 12) +
      pad('boucs/p', 10),
  );
  for (const [id, lot] of parPolitique) {
    console.log(
      pad(id, 14) +
        pad(moyenne(lot.map((p) => p.plansLances)).toFixed(2), 10) +
        pad(moyenne(lot.map((p) => p.plansReussis)).toFixed(2), 10) +
        pad(moyenne(lot.map((p) => p.secretsTrouves)).toFixed(2), 12) +
        pad(moyenne(lot.map((p) => p.departs)).toFixed(2), 12) +
        pad(moyenne(lot.map((p) => p.boucsBrules)).toFixed(2), 10),
    );
  }

  console.log('');
  console.log('══ RYTHME DES PROMOTIONS (semaine médiane d’accès) ' + '═'.repeat(28));
  const rangs = ['Alternant', 'Junior', 'Confirmé', 'Senior', 'Team Lead'];
  console.log(pad('politique', 14) + rangs.map((r) => pad(r, 11)).join(''));
  for (const [id, lot] of parPolitique) {
    const cols = rangs.map((_, i) => {
      const atteints = lot.map((p) => p.promos[i]).filter((x): x is number => x !== undefined);
      const taux = pourcent(atteints.length, lot.length);
      return pad(atteints.length ? `${mediane(atteints).toFixed(0)} (${taux.toFixed(0)}%)` : '—', 11);
    });
    console.log(pad(id, 14) + cols.join(''));
  }
  console.log('');
}

/**
 * Les paliers atteints en fin de partie.
 *
 * Un palier que personne n'atteint jamais est du contenu mort ; un palier
 * que tout le monde atteint en trois semaines n'est pas un objectif. Ce
 * tableau dit lequel des deux on a écrit.
 */
function censusPaliers(parties: Partie[]): void {
  console.log('══ PALIERS DE STATS EN FIN DE PARTIE ' + '═'.repeat(41));
  for (const stat of STATS_SUIVIES) {
    const compte = new Map<string, number>();
    for (const p of parties) {
      const nom = p.paliers[stat] ?? '—';
      compte.set(nom, (compte.get(nom) ?? 0) + 1);
    }
    const cols = [...compte.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nom, n]) => `${nom} ${pourcent(n, parties.length).toFixed(0)}%`);
    console.log(pad(stat, 12) + cols.join(' · '));
  }
  console.log('');
}

function main(): void {
  const args = process.argv.slice(2);
  const parPolitique = Number(args[0]) || 400;
  const csv = args.includes('csv');

  const aleatoire = alea(0xc0ffee);
  const liste = politiques(aleatoire);
  const toutes: Partie[] = [];

  const t0 = Date.now();
  for (const politique of liste) {
    for (let i = 0; i < parPolitique; i++) {
      // MÊMES graines pour toutes les politiques : les open spaces, les
      // opportunités et les événements sont identiques d'une colonne à
      // l'autre. Sans ça, un écart de 3 points pourrait n'être qu'un
      // tirage plus clément.
      toutes.push(jouerUnePartie(politique, 1000 + i, aleatoire));
    }
  }
  const dt = (Date.now() - t0) / 1000;

  console.log(
    `${toutes.length} parties · ${liste.length} politiques × ${parPolitique} graines · ${dt.toFixed(1)} s`,
  );
  tableau(toutes);
  censusPaliers(toutes);

  if (csv) {
    const cles = Object.keys(toutes[0]!) as (keyof Partie)[];
    console.log(cles.join(','));
    for (const p of toutes) {
      console.log(
        cles
          .map((k) => {
            const v = p[k];
            return Array.isArray(v) ? v.length : typeof v === 'object' ? '' : v;
          })
          .join(','),
      );
    }
  }
}

main();
