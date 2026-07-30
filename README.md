# Plan de Carrière

Jeu d'intrigue narratif au tour par tour — *Crusader Kings dans un open space*.
Comédie noire corporate : tu grimpes la hiérarchie par l'alliance, la trahison et
le « départ non planifié » d'un collègue gênant. Tout passe par des menus et du texte.

> Voir `GDD_plan_de_carriere.md` pour le concept complet.

## Stack

- **Vite + TypeScript**, **React** léger pour l'UI (menus / fiches).
- Aucun backend. Sauvegarde en `localStorage`.
- RNG **seedé** et sérialisable (parties reproductibles).

## Démarrer

```bash
npm install
npm run dev        # serveur de dev
npm run build      # typecheck + build de production
npm run preview    # sert le build
```

## Principe d'architecture : moteur ≠ contenu

Règle non négociable : **le MOTEUR (code) ne connaît jamais le CONTENU par son nom.**
Le code manipule des `id` et deux structures génériques — `Condition` et `Effect`.
Le contenu (événements, archétypes, plans, rangs, collègues) vit en **JSON** dans
`src/data`. **Ajouter du contenu ne demande jamais de toucher au code.**

```
src/
  engine/      Moteur (fonctions pures/mutatives, jamais de contenu en dur)
    rng.ts         PRNG seedé mulberry32, sérialisable via un curseur
    conditions.ts  Évalue une Condition contre le GameState
    effects.ts     Applique un Effect au GameState
    actions.ts     Les 5 actions de base (Bosser, Café, Fouiner, Comploter, Glander)
    plans.ts       Démarrage / résolution des plans (Combine vs vigilance)
    events.ts      Filtrage + tirage pondéré + résolution des choix
    suspicion.ts   Audit de conformité RH, burn-out, game over
    promotion.ts   Progression de rang via réputation
    week.ts        Orchestration de la résolution du vendredi
  state/
    schema.ts      TOUTES les interfaces typées (le contrat moteur ↔ contenu)
    store.ts       État, save/load localStorage, API mutative (pub/sub React)
  data/            LE CONTENU
    events.json    Catalogue d'événements
    archetypes.json Définitions des archétypes (comportement des PNJ)
    plans.json     Définitions des plans
    ranks.json     Échelle hiérarchique
    colleagues.json Roster de départ
    balance.json   Tuning mécanique des actions de base (magnitudes)
    content.ts     Charge et expose les catalogues typés (point d'entrée unique)
  ui/            Écrans React (bureau, fiche collègue, événement, résolution, game over)
```

## Ajouter du contenu

### Un événement
Ajoute un objet dans `src/data/events.json` :

```json
{
  "id": "mon_event",
  "title": "Titre",
  "body": "Texte. Utilise {rival} ou {target} pour insérer le nom de la cible.",
  "trigger": { "weight": 10, "minRank": "junior", "conditions": { "minSuspicion": 20 } },
  "target": "rival",
  "choices": [
    {
      "label": "Un choix",
      "requires": { "stats": { "combine": 25 } },
      "effects": { "suspicion": 10, "rivalOpinion": -15, "reputation": 8 },
      "outcomeText": "Ce qui se passe.",
      "successChance": 60,
      "failureEffects": { "suspicion": 5 },
      "failureText": "En cas d'échec du jet."
    }
  ]
}
```

- `trigger.weight` : poids pour le tirage. `conditions` : filtre (`Condition`).
- `target` : `rival` (le Carriériste), `random`, ou `archetype` (+ `targetArchetype`).
- `effects` / `failureEffects` : structure `Effect` (deltas de stats, suspicion,
  opinions, drapeaux, lancement de plan…). `successChance` rend le choix incertain.

### Un archétype, un plan, un rang, un collègue
Ajoute une entrée dans le JSON correspondant. Les champs sont typés dans
`src/state/schema.ts` (`Archetype`, `PlanDef`, `Rank`, `Colleague`) — le compilateur
te guide.

### `Condition` (filtre) et `Effect` (mutation)
Ce sont les deux briques réutilisées partout. Tout ce qu'un événement, un choix ou
un plan peut exiger ou provoquer s'exprime avec elles — voir `schema.ts`.

## Boucle de jeu

Une semaine = **5 points d'action** (Bosser, Café, Fouiner, Comploter, Glander).
Le vendredi : événement hebdomadaire → résolution des plans → réactions des PNJ →
audit RH → promotion. **Suspicion** trop haute → audit ; sans alibi ni bouc émissaire →
licenciement. **Nerfs** à zéro trop longtemps → placard.

## Périmètre

MVP jouable de bout en bout (§11 du GDD) : 6 rangs (Stagiaire → Team Lead), 6 archétypes,
4 plans (crédit volé → dossier RH), 5 collègues, 15 événements, save/load.
La V2 (suspicion par-collègue, bouc émissaire complet, « départ non planifié »,
IA de complot des Carriéristes) est prévue par le schéma sans casser les sauvegardes.
