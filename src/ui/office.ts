// ─────────────────────────────────────────────────────────────
// office.ts — Géométrie de la carte (plan de l'open space vu de dessus).
// Coordonnées en % du conteneur. Purement présentation (UI).
// ─────────────────────────────────────────────────────────────
import type { OppPlace } from '@state/schema';

export interface Rect { x: number; y: number; w: number; h: number; }
export interface Point { x: number; y: number; }

export type ZoneId = 'archive' | 'manager' | 'cafe' | 'meeting' | 'detente' | 'player';

export interface Zone {
  id: ZoneId;
  label: string;
  icon: string;
  rect: Rect;
  action?: 'bosser' | 'glander'; // zone cliquable pour une action de base
  hint?: string;
}

export const ZONES: Zone[] = [
  { id: 'archive', label: 'Archives / Impression', icon: '🗄️', rect: { x: 3, y: 5, w: 24, h: 22 } },
  { id: 'manager', label: 'Bureau du manager', icon: '🚪', rect: { x: 37, y: 4, w: 26, h: 20 } },
  { id: 'cafe', label: 'Machine à café', icon: '☕', rect: { x: 74, y: 5, w: 23, h: 22 } },
  { id: 'meeting', label: 'Salle de réunion', icon: '🪑', rect: { x: 72, y: 40, w: 25, h: 30 } },
  { id: 'detente', label: 'Coin détente', icon: '🛋️', rect: { x: 4, y: 72, w: 24, h: 22 }, action: 'glander', hint: 'Glander ici (+Nerfs)' },
  { id: 'player', label: 'Ton bureau', icon: '💼', rect: { x: 40, y: 74, w: 20, h: 20 }, action: 'bosser', hint: 'Bosser (+Réputation)' },
];

/** Sièges des collègues (centre du bureau), remplis dans l'ordre du roster. */
export const SEATS: Point[] = [
  { x: 34, y: 44 },
  { x: 50, y: 39 },
  { x: 66, y: 44 },
  { x: 38, y: 61 },
  { x: 62, y: 61 },
  { x: 50, y: 55 },
  { x: 30, y: 52 },
  { x: 70, y: 52 },
];

/** Centre d'une zone, pour poser les marqueurs d'opportunité. */
function zoneCenter(id: ZoneId): Point {
  const z = ZONES.find((zz) => zz.id === id)!;
  return { x: z.rect.x + z.rect.w / 2, y: z.rect.y + z.rect.h / 2 };
}

/** Position d'un marqueur d'opportunité selon son `place` et sa cible. */
export function opportunityPoint(place: OppPlace, seatIndex: number | undefined): Point {
  switch (place) {
    case 'cafe': return zoneCenter('cafe');
    case 'archive': return zoneCenter('archive');
    case 'manager': return zoneCenter('manager');
    case 'meeting': return zoneCenter('meeting');
    case 'desk': return zoneCenter('player');
    case 'target': {
      if (seatIndex !== undefined && SEATS[seatIndex]) {
        const s = SEATS[seatIndex]!;
        return { x: s.x, y: s.y - 9 }; // léger décalage au-dessus du siège
      }
      return zoneCenter('meeting');
    }
    default: return zoneCenter('player');
  }
}
