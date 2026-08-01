// ─────────────────────────────────────────────────────────────
// board.ts — La palette du plateau, et la règle qui la tient.
//
// Avant ce fichier, 108 couleurs vivaient en dur dans le rendu. Elles
// sont maintenant du contenu, rangées par RÔLE et non par objet : ce
// n'est pas « la couleur du caisson », c'est « du métal de structure ».
// Changer d'identité visuelle coûte un fichier JSON.
//
// Le rangement par rôle n'est pas cosmétique, c'est ce qui rend tenable
// la seule règle qui compte :
//
//   · le DÉCOR tient dans une bande de valeurs étroite (`bandeDecor`) ;
//   · les ACTEURS vivent en dehors, plus sombres et plus saturés
//     (`bandeActeurs`).
//
// C'est cette règle, pas la palette, qui empêche un plateau de se lire
// comme une bouillie : quand la plante verte, le caisson à tiroirs et
// le visage d'un collègue ont le même contraste, tout crie au même
// volume et rien n'est lisible. `auditTheme()` la vérifie pour de vrai
// (voir scripts/audit-palette.mjs) — une couleur hors bande est un bug,
// pas une question de goût.
// ─────────────────────────────────────────────────────────────
import type { Appearance } from '@state/schema';
import type { ShadingModel } from '@ui/shading';
import raw from './board.json';

export interface BoardTheme {
  id: string;
  nom: string;
  note: string;
  /** [min, max] de luminance autorisée pour le décor. */
  bandeDecor: [number, number];
  /** [min, max] de luminance attendue pour les personnages. */
  bandeActeurs: [number, number];
  fond: {
    hautPage: string;
    basPage: string;
    voile: string;
    vignette: string;
    melangeVignette: string;
    melangeLumieres: string;
    opaciteLumieres: number;
    /** Encre lisible sur le fond du cadre, pas sur le sol de la pièce. */
    encre: string;
    encreDouce: string;
    /** Débord lumineux de la pièce éclairée sur ce qui l'entoure. */
    debord: [string, string];
    /** Force du grain de film sur le plateau, 0 = aucun. */
    grain: number;
  };
  sol: {
    dalle: string;
    joint: string;
    moquettes: Record<string, string>;
  };
  mur: {
    fond: string;
    gauche: string;
    socle: string;
    socleGauche: string;
    baieVitre: string;
    baieMontant: string;
    baieRebord: string;
  };
  cloison: { vitre: string; rail: string; montant: string };
  structure: {
    bois: string;
    boisFonce: string;
    metal: string;
    metalFonce: string;
    /** Cloison OPAQUE : le seul volume plein d'un étage tout en verre. */
    cloisonPleine: string;
    metalClair: string;
    ecranDos: string;
    ecranPied: string;
    ecranArete: string;
    tissu: string;
    tissuFonce: string;
  };
  habillage: {
    papier: string;
    papierOmbre: string;
    carton: string;
    cartonFonce: string;
    vegetal: string;
    vegetalFonce: string;
    vegetalClair: string;
    terre: string;
    cafe: string;
    casiers: string[];
    poubelles: string[];
    postIt: string;
  };
  signal: {
    or: string;
    orClair: string;
    orSombre: string;
    menace: string;
    encre: string;
    encreDouce: string;
    papier: string;
    ecranLueur: string;
    lampe: string;
  };
  ombre: { contact: string; contactForte: string; creux: string; lisere: string };
  /** Arrêts des dégradés, dans l'ordre où ils sont posés. */
  degrades: {
    ecranNappe: [string, string];
    ecranArete: [string, string];
    baliseNappe: [string, string];
    balise: [string, string, string];
    baie: [string, string, string];
    baieLueur: [string, string];
    nappeBaie: [string, string];
    nappePlafond: [string, string, string];
    tableauBlanc: [string, string];
  };
  personnages: {
    peaux: string[];
    oeil: string;
    verre: string;
    tasse: string;
    tasseCafe: string;
    /** Apparence par archétype : la bande du décor dicte celle des acteurs. */
    archetypes: Record<string, Omit<Appearance, 'skin'> & { mug?: boolean }>;
  };
  /** Saturation maximale autorisée pour le décor. */
  satMaxDecor?: number;
  /** Exceptions assumées à la bande, chacune avec sa raison. */
  horsBande?: Array<{ chemin: string; raison: string }>;
  /** `false` = thème conservé pour comparaison, non conforme par nature. */
  conforme?: boolean;
}

interface BoardFile {
  actif: string;
  themes: BoardTheme[];
  /** Modèles d'ombrage disponibles (voir ui/shading.ts). */
  ombrages: ShadingModel[];
  ombrageActif: string;
}

const file = raw as unknown as BoardFile;

export const themes = file.themes;
export const themeById = (id: string): BoardTheme | undefined =>
  themes.find((t) => t.id === id);

/**
 * Thème actif. Surchargeable par `?theme=nuit` dans l'URL : comparer
 * deux identités visuelles côte à côte ne doit pas demander un build.
 */
function pickTheme(): BoardTheme {
  let id = file.actif;
  try {
    const q = new URLSearchParams(location.search).get('theme');
    if (q && themeById(q)) id = q;
  } catch {
    /* pas de `location` (tests, SSR) : on garde le thème du fichier */
  }
  return themeById(id) ?? themes[0]!;
}

export const theme: BoardTheme = pickTheme();

/**
 * Modèle d'ombrage actif, surchargeable par `?ombrage=soleil` : comparer
 * des directions de couleur ne doit pas demander un build.
 */
function pickShading(): ShadingModel {
  let id = file.ombrageActif;
  try {
    const q = new URLSearchParams(location.search).get('ombrage');
    if (q && file.ombrages.some((o) => o.id === q)) id = q;
  } catch {
    /* pas de `location` : on garde celui du fichier */
  }
  return file.ombrages.find((o) => o.id === id) ?? file.ombrages[0]!;
}

export const shadingModels = file.ombrages;
export const shading: ShadingModel = pickShading();

// ── Mesure de valeur ─────────────────────────────────────────
export function parseRgb(color: string): [number, number, number] | undefined {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

/** Luminance relative 0–1 (pondération Rec. 709). */
export function luminance(color: string): number {
  const c = parseRgb(color);
  if (!c) return 0.5;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

/** Saturation HSL 0–1. */
export function saturation(color: string): number {
  const c = parseRgb(color);
  if (!c) return 0;
  const [r, g, b] = [c[0] / 255, c[1] / 255, c[2] / 255];
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  const l = (mx + mn) / 2;
  return (mx - mn) / (1 - Math.abs(2 * l - 1));
}

export interface PaletteOffence {
  chemin: string;
  couleur: string;
  valeur: number;
  attendu: [number, number];
}

/**
 * Vérifie que chaque couleur de décor tient dans la bande du thème.
 * Ce qui est exclu du contrôle est exclu pour une raison :
 *   · `signal` — l'or et le rouge DOIVENT sortir de la bande, c'est
 *     leur métier ;
 *   · `personnages` — les acteurs ont leur propre bande ;
 *   · `fond` et `ombre` — dégradés CSS et transparences, sans valeur
 *     propre mesurable.
 */
export function auditTheme(t: BoardTheme): PaletteOffence[] {
  const out: PaletteOffence[] = [];
  const [lo, hi] = t.bandeDecor;

  const visit = (node: unknown, chemin: string) => {
    if (typeof node === 'string') {
      if (!node.startsWith('#') && !node.startsWith('rgb')) return;
      const v = luminance(node);
      if (v < lo || v > hi) out.push({ chemin, couleur: node, valeur: +v.toFixed(3), attendu: [lo, hi] });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((n, i) => visit(n, `${chemin}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) visit(v, `${chemin}.${k}`);
    }
  };

  const tolere = new Set((t.horsBande ?? []).map((e) => e.chemin));
  for (const groupe of ['sol', 'mur', 'cloison', 'structure', 'habillage'] as const) {
    visit(t[groupe], groupe);
  }
  return out.filter((o) => !tolere.has(o.chemin));
}

// ── Passage à la feuille de style ────────────────────────────
/**
 * Les règles `.iso*` du CSS ont besoin des mêmes couleurs. Plutôt que de
 * les recopier (et de les laisser diverger au premier changement), le
 * plateau pose ces variables sur son conteneur.
 */
export function themeVars(t: BoardTheme): Record<string, string> {
  return {
    '--iso-page-haut': t.fond.hautPage,
    '--iso-page-bas': t.fond.basPage,
    '--iso-cadre-encre': t.fond.encre,
    '--iso-cadre-encre-douce': t.fond.encreDouce,
    '--iso-grain': String(t.fond.grain),
    '--iso-voile': t.fond.voile,
    '--iso-vignette': t.fond.vignette,
    '--iso-vignette-melange': t.fond.melangeVignette,
    '--iso-lumieres-melange': t.fond.melangeLumieres,
    '--iso-lumieres-opacite': String(t.fond.opaciteLumieres),
    '--iso-joint': t.sol.joint,
    '--iso-vitre': t.cloison.vitre,
    '--iso-vitre-rail': t.cloison.rail,
    '--iso-vitre-montant': t.cloison.montant,
    '--iso-encre': t.signal.encre,
    '--iso-encre-douce': t.signal.encreDouce,
    '--iso-papier': t.signal.papier,
    '--iso-or': t.signal.or,
    '--iso-menace': t.signal.menace,
  };
}
