// ─────────────────────────────────────────────────────────────
// appearance.ts — Palettes de création de personnage.
//
// Contenu, pas code : ajouter une teinte de chemise ou un prénom se fait
// dans appearance.json, sans toucher au formulaire ni au rendu.
// ─────────────────────────────────────────────────────────────
import type { Appearance, Gender, HairStyle } from '@state/schema';
import raw from './appearance.json';

export interface AppearancePalettes {
  skins: string[];
  hairs: string[];
  hairStyles: Array<{ id: HairStyle; label: string }>;
  shirts: string[];
  ties: string[];
  firstNames: string[];
  lastNames: string[];
}

export const palettes: AppearancePalettes = raw as AppearancePalettes;

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

/** Une apparence au hasard — le bouton « Au hasard » et le repli par défaut. */
export function randomAppearance(): Appearance {
  const tie = Math.random() < 0.35 ? pick(palettes.ties) : undefined;
  return {
    skin: pick(palettes.skins),
    hair: pick(palettes.hairs),
    hairStyle: pick(palettes.hairStyles).id,
    shirt: pick(palettes.shirts),
    ...(tie ? { tie } : {}),
    glasses: Math.random() < 0.4,
    gender: (Math.random() < 0.5 ? 'homme' : 'femme') as Gender,
    // Tirage centré : les silhouettes extrêmes existent mais restent rares.
    build: Math.round(((Math.random() + Math.random()) / 2) * 100) / 100,
  };
}

export function randomName(): string {
  return `${pick(palettes.firstNames)} ${pick(palettes.lastNames)}`;
}

/**
 * Apparence de secours. Sert aux sauvegardes d'avant la création de
 * personnage et à tout état construit sans passer par le formulaire.
 */
export const DEFAULT_APPEARANCE: Appearance = {
  skin: palettes.skins[1]!,
  hair: palettes.hairs[2]!,
  hairStyle: 'carre',
  shirt: palettes.shirts[1]!,
  glasses: false,
  gender: 'femme',
  build: 0.5,
};
