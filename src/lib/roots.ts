// Factoring and root finding for polynomials in x.

import { Fraction, F } from './fraction';
import { Poly } from './poly';

function gcdInt(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
function lcmInt(a: number, b: number): number {
  return (a / gcdInt(a, b)) * b;
}

/** Coefficients (low→high) scaled to integers with no common factor. */
export function integerCoeffs(cs: Fraction[]): number[] {
  const l = cs.reduce((acc, c) => lcmInt(acc, c.d), 1);
  const ints = cs.map((c) => (c.n * l) / c.d);
  const g = ints.reduce((acc, v) => gcdInt(acc, v), 0) || 1;
  return ints.map((v) => v / g);
}

/** Common integer factor of all coefficients (only when they are all integers). */
export function integerContent(cs: Fraction[]): number {
  if (!cs.every((c) => c.isInt())) return 1;
  return cs.reduce((acc, c) => gcdInt(acc, c.n), 0) || 1;
}

function divisors(n: number): number[] {
  n = Math.abs(n);
  const out: number[] = [];
  if (n > 1e7) return [1];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i);
      if (i * i !== n) out.push(n / i);
    }
  }
  return out.sort((a, b) => a - b);
}

export function evalFrac(cs: Fraction[], x: Fraction): Fraction {
  let s = Fraction.ZERO;
  for (let i = cs.length - 1; i >= 0; i--) s = s.mul(x).add(cs[i]);
  return s;
}

/** Synthetic division by (x - r); returns the quotient coefficients (low→high). */
export function divideByRoot(cs: Fraction[], r: Fraction): Fraction[] {
  const n = cs.length - 1;
  const q: Fraction[] = new Array(n);
  let carry = Fraction.ZERO;
  for (let i = n; i >= 1; i--) {
    carry = cs[i].add(carry.mul(r));
    q[i - 1] = carry;
  }
  return q;
}

/** One rational root of the polynomial (coefficients low→high), if any. */
export function findRationalRoot(cs: Fraction[]): Fraction | null {
  if (cs.length < 2) return null;
  if (cs[0].isZero()) return Fraction.ZERO;
  const ints = integerCoeffs(cs);
  const ps = divisors(ints[0]);
  const qs = divisors(ints[ints.length - 1]);
  const cands: Fraction[] = [];
  for (const p of ps) for (const q of qs) cands.push(F(p, q), F(-p, q));
  // Try small, simple candidates first: that's also how a student would try them.
  cands.sort((a, b) => Math.abs(a.value()) - Math.abs(b.value()) || a.d - b.d || b.value() - a.value());
  for (const c of cands) if (evalFrac(cs, c).isZero()) return c;
  return null;
}

export interface Factored {
  /** Leading constant. */
  c: Fraction;
  /** Power of x taken out first. */
  xPower: number;
  /** Rational roots found (excluding 0), with repetition. */
  roots: Fraction[];
  /** What's left (coefficients low→high), degree 0 when fully factored. */
  rest: Fraction[];
}

export function factor(cs: Fraction[]): Factored {
  cs = trim(cs);
  let xPower = 0;
  while (cs.length > 1 && cs[0].isZero()) {
    cs = cs.slice(1);
    xPower++;
  }
  const roots: Fraction[] = [];
  let r: Fraction | null;
  while (cs.length > 1 && (r = findRationalRoot(cs))) {
    roots.push(r);
    cs = divideByRoot(cs, r);
  }
  const lead = cs[cs.length - 1];
  return { c: lead, xPower, roots, rest: cs.map((v) => v.div(lead)) };
}

export function trim(cs: Fraction[]): Fraction[] {
  const out = cs.slice();
  while (out.length > 1 && out[out.length - 1].isZero()) out.pop();
  return out;
}

/** Real roots of any polynomial found numerically (sorted, de-duplicated). */
export function numericRoots(cs: Fraction[]): number[] {
  const f = (x: number) => cs.reduce((s, c, i) => s + c.value() * x ** i, 0);
  const lead = cs[cs.length - 1].value();
  const bound = 1 + Math.max(...cs.slice(0, -1).map((c) => Math.abs(c.value() / lead)), 0);
  return numericZeros(f, -bound, bound);
}

/** Zeros of a continuous function on [a, b] by sampling + bisection. */
export function numericZeros(f: (x: number) => number, a: number, b: number, n = 4000): number[] {
  const out: number[] = [];
  let px = a;
  let pv = f(a);
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const v = f(x);
    if (Number.isFinite(v) && Number.isFinite(pv)) {
      if (v === 0) out.push(x);
      else if (pv !== 0 && Math.sign(v) !== Math.sign(pv)) {
        let lo = px;
        let hi = x;
        for (let k = 0; k < 80; k++) {
          const m = (lo + hi) / 2;
          if (Math.sign(f(m)) === Math.sign(f(lo))) lo = m;
          else hi = m;
        }
        const root = (lo + hi) / 2;
        // A sign change across a pole (like 1/x) is not a zero.
        if (Math.abs(f(root)) < 1e-6 * (1 + Math.abs(pv) + Math.abs(v))) out.push(root);
      } else {
        // Touching zero (like x^2): look for a tiny local minimum of |f|.
        const nx = x + (b - a) / n;
        const nv = f(nx);
        if (Math.abs(v) < Math.abs(pv) && Math.abs(v) < Math.abs(nv) && Math.abs(v) < 1e-9) out.push(x);
      }
    }
    px = x;
    pv = v;
  }
  return dedupe(out);
}

function dedupe(xs: number[]): number[] {
  const out: number[] = [];
  for (const x of xs.sort((p, q) => p - q)) if (!out.length || Math.abs(out[out.length - 1] - x) > 1e-6) out.push(x);
  return out.map((x) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : x));
}

/** √n written as k√m. */
export function simplifySqrt(n: number): { k: number; m: number } {
  let k = 1;
  let m = n;
  for (let i = 2; i * i <= m; i++) {
    while (m % (i * i) === 0) {
      m /= i * i;
      k *= i;
    }
  }
  return { k, m };
}

export interface QuadSolution {
  a: number;
  b: number;
  c: number;
  disc: number;
  /** LaTeX for each real root in exact form. */
  exact: string[];
  values: number[];
}

/** Quadratic formula with exact surd answers. Coefficients low→high. */
export function solveQuadratic(cs: Fraction[]): QuadSolution {
  const [c, b, a] = integerCoeffs(cs).map((v, _i, arr) => (arr[2] < 0 ? -v : v));
  const disc = b * b - 4 * a * c;
  const res: QuadSolution = { a, b, c, disc, exact: [], values: [] };
  if (disc < 0) return res;
  const { k, m } = simplifySqrt(disc);
  if (m === 1) {
    const r1 = F(-b + k, 2 * a);
    const r2 = F(-b - k, 2 * a);
    const roots = r1.eq(r2) ? [r1] : [r2, r1].sort((p, q) => p.value() - q.value());
    res.exact = roots.map((r) => r.toLatex());
    res.values = roots.map((r) => r.value());
    return res;
  }
  // (-b ± k√m) / 2a, reduced by the common factor of b, k and 2a.
  let den = 2 * a;
  let nb = -b;
  let nk = k;
  const g = gcdInt(gcdInt(nb, nk), den);
  nb /= g;
  nk /= g;
  den /= g;
  if (den < 0) {
    den = -den;
    nb = -nb;
  }
  const surd = `${nk === 1 ? '' : nk}\\sqrt{${m}}`;
  const top = (sgn: string) => (nb === 0 ? (sgn === '-' ? '-' : '') + surd : `${nb} ${sgn} ${surd}`);
  const wrap = (s: string) => (den === 1 ? s : `\\frac{${s}}{${den}}`);
  res.exact = [wrap(top('-')), wrap(top('+'))];
  res.values = [(nb - nk * Math.sqrt(m)) / den, (nb + nk * Math.sqrt(m)) / den];
  return res;
}

export function fmtNum(v: number, digits = 3): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) return `${Math.round(v)}`;
  return `${+v.toFixed(digits)}`;
}

export function linearFactorLatex(r: Fraction): string {
  // (x - r) written with integers: r = p/q → (qx - p)
  const p = r.n;
  const q = r.d;
  const xs = q === 1 ? 'x' : `${q}x`;
  if (p === 0) return 'x';
  return `(${xs} ${p > 0 ? '-' : '+'} ${Math.abs(p)})`;
}

export function polyFromCoeffs(cs: Fraction[]): Poly {
  return Poly.fromCoeffs(cs);
}
