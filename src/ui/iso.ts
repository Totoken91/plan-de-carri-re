// ─────────────────────────────────────────────────────────────
// iso.ts — Projection isométrique 2:1 et plan du plateau.
//
// Repère : gx augmente vers la droite-bas de l'écran, gy vers la
// gauche-bas. La profondeur d'affichage (painter's algorithm) est
// donc simplement gx + gy : plus la somme est grande, plus l'objet
// est proche de la caméra et donc dessiné tard.
//
// Purement présentation — aucune règle de jeu ici.
// ─────────────────────────────────────────────────────────────

export const TILE_W = 64;
export const TILE_H = 32;

/** Dimensions du plateau, en tuiles. */
export const GRID_W = 14;
export const GRID_D = 12;

export interface IsoPoint {
  x: number;
  y: number;
}

/** Projette une coordonnée grille (+ élévation z en px) vers l'écran. */
export function iso(gx: number, gy: number, gz = 0): IsoPoint {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2) - gz,
  };
}

const pts = (list: IsoPoint[]): string => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** Quadrilatère horizontal (sol, dessus de meuble) à l'élévation z. */
export function quad(gx: number, gy: number, w: number, d: number, z = 0): string {
  return pts([iso(gx, gy, z), iso(gx + w, gy, z), iso(gx + w, gy + d, z), iso(gx, gy + d, z)]);
}

export interface BoxFaces {
  top: string;
  right: string; // face +gx, tournée vers la droite de l'écran
  left: string; // face +gy, tournée vers la gauche de l'écran
}

/**
 * Les trois faces visibles d'un volume de hauteur h (px), dont la base
 * repose à l'élévation z0 (0 = sol). z0 sert à empiler : un écran posé
 * sur un bureau, une tasse sur une table.
 */
export function box(
  gx: number,
  gy: number,
  w: number,
  d: number,
  h: number,
  z0 = 0,
): BoxFaces {
  const zt = z0 + h;
  return {
    top: quad(gx, gy, w, d, zt),
    right: pts([
      iso(gx + w, gy, zt),
      iso(gx + w, gy + d, zt),
      iso(gx + w, gy + d, z0),
      iso(gx + w, gy, z0),
    ]),
    left: pts([
      iso(gx, gy + d, zt),
      iso(gx + w, gy + d, zt),
      iso(gx + w, gy + d, z0),
      iso(gx, gy + d, z0),
    ]),
  };
}

/** Panneau vertical dans le plan gy = cst (mur du fond-droit, vitrage). */
export function panelAlongX(gx1: number, gx2: number, gy: number, z1: number, z2: number): string {
  return pts([iso(gx1, gy, z2), iso(gx2, gy, z2), iso(gx2, gy, z1), iso(gx1, gy, z1)]);
}

/** Panneau vertical dans le plan gx = cst (mur du fond-gauche, vitrage). */
export function panelAlongY(gy1: number, gy2: number, gx: number, z1: number, z2: number): string {
  return pts([iso(gx, gy1, z2), iso(gx, gy2, z2), iso(gx, gy2, z1), iso(gx, gy1, z1)]);
}

/** Clé de tri du painter's algorithm. */
export const depthOf = (gx: number, gy: number): number => gx + gy;

/**
 * Ce que le joueur a sous les yeux dans l'inspecteur. Un seul clic
 * sélectionne, l'inspecteur détaille, un second clic agit — l'impact
 * est toujours affiché avant l'engagement.
 */
export type Selection =
  | { kind: 'colleague'; id: string }
  | { kind: 'zone'; id: ZoneId }
  | { kind: 'opportunity'; index: number }
  | null;

// ── Zones du plateau ─────────────────────────────────────────
export type ZoneId =
  | 'manager'
  | 'cafe'
  | 'meeting'
  | 'archive'
  | 'detente'
  | 'toilettes'
  | 'player';

export interface IsoZone {
  id: ZoneId;
  label: string;
  gx: number;
  gy: number;
  w: number;
  d: number;
  action?: 'bosser' | 'glander';
}

export const ZONES: IsoZone[] = [
  { id: 'manager', label: 'Bureau du manager', gx: 0, gy: 0, w: 4.5, d: 3.5 },
  // Une PORTE dans le mur de gauche, et rien de plus : les toilettes
  // sont hors du rectangle de l'étage, comme dans n'importe quel plan de
  // bureau réel. Leur emprise au sol est donc nulle.
  //
  // Les deux emplacements précédents étaient des volumes POSÉS DANS la
  // pièce, et chacun coûtait quelque chose de mesurable : le premier
  // (entre ton poste et le coin détente) avait une profondeur de 18,3 à
  // 22 contre 16,95 pour le joueur assis — le peintre le posait donc
  // par-dessus lui — et sa porte tombait au ras du bord du plateau, donc
  // ouvrait sur le vide. Le second mangeait l'allée.
  //
  // La zone garde une emprise quasi nulle : c'est un panneau sur le mur,
  // pas une pièce. Ce qu'on clique, c'est la porte.
  { id: 'toilettes', label: 'Toilettes', gx: 0, gy: 3.9, w: 0.02, d: 1.1 },
  { id: 'cafe', label: 'Machine à café', gx: 4.8, gy: 0, w: 4.4, d: 3.5 },
  { id: 'meeting', label: 'Salle de réunion', gx: 9.5, gy: 0, w: 4.5, d: 3.5 },
  { id: 'archive', label: 'Archives', gx: 0, gy: 9.6, w: 4, d: 2.4 },
  {
    id: 'player',
    label: 'Ton bureau',
    gx: 5.6,
    gy: 9.8,
    w: 3,
    d: 2.2,
    action: 'bosser',
  },
  {
    id: 'detente',
    label: 'Coin détente',
    gx: 10,
    gy: 9.6,
    w: 4,
    d: 2.4,
    action: 'glander',
  },
];

export const zoneById = (id: ZoneId): IsoZone => ZONES.find((z) => z.id === id)!;

/** Centre au sol d'une zone. */
export function zoneCenter(id: ZoneId): IsoPoint {
  const z = zoneById(id);
  return iso(z.gx + z.w / 2, z.gy + z.d / 2);
}

// ── Postes de travail de l'open space ────────────────────────
export interface DeskSlot {
  gx: number;
  gy: number;
}

export const DESK_W = 2.2;
export const DESK_D = 1.1;

// Deux rangées, avec une allée franche devant les salles du fond : sans
// elle, les collègues du premier rang se collent aux cloisons vitrées.
export const DESK_SLOTS: DeskSlot[] = [
  { gx: 1.2, gy: 5.4 },
  { gx: 4.6, gy: 5.4 },
  { gx: 8.0, gy: 5.4 },
  { gx: 11.4, gy: 5.4 },
  { gx: 1.2, gy: 8.0 },
  { gx: 4.6, gy: 8.0 },
  { gx: 8.0, gy: 8.0 },
  { gx: 11.4, gy: 8.0 },
];

/**
 * Position en grille du collègue assis à ce poste. Le recul (0,95 tuile)
 * est calibré pour que le buste et la tête passent au-dessus du plateau
 * du bureau : les personnages doivent rester lisibles, c'est eux le jeu.
 */
export function seatOf(index: number): DeskSlot {
  const slot = DESK_SLOTS[index] ?? DESK_SLOTS[DESK_SLOTS.length - 1]!;
  return { gx: slot.gx + DESK_W / 2, gy: slot.gy - 0.95 };
}

/**
 * Ancre d'étiquette d'une zone.
 *
 * Salles du fond : la pancarte est accrochée en haut de la cloison
 * vitrée (z = 58). Posée au sol, elle se superposerait aux collègues du
 * premier rang — en isométrie, sol de la pièce et personnage devant se
 * projettent au même endroit.
 *
 * Zones de devant : rien ne circule devant elles, l'étiquette reste au sol.
 */
export function zoneLabelPoint(id: ZoneId): IsoPoint {
  const z = zoneById(id);
  // Les toilettes n'ont pas d'emprise au sol : leur pancarte se visse
  // au-dessus de la porte, sur le mur.
  if (id === 'toilettes') return iso(0, z.gy + z.d / 2, 62);
  // Posée juste au-dessus de la traverse haute du vitrage (z = 70), là où
  // une vraie signalétique se visse — et hors de portée des bulles.
  if (z.gy < 5) return iso(z.gx + z.w / 2, z.gy + z.d, 76);
  const p = iso(z.gx + z.w / 2, z.gy + z.d * 0.92);
  return { x: p.x, y: p.y + 10 };
}

/** Point écran où poser un marqueur d'opportunité. */
export function opportunityPoint(place: string, seatIndex: number | undefined): IsoPoint {
  switch (place) {
    case 'cafe':
      return zoneCenter('cafe');
    case 'archive':
      return zoneCenter('archive');
    case 'manager':
      return zoneCenter('manager');
    case 'meeting':
      return zoneCenter('meeting');
    case 'desk':
      return zoneCenter('player');
    case 'target': {
      if (seatIndex !== undefined && seatIndex >= 0) {
        const s = seatOf(seatIndex);
        return iso(s.gx, s.gy - 0.4);
      }
      return zoneCenter('meeting');
    }
    default:
      return zoneCenter('player');
  }
}

/** viewBox englobant tout le plateau (murs et têtes compris). */
export const VIEW_BOX = (() => {
  const minX = iso(0, GRID_D).x - 40;
  const maxX = iso(GRID_W, 0).x + 40;
  const minY = -120; // hauteur des murs + bulles d'intention
  const maxY = iso(GRID_W, GRID_D).y + 40;
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
})();
