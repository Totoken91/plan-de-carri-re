// ─────────────────────────────────────────────────────────────
// CharacterCreation.tsx — Le formulaire d'embauche.
//
// C'est la première chose que le joueur voit, donc c'est elle qui pose
// le ton : on ne « crée pas son avatar », on remplit son dossier
// d'entrée. Mêmes règles que le reste de l'interface — feuille kraft,
// angles vifs, libellés de formulaire, une seule couleur d'alerte.
//
// L'aperçu n'est pas une illustration : c'est exactement le composant
// qui dessinera le personnage à son bureau, animé de la même façon. Ce
// qu'on choisit ici est ce qu'on aura, sans intermédiaire qui puisse
// mentir.
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import type { Appearance, HairStyle } from '@state/schema';
import { DEFAULT_APPEARANCE, palettes, randomAppearance, randomName } from '@data/appearance';
import { balance } from '@data/balance';
import { topRank } from '@data/content';
import { STAT_KEYS } from '@engine/util';
import { STAT_LABELS } from './Bits';
import { theme as T } from '@data/board';
import { iso } from './iso';
import { Desk, Figure, GooFilter, OfficeChair } from './sprites';

const MAX_NAME = 26;

// Le poste du joueur, aux coordonnées exactes du plateau (voir IsoOffice) :
// l'aperçu ne doit pas être une reconstitution approximative de la scène,
// il doit ÊTRE la scène.
const SEAT = iso(7.3, 9.65);
/**
 * Cadrage serré sur l'occupant, le bureau entrant par la gauche. Mesuré
 * sur la boîte englobante réelle de la scène, pas estimé : le visage doit
 * être assez grand pour qu'on distingue une paire de lunettes d'une
 * absence de lunettes.
 */
const SCENE_VIEW = '-194 213 176 124';

/** Une rangée de pastilles de couleur. Sélection = cadre d'encre, pas d'ombre portée. */
function Swatches({
  values,
  current,
  onPick,
  allowNone,
}: {
  values: string[];
  current: string | undefined;
  onPick: (v: string | undefined) => void;
  /** Ajoute une case « aucune » barrée en tête (cravate). */
  allowNone?: boolean;
}) {
  return (
    <div className="swatches">
      {allowNone && (
        <button
          type="button"
          className={`swatch swatch--none ${current === undefined ? 'is-on' : ''}`}
          onClick={() => onPick(undefined)}
          aria-label="Aucune"
          title="Aucune"
        />
      )}
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className={`swatch ${current === v ? 'is-on' : ''}`}
          style={{ background: v }}
          onClick={() => onPick(v)}
          aria-label={v}
        />
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {children}
    </div>
  );
}

export function CharacterCreation({
  onHire,
  onCancel,
}: {
  onHire: (name: string, appearance: Appearance) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(() => randomName());
  const [look, setLook] = useState<Appearance>(() => ({ ...DEFAULT_APPEARANCE }));
  // Change à chaque tirage : suffit à redéphaser l'animation de l'aperçu,
  // pour que deux hasards de suite ne donnent pas la même respiration.
  const [take, setTake] = useState(0);

  const set = <K extends keyof Appearance>(key: K, value: Appearance[K]) =>
    setLook((l) => ({ ...l, [key]: value }));

  const roll = () => {
    setLook(randomAppearance());
    setName(randomName());
    setTake((t) => t + 1);
  };

  const trimmed = name.trim();
  const previewId = useMemo(() => `preview-${take}`, [take]);

  return (
    <div className="hire">
      <div className="hire__sheet">
        <div className="event__tag">Service des ressources humaines · dossier d’entrée</div>

        <div className="hire__grid">
          <div className="hire__form">
            <h1 className="hire__title">Formulaire d’embauche</h1>
            <p className="hire__intro">
              Poste proposé : <b>stagiaire</b>, troisième étage, open space. Non négociable.
              Complétez le dossier, on vous montrera votre bureau.
            </p>

            <Field label="Nom et prénom">
              <div className="hire__nameline">
                <input
                  className="input"
                  value={name}
                  maxLength={MAX_NAME}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => setName(randomName())}
                  title="Proposer un nom"
                >
                  Autre nom
                </button>
              </div>
            </Field>

            <Field label="Carnation">
              <Swatches
                values={palettes.skins}
                current={look.skin}
                onPick={(v) => v && set('skin', v)}
              />
            </Field>

            <Field label="Coiffure">
              <div className="chips">
                {palettes.hairStyles.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`chip ${look.hairStyle === s.id ? 'is-on' : ''}`}
                    onClick={() => set('hairStyle', s.id as HairStyle)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Couleur de cheveux">
              <Swatches
                values={palettes.hairs}
                current={look.hair}
                onPick={(v) => v && set('hair', v)}
              />
            </Field>

            <Field label="Tenue">
              <Swatches
                values={palettes.shirts}
                current={look.shirt}
                onPick={(v) => v && set('shirt', v)}
              />
            </Field>

            <Field label="Cravate">
              <Swatches
                values={palettes.ties}
                current={look.tie}
                onPick={(v) => setLook((l) => ({ ...l, tie: v }))}
                allowNone
              />
            </Field>

            <Field label="Lunettes">
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${!look.glasses ? 'is-on' : ''}`}
                  onClick={() => set('glasses', false)}
                >
                  Sans
                </button>
                <button
                  type="button"
                  className={`chip ${look.glasses ? 'is-on' : ''}`}
                  onClick={() => set('glasses', true)}
                >
                  Avec
                </button>
              </div>
            </Field>
          </div>

          <aside className="hire__preview">
            <span className="field__label">Aperçu du poste</span>
            {/* Pas un portrait sur fond neutre : le poste lui-même, avec
                la chaise, le bureau et l'écran, aux mêmes coordonnées que
                sur le plateau. Le personnage n'a pas de jambes — il est
                conçu pour être vu assis — alors on le montre assis. */}
            <svg className="hire__portrait" viewBox={SCENE_VIEW} aria-hidden="true">
              <defs>
                <GooFilter />
                <radialGradient id="hireScreen">
                  <stop offset="0%" stopColor={T.degrades.ecranNappe[0]} />
                  <stop offset="100%" stopColor={T.degrades.ecranNappe[1]} />
                </radialGradient>
                <radialGradient id="hireFloor">
                  <stop offset="0%" stopColor={T.sol.moquettes.player} />
                  <stop offset="100%" stopColor={T.sol.dalle} />
                </radialGradient>
              </defs>
              <g>
                {/* Pas de moquette découpée : un losange de sol dans un
                    cadre serré laisse un angle vide qui ressemble à un
                    oubli. Le poste est une flaque de lumière dans le
                    noir — exactement comme sur le plateau. */}
                <ellipse cx={SEAT.x - 26} cy={SEAT.y + 22} rx="96" ry="44" fill="url(#hireFloor)" />
                <ellipse cx={SEAT.x} cy={SEAT.y + 6} rx="46" ry="19" fill="url(#hireScreen)" />
                <OfficeChair gx={6.94} gy={9.28} color={T.structure.tissu} />
                <g transform={`translate(${SEAT.x},${SEAT.y})`}>
                  <Figure id={previewId} look={look} />
                </g>
                <Desk gx={6.2} gy={10.6} wood={T.structure.bois} frame={T.structure.metalFonce} />
              </g>
            </svg>
            <div className="hire__ident">
              <span className="hire__identname">{trimmed || '—'}</span>
              <span className="hire__identrole">Stagiaire · troisième étage</span>
            </div>

            {/* Les conditions d'entrée, lues dans l'équilibrage : autant
                que le joueur ait vu ses quatre chiffres une fois avant
                qu'on les lui explique. */}
            <div className="hire__terms">
              <h3 className="section-title">Conditions d’entrée</h3>
              <ul className="hire__stats">
                {STAT_KEYS.map((k) => (
                  <li key={k}>
                    <span>{STAT_LABELS[k]}</span>
                    <em>{balance.startStats[k]}</em>
                  </li>
                ))}
              </ul>
              <p className="hire__note">
                Objectif de carrière : <b>{topRank().name}</b>. Aucune date n’est fixée. Aucun
                accompagnement n’est prévu.
              </p>
            </div>
          </aside>
        </div>

        <footer className="hire__foot">
          <div className="hire__footleft">
            <button type="button" className="btn btn--small" onClick={onCancel}>
              Retour aux dossiers
            </button>
            <button type="button" className="btn" onClick={roll}>
              Au hasard
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!trimmed}
            onClick={() => onHire(trimmed, look)}
          >
            Signer et prendre le poste
          </button>
        </footer>
      </div>
    </div>
  );
}
