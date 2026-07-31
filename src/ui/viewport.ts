// ─────────────────────────────────────────────────────────────
// viewport.ts — Déplacement et zoom du plateau, à la souris.
//
// On écrit directement l'attribut `viewBox` du SVG, sans passer par
// l'état React : repasser par un rendu à chaque cran de molette ferait
// reconstruire tout l'open space. Rien d'autre ne dépend du cadrage,
// donc le garder hors de React ne coûte aucune cohérence.
//
// Le cadrage est borné : on ne peut ni dézoomer au-delà du plateau
// entier, ni le faire sortir du cadre. Un joueur qui se perd dans du
// vide noir n'a aucun moyen de comprendre comment revenir.
// ─────────────────────────────────────────────────────────────

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zoom maximal. Au-delà, les personnages se pixelisent en bordure. */
const MAX_ZOOM = 4;
/** Au-dessous de ce déplacement, on considère que c'est un clic. */
const DRAG_SLOP = 5;

export function parseViewBox(s: string): Box {
  const [x, y, w, h] = s.trim().split(/[\s,]+/).map(Number);
  return { x: x!, y: y!, w: w!, h: h! };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Branche le déplacement et le zoom sur un SVG.
 * @returns de quoi tout détacher, et une fonction de recadrage.
 */
export function attachViewport(
  svg: SVGSVGElement,
  base: Box,
): { detach: () => void; reset: () => void } {
  const view: Box = { ...base };

  const apply = () => {
    // On garde la vue à l'intérieur du plateau, quel que soit le zoom.
    view.w = clamp(view.w, base.w / MAX_ZOOM, base.w);
    view.h = clamp(view.h, base.h / MAX_ZOOM, base.h);
    view.x = clamp(view.x, base.x, base.x + base.w - view.w);
    view.y = clamp(view.y, base.y, base.y + base.h - view.h);
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  };

  /** Position du curseur en coordonnées du SVG. */
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: view.x + view.w / 2, y: view.y + view.h / 2 };
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  // ── Molette : zoom centré sur le curseur ───────────────────
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const c = toSvg(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newW = clamp(view.w / factor, base.w / MAX_ZOOM, base.w);
    const k = newW / view.w;
    // Le point sous le curseur ne doit pas bouger : c'est ce qui rend le
    // zoom prévisible plutôt que désorientant.
    view.x = c.x - (c.x - view.x) * k;
    view.y = c.y - (c.y - view.y) * k;
    view.w = newW;
    view.h = base.h * (newW / base.w);
    apply();
  };

  // ── Glisser : déplacement ──────────────────────────────────
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  let pointerId: number | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    pointerId = e.pointerId;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > DRAG_SLOP && !svg.classList.contains('is-panning')) {
      svg.classList.add('is-panning');
      svg.setPointerCapture(e.pointerId);
    }
    if (svg.classList.contains('is-panning')) {
      const rect = svg.getBoundingClientRect();
      // Un pixel écran ne vaut pas une unité SVG : on convertit.
      view.x -= (dx * view.w) / rect.width;
      view.y -= (dy * view.h) / rect.height;
      apply();
    }
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (pointerId !== null && svg.hasPointerCapture?.(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }
    pointerId = null;
    if (svg.classList.contains('is-panning')) {
      svg.classList.remove('is-panning');
      // Un glissement ne doit pas déclencher la sélection du collègue
      // survolé à l'arrivée. On avale le clic qui suit, une seule fois.
      const swallow = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      svg.addEventListener('click', swallow, { capture: true, once: true });
      // Filet de sécurité : si aucun clic ne suit, on ne laisse pas
      // l'écouteur armé pour le prochain vrai clic.
      setTimeout(() => svg.removeEventListener('click', swallow, { capture: true }), 60);
    }
  };

  const onDblClick = () => reset();

  function reset(): void {
    view.x = base.x;
    view.y = base.y;
    view.w = base.w;
    view.h = base.h;
    apply();
  }

  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('dblclick', onDblClick);

  return {
    detach() {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', endDrag);
      svg.removeEventListener('pointercancel', endDrag);
      svg.removeEventListener('dblclick', onDblClick);
    },
    reset,
  };
}
