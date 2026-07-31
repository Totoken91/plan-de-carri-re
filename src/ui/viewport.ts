// ─────────────────────────────────────────────────────────────
// viewport.ts — Déplacement et zoom du plateau.
//
// On écrit directement l'attribut `viewBox` du SVG, sans passer par
// l'état React : repasser par un rendu à chaque cran de molette ferait
// reconstruire tout l'open space. Rien d'autre ne dépend du cadrage,
// donc le garder hors de React ne coûte aucune cohérence.
//
// Le cadrage est borné : on ne peut ni dézoomer au-delà du plateau
// entier, ni le faire sortir du cadre. Un joueur qui se perd dans du
// vide noir n'a aucun moyen de comprendre comment revenir.
//
// Le geste ne doit RIEN déclencher d'autre. Trois sources d'interférence,
// toutes neutralisées ici :
//   · le pincement au pavé tactile n'est pas un événement tactile mais un
//     `wheel` portant `ctrlKey` — sans interception, le navigateur zoome
//     la page entière ;
//   · Safari émet en plus ses `gesture*` non standard ;
//   · un glissement sélectionne le texte alentour tant qu'on ne l'a pas
//     interdit en CSS et annulé sur `dragstart`.
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

interface SafariGesture extends Event {
  scale: number;
}

export function attachViewport(
  svg: SVGSVGElement,
  base: Box,
): { detach: () => void; reset: () => void } {
  const view: Box = { ...base };

  const apply = () => {
    view.w = clamp(view.w, base.w / MAX_ZOOM, base.w);
    view.h = clamp(view.h, base.h / MAX_ZOOM, base.h);
    view.x = clamp(view.x, base.x, base.x + base.w - view.w);
    view.y = clamp(view.y, base.y, base.y + base.h - view.h);
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  };

  /** Point écran → coordonnées du SVG (tient compte du letterboxing). */
  const toSvg = (clientX: number, clientY: number) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: view.x + view.w / 2, y: view.y + view.h / 2 };
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  /**
   * Zoome d'un facteur donné en gardant fixe le point (clientX, clientY).
   * C'est ce point d'ancrage qui rend le geste prévisible : sans lui, on
   * zoome vers le centre et on perd ce qu'on visait.
   */
  const zoomAt = (factor: number, clientX: number, clientY: number) => {
    const c = toSvg(clientX, clientY);
    const newW = clamp(view.w / factor, base.w / MAX_ZOOM, base.w);
    const k = newW / view.w;
    view.x = c.x - (c.x - view.x) * k;
    view.y = c.y - (c.y - view.y) * k;
    view.w = newW;
    view.h = base.h * (newW / base.w);
    apply();
  };

  /** Déplace la vue d'un vecteur exprimé en pixels écran. */
  const panBy = (dxScreen: number, dyScreen: number) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    view.x -= (dxScreen * view.w) / rect.width;
    view.y -= (dyScreen * view.h) / rect.height;
    apply();
  };

  // ── Molette et pincement au pavé tactile ───────────────────
  const onWheel = (e: WheelEvent) => {
    e.preventDefault(); // sinon : défilement de page, ou zoom du navigateur
    // Un pincement au pavé arrive en `wheel` + ctrlKey, avec des deltas
    // bien plus petits qu'un cran de molette : il lui faut son gain.
    const gain = e.ctrlKey ? 0.012 : 0.0015;
    zoomAt(Math.exp(-e.deltaY * gain), e.clientX, e.clientY);
  };

  // ── Pointeurs : 1 = déplacement, 2 = pincement ─────────────
  const active = new Map<number, { x: number; y: number }>();
  let moved = 0;

  const centreOf = () => {
    const pts = [...active.values()];
    const sx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const sy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    return { x: sx, y: sy };
  };
  const spreadOf = () => {
    const [a, b] = [...active.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (active.size === 1) moved = 0;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!active.has(e.pointerId)) return;
    const prev = centreOf();
    const prevSpread = spreadOf();
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const next = centreOf();
    const nextSpread = spreadOf();

    moved += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
    if (moved > DRAG_SLOP && !svg.classList.contains('is-panning')) {
      svg.classList.add('is-panning');
    }

    if (active.size >= 2) {
      // Le pincement zoome ET déplace : deux doigts qui glissent de
      // concert doivent faire glisser la vue, comme partout ailleurs.
      if (prevSpread > 0 && nextSpread > 0) {
        zoomAt(nextSpread / prevSpread, next.x, next.y);
      }
      panBy(next.x - prev.x, next.y - prev.y);
    } else if (svg.classList.contains('is-panning')) {
      panBy(next.x - prev.x, next.y - prev.y);
    }
  };

  const endPointer = (e: PointerEvent) => {
    if (!active.delete(e.pointerId)) return;
    if (active.size > 0) return;

    if (svg.classList.contains('is-panning')) {
      svg.classList.remove('is-panning');
      // Un glissement ne doit pas sélectionner le collègue survolé à
      // l'arrivée : on avale le clic qui suit, une seule fois.
      const swallow = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      svg.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => svg.removeEventListener('click', swallow, { capture: true }), 60);
    }
  };

  // ── Gestes Safari (non standard) ───────────────────────────
  let safariScale = 1;
  const onGestureStart = (e: Event) => {
    e.preventDefault();
    safariScale = (e as SafariGesture).scale || 1;
  };
  const onGestureChange = (e: Event) => {
    e.preventDefault();
    const g = e as SafariGesture & { clientX?: number; clientY?: number };
    const s = g.scale || 1;
    if (safariScale > 0) {
      const rect = svg.getBoundingClientRect();
      zoomAt(
        s / safariScale,
        g.clientX ?? rect.left + rect.width / 2,
        g.clientY ?? rect.top + rect.height / 2,
      );
    }
    safariScale = s;
  };
  const onGestureEnd = (e: Event) => e.preventDefault();

  const onDragStart = (e: Event) => e.preventDefault();
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
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('pointerleave', endPointer);
  svg.addEventListener('dblclick', onDblClick);
  svg.addEventListener('dragstart', onDragStart);
  svg.addEventListener('gesturestart', onGestureStart as EventListener, { passive: false });
  svg.addEventListener('gesturechange', onGestureChange as EventListener, { passive: false });
  svg.addEventListener('gestureend', onGestureEnd as EventListener, { passive: false });

  return {
    detach() {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', endPointer);
      svg.removeEventListener('pointercancel', endPointer);
      svg.removeEventListener('pointerleave', endPointer);
      svg.removeEventListener('dblclick', onDblClick);
      svg.removeEventListener('dragstart', onDragStart);
      svg.removeEventListener('gesturestart', onGestureStart as EventListener);
      svg.removeEventListener('gesturechange', onGestureChange as EventListener);
      svg.removeEventListener('gestureend', onGestureEnd as EventListener);
    },
    reset,
  };
}
