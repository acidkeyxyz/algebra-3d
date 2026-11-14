import { describe, expect, it } from 'vitest';
import { COLORS } from '../src/lib/scene';

// Colour-vision-deficiency simulation (Machado, Oliveira & Fernandes 2009, severity 1.0) in linear RGB,
// then CIE76 distance in Lab. Guards against someone swapping the palette for one that collapses for
// protanopia / deuteranopia / tritanopia.
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const;
const views = [null, 'protan', 'deutan', 'tritan'] as const;

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function lab(hex: string, view: (typeof views)[number]): number[] {
  let c = rgb(hex).map(lin);
  if (view) c = M[view].map((r) => Math.min(1, Math.max(0, r[0] * c[0] + r[1] * c[1] + r[2] * c[2])));
  const [X, Y, Z] = [
    (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047,
    0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2],
    (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883,
  ];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const BG = '#0b1220';

const tiles = { 'x³': COLORS.x3, 'x²': COLORS.x2, x: COLORS.x, y: COLORS.y, '1': COLORS.one, negative: COLORS.neg };

describe('block palette for colour-blind users', () => {
  const names = Object.keys(tiles) as (keyof typeof tiles)[];
  for (const view of views) {
    it(`every pair of blocks stays distinguishable (${view ?? 'normal vision'})`, () => {
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const d = dE(lab(tiles[names[i]], view), lab(tiles[names[j]], view));
          expect(d, `${names[i]} vs ${names[j]}`).toBeGreaterThanOrEqual(15);
        }
      }
    });
    it(`every block stands out from the background (${view ?? 'normal vision'})`, () => {
      for (const n of names) expect(dE(lab(tiles[n], view), lab(BG, view)), n).toBeGreaterThanOrEqual(30);
    });
  }
});
