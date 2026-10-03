// Systems of equations in x and y, separated by ";" (up to 10):
// graph every equation, solve pairs step by step (substitution), mark intersections.

import { Fraction, F } from './fraction';
import { Poly, latexToPlain } from './poly';
import { compile, nodeLatex, parseInput, toPoly, usesVar, ParseError, type Node } from './parser';
import { evalFrac, factor, fmtNum, linearFactorLatex, numericRoots, numericZeros, solveQuadratic, trim } from './roots';
import { T } from './i18n';
import { makeFrame } from './solver';
import { COLORS, type GCurve, type GImplicit, type GPoint, type GSeg, type GraphFrame, type Scene, type Solution, type Step } from './scene';

export const MAX_EQS = 10;

/** Spread curve labels along the curves so they don't pile up at a crossing. */
const LABEL_AT = [0.92, 0.1, 0.72, 0.3, 0.55, 0.82, 0.2, 0.62, 0.4, 0.97];

const PALETTE = ['#38bdf8', '#f472b6', '#a3e635', '#fbbf24', '#c084fc', '#2dd4bf', '#fb923c', '#60a5fa', '#f87171', '#4ade80'];

type F2 = (x: number, y: number) => number;

interface Eq {
  n: number;
  left: Node | null;
  right: Node | null;
  latex: string;
  L: Poly | null;
  R: Poly | null;
  D: Poly | null;
  F: F2;
  color: string;
  label: string;
  /** y = explicit(x), for drawing as an ordinary curve. */
  explicit?: (x: number) => number;
  /** Exact y = g(x) when the equation is polynomial and linear in y. */
  g?: Poly;
}

interface Pt {
  x: number;
  y: number;
  xl: string;
  yl: string;
}

interface PairResult {
  pts: Pt[];
  infinite: boolean;
  steps: Step[];
  /** One-line LaTeX summary, used when there are many equations. */
  summary: string;
  method: string;
}

// ------------------------------------------------------------ small helpers

const isVar = (n: Node | null, v: string) => !!n && n.t === 'var' && n.name === v;

/** Exchange the roles of x and y in a polynomial. */
function swapXY(p: Poly): Poly {
  const m = new Map<string, Fraction>();
  for (const [k, v] of p.terms) {
    const [i, j] = k.split(',');
    m.set(`${j},${i}`, v);
  }
  return new Poly(m);
}

const swapLatex = (s: string) => s.replace(/x/g, '\u0000').replace(/y/g, 'x').replace(/\u0000/g, 'y');

/** P(x, g(x)) for a polynomial g in x. */
function substituteY(p: Poly, g: Poly): Poly {
  let out = Poly.const(0);
  for (const [k, c] of p.terms) {
    const [i, j] = k.split(',').map(Number);
    out = out.add(Poly.x().pow(i).mul(g.pow(j)).scale(c));
  }
  return out;
}

/** y = g(x) if the polynomial is c·y + (terms in x only). */
function isolateY(D: Poly | null): { g: Poly; c: Fraction } | null {
  if (!D || D.degY() !== 1 || !D.isLinearInYOnly()) return null;
  const c = D.coef(0, 1);
  return { g: D.xPart().scale(F(-1).div(c)), c };
}

function quadPart(p: Poly): Poly {
  return new Poly(new Map([...p.terms].filter(([k]) => k.split(',').map(Number).reduce((a, b) => a + b) === 2)));
}

function totalDeg(p: Poly): number {
  let d = 0;
  for (const k of p.terms.keys()) d = Math.max(d, k.split(',').map(Number).reduce((a, b) => a + b));
  return d;
}

const ptLabel = (p: Pt) => `(${latexToPlain(p.xl)}, ${latexToPlain(p.yl)})`;
const ptLatex = (p: Pt) => `(${p.xl},\\ ${p.yl})`;

function dedupePts(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6)) out.push(p);
  return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

function numPt(x: number, y: number): Pt {
  return { x, y, xl: fmtNum(x, 3), yl: fmtNum(y, 3) };
}

// ------------------------------------------------------------ parsing

function parseEq(src: string, n: number): Eq {
  let { left, right } = parseInput(src);
  if (!right) {
    if (usesVar(left, 'y')) throw new ParseError(T(`Equation (${n}) needs an "=" sign`, `La ecuación (${n}) necesita un signo "="`));
    right = left;
    left = { t: 'var', name: 'y' };
  }
  if (usesVar(left, 'z') || usesVar(right, 'z'))
    throw new ParseError(T('Systems use only x and y (no z) for now', 'Por ahora los sistemas usan solo x y y (sin z)'));
  const L = toPoly(left);
  const R = toPoly(right);
  const D = L && R ? L.sub(R) : null;
  const fl = compile(left);
  const fr = compile(right);
  const latex = `${nodeLatex(left)} = ${nodeLatex(right)}`;
  const e: Eq = {
    n,
    left,
    right,
    latex,
    L,
    R,
    D,
    F: (x, y) => fl(x, y) - fr(x, y),
    color: PALETTE[(n - 1) % PALETTE.length],
    label: `(${n}) ${latexToPlain(latex).replace(/\\[a-z]+/g, '')}`,
  };
  if (D && !D.hasY() && D.degX() === 0)
    throw new ParseError(T(`Equation (${n}) has no x or y`, `La ecuación (${n}) no tiene x ni y`));
  const iso = isolateY(D);
  if (iso) {
    e.g = iso.g;
    e.explicit = (x) => iso.g.evalX(x);
  } else if (!D && isVar(left, 'y') && !usesVar(right, 'y')) e.explicit = (x) => fr(x);
  else if (!D && isVar(right, 'y') && !usesVar(left, 'y')) e.explicit = (x) => fl(x);
  return e;
}

function lineEq(D: Poly, n: number): Eq {
  const iso = isolateY(D);
  return {
    n,
    left: null,
    right: null,
    latex: `${D.toLatex()} = 0`,
    L: D,
    R: Poly.const(0),
    D,
    F: (x, y) => D.evalX(x, y),
    color: COLORS.rise,
    label: '',
    g: iso?.g,
    explicit: iso ? (x) => iso.g.evalX(x) : undefined,
  };
}

// ------------------------------------------------------------ describing one equation

interface Described {
  text: string;
  latex: string;
  pts: GPoint[];
  xs: number[];
  ys: number[];
}

function describe(e: Eq): Described {
  const D = e.D;
  const out: Described = { text: '', latex: e.latex, pts: [], xs: [], ys: [] };
  const alreadyY = isVar(e.left, 'y') && !!e.right && !usesVar(e.right, 'y');
  if (D && totalDeg(D) === 1) {
    if (e.g) {
      const m = e.g.coef(1);
      const b = e.g.coef(0);
      out.latex = alreadyY ? e.latex : `${e.latex} \\;\\Rightarrow\\; y = ${e.g.toLatex()}`;
      out.text = T(
        `${alreadyY ? '' : 'Solving for y, '}this is a straight line with slope m = ${m} and y-intercept b = ${b}.`,
        `${alreadyY ? '' : 'Despejando y, '}es una recta con pendiente m = ${m} y ordenada al origen b = ${b}.`,
      );
      out.pts.push(gp(`b${e.n}`, 0, b.value(), e.color, `(0, ${b})`));
      out.ys.push(b.value());
    } else {
      const xv = D.coef(0).neg().div(D.coef(1));
      out.latex = `${e.latex} \\;\\Rightarrow\\; x = ${xv.toLatex()}`;
      out.text = T(`There is no y, so x is always ${xv}: a vertical line.`, `No hay y, así que x siempre vale ${xv}: una recta vertical.`);
      out.xs.push(xv.value());
    }
    return out;
  }
  if (e.g && e.g.degX() === 2) {
    const a = e.g.coef(2);
    const b = e.g.coef(1);
    const xv = b.neg().div(a.mul(F(2)));
    const yv = evalFrac(e.g.coeffsX(), xv);
    out.latex = alreadyY ? e.latex : `${e.latex} \\;\\Rightarrow\\; y = ${e.g.toLatex()}`;
    out.text = T(
      `A parabola that opens ${a.sign() > 0 ? 'upwards ∪' : 'downwards ∩'}, with vertex (${xv}, ${yv}).`,
      `Una parábola que abre hacia ${a.sign() > 0 ? 'arriba ∪' : 'abajo ∩'}, con vértice (${xv}, ${yv}).`,
    );
    out.pts.push(gp(`v${e.n}`, xv.value(), yv.value(), e.color, T(`vertex (${xv}, ${yv})`, `vértice (${xv}, ${yv})`)));
    out.xs.push(xv.value());
    out.ys.push(yv.value());
    return out;
  }
  if (D && totalDeg(D) === 2 && D.coef(1, 1).isZero() && !D.coef(2, 0).isZero() && D.coef(2, 0).eq(D.coef(0, 2))) {
    const a = D.coef(2, 0);
    const h = D.coef(1, 0).div(a).div(F(-2));
    const k = D.coef(0, 1).div(a).div(F(-2));
    const r2 = h.mul(h).add(k.mul(k)).sub(D.coef(0, 0).div(a));
    if (r2.sign() > 0) {
      const r = Math.sqrt(r2.value());
      const rs = Number.isInteger(r) ? `${r}` : `√${r2} ≈ ${fmtNum(r)}`;
      out.text = T(
        `x² and y² have the same coefficient: a circle with centre (${h}, ${k}) and radius ${rs}.`,
        `x² y y² tienen el mismo coeficiente: una circunferencia con centro (${h}, ${k}) y radio ${rs}.`,
      );
      out.pts.push(gp(`c${e.n}`, h.value(), k.value(), e.color, T(`centre (${h}, ${k})`, `centro (${h}, ${k})`)));
      out.xs.push(h.value() - r, h.value() + r);
      out.ys.push(k.value() - r, k.value() + r);
      return out;
    }
  }
  if (D && swapXY(D).degY() === 1 && swapXY(D).isLinearInYOnly() && D.degY() === 2) {
    const h = isolateY(swapXY(D))!.g;
    out.latex = `${e.latex} \\;\\Rightarrow\\; x = ${swapLatex(h.toLatex())}`;
    out.text = T('x is a quadratic in y: a parabola lying on its side.', 'x es cuadrática en y: una parábola acostada.');
    return out;
  }
  if (e.g) {
    out.text = T(`A polynomial curve of degree ${e.g.degX()}.`, `Una curva polinomial de grado ${e.g.degX()}.`);
    return out;
  }
  out.text = T('A curve: every point (x, y) on it makes the equation true.', 'Una curva: cada punto (x, y) sobre ella cumple la ecuación.');
  return out;
}

function gp(id: string, x: number, y: number, color: string, label?: string, big = false): GPoint {
  return { id, x, y, color, label, big };
}

// ------------------------------------------------------------ solving one variable

interface UniRoots {
  roots: { value: number; latex: string; exact?: Fraction }[];
  latex: string;
  text: string;
}

function solveUni(cs: Fraction[], v: string, fx: (s: string) => string): UniRoots {
  cs = trim(cs);
  const U = Poly.fromCoeffs(cs);
  const deg = cs.length - 1;
  if (deg === 1) {
    const r = cs[0].neg().div(cs[1]);
    const a = cs[1];
    const mid = a.eq(Fraction.ONE) ? '' : `\\;\\Rightarrow\\; ${a.eq(F(-1)) ? '-' : a.toLatex()}${v} = ${cs[0].neg().toLatex()}`;
    return {
      roots: [{ value: r.value(), latex: r.toLatex(), exact: r }],
      latex: `${fx(U.toLatex())} = 0 ${mid} \\;\\Rightarrow\\; ${v} = ${r.toLatex()}`,
      text: T(`A linear equation in ${v}: move the numbers to the other side and divide.`, `Una ecuación lineal en ${v}: pasa los números al otro lado y divide.`),
    };
  }
  const fac = factor(cs);
  const roots: UniRoots['roots'] = [];
  const parts: string[] = [];
  if (fac.xPower) {
    roots.push({ value: 0, latex: '0', exact: F(0) });
    parts.push(fac.xPower === 1 ? 'x' : `x^{${fac.xPower}}`);
  }
  for (const r of fac.roots) {
    roots.push({ value: r.value(), latex: r.toLatex(), exact: r });
    parts.push(linearFactorLatex(r));
  }
  const qprod = fac.roots.reduce((acc, r) => acc * r.d, 1);
  const k = fac.c.div(F(qprod));
  const restDeg = fac.rest.length - 1;
  let text = T(`Factor the equation in ${v} and set each factor to 0.`, `Factoriza la ecuación en ${v} e iguala cada factor a 0.`);
  let extra = '';
  if (restDeg > 0) {
    parts.push(`\\left(${Poly.fromCoeffs(fac.rest).toLatex()}\\right)`);
    if (restDeg === 2) {
      const q = solveQuadratic(fac.rest);
      q.exact.forEach((ex, i) => roots.push({ value: q.values[i], latex: ex }));
      text = roots.length > q.exact.length
        ? T(`Factor, then use the quadratic formula on the last factor (Δ = ${q.disc}).`, `Factoriza y usa la fórmula general en el último factor (Δ = ${q.disc}).`)
        : T(`Use the quadratic formula (discriminant Δ = ${q.disc}${q.disc < 0 ? ' < 0: no real solutions' : ''}).`, `Usa la fórmula general (discriminante Δ = ${q.disc}${q.disc < 0 ? ' < 0: sin soluciones reales' : ''}).`);
      extra = `\\quad \\Delta = ${q.disc}`;
    } else {
      for (const r of numericRoots(fac.rest)) roots.push({ value: r, latex: `\\approx ${fmtNum(r)}` });
      text = T('Some solutions are not simple numbers; we approximate them from the graph.', 'Algunas soluciones no son números sencillos; las aproximamos con la gráfica.');
    }
  }
  const kk = k.eq(Fraction.ONE) ? '' : k.eq(F(-1)) ? '-' : k.toLatex();
  const factored = parts.length > 1 || (parts.length === 1 && restDeg === 0) ? ` \\;\\Rightarrow\\; ${fx(kk + parts.join(''))} = 0` : '';
  const uniq = roots.filter((r, i) => roots.findIndex((s) => Math.abs(s.value - r.value) < 1e-9) === i).sort((a, b) => a.value - b.value);
  const sols = uniq.length
    ? uniq.map((r) => (r.latex.startsWith('\\approx') ? `${v} ${r.latex}` : `${v} = ${r.latex}`)).join(',\\ ')
    : `\\text{${T('no real solution', 'sin solución real')}}`;
  return { roots: uniq, latex: `${fx(U.toLatex())} = 0${factored}${extra} \\;\\Rightarrow\\; ${sols}`, text };
}

// ------------------------------------------------------------ solving a pair

function solvePair(a: Eq, b: Eq, scene: (pts: GPoint[], segs?: GSeg[]) => Scene): PairResult {
  // 1. Substitution: one equation gives y (or x) directly.
  const cand: { iso: Eq; other: Eq; swapped: boolean; score: number }[] = [];
  for (const [iso, other] of [
    [a, b],
    [b, a],
  ] as const) {
    const y = isolateY(iso.D);
    if (y) cand.push({ iso, other, swapped: false, score: y.g.degX() * 10 + (y.c.abs().eq(Fraction.ONE) ? 0 : 1) + (other.D ? 0 : 5) });
    const x = iso.D ? isolateY(swapXY(iso.D)) : null;
    if (x && other.D) cand.push({ iso, other, swapped: true, score: x.g.degX() * 10 + (x.c.abs().eq(Fraction.ONE) ? 0 : 1) + 2 });
  }
  cand.sort((p, q) => p.score - q.score);
  if (cand.length) return bySubstitution(cand[0].iso, cand[0].other, cand[0].swapped, scene, []);

  // 2. Two circles (same x², y² coefficients): subtracting leaves a line.
  if (a.D && b.D && totalDeg(a.D) === 2 && totalDeg(b.D) === 2) {
    const qa = quadPart(a.D);
    const qb = quadPart(b.D);
    const [key, ca] = [...qa.terms][0];
    const k = qb.coef(...(key.split(',').map(Number) as [number, number])).div(ca);
    if (!k.isZero() && qb.sub(qa.scale(k)).isZero()) {
      const lin = b.D.sub(a.D.scale(k));
      const kl = k.eq(Fraction.ONE) ? '' : `${k.toLatex()}\\cdot`;
      const first: Step = {
        title: T(`Subtract (${b.n}) − ${kl.replace('\\cdot', '·')}(${a.n})`, `Resta (${b.n}) − ${kl.replace('\\cdot', '·')}(${a.n})`),
        text: T('Both have the same squared terms, so subtracting the equations cancels x² and y² and leaves a straight line.', 'Ambas tienen los mismos términos al cuadrado: al restar las ecuaciones se cancelan x² y y², y queda una recta.'),
        latex: `${b.D.toLatex()} - ${kl}\\left(${a.D.toLatex()}\\right) = 0 \\;\\Rightarrow\\; ${lin.toLatex()} = 0`,
        scene: scene([]),
      };
      if (lin.isZero()) return { pts: [], infinite: true, steps: [first], summary: `\\text{${T('same curve', 'misma curva')}}`, method: '' };
      if (lin.constValue()) {
        first.text += T(' But no x or y is left: the curves never meet.', ' Pero no queda ni x ni y: las curvas nunca se cruzan.');
        return { pts: [], infinite: false, steps: [first], summary: `${lin.toLatex()} = 0`, method: '' };
      }
      const le = lineEq(lin, a.n);
      const swapped = !isolateY(lin);
      return bySubstitution(le, a, swapped, scene, [first]);
    }
  }

  // 3. Numeric: Newton's method from a grid of starting points.
  const pts = newtonPairs(a.F, b.F);
  const step: Step = {
    title: T(`Find where (${a.n}) and (${b.n}) cross`, `Encuentra dónde se cruzan (${a.n}) y (${b.n})`),
    text: pts.length
      ? T('These equations are hard to combine with algebra, so we find the crossing points numerically (zooming in on the graph).', 'Estas ecuaciones son difíciles de combinar con álgebra, así que buscamos los cruces numéricamente (acercándonos en la gráfica).')
      : T('The curves never cross in the visible region.', 'Las curvas no se cruzan en la región visible.'),
    latex: pts.length ? pts.map(ptLatex).join(',\\ ') : `\\text{${T('no intersection', 'sin intersección')}}`,
    scene: scene(pts.map((p, i) => gp(`p${a.n}-${b.n}-${i}`, p.x, p.y, COLORS.root, ptLabel(p), true))),
  };
  return { pts, infinite: false, steps: [step], summary: step.latex, method: T('numerically', 'numéricamente') };
}

function bySubstitution(iso: Eq, other: Eq, swapped: boolean, scene: (pts: GPoint[], segs?: GSeg[]) => Scene, steps: Step[]): PairResult {
  const u = swapped ? 'x' : 'y';
  const v = swapped ? 'y' : 'x';
  const fx = swapped ? swapLatex : (s: string) => s;
  const D = swapped ? swapXY(iso.D!) : iso.D!;
  const g = isolateY(D)!.g;
  const gl = fx(g.toLatex());
  const already = isVar(iso.left, u) && !!iso.right && !usesVar(iso.right, u);
  const isLine = !iso.label;

  steps.push({
    title: already
      ? T(`Equation (${iso.n}) already gives ${u}`, `La ecuación (${iso.n}) ya da ${u}`)
      : isLine
        ? T(`Solve the line for ${u}`, `Despeja ${u} en la recta`)
        : T(`Solve equation (${iso.n}) for ${u}`, `Despeja ${u} en la ecuación (${iso.n})`),
    text: already
      ? T(`It says ${u} = ${latexToPlain(gl)}. We can use that in the other equation.`, `Dice que ${u} = ${latexToPlain(gl)}. Podemos usarlo en la otra ecuación.`)
      : T(`Get ${u} on its own using the balance rules: ${u} = ${latexToPlain(gl)}.`, `Deja ${u} sola usando las reglas de la balanza: ${u} = ${latexToPlain(gl)}.`),
    latex: already ? `${u} = ${gl}` : `${iso.latex} \\;\\Rightarrow\\; ${u} = ${gl}`,
    scene: scene([]),
  });

  const subLatex = other.left && other.right
    ? `${nodeLatex(other.left)} = ${nodeLatex(other.right)}`.replace(new RegExp(u, 'g'), `\\left(${gl}\\right)`)
    : `${other.latex.replace(new RegExp(u, 'g'), `\\left(${gl}\\right)`)}`;

  if (!other.L || !other.R) {
    // Non-polynomial partner: one-variable equation solved numerically.
    const h = (t: number) => (swapped ? other.F(g.evalX(t), t) : other.F(t, g.evalX(t)));
    const roots = numericZeros(h, -20, 20);
    const pts = roots.map((t) => (swapped ? numPt(g.evalX(t), t) : numPt(t, g.evalX(t))));
    steps.push({
      title: T(`Substitute into (${other.n})`, `Sustituye en (${other.n})`),
      text: T(`Replace ${u} in equation (${other.n}). Now there is only ${v}; we solve it numerically.`, `Reemplaza ${u} en la ecuación (${other.n}). Ahora solo queda ${v}; la resolvemos numéricamente.`),
      latex: `${subLatex} \\;\\Rightarrow\\; ${roots.length ? roots.map((r) => `${v} \\approx ${fmtNum(r)}`).join(',\\ ') : `\\text{${T('no solution', 'sin solución')}}`}`,
      scene: scene(pts.map((p, i) => gp(`p${iso.n}-${other.n}-${i}`, p.x, p.y, COLORS.root, ptLabel(p), true))),
    });
    return { pts, infinite: false, steps, summary: steps[steps.length - 1].latex, method: T('substitution', 'sustitución') };
  }

  const sub = (p: Poly) => substituteY(swapped ? swapXY(p) : p, g);
  const Ls = sub(other.L);
  const Rs = sub(other.R);
  const U = Ls.sub(Rs);
  steps.push({
    title: T(`Substitute into equation (${other.n})`, `Sustituye en la ecuación (${other.n})`),
    text: T(
      `Replace every ${u} in (${other.n}) with ${latexToPlain(gl)}. Then expand and collect like terms: only ${v} is left.`,
      `Cambia cada ${u} de (${other.n}) por ${latexToPlain(gl)}. Luego desarrolla y junta términos semejantes: solo queda ${v}.`,
    ),
    latex: `${subLatex} \\;\\Rightarrow\\; ${fx(Ls.toLatex())} = ${fx(Rs.toLatex())}`,
    scene: scene([]),
  });

  if (U.isZero()) {
    steps.push({
      title: T('Always true!', '¡Siempre es verdad!'),
      text: T('Everything cancels: both equations describe the same curve, so there are infinitely many solutions.', 'Todo se cancela: las dos ecuaciones describen la misma curva, así que hay infinitas soluciones.'),
      latex: `0 = 0`,
      scene: scene([]),
    });
    return { pts: [], infinite: true, steps, summary: `\\text{${T('infinitely many', 'infinitas')}}`, method: '' };
  }
  if (U.constValue()) {
    steps.push({
      title: T('Never true!', '¡Nunca es verdad!'),
      text: T(`The ${v} terms cancel and a false statement is left: the graphs never meet (for lines: they are parallel).`, `Los términos con ${v} se cancelan y queda algo falso: las gráficas nunca se cruzan (si son rectas: son paralelas).`),
      latex: `${U.toLatex()} = 0 \\;\\text{${T('is impossible', 'es imposible')}}`,
      scene: scene([]),
    });
    return { pts: [], infinite: false, steps, summary: `\\text{${T('no solution', 'sin solución')}}`, method: T('substitution', 'sustitución') };
  }

  const res = solveUni(U.coeffsX(), v, fx);
  if (U.degX() === 1) {
    // Show the balance moves from the simplified equation: x − 4 = 2 ⇒ x = 6.
    const a1 = U.coef(1);
    const xs = Ls.termX(1).sub(Rs.termX(1));
    const rhs = Rs.coef(0).sub(Ls.coef(0));
    const ax = a1.eq(Fraction.ONE) ? v : `${xs.toLatex()}`;
    const r = rhs.div(a1);
    res.latex = `${fx(Ls.toLatex())} = ${fx(Rs.toLatex())} \\;\\Rightarrow\\; ${fx(ax)} = ${rhs.toLatex()}${a1.eq(Fraction.ONE) ? '' : ` \\;\\Rightarrow\\; ${v} = ${r.toLatex()}`}`;
  }
  const segs: GSeg[] = res.roots.map((r, i) =>
    swapped
      ? { id: `s${iso.n}-${other.n}-${i}`, from: [-1000, r.value], to: [1000, r.value], color: COLORS.root, dashed: true, label: `${v} = ${latexToPlain(r.latex)}` }
      : { id: `s${iso.n}-${other.n}-${i}`, from: [r.value, -1000], to: [r.value, 1000], color: COLORS.root, dashed: true, label: `${v} = ${latexToPlain(r.latex)}` },
  );
  steps.push({
    title: T(`Solve for ${v}`, `Resuelve para ${v}`),
    text: res.text,
    latex: res.latex,
    scene: scene([], segs),
  });

  const pts: Pt[] = [];
  const lines: string[] = [];
  for (const r of res.roots) {
    let ul: string;
    let uv: number;
    if (r.exact) {
      const ex = evalFrac(g.coeffsX(), r.exact);
      ul = ex.toLatex();
      uv = ex.value();
    } else {
      uv = g.evalX(r.value);
      ul = fmtNum(uv, 3);
    }
    const vl = r.latex.startsWith('\\approx') ? fmtNum(r.value, 3) : r.latex;
    const into = gl.replace(/[xy]/g, `\\left(${vl}\\right)`);
    lines.push(/[xy]/.test(gl) ? `${u} = ${into} = ${ul}` : `${u} = ${ul}`);
    pts.push(swapped ? { x: uv, y: r.value, xl: ul, yl: vl } : { x: r.value, y: uv, xl: vl, yl: ul });
  }
  const gpts = pts.map((p, i) => gp(`p${iso.n}-${other.n}-${i}`, p.x, p.y, COLORS.root, ptLabel(p), true));
  if (pts.length) {
    steps.push({
      title: T(`Find ${u}`, `Encuentra ${u}`),
      text: T(
        `Put each ${v} back into ${u} = ${latexToPlain(gl)}. Each pair (x, y) is a point where the graphs cross.`,
        `Sustituye cada ${v} en ${u} = ${latexToPlain(gl)}. Cada pareja (x, y) es un punto donde se cruzan las gráficas.`,
      ),
      latex: lines.join(' \\qquad '),
      scene: scene(gpts, segs),
    });
  }
  return {
    pts,
    infinite: false,
    steps,
    summary: `${fx(U.toLatex())} = 0 \\;\\Rightarrow\\; ${pts.length ? pts.map(ptLatex).join(',\\ ') : `\\text{${T('no intersection', 'sin intersección')}}`}`,
    method: T('substitution', 'sustitución'),
  };
}

function newtonPairs(f: F2, g: F2): Pt[] {
  const out: Pt[] = [];
  const h = 1e-6;
  for (let sx = -10; sx <= 10; sx += 1) {
    for (let sy = -10; sy <= 10; sy += 1) {
      let x = sx + 0.137;
      let y = sy + 0.071;
      let ok = false;
      for (let it = 0; it < 40; it++) {
        const a = f(x, y);
        const b = g(x, y);
        if (!Number.isFinite(a) || !Number.isFinite(b)) break;
        if (Math.abs(a) < 1e-11 && Math.abs(b) < 1e-11) {
          ok = true;
          break;
        }
        const ax = (f(x + h, y) - a) / h;
        const ay = (f(x, y + h) - a) / h;
        const bx = (g(x + h, y) - b) / h;
        const by = (g(x, y + h) - b) / h;
        const det = ax * by - ay * bx;
        if (Math.abs(det) < 1e-14) break;
        x -= (a * by - ay * b) / det;
        y -= (ax * b - a * bx) / det;
        if (Math.abs(x) > 1e4 || Math.abs(y) > 1e4) break;
      }
      if (!ok && Number.isFinite(x) && Math.abs(f(x, y)) < 1e-8 && Math.abs(g(x, y)) < 1e-8) ok = true;
      if (ok && Math.abs(x) < 50 && Math.abs(y) < 50) out.push(numPt(Math.abs(x) < 1e-10 ? 0 : x, Math.abs(y) < 1e-10 ? 0 : y));
    }
  }
  return dedupePts(out);
}

// ------------------------------------------------------------ the whole system

export function systemSolution(parts: string[]): Solution {
  if (parts.length > MAX_EQS) throw new ParseError(T(`Use at most ${MAX_EQS} equations`, `Usa como máximo ${MAX_EQS} ecuaciones`));
  const eqs = parts.map((p, i) => parseEq(p, i + 1));
  const N = eqs.length;
  const desc = eqs.map(describe);
  const curvesOf = (k: number) => {
    const curves: GCurve[] = [];
    const implicit: GImplicit[] = [];
    for (const e of eqs.slice(0, k)) {
      if (e.explicit) curves.push({ id: `eq${e.n}`, fn: e.explicit, color: e.color, label: e.label, draw: true, labelAt: LABEL_AT[(e.n - 1) % LABEL_AT.length] });
      else implicit.push({ id: `eq${e.n}`, fn: e.F, color: e.color, label: e.label });
    }
    return { curves, implicit };
  };

  // Solve every pair first so the graph frame can include all intersections.
  let frame: GraphFrame = { xmin: -10, xmax: 10, ymin: -8, ymax: 8 };
  const sceneWith = (k: number) => (pts: GPoint[], segs: GSeg[] = []): Scene => ({ type: 'graph', frame, ...curvesOf(k), points: pts, segs });
  const all = sceneWith(N);
  const pairs: { a: Eq; b: Eq; res: PairResult }[] = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) pairs.push({ a: eqs[i], b: eqs[j], res: solvePair(eqs[i], eqs[j], (p, s) => all(p, s)) });

  const allPts = dedupePts(pairs.flatMap((p) => p.res.pts));
  const xs = [...allPts.map((p) => p.x), ...desc.flatMap((d) => d.xs)];
  const ys = [...allPts.map((p) => p.y), ...desc.flatMap((d) => d.ys)];
  frame = makeFrame(xs.length ? xs : [-5, 5], eqs.filter((e) => e.explicit).map((e) => e.explicit!), ys);

  const steps: Step[] = [];
  const sysLatex = `\\begin{cases} ${eqs.map((e) => `${e.latex} & (${e.n})`).join(' \\\\ ')} \\end{cases}`;
  steps.push({
    title: T(`A system of ${N} equations`, `Un sistema de ${N} ecuaciones`),
    text: T(
      'A solution of the system is a point (x, y) that makes all the equations true at the same time: a point where all the graphs meet.',
      'Una solución del sistema es un punto (x, y) que cumple todas las ecuaciones al mismo tiempo: un punto donde se cruzan todas las gráficas.',
    ),
    latex: sysLatex,
    scene: sceneWith(0)([]),
  });
  eqs.forEach((e, i) => {
    steps.push({
      title: T(`Graph equation (${e.n})`, `Grafica la ecuación (${e.n})`),
      text: desc[i].text,
      latex: desc[i].latex,
      scene: sceneWith(i + 1)(desc[i].pts),
    });
  });

  // Pair steps rebuilt with the final frame (scenes capture `frame` when called).
  const rebuilt = pairs.map(({ a, b }) => ({ a, b, res: solvePair(a, b, (p, s) => all(p, s)) }));
  const found: GPoint[] = [];
  const foundPts = (res: PairResult, a: Eq, b: Eq) =>
    res.pts.map((p, i) => gp(`p${a.n}-${b.n}-${i}`, p.x, p.y, COLORS.root, ptLabel(p), true));

  if (N === 2) {
    steps.push(...rebuilt[0].res.steps);
  } else if (rebuilt.length <= 10) {
    for (const { a, b, res } of rebuilt) {
      const pts = foundPts(res, a, b);
      steps.push({
        title: T(`Where (${a.n}) and (${b.n}) meet`, `Dónde se cruzan (${a.n}) y (${b.n})`),
        text: res.infinite
          ? T('They are the same curve.', 'Son la misma curva.')
          : res.pts.length
            ? T(`Solve (${a.n}) and (${b.n}) together${res.method ? ` by ${res.method}` : ''}: ${res.pts.length} crossing point${res.pts.length > 1 ? 's' : ''}.`, `Resolvemos (${a.n}) y (${b.n}) juntas${res.method ? ` por ${res.method}` : ''}: ${res.pts.length} punto${res.pts.length > 1 ? 's' : ''} de cruce.`)
            : T('They never cross.', 'Nunca se cruzan.'),
        latex: res.summary,
        scene: all([...found.map((p) => ({ ...p, big: false })), ...pts]),
      });
      found.push(...pts);
    }
  } else {
    for (const e of eqs) {
      const mine = rebuilt.filter((p) => p.a === e);
      if (!mine.length) continue;
      const pts = mine.flatMap(({ a, b, res }) => foundPts(res, a, b));
      steps.push({
        title: T(`Where (${e.n}) meets the others`, `Dónde cruza (${e.n}) con las demás`),
        text: T(`Intersect (${e.n}) with each later equation.`, `Intersecamos (${e.n}) con cada una de las siguientes ecuaciones.`),
        latex: mine.map(({ b, res }) => `(${e.n})\\cap(${b.n}):\\ ${res.pts.length ? res.pts.map(ptLatex).join(',\\ ') : '\\varnothing'}`).join(' \\\\ '),
        scene: all([...found.map((p) => ({ ...p, big: false })), ...pts]),
      });
      found.push(...pts);
    }
  }

  // Points that satisfy every equation.
  const common = allPts.filter((p) => eqs.every((e) => Math.abs(e.F(p.x, p.y)) < 1e-6 * (1 + Math.abs(p.x) + Math.abs(p.y))));
  const infinite = N === 2 && rebuilt[0].res.infinite;
  const finalPts = allPts.map((p, i) => {
    const c = common.includes(p);
    return gp(`final${i}`, p.x, p.y, c ? COLORS.root : '#fbbf24', ptLabel(p), c || N === 2);
  });

  if (N === 2 && common.length && !infinite) {
    const checks = common
      .filter((p) => !p.xl.includes('approx') && !p.xl.includes('.') && !p.yl.includes('.') && !p.xl.includes('sqrt'))
      .slice(0, 2)
      .map((p) => eqs.map((e) => `${e.latex.replace(/x/g, `(${p.xl})`).replace(/y/g, `(${p.yl})`)}\\ \\checkmark`).join(' \\qquad '));
    if (checks.length) {
      steps.push({
        title: T('Check', 'Comprueba'),
        text: T('Substitute the point into both original equations: both must be true.', 'Sustituye el punto en las dos ecuaciones originales: ambas deben cumplirse.'),
        latex: checks.join(' \\\\ '),
        scene: all(finalPts),
      });
    }
  }

  let text: string;
  if (infinite) text = T('Both equations are the same curve: every point on it is a solution.', 'Las dos ecuaciones son la misma curva: cada punto sobre ella es solución.');
  else if (common.length)
    text = T(
      `The system has ${common.length} solution${common.length > 1 ? 's' : ''}: the point${common.length > 1 ? 's' : ''} where all the graphs cross.`,
      `El sistema tiene ${common.length} ${common.length > 1 ? 'soluciones' : 'solución'}: ${common.length > 1 ? 'los puntos' : 'el punto'} donde se cruzan todas las gráficas.`,
    );
  else if (allPts.length)
    text = T(
      'Some graphs cross, but no point lies on all of them: the system has no common solution. Yellow points are crossings of only some equations.',
      'Algunas gráficas se cruzan, pero ningún punto está en todas: el sistema no tiene solución común. Los puntos amarillos son cruces de solo algunas ecuaciones.',
    );
  else text = T('The graphs never meet: the system has no solution.', 'Las gráficas nunca se cruzan: el sistema no tiene solución.');
  if (N > 2 && common.length && allPts.length > common.length)
    text += T(' Yellow points are crossings of only some equations.', ' Los puntos amarillos son cruces de solo algunas ecuaciones.');

  const answer = infinite
    ? `\\text{${T('infinitely many solutions', 'infinitas soluciones')}}`
    : common.length
      ? common.map(ptLatex).join(',\\ ')
      : `\\text{${T('no solution', 'sin solución')}}`;
  steps.push({
    title: T('All the graphs and intersections', 'Todas las gráficas y sus intersecciones'),
    text,
    latex: N > 2 && allPts.length ? `${answer} \\qquad \\text{${T('all crossings', 'todos los cruces')}: } ${allPts.map(ptLatex).join(',\\ ')}` : answer,
    scene: all(finalPts),
  });

  return { kind: T('System of equations', 'Sistema de ecuaciones'), inputLatex: sysLatex, steps, answer };
}
