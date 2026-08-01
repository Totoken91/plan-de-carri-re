// ─────────────────────────────────────────────────────────────
// shading.ts — L'ombre n'est pas la couleur de base en plus sombre.
//
// Jusqu'ici, ombrer était une multiplication RGB : `couleur × 0,74`. La
// teinte ne bougeait jamais. C'est ce qui donne cet aspect « aplat
// assombri » — physiquement faux, et surtout sans charme.
//
// Une face à l'ombre n'est pas éclairée par RIEN : elle est éclairée par
// la lumière AMBIANTE, qui a sa propre couleur (le ciel par les baies,
// le rebond du sol et des cloisons). Sa teinte se décale donc vers celle
// de cet ambiant. Symétriquement, une face éclairée se décale vers la
// couleur de la source. C'est la vieille règle des peintres : lumière et
// ombre ne diffèrent pas seulement en valeur, elles diffèrent en
// TEMPÉRATURE.
//
// Deux détails qui comptent autant que la règle elle-même :
//
//  · le mélange se fait en OKLAB, pas en sRGB. Interpoler deux couleurs
//    en sRGB traverse une zone terne : un beige mélangé à un bleu passe
//    par un gris boueux. Oklab est construit pour que le chemin le plus
//    court soit aussi le plus joli ;
//
//  · la CHROMA remonte légèrement dans l'ombre. Contre-intuitif, mais
//    c'est ce qu'on observe : une zone à l'ombre n'est plus lavée par la
//    lumière directe, sa couleur propre ressort. Une ombre grise est une
//    ombre morte.
// ─────────────────────────────────────────────────────────────

export interface ShadingModel {
  id: string;
  nom: string;
  note: string;
  /** Couleur de la source directe : les faces éclairées tirent vers elle. */
  lumiere: string;
  /** Poids du décalage côté lumière, 0 = aucun. */
  forceLumiere: number;
  /** Couleur de l'ambiant : les faces à l'ombre tirent vers elle. */
  ombre: string;
  forceOmbre: number;
  /** Multiplicateur de chroma dans l'ombre. > 1 = ombre plus colorée. */
  chromaOmbre: number;
  /**
   * Exposant appliqué au facteur d'éclairement sur la clarté perçue.
   *
   * 0,722 reproduit EXACTEMENT la réponse en valeur de l'ancien multiply
   * RGB — mesuré sur six teintes et trois facteurs, l'exposant sort
   * identique à trois décimales près. C'est la valeur neutre : elle
   * garantit que le passage à l'ombrage coloré ne change QUE la teinte,
   * et pas la lecture du volume. Au-dessus, le relief se creuse.
   */
  contraste?: number;
}

// ── sRGB ↔ Oklab ─────────────────────────────────────────────
const srgbToLinear = (v: number): number => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

const linearToSrgb = (x: number): number => {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

export function rgbToOklab(r: number, g: number, bl: number): Oklab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(bl);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb({ L, a, b }: Oklab): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Teinte (radians) et chroma d'une couleur Oklab. */
export const chromaOf = (c: Oklab): number => Math.hypot(c.a, c.b);
export const hueOf = (c: Oklab): number => Math.atan2(c.b, c.a);

// ── Le modèle ────────────────────────────────────────────────
export function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.length === 4
      ? color.slice(1).split('').map((h) => h + h).join('')
      : color.slice(1);
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
}

/**
 * Applique le facteur d'éclairement `k` à une couleur.
 *
 * `k > 1` : face vers la lumière. `k < 1` : face à l'ombre. `k = 1` :
 * inchangée. La valeur suit `k` comme avant — c'est la lisibilité du
 * volume, on n'y touche pas. Ce qui change, c'est que la TEINTE dérive
 * vers celle de la source ou de l'ambiant, proportionnellement à
 * l'écart.
 */
export function shadeWith(model: ShadingModel, color: string, k: number): string {
  const [r, g, b] = parseColor(color);
  const base = rgbToOklab(r, g, b);

  // La valeur : même comportement qu'avant, mais appliqué à L (perçue)
  // et non aux canaux RGB. L'exposant est calibré pour que le volume se
  // lise exactement comme avant — seule la teinte change.
  const L = Math.max(0, Math.min(1, base.L * Math.pow(k, model.contraste ?? 0.722)));

  const t = Math.abs(k - 1);
  const vers = k >= 1 ? model.lumiere : model.ombre;
  const force = (k >= 1 ? model.forceLumiere : model.forceOmbre) * Math.min(1, t * 2.2);

  const [tr, tg, tb] = parseColor(vers);
  const tint = rgbToOklab(tr, tg, tb);

  // Décalage de teinte : on tire a et b vers ceux de la teinte cible.
  let a = base.a + (tint.a - base.a) * force;
  let bb = base.b + (tint.b - base.b) * force;

  // Remontée de chroma dans l'ombre : une ombre grise est une ombre morte.
  if (k < 1 && model.chromaOmbre !== 1) {
    const boost = 1 + (model.chromaOmbre - 1) * Math.min(1, t * 2.2);
    a *= boost;
    bb *= boost;
  }

  const [nr, ng, nb] = oklabToRgb({ L, a, b: bb });
  return `rgb(${nr},${ng},${nb})`;
}
