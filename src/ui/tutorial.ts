// ─────────────────────────────────────────────────────────────
// tutorial.ts — Le script d'accueil : « qu'est-ce que je fais ici ».
//
// Ce n'est pas une page d'aide. Un joueur qui ne comprend pas le jeu ne
// comprendra pas non plus un texte qui l'explique : il faut qu'il ait
// fait le geste. Chaque étape désigne un endroit précis de l'écran et,
// pour la moitié d'entre elles, ne passe à la suivante que lorsque le
// joueur a réellement fait l'action — pas quand il a cliqué « Suivant ».
//
// Le script ne connaît rien du moteur : il lit l'état comme n'importe
// quel composant, et se contente de comparer avec l'état qu'il avait au
// moment où l'étape a commencé. C'est ce qui permet de relancer le tuto
// à n'importe quel moment de la partie sans qu'il se croie déjà fini.
// ─────────────────────────────────────────────────────────────
import type { GameState } from '@state/schema';
import { startingColleagues } from '@data/content';
import type { Selection } from './iso';

export interface TutoCtx {
  state: GameState;
  selection: Selection;
}

export interface TutoApi {
  select: (s: Selection) => void;
}

export interface TutorialStep {
  id: string;
  /** Petit numéro de formulaire affiché en tête de carte. */
  tag: string;
  title: string;
  /** Paragraphes. Le premier doit tenir en une phrase. */
  body: string[];
  /**
   * Élément(s) à éclairer, en sélecteurs CSS. Plusieurs = plusieurs
   * trous dans le voile ; le premier sert d'ancre à la carte.
   * Absent = carte centrée, tout l'écran est voilé.
   */
  anchor?: string[];
  /** Consigne à exécuter. Absente = simple lecture, bouton « Suivant ». */
  task?: string;
  /** Vrai quand la consigne est remplie. `start` = contexte à l'entrée. */
  done?: (now: TutoCtx, start: TutoCtx) => boolean;
  /** Préparation de l'écran à l'entrée dans l'étape. */
  onEnter?: (api: TutoApi) => void;
}

const count = (s: GameState, key: string) => s.weeklyActionCounts[key] ?? 0;

/** Lu dans le roster : un chiffre écrit en dur mentirait au premier ajout. */
const HEADCOUNT = startingColleagues.filter((c) => c.alive).length;

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'intro',
    tag: 'Note de service 00',
    title: 'Bienvenue au troisième étage',
    body: [
      'Tu es stagiaire. Tu veux le bureau du fond, celui avec la porte.',
      `Ils sont ${HEADCOUNT} devant toi et aucun n’a l’intention de bouger. Ils ne t’attendent pas non plus : ils complotent entre eux, pendant que tu lis ceci.`,
      'Une partie, c’est une suite de semaines. Cinq actions par semaine, puis vendredi soir tout se résout d’un coup — le tien comme celui des autres.',
    ],
  },
  {
    id: 'objectif',
    tag: 'Note de service 01',
    title: 'Ce qu’on te demande',
    body: [
      'Une seule chose fait monter : la réputation.',
      'La jauge indique ce qu’il te reste avant le grade suivant. Rien d’autre ne promeut — ni les stats, ni le nombre de gens que tu as fait tomber. Ceux-là ne font que rendre la réputation plus facile à obtenir.',
    ],
    anchor: ['.objectif'],
  },
  {
    id: 'pa',
    tag: 'Note de service 02',
    title: 'Cinq points d’action',
    body: [
      'Chaque semaine tu as cinq actions. Toutes coûtent 1 PA.',
      'Refaire deux fois la même dans la semaine rapporte nettement moins la seconde fois : le jeu récompense la variété, pas le matraquage.',
      'Quand tu n’as plus de PA, il ne reste qu’à terminer la semaine.',
    ],
    anchor: ['.barre__ressources'],
  },
  {
    id: 'stats',
    tag: 'Note de service 03',
    title: 'Tes quatre chiffres',
    body: [
      'Aura : on t’écoute. Fait grimper l’opinion des autres et la portée de tes mots.',
      'Rendement : tu produis. C’est lui qui convertit une semaine de travail en réputation.',
      'Combine : tu manœuvres. Il augmente les chances de réussite de tes coups et réduit ce qu’on remarque.',
      'Nerfs : ton carburant. À zéro, c’est le burn-out — et le burn-out finit la partie.',
    ],
    anchor: ['.dock__onglets'],
  },
  {
    id: 'suspicion',
    tag: 'Note de service 04',
    title: 'Le prix des sales coups',
    body: [
      'Chaque manœuvre laisse une trace. La suspicion monte, jamais pour rien.',
      'Au rouge, un audit tombe. Sans alibi ni bouc émissaire, l’audit remonte jusqu’à toi et la partie s’arrête là.',
      'La ligne du dessous te dit en permanence si tu es couvert. Lis-la avant de comploter, pas après.',
    ],
    anchor: ['.barre__ressources'],
  },
  {
    id: 'plateau',
    tag: 'Note de service 05',
    title: 'L’étage',
    body: [
      'Voilà l’open space, vu d’en haut. Le personnage marqué du chevron doré, au premier plan, c’est toi à ton poste.',
      'Les autres sont tes collègues : chacun a ses stats, ses secrets et son avis sur toi.',
      'Molette pour zoomer, glisser pour déplacer, double-clic pour recadrer.',
    ],
    anchor: ['.iso'],
    task: 'Clique sur un collègue.',
    onEnter: (api) => api.select(null),
    done: (now) => now.selection?.kind === 'colleague',
  },
  {
    id: 'fiche',
    tag: 'Note de service 06',
    title: 'Sa fiche',
    body: [
      'Tout ce que tu sais de lui tient ici : son opinion de toi, ses chiffres, ce qu’il prépare cette semaine.',
      'Règle de la maison : aucun bouton n’est muet. Chacun affiche son coût, ses effets chiffrés et, s’il y a un jet de dés, sa probabilité — avant que tu cliques. Si tu ne comprends pas ce que fait une action, c’est qu’elle n’est pas écrite : lis les trois lignes sous son nom.',
    ],
    anchor: ['.inspector'],
  },
  {
    id: 'cafe',
    tag: 'Note de service 07',
    title: 'Se faire des amis',
    body: [
      'Un collègue qui t’apprécie te défend, te renseigne, et résiste beaucoup moins bien à ce que tu lui prépares.',
      'Le café est l’action la moins chère du jeu : elle ne coûte que du temps.',
    ],
    anchor: ['.inspector', '.iso'],
    task: 'Prends un café avec quelqu’un.',
    done: (now, start) => count(now.state, 'cafe') > count(start.state, 'cafe'),
  },
  {
    id: 'fouiner',
    tag: 'Note de service 08',
    title: 'Se faire des dossiers',
    body: [
      'Fouiner, c’est chercher ce que la personne préférerait qu’on ignore. Ça peut ne rien donner ; ça peut aussi te donner un levier.',
      'Un secret découvert s’utilise ensuite de deux façons : le chantage — il t’obéit sans le dire à personne — ou la divulgation — tout l’étage l’apprend, lui tombe, et ta suspicion monte.',
    ],
    anchor: ['.inspector', '.iso'],
    task: 'Fouine sur quelqu’un.',
    done: (now, start) => count(now.state, 'fouiner') > count(start.state, 'fouiner'),
  },
  {
    id: 'intentions',
    tag: 'Note de service 09',
    title: 'Ce que les autres fabriquent',
    body: [
      'Les bulles au-dessus des têtes sont leurs intentions de la semaine, et elles ne mentent pas.',
      'Une bulle rouge te vise : le chiffre est le nombre de semaines avant qu’elle ne te tombe dessus. Tu peux la désamorcer pendant qu’il en est encore temps.',
      'Une bulle qui vise un autre collègue est une affaire entre eux. Tu peux prévenir la victime — elle t’en sera reconnaissante — ou alimenter le coup en douce, ce qui l’enfonce sans que ton nom apparaisse.',
    ],
    anchor: ['.dock__onglets', '.rail'],
  },
  {
    id: 'complot',
    tag: 'Note de service 10',
    title: 'Comploter',
    body: [
      'Un complot ne s’exécute pas d’un clic. Tu le lances contre une cible, puis tu l’avances chaque semaine : la préparation monte, et avec elle tes chances.',
      'Le prix est annoncé d’avance : tant de suspicion si ça réussit, davantage si ça rate. Les coups les plus graves ne se débloquent qu’en montant en grade — et le pire d’entre eux exige d’avoir un bouc émissaire prêt.',
    ],
    anchor: ['.inspector'],
  },
  {
    id: 'argent',
    tag: 'Note de service 11',
    title: 'Ton salaire',
    body: [
      'Tu es payé chaque vendredi, et ton loyer part dans la foulée. Monter en grade, ce n’est pas qu’un titre : c’est un salaire.',
      'L’argent achète ce que les points d’action n’achètent pas — un café, un dîner, un avocat qui fait baisser la suspicion, un détective, et plus tard un cabinet de conseil qui trouvera qu’un poste est « redondant ».',
      'Rien ne se paie à crédit. Si la somme n’y est pas, l’action est refusée.',
    ],
    anchor: ['.barre__ressources'],
  },
  {
    id: 'marche',
    tag: 'Note de service 12',
    title: 'L’onglet privé',
    body: [
      'Clique sur ton solde : la bourse et le casino s’ouvrent. Depuis ton poste — ce qui n’est pas sans conséquence.',
      'La bourse monte lentement et immobilise ton argent. Le casino a une espérance négative, écrite sur chaque table : il ne sert pas à s’enrichir, il sert à tenter un gros coup tout de suite.',
      'Jouer depuis le bureau fait monter la suspicion, que tu gagnes ou non. Chez toi le week-end, personne ne regarde ton écran.',
    ],
    anchor: ['.barre__ressources'],
  },
  {
    id: 'romance',
    tag: 'Note de service 13',
    title: 'Ce qui ne concerne pas les RH',
    body: [
      'Sur la fiche de n’importe qui, sous les secrets : l’attachement. Ce n’est pas l’opinion. On peut plaire à quelqu’un qui vous méprise professionnellement.',
      'Tant que ça reste discret, rien de public ne bouge. Le jour où ça se sait — surpris, ou parce que tu as officialisé —, tes autres histoires s’arrêtent net, l’étage a un avis, et les RH ouvrent un dossier.',
      'Les toilettes sont la seule porte qui ferme au troisième. C’est le plus gros gain d’attachement du jeu, et le seul risque qui peut rendre une histoire publique contre ta volonté.',
    ],
    anchor: ['.inspector', '.iso'],
  },
  {
    id: 'perimetre',
    tag: 'Note de service 14',
    title: 'Les gens sous toi',
    body: [
      'À partir de Junior, des collègues d’un rang inférieur peuvent être rattachés à ton périmètre. Tu leur donnes un ordre par semaine : produire pour toi, rapporter sur quelqu’un, endosser ta suspicion, plaider ta cause, ou faire le nécessaire.',
      'Un subordonné n’obéit pas parce qu’il t’aime : il obéit parce que tu notes son évaluation. Son opinion ne décide pas s’il exécute — elle décide ce qu’il raconte ensuite.',
      'Déléguer le sale boulot, c’est le mettre dans la bouche de quelqu’un.',
    ],
    anchor: ['.inspector'],
  },
  {
    id: 'semaine',
    tag: 'Note de service 15',
    title: 'Vendredi soir',
    body: [
      'Terminer la semaine résout tout d’un coup : tes plans, leurs intentions, les opportunités que tu n’as pas saisies (elles disparaissent), la suspicion, et parfois un événement qui te demande de choisir.',
      'Le bilan du vendredi soir te dit ligne par ligne ce qui a bougé et pourquoi. C’est le document le plus important du jeu.',
    ],
    anchor: ['.btn--endweek'],
    task: 'Termine la semaine.',
    // Le passage au week-end démonte l'écran du bureau AVANT que l'effet
    // qui surveille cette consigne n'ait pu tourner. Sans la seconde
    // condition, l'accueil se réveillait chez le joueur en lui demandant
    // encore de terminer une semaine déjà terminée.
    done: (now, start) => now.state.week > start.state.week || now.state.phase === 'weekend',
  },
  {
    id: 'weekend',
    tag: 'Note de service 16',
    title: 'Le week-end',
    body: [
      'Tu viens de rentrer chez toi. Le week-end a ses propres points d’action : c’est du temps qui ne se prend pas sur la semaine.',
      'C’est le seul endroit où tu peux te reposer vraiment, fouiller les réseaux de quelqu’un, l’inviter, dîner en tête-à-tête, et acheter sans témoin.',
      'Le logement décide combien d’actions le week-end contient. Déménager, ce n’est donc pas acheter un décor : c’est acheter du temps libre.',
    ],
    anchor: ['.appart__compteurs', '.appart__col'],
  },
  {
    id: 'fin',
    tag: 'Note de service 17',
    title: 'À toi',
    body: [
      'Monte en réputation. Garde la suspicion basse. Regarde les bulles rouges avant qu’elles ne tombent. Garde des Nerfs.',
      'Le manuel complet reste accessible à tout moment par le bouton « ? », en haut à droite.',
    ],
  },
];

// ── Mémoire de l'accueil ─────────────────────────────────────
// Séparée de la sauvegarde de partie : recommencer une partie ne doit
// pas réinfliger le tuto à quelqu'un qui l'a déjà fait.
const TUTO_KEY = 'plan-de-carriere/tuto/v1';

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTO_KEY) === 'done';
  } catch {
    return true; // pas de stockage : on n'insiste pas
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTO_KEY, 'done');
    localStorage.removeItem(ETAPE_KEY);
  } catch {
    /* mode privé : tant pis */
  }
}

// ── Reprise à l'étape en cours ───────────────────────────────
// Le tuto vit dans l'écran du bureau, et le week-end est un AUTRE écran :
// passer vendredi soir démonte le composant. Sans mémoire, l'accueil
// repartait de la note 00 juste après avoir demandé de terminer la
// semaine — c'est-à-dire exactement au moment où il devient utile.
//
// L'index est mémorisé par identifiant d'étape, pas par numéro : insérer
// une note au milieu du script ne doit pas renvoyer les joueurs en cours
// au mauvais endroit.
const ETAPE_KEY = 'plan-de-carriere/tuto/etape';

export function rememberStep(id: string): void {
  try {
    localStorage.setItem(ETAPE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function resumeIndex(): number {
  try {
    const id = localStorage.getItem(ETAPE_KEY);
    const i = TUTORIAL.findIndex((s) => s.id === id);
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

export function forgetStep(): void {
  try {
    localStorage.removeItem(ETAPE_KEY);
  } catch {
    /* ignore */
  }
}
