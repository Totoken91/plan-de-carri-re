// ─────────────────────────────────────────────────────────────
// AppartIso.tsx — Chez toi, en isométrique. Un lieu, plus un formulaire.
//
// CE QUI N'ALLAIT PAS.
//
// Le week-end était une liste de boutons dans un panneau, avec une
// vignette décorative à côté qui ne servait à rien. On ne savait ni ce
// qu'une activité allait faire, ni ce qu'elle avait fait — un message
// passait quatre secondes en bas de l'écran et disparaissait. Autrement
// dit : le seul moment du jeu où l'on est chez soi ressemblait à une
// déclaration d'impôts.
//
// LE PARTI PRIS.
//
// L'appartement est une PIÈCE, dessinée avec les mêmes primitives que
// l'open space — même projection, même lumière, même trait. On clique un
// endroit, pas une ligne de liste : le lit pour dormir, l'ordinateur pour
// travailler ou jouer en bourse, le canapé pour recevoir, la table pour
// dîner.
//
// LA RÈGLE QUI REND LES MEUBLES INTÉRESSANTS.
//
// Chaque coin EXISTE toujours, même sans le meuble : on dort sur un
// matelas posé par terre, on travaille sur un carton retourné, on reçoit
// sur deux caisses. Le meuble ne débloque pas l'activité — il l'AMÉLIORE,
// et le bonus est celui que porte déjà `appart.json`. Ce qu'on achète se
// voit donc immédiatement dans la pièce, et le contraste entre le carton
// et le vrai bureau raconte la progression mieux qu'un compteur.
// ─────────────────────────────────────────────────────────────
import { iso, panelAlongX, panelAlongY, quad } from './iso';
import { IsoBox, shade } from './sprites';
import { theme as T } from '@data/board';

/** Un coin de la pièce : une activité, une place, un meuble qui l'améliore. */
export interface Coin {
  /** Identifiant de l'activité (weekend.json), ou 'poste' pour l'ordinateur. */
  id: string;
  nom: string;
  gx: number;
  gy: number;
  /** Le meuble qui améliore ce coin, s'il y en a un. */
  meuble?: string;
  /** Demi-largeur et demi-profondeur de la zone cliquable, en cases. */
  w: number;
  d: number;
}

export const COINS: Coin[] = [
  { id: 'repos', nom: 'Le lit', gx: 0.3, gy: 0.3, meuble: 'lit', w: 2.2, d: 1.5 },
  { id: 'poste', nom: 'L’ordinateur', gx: 3.4, gy: 0.3, meuble: 'bureau_perso', w: 1.9, d: 1.3 },
  { id: 'sport', nom: 'Le tapis', gx: 6.0, gy: 0.4, meuble: 'sport', w: 1.6, d: 1.4 },
  { id: 'recevoir', nom: 'Le canapé', gx: 0.4, gy: 3.4, meuble: 'canape', w: 2.4, d: 1.5 },
  { id: 'diner', nom: 'La table', gx: 3.6, gy: 3.5, meuble: 'cave', w: 1.9, d: 1.7 },
  { id: 'reseaux', nom: 'Le fauteuil', gx: 6.0, gy: 3.6, meuble: 'biblio', w: 1.6, d: 1.5 },
];

const SOL_W = 8;
const SOL_D = 5.6;
/**
 * Cadrage calculé, pas tâtonné : pour gx ∈ [0,8], gy ∈ [0,5.6] et une
 * hauteur de mur de 96, la projection donne x ∈ [−179, 256] et
 * y ∈ [−96, 218]. On ajoute une marge de 16 et on s'arrête là — un
 * cadre plus large ne montre rien de plus qu'un fond.
 */
export const APPART_VIEW_BOX = '-193 -94 462 328';

const MUR_H = 76;

// ── Meubles ──────────────────────────────────────────────────
// Chaque coin a DEUX états. Le premier n'est pas un placeholder : c'est
// le mobilier d'un studio qu'on vient d'avoir, et il doit être aussi
// soigné que l'autre — c'est lui qu'on voit pendant les dix premières
// semaines.

function Lit({ gx, gy, vrai }: { gx: number; gy: number; vrai: boolean }) {
  const bois = vrai ? T.structure.bois : T.habillage.cartonFonce;
  const H = vrai ? 8 : 0;
  return (
    <g>
      {/* Tête de lit contre le mur du fond : c'est elle qui fait lire un
          lit plutôt qu'une estrade. */}
      {vrai && <IsoBox gx={gx} gy={gy} w={2.1} d={0.14} h={34} color={bois} />}
      {vrai && (
        <>
          <IsoBox gx={gx} gy={gy + 1.3} w={0.14} d={0.14} h={12} color={bois} />
          <IsoBox gx={gx + 1.96} gy={gy + 1.3} w={0.14} d={0.14} h={12} color={bois} />
        </>
      )}
      {/* Le sommier, ou le matelas à même le sol. */}
      <IsoBox gx={gx + 0.1} gy={gy + 0.16} w={1.9} d={1.24} h={vrai ? 7 : 6} z0={H}
        color={vrai ? T.structure.tissu : shade(T.structure.tissu, 0.86)} />
      {/* Deux oreillers côté mur. */}
      <IsoBox gx={gx + 0.2} gy={gy + 0.22} w={0.76} d={0.36} h={5} z0={H + 7}
        color={T.habillage.papier} />
      <IsoBox gx={gx + 1.06} gy={gy + 0.22} w={0.76} d={0.36} h={5} z0={H + 7}
        color={T.habillage.papierOmbre} />
      {/* Couette rejetée vers le pied : un lit fait au carré est un lit
          d'hôtel, pas un lit habité. */}
      <IsoBox gx={gx + 0.16} gy={gy + 0.66} w={1.78} d={0.56} h={6} z0={H + 7}
        color={shade(T.structure.tissu, 1.12)} />
      <IsoBox gx={gx + 0.34} gy={gy + 0.98} w={1.3} d={0.34} h={4} z0={H + 9}
        color={shade(T.structure.tissu, 1.02)} />
    </g>
  );
}

function PosteMaison({ gx, gy, vrai }: { gx: number; gy: number; vrai: boolean }) {
  const plateau = vrai ? T.structure.bois : T.habillage.carton;
  const TOP = vrai ? 24 : 15;
  return (
    <g>
      {vrai ? (
        <>
          <IsoBox gx={gx} gy={gy + 0.06} w={0.1} d={0.8} h={TOP - 3} color={T.structure.metal} />
          <IsoBox gx={gx + 1.5} gy={gy + 0.06} w={0.1} d={0.8} h={TOP - 3} color={T.structure.metal} />
        </>
      ) : (
        /* Deux cartons empilés : c'est le bureau de tout le monde à
           vingt-trois ans, et personne n'a besoin qu'on l'explique. */
        <IsoBox gx={gx + 0.1} gy={gy + 0.08} w={1.3} d={0.8} h={TOP} color={T.habillage.cartonFonce} />
      )}
      <IsoBox gx={gx} gy={gy} w={1.6} d={0.94} h={3.4} z0={TOP} color={plateau} />
      {/* Écran + clavier, dos tourné à la caméra comme au bureau. */}
      <IsoBox gx={gx + 0.66} gy={gy + 0.7} w={0.12} d={0.12} h={9} z0={TOP + 3} color={T.structure.ecranPied} />
      <IsoBox gx={gx + 0.34} gy={gy + 0.66} w={0.78} d={0.08} h={vrai ? 17 : 12} z0={TOP + 11}
        color={T.structure.ecranDos} />
      <polygon
        points={quad(gx + 0.34, gy + 0.66, 0.78, 0.08, TOP + 11 + (vrai ? 17 : 12))}
        fill={T.structure.metalClair}
      />
      <ellipse
        {...(() => { const p = iso(gx + 0.72, gy + 0.42, TOP + 14); return { cx: p.x, cy: p.y }; })()}
        rx="17" ry="6" fill="url(#screenPool)" className="iso-screen-pool"
      />
      <polygon points={quad(gx + 0.34, gy + 0.18, 0.72, 0.24, TOP + 3.6)} fill={T.structure.ecranArete} />
      {vrai && (
        <IsoBox gx={gx + 1.2} gy={gy + 0.16} w={0.22} d={0.22} h={6} z0={TOP + 3}
          color={T.personnages.tasse} />
      )}
    </g>
  );
}

function Tapis({ gx, gy, vrai }: { gx: number; gy: number; vrai: boolean }) {
  return (
    <g>
      <polygon points={quad(gx, gy, 1.5, 1.2, 0.6)} fill={vrai ? Object.values(T.sol.moquettes)[0] ?? T.sol.dalle : T.ombre.creux} />
      {vrai ? (
        <>
          {/* Haltères : deux disques et une barre. */}
          <IsoBox gx={gx + 0.2} gy={gy + 0.3} w={0.7} d={0.12} h={4} z0={1} color={T.structure.metalFonce} />
          <IsoBox gx={gx + 0.12} gy={gy + 0.22} w={0.16} d={0.28} h={9} z0={1} color={T.structure.ecranDos} />
          <IsoBox gx={gx + 0.82} gy={gy + 0.22} w={0.16} d={0.28} h={9} z0={1} color={T.structure.ecranDos} />
          <IsoBox gx={gx + 0.55} gy={gy + 0.72} w={0.5} d={0.4} h={12} z0={1} color={T.habillage.vegetal} />
        </>
      ) : (
        /* Un tapis roulé dans un coin : l'intention y est, la pratique
           moins. */
        <IsoBox gx={gx + 0.2} gy={gy + 0.3} w={1.0} d={0.3} h={7} z0={1} color={T.structure.tissu} />
      )}
    </g>
  );
}

function CanapeMaison({ gx, gy, vrai }: { gx: number; gy: number; vrai: boolean }) {
  if (!vrai) {
    return (
      <g>
        {/* Deux caisses et un plaid. On reçoit quand même. */}
        <IsoBox gx={gx} gy={gy + 0.2} w={0.8} d={0.8} h={16} color={T.habillage.cartonFonce} />
        <IsoBox gx={gx + 0.9} gy={gy + 0.2} w={0.8} d={0.8} h={16} color={T.habillage.carton} />
        <IsoBox gx={gx - 0.05} gy={gy + 0.15} w={1.8} d={0.9} h={3} z0={16}
          color={shade(T.structure.tissu, 1.05)} />
      </g>
    );
  }
  return (
    <g>
      <IsoBox gx={gx} gy={gy + 0.9} w={2.0} d={0.26} h={26} color={shade(T.structure.tissu, 0.86)} />
      <IsoBox gx={gx} gy={gy + 0.1} w={2.0} d={0.86} h={13} color={T.structure.tissu} />
      <IsoBox gx={gx + 0.06} gy={gy + 0.16} w={0.88} d={0.74} h={4} z0={13}
        color={shade(T.structure.tissu, 1.12)} />
      <IsoBox gx={gx + 1.02} gy={gy + 0.16} w={0.88} d={0.74} h={4} z0={13}
        color={shade(T.structure.tissu, 1.12)} />
      <IsoBox gx={gx + 0.4} gy={gy + 0.28} w={0.42} d={0.4} h={7} z0={17}
        color={T.habillage.postIt} />
    </g>
  );
}

function TableMaison({ gx, gy, vrai }: { gx: number; gy: number; vrai: boolean }) {
  const TOP = vrai ? 25 : 13;
  return (
    <g>
      {vrai
        ? [0, 1, 2, 3].map((i) => (
            <IsoBox
              key={i}
              gx={gx + 0.12 + (i % 2) * 1.16}
              gy={gy + 0.12 + Math.floor(i / 2) * 0.96}
              w={0.12} d={0.12} h={TOP - 3}
              color={T.structure.boisFonce}
            />
          ))
        : <IsoBox gx={gx + 0.2} gy={gy + 0.2} w={1.1} d={0.9} h={TOP} color={T.habillage.cartonFonce} />}
      <IsoBox gx={gx} gy={gy} w={1.5} d={1.2} h={3.2} z0={TOP} color={vrai ? T.structure.bois : T.habillage.carton} />
      {/* Deux assiettes et une bouteille : c'est ce qui dit « à deux ». */}
      <ellipse {...(() => { const p = iso(gx + 0.45, gy + 0.4, TOP + 3.4); return { cx: p.x, cy: p.y }; })()}
        rx="6" ry="3" fill={T.habillage.papier} />
      <ellipse {...(() => { const p = iso(gx + 1.05, gy + 0.8, TOP + 3.4); return { cx: p.x, cy: p.y }; })()}
        rx="6" ry="3" fill={T.habillage.papier} />
      <IsoBox gx={gx + 0.66} gy={gy + 0.52} w={0.16} d={0.16} h={11} z0={TOP + 3}
        color={vrai ? T.habillage.vegetal : T.structure.ecranArete} />
      {vrai && (
        <IsoBox gx={gx + 0.66} gy={gy + 0.52} w={0.08} d={0.08} h={4} z0={TOP + 14}
          color={T.habillage.vegetalClair} />
      )}
    </g>
  );
}

function FauteuilMaison({ gx, gy, vrai }: { gx: number; gy: number; vrai: boolean }) {
  return (
    <g>
      {vrai && (
        /* La bibliothèque : c'est elle qui améliore les recherches. */
        <>
          <IsoBox gx={gx + 1.0} gy={gy - 0.15} w={0.4} d={1.5} h={54} color={T.structure.boisFonce} />
          {[10, 24, 38].map((z) => (
            <g key={z}>
              <polygon points={quad(gx + 1.03, gy - 0.1, 0.34, 1.4, z)} fill={shade(T.structure.boisFonce, 0.7)} />
              {[0.05, 0.5, 0.9].map((o, i) => (
                <IsoBox key={o} gx={gx + 1.06} gy={gy - 0.05 + o} w={0.28} d={0.34 - i * 0.05} h={10}
                  z0={z} color={T.habillage.casiers[(i + z) % T.habillage.casiers.length]!} />
              ))}
            </g>
          ))}
        </>
      )}
      <IsoBox gx={gx} gy={gy + 0.72} w={0.92} d={0.22} h={22} color={shade(T.structure.tissu, 0.8)} />
      <IsoBox gx={gx} gy={gy + 0.06} w={0.92} d={0.7} h={12} color={vrai ? T.structure.tissu : T.habillage.cartonFonce} />
      <IsoBox gx={gx + 0.06} gy={gy + 0.12} w={0.8} d={0.58} h={4} z0={12}
        color={shade(T.structure.tissu, 1.1)} />
    </g>
  );
}

/**
 * Ce qui traîne. Aucun de ces objets ne fait quoi que ce soit — et c'est
 * exactement pour ça qu'ils sont là. Une pièce dont tout se clique est un
 * menu déguisé ; ce sont les choses inutiles qui la rendent habitée.
 *
 * Chacun porte sa case, parce qu'il est trié avec les meubles : peindre
 * le fouillis en dernier posait l'étendoir sur le fauteuil.
 */
const FOUILLIS: Array<{ gx: number; gy: number; noeud: JSX.Element }> = [
  {
    gx: 2.9,
    gy: 2.15,
    noeud: (
      <>
        <IsoBox gx={2.9} gy={2.15} w={0.72} d={0.66} h={13} color={T.habillage.carton} />
        <IsoBox gx={2.96} gy={2.22} w={0.6} d={0.56} h={11} z0={13} color={T.habillage.cartonFonce} />
      </>
    ),
  },
  {
    gx: 0.5,
    gy: 2.3,
    noeud: (
      <>
        <IsoBox gx={0.5} gy={2.2} w={0.34} d={0.16} h={4} color={T.structure.tissuFonce} />
        <IsoBox gx={0.5} gy={2.45} w={0.34} d={0.16} h={4} color={T.structure.tissuFonce} />
      </>
    ),
  },
  {
    gx: 6.5,
    gy: 2.15,
    noeud: (
      <>
        <IsoBox gx={6.5} gy={2.15} w={0.08} d={0.9} h={26} color={T.structure.metalClair} />
        <IsoBox gx={7.1} gy={2.15} w={0.08} d={0.9} h={26} color={T.structure.metalClair} />
        {[9, 15, 21].map((z) => (
          <polygon key={z} points={panelAlongX(6.5, 7.18, 2.3, z, z + 0.8)} fill={T.structure.metal} />
        ))}
        <polygon points={panelAlongX(6.56, 6.94, 2.25, 14, 25)} fill={T.habillage.papier} />
        <polygon points={panelAlongX(6.99, 7.16, 2.25, 15, 24)} fill={T.structure.tissu} />
      </>
    ),
  },
  {
    gx: 7.5,
    gy: 2.6,
    noeud: (
      <>
        <IsoBox gx={7.5} gy={2.6} w={0.4} d={0.4} h={8} color={T.habillage.terre} />
        {(() => {
          const p = iso(7.7, 2.8, 10);
          return (
            <>
              <ellipse cx={p.x} cy={p.y - 6} rx="9" ry="7" fill={T.habillage.vegetal} />
              <ellipse cx={p.x - 3} cy={p.y - 11} rx="5.5" ry="4.5" fill={T.habillage.vegetalClair} />
            </>
          );
        })()}
      </>
    ),
  },
];

const MOBILIER: Record<string, (p: { gx: number; gy: number; vrai: boolean }) => JSX.Element> = {
  repos: Lit,
  poste: PosteMaison,
  sport: Tapis,
  recevoir: CanapeMaison,
  diner: TableMaison,
  reseaux: FauteuilMaison,
};

// ── La pièce ─────────────────────────────────────────────────
export function AppartIso({
  meubles,
  selection,
  onSelect,
  enfant,
}: {
  /** Les meubles possédés, par identifiant. */
  meubles: string[];
  selection: string | null;
  onSelect: (id: string) => void;
  /** Le personnage, posé par l'appelant (il connaît son apparence). */
  enfant?: React.ReactNode;
}) {
  // Ordre du peintre : du fond vers l'avant. Comme sur le plateau, c'est
  // la somme des coordonnées qui donne la profondeur.
  const ordre = [...COINS].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));

  return (
    <svg className="appartiso" viewBox={APPART_VIEW_BOX} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="screenPool">
          <stop offset="0%" stopColor={T.degrades.ecranNappe[0]} />
          <stop offset="100%" stopColor={T.degrades.ecranNappe[1]} />
        </radialGradient>
        <linearGradient id="baieAppart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={T.degrades.baie[0]} />
          <stop offset="0.6" stopColor={T.degrades.baie[1]} />
          <stop offset="1" stopColor={T.degrades.baie[2]} />
        </linearGradient>
      </defs>

      {/* Murs : deux pans, celui du fond percé d'une fenêtre. C'est le
          seul rappel qu'il existe un dehors, et il vaut mieux qu'un
          cadre vide. */}
      <polygon
        points={`${iso(0, 0, MUR_H).x},${iso(0, 0, MUR_H).y} ${iso(SOL_W, 0, MUR_H).x},${iso(SOL_W, 0, MUR_H).y} ${iso(SOL_W, 0).x},${iso(SOL_W, 0).y} ${iso(0, 0).x},${iso(0, 0).y}`}
        fill={T.mur.fond}
      />
      <polygon
        points={`${iso(0, 0, MUR_H).x},${iso(0, 0, MUR_H).y} ${iso(0, SOL_D, MUR_H).x},${iso(0, SOL_D, MUR_H).y} ${iso(0, SOL_D).x},${iso(0, SOL_D).y} ${iso(0, 0).x},${iso(0, 0).y}`}
        fill={T.mur.gauche}
      />
      <polygon
        points={`${iso(3.2, 0, 66).x},${iso(3.2, 0, 66).y} ${iso(6.6, 0, 66).x},${iso(6.6, 0, 66).y} ${iso(6.6, 0, 30).x},${iso(6.6, 0, 30).y} ${iso(3.2, 0, 30).x},${iso(3.2, 0, 30).y}`}
        fill="url(#baieAppart)"
      />
      <polygon
        points={`${iso(4.9, 0, 66).x},${iso(4.9, 0, 66).y} ${iso(4.9, 0, 30).x},${iso(4.9, 0, 30).y}`}
        stroke={T.structure.metalClair} strokeWidth="2"
      />

      {/* Plinthes : deux traits de rien du tout, mais sans eux le mur
          flotte au-dessus du sol et la pièce n'a pas de coin. */}
      <polygon points={panelAlongX(0, SOL_W, 0, 0, 7)} fill={T.mur.socle} />
      <polygon points={panelAlongY(0, SOL_D, 0, 0, 7)} fill={T.mur.socleGauche} />

      {/* Une porte sur le mur de gauche : une pièce sans issue se lit
          comme un décor de théâtre. */}
      <polygon points={panelAlongY(2.0, 3.2, 0, 0, 62)} fill={T.structure.bois} />
      <polygon points={panelAlongY(2.12, 3.08, 0.02, 3, 58)} fill={shade(T.structure.bois, 1.06)} />
      {(() => { const p = iso(0.02, 2.28, 30); return <circle cx={p.x} cy={p.y} r="2" fill={T.structure.metalClair} />; })()}

      {/* Affiches : ce que quelqu'un a scotché sur un mur qui n'est pas
          à lui. Volontairement de travers. */}
      <polygon points={panelAlongX(1.1, 2.4, 0, 34, 62)} fill={T.habillage.papierOmbre} />
      <polygon points={panelAlongX(1.16, 2.34, 0.02, 37, 59)} fill={Object.values(T.sol.moquettes)[1] ?? T.habillage.papier} />
      <polygon points={panelAlongX(6.9, 7.7, 0, 38, 58)} fill={T.habillage.papier} />

      {/* Radiateur sous la fenêtre : le meuble le plus universel du
          logement locatif. */}
      <polygon points={panelAlongX(4.2, 5.8, 0.06, 6, 24)} fill={T.structure.metalClair} />
      {[0, 1, 2, 3, 4].map((i) => (
        <polygon key={i} points={panelAlongX(4.28 + i * 0.31, 4.44 + i * 0.31, 0.07, 7, 23)}
          fill={T.structure.metal} />
      ))}

      {/* Sol */}
      <polygon points={quad(0, 0, SOL_W, SOL_D)} fill={T.sol.dalle} />
      {/* Un tapis : c'est lui qui crée le « coin salon » et qui empêche
          la pièce d'être un couloir. */}
      <polygon points={quad(0.2, 2.9, 5.4, 2.5, 0.4)} fill={Object.values(T.sol.moquettes)[5] ?? T.sol.dalle} />
      {Array.from({ length: SOL_W + 1 }, (_, i) => (
        <line key={`x${i}`} {...(() => { const a = iso(i, 0); const b = iso(i, SOL_D); return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; })()}
          className="iso-grid-line" />
      ))}
      {Array.from({ length: Math.round(SOL_D) + 1 }, (_, i) => (
        <line key={`y${i}`} {...(() => { const a = iso(0, i); const b = iso(SOL_W, i); return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; })()}
          className="iso-grid-line" />
      ))}

      {/* Coins ET fouillis dans le MÊME tri de profondeur.
          Peindre le fouillis après les coins le faisait passer devant
          des meubles situés bien plus près de la caméra : un étendoir
          posé sur un fauteuil. La règle du plateau vaut ici aussi — ce
          qui est devant se peint en dernier, quelle que soit sa nature. */}
      {[
        ...ordre.map((c) => ({
          cle: c.id,
          profondeur: c.gx + c.gy,
          noeud: (() => {
            const Meuble = MOBILIER[c.id]!;
            const vrai = !!c.meuble && meubles.includes(c.meuble);
            const actif = selection === c.id;
            return (
              <g className={`coin ${actif ? 'is-on' : ''}`}>
                {actif && (
                  <polygon
                    points={quad(c.gx - 0.15, c.gy - 0.15, c.w + 0.3, c.d + 0.3, 0.8)}
                    className="coin__halo"
                  />
                )}
                <Meuble gx={c.gx} gy={c.gy} vrai={vrai} />
                <polygon
                  points={quad(c.gx - 0.15, c.gy - 0.15, c.w + 0.3, c.d + 0.3, 0)}
                  className="coin__hit"
                  onClick={() => onSelect(c.id)}
                />
              </g>
            );
          })(),
        })),
        ...FOUILLIS.map((f, i) => ({ cle: `f${i}`, profondeur: f.gx + f.gy, noeud: f.noeud })),
      ]
        .sort((a, b) => a.profondeur - b.profondeur)
        .map((x) => <g key={x.cle}>{x.noeud}</g>)}

      {/* Fouillis de colocation, au premier plan : cartons jamais
          défaits, chaussures, étendoir. C'est ce désordre qui fait la
          différence entre « un logement » et « une image de logement ».
          Il est peint APRÈS les coins pour passer devant eux. */}
      {/* Les étiquettes en DERNIER, au-dessus de tout : elles nomment un
          endroit, elles ne font pas partie du décor. */}
      {COINS.map((c) => {
        const p = iso(c.gx + c.w / 2, c.gy + c.d + 0.1);
        return (
          <text
            key={`n-${c.id}`}
            x={p.x}
            y={p.y + 12}
            textAnchor="middle"
            className={`coin__nom ${selection === c.id ? 'is-on' : ''}`}
          >
            {c.nom}
          </text>
        );
      })}

      {enfant}
    </svg>
  );
}
