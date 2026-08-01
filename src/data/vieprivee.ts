// ─────────────────────────────────────────────────────────────
// vieprivee.ts — Le contenu de tout ce qui se passe hors du plateau :
// dépenses, logements, meubles, activités du week-end, titres cotés,
// tables du casino.
//
// Même règle que content.ts : le moteur ne lit jamais un .json en direct.
// Il passe par ici, et ne connaît le contenu que par ses identifiants.
// ─────────────────────────────────────────────────────────────
import type {
  AppartDef,
  DepenseDef,
  JeuCasinoDef,
  MeubleDef,
  TitreDef,
} from '@state/schema';

import depensesRaw from './depenses.json';
import appartRaw from './appart.json';
import marcheRaw from './marche.json';
import weekendRaw from './weekend.json';

/**
 * Une activité du week-end : gratuite en argent, payée en temps.
 *
 * C'est volontairement la même forme qu'une `DepenseDef` moins le prix —
 * le résolveur est commun, donc une activité et une dépense ne peuvent
 * pas diverger dans leur façon d'appliquer un `Effect`.
 */
export interface ActiviteDef {
  id: string;
  nom: string;
  description: string;
  icone: string;
  /** Points d'action du week-end. */
  cout: number;
  cible?: 'colleague' | 'none';
  effects: import('@state/schema').Effect;
  outcomeText: string;
  successChance?: number;
  failureEffects?: import('@state/schema').Effect;
  failureText?: string;
}

export const depenses: DepenseDef[] = depensesRaw as DepenseDef[];
export const apparts: AppartDef[] = appartRaw.apparts as AppartDef[];
export const meubles: MeubleDef[] = appartRaw.meubles as MeubleDef[];
export const titres: TitreDef[] = marcheRaw.titres as TitreDef[];
export const casino: JeuCasinoDef[] = marcheRaw.casino as JeuCasinoDef[];
export const activites: ActiviteDef[] = weekendRaw as ActiviteDef[];

const par = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

const depenseById = par(depenses);
const appartById = par(apparts);
const meubleById = par(meubles);
const titreById = par(titres);
const casinoById = par(casino);
const activiteById = par(activites);

export const getDepense = (id: string): DepenseDef | undefined => depenseById.get(id);
export const getAppart = (id: string): AppartDef | undefined => appartById.get(id);
export const getMeuble = (id: string): MeubleDef | undefined => meubleById.get(id);
export const getTitre = (id: string): TitreDef | undefined => titreById.get(id);
export const getJeu = (id: string): JeuCasinoDef | undefined => casinoById.get(id);
export const getActivite = (id: string): ActiviteDef | undefined => activiteById.get(id);

/** Le logement de départ : le premier de la liste, celui qui ne coûte rien. */
export const appartDeDepart = (): AppartDef => apparts[0]!;

/** Logement suivant dans l'échelle, ou undefined si l'on est en haut. */
export function appartSuivant(id: string): AppartDef | undefined {
  const i = apparts.findIndex((a) => a.id === id);
  return i >= 0 ? apparts[i + 1] : undefined;
}

export const appartRang = (id: string): number => apparts.findIndex((a) => a.id === id);
