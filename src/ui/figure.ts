// ─────────────────────────────────────────────────────────────
// figure.ts — Personnages 100 % procéduraux : le calcul de pose.
//
// Aucun sprite, aucune image, aucune keyframe. Un personnage est une
// liste de primitives (disques et capsules) dont les paramètres sont
// recalculés à chaque image par des fonctions pures :
//   · sinusoïdes déphasées pour les cycles (respiration, frappe, pas) ;
//   · ressorts amortis pour le secondary motion (la tête suit le buste
//     avec du retard, le mou revient en oscillant) ;
//   · IK à 2 segments pour que les mains visent une cible réelle.
//
// Ce module ne dessine RIEN et n'importe aucun composant : il renvoie
// des coordonnées. Le rendu (fusion metaball) vit dans sprites.tsx.
//
// Choix de primitives : une capsule SDF, c'est exactement un segment
// doté d'un rayon. On la restitue par un trait à bout rond — même
// géométrie, sans shader.
// ─────────────────────────────────────────────────────────────

export interface Vec {
  x: number;
  y: number;
}

const v = (x: number, y: number): Vec => ({ x, y });
const TAU = Math.PI * 2;

// ── Ressort amorti ───────────────────────────────────────────
export interface Spring {
  x: number; // valeur courante
  v: number; // vélocité
}

export const makeSpring = (x = 0): Spring => ({ x, v: 0 });

/**
 * Intègre un ressort vers `target`. `stiff` = raideur, `damp` = frottement.
 * Le pas de temps est borné : un onglet en arrière-plan rend des dt
 * énormes, qui feraient exploser l'intégration.
 */
export function stepSpring(s: Spring, target: number, dt: number, stiff = 90, damp = 13): void {
  const h = Math.min(dt, 1 / 30);
  const a = (target - s.x) * stiff - s.v * damp;
  s.v += a * h;
  s.x += s.v * h;
}

// ── Cinématique inverse à 2 segments ─────────────────────────
/**
 * Place le coude/genou pour que l'extrémité atteigne `target`.
 * `flip` choisit laquelle des deux solutions miroir on retient.
 * Si la cible est hors de portée, on tend le membre vers elle plutôt
 * que d'échouer : une chaîne qui « casse » se voit immédiatement.
 */
export function solveIK2(
  root: Vec,
  target: Vec,
  l1: number,
  l2: number,
  flip: 1 | -1,
): { joint: Vec; end: Vec } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dist = Math.hypot(dx, dy) || 1e-4;
  const reach = Math.min(dist, l1 + l2 - 1e-3);
  const ux = dx / dist;
  const uy = dy / dist;

  // Loi des cosinus : projection du coude sur l'axe racine → cible.
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach);
  const hSq = Math.max(0, l1 * l1 - a * a);
  const h = Math.sqrt(hSq);

  const mid = v(root.x + ux * a, root.y + uy * a);
  const joint = v(mid.x + -uy * h * flip, mid.y + ux * h * flip);
  const end = v(root.x + ux * reach, root.y + uy * reach);
  return { joint, end };
}

// ── Postures : l'animation dit ce qui se trame ───────────────
// C'est le point qui rend le système utile au jeu et pas seulement
// joli : la silhouette trahit l'intention avant qu'on lise l'étiquette.
export type Posture = 'travail' | 'concentre' | 'bavard' | 'guet' | 'ouvert' | 'avachi';

/** Traduit une intention de jeu en attitude corporelle. */
export function postureFor(intentKind: string | undefined): Posture {
  switch (intentKind) {
    case 'plot':
    case 'scheme':
      return 'concentre';
    case 'gossip':
      return 'bavard';
    case 'watch':
      return 'guet';
    case 'bond':
      return 'ouvert';
    case 'climb':
      return 'travail';
    default:
      return 'avachi';
  }
}

interface PostureTuning {
  lean: number; // inclinaison du buste (px, + = vers la caméra)
  typing: number; // amplitude de frappe
  headSway: number; // amplitude du balancement de tête
  bounce: number; // rebond vertical
  nod: number; // hochement de tête, calé sur la frappe
  armSpread: number; // écartement des mains
  rate: number; // vitesse générale du cycle
}

// Amplitudes. Premier réglage : la tête bougeait de 0,66 px à l'écran —
// mesuré, invisible. Une échelle d'affichage de ~1,15 px par unité SVG
// impose de viser 3 à 6 unités pour qu'un mouvement se VOIE.
//
// L'INCLINAISON A ÉTÉ RETIRÉE, et c'est un vrai renoncement : elle
// servait à trahir l'intention par la silhouette. Sauf qu'à 4,5 px de
// penché, le comploteur ne « se penchait » pas — il basculait vers la
// caméra comme s'il allait tomber de sa chaise, et une posture qui fait
// rire n'informe plus de rien. Les personnages se tiennent donc droits.
//
// Ce que l'intention devient : une CADENCE et un REGARD. Un comploteur
// tape peu (typing 0,7 contre 2,6) et regarde beaucoup autour de lui
// (headSway 3,4), tout en restant assis normalement. C'est plus discret
// et, à l'usage, plus juste — les gens qui manigancent au bureau ne se
// contorsionnent pas, ils lèvent la tête plus souvent que les autres.
const TUNING: Record<Posture, PostureTuning> = {
  travail: { lean: 0.5, typing: 2.6, headSway: 1.6, bounce: 1.4, nod: 1.0, armSpread: 0, rate: 1.35 },
  concentre: { lean: 0.3, typing: 0.7, headSway: 3.4, bounce: 0.7, nod: 0.3, armSpread: -1.4, rate: 0.65 },
  bavard: { lean: 0, typing: 1.1, headSway: 4.2, bounce: 1.9, nod: 1.6, armSpread: 2.6, rate: 1.05 },
  guet: { lean: 0.2, typing: 0.3, headSway: 5.0, bounce: 0.5, nod: 0.2, armSpread: -0.8, rate: 0.5 },
  ouvert: { lean: 0, typing: 1.4, headSway: 2.4, bounce: 1.5, nod: 0.9, armSpread: 2.0, rate: 0.9 },
  avachi: { lean: 0.4, typing: 0.9, headSway: 1.8, bounce: 0.9, nod: 0.5, armSpread: 0.4, rate: 0.7 },
};

// ── Le squelette ─────────────────────────────────────────────
/**
 * Gabarit d'un personnage : rien que des nombres. Créer une silhouette
 * différente (plus massive, plus frêle) ne demande que d'en écrire un
 * autre — jamais de toucher au rendu.
 */
export interface FigureRig {
  hipY: number;
  chestY: number;
  headY: number;
  bodyR: number; // demi-largeur du buste, à la taille
  hipR: number;
  /** Demi-écartement de la barre d'épaules (partie droite de la capsule). */
  shoulderHalf: number;
  /** Rayon de la capsule d'épaules : c'est lui qui arrondit le trapèze. */
  shoulderR: number;
  shoulder: number; // demi-écart des points d'attache des bras
  upperArm: number;
  foreArm: number;
  armR: number;
}

/**
 * Calibrage. Deux contraintes se sont imposées à l'image :
 *  · le bas du bassin doit affleurer le sol (hipY + hipR ≈ 0), sinon la
 *    silhouette déborde sous son ombre portée ;
 *  · les mains doivent sortir du gabarit du tronc, sinon la fusion les
 *    avale et il ne reste qu'un tronc plus large — pas de bras lisibles.
 */
/**
 * Silhouette d'un personnage donné.
 *
 * DEUX AXES INDÉPENDANTS, et c'est volontaire :
 *   · le GENRE ne touche qu'à l'équilibre épaules / hanches ;
 *   · la CORPULENCE ne touche qu'à la masse générale.
 * Les mélanger donnerait « une femme est plus petite », ce qui est faux
 * et, à cette échelle, illisible de toute façon.
 *
 * La hauteur, elle, ne bouge JAMAIS : des têtes à des altitudes
 * différentes derrière une rangée de bureaux se liraient comme un défaut
 * d'alignement, pas comme de la variété.
 */
export function rigFor(gender: 'homme' | 'femme', build: number): FigureRig {
  const b = Math.max(0, Math.min(1, build));
  const masse = 0.86 + b * 0.36;
  // Épaules et hanches penchent en sens inverse : c'est le RAPPORT entre
  // les deux qui se lit, pas leur valeur absolue.
  //
  // L'écart porte surtout sur les ÉPAULES, et ce n'est pas arbitraire :
  // en jeu, le bureau masque le bas du corps. Une différence jouée sur
  // les hanches serait invisible là où les personnages vivent, et ne se
  // verrait que dans l'aperçu de l'embauche.
  const epaule = gender === 'homme' ? 1.1 : 0.9;
  const hanche = gender === 'homme' ? 0.92 : 1.12;

  const hipR = DEFAULT_RIG.hipR * masse * hanche;
  return {
    ...DEFAULT_RIG,
    // Le bas du bassin doit rester au sol quelle que soit sa taille.
    hipY: -hipR,
    hipR,
    bodyR: DEFAULT_RIG.bodyR * masse,
    shoulderHalf: DEFAULT_RIG.shoulderHalf * masse * epaule,
    shoulderR: DEFAULT_RIG.shoulderR * masse * epaule,
  };
}

export const DEFAULT_RIG: FigureRig = {
  hipY: -8,
  chestY: -22,
  headY: -37,
  // Le buste est plus étroit que les épaules : sans cet écart, la
  // silhouette est un tube de largeur constante coiffé d'un dôme — un
  // pion d'échecs, pas quelqu'un d'assis. Mais l'écart doit rester
  // MESURÉ : un premier réglage à 6,4 contre 21 d'épaules donnait une
  // taille de guêpe et deux lobes séparés par un étranglement.
  // Cible : 19 aux épaules, 15 à la taille, 16 aux hanches.
  bodyR: 7.9,
  hipR: 8,
  shoulderHalf: 3.4,
  shoulderR: 6.3,
  shoulder: 6.5,
  // Segments COURTS : avec des bras longs et une cible proche, l'IK plie
  // à fond et le coude dessine une boucle sur la poitrine. En gardant la
  // cible à peu près à portée maximale, la chaîne reste tendue et le bras
  // longe le flanc — ce que fait un bras au repos sur un clavier.
  upperArm: 6,
  foreArm: 6,
  armR: 3.2,
};

/**
 * Les bras ne participent PAS à la fusion.
 *
 * Deux essais l'ont montré à l'image : fusionnés près de l'axe, ils sont
 * absorbés et ne produisent qu'une bosse dans le ventre ; fusionnés
 * écartés, ils étalent la silhouette en flaque. Un corps en dôme à ~50 px
 * ne supporte ni l'un ni l'autre.
 *
 * Ils sont donc peints PAR-DESSUS le tronc, en teinte plus sombre — la
 * convention de l'illustration à plat pour un membre au premier plan.
 * La fusion garde son rôle là où elle est juste : souder le bassin au
 * buste sans arête.
 */

export interface PosedFigure {
  hip: Vec;
  chest: Vec;
  head: Vec;
  headTilt: number; // degrés
  squash: number; // 1 = neutre ; > 1 = étiré, < 1 = écrasé
  bodyR: number; // demi-largeur du buste, inverse de l'étirement
  hipR: number;
  shoulderHalf: number;
  shoulderR: number;
  arms: Array<{ a: Vec; b: Vec; c: Vec }>; // épaule, coude, main
}

/** État persistant entre deux images (le secondary motion en a besoin). */
export interface FigureMotion {
  headLag: Spring;
  leanSpring: Spring;
  phase: number; // déphasage propre au personnage
}

export const makeMotion = (phase: number): FigureMotion => ({
  headLag: makeSpring(0),
  leanSpring: makeSpring(0),
  phase,
});

/**
 * Calcule la pose à l'instant t. Pure vis-à-vis du rendu ; mute
 * seulement les ressorts, qui sont l'état d'intégration.
 *
 * @param t  temps en secondes
 * @param dt delta depuis l'image précédente
 */
export function poseFigure(
  t: number,
  dt: number,
  m: FigureMotion,
  posture: Posture,
  rig: FigureRig = DEFAULT_RIG,
): PosedFigure {
  const k = TUNING[posture];
  const ph = m.phase;
  const w = t * k.rate + ph;

  // Cycle respiratoire, et un second plus lent : deux sinusoïdes de
  // périodes non multiples ne se resynchronisent jamais, ce qui suffit
  // à casser l'aspect métronome.
  const breath = Math.sin(w * 1.6);
  const slow = Math.sin(w * 0.41 + 1.3);

  // Squash & stretch : le corps s'écrase ET s'élargit, se tend ET
  // s'affine. C'est l'inversion des deux qui fait lire le volume ; une
  // simple mise à l'échelle verticale ne se remarque pas.
  const squash = 1 + breath * 0.035 + slow * 0.012;
  // Signe négatif volontaire : les ordonnées montent vers le haut de
  // l'écran. Avec un bounce positif, l'étirement remontait la tête
  // pendant que le rebond la descendait — les deux termes s'annulaient
  // et il ne restait qu'un mouvement d'un demi-pixel.
  const bounce = -breath * k.bounce;

  // Le buste vise sa cible ; le ressort lui donne son inertie.
  stepSpring(m.leanSpring, k.lean + slow * 0.6, dt, 60, 11);
  const lean = m.leanSpring.x;

  const hip = v(0, rig.hipY + bounce * 0.35);
  const chest = v(lean * 0.5, rig.chestY * squash + bounce);

  // La tête suit le buste avec du retard : c'est ce décalage qui donne
  // l'impression de masse.
  stepSpring(m.headLag, chest.x + Math.sin(w * 0.77) * k.headSway, dt, 120, 14);
  // Le hochement suit la cadence de frappe, pas la respiration : c'est
  // ce décalage de fréquence qui donne l'air occupé.
  const nod = Math.sin(w * 3.1) * k.nod;
  const head = v(m.headLag.x, rig.headY * squash + bounce * 1.25 + nod);
  const headTilt = (m.headLag.x - chest.x) * 1.6 + nod * 0.8;

  // Mains : cibles oscillantes sur le plan de travail, en opposition de
  // phase. L'IK fait le reste — aucune position de coude n'est écrite.
  // Les mains visent un point du plan de travail, en opposition de phase.
  // L'IK place les coudes : aucune position d'articulation n'est écrite
  // à la main, c'est là tout l'intérêt de la chaîne.
  const arms = ([-1, 1] as const).map((side) => {
    const shoulder = v(chest.x + side * rig.shoulder, chest.y + 3);
    const beat = Math.sin(w * 3.1 + (side > 0 ? Math.PI : 0));
    // Mains devant le ventre, à hauteur de clavier. Le coude, lui, part
    // vers l'extérieur : c'est ce triangle qui fait lire le bras.
    const target = v(
      chest.x + side * (9.5 + k.armSpread * 0.5) + beat * 0.5,
      rig.hipY - 3 + beat * k.typing,
    );
    const { joint, end } = solveIK2(shoulder, target, rig.upperArm, rig.foreArm, side as 1 | -1);
    return { a: shoulder, b: joint, c: end };
  });

  return {
    hip,
    chest,
    head,
    headTilt,
    squash,
    bodyR: rig.bodyR / squash,
    hipR: rig.hipR / squash,
    // Les épaules s'écrasent et s'étirent comme le reste du volume.
    shoulderHalf: rig.shoulderHalf / squash,
    shoulderR: rig.shoulderR / squash,
    arms,
  };
}

/** Pose neutre, pour `prefers-reduced-motion`. */
export function restPose(rig: FigureRig = DEFAULT_RIG): PosedFigure {
  const m = makeMotion(0);
  return poseFigure(0, 1 / 60, m, 'travail', rig);
}

// ── Chef d'orchestre : une seule boucle pour tout le plateau ──
// Passer par React à 60 images/s ferait re-rendre l'arbre entier. On
// écrit donc directement dans le DOM, hors du cycle de réconciliation.
type Painter = (t: number, dt: number) => void;

const painters = new Set<Painter>();
let raf = 0;
let last = 0;
let acc = 0;

/**
 * Cadence de repose : on ne recalcule pas un mouvement d'attente à 60 Hz.
 *
 * NB — j'ai d'abord cru que cette limitation corrigeait un décrochage dû
 * aux filtres SVG. Un A/B dans une même page (avec filtre / sans filtre /
 * sans la copie d'ombre) donne exactement les mêmes temps d'image : le
 * filtre ne coûte rien de mesurable, et l'écart que j'avais observé
 * n'était que du bruit entre deux lancements. La limitation reste parce
 * qu'elle évite du travail inutile, pas parce qu'elle répare quoi que ce
 * soit.
 */
const STEP = 1 / 32;

function loop(now: number): void {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : STEP;
  last = now;
  acc += dt;
  if (acc >= STEP) {
    // On passe le temps accumulé aux ressorts, pas le pas d'affichage :
    // l'intégration reste correcte quelle que soit la cadence réelle.
    for (const p of painters) p(now / 1000, acc);
    acc = 0;
  }
  raf = requestAnimationFrame(loop);
}

/** Enregistre un peintre ; renvoie la fonction de désinscription. */
export function registerPainter(p: Painter): () => void {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    p(0, 1 / 60); // une seule pose, figée
    return () => {};
  }
  painters.add(p);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    painters.delete(p);
    if (painters.size === 0 && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      acc = 0;
    }
  };
}

/** Déphasage stable dérivé d'un identifiant. */
export function phaseOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000 * TAU;
}
