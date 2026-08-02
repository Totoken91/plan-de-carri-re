// ─────────────────────────────────────────────────────────────
// roster.ts — L'open space est tiré au sort à chaque nouvelle partie.
//
// Le roster écrit à la main servait bien : cinq personnes calibrées, des
// secrets choisis, un rival identifié. Son défaut est qu'il ne servait
// qu'une fois — la deuxième partie était la même que la première, et
// c'est exactement ce qu'un jeu d'intrigue ne peut pas se permettre.
//
// Trois garanties, parce qu'un tirage libre produirait aussi bien un
// étage sans conflit qu'un étage ingérable :
//
//  1. LES ARCHÉTYPES SONT DISTRIBUÉS, pas tirés indépendamment. Il y a
//     toujours exactement un Carriériste — c'est lui, le rival, et le
//     moteur le cherche par archétype (`findRival`). Zéro Carriériste
//     et la moitié des événements ciblant « ton rival » n'auraient plus
//     de cible ; deux, et le jeu désignerait toujours le premier, ce qui
//     rendrait le second muet.
//
//  2. LES RANGS SONT ÉTAGÉS. Une équipe où tout le monde est Confirmé
//     ne donne rien à encadrer avant très tard ; une où tout le monde
//     est Stagiaire retire tout danger. On garde donc une pyramide :
//     un senior, deux intermédiaires, le reste en bas.
//
//  3. LES SECRETS SONT UNIQUES. Deux personnes avec « gonfle ses notes
//     de frais » se lisent comme un bug, pas comme une coïncidence.
//
// Le tirage passe par le RNG SEEDÉ du jeu : une même graine rejoue le
// même étage, ce qui rend les parties reproductibles et les simulations
// d'équilibrage comparables entre elles.
// ─────────────────────────────────────────────────────────────
import type { Colleague, Secret, Stats } from '@state/schema';
import { catalog } from '@data/content';
import { randomName } from '@data/appearance';
import secretsRaw from '@data/secrets.json';
import type { Rng } from './rng';

interface GabaritSecret {
  id: string;
  label: string;
  severity: number;
}

const GABARITS: GabaritSecret[] = secretsRaw.gabarits;

/**
 * Composition de l'étage.
 *
 * Le Carriériste en premier : c'est le rival, et il doit exister.
 * Le reste module la couleur de la partie sans jamais la casser.
 */
const COMPOSITION: string[] = [
  'carrieriste',
  'fayot',
  'veteran',
  'parano',
  'glandeur',
  'nouveau',
];

/** Rangs par position dans la pyramide, du plus haut au plus bas. */
/**
 * La pyramide de l'étage. Le premier de la liste est le CHEF.
 *
 * Il n'y en avait pas : le roster commençait à Senior, donc le fauteuil
 * de Team Lead était vide dès le premier jour et la partie se gagnait en
 * remplissant une barre jusqu'à s'y asseoir. Le banc d'essai le montrait
 * sans ambiguïté — la politique qui travaille en silence gagnait neuf
 * parties sur dix, et la victoire tombait vers la semaine 17 sans que
 * personne ait eu à être écarté.
 *
 * Quelqu'un occupe la place. C'est tout le jeu.
 */
const PYRAMIDE = ['team_lead', 'senior', 'confirme', 'confirme', 'junior', 'junior'];

const TAILLE_MIN = 5;
const TAILLE_MAX = 6;

/** Stat tirée autour d'une moyenne, bornée — jamais 0 ni 100. */
const stat = (rng: Rng, centre: number, etalement: number): number => {
  // Somme de deux tirages : une cloche grossière. Un uniforme donnerait
  // autant de 12 que de 50, et l'étage n'aurait plus de moyenne.
  const bruit = (rng.next() + rng.next() - 1) * etalement;
  return Math.max(8, Math.min(92, Math.round(centre + bruit)));
};

/**
 * Profil de stats par archétype. Ce ne sont pas des valeurs, ce sont des
 * CENTRES : deux Fayots de deux parties différentes se ressemblent sans
 * être identiques.
 */
const PROFILS: Record<string, Stats> = {
  carrieriste: { aura: 55, rendement: 58, combine: 52, nerfs: 70 },
  fayot: { aura: 42, rendement: 62, combine: 34, nerfs: 62 },
  veteran: { aura: 60, rendement: 40, combine: 58, nerfs: 55 },
  parano: { aura: 34, rendement: 50, combine: 62, nerfs: 40 },
  glandeur: { aura: 46, rendement: 26, combine: 44, nerfs: 82 },
  nouveau: { aura: 32, rendement: 44, combine: 26, nerfs: 78 },
};

/** Opinion de départ, par archétype : le ton de l'accueil. */
const ACCUEIL: Record<string, number> = {
  carrieriste: -8,
  fayot: 6,
  veteran: 12,
  parano: -12,
  glandeur: 4,
  nouveau: 10,
};

function prenomDe(nom: string): string {
  return nom.split(' ')[0] ?? nom;
}

/**
 * Génère l'open space d'une partie.
 *
 * `rng` est le générateur seedé de la partie : appelé au tout début, il
 * garantit qu'une graine donnée reproduit le même étage.
 */
export function genererRoster(rng: Rng): Colleague[] {
  const taille = rng.int(TAILLE_MIN, TAILLE_MAX);

  // Le Carriériste d'abord, puis le reste mélangé : la garantie « il y
  // en a exactement un » ne dépend donc d'aucun tirage.
  const autres = COMPOSITION.slice(1);
  for (let i = autres.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [autres[i], autres[j]] = [autres[j]!, autres[i]!];
  }
  const archetypes = ['carrieriste', ...autres].slice(0, taille);

  const dispo = [...GABARITS];
  const noms = new Set<string>();

  return archetypes.map((archetype, i) => {
    // Noms uniques : deux « Marc Deloin » sur le même étage se lisent
    // comme un bug d'affichage, pas comme une homonymie.
    let name = randomName();
    let garde = 0;
    while (noms.has(name) && garde++ < 40) name = randomName();
    noms.add(name);

    const profil = PROFILS[archetype] ?? PROFILS.nouveau!;
    const rang = PYRAMIDE[Math.min(i, PYRAMIDE.length - 1)]!;
    // Un rang élevé n'est pas décoratif : il rend la personne plus dure
    // à manœuvrer et plus intéressante à encadrer une fois qu'on l'a
    // dépassée.
    const bonusRang = catalog.ranks.find((r) => r.id === rang)?.order ?? 0;

    const secrets: Secret[] = [];
    const combien = rng.int(1, 3);
    for (let k = 0; k < combien && dispo.length > 0; k++) {
      const idx = rng.int(0, dispo.length - 1);
      const g = dispo.splice(idx, 1)[0]!;
      secrets.push({
        id: `${g.id}_${i}`,
        label: g.label.replace(/\{nom\}/g, prenomDe(name)),
        severity: Math.max(20, Math.min(95, g.severity + rng.int(-8, 8))),
        discovered: false,
      });
    }

    return {
      id: `pnj${i}`,
      name,
      archetype,
      rank: rang,
      stats: {
        aura: stat(rng, profil.aura + bonusRang * 2, 14),
        rendement: stat(rng, profil.rendement + bonusRang * 2, 14),
        combine: stat(rng, profil.combine + bonusRang * 3, 14),
        nerfs: stat(rng, profil.nerfs, 12),
      },
      opinion: Math.round((ACCUEIL[archetype] ?? 0) + rng.int(-6, 6)),
      secrets,
      alive: true,
      flags: [],
    };
  });
}
