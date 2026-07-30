# Plan de Carrière — Game Design Document

> **Titre de travail :** *Plan de Carrière* (double sens : plan professionnel / plan machiavélique). À confirmer. Alternatives : *Départ Non Planifié*, *Open Space*, *Rationalisation*.
>
> **Genre :** Jeu d'intrigue narratif au tour par tour · **Inspiration :** Crusader Kings, mais dans un open space · **Plateforme :** Navigateur (web) · **Ton :** Comédie noire corporate

---

## 1. Pitch

Tu es un employé de bureau ambitieux. Ton objectif : atteindre le sommet de la hiérarchie de l'entreprise. Tes moyens : alliances, trahisons, coups bas, manipulation RH — et, quand la situation l'exige, le « départ non planifié » d'un collègue gênant.

Tout le jeu passe par des **menus et du texte**, façon Crusader Kings : des événements, des fiches de personnages, des choix aux conséquences. C'est l'écriture qui porte le jeu.

---

## 2. Direction de ton — la bible

**Règle d'or : le jeu joue tout au premier degré administratif.** L'horreur est traitée avec le vocabulaire des ressources humaines. C'est le décalage entre l'acte et le registre qui fait rire.

| Ce qui se passe | Comment le jeu le nomme |
|---|---|
| Un meurtre | « Un départ non planifié » |
| Empoisonner le café | « Optimiser le turnover » |
| Faire virer quelqu'un | « Accompagner une transition professionnelle » |
| Un burn-out | « Une indisponibilité temporaire » |
| Une enquête interne | « Un audit de conformité RH » |

Plus l'acte est monstrueux, plus le texte reste neutre, poli et procédural. Registres de référence : *Severance*, *The Office*, l'humour de mort clinique de Crusader Kings lui-même (« Votre rival est décédé d'une chute. Tragique. »).

**Ce qu'on évite :** l'humour qui se moque de lui-même, les clins d'œil au joueur, le gore explicite. Le jeu ne rit jamais de sa propre blague — il la présente comme un compte-rendu de réunion.

---

## 3. Les statistiques du personnage

Quatre stats, renommées en jargon corporate :

- **Aura** — charisme. Capacité à se faire aimer, à baratiner, à désamorcer.
- **Rendement** — compétence réelle. Ce qui fait monter *proprement* (projets réussis, réputation légitime).
- **Combine** — l'équivalent de l'Intrigue de CK. Taux de réussite des coups bas, qualité des alibis, discrétion.
- **Nerfs** — jauge de burn-out (0 à 100). À zéro : arrêt maladie forcé, le joueur perd des tours. Se régénère en glandant.

Le joueur commence avec des stats faibles et les fait progresser via ses actions et ses promotions.

---

## 4. Les collègues

Chaque PNJ est une **fiche** contenant :

- Les 4 stats (Aura / Rendement / Combine / Nerfs)
- Une **opinion de toi** : `-100` (te déteste) à `+100` (allié dévoué)
- Un **archétype** qui pilote son comportement (son « IA »)
- 1 à 2 **secrets** découvrables en fouinant, utilisables comme levier

### Archétypes de départ

| Archétype | Comportement |
|---|---|
| **Le Fayot** | Colle le manager. Te dénonce si tu le menaces ou si ta Suspicion est visible. |
| **Le Carriériste** | Ton vrai rival. Joue au même jeu que toi, complote de son côté. |
| **Le Glandeur** | Inoffensif, mais traîne partout → sait des choses. Source de ragots. |
| **Le Parano** | Difficile à approcher. Monte vite en suspicion contre toi. |
| **Le Vétéran aigri** | Connaît TOUS les secrets. Allié en or ou danger mortel. |
| **Le Nouveau** | Malléable. À recruter avant que ton rival ne le retourne. |

L'opinion évolue selon tes actions (réseautage, services rendus, trahisons découvertes). Elle conditionne : qui t'aide, qui te couvre, qui te balance, qui accepte de porter le chapeau.

---

## 5. Boucle de gameplay — la semaine de travail

Une **manche = 1 semaine = 5 points d'action** (lundi → vendredi). À chaque PA, le joueur choisit une action :

| Action | Effet | Coût |
|---|---|---|
| **Bosser** un projet | +Rendement, +réputation légitime | −Nerfs |
| **Machine à café** | Réseauter avec un collègue → +son opinion | — |
| **Fouiner** | Chercher un secret sur une cible (mails, ragots, poubelle) | risque de +Suspicion |
| **Comploter** | Lancer / faire avancer un *plan* (voir §6) | +Suspicion variable |
| **Glander** | +Nerfs (récupération) | un Fayot peut te griller |

**Vendredi soir → résolution de la semaine :**
1. Événement hebdomadaire (réorg, audit, arrivée d'un nouveau, pot de départ…)
2. Résolution des plans en cours
3. Actions des PNJ (les Carriséristes avancent leurs propres complots)
4. Mise à jour opinions / Suspicion / promotions

---

## 6. Les plans (le cœur « CK »)

Un plan n'est **pas instantané**. Il possède :

- Un **taux de réussite** = `f(ta Combine, vigilance de la cible, préparation)`
- Un **coût en Suspicion** s'il rate ou s'il est de grande ampleur
- Parfois un **prérequis** (un bouc émissaire prêt, un secret en main, un allié placé)

### Échelle des plans, du bénin au nucléaire

1. **Voler le crédit d'un projet** — cheap, faible risque
2. **Saboter une présentation** — moyen
3. **Lancer une rumeur** — moyen, effet sur l'opinion collective
4. **Monter un dossier RH** pour faire virer un rival — coûteux, demande des preuves
5. **Retourner un allié** de ton rival — social, demande de l'Aura
6. **Le « départ non planifié »** (l'accident) — très cher en Combine, énorme en Suspicion, **exige un bouc émissaire prêt**

### Le bouc émissaire

Mécanique clé : avant un gros coup, tu peux « préparer » un innocent (fabriquer des indices, l'isoler). En cas d'audit, la Suspicion se reporte sur lui. C'est ce qui rend les meurtres jouables sans game over automatique.

---

## 7. La tension centrale — la Suspicion

Jauge de **Suspicion** (globale, et/ou par-collègue en V2). Chaque coup bas laisse des traces.

- Seuil bas : rumeurs, regards en biais.
- Seuil moyen : le Parano commence à t'éviter, le Fayot surveille.
- **Seuil critique → Audit de conformité RH** (enquête interne) : si tu n'as ni **alibi** ni **bouc émissaire**, c'est **licenciement pour faute grave = game over**.

Toute la stratégie découle de là : ne jamais agir à découvert, entretenir des alibis, et savoir faire porter le chapeau.

---

## 8. Progression hiérarchique

```
Stagiaire → Alternant → Junior → Confirmé → Senior → Team Lead → Manager → Directeur → DG
```

Chaque promotion :
- **Débloque des actions** (un Manager peut licencier directement ; un Directeur accède aux dossiers confidentiels ; un DG peut « restructurer » un service entier)
- **Augmente ta cible dans le dos** : plus tu montes, plus les autres complotent contre toi

**Condition de victoire :** devenir DG (et y survivre X semaines). **Défaite :** licenciement (Suspicion) ou effondrement (Nerfs à zéro trop longtemps → mise au placard définitive).

---

## 9. Les événements

Le contenu principal du jeu. Chaque événement = une situation + 2 à 4 choix aux conséquences chiffrées.

### Exemple

> **⚠ Réorganisation de service**
> Le DAF annonce une « rationalisation des effectifs ». Un poste de Senior saute. Toi et **Marc (Carriériste)** êtes les deux candidats au maintien.
>
> - *Prendre les devants* → monter un dossier sur les retards de Marc *(Combine, +Suspicion)*
> - *Jouer franc* → bosser deux fois plus cette semaine *(+Rendement, −Nerfs)*
> - *Sacrifier un tiers* → suggérer que **Julie (Nouvelle)** est plus dispensable *(efficace, mais Julie te haïra)*
> - *Ne rien faire* → laisser le hasard décider *(50/50)*

### Structure de données d'un événement (schéma cible)

```json
{
  "id": "reorg_service",
  "title": "Réorganisation de service",
  "trigger": { "minRank": "junior", "weight": 10 },
  "body": "Le DAF annonce une « rationalisation des effectifs »…",
  "choices": [
    {
      "label": "Prendre les devants",
      "requires": { "combine": 20 },
      "effects": { "suspicion": 15, "rivalOpinion": -20 },
      "outcomeText": "Le dossier tombe au bon moment. Marc transpire."
    }
  ]
}
```

Les événements sont **data-driven** : le moteur lit un catalogue de JSON, filtre par conditions (rang, stats, relations, drapeaux narratifs), en tire un selon un poids. Ajouter du contenu = ajouter un fichier, sans toucher au code.

---

## 10. Architecture technique (navigateur)

**Principe directeur : séparer le moteur (code) du contenu (données).** C'est ce qui rend le jeu extensible et l'écriture indolore.

- **Stack recommandée :** Vite + TypeScript. Vanilla ou React léger (React pour l'UI à base de menus/fiches, mais pas obligatoire au MVP).
- **Pas de backend au départ :** tout tourne côté client, sauvegarde en `localStorage`.
- **Structure suggérée :**

```
/src
  /engine        → boucle de tour, résolution des plans, calcul Suspicion, RNG seedé
  /state         → état du jeu (joueur, collègues, semaine, drapeaux) + save/load
  /data
    events.json      → catalogue d'événements
    archetypes.json  → définitions des archétypes
    plans.json       → définitions des plans
    ranks.json       → échelle hiérarchique
  /ui            → écrans : bureau, fiche collègue, événement, résolution hebdo
  main.ts
```

- **RNG seedé** dès le départ (reproductibilité + debug).
- **Modèle de données typé** (interfaces `Colleague`, `Plan`, `GameEvent`, `GameState`) pour que le contenu et le moteur ne dérivent pas.

---

## 11. Roadmap — par jalons

**MVP (jouable de bout en bout, minimal) :**
1. État du jeu + une poignée de collègues avec archétypes
2. La boucle hebdo (5 PA, les 5 actions de base)
3. Le système de plans avec 3-4 plans (crédit volé → dossier RH)
4. La jauge de Suspicion + l'audit + game over
5. Progression sur 2-3 rangs
6. 15-20 événements
7. Sauvegarde `localStorage`

**V2 :**
- Suspicion par-collègue, mécanique de bouc émissaire complète
- Le « départ non planifié » et ses prérequis
- IA de complot des Carriéristes (ils te ciblent activement)
- Romances de bureau (+ risque scandale RH)
- Échelle hiérarchique complète jusqu'à DG

**Polish :**
- Ambiance visuelle open space, sons discrets (notif Outlook, machine à café)
- Journal de fin de partie (« votre nécrologie corporate »)
- Événements de fin de run selon ta méthode (tyran / manipulateur / bosseur)
