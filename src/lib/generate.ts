// Random practice formulas with "nice" answers, for the endless examples list.
// Every formula is built backwards from its answer so the numbers come out clean.

import { F } from './fraction';
import { Poly } from './poly';

export interface Example {
  q: string;
  level: string;
}

type Rng = () => number;

const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r: Rng, lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = int(r, lo, hi);
  return v;
};
const pick = <T,>(r: Rng, xs: T[]) => xs[Math.floor(r() * xs.length)];

/** Polynomial in x from coefficients, highest power first. */
const px = (...cs: number[]) => Poly.fromCoeffs(cs.slice().reverse().map((c) => F(c)));
/** "ax + by" as text, x first. */
function xy(a: number, b: number): string {
  const term = (c: number, v: string, first: boolean) => {
    const mag = Math.abs(c) === 1 ? v : `${Math.abs(c)}${v}`;
    if (first) return `${c < 0 ? '−' : ''}${mag}`;
    return ` ${c < 0 ? '−' : '+'} ${mag}`;
  };
  if (a === 0) return term(b, 'y', true);
  return term(a, 'x', true) + (b === 0 ? '' : term(b, 'y', false));
}
const s = (p: Poly) => p.toString();

const GENERATORS: ((r: Rng) => Example)[] = [
  // ax + b = c
  (r) => {
    const x = int(r, -9, 9);
    const a = nz(r, -6, 6);
    const b = nz(r, -9, 9);
    return { q: `${s(px(a, b))} = ${a * x + b}`, level: 'Balance' };
  },
  // ax + b = cx + d
  (r) => {
    const x = int(r, -8, 8);
    const a = int(r, 2, 7);
    let c = nz(r, -5, 6);
    if (c === a) c = a - 1 || -1;
    const b = nz(r, -9, 9);
    const d = a * x + b - c * x;
    return { q: `${s(px(a, b))} = ${s(px(c, d))}`, level: 'Balance' };
  },
  // a(x + b) = cx + d
  (r) => {
    const x = int(r, -6, 8);
    const a = int(r, 2, 5);
    const b = nz(r, -6, 6);
    const c = pick(r, [1, -1, 2, a + 1]);
    const d = a * (x + b) - c * x;
    return { q: `${a}(${s(px(1, b))}) = ${s(px(c, d))}`, level: 'Brackets' };
  },
  // x² = k
  (r) => {
    const k = int(r, 1, 12);
    return pick(r, [
      { q: `x² = ${k * k}`, level: 'Square root' },
      { q: `${s(px(1, 0, -k * k))} = 0`, level: 'Square root' },
      { q: `2x² = ${2 * k * k}`, level: 'Square root' },
    ]);
  },
  // (x + p)(x + q) with p, q > 0: rectangle picture
  (r) => {
    const p = int(r, 1, 5);
    const q = int(r, 1, 5);
    return { q: `${s(px(1, p + q, p * q))} = 0`, level: 'Rectangle' };
  },
  // integer roots, any sign
  (r) => {
    const a = int(r, -7, 7);
    let b = int(r, -7, 7);
    if (a === b) b++;
    return { q: `${s(px(1, -(a + b), a * b))} = 0`, level: 'Factor' };
  },
  // quadratic formula
  (r) => {
    let b = 0;
    let c = 0;
    do {
      b = int(r, -6, 6);
      c = nz(r, -8, 8);
    } while (Number.isInteger(Math.sqrt(b * b - 4 * c)) || b * b - 4 * c < 0);
    return { q: `${s(px(1, b, c))} = 0`, level: 'Formula' };
  },
  // cubic box: x²(x + p) or x(x + p)(x + q)
  (r) => {
    const p = int(r, 1, 4);
    const q = int(r, 1, 4);
    return pick(r, [
      { q: `${s(px(1, p, 0, 0))} = 0`, level: 'Box' },
      { q: `${s(px(1, p + q, p * q, 0))} = 0`, level: 'Box' },
    ]);
  },
  // y = mx + b
  (r) => {
    const m = pick(r, [F(nz(r, -4, 4)), F(nz(r, -3, 3), 2), F(1, 3)]);
    const b = int(r, -6, 6);
    // Fractional slopes in brackets: "(1/3)x", never the ambiguous "1/3x".
    const slope = m.isInt() ? s(Poly.fromCoeffs([F(0), m])) : `(${m.toString().replace('-', '−')})x`;
    return { q: `y = ${slope}${b ? ` ${b < 0 ? '−' : '+'} ${Math.abs(b)}` : ''}`, level: 'Line' };
  },
  // y = a(x - h)² + k
  (r) => {
    const a = pick(r, [1, 1, -1, 2]);
    const h = int(r, -4, 4);
    const k = int(r, -6, 6);
    return { q: `y = ${s(px(a, -2 * a * h, a * h * h + k))}`, level: 'Parabola' };
  },
  // ax + by = c
  (r) => {
    const a = nz(r, -5, 5);
    const b = int(r, 2, 5);
    const c = int(r, -12, 12);
    return { q: `${xy(a, b)} = ${c}`, level: 'Isolate y' };
  },
  // circle
  (r) => {
    const rad = int(r, 2, 6);
    const h = int(r, -3, 3);
    const k = int(r, -3, 3);
    const sq = (v: string, c: number) => (c === 0 ? `${v}²` : `(${v} ${c > 0 ? '−' : '+'} ${Math.abs(c)})²`);
    return { q: `${sq('x', h)} + ${sq('y', k)} = ${rad * rad}`, level: 'Circle' };
  },
  // system: two lines through an integer point
  (r) => {
    const x0 = int(r, -5, 5);
    const y0 = int(r, -5, 5);
    const m = nz(r, -3, 3);
    const a = nz(r, -4, 4);
    let b = nz(r, -4, 4);
    if (a * 1 + b * -m === 0 || b === 0) b = b + 1 || 1;
    return { q: `y = ${s(px(m, y0 - m * x0))}; ${xy(a, b)} = ${a * x0 + b * y0}`, level: 'System' };
  },
  // system: parabola and line with integer crossings
  (r) => {
    const r1 = int(r, -4, 3);
    const r2 = r1 + int(r, 1, 4);
    const k = int(r, -4, 3);
    return { q: `y = ${s(px(1, 0, k))}; y = ${s(px(r1 + r2, k - r1 * r2))}`, level: 'System' };
  },
  // system: circle radius 5 and a line through two of its whole-number points
  (r) => {
    const P: [number, number][] = [
      [3, 4], [4, 3], [5, 0], [0, 5], [-3, 4], [-4, 3], [-5, 0], [0, -5], [3, -4], [4, -3], [-3, -4], [-4, -3],
    ];
    const p = pick(r, P);
    let q = pick(r, P);
    while (q === p || (q[0] === -p[0] && q[1] === -p[1])) q = pick(r, P);
    const a = q[1] - p[1];
    const b = p[0] - q[0];
    const c = a * p[0] + b * p[1];
    return { q: `x² + y² = 25; ${xy(a, b)} = ${c}`, level: 'System' };
  },
  // 3D surfaces
  (r) => ({
    q: pick(r, ['z = x² + y²', 'z = x² − y²', 'z = x·y', 'z = sin(x) + cos(y)', 'z = 4 − x² − y²', 'z = x² − 2y', 'z = sqrt(x² + y²)']),
    level: '3D',
  }),
];

/** Small seeded random generator (mulberry32). */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` new examples, skipping any formula already in `seen` (which is updated). */
export function generateExamples(r: Rng, n: number, seen: Set<string>): Example[] {
  const out: Example[] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    // Cycle through the kinds so every batch is varied.
    const g = GENERATORS[(out.length + Math.floor(r() * GENERATORS.length)) % GENERATORS.length];
    const ex = g(r);
    const key = normKey(ex.q);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ex);
  }
  return out;
}

/** Same formula typed slightly differently → same key. */
export function normKey(q: string): string {
  return q.replace(/\s+/g, '').replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').toLowerCase();
}

/** Show ^2 as ², - as −, for display. */
export function pretty(q: string): string {
  return q.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/-/g, '−').replace(/\s*;\s*/g, '; ');
}
