// ─────────────────────────────────────────────────────────────
// icones.tsx — Le jeu d'icônes. Dessiné, pas emprunté à une police.
//
// POURQUOI ON N'UTILISE PLUS D'EMOJI.
//
// Un emoji n'est pas un dessin, c'est une DEMANDE de dessin adressée au
// système d'exploitation. Le même caractère devient une vignette bombée
// et multicolore sous Windows, un aplat plat sous Android, une image 3D
// sous macOS — et un rectangle vide partout où la police ne l'a pas.
// Trois conséquences dont aucune n'est acceptable ici :
//
//  · la palette du jeu est tenue au dixième près par un audit
//    automatique, et un emoji fait entrer une dizaine de couleurs
//    saturées qu'aucun contrôle ne peut atteindre ;
//  · les tailles ne s'accordent pas — une tasse et une chaise dessinées
//    par deux mains différentes n'ont ni la même hauteur optique ni le
//    même poids de trait, donc une liste d'actions ne s'aligne jamais
//    vraiment ;
//  · rien ne réagit à l'encre. Une icône désactivée doit pâlir avec le
//    texte qu'elle accompagne ; un emoji reste vif à côté d'un libellé
//    gris.
//
// LE PARTI PRIS.
//
// Tout est tracé sur une grille de 24, au trait, en `currentColor`, avec
// une épaisseur unique. Une icône hérite donc de la couleur du texte —
// elle pâlit quand il pâlit, elle rougit dans une alerte, elle vire au
// vert dans une ligne favorable. C'est ce qui la fait appartenir à la
// page plutôt que d'y être collée.
//
// L'épaisseur unique n'est pas un détail de style : c'est ce qui donne à
// soixante-quinze dessins d'auteurs différents l'air d'une seule main.
//
// LA RÈGLE D'ARCHITECTURE EST TENUE.
//
// Le contenu (`voitures.json`, `depenses.json`, …) ne porte plus un
// glyphe mais un NOM d'icône. Les données restent ignorantes du rendu,
// et ce fichier est le seul endroit qui sait à quoi ressemble une
// « berline ». Un nom inconnu ne casse rien : il tombe sur un repère
// neutre, jamais sur une case vide.
// ─────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';

/**
 * Épaisseur du trait, en unités de la grille de 24.
 *
 * 1,7 est le résultat d'un compromis mesuré : en dessous de 1,5 les
 * icônes disparaissent à 16 px, au-dessus de 2 elles se bouchent au
 * centre — un téléphone devient un rectangle plein.
 */
const T = 1.7;

// Quelques primitives, pour que les dessins se lisent comme des phrases
// plutôt que comme des listes de coordonnées.
const P = ({ d }: { d: string }) => <path d={d} />;
const C = ({ x, y, r }: { x: number; y: number; r: number }) => <circle cx={x} cy={y} r={r} />;
const R = ({
  x,
  y,
  w,
  h,
  r = 1,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}) => <rect x={x} y={y} width={w} height={h} rx={r} />;
const L = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} />
);
/** Un point plein : le seul endroit où l'on quitte le trait. */
const Pt = ({ x, y, r = 1.1 }: { x: number; y: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
);

// ── Briques réutilisées ──────────────────────────────────────
// Une carrosserie commune à toutes les voitures : ce qui les distingue
// tient au toit et aux détails, comme sur un parking.
const roues = (
  <>
    <C x={7.5} y={16.5} r={1.9} />
    <C x={16.5} y={16.5} r={1.9} />
  </>
);

const ICONES: Record<string, ReactNode> = {
  // ── Voitures ───────────────────────────────────────────────
  scooter: (
    <>
      <C x={6} y={17} r={2.6} />
      <C x={18} y={17} r={2.6} />
      <P d="M6 17 L10 11 L16 11 L18 17" />
      <P d="M10 11 L8.5 7 L12.5 7" />
      <P d="M14 11 L20 11" />
    </>
  ),
  'citadine-vieille': (
    <>
      <P d="M3 15.5 L4.5 11 H19.5 L21 15.5" />
      <P d="M3 15.5 H21" />
      <P d="M8 11 V7.5 H15 V11" />
      {roues}
      <L x1={11.5} y1={7.5} x2={11.5} y2={11} />
    </>
  ),
  citadine: (
    <>
      <P d="M3 15.5 Q3.4 11.6 5 10.6 L8 7.6 H15 L19 10.6 Q20.7 11.6 21 15.5" />
      <P d="M3 15.5 H21" />
      <P d="M6.4 10.8 H17.6" />
      {roues}
    </>
  ),
  break: (
    <>
      <P d="M2.5 15.5 V11 L6 7.6 H19 V15.5" />
      <P d="M2.5 15.5 H21.5" />
      <P d="M5.6 11 H19" />
      <L x1={11} y1={7.6} x2={11} y2={11} />
      {roues}
    </>
  ),
  berline: (
    <>
      <P d="M2.5 15.5 Q3 11.4 5.4 10.6 L8.6 7.4 H15.4 L18.8 10.6 Q21 11.4 21.5 15.5" />
      <P d="M2.5 15.5 H21.5" />
      <P d="M6 10.8 H18" />
      <L x1={12} y1={7.4} x2={12} y2={10.8} />
      {roues}
    </>
  ),
  suv: (
    <>
      <P d="M2.5 15.2 V10.4 L6.2 6.6 H15.4 L19 10.4 H21.5 V15.2" />
      <P d="M2.5 15.2 H21.5" />
      <P d="M5.6 10.4 H19" />
      <C x={7.2} y={16.6} r={2.3} />
      <C x={16.8} y={16.6} r={2.3} />
    </>
  ),
  coupe: (
    <>
      <P d="M2.5 15.6 Q3.6 12 6.4 11.2 L11 7.8 Q15.4 7.8 17.6 11.2 Q20.8 11.8 21.5 15.6" />
      <P d="M2.5 15.6 H21.5" />
      <P d="M7.4 11.3 H17" />
      {roues}
    </>
  ),
  electrique: (
    <>
      <P d="M3 15.5 Q3.5 11.6 5.6 10.8 L8.8 7.8 H15.2 L18.4 10.8 Q20.5 11.6 21 15.5" />
      <P d="M3 15.5 H21" />
      {roues}
      <P d="M12.8 9 L10.6 12.4 H13 L11.2 15" />
    </>
  ),
  gt: (
    <>
      <P d="M2.5 15.6 Q3.4 12.2 6 11.4 L10.4 8.2 Q14.8 8.2 17.2 11.4 Q20 12 20.6 15.6" />
      <P d="M2.5 15.6 H21.5" />
      <P d="M19.4 11.6 H22.2" />
      <L x1={21} y1={11.6} x2={21} y2={13.4} />
      {roues}
    </>
  ),
  supercar: (
    <>
      <P d="M2 16 Q3.2 13.4 6.6 12.6 L10 9.6 Q14.4 9.6 16.6 12.6 Q20.6 13.2 22 16" />
      <P d="M2 16 H22" />
      <P d="M7.6 12.7 H16" />
      <P d="M18.6 12 H22" />
      <C x={7} y={16.8} r={1.7} />
      <C x={17} y={16.8} r={1.7} />
    </>
  ),
  hypercar: (
    <>
      <P d="M1.6 16.4 Q3 13.4 6.6 12.8 L9.4 10.2 Q14.6 10.2 16.4 12.8 Q21 13.2 22.4 16.4" />
      <P d="M1.6 16.4 H22.4" />
      <P d="M7.2 12.9 H15.4" />
      <P d="M17.6 11.4 H22.4" />
      <L x1={20} y1={11.4} x2={20} y2={13.2} />
      <C x={6.6} y={17.2} r={1.5} />
      <C x={17.4} y={17.2} r={1.5} />
      <Pt x={12} y={7.4} r={1} />
    </>
  ),

  // ── Meubles et logement ────────────────────────────────────
  lit: (
    <>
      <P d="M3 17.5 V9" />
      <P d="M3 12.5 H21 V17.5" />
      <P d="M3 15.5 H21" />
      <P d="M6.5 12.5 V10 H12 V12.5" />
      <C x={8.2} y={10.6} r={1.4} />
    </>
  ),
  ecran: (
    <>
      <R x={3} y={5} w={18} h={11.5} r={1.4} />
      <P d="M9 20 H15" />
      <L x1={12} y1={16.5} x2={12} y2={20} />
      <P d="M6.4 8.4 H13" />
      <P d="M6.4 11.2 H10.4" />
    </>
  ),
  cafe: (
    <>
      <P d="M4.5 9.5 H16.5 V14.5 Q16.5 18 12.6 18 H8.4 Q4.5 18 4.5 14.5 Z" />
      <P d="M16.8 10.8 H19 Q21 10.8 21 12.6 Q21 14.6 19 14.6 H16.6" />
      <P d="M8.4 6.8 Q9.4 5.6 8.4 4.4" />
      <P d="M12.4 6.8 Q13.4 5.6 12.4 4.4" />
    </>
  ),
  canape: (
    <>
      <P d="M3 16.5 V12 Q3 10 5 10 H19 Q21 10 21 12 V16.5" />
      <P d="M3 13.4 H21" />
      <P d="M5.6 10 V7.6 Q5.6 6.4 7 6.4 H17 Q18.4 6.4 18.4 7.6 V10" />
      <L x1={5.6} y1={16.5} x2={5.6} y2={18.4} />
      <L x1={18.4} y1={16.5} x2={18.4} y2={18.4} />
    </>
  ),
  sport: (
    <>
      <C x={6} y={16.5} r={3.4} />
      <C x={18} y={16.5} r={3.4} />
      <P d="M6 16.5 L10.4 9.6 H15.4" />
      <P d="M10.4 9.6 L18 16.5" />
      <P d="M9 7.2 H12.4" />
      <L x1={11} y1={7.2} x2={11} y2={9.6} />
    </>
  ),
  biblio: (
    <>
      <R x={4} y={4.5} w={4} h={15} r={0.6} />
      <R x={9} y={4.5} w={4} h={15} r={0.6} />
      <P d="M15 6 L19.4 5 L21.6 18 L17.2 19 Z" />
      <P d="M4 15.5 H8" />
      <P d="M9 15.5 H13" />
    </>
  ),
  verre: (
    <>
      <P d="M7 4.5 H17 L15.6 11.6 Q15.2 14 12 14 Q8.8 14 8.4 11.6 Z" />
      <L x1={12} y1={14} x2={12} y2={19} />
      <P d="M8.4 19.5 H15.6" />
      <P d="M7.6 8.4 H16.4" />
    </>
  ),
  projecteur: (
    <>
      <R x={2.5} y={8} w={19} h={9} r={1.4} />
      <C x={7.6} y={12.5} r={2.6} />
      <C x={16.4} y={12.5} r={1.5} />
      <P d="M5 17 V19" />
      <P d="M19 17 V19" />
    </>
  ),
  tableau: (
    <>
      <R x={3} y={4.5} w={18} h={15} r={1.2} />
      <P d="M3 15.5 L8.6 10.2 L12.6 14 L16 11.4 L21 15.5" />
      <C x={16.2} y={8.2} r={1.6} />
    </>
  ),
  coffre: (
    <>
      <R x={3.5} y={5} w={17} h={14} r={1.4} />
      <C x={11.5} y={12} r={4} />
      <L x1={11.5} y1={8} x2={11.5} y2={16} />
      <L x1={7.5} y1={12} x2={15.5} y2={12} />
      <P d="M18 15.5 V19.6" />
    </>
  ),
  cle: (
    <>
      <C x={7.6} y={9.4} r={4.1} />
      <P d="M10.5 12.4 L19.6 21.5" />
      <P d="M17.4 19.3 L19.4 17.3" />
      <P d="M14.8 16.7 L16.8 14.7" />
    </>
  ),

  // ── Dépenses et argent ─────────────────────────────────────
  assiette: (
    <>
      <C x={12} y={12} r={5.6} />
      <C x={12} y={12} r={2.7} />
      <P d="M2.6 3 V8 Q2.6 9.6 4.2 9.6 Q5.8 9.6 5.8 8 V3" />
      <P d="M4.2 3 V8" />
      <P d="M4.2 9.6 V21" />
      <P d="M19.8 3 Q21.4 5 21.4 8 Q21.4 10 19.8 10 V21" />
    </>
  ),
  cadeau: (
    <>
      <R x={3.5} y={9.5} w={17} h={10} r={1.2} />
      <P d="M2.5 6.5 H21.5 V9.5 H2.5 Z" />
      <L x1={12} y1={6.5} x2={12} y2={19.5} />
      <P d="M12 6.5 Q7.4 6.5 7.4 4.6 Q7.4 3 9.4 3 Q12 3 12 6.5" />
      <P d="M12 6.5 Q16.6 6.5 16.6 4.6 Q16.6 3 14.6 3 Q12 3 12 6.5" />
    </>
  ),
  billet: (
    <>
      <R x={2.5} y={6.5} w={19} h={11} r={1.2} />
      <P d="M14.2 9.6 Q10.6 8.4 9.6 12 Q10.6 15.6 14.2 14.4" />
      <P d="M7.6 11 H12" />
      <P d="M7.6 13 H12" />
    </>
  ),
  balance: (
    <>
      <L x1={12} y1={4} x2={12} y2={19.5} />
      <P d="M7.5 19.5 H16.5" />
      <P d="M4 7 H20" />
      <P d="M1.5 13 Q1.5 15.6 4 15.6 Q6.5 15.6 6.5 13 L4 7 Z" />
      <P d="M17.5 13 Q17.5 15.6 20 15.6 Q22.5 15.6 22.5 13 L20 7 Z" />
    </>
  ),
  casque: (
    <>
      <P d="M4 15 V12 Q4 4.6 12 4.6 Q20 4.6 20 12 V15" />
      <R x={2} y={13.5} w={4.4} h={6.4} r={1.6} />
      <R x={17.6} y={13.5} w={4.4} h={6.4} r={1.6} />
    </>
  ),
  detective: (
    <>
      <P d="M4 10.5 Q4 5 12 5 Q20 5 20 10.5" />
      <P d="M1.5 11 H22.5" />
      <C x={8.4} y={16} r={3} />
      <C x={16.4} y={16} r={3} />
      <P d="M11.4 16 H13.4" />
    </>
  ),
  'courbe-bas': (
    <>
      <P d="M3 5.5 V19 H21" />
      <P d="M6 8.5 L11 13.5 L14 10.5 L19.5 16" />
      <P d="M19.5 16 H15.6" />
      <L x1={19.5} y1={16} x2={19.5} y2={12.2} />
    </>
  ),
  trinquer: (
    <>
      <P d="M1.6 7.6 L8.8 5.2 L7.6 11.4 Q7.2 13.4 5.2 13 Q3.2 12.6 2.8 10.6 Z" />
      <P d="M4.4 13.2 L3 20.4" />
      <P d="M1.2 20.4 H5.6" />
      <P d="M22.4 7.6 L15.2 5.2 L16.4 11.4 Q16.8 13.4 18.8 13 Q20.8 12.6 21.2 10.6 Z" />
      <P d="M19.6 13.2 L21 20.4" />
      <P d="M18.4 20.4 H22.8" />
      <P d="M12 2 V4.8" />
      <P d="M9.4 3.2 L10.4 5.2" />
      <P d="M14.6 3.2 L13.6 5.2" />
    </>
  ),

  // ── Bureau, dossiers, communication ────────────────────────
  telephone: (
    <>
      <R x={6.5} y={2.5} w={11} h={19} r={2} />
      <P d="M10.4 5 H13.6" />
      <P d="M6.5 18 H17.5" />
      <C x={12} y={19.8} r={0.9} />
    </>
  ),
  dossier: (
    <>
      <P d="M2.5 18.5 V6 Q2.5 5 3.6 5 H9 L11 7.4 H20.4 Q21.5 7.4 21.5 8.4 V18.5 Q21.5 19.5 20.4 19.5 H3.6 Q2.5 19.5 2.5 18.5 Z" />
      <P d="M2.5 11 H21.5" />
    </>
  ),
  'dossier-onglets': (
    <>
      <R x={3} y={4} w={15} h={16} r={1.2} />
      <P d="M18 7 H21 V17 H18" />
      <P d="M6.4 8.4 H14.6" />
      <P d="M6.4 12 H14.6" />
      <P d="M6.4 15.6 H11.6" />
    </>
  ),
  'presse-papier': (
    <>
      <P d="M8 4.5 H6 Q4.5 4.5 4.5 6 V19 Q4.5 20.5 6 20.5 H18 Q19.5 20.5 19.5 19 V6 Q19.5 4.5 18 4.5 H16" />
      <R x={8} y={2.5} w={8} h={4} r={1} />
      <P d="M8 11.5 H16" />
      <P d="M8 15 H13.4" />
    </>
  ),
  'boite-fiches': (
    <>
      <P d="M2.5 9.5 H21.5 V18.5 Q21.5 19.8 20.2 19.8 H3.8 Q2.5 19.8 2.5 18.5 Z" />
      <P d="M5.5 9.5 V6.4 Q5.5 5.2 6.8 5.2 H17.2 Q18.5 5.2 18.5 6.4 V9.5" />
      <P d="M9.6 9.5 V12 H14.4 V9.5" />
    </>
  ),
  bulle: (
    <>
      <P d="M3 6.6 Q3 5 4.8 5 H19.2 Q21 5 21 6.6 V14.4 Q21 16 19.2 16 H9.4 L5 19.8 V16 H4.8 Q3 16 3 14.4 Z" />
      <Pt x={8.6} y={10.5} r={0.95} />
      <Pt x={12} y={10.5} r={0.95} />
      <Pt x={15.4} y={10.5} r={0.95} />
    </>
  ),
  megaphone: (
    <>
      <P d="M3 10 L14.5 5.2 V18.8 L3 14 Z" />
      <P d="M14.5 8 Q19.5 9.4 19.5 12 Q19.5 14.6 14.5 16" />
      <P d="M5.6 14.9 V19.6 Q5.6 21 7 21 Q8.4 21 8.4 19.6 V16" />
    </>
  ),
  enveloppe: (
    <>
      <R x={2.5} y={5.5} w={19} h={13} r={1.4} />
      <P d="M2.5 7 L12 13.4 L21.5 7" />
    </>
  ),
  imprimante: (
    <>
      <P d="M6.5 8.5 V3.6 H17.5 V8.5" />
      <P d="M3 8.5 H21 V15.5 H17.5 V20.4 H6.5 V15.5 H3 Z" />
      <P d="M9.4 17.6 H14.6" />
      <Pt x={18} y={11.4} r={1} />
    </>
  ),
  tableur: (
    <>
      <R x={3} y={4.5} w={18} h={15} r={1.2} />
      <P d="M3 9 H21" />
      <P d="M3 14.2 H21" />
      <L x1={9} y1={9} x2={9} y2={19.5} />
      <L x1={15} y1={9} x2={15} y2={19.5} />
    </>
  ),
  plume: (
    <>
      <P d="M3.5 20.5 Q7 12 12.5 7.6 Q17 4 20.5 3.5 Q20 8 17 12 Q13 16.6 6.6 18" />
      <P d="M3.5 20.5 L8.4 15.6" />
      <P d="M12.5 7.6 Q13 12 10 15" />
    </>
  ),
  mallette: (
    <>
      <R x={2.5} y={7.5} w={19} h={12} r={1.4} />
      <P d="M8.5 7.5 V5.4 Q8.5 4.2 9.8 4.2 H14.2 Q15.5 4.2 15.5 5.4 V7.5" />
      <P d="M2.5 12.5 H21.5" />
      <P d="M10.4 12.5 V15 H13.6 V12.5" />
    </>
  ),

  // ── Intrigue ───────────────────────────────────────────────
  loupe: (
    <>
      <C x={10.4} y={10.4} r={6.1} />
      <P d="M14.8 14.8 L20.8 20.8" />
      <P d="M7.6 8.6 Q8.6 6.8 10.8 6.8" />
    </>
  ),
  oeil: (
    <>
      <P d="M1.8 12 Q6 5.6 12 5.6 Q18 5.6 22.2 12 Q18 18.4 12 18.4 Q6 18.4 1.8 12 Z" />
      <C x={12} y={12} r={3.1} />
      <Pt x={12} y={12} r={1.1} />
    </>
  ),
  cible: (
    <>
      <C x={12} y={12} r={8.2} />
      <C x={12} y={12} r={4.3} />
      <Pt x={12} y={12} r={1.4} />
    </>
  ),
  epees: (
    <>
      <P d="M4 3.5 L15.5 15" />
      <P d="M20 3.5 L8.5 15" />
      <P d="M3.4 17.6 L6.6 20.8" />
      <P d="M20.6 17.6 L17.4 20.8" />
      <P d="M8.5 15 L5 18.5 L3.4 17.6" />
      <P d="M15.5 15 L19 18.5 L20.6 17.6" />
    </>
  ),
  chaine: (
    <>
      <R x={2.5} y={9} w={9.5} h={6} r={3} />
      <R x={12} y={9} w={9.5} h={6} r={3} />
    </>
  ),
  bouclier: (
    <>
      <P d="M12 3 L20 5.8 V12 Q20 17.4 12 21 Q4 17.4 4 12 V5.8 Z" />
      <P d="M8.6 12 L11 14.4 L15.6 9.6" />
    </>
  ),
  marteau: (
    <>
      <P d="M3.2 6.4 L9.8 2.6 L13 8.2 L6.4 12 Z" />
      <P d="M6.6 4.4 L10.6 10.6" />
      <P d="M9 10.4 L18.6 20.6 Q19.8 21.8 21 20.6 Q22.2 19.4 21 18.2 L11.6 8.6" />
    </>
  ),
  feu: (
    <>
      <P d="M12 2.6 Q13.6 7 16.8 9.4 Q19.4 11.4 19.4 14.4 Q19.4 20.4 12 20.4 Q4.6 20.4 4.6 14.4 Q4.6 11 8 8.4 Q8.6 10.6 10 11 Q9.4 6.6 12 2.6 Z" />
    </>
  ),
  // Une colombe ne se dessine pas à 14 px : deux versions successives se
  // lisaient comme une plume, puis comme un serpent. Prévenir quelqu'un,
  // c'est sonner l'alarme — et une cloche, elle, se reconnaît partout.
  cloche: (
    <>
      <P d="M5.4 17.2 Q5.4 13.6 6.4 11 Q7.4 8.2 7.4 6.4 Q7.4 3.2 12 3.2 Q16.6 3.2 16.6 6.4 Q16.6 8.2 17.6 11 Q18.6 13.6 18.6 17.2 Z" />
      <P d="M3.6 17.2 H20.4" />
      <P d="M9.8 19.8 Q9.8 21.6 12 21.6 Q14.2 21.6 14.2 19.8" />
    </>
  ),
  chaise: (
    <>
      <P d="M7 2.8 V13.4" />
      <P d="M7 13.4 H19" />
      <P d="M7 6 H12.4" />
      <P d="M7 9.4 H12.4" />
      <P d="M8.4 13.4 V20.8" />
      <P d="M17.8 13.4 V20.8" />
      <P d="M12.4 2.8 V13.4" />
    </>
  ),
  oreille: (
    <>
      <P d="M6.6 20.4 Q5 17.4 5 12.6 Q5 3.6 12.2 3.6 Q19 3.6 19 10 Q19 14 15 15 Q12.6 15.6 12.6 18 Q12.6 20.6 10.2 20.6" />
      <P d="M9.4 10.4 Q9.4 7.6 12.2 7.6 Q14.8 7.6 14.8 10" />
    </>
  ),
  parole: (
    <>
      <P d="M3 6 Q3 4.5 4.6 4.5 H13.4 Q15 4.5 15 6 V12.4 Q15 14 13.4 14 H7.4 L4 17 V14 H4.6 Q3 14 3 12.4 Z" />
      <P d="M17.6 7.4 Q19.6 9.6 19.6 12.4 Q19.6 15.2 17.6 17.4" />
      <P d="M20.4 4.6 Q23 8 23 12.4 Q23 16.8 20.4 20.2" />
    </>
  ),
  extincteur: (
    <>
      <R x={8} y={7.5} w={8} h={13} r={2} />
      <P d="M10.4 7.5 V5 H13.6 V7.5" />
      <P d="M13.6 6 H17.6 Q19 6 19 7.4 V9" />
      <P d="M8 12 H16" />
      <P d="M4.6 9 H8" />
    </>
  ),
  cadenas: (
    <>
      <R x={4.5} y={10} w={15} h={10.5} r={1.8} />
      <P d="M8 10 V7.4 Q8 3.8 12 3.8 Q16 3.8 16 7.4 V10" />
      <Pt x={12} y={15} r={1.4} />
      <L x1={12} y1={15} x2={12} y2={17.6} />
    </>
  ),
  'cadenas-ouvert': (
    <>
      <R x={4.5} y={10} w={15} h={10.5} r={1.8} />
      <P d="M8 10 V7.4 Q8 3.8 12 3.8 Q16 3.8 16 7.4" />
      <Pt x={12} y={15} r={1.4} />
      <L x1={12} y1={15} x2={12} y2={17.6} />
    </>
  ),
  ciseaux: (
    <>
      <C x={6.4} y={17.6} r={2.8} />
      <C x={17.6} y={17.6} r={2.8} />
      <P d="M8.4 15.6 L18.6 3.6" />
      <P d="M15.6 15.6 L5.4 3.6" />
    </>
  ),
  alliance: (
    <>
      <C x={12} y={14.6} r={5.6} />
      <P d="M9 6.4 L12 3 L15 6.4 L12 9.6 Z" />
    </>
  ),

  // ── Gens, lieux, états ─────────────────────────────────────
  personne: (
    <>
      <C x={12} y={8} r={3.9} />
      <P d="M4.6 20.4 Q4.6 13.6 12 13.6 Q19.4 13.6 19.4 20.4" />
    </>
  ),
  groupe: (
    <>
      <C x={9} y={8.4} r={3.4} />
      <P d="M2.6 19.6 Q2.6 13.8 9 13.8 Q15.4 13.8 15.4 19.6" />
      <P d="M16 5.6 Q19.8 6.4 19.8 9.4 Q19.8 12.2 16.4 13" />
      <P d="M17.4 19.6 Q17.4 15.4 21.6 14.4" />
    </>
  ),
  // « Se rapproche de toi ». Une poignée de main est un enchevêtrement de
  // doigts illisible sous 20 px — le dessin précédent ressemblait à un
  // nœud papillon. Deux mouvements qui convergent vers le même point
  // disent la même chose, et se lisent à n'importe quelle taille.
  rapprochement: (
    <>
      <P d="M1.6 12 H9 M6 8.6 L9.4 12 L6 15.4" />
      <P d="M22.4 12 H15 M18 8.6 L14.6 12 L18 15.4" />
      <L x1={12} y1={5.6} x2={12} y2={18.4} />
    </>
  ),
  toilettes: (
    <>
      <C x={7} y={4.6} r={2.1} />
      <P d="M4.4 20.4 V13.6 H3 L4.6 8.4 H9.4 L11 13.6 H9.6 V20.4 Z" />
      <C x={17} y={4.6} r={2.1} />
      <P d="M13.4 14 L16 8 H18 L20.6 14 H18.6 V20.4 H15.4 V14 Z" />
    </>
  ),
  'maison-fissuree': (
    <>
      <P d="M3 11 L12 3.6 L21 11 V19.4 Q21 20.6 19.8 20.6 H4.2 Q3 20.6 3 19.4 Z" />
      <P d="M9.6 20.6 V13 L13 15 L11.4 20.6" />
      <P d="M16.4 6.4 L18.6 8.2" />
    </>
  ),
  nerfs: (
    <>
      <P d="M2 12.4 H6 L8 8 L11 17 L14 6.8 L16.6 12.4 H22" />
    </>
  ),
  attention: (
    <>
      <P d="M12 3.4 L22 20.2 H2 Z" />
      <L x1={12} y1={9.6} x2={12} y2={14.6} />
      <Pt x={12} y={17.4} r={1.1} />
    </>
  ),
  drapeau: (
    <>
      <L x1={5.5} y1={3} x2={5.5} y2={21} />
      <P d="M5.5 4.4 H19.6 L16.8 9.2 L19.6 14 H5.5" />
    </>
  ),
  losange: (
    <>
      <P d="M12 2.6 L21.4 12 L12 21.4 L2.6 12 Z" />
      <P d="M12 7.6 L16.4 12 L12 16.4 L7.6 12 Z" />
    </>
  ),
  'courbe-haut': (
    <>
      <P d="M3 5.5 V19 H21" />
      <P d="M6 15.5 L11 10.5 L14 13.5 L19.5 8" />
      <P d="M19.5 8 H15.6" />
      <L x1={19.5} y1={8} x2={19.5} y2={11.8} />
    </>
  ),
  'fleche-haut': <P d="M12 20 V4.6 M5.6 11 L12 4.6 L18.4 11" />,
  'fleche-bas': <P d="M12 4 V19.4 M5.6 13 L12 19.4 L18.4 13" />,
  'fleche-droite': <P d="M4 12 H19.4 M13 5.6 L19.4 12 L13 18.4" />,
  main: (
    <>
      <P d="M11.4 12.6 V5.4 Q11.4 3.6 13.2 3.6 Q15 3.6 15 5.4 V12" />
      <P d="M15 8.6 Q15 7 16.8 7 Q18.6 7 18.6 8.6 V13" />
      <P d="M18.6 10.4 Q18.6 9 20.2 9 Q21.8 9 21.8 10.6 V15.4 Q21.8 21 16.4 21 H13 Q9.4 21 7.8 18 L4.2 12.6 Q3.4 11 5 10.2 Q6.6 9.4 7.6 11 L9.6 13.8" />
    </>
  ),
  croix: <P d="M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4" />,
  jeton: <C x={12} y={12} r={6.6} />,
  'jeton-vide': <C x={12} y={12} r={6.6} />,
  graine: (
    <>
      <P d="M12 20.4 V11" />
      <P d="M12 11 Q4.6 11 4.6 4.6 Q12 4.6 12 11" />
      <P d="M12 13.6 Q19.4 13.6 19.4 7.6 Q12 7.6 12 13.6" />
    </>
  ),
  sourire: (
    <>
      <C x={12} y={12} r={9} />
      <P d="M7.4 13.6 Q12 18 16.6 13.6" />
      <Pt x={8.8} y={9.4} r={1.05} />
      <Pt x={15.2} y={9.4} r={1.05} />
    </>
  ),
  'main-levee': (
    <>
      <P d="M7.6 12.4 V6.4 Q7.6 4.8 9.2 4.8 Q10.8 4.8 10.8 6.4 V11" />
      <P d="M10.8 5.6 Q10.8 3.4 12.4 3.4 Q14 3.4 14 5.6 V11" />
      <P d="M14 6.6 Q14 4.8 15.6 4.8 Q17.2 4.8 17.2 6.6 V12" />
      <P d="M17.2 9 Q17.2 7.4 18.6 7.4 Q20 7.4 20 9 V15 Q20 21 14 21 H12 Q8.6 21 7.2 18 L4.4 12.6 Q3.6 11 5.2 10.2 Q6.8 9.4 7.6 11 L8.6 12.8" />
    </>
  ),

  // ── Casino et marché ───────────────────────────────────────
  'rouge-noir': (
    <>
      <R x={2.6} y={5} w={8.4} h={14} r={1.2} />
      <R x={13} y={5} w={8.4} h={14} r={1.2} />
      <Pt x={6.8} y={12} r={2.1} />
    </>
  ),
  de: (
    <>
      <R x={4} y={4} w={16} h={16} r={2.6} />
      <Pt x={8.6} y={8.6} r={1.15} />
      <Pt x={15.4} y={8.6} r={1.15} />
      <Pt x={12} y={12} r={1.15} />
      <Pt x={8.6} y={15.4} r={1.15} />
      <Pt x={15.4} y={15.4} r={1.15} />
    </>
  ),
  machine: (
    <>
      <P d="M4 20.4 V8.4 Q4 7 5.4 7 H16.6 Q18 7 18 8.4 V20.4" />
      <P d="M2.6 20.4 H19.4" />
      <P d="M6.4 10.4 H15.6 V14.4 H6.4 Z" />
      <L x1={9.4} y1={10.4} x2={9.4} y2={14.4} />
      <L x1={12.6} y1={10.4} x2={12.6} y2={14.4} />
      <P d="M18 11 H20.6 V15.6" />
      <Pt x={20.6} y={17} r={1.3} />
    </>
  ),

  // ── Repère par défaut ──────────────────────────────────────
  // Un nom inconnu doit se voir sans casser la mise en page : un carré
  // barré est immédiatement lisible comme « il manque un dessin ».
  inconnu: (
    <>
      <R x={4.5} y={4.5} w={15} h={15} r={1.2} />
      <P d="M4.5 19.5 L19.5 4.5" />
    </>
  ),
};

/**
 * La même icône, mais POSÉE DANS un dessin SVG existant.
 *
 * Sur le plateau isométrique, les intentions et la porte des toilettes
 * étaient des `<text>` contenant un emoji — donc dépendantes de la
 * police du système à l'intérieur d'une scène par ailleurs entièrement
 * vectorielle. Ici on injecte les tracés eux-mêmes dans un groupe
 * translaté et mis à l'échelle : le dessin fait partie de la scène,
 * s'exporte avec elle et suit son zoom.
 *
 * `x` et `y` désignent le CENTRE, parce que tout le reste du plateau se
 * positionne par son centre.
 */
export function IconeSvg({
  nom,
  x,
  y,
  taille = 16,
  className,
}: {
  nom: string;
  x: number;
  y: number;
  taille?: number;
  className?: string;
}) {
  const dessin = ICONES[nom] ?? ICONES.inconnu;
  const k = taille / 24;
  return (
    <g
      className={className}
      transform={`translate(${x - taille / 2},${y - taille / 2}) scale(${k})`}
      fill="none"
      stroke="currentColor"
      strokeWidth={T}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dessin}
    </g>
  );
}

/**
 * Les jetons de points d'action : pleins puis vides, sur une seule ligne.
 *
 * C'étaient des ● et des ○ répétés. Deux ennuis, tous deux visibles à
 * l'œil nu : ces deux caractères n'ont pas le même chasse dans la
 * plupart des polices, donc la rangée se déplaçait latéralement à chaque
 * action dépensée ; et leur taille optique dépendait de la police
 * installée. Des cercles tracés font une rangée qui ne bouge pas.
 */
export function Jetons({
  pleins,
  total,
  taille = 9,
}: {
  pleins: number;
  total: number;
  taille?: number;
}) {
  const n = Math.max(pleins, total);
  const pas = taille + 3;
  return (
    <svg
      className="jetons"
      viewBox={`0 0 ${n * pas} ${taille + 2}`}
      width={n * pas}
      height={taille + 2}
      aria-label={`${pleins} sur ${total}`}
      role="img"
    >
      {Array.from({ length: n }, (_, i) => (
        <circle
          key={i}
          cx={i * pas + taille / 2 + 1}
          cy={(taille + 2) / 2}
          r={taille / 2 - 0.9}
          fill={i < pleins ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={1.2}
          opacity={i < pleins ? 1 : 0.4}
        />
      ))}
    </svg>
  );
}

/** Les noms disponibles — utile aux tests et aux contrôles de contenu. */
export const NOMS_ICONES = Object.keys(ICONES);

export interface IconeProps {
  nom: string;
  /**
   * Côté du carré, en pixels. Sans elle, l'icône vaut 1 em — c'est la
   * CSS qui pose la taille, pas les attributs `width`/`height` : ceux-ci
   * résolvent `1em` différemment sur chaque axe et donnaient des icônes
   * de 14 × 12 au lieu de carrés.
   */
  taille?: number | string;
  className?: string;
  /**
   * Un libellé si l'icône porte l'information à elle seule. Sans lui,
   * elle est décorative et disparaît des lecteurs d'écran — c'est le cas
   * de loin le plus fréquent, puisqu'un texte l'accompagne presque
   * toujours.
   */
  titre?: string;
}

/**
 * Une icône du jeu.
 *
 * La classe est `picto` et non `icone` : `.icone` désignait déjà, depuis
 * l'écran du poste de travail, une icône de BUREAU — celle qu'on
 * double-clique sur un fond sombre. Les deux règles se sont percutées de
 * plein fouet, et le symptôme était joli à diagnostiquer : les
 * pictogrammes héritaient de la couleur claire prévue pour le fond du
 * moniteur, donc s'affichaient en blanc sur du papier beige. Invisibles,
 * mais parfaitement présents dans le DOM.
 *
 * La taille par défaut est `1em`, donc l'icône suit la taille du texte
 * qui l'entoure et le trait grossit avec elle. C'est volontaire : ce
 * qu'on veut constant n'est pas l'épaisseur en pixels mais le POIDS
 * relatif du dessin — une icône de 30 px avec un trait de 1,7 px aurait
 * l'air d'un fil à côté du même dessin à 14 px.
 */
export function Icone({ nom, taille, className, titre }: IconeProps) {
  const dessin = ICONES[nom] ?? ICONES.inconnu;
  return (
    <svg
      className={`picto ${className ?? ''}`}
      viewBox="0 0 24 24"
      style={taille === undefined ? undefined : { width: taille, height: taille }}
      fill="none"
      stroke="currentColor"
      strokeWidth={T}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={titre ? 'img' : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
      focusable="false"
    >
      {titre && <title>{titre}</title>}
      {dessin}
    </svg>
  );
}
