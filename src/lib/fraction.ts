// Exact rational numbers so steps read "x = 3/2" instead of "x = 1.4999999".

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export class Fraction {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('Division by zero');
    if (!Number.isInteger(n) || !Number.isInteger(d)) {
      // Turn finite decimals like 0.25 into 1/4.
      const f = Fraction.fromDecimal(n / d);
      n = f.n;
      d = f.d;
    }
    const g = gcd(n, d);
    const s = d < 0 ? -1 : 1;
    this.n = (s * n) / g;
    this.d = (s * d) / g;
  }

  static fromDecimal(x: number): Fraction {
    if (Number.isInteger(x)) return new Fraction(x, 1);
    let d = 1;
    while (!Number.isInteger(Math.round(x * d * 1e9) / 1e9) && d < 1e9) d *= 10;
    return new Fraction(Math.round(x * d), d);
  }

  static readonly ZERO = new Fraction(0);
  static readonly ONE = new Fraction(1);

  add(o: Fraction): Fraction {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Fraction): Fraction {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Fraction): Fraction {
    return new Fraction(this.n * o.n, this.d * o.d);
  }
  div(o: Fraction): Fraction {
    return new Fraction(this.n * o.d, this.d * o.n);
  }
  neg(): Fraction {
    return new Fraction(-this.n, this.d);
  }
  abs(): Fraction {
    return new Fraction(Math.abs(this.n), this.d);
  }
  isZero(): boolean {
    return this.n === 0;
  }
  isInt(): boolean {
    return this.d === 1;
  }
  sign(): number {
    return Math.sign(this.n);
  }
  eq(o: Fraction): boolean {
    return this.n === o.n && this.d === o.d;
  }
  value(): number {
    return this.n / this.d;
  }
  toString(): string {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }
  toLatex(): string {
    if (this.d === 1) return `${this.n}`;
    const sign = this.n < 0 ? '-' : '';
    return `${sign}\\tfrac{${Math.abs(this.n)}}{${this.d}}`;
  }
}

export const F = (n: number, d = 1) => new Fraction(n, d);
