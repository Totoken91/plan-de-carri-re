// ─────────────────────────────────────────────────────────────
// tutorial.ts — L'accueil, réécrit : des leçons, plus une file d'attente.
//
// CE QUI N'ALLAIT PAS.
//
// C'était dix-huit notes de service à la suite, servies dès la première
// minute. Trois conséquences, toutes constatées en jouant :
//
//  · on lisait dix-huit fenêtres avant d'avoir joué un tour, donc on
//    n'en retenait rien — la moitié parlait de systèmes qu'on ne
//    verrait pas avant la dixième semaine ;
//  · le script étant une LISTE, il fallait le reprendre exactement où on
//    l'avait laissé. Passer au week-end démonte l'écran du bureau : on
//    rentrait chez soi sans accueil, on revenait au bureau et il avait
//    disparu ;
//  · les étapes visaient des éléments d'interface par sélecteur. Quand
//    l'appartement a été refait, deux étapes pointaient dans le vide et
//    ne s'affichaient plus du tout.
//
// LE PARTI PRIS.
//
// Une leçon n'a plus de RANG, elle a une CONDITION. Elle ne s'affiche
// que lorsque la situation la rend utile : la première menace explique
// les intentions, le premier vendredi explique le bilan, la première
// fois qu'on a la réputation sans avoir la place explique l'échelle.
// Une seule à la fois, jamais deux.
//
// Il n'y a donc plus rien à « reprendre » : à chaque instant on demande
// à l'état quelle leçon mérite d'être montrée. Changer d'écran, recharger
// la page, reprendre une sauvegarde — la question se repose et la réponse
// est juste. Les leçons déjà vues sont mémorisées par identifiant, donc
// ajouter une leçon au milieu ne casse rien.
//
// Chaque texte tient en deux phrases. Si une leçon a besoin de trois
// paragraphes, c'est que la règle est mal fichue — c'est la règle qu'il
// faut reprendre, pas le tutoriel.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { blocagePromotion } from '@engine/promotion';
import { seuilAudit } from '@engine/suspicion';
import { placesDeSubordonnes, subordonnesDe } from '@engine/subordonnes';
import type { Selection } from './iso';

export interface TutoCtx {
  state: GameState;
  selection: Selection;
  /** Où l'on se trouve : les leçons du week-end ne valent que chez soi. */
  lieu: 'bureau' | 'appart';
}

export interface TutoApi {
  select: (s: Selection) => void;
}

export interface Lecon {
  id: string;
  /** Petit numéro de formulaire affiché en tête de carte. */
  tag: string;
  title: string;
  /** Deux phrases. Trois, c'est déjà trop. */
  body: string[];
  /** Quand cette leçon devient utile. */
  quand: (c: TutoCtx) => boolean;
  /**
   * Éléments à éclairer. Un sélecteur absent de la page fait simplement
   * une carte centrée — plus jamais de leçon invisible.
   */
  anchor?: string[];
  /** Consigne à exécuter. Absente = simple lecture. */
  task?: string;
  /** Vrai quand la consigne est remplie. `start` = contexte à l'entrée. */
  done?: (now: TutoCtx, start: TutoCtx) => boolean;
  onEnter?: (api: TutoApi) => void;
  /**
   * Les petites d'abord quand plusieurs se présentent en même temps.
   * Sans cet ordre, la leçon sur l'audit pourrait passer avant celle qui
   * explique ce qu'est un point d'action.
   */
  ordre: number;
}

const count = (s: GameState, key: string) => s.weeklyActionCounts[key] ?? 0;
const auBureau = (c: TutoCtx) => c.lieu === 'bureau';

export const LECONS: Lecon[] = [
  // ── Les quatre premières minutes ────────────────────────────
  // Quatre leçons avant de jouer, pas dix-huit. Tout le reste attend
  // d'avoir une raison d'exister.
  {
    id: 'intro',
    tag: 'Note 01',
    title: 'Bienvenue au troisième étage',
    body: [
      'Tu es stagiaire. Tu veux le bureau du fond, celui avec la porte — et quelqu’un est déjà assis dedans.',
      'Une partie est une suite de semaines : cinq actions, puis vendredi soir tout se résout d’un coup, le tien comme celui des autres.',
    ],
    quand: auBureau,
    ordre: 0,
  },
  {
    id: 'objectif',
    tag: 'Note 02',
    title: 'Ce qu’on te demande',
    body: [
      'La réputation te rend éligible au grade suivant. Elle ne t’y assoit pas : il faut aussi que la place soit libre.',
      'Le reste — tes chiffres, tes appuis, les gens que tu fais tomber — sert à rendre les deux plus faciles.',
    ],
    anchor: ['.objectif'],
    quand: auBureau,
    ordre: 1,
  },
  {
    id: 'plateau',
    tag: 'Note 03',
    title: 'L’étage',
    body: [
      'Le personnage marqué du chevron doré, c’est toi. Les autres ont leurs chiffres, leurs secrets et leur avis sur toi.',
      'Molette pour zoomer, glisser pour déplacer.',
    ],
    anchor: ['.iso'],
    task: 'Clique sur un collègue.',
    onEnter: (api) => api.select(null),
    quand: auBureau,
    done: (now) => now.selection?.kind === 'colleague',
    ordre: 2,
  },
  {
    id: 'fiche',
    tag: 'Note 04',
    title: 'Sa fiche',
    body: [
      'Quatre onglets : qui il est, ce que tu peux faire de ton temps, comment le faire tomber, ce que vous êtes l’un pour l’autre.',
      'Règle de la maison : aucun bouton n’est muet. Chacun affiche son coût et ses effets chiffrés avant que tu cliques.',
    ],
    anchor: ['.tiroir'],
    task: 'Prends un café avec quelqu’un.',
    quand: (c) => auBureau(c) && c.selection?.kind === 'colleague',
    done: (now, start) => count(now.state, 'cafe') > count(start.state, 'cafe'),
    ordre: 3,
  },

  // ── Déclenchées par la situation ────────────────────────────
  {
    id: 'poste',
    tag: 'Note 05',
    title: 'Ton poste',
    body: [
      'Produire, regarder le marché, ouvrir un onglet qu’on referme vite : tout ce qui se fait devant un écran se fait devant un écran.',
      'Clique ton propre bureau, en bas du plateau, pour t’asseoir.',
    ],
    anchor: ['.iso'],
    quand: (c) => auBureau(c) && c.state.actionPointsRemaining <= 4,
    ordre: 4,
  },
  {
    id: 'menace',
    tag: 'Note 06',
    title: 'Une bulle rouge te vise',
    body: [
      'Le chiffre est le nombre de semaines avant qu’elle ne tombe. Tu peux la désamorcer tant qu’il en reste.',
      'Une bulle qui vise quelqu’un d’autre est une affaire entre eux — tu peux prévenir la victime, ou alimenter le coup en douce.',
    ],
    anchor: ['.rail', '.iso'],
    quand: (c) =>
      auBureau(c) && c.state.colleagues.some((x) => x.alive && x.intent?.tone === 'threat'),
    ordre: 5,
  },
  {
    id: 'opportunite',
    tag: 'Note 07',
    title: 'Les losanges dorés',
    body: [
      'Ce sont les occasions de la semaine. Elles disparaissent vendredi soir, saisies ou non.',
      'Elles coûtent des points d’action comme le reste, mais rapportent presque toujours plus qu’une action ordinaire.',
    ],
    anchor: ['.iso'],
    quand: (c) => auBureau(c) && c.state.opportunities.length > 0 && c.state.week >= 1,
    ordre: 6,
  },
  {
    id: 'vendredi',
    tag: 'Note 08',
    title: 'Vendredi soir',
    body: [
      'Terminer la semaine résout tout d’un coup : tes plans, leurs intentions, la paie, le loyer, et parfois un choix à faire.',
      'Le bilan te dit ligne par ligne ce qui a bougé et par la faute de qui. C’est le document le plus important du jeu.',
    ],
    anchor: ['.btn--endweek'],
    task: 'Termine la semaine.',
    quand: (c) => auBureau(c) && c.state.actionPointsRemaining === 0,
    done: (now, start) => now.state.week > start.state.week || now.lieu === 'appart',
    ordre: 7,
  },
  {
    id: 'weekend',
    tag: 'Note 09',
    title: 'Chez toi',
    body: [
      'Le week-end a ses propres actions : c’est du temps qui ne se prend pas sur la semaine.',
      'Clique un endroit de la pièce. Chaque coin fait quelque chose même sans le meuble qui va avec — le meuble ne débloque rien, il améliore.',
    ],
    anchor: ['.appartiso'],
    quand: (c) => c.lieu === 'appart',
    ordre: 8,
  },
  {
    id: 'suspicion',
    tag: 'Note 10',
    title: 'On commence à te regarder',
    body: [
      'Chaque manœuvre laisse une trace, et le seuil de l’audit descend à mesure que tu montes.',
      'Sans couverture, le premier audit est une mise à pied ; le second, pendant le sursis, est un licenciement. Bosser fait redescendre la suspicion.',
    ],
    anchor: ['.barre__ressources'],
    quand: (c) => auBureau(c) && c.state.suspicion >= seuilAudit(c.state) * 0.5,
    ordre: 9,
  },
  {
    id: 'nerfs',
    tag: 'Note 11',
    title: 'Tu tires sur la corde',
    body: [
      'Les Nerfs sont ton carburant. Au plancher deux semaines de suite, c’est le placard et la partie s’arrête.',
      'Le coin détente les fait remonter, le week-end aussi.',
    ],
    anchor: ['.rail'],
    quand: (c) => auBureau(c) && c.state.player.stats.nerfs <= 30,
    ordre: 10,
  },
  {
    id: 'siege',
    tag: 'Note 12',
    title: 'La place est prise',
    body: [
      'Tu as la réputation, mais quelqu’un occupe le poste. On monte quand un siège se libère — par un départ, ou par ce que tu en fais.',
      'Attendre marche, et c’est lent. Le panneau « Ton dossier » montre l’échelle et qui tient quoi.',
    ],
    anchor: ['.rail', '.dock__onglets'],
    quand: (c) => {
      const b = auBureau(c) ? blocagePromotion(c.state) : undefined;
      return !!b && (b.siegeManquant || !!b.concurrent);
    },
    ordre: 11,
  },
  {
    id: 'equipe',
    tag: 'Note 13',
    title: 'Des gens sous toi',
    body: [
      'Tu peux rattacher des collègues d’un rang inférieur et leur donner un ordre par semaine : produire pour toi, rapporter, endosser, plaider, ou faire le nécessaire.',
      'Un subordonné n’obéit pas parce qu’il t’aime — il obéit parce que tu notes son évaluation. Son opinion décide de ce qu’il raconte ensuite.',
    ],
    anchor: ['.dock__onglets'],
    quand: (c) =>
      auBureau(c) && placesDeSubordonnes(c.state) > 0 && subordonnesDe(c.state).length === 0,
    ordre: 12,
  },
  {
    id: 'loyer',
    tag: 'Note 14',
    title: 'Le compte ne suit plus',
    body: [
      'Vendredi, la même facture prend le loyer, le train de vie de ton grade et l’entretien de ta voiture.',
      'Deux loyers impayés de suite et tu es expulsé. Vendre des titres, revendre un meuble ou reprendre plus petit, ça se fait chez toi.',
    ],
    anchor: ['.barre__ressources'],
    quand: (c) => c.state.loyersImpayes > 0,
    ordre: 13,
  },
];

// ── Mémoire de l'accueil ─────────────────────────────────────
// Séparée de la sauvegarde de partie : recommencer ne doit pas
// réinfliger l'accueil à quelqu'un qui l'a déjà fait.
const VU_KEY = 'plan-de-carriere/tuto/vues/v2';
const FINI_KEY = 'plan-de-carriere/tuto/v1';

function lues(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VU_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function marquerLue(id: string): void {
  try {
    const s = lues();
    s.add(id);
    localStorage.setItem(VU_KEY, JSON.stringify([...s]));
    // Toutes lues = accueil terminé. On l'écrit dans la même clé qu'avant
    // pour que les parties déjà jouées restent tranquilles.
    if (LECONS.every((l) => s.has(l.id))) localStorage.setItem(FINI_KEY, 'done');
  } catch {
    /* mode privé : tant pis */
  }
}

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(FINI_KEY) === 'done';
  } catch {
    return true; // pas de stockage : on n'insiste pas
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(FINI_KEY, 'done');
    localStorage.setItem(VU_KEY, JSON.stringify(LECONS.map((l) => l.id)));
  } catch {
    /* ignore */
  }
}

export function oublierTout(): void {
  try {
    localStorage.removeItem(FINI_KEY);
    localStorage.removeItem(VU_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * La leçon à montrer maintenant, ou `undefined` s'il n'y a rien à dire.
 *
 * C'est TOUTE la logique de l'accueil : pas de curseur, pas de reprise,
 * pas d'état à sauver. On pose la question, l'état répond.
 */
export function leconCourante(c: TutoCtx): Lecon | undefined {
  const vues = lues();
  return LECONS.filter((l) => !vues.has(l.id) && l.quand(c)).sort((a, b) => a.ordre - b.ordre)[0];
}

/** Combien il reste à découvrir — pour l'indicateur de progression. */
export function resteALire(): number {
  const vues = lues();
  return LECONS.filter((l) => !vues.has(l.id)).length;
}
