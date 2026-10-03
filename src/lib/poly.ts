// Polynomials in x and y with exact rational coefficients.
// A term x^i y^j is stored under the key "i,j".

import { Fraction, F } from './fraction';

export class Poly {
  readonly terms: Map<string, Fraction>;

  constructor(terms?: Map<string, Fraction>) {
    this.terms = new Map();
    if (terms) for (const [k, v] of terms) if (!v.isZero()) this.terms.set(k, v);
  }

  static const(c: Fraction | number): Poly {
    return new Poly(new Map([['0,0', typeof c === 'number' ? F(c) : c]]));
  }
  static x(): Poly {
    return new Poly(new Map([['1,0', F(1)]]));
  }
  static y(): Poly {
    return new Poly(new Map([['0,1', F(1)]]));
  }
  /** Univariate polynomial in x from coefficients indexed by degree. */
  static fromCoeffs(cs: Fraction[]): Poly {
    const m = new Map<string, Fraction>();
    cs.forEach((c, i) => m.set(`${i},0`, c));
    return new Poly(m);
  }

  coef(i: number, j = 0): Fraction {
    return this.terms.get(`${i},${j}`) ?? Fraction.ZERO;
  }

  add(o: Poly): Poly {
    const m = new Map(this.terms);
    for (const [k, v] of o.terms) m.set(k, (m.get(k) ?? Fraction.ZERO).add(v));
    return new Poly(m);
  }
  sub(o: Poly): Poly {
    return this.add(o.scale(F(-1)));
  }
  scale(c: Fraction): Poly {
    const m = new Map<string, Fraction>();
    for (const [k, v] of this.terms) m.set(k, v.mul(c));
    return new Poly(m);
  }
  mul(o: Poly): Poly {
    const m = new Map<string, Fraction>();
    for (const [k1, v1] of this.terms) {
      const [i1, j1] = k1.split(',').map(Number);
      for (const [k2, v2] of o.terms) {
        const [i2, j2] = k2.split(',').map(Number);
        const k = `${i1 + i2},${j1 + j2}`;
        m.set(k, (m.get(k) ?? Fraction.ZERO).add(v1.mul(v2)));
      }
    }
    return new Poly(m);
  }
  pow(n: number): Poly {
    let r = Poly.const(1);
    for (let i = 0; i < n; i++) r = r.mul(this);
    return r;
  }

  isZero(): boolean {
    return this.terms.size === 0;
  }
  /** Constant value if the polynomial has no variables, else null. */
  constValue(): Fraction | null {
    if (this.isZero()) return Fraction.ZERO;
    if (this.terms.size === 1 && this.terms.has('0,0')) return this.coef(0, 0);
    return null;
  }
  degX(): number {
    let d = 0;
    for (const k of this.terms.keys()) d = Math.max(d, Number(k.split(',')[0]));
    return d;
  }
  degY(): number {
    let d = 0;
    for (const k of this.terms.keys()) d = Math.max(d, Number(k.split(',')[1]));
    return d;
  }
  hasY(): boolean {
    return this.degY() > 0;
  }
  /** True when every y-term is exactly c·y (no x·y, no y²). */
  isLinearInYOnly(): boolean {
    for (const k of this.terms.keys()) {
      const [i, j] = k.split(',').map(Number);
      if (j > 1 || (j === 1 && i > 0)) return false;
    }
    return true;
  }
  /** Coefficients of x^0..x^deg (ignores y-terms). */
  coeffsX(): Fraction[] {
    const out: Fraction[] = [];
    for (let i = 0; i <= this.degX(); i++) out.push(this.coef(i, 0));
    return out;
  }
  /** Only the y-free part. */
  xPart(): Poly {
    const m = new Map<string, Fraction>();
    for (const [k, v] of this.terms) if (k.endsWith(',0')) m.set(k, v);
    return new Poly(m);
  }
  /** Keep only the terms of the given x-degree (y-free). */
  termX(i: number): Poly {
    return new Poly(new Map([[`${i},0`, this.coef(i, 0)]]));
  }

  evalX(x: number, y = 0): number {
    let s = 0;
    for (const [k, v] of this.terms) {
      const [i, j] = k.split(',').map(Number);
      s += v.value() * x ** i * y ** j;
    }
    return s;
  }

  /** Terms sorted: highest x-degree first, y-terms before x-terms of equal total. */
  private sortedKeys(): string[] {
    return [...this.terms.keys()].sort((a, b) => {
      const [ai, aj] = a.split(',').map(Number);
      const [bi, bj] = b.split(',').map(Number);
      return bi + bj - (ai + aj) || bj - aj || bi - ai;
    });
  }

  toLatex(): string {
    if (this.isZero()) return '0';
    let s = '';
    this.sortedKeys().forEach((k, idx) => {
      const [i, j] = k.split(',').map(Number);
      const c = this.coef(i, j);
      const mono = monoLatex(i, j);
      const abs = c.abs();
      let body = mono ? (abs.eq(Fraction.ONE) ? mono : abs.toLatex() + mono) : abs.toLatex();
      if (idx === 0) s += (c.sign() < 0 ? '-' : '') + body;
      else s += (c.sign() < 0 ? ' - ' : ' + ') + body;
    });
    return s;
  }
  /** Plain text with superscripts, e.g. "x³ + 3x² − 1". */
  toString(): string {
    return latexToPlain(this.toLatex());
  }
}

function monoLatex(i: number, j: number): string {
  const p = (v: string, e: number) => (e === 0 ? '' : e === 1 ? v : `${v}^{${e}}`);
  return p('x', i) + p('y', j);
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Simple LaTeX → readable text, for titles and 3D labels. */
export function latexToPlain(s: string): string {
  return s
    .replace(/\\left|\\right/g, '')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√$1')
    .replace(/\\t?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_m, a: string, b: string) => `${/\s/.test(a.trim()) ? `(${a})` : a}/${b}`)
    .replace(/\^\{?(\d+)\}?/g, (_m, d: string) => [...d].map((c) => SUP[+c]).join(''))
    .replace(/\\cdot/g, '·')
    .replace(/\\approx\s*/g, '≈')
    .replace(/[{}]/g, '')
    .replace(/-/g, '−');
}
