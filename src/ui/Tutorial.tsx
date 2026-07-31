// ─────────────────────────────────────────────────────────────
// Tutorial.tsx — Le voile, le trou, et la note de service.
//
// Le voile est un unique <path> à règle de remplissage `evenodd` :
// le rectangle de l'écran, puis un rectangle par élément à éclairer.
// Les trous ne sont donc pas peints — et comme le test de survol suit
// le remplissage, ils laissent aussi passer les clics. Un seul objet
// assure à la fois l'assombrissement et le verrouillage du reste de
// l'interface, sans découper l'écran en quatre panneaux ni toucher aux
// z-index des composants existants (qui vivent dans des contextes
// d'empilement dont on ne veut rien savoir).
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from './useGame';
import type { Selection } from './iso';
import { TUTORIAL, markTutorialSeen, type TutoCtx } from './tutorial';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8;
const CARD_W = 400;
/** Largeur en dessous de laquelle la carte devient illisible. */
const MIN_W = 300;
const GAP = 16;
const MARGIN = 12;

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

const sameRects = (a: Rect[], b: Rect[]) =>
  a.length === b.length &&
  a.every((r, i) => {
    const o = b[i]!;
    return (
      Math.abs(r.x - o.x) < 0.5 &&
      Math.abs(r.y - o.y) < 0.5 &&
      Math.abs(r.w - o.w) < 0.5 &&
      Math.abs(r.h - o.h) < 0.5
    );
  });

/** Le voile : l'écran entier, moins un rectangle par trou. */
function scrimPath(vw: number, vh: number, holes: Rect[]): string {
  const outer = `M0 0 H${vw} V${vh} H0 Z`;
  const cut = holes
    .map((r) => `M${r.x} ${r.y} H${r.x + r.w} V${r.y + r.h} H${r.x} Z`)
    .join(' ');
  return `${outer} ${cut}`;
}

export function Tutorial({
  selection,
  onSelect,
  onClose,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
  onClose: () => void;
}) {
  const { state } = useGame();
  const [index, setIndex] = useState(0);
  const [holes, setHoles] = useState<Rect[]>([]);
  const [cardH, setCardH] = useState(260);
  const [, forceRender] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  /** Contexte figé à l'entrée dans l'étape : sert de point de comparaison. */
  const startRef = useRef<TutoCtx>({ state, selection });
  /** Verrou : une consigne remplie ne déclenche son passage qu'une fois. */
  const firedRef = useRef(false);
  const timerRef = useRef<number>();

  const step = TUTORIAL[index]!;
  const last = index === TUTORIAL.length - 1;

  const finish = useCallback(() => {
    markTutorialSeen();
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= TUTORIAL.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  // ── Entrée dans une étape ──────────────────────────────────
  const ctx: TutoCtx = { state, selection };
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    startRef.current = ctxRef.current;
    firedRef.current = false;
    step.onEnter?.({ select: onSelect });
    const el = step.anchor?.map((s) => document.querySelector(s)).find(Boolean);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Volontairement dépendant du seul index : rejouer cet effet à chaque
    // changement d'état réinitialiserait le point de comparaison, et
    // aucune consigne ne serait jamais validée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // ── Validation d'une consigne ──────────────────────────────
  // Sans verrou, chaque nouveau rendu relancerait le délai : la carte
  // resterait bloquée sur une consigne pourtant remplie.
  useEffect(() => {
    if (!step.done || firedRef.current) return;
    if (!step.done(ctx, startRef.current)) return;
    firedRef.current = true;
    // Un temps de latence court : le joueur voit le résultat de son geste
    // (le message, le PA consommé) avant que la carte ne change.
    timerRef.current = window.setTimeout(next, 500);
  });
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // ── Suivi des rectangles ───────────────────────────────────
  // Les éléments bougent (l'inspecteur change de hauteur, la fenêtre est
  // redimensionnée, le plateau se recadre). On relit à cadence basse
  // plutôt que d'essayer de deviner les moments où ça bouge.
  useLayoutEffect(() => {
    const measure = () => {
      const found = (step.anchor ?? [])
        .map((s) => document.querySelector(s))
        .filter((e): e is Element => !!e)
        .map(rectOf);
      setHoles((prev) => (sameRects(prev, found) ? prev : found));
    };
    // Sans ancre, aucun rectangle ne change au redimensionnement : il
    // faut quand même recalculer la position de la carte centrée.
    const onResize = () => {
      measure();
      forceRender((n) => n + 1);
    };
    measure();
    const id = window.setInterval(measure, 150);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', measure, true);
    };
  }, [index, step.anchor]);

  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardH) > 2) setCardH(h);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if ((e.key === 'Enter' || e.key === ' ') && !step.done) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, next, step.done]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = holes[0];

  // Placement : la carte cherche une bande libre autour de l'élément
  // éclairé — dessous, dessus, à droite, à gauche. Recouvrir ce qu'on
  // est en train de montrer est le dernier recours, et il faut que le
  // plateau (qui occupe presque tout l'écran) n'y tombe jamais : elle
  // se rétrécit plutôt que de venir se poser sur les personnages.
  let w = Math.min(CARD_W, vw - 24);
  let left: number;
  let top: number;

  if (!r) {
    left = (vw - w) / 2;
    top = Math.max(24, (vh - cardH) / 2);
  } else {
    const bandBelow = vh - (r.y + r.h) - GAP - MARGIN;
    const bandAbove = r.y - GAP - MARGIN;
    const bandRight = vw - (r.x + r.w) - GAP - MARGIN;
    const bandLeft = r.x - GAP - MARGIN;

    if (bandBelow >= cardH) {
      top = r.y + r.h + GAP;
      left = r.x + r.w / 2 - w / 2;
    } else if (bandAbove >= cardH) {
      top = r.y - cardH - GAP;
      left = r.x + r.w / 2 - w / 2;
    } else if (bandRight >= MIN_W || bandLeft >= MIN_W) {
      const toRight = bandRight >= bandLeft;
      w = Math.min(w, (toRight ? bandRight : bandLeft));
      left = toRight ? r.x + r.w + GAP : r.x - w - GAP;
      top = Math.max(MARGIN, Math.min(vh - cardH - MARGIN, r.y));
    } else {
      left = r.x + r.w / 2 - w / 2;
      top = Math.max(MARGIN, Math.min(vh - cardH - MARGIN, r.y + GAP));
    }
  }

  // Dernier garde-fou : quoi qu'il arrive, la carte reste entièrement à
  // l'écran. Une carte de tuto à moitié sortie du cadre est pire que
  // pas de tuto du tout. Si elle est plus haute que la fenêtre, elle
  // défile (voir .tuto__card en CSS).
  const fits = cardH + 2 * MARGIN <= vh;
  const cardStyle: React.CSSProperties = {
    left: Math.max(MARGIN, Math.min(vw - w - MARGIN, left)),
    top: fits ? Math.min(Math.max(MARGIN, top), vh - cardH - MARGIN) : MARGIN,
    width: w,
  };

  return (
    <div className="tuto" role="dialog" aria-label="Tutoriel">
      <svg className="tuto__scrim" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`}>
        <path d={scrimPath(vw, vh, holes)} fillRule="evenodd" className="tuto__veil" />
        {holes.map((r, i) => (
          <rect
            key={i}
            x={r.x + 0.5}
            y={r.y + 0.5}
            width={Math.max(0, r.w - 1)}
            height={Math.max(0, r.h - 1)}
            className="tuto__ring"
          />
        ))}
      </svg>

      <div className="tuto__card" style={cardStyle} ref={cardRef}>
        <div className="tuto__tag">{step.tag}</div>
        <h2 className="tuto__title">{step.title}</h2>
        {step.body.map((p, i) => (
          <p key={i} className="tuto__p">
            {p}
          </p>
        ))}

        {step.task && (
          <p className="tuto__task">
            <span className="tuto__taskmark">À faire</span> {step.task}
          </p>
        )}

        <div className="tuto__foot">
          <span className="tuto__count">
            {String(index + 1).padStart(2, '0')} / {String(TUTORIAL.length).padStart(2, '0')}
          </span>
          <div className="tuto__btns">
            {index > 0 && (
              <button className="btn btn--small" onClick={() => setIndex((i) => i - 1)}>
                Retour
              </button>
            )}
            {step.done ? (
              <button className="btn btn--small btn--ghostline" onClick={next}>
                Passer cette étape
              </button>
            ) : (
              <button className="btn btn--small btn--primary" onClick={next}>
                {last ? 'Au travail' : 'Suivant'}
              </button>
            )}
          </div>
        </div>

        {!last && (
          <button className="tuto__quit" onClick={finish}>
            Fermer le tutoriel
          </button>
        )}
      </div>
    </div>
  );
}
