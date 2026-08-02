// ─────────────────────────────────────────────────────────────
// Manual.tsx — Le règlement intérieur, consultable à tout moment.
//
// Le tuto guidé apprend les gestes ; ce document répond aux questions
// qu'on se pose trois semaines plus tard (« il fallait combien de
// réputation, déjà ? »). Tout ce qui est chiffré ici est lu dans les
// données, jamais recopié : un équilibrage qui change met le manuel à
// jour tout seul.
// ─────────────────────────────────────────────────────────────
import { catalog } from '@data/content';
import { balance } from '@data/balance';
import { MAX_DEFAUTS, TRAIT_BUDGET, defauts, qualites } from '@data/traits';
import { apparts, casino, titres } from '@data/vieprivee';
import { euros } from '@engine/argent';
import { ORDRES } from '@engine/subordonnes';
import { Icone } from './icones';

export function Manual({
  onClose,
  onReplay,
}: {
  onClose: () => void;
  /** Absent hors partie : sans plateau, il n'y a rien à rejouer. */
  onReplay?: () => void;
}) {
  const ranks = [...catalog.ranks].sort((a, b) => a.order - b.order);
  const ap = balance.actionPointsPerWeek;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manual" onClick={(e) => e.stopPropagation()}>
        <div className="event__tag">Document interne · diffusion restreinte</div>
        <header className="manual__head">
          <h2 className="manual__title">Règlement intérieur</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Fermer">
            <Icone nom="croix" />
          </button>
        </header>

        <div className="manual__body">
          <section>
            <h3 className="section-title">Le but</h3>
            <p>
              Atteindre le grade de <b>{ranks[ranks.length - 1]?.name}</b>, puis tenir la position{' '}
              {balance.winSurviveWeeks} semaines sans se faire éjecter.
            </p>
            <p>
              La réputation te rend <b>éligible</b> — elle ne te fait pas monter. Les
              grades d’encadrement ont un nombre de <b>places</b>, et quelqu’un les
              occupe déjà. Tant que la place n’est pas libre, ta barre reste pleine
              et il ne se passe rien le vendredi. Il faut attendre un départ, ou
              t’occuper de celui qui est assis là.
            </p>
            <p>
              Et quand une place se libère sur un grade disputé, on regarde les
              dossiers : <b>rendement, aura, et les appuis que tu as dans l’étage</b>.
              Travailler seul remplit un tiers de ce dossier.
            </p>
            <ul className="manual__ranks">
              {ranks.map((r) => (
                <li key={r.id}>
                  <span>{r.name}</span>
                  <em>
                    {r.reputationRequired} réput.
                    {r.places <= 6 ? ` · ${r.places} place${r.places > 1 ? 's' : ''}` : ''}
                  </em>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="section-title">Le tour</h3>
            <p>
              Une semaine = <b>{ap} points d’action</b>. Toute action coûte 1 PA. Répéter la même
              action dans la semaine rapporte de moins en moins (×0,6 à chaque répétition).
            </p>
            <p>
              Vendredi soir, tout se résout : tes plans avancent, les intentions des collègues
              tombent, les opportunités non saisies disparaissent, la suspicion évolue, et un
              événement peut t’imposer un choix. Le bilan détaille chaque ligne.
            </p>
          </section>

          <section>
            <h3 className="section-title">Les quatre chiffres</h3>
            <dl className="manual__dl">
              <dt>Aura</dt>
              <dd>On t’écoute. Améliore l’opinion qu’on a de toi et le poids de tes interventions.</dd>
              <dt>Rendement</dt>
              <dd>
                Tu produis. C’est lui qui transforme une semaine de travail en réputation (
                {balance.actions.bosser.reputation} de base par « Bosser »).
              </dd>
              <dt>Combine</dt>
              <dd>
                Tu manœuvres. Augmente la réussite des complots et la discrétion. Elle
                monte en <b>fouinant</b> et en <b>complotant</b>, jamais autrement — et
                de moins en moins à mesure qu’elle est haute.
              </dd>
              <dt>Nerfs</dt>
              <dd>
                Ton carburant. « Bosser » en consomme {Math.abs(balance.actions.bosser.nerfs)},
                « Glander » en rend {balance.actions.glander.nerfs}. À zéro pendant{' '}
                Sous {balance.burnoutSeuil} pendant {balance.burnoutGraceWeeks} semaines,
                c’est le burn-out et la partie s’arrête.
              </dd>
            </dl>
          </section>

          <section>
            <h3 className="section-title">Les paliers</h3>
            <p>
              Chaque chiffre traverse cinq <b>seuils nommés</b>, et le nom n’est pas
              décoratif : il porte un effet réel — un gain d’opinion multiplié, une
              chance de complot en plus, un coût nerveux allégé. Le panneau{' '}
              <b>Ton dossier</b> affiche le palier tenu et ce qu’il reste avant le
              suivant.
            </p>
            <p>
              Les hauts paliers rendent aussi un peu de terrain chaque vendredi. C’est
              ce qui les rend durables : une mauvaise semaine ne fait pas retomber deux
              crans d’un coup.
            </p>
          </section>

          <section>
            <h3 className="section-title">Le parking</h3>
            <p>
              Une voiture est le seul achat du jeu qui touche directement une
              statistique : le bonus d’<b>Aura</b> est acquis une fois, au changement de
              véhicule, et c’est la différence avec la précédente qui s’applique.
            </p>
            <p>
              L’<b>entretien</b>, lui, tombe tous les vendredis sur la même facture que
              le loyer. C’est celui-là qui ruine les gens.
            </p>
          </section>

          <section>
            <h3 className="section-title">Suspicion et audit</h3>
            <p>
              Chaque manœuvre laisse une trace. À <b>{balance.suspicionAuditThreshold}</b> de
              suspicion, un audit se déclenche — et le seuil <b>descend de{' '}
              {balance.auditSeuilParRang} points par grade</b> : on ne pardonne pas la
              même chose à un {ranks[ranks.length - 1]?.name} qu’à un {ranks[0]?.name}.
            </p>
            <p>
              Il te faut alors un alibi ou un <b>bouc émissaire</b> — un dossier monté
              d’avance sur un innocent, valable {balance.scapegoat.staleWeeks} semaines.
              L’audit le consomme : la personne saute à ta place, l’étage t’en veut un
              peu, et ta suspicion retombe. Mais pas deux fois de suite : un second
              coupable désigné en moins de {balance.scapegoat.reciditeWeeks} semaines,
              et c’est la coïncidence que l’auditeur relève.
            </p>
            <p>
              Sans couverture, le premier audit n’est pas la fin : <b>mise à pied</b>,
              un tiers de ta réputation, et un dossier ouvert. Un second pendant les{' '}
              {balance.sursisWeeks} semaines de sursis, et tu pars.
            </p>
            <p>
              Ce qui fait <b>redescendre</b> la suspicion sans rien dépenser : bosser.
              Le travail visible est le meilleur alibi qui existe.
            </p>
          </section>

          <section>
            <h3 className="section-title">Les intentions</h3>
            <p>
              La bulle au-dessus d’une tête dit ce que la personne fabrique cette semaine, et le
              chiffre dit dans combien de semaines ça tombe. Tu peux :
            </p>
            <ul className="manual__list">
              <li>
                <b>Désamorcer</b> une manœuvre qui te vise (1 PA, jet de dés).
              </li>
              <li>
                <b>Prévenir</b> la victime d’un coup monté entre collègues : elle te le rendra.
              </li>
              <li>
                <b>Alimenter</b> ce coup en douce : la victime tombe plus sûrement, ton nom
                n’apparaît pas — mais ta suspicion, si.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="section-title">Les secrets</h3>
            <p>
              « Fouiner » cherche ce qu’on te cache. Un secret trouvé s’utilise une fois :
              <b> chantage</b> (la personne t’obéit, discrètement) ou <b>divulgation</b> (tout
              l’étage l’apprend, elle est discréditée, ta suspicion monte).
            </p>
          </section>

          <section>
            <h3 className="section-title">Qui est qui</h3>
            <dl className="manual__dl">
              {catalog.archetypes.map((a) => (
                <div key={a.id} className="manual__pair">
                  <dt>{a.name}</dt>
                  <dd>{a.description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="section-title">Traits</h3>
            <p>
              À l’embauche, tu places exactement <b>{TRAIT_BUDGET} points</b> : les qualités en
              coûtent, les défauts en rendent, et tu ne peux pas prendre plus de {MAX_DEFAUTS}{' '}
              défauts. Un trait ne se change plus ensuite.
            </p>
            <dl className="manual__dl">
              {[...qualites, ...defauts].map((t) => (
                <div key={t.id} className="manual__pair">
                  <dt>
                    {t.nom} <em className="manual__cout">{t.cout > 0 ? `−${t.cout}` : `+${-t.cout}`}</em>
                  </dt>
                  <dd>{t.detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="section-title">L’argent</h3>
            <p>
              Tu es payé chaque vendredi, et ton loyer est prélevé dans la foulée.
              Le salaire dépend du rang — c’est la deuxième raison de monter :
              {' '}
              {catalog.ranks.map((r) => `${r.name} ${euros(r.salaire)}`).join(' · ')}.
            </p>
            <p>
              <b>Rien ne se paie à crédit.</b> Une dépense que tu ne peux pas
              couvrir est refusée, pas empruntée. Ce que l’argent achète : des
              cafés, des dîners, des cadeaux, un avocat qui fait baisser la
              suspicion, un détective qui trouve un secret, et — à partir de
              Confirmé — un cabinet extérieur qui conclura qu’un poste est
              redondant.
            </p>
          </section>

          <section>
            <h3 className="section-title">La vie privée</h3>
            <p>
              L’<b>attachement</b> n’est pas l’opinion. On peut plaire à quelqu’un
              qui vous méprise professionnellement, et l’inverse arrive tout
              autant. Trois paliers : flirt à {balance.romance.seuilFlirt},
              liaison à {balance.romance.seuilLiaison}, et de quoi officialiser à
              {' '}{balance.romance.seuilCouple}.
            </p>
            <p>
              Ce qui relie les deux, c’est le risque. Tant que ça reste discret,
              rien de public ne bouge. Dès que ça se sait — surpris aux toilettes,
              ou officialisé —, les autres histoires en cours s’effondrent,
              l’étage baisse de {Math.abs(balance.romance.toilettesScandaleOpinion)}{' '}
              d’opinion et les RH ouvrent un dossier. La Combine réduit le risque
              de se faire surprendre.
            </p>
            <p>
              Officialiser garantit un plancher d’opinion de{' '}
              {balance.romance.conjointOpinionPlancher} et rend{' '}
              {balance.romance.conjointNerfs} nerfs par semaine. C’est le marché :
              un allié qui ne te lâchera pas, contre la discrétion, pour toujours.
              Une histoire qu’on n’entretient pas perd{' '}
              {Math.abs(balance.romance.derivePasEntretenue)} par semaine.
            </p>
          </section>

          <section>
            <h3 className="section-title">Le week-end</h3>
            <p>
              Après le bilan du vendredi, tu rentres chez toi. Le week-end a ses
              propres points d’action, et c’est le logement qui décide combien :
            </p>
            <dl className="manual__dl">
              {apparts.map((a) => (
                <div key={a.id} className="manual__pair">
                  <dt>{a.nom}</dt>
                  <dd>
                    {a.prix === 0 ? 'de départ' : euros(a.prix)} · loyer{' '}
                    {euros(a.loyer)} · {a.pointsWeekend} action(s) · {a.places} meuble(s)
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Déménager, ce n’est donc pas acheter un décor : c’est acheter du
              temps libre. Le mobilier majore ce que les activités rapportent,
              sans jamais leur ajouter un effet qu’elles n’avaient pas.
            </p>
          </section>

          <section>
            <h3 className="section-title">Ton poste</h3>
            <p>
              Clique sur <b>ton bureau</b> pour t’y asseoir : un écran s’ouvre, avec
              son bureau et ses icônes. Trois choses s’y font, parce que ce sont
              trois choses qu’on fait devant un écran — produire (le tableur),
              regarder le marché, et l’onglet qu’on referme vite.
            </p>
            <p>
              Jouer au casino <b>depuis ce poste</b> fait monter la suspicion, gagné
              ou perdu. Tu es dans un open space, sous les yeux de six personnes.
              Chez toi le week-end, la même table ne coûte rien de plus que la mise.
            </p>
          </section>

          <section>
            <h3 className="section-title">Ce qui met fin à une carrière</h3>
            <p>Quatre choses, toutes annoncées avant de tomber :</p>
            <ul className="manual__list">
              <li>
                <b>L’audit RH</b>, si la suspicion crève le plafond sans couverture —
                deux fois, la seconde pendant le sursis de la première.
              </li>
              <li>
                <b>Le burn-out</b>, après {balance.burnoutGraceWeeks} semaines de Nerfs
                sous {balance.burnoutSeuil}. Chaque grade prélève sa charge nerveuse
                tous les vendredis, et elle monte avec le poste.
              </li>
              <li>
                <b>L’expulsion</b>, après {balance.expulsionApres} loyers impayés
                consécutifs. Le premier impayé s’affiche en rouge dans la barre du
                haut : il reste une semaine pour vendre des titres, revendre un
                meuble, ou reprendre un logement plus petit.
              </li>
              <li>
                <b>Un loyer qui dépasse ton salaire</b> n’est pas interdit — c’est
                juste la façon la plus rapide de perdre. Vendredi, la même facture
                prend le loyer, le <b>train de vie de ton grade</b> et l’entretien de
                ta voiture. Une voiture au-dessus de tes moyens met à la rue aussi
                sûrement qu’un penthouse.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="section-title">Bourse et casino</h3>
            <p>
              Deux façons opposées de faire travailler ton salaire.{' '}
              <b>La bourse</b> ({titres.map((t) => t.symbole).join(', ')}) a une
              dérive positive : sur la durée, y laisser son argent rapporte. Ce
              qu’elle prend en échange, c’est de la liquidité — un titre ne paie
              pas un cabinet de conseil le jour où il en faudrait un.
            </p>
            <p>
              <b>Le casino</b> a une espérance négative sur ses{' '}
              {casino.length} tables, et elle est affichée sur chacune. Il ne sert
              pas à s’enrichir : il sert à convertir un petit capital en une
              petite chance d’un gros capital, tout de suite. Joué depuis ton
              poste, il fait monter la suspicion — gagné ou perdu.
            </p>
          </section>

          <section>
            <h3 className="section-title">Ton périmètre</h3>
            <p>
              À partir de Junior, des collègues d’un rang strictement inférieur
              peuvent t’être rattachés ({catalog.ranks
                .filter((r) => r.subordonnes > 0)
                .map((r) => `${r.name} ${r.subordonnes}`)
                .join(' · ')}
              ). Tu leur donnes un ordre par semaine :
            </p>
            <dl className="manual__dl">
              {ORDRES.map((o) => (
                <div key={o.kind} className="manual__pair">
                  <dt>
                    <><Icone nom={o.icone} /> {o.nom}</>
                  </dt>
                  <dd>{o.description}</dd>
                </div>
              ))}
            </dl>
            <p>
              Un subordonné n’obéit pas parce qu’il t’aime : il obéit parce que tu
              notes son évaluation. Son opinion ne décide donc pas s’il exécute —
              elle décide ce qu’il raconte ensuite. En dessous de{' '}
              {balance.subordonnes.trahisonSousOpinion} d’opinion, il fait quand
              même ce que tu demandes, puis il va le raconter aux RH.
            </p>
          </section>

          <section>
            <h3 className="section-title">L’écran</h3>
            <p>
              Tout tient sur un écran : rien ne défile. Le plateau occupe toute la
              place, et ce qui n’y est pas s’ouvre par-dessus.
            </p>
            <ul className="manual__list">
              <li>
                <b>La barre du bas</b> ouvre les cinq panneaux : ton dossier, ce qui
                se trame, les opportunités, ton équipe, le journal. Un seul à la
                fois — deux panneaux ouverts, c’est un écran qui défile.
              </li>
              <li>
                <b>Le rail de droite</b> montre ce qui réclame ton attention, du
                plus urgent au plus dormant. Survole un voyant pour savoir de quoi
                il s’agit, clique-le pour aller là où on peut y répondre.
              </li>
              <li>
                <b>La ligne du conseil</b>, en bas, dit la seule chose la plus utile
                à faire maintenant. Le doigt la replie si elle t’agace.
              </li>
              <li>
                <b>Échap</b> referme d’abord ce qui est ouvert — un panneau, puis
                une fiche — et n’ouvre le menu que quand il n’y a plus rien à
                fermer.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="section-title">Le plateau</h3>
            <ul className="manual__list">
              <li>Molette (ou pincement) : zoomer.</li>
              <li>Glisser : déplacer la vue.</li>
              <li>Double-clic, ou « Recadrer » : revenir à la vue d’ensemble.</li>
              <li>Clic sur un personnage, une zone ou une balise dorée : ouvrir sa fiche.</li>
            </ul>
          </section>
        </div>

        <footer className="manual__foot">
          {onReplay ? (
            <button className="btn btn--small" onClick={onReplay}>
              Refaire le tutoriel guidé
            </button>
          ) : (
            <span />
          )}
          <button className="btn btn--small btn--primary" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
