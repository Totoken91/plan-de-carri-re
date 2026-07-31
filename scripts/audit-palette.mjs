// Contrôle du budget de valeurs : chaque couleur de décor doit tenir
// dans la bande du thème. Une couleur hors bande est un bug de direction
// artistique, pas une question de goût — d'où un script, pas un avis.
import { readFileSync } from 'node:fs';

const file = JSON.parse(readFileSync(new URL('../src/data/board.json', import.meta.url)));

const rgb = (c) => {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/.exec(c);
  return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
};

// Une couleur transparente n'a pas de valeur propre : ce qui compte est
// ce qu'elle donne UNE FOIS POSÉE sur le sol. Mesurer son RGB brut
// faisait passer un joint à 5 % d'opacité pour une couleur sombre.
const composite = (c, fond) => {
  const v = rgb(c);
  if (!v) return null;
  const f = rgb(fond) ?? [255, 255, 255, 1];
  const a = v[3];
  return [0, 1, 2].map((i) => v[i] * a + f[i] * (1 - a));
};
const lum = (c, fond) => {
  const v = composite(c, fond);
  return v ? (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 : null;
};
const sat = (c) => {
  const v = rgb(c);
  if (!v) return null;
  if (v[3] < 0.9) return 0; // un voile transparent ne sature rien
  const [r, g, b] = v.map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  const l = (mx + mn) / 2;
  return (mx - mn) / (1 - Math.abs(2 * l - 1));
};

let failed = 0;
for (const t of file.themes) {
  const [lo, hi] = t.bandeDecor;
  const sol = t.sol.dalle;
  const tolere = new Set((t.horsBande ?? []).map((e) => e.chemin));
  const satMax = t.satMaxDecor;
  const offences = [];
  const sats = [];
  const visit = (node, path) => {
    if (typeof node === 'string') {
      if (!node.startsWith('#') && !node.startsWith('rgb')) return;
      const v = lum(node, sol);
      if (v === null) return;
      sats.push(sat(node));
      if (tolere.has(path)) return;
      if (v < lo || v > hi) offences.push([path, node, `L=${v.toFixed(3)}`, `bande ${lo}–${hi}`]);
      const sv = sat(node);
      if (satMax !== undefined && sv > satMax + 1e-6)
        offences.push([path, node, `S=${sv.toFixed(3)}`, `max ${satMax}`]);
    } else if (Array.isArray(node)) node.forEach((n, i) => visit(n, `${path}[${i}]`));
    else if (node && typeof node === 'object')
      for (const [k, v] of Object.entries(node)) visit(v, `${path}.${k}`);
  };
  for (const g of ['sol', 'mur', 'cloison', 'structure', 'habillage']) visit(t[g], g);

  const satMoy = sats.reduce((a, b) => a + b, 0) / sats.length;
  const acteurs = t.personnages.peaux.map((c) => lum(c, sol));
  console.log(`\n── ${t.nom} (${t.id})`);
  console.log(`   bande décor  ${lo}–${hi} · ${sats.length} couleurs contrôlées`);
  console.log(`   saturation moyenne du décor : ${satMoy.toFixed(3)}`);
  console.log(`   peaux : ${acteurs.map((a) => a.toFixed(2)).join(' ')}`);
  for (const e of t.horsBande ?? []) console.log(`   · exception assumée — ${e.chemin} : ${e.raison}`);
  if (t.conforme === false) {
    console.log(`   ⚠ thème non conforme par nature, conservé pour comparaison (${offences.length} hors bande)`);
    continue;
  }
  if (offences.length) {
    failed++;
    console.log(`   ✗ ${offences.length} hors bande :`);
    for (const [p, c, m, att] of offences)
      console.log(`      ${p.padEnd(28)} ${c}  ${m.padEnd(9)} (${att})`);
  } else {
    console.log('   ✓ tout le décor tient dans la bande');
  }
}
process.exit(failed ? 1 : 0);
