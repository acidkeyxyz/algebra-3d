// Parses what students type: "y = 2x + 3", "x^3+3x^2=0", "2(x-1) = x + 4",
// "x² + y² = 25", "z = x^2 - y^2". Implicit multiplication is allowed.

import { Poly } from './poly';
import { F, Fraction } from './fraction';
import { T } from './i18n';

export type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: 'x' | 'y' | 'z' }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'call'; fn: string; a: Node };

type Tok =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string };

const FUNCS = ['sqrt', 'sin', 'cos', 'tan', 'abs', 'ln', 'log', 'exp'];
const CONSTS: Record<string, number> = { pi: Math.PI, 'π': Math.PI, e: Math.E };

export class ParseError extends Error {}

export function normalize(src: string): string {
  return src
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/\*\*/g, '^')
    .replace(/,/g, '.')
    .replace(/√/g, 'sqrt')
    .replace(/[X]/g, 'x')
    .replace(/[Y]/g, 'y')
    .replace(/[Z]/g, 'z');
}

function tokenize(src: string): Tok[] {
  const s = normalize(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (Number.isNaN(v)) throw new ParseError(T(`"${s.slice(i, j)}" is not a number`, `"${s.slice(i, j)}" no es un número`));
      out.push({ k: 'num', v });
      i = j;
    } else if (/[a-zπ]/i.test(c)) {
      // Longest known function/constant name, otherwise a single letter
      // (so "xy" is x·y and "2x" is 2·x).
      const rest = s.slice(i).toLowerCase();
      const name = [...FUNCS, ...Object.keys(CONSTS)]
        .sort((a, b) => b.length - a.length)
        .find((n) => rest.startsWith(n) && !(n === 'e' && /^e[a-z]/.test(rest) && !rest.startsWith('exp')));
      const id = name ?? c.toLowerCase();
      if (!name && !['x', 'y', 'z'].includes(id))
        throw new ParseError(T(`Unknown letter "${c}". Use x, y (and z for 3D surfaces).`, `Letra desconocida "${c}". Usa x, y (y z para superficies 3D).`));
      out.push({ k: 'id', v: id });
      i += id.length;
    } else if ('+-*/^()=[]'.includes(c)) {
      out.push({ k: 'op', v: c === '[' ? '(' : c === ']' ? ')' : c });
      i++;
    } else {
      throw new ParseError(T(`Unexpected symbol "${c}"`, `Símbolo inesperado "${c}"`));
    }
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  peek(): Tok | undefined {
    return this.toks[this.p];
  }
  isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.k === 'op' && t.v === v;
  }
  eat(v: string) {
    if (!this.isOp(v)) throw new ParseError(T(`Expected "${v}"`, `Falta "${v}"`));
    this.p++;
  }
  done(): boolean {
    return this.p >= this.toks.length;
  }

  expr(): Node {
    let a = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.p++] as { v: '+' | '-' }).v;
      a = { t: 'bin', op, a, b: this.term() };
    }
    return a;
  }
  term(): Node {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.p++] as { v: '*' | '/' }).v;
        a = { t: 'bin', op, a, b: this.unary() };
      } else if (this.startsAtom()) {
        a = { t: 'bin', op: '*', a, b: this.power() };
      } else return a;
    }
  }
  startsAtom(): boolean {
    const t = this.peek();
    return !!t && (t.k === 'num' || t.k === 'id' || (t.k === 'op' && t.v === '('));
  }
  unary(): Node {
    if (this.isOp('-')) {
      this.p++;
      return { t: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.p++;
      return this.unary();
    }
    return this.power();
  }
  power(): Node {
    const base = this.atom();
    if (this.isOp('^')) {
      this.p++;
      return { t: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }
  atom(): Node {
    const t = this.peek();
    if (!t) throw new ParseError(T('The expression ends too early', 'La expresión termina antes de tiempo'));
    if (t.k === 'num') {
      this.p++;
      return { t: 'num', v: t.v };
    }
    if (t.k === 'id') {
      this.p++;
      if (t.v in CONSTS) return { t: 'num', v: CONSTS[t.v] };
      if (FUNCS.includes(t.v)) {
        if (this.isOp('(')) {
          this.p++;
          const a = this.expr();
          this.eat(')');
          return { t: 'call', fn: t.v, a };
        }
        return { t: 'call', fn: t.v, a: this.power() };
      }
      return { t: 'var', name: t.v as 'x' | 'y' | 'z' };
    }
    if (t.v === '(') {
      this.p++;
      const a = this.expr();
      this.eat(')');
      return a;
    }
    throw new ParseError(T(`Unexpected "${t.v}"`, `"${t.v}" inesperado`));
  }
}

export interface Parsed {
  left: Node;
  right: Node | null; // null when there is no "="
}

export function parseInput(src: string): Parsed {
  if (!src.trim()) throw new ParseError(T('Type an equation, for example y = x + 2', 'Escribe una ecuación, por ejemplo y = x + 2'));
  const toks = tokenize(src);
  const eqs = toks.filter((t) => t.k === 'op' && t.v === '=').length;
  if (eqs > 1) throw new ParseError(T('Use only one "=" sign', 'Usa solo un signo "="'));
  const parser = new Parser(toks);
  const left = parser.expr();
  let right: Node | null = null;
  if (parser.isOp('=')) {
    parser.eat('=');
    right = parser.expr();
  }
  if (!parser.done()) {
    const t = parser.peek()!;
    throw new ParseError(
      t.k === 'op' && t.v === ')'
        ? T('Too many ")"', 'Sobran ")"')
        : T(`Unexpected "${'v' in t ? t.v : ''}"`, `"${'v' in t ? t.v : ''}" inesperado`),
    );
  }
  return { left, right };
}

/** Polynomial form of an AST, or null if it is not a polynomial in x and y. */
export function toPoly(n: Node): Poly | null {
  switch (n.t) {
    case 'num':
      return Poly.const(Fraction.fromDecimal(n.v));
    case 'var':
      return n.name === 'x' ? Poly.x() : n.name === 'y' ? Poly.y() : null;
    case 'neg': {
      const a = toPoly(n.a);
      return a && a.scale(F(-1));
    }
    case 'call':
      return null;
    case 'bin': {
      const a = toPoly(n.a);
      const b = toPoly(n.b);
      if (!a || !b) return null;
      if (n.op === '+') return a.add(b);
      if (n.op === '-') return a.sub(b);
      if (n.op === '*') return a.mul(b);
      if (n.op === '/') {
        const c = b.constValue();
        if (!c || c.isZero()) return null;
        return a.scale(F(1).div(c));
      }
      const e = b.constValue();
      if (!e || !e.isInt() || e.n < 0 || e.n > 12) return null;
      return a.pow(e.n);
    }
  }
}

export function usesVar(n: Node, name: string): boolean {
  switch (n.t) {
    case 'num':
      return false;
    case 'var':
      return n.name === name;
    case 'neg':
    case 'call':
      return usesVar(n.a, name);
    case 'bin':
      return usesVar(n.a, name) || usesVar(n.b, name);
  }
}

export type Fn = (x: number, y?: number) => number;

/** Compiles an AST into a plain numeric function. */
export function compile(n: Node): Fn {
  switch (n.t) {
    case 'num':
      return () => n.v;
    case 'var':
      return n.name === 'x' ? (x) => x : n.name === 'y' ? (_x, y = 0) => y : () => NaN;
    case 'neg': {
      const a = compile(n.a);
      return (x, y) => -a(x, y);
    }
    case 'call': {
      const a = compile(n.a);
      const f: Record<string, (v: number) => number> = {
        sqrt: Math.sqrt,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        abs: Math.abs,
        ln: Math.log,
        log: Math.log10,
        exp: Math.exp,
      };
      const g = f[n.fn];
      return (x, y) => g(a(x, y));
    }
    case 'bin': {
      const a = compile(n.a);
      const b = compile(n.b);
      switch (n.op) {
        case '+':
          return (x, y) => a(x, y) + b(x, y);
        case '-':
          return (x, y) => a(x, y) - b(x, y);
        case '*':
          return (x, y) => a(x, y) * b(x, y);
        case '/':
          return (x, y) => a(x, y) / b(x, y);
        case '^':
          return (x, y) => a(x, y) ** b(x, y);
      }
    }
  }
}

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };

/** LaTeX of the expression exactly as the student wrote it (not simplified). */
export function nodeLatex(n: Node, parentPrec = 0): string {
  const wrap = (s: string, p: number) => (p < parentPrec ? `\\left(${s}\\right)` : s);
  switch (n.t) {
    case 'num':
      return Math.abs(n.v - Math.PI) < 1e-12 ? '\\pi' : `${+n.v.toFixed(6)}`;
    case 'var':
      return n.name;
    case 'neg':
      return wrap(`-${nodeLatex(n.a, 3)}`, 3);
    case 'call':
      if (n.fn === 'sqrt') return `\\sqrt{${nodeLatex(n.a)}}`;
      if (n.fn === 'abs') return `\\left|${nodeLatex(n.a)}\\right|`;
      return `\\${n.fn === 'log' ? 'log' : n.fn}\\left(${nodeLatex(n.a)}\\right)`;
    case 'bin': {
      const p = PREC[n.op];
      if (n.op === '/') return wrap(`\\frac{${nodeLatex(n.a)}}{${nodeLatex(n.b)}}`, p);
      if (n.op === '^') return wrap(`${nodeLatex(n.a, 5)}^{${nodeLatex(n.b)}}`, p);
      if (n.op === '*') {
        const l = nodeLatex(n.a, p);
        const r = nodeLatex(n.b, p + 0.5);
        // 2x, 3(x+1), x(x+2) read naturally; 2·3 needs a dot.
        const needDot = /[0-9}]$/.test(l) && /^[0-9-]/.test(r);
        return wrap(`${l}${needDot ? ' \\cdot ' : ''}${r}`, p);
      }
      const r = nodeLatex(n.b, n.op === '-' ? p + 0.5 : p);
      return wrap(`${nodeLatex(n.a, p)} ${n.op} ${r}`, p);
    }
  }
}
