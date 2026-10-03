// Turns what the student typed into a list of explained steps, each with a scene.

import { Fraction, F } from './fraction';
import { Poly, latexToPlain } from './poly';
import { T, setLang, type Lang } from './i18n';
import { systemSolution } from './system';
import { compile, nodeLatex, parseInput, toPoly, usesVar, type Node } from './parser';
import {
  divideByRoot,
  evalFrac,
  factor,
  fmtNum,
  integerContent,
  linearFactorLatex,
  numericRoots,
  numericZeros,
  solveQuadratic,
  trim,
} from './roots';
import {
  COLORS,
  type Axis,
  type GCurve,
  type GPoint,
  type GSeg,
  type GraphFrame,
  type Scene,
  type Side,
  type Solution,
  type Step,
  type TileGroup,
} from './scene';

// ---------------------------------------------------------------- helpers

const minus = (s: string) => s.replace(/-/g, '−');

function groupsOf(p: Poly, added = false): TileGroup[] {
  return [...p.terms.entries()]
    .sort(([a], [b]) => {
      const [ai, aj] = a.split(',').map(Number);
      const [bi, bj] = b.split(',').map(Number);
      return bi + bj - (ai + aj) || bj - aj;
    })
    .map(([term, count]) => ({ term, count, added }));
}

function side(id: 'A' | 'B', p: Poly, added?: Poly): Side {
  return { id, groups: [...groupsOf(p), ...(added ? groupsOf(added, true) : [])] };
}

function eq(l: Poly | string, r: Poly | string): string {
  return `${typeof l === 'string' ? l : l.toLatex()} = ${typeof r === 'string' ? r : r.toLatex()}`;
}

/** "+ 3x" / "− 2" style text for an operation applied to both sides. */
function opText(t: Poly): string {
  if (t.terms.size === 1) {
    const s = t.toString();
    return s.startsWith('−') ? s : `+${s}`;
  }
  const neg = t.scale(F(-1));
  return `−(${minus(neg.toString())})`;
}

function opSentence(t: Poly): string {
  // t is what we add to both sides.
  const neg = t.scale(F(-1));
  if (t.terms.size === 1) {
    const [[, c]] = [...t.terms.entries()];
    return c.sign() < 0
      ? T(`Take away ${minus(neg.toString())} from both sides`, `Resta ${minus(neg.toString())} en ambos lados`)
      : T(`Add ${t.toString()} to both sides`, `Suma ${t.toString()} en ambos lados`);
  }
  return T(`Take away ${minus(neg.toString())} from both sides`, `Resta ${minus(neg.toString())} en ambos lados`);
}

const isNum = (n: Node, v?: number) => n.t === 'num' && (v === undefined || n.v === v);
const isVar = (n: Node, name: string) => n.t === 'var' && n.name === name;

const unwrap = (l: string) => l.replace(/^\\left\((.*)\\right\)$/, '$1').replace(/^\((.*)\)$/, '$1');

function cleanLatex(s: string) {
  return s.replace(/\\left|\\right|\s|\{|\}/g, '');
}

function fracLatex(f: Fraction) {
  return f.toLatex();
}

// ---------------------------------------------------------------- graph frame

export function makeFrame(xs: number[], fns: ((x: number) => number)[], ys: number[] = []): GraphFrame {
  const finite = (v: number) => Number.isFinite(v) && Math.abs(v) < 1e6;
  xs = xs.filter(finite);
  let xlo = Math.min(-1, ...xs);
  let xhi = Math.max(1, ...xs);
  const pad = Math.max(2, (xhi - xlo) * 0.25);
  xlo = Math.floor(xlo - pad);
  xhi = Math.ceil(xhi + pad);
  while (xhi - xlo < 10) {
    xlo--;
    xhi++;
  }
  if (xhi - xlo > 40) {
    const c = Math.round((xlo + xhi) / 2);
    xlo = c - 20;
    xhi = c + 20;
  }
  ys = ys.filter(finite);
  const ylo = Math.min(0, ...ys);
  const yhi = Math.max(0, ...ys);
  let sm = Infinity;
  let sM = -Infinity;
  for (const f of fns) {
    for (let i = 0; i <= 200; i++) {
      const v = f(xlo + ((xhi - xlo) * i) / 200);
      if (finite(v)) {
        sm = Math.min(sm, v);
        sM = Math.max(sM, v);
      }
    }
  }
  let ymin = Math.min(ylo - 1, sm);
  let ymax = Math.max(yhi + 1, sM);
  const hmax = Math.max(1.4 * (xhi - xlo), yhi - ylo + 4, 10);
  if (ymax - ymin > hmax) {
    const c = (ylo + yhi) / 2;
    ymin = Math.max(ymin, c - hmax / 2);
    ymax = ymin + hmax;
    if (ymax < yhi + 1) {
      ymax = yhi + 1;
      ymin = ymax - hmax;
    }
  }
  if (ymax - ymin < 8) {
    const c = (ymin + ymax) / 2;
    ymin = c - 4;
    ymax = c + 4;
  }
  return { xmin: xlo, xmax: xhi, ymin: Math.floor(ymin), ymax: Math.ceil(ymax) };
}

function graph(frame: GraphFrame, curves: GCurve[], points: GPoint[] = [], segs: GSeg[] = []): Scene {
  return { type: 'graph', frame, curves, points, segs };
}

const pt = (id: string, x: number, y: number, color: string, label?: string, big = false): GPoint => ({
  id,
  x,
  y,
  color,
  label,
  big,
});
const coord = (x: number, y: number) => `(${fmtNum(x, 2)}, ${fmtNum(y, 2)})`;

function tableLatex(xs: number[], f: (x: number) => number): string {
  const ys = xs.map((x) => fmtNum(f(x), 2));
  return `\\begin{array}{c|${'c'.repeat(xs.length)}} x & ${xs.join(' & ')} \\\\ \\hline y & ${ys.join(' & ')} \\end{array}`;
}

function tablePoints(xs: number[], f: (x: number) => number): GPoint[] {
  return xs
    .filter((x) => Number.isFinite(f(x)))
    .map((x) => pt(`t${x}`, x, f(x), COLORS.point, coord(x, f(x))));
}

// ---------------------------------------------------------------- entry

export function solve(src: string, lang: Lang = 'es'): Solution {
  setLang(lang);
  // Several equations separated by ";" form a system.
  const parts = src.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return systemSolution(parts);
  if (parts.length === 1) src = parts[0];
  const parsed = parseInput(src);
  let { left, right } = parsed;

  if (!right) {
    if (usesVar(left, 'y') || usesVar(left, 'z'))
      throw new Error(T('Add an "=" sign, for example  y = 2x + 1', 'Agrega un signo "=", por ejemplo  y = 2x + 1'));
    // A bare expression like "x^2 - 4" is graphed as y = ...
    right = left;
    left = { t: 'var', name: 'y' };
  }
  if (isVar(right, 'y') && !usesVar(left, 'y')) [left, right] = [right, left];
  if (isVar(right, 'z')) [left, right] = [right, left];

  const inputLatex = `${nodeLatex(left)} = ${nodeLatex(right)}`;

  if (isVar(left, 'z')) {
    if (usesVar(right, 'z')) throw new Error(T('z can only appear once: z = (something with x and y)', 'z solo puede aparecer una vez: z = (algo con x y y)'));
    return surfaceSolution(right, inputLatex);
  }
  if (usesVar(left, 'z') || usesVar(right, 'z')) throw new Error(T('Use z only as  z = (something with x and y)', 'Usa z solo así:  z = (algo con x y y)'));

  if (isVar(left, 'y') && !usesVar(right, 'y')) {
    if (!usesVar(right, 'x') && !isNum(right) && toPoly(right)?.constValue() == null)
      throw new Error(T('Could not understand the right side', 'No entendí el lado derecho'));
    return functionSolution(right, inputLatex);
  }

  const L = toPoly(left);
  const R = toPoly(right);
  const hasY = usesVar(left, 'y') || usesVar(right, 'y');

  if (!L || !R) {
    if (hasY) return implicitSolution(compile(left), compile(right), inputLatex);
    return numericEquation(left, right, inputLatex);
  }

  const D = L.sub(R);
  if (hasY) {
    if (D.hasY() && D.isLinearInYOnly()) return isolateYSolution(left, right, L, R, inputLatex);
    return implicitSolution(compile(left), compile(right), inputLatex, D);
  }
  return equationSolution(left, right, L, R, inputLatex);
}

// ---------------------------------------------------------------- balance moves

interface BalanceState {
  L: Poly;
  R: Poly;
  idL: 'A' | 'B';
  idR: 'A' | 'B';
  steps: Step[];
}

function balanceScene(s: BalanceState, addL?: Poly, addR?: Poly, op?: string, groups?: number): Scene {
  return { type: 'balance', left: side(s.idL, s.L, addL), right: side(s.idR, s.R, addR), op, groups };
}

function pushSwap(s: BalanceState, why: string) {
  [s.L, s.R] = [s.R, s.L];
  [s.idL, s.idR] = [s.idR, s.idL];
  s.steps.push({
    title: T('Swap the two sides', 'Intercambia los dos lados'),
    text: `${why} ${T('Swapping the sides of an equation keeps it true — the scale stays balanced.', 'Intercambiar los lados de una ecuación la mantiene verdadera: la balanza sigue equilibrada.')}`,
    latex: eq(s.L, s.R),
    scene: balanceScene(s),
  });
}

/** Add `t` to both sides: one step showing the new blocks, one step after cancelling. */
function pushAddBoth(s: BalanceState, t: Poly, reason: string) {
  const sentence = opSentence(t);
  s.steps.push({
    title: sentence,
    text: `${reason} ${T('Whatever we do to one side we must do to the other, so the scale stays balanced.', 'Lo que hacemos de un lado lo debemos hacer del otro, así la balanza sigue equilibrada.')}`,
    latex: `${s.L.toLatex()} \\color{#f97316}{${signed(t)}} = ${s.R.toLatex()} \\color{#f97316}{${signed(t)}}`,
    scene: balanceScene(s, t, t, opText(t)),
  });
  s.L = s.L.add(t);
  s.R = s.R.add(t);
  s.steps.push({
    title: T('Cancel the zero pairs', 'Cancela los pares cero'),
    text: T('A positive block and a matching negative (red) block add up to zero, so they disappear together.', 'Un bloque positivo y su bloque negativo (rojo) suman cero, así que desaparecen juntos.'),
    latex: eq(s.L, s.R),
    scene: balanceScene(s),
  });
}

function signed(t: Poly): string {
  const s = t.toLatex();
  if (t.terms.size > 1) return `- \\left(${t.scale(F(-1)).toLatex()}\\right)`;
  return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`;
}

/** Divide both sides by k (k may be a fraction or negative). Ends with target = R. */
function pushDivide(s: BalanceState, k: Fraction, varLatex: string) {
  if (k.eq(Fraction.ONE)) return;
  const newR = s.R.scale(F(1).div(k));
  const newL = s.L.scale(F(1).div(k));
  const canGroup =
    k.isInt() &&
    k.n > 1 &&
    k.n <= 6 &&
    [...s.L.terms.values(), ...s.R.terms.values()].every((c) => c.isInt() && c.n % k.n === 0 && Math.abs(c.n) <= 15);
  if (k.isInt() && k.n > 0) {
    s.steps.push({
      title: T(`Split both sides into ${k.n} equal groups`, `Reparte ambos lados en ${k.n} grupos iguales`),
      text: T(
        `There are ${k.n} copies of ${varLatex}. Dividing both sides by ${k.n} keeps the scale balanced and leaves just one ${varLatex}.`,
        `Hay ${k.n} copias de ${varLatex}. Dividir ambos lados entre ${k.n} mantiene la balanza equilibrada y deja solo una ${varLatex}.`,
      ),
      latex: `\\frac{${s.L.toLatex()}}{\\color{#f97316}{${k.n}}} = \\frac{${s.R.toLatex()}}{\\color{#f97316}{${k.n}}}`,
      scene: balanceScene(s, undefined, undefined, `÷${k.n}`, canGroup ? k.n : undefined),
    });
  } else {
    const r = F(1).div(k);
    const word = r.isInt()
      ? T(`Multiply both sides by ${r}`, `Multiplica ambos lados por ${r}`)
      : T(`Divide both sides by ${k}`, `Divide ambos lados entre ${k}`);
    s.steps.push({
      title: minus(word),
      text: k.sign() < 0
        ? T(
            `We want +1·${varLatex}, not ${k}·${varLatex}. ${word} (dividing by a negative number flips every sign).`,
            `Queremos +1·${varLatex}, no ${k}·${varLatex}. ${word} (dividir entre un número negativo cambia todos los signos).`,
          )
        : T(`We want exactly one ${varLatex}. ${word}.`, `Queremos exactamente una ${varLatex}. ${word}.`),
      latex: `\\color{#f97316}{${r.toLatex()} \\cdot} \\left(${s.L.toLatex()}\\right) = \\color{#f97316}{${r.toLatex()} \\cdot} \\left(${s.R.toLatex()}\\right)`,
      scene: balanceScene(s, undefined, undefined, minus(`×${r}`)),
    });
  }
  s.L = newL;
  s.R = newR;
  s.steps.push({
    title: T('Simplify', 'Simplifica'),
    text: T('Each group has the same blocks. Keep one group on each side.', 'Cada grupo tiene los mismos bloques. Quédate con un grupo de cada lado.'),
    latex: eq(s.L, s.R),
    scene: balanceScene(s),
  });
}

/**
 * Moves every `target` term to the left and everything else to the right,
 * so the left becomes  k·target.  `target` is "1,0" (x), "0,1" (y) or "n,0" (x^n).
 */
function collect(s: BalanceState, target: string, name: string) {
  const [ti, tj] = target.split(',').map(Number);
  const a = s.L.coef(ti, tj);
  const c = s.R.coef(ti, tj);
  if (c.value() > a.value())
    pushSwap(s, T(`There are more ${name} on the right than on the left, so we put that side on the left.`, `Hay más ${name} a la derecha que a la izquierda, así que ponemos ese lado a la izquierda.`));
  const c2 = s.R.coef(ti, tj);
  if (!c2.isZero()) {
    const t = new Poly(new Map([[target, c2.neg()]]));
    pushAddBoth(s, t, T(`Get all the ${name} on the left side.`, `Junta todos los ${name} del lado izquierdo.`));
  }
  const others = new Poly(new Map([...s.L.terms].filter(([k]) => k !== target)));
  if (!others.isZero()) {
    pushAddBoth(s, others.scale(F(-1)), T(`Leave only the ${name} on the left side.`, `Deja solo los ${name} del lado izquierdo.`));
  }
}

function newState(L: Poly, R: Poly): BalanceState {
  return { L, R, idL: 'A', idR: 'B', steps: [] };
}

function firstSteps(s: BalanceState, left: Node, right: Node, inputLatex: string, intro: string) {
  s.steps.push({
    title: T('The equation is a balance', 'La ecuación es una balanza'),
    text: `${intro} ${T(
      'Each block is a term: big orange cubes are x³, blue flats are x², green rods are x, purple rods are y and small yellow cubes are 1. Red blocks are negative.',
      'Cada bloque es un término: los cubos naranjas grandes son x³, las placas azules son x², las barras verdes son x, las barras moradas son y, y los cubitos amarillos son 1. Los bloques rojos son negativos.',
    )}`,
    latex: inputLatex,
    scene: balanceScene(s),
  });
  const simple = eq(s.L, s.R);
  if (cleanLatex(simple) !== cleanLatex(`${nodeLatex(left)}=${nodeLatex(right)}`)) {
    s.steps.push({
      title: T('Simplify each side', 'Simplifica cada lado'),
      text: T('Expand brackets and collect like terms on each side, so we can count the blocks.', 'Quita los paréntesis y junta términos semejantes en cada lado, para poder contar los bloques.'),
      latex: simple,
      scene: balanceScene(s),
    });
  }
}

// ---------------------------------------------------------------- equations in x

function equationSolution(left: Node, right: Node, L: Poly, R: Poly, inputLatex: string): Solution {
  const D = L.sub(R);
  const deg = D.degX();
  const s = newState(L, R);

  if (deg === 0) {
    firstSteps(s, left, right, inputLatex, T('Both sides of the "=" must weigh the same.', 'Los dos lados del "=" deben pesar lo mismo.'));
    const same = D.isZero();
    s.steps.push({
      title: same ? T('Always true!', '¡Siempre es verdad!') : T('Never true!', '¡Nunca es verdad!'),
      text: same
        ? T('Both sides are exactly the same for every value of x. Every number is a solution.', 'Ambos lados son iguales para cualquier valor de x. Todo número es solución.')
        : T('The x terms cancel and we are left with two different numbers. No value of x can make this true.', 'Los términos con x se cancelan y quedan dos números distintos. Ningún valor de x lo hace verdadero.'),
      latex: same
        ? `${eq(L, R)} \\quad \\text{${T('for every', 'para toda')} } x`
        : `${D.toLatex()} \\ne 0 \\quad \\text{${T('no solution', 'sin solución')}}`,
      scene: balanceScene(s),
    });
    return {
      kind: same ? T('Identity', 'Identidad') : T('No solution', 'Sin solución'),
      inputLatex,
      steps: s.steps,
      answer: same ? T('\\text{all } x', '\\text{toda } x') : T('\\text{no solution}', '\\text{sin solución}'),
    };
  }

  if (deg === 1) return linearSolution(s, left, right, inputLatex);

  // Only x^n and a number: isolate x^n, then take the root.
  const pure = [...D.terms.keys()].every((k) => k === `${deg},0` || k === '0,0');
  if (pure) return powerSolution(s, left, right, inputLatex, deg);

  return polySolution(s, left, right, inputLatex);
}

function linearSolution(s: BalanceState, left: Node, right: Node, inputLatex: string): Solution {
  const L0 = s.L;
  const R0 = s.R;
  firstSteps(s, left, right, inputLatex, T('A linear equation is like a balance scale: both sides weigh the same. Our job: find how much one x weighs.', 'Una ecuación lineal es como una balanza: ambos lados pesan lo mismo. Nuestro trabajo: averiguar cuánto pesa una x.'));
  collect(s, '1,0', T('x blocks', 'bloques x'));
  pushDivide(s, s.L.coef(1), 'x');
  const sol = s.R.constValue()!;
  const lv = evalFrac(L0.coeffsX(), sol);
  const sub = (p: Poly) => p.toLatex().replace(/x/g, `\\left(${sol.toLatex()}\\right)`);
  s.steps.push({
    title: T('Check the answer', 'Comprueba la respuesta'),
    text: T(`Put x = ${sol} back into the original equation. Both sides give ${lv}, so it works!`, `Sustituye x = ${sol} en la ecuación original. Ambos lados dan ${lv}, ¡así que funciona!`),
    latex: `${sub(L0)} = ${lv.toLatex()} \\quad\\text{${T('and', 'y')}}\\quad ${sub(R0)} = ${lv.toLatex()} \\;\\checkmark`,
    scene: balanceScene(s),
  });
  const fl = (x: number) => L0.evalX(x);
  const fr = (x: number) => R0.evalX(x);
  const frame = makeFrame([sol.value()], [fl, fr], [lv.value()]);
  s.steps.push({
    title: T('See it on a graph', 'Míralo en una gráfica'),
    text: T(`Draw y = ${L0} and y = ${R0}. The lines cross exactly where both sides are equal: at x = ${sol}.`, `Dibuja y = ${L0} y y = ${R0}. Las rectas se cruzan justo donde ambos lados son iguales: en x = ${sol}.`),
    latex: `x = ${sol.toLatex()}`,
    scene: graph(
      frame,
      [
        { id: 'L', fn: fl, color: COLORS.curve, label: `y = ${L0}`, draw: true },
        { id: 'R', fn: fr, color: COLORS.curve2, label: `y = ${R0}`, draw: true },
      ],
      [pt('sol', sol.value(), lv.value(), COLORS.root, `x = ${sol}`, true)],
      [{ id: 'drop', from: [sol.value(), lv.value()], to: [sol.value(), 0], color: COLORS.root, dashed: true }],
    ),
  });
  return { kind: T('Linear equation', 'Ecuación lineal'), inputLatex, steps: s.steps, answer: `x = ${sol.toLatex()}` };
}

function powerSolution(s: BalanceState, left: Node, right: Node, inputLatex: string, n: number): Solution {
  const L0 = s.L;
  const R0 = s.R;
  const sq = n === 2 ? '²' : '³';
  firstSteps(s, left, right, inputLatex, T(`This equation only has x${sq} and numbers. First we find what x${sq} is, like a normal balance.`, `Esta ecuación solo tiene x${sq} y números. Primero averiguamos cuánto vale x${sq}, como en una balanza normal.`));
  collect(s, `${n},0`, n === 2 ? T('x² blocks', 'bloques x²') : T(`x^${n} blocks`, `bloques x^${n}`));
  pushDivide(s, s.L.coef(n), n === 2 ? 'x²' : `x^${n}`);
  const v = s.R.constValue()!;
  const xn = n === 2 ? 'x²' : n === 3 ? 'x³' : `x^${n}`;
  const roots: number[] = [];
  let latex: string;
  let text: string;
  const even = n % 2 === 0;
  if (even && v.sign() < 0) {
    latex = `x^{${n}} = ${v.toLatex()} < 0 \\quad\\Rightarrow\\quad \\text{${T('no real solution', 'sin solución real')}}`;
    text = T(`A number to an even power is never negative, so ${xn} = ${v} has no real solution. On the graph the curve never reaches the x-axis.`, `Un número elevado a una potencia par nunca es negativo, así que ${xn} = ${v} no tiene solución real. En la gráfica la curva nunca toca el eje x.`);
  } else {
    const r = Math.sign(v.value()) * Math.abs(v.value()) ** (1 / n);
    const exactInt = Math.abs(r - Math.round(r)) < 1e-9;
    const rootTex = exactInt ? `${Math.round(Math.abs(r))}` : n === 2 ? `\\sqrt{${v.abs().toLatex()}}` : `\\sqrt[${n}]{${v.abs().toLatex()}}`;
    const sgn = v.sign() < 0 ? '-' : '';
    if (v.isZero()) {
      roots.push(0);
      latex = `x = 0`;
    } else if (even) {
      roots.push(-Math.abs(r), Math.abs(r));
      latex = `x = \\pm ${rootTex}${exactInt ? '' : ` \\approx \\pm ${fmtNum(Math.abs(r))}`}`;
    } else {
      roots.push(r);
      latex = `x = ${sgn}${rootTex}${exactInt ? '' : ` \\approx ${fmtNum(r)}`}`;
    }
    text = even
      ? T(`Undo the power with a square root${n > 2 ? ` (the ${n}th root)` : ''}. Careful: a negative number squared is positive too, so there are two answers: + and −.`, `Deshaz la potencia con una raíz cuadrada${n > 2 ? ` (la raíz ${n}-ésima)` : ''}. Cuidado: un número negativo al cuadrado también es positivo, así que hay dos respuestas: + y −.`)
      : T('Undo the cube with a cube root. Cubes keep the sign, so there is only one answer.', 'Deshaz el cubo con una raíz cúbica. Los cubos conservan el signo, así que hay una sola respuesta.');
  }
  const P = L0.sub(R0);
  const f = (x: number) => P.evalX(x);
  s.steps.push({
    title: even ? T('Take the square root', 'Saca raíz cuadrada') : T('Take the cube root', 'Saca raíz cúbica'),
    text,
    latex,
    scene: balanceScene(s),
  });
  s.steps.push(graphRootsStep(P, roots, T('On the graph', 'En la gráfica')));
  void f;
  return {
    kind: n === 2 ? T('Quadratic (x² = number)', 'Cuadrática (x² = número)') : T('Power equation', 'Ecuación de potencia'),
    inputLatex,
    steps: s.steps,
    answer: roots.length ? latex : NO_REAL(),
  };
}

function graphRootsStep(P: Poly, roots: number[], title: string, extra = ''): Step {
  const f = (x: number) => P.evalX(x);
  const frame = makeFrame(roots, [f], [P.evalX(0)]);
  return {
    title,
    text:
      (roots.length
        ? T(`The solutions are where the graph of y = ${P} crosses the x-axis (where y = 0).`, `Las soluciones están donde la gráfica de y = ${P} cruza el eje x (donde y = 0).`)
        : T(`The graph of y = ${P} never touches the x-axis, so there is no real solution.`, `La gráfica de y = ${P} nunca toca el eje x, así que no hay solución real.`)) + extra,
    latex: roots.length ? `x \\in \\{${roots.map((r) => fmtNum(r)).join(',\\ ')}\\}` : NO_REAL(),
    scene: graph(
      frame,
      [{ id: 'P', fn: f, color: COLORS.curve, label: `y = ${P}`, draw: true }],
      roots.map((r, i) => pt(`root${i}`, r, 0, COLORS.root, `x = ${fmtNum(r)}`, true)),
    ),
  };
}

// ---------------------------------------------------------------- polynomials of degree 2+

interface Factor {
  latex: string;
  text?: string;
  /** Solutions of factor = 0. */
  roots: { latex: string; value: number }[];
  /** How to solve "factor = 0" in one line. */
  solve: string;
  axis?: Axis;
  dim?: string;
}

function linearFactor(r: Fraction): Factor {
  // factor (q x - p) for r = p/q
  const q = r.d;
  const p = r.n;
  const lat = linearFactorLatex(r);
  const inner = lat.replace(/^\(|\)$/g, '');
  const solve = p === 0 ? `x = 0` : q === 1 ? `${inner} = 0 \\Rightarrow x = ${r.toLatex()}` : `${inner} = 0 \\Rightarrow ${q}x = ${p} \\Rightarrow x = ${r.toLatex()}`;
  const text =
    p === 0
      ? T('This one is already solved: x = 0.', 'Este ya está resuelto: x = 0.')
      : q === 1
        ? T(`${p > 0 ? `Add ${p}` : `Take away ${-p}`} on both sides: x = ${r}.`, `${p > 0 ? `Suma ${p}` : `Resta ${-p}`} en ambos lados: x = ${r}.`)
        : T(`${p > 0 ? `Add ${p}` : `Take away ${-p}`} on both sides, then divide by ${q}: x = ${r}.`, `${p > 0 ? `Suma ${p}` : `Resta ${-p}`} en ambos lados y luego divide entre ${q}: x = ${r}.`);
  return {
    latex: lat,
    text,
    roots: [{ latex: r.toLatex(), value: r.value() }],
    solve,
    axis: p <= 0 ? { xs: q, units: -p } : undefined,
    dim: minus(inner.replace(/\s/g, ' ')),
  };
}

function polySolution(s: BalanceState, left: Node, right: Node, inputLatex: string): Solution {
  firstSteps(s, left, right, inputLatex, T('Both sides of the "=" weigh the same.', 'Los dos lados del "=" pesan lo mismo.'));

  // 1. Everything on one side, with a positive leading coefficient.
  const deg = s.L.sub(s.R).degX();
  const lead = s.L.sub(s.R).coef(deg);
  const xd = `x${deg === 2 ? '²' : deg === 3 ? '³' : `^${deg}`}`;
  if (lead.sign() < 0)
    pushSwap(s, T(`The ${xd} blocks are mostly on the right, so we put that side on the left.`, `La mayoría de los bloques ${xd} están a la derecha, así que ponemos ese lado a la izquierda.`));
  if (!s.R.isZero()) {
    pushAddBoth(s, s.R.scale(F(-1)), T('Move everything to the left so the right side is 0. (Why 0? Because if a product is 0, one of its factors must be 0.)', 'Pasa todo a la izquierda para que el lado derecho sea 0. (¿Por qué 0? Porque si un producto es 0, uno de sus factores debe ser 0.)'));
  }
  // 2. Divide out a common whole number.
  const g = integerContent(s.L.coeffsX());
  if (g > 1) pushDivide(s, F(g), T('every block', 'cada bloque'));

  const P = s.L;
  const cs = trim(P.coeffsX());
  const f = (x: number) => P.evalX(x);
  const fac = factor(cs);
  const factors: Factor[] = [];
  for (let i = 0; i < fac.xPower; i++) factors.push(linearFactor(F(0)));
  for (const r of fac.roots) factors.push(linearFactor(r));

  // Whole-number scale left over after writing roots as (qx - p).
  const qprod = fac.roots.reduce((acc, r) => acc * r.d, 1);
  const k = fac.c.div(F(qprod));
  const restDeg = fac.rest.length - 1;

  const factoredLatex = (fs: Factor[], rest: string) => {
    const kk = k.eq(Fraction.ONE) ? '' : k.eq(F(-1)) ? '-' : k.toLatex();
    const parts = mergePowers(fs.map((x) => x.latex));
    return `${kk}${parts.join('')}${rest}`;
  };

  const restPoly = Poly.fromCoeffs(fac.rest);
  const restLatex = restDeg > 0 ? `\\left(${restPoly.toLatex()}\\right)` : '';

  // 3. A box (rectangle / cuboid) picture when every factor has positive whole numbers.
  const boxable =
    restDeg === 0 &&
    k.isInt() &&
    k.n > 0 &&
    k.n <= 3 &&
    factors.length >= 2 &&
    factors.length <= 3 &&
    factors.every((x) => x.axis && x.axis.xs <= 3 && x.axis.units <= 8);

  const steps = s.steps;
  const graphPts: GPoint[] = [];
  const frame = makeFrame(
    numericRoots(cs).concat(fac.roots.map((r) => r.value())),
    [f],
    [P.evalX(0)],
  );
  const curve: GCurve = { id: 'P', fn: f, color: COLORS.curve, label: `y = ${P}`, draw: true };

  if (boxable) {
    const axes = factors.map((x) => ({ ...x.axis! }));
    const dims = factors.map((x) => x.dim!);
    if (k.n > 1) {
      axes[0] = { xs: axes[0].xs * k.n, units: axes[0].units * k.n };
      dims[0] = `${k.n}(${dims[0]})`;
    }
    while (axes.length < 3) {
      axes.push({ xs: 0, units: 1 });
      dims.push('1');
    }
    const flat = deg === 2;
    const volDims = dims.map((d) => (d.includes(' ') ? `(${d})` : d)).join(' × ');
    const box = (showDims: boolean): Scene => ({
      type: 'box',
      id: s.idL,
      axes: axes as [Axis, Axis, Axis],
      dims: dims as [string, string, string],
      showDims,
    });
    steps.push({
      title: flat ? T('Arrange the blocks into a rectangle', 'Acomoda los bloques en un rectángulo') : T('Stack the blocks into a box', 'Apila los bloques en una caja'),
      text: flat
        ? T('Factoring means writing the expression as a multiplication. Arrange all the blocks into one rectangle: its area is the expression.', 'Factorizar es escribir la expresión como una multiplicación. Acomoda todos los bloques en un solo rectángulo: su área es la expresión.')
        : T('Factoring means writing the expression as a multiplication. Stack all the blocks into one box: its volume is the expression.', 'Factorizar es escribir la expresión como una multiplicación. Apila todos los bloques en una sola caja: su volumen es la expresión.'),
      latex: `${P.toLatex()} = 0`,
      scene: box(false),
    });
    steps.push({
      title: flat ? T('Read the sides of the rectangle', 'Lee los lados del rectángulo') : T('Read the edges of the box', 'Lee las aristas de la caja'),
      text: flat
        ? T(`Area = width × length. The sides are ${dims[0]} and ${dims[1]}, so the area is (${dims[0]})(${dims[1]}). That is the factored form.`, `Área = ancho × largo. Los lados miden ${dims[0]} y ${dims[1]}, así que el área es (${dims[0]})(${dims[1]}). Esa es la forma factorizada.`)
        : T(`Volume = length × width × height = ${volDims}. That is the factored form.`, `Volumen = largo × ancho × alto = ${volDims}. Esa es la forma factorizada.`),
      latex: `${P.toLatex()} = ${factoredLatex(factors, '')}`,
      scene: box(true),
    });
  } else {
    // Show the factoring on the graph.
    steps.push({
      title: T('Look at the graph', 'Mira la gráfica'),
      text: T(`Solving ${P} = 0 means finding where the graph of y = ${P} crosses the x-axis. Let's find those points with algebra.`, `Resolver ${P} = 0 es encontrar dónde la gráfica de y = ${P} cruza el eje x. Encontremos esos puntos con álgebra.`),
      latex: `${P.toLatex()} = 0`,
      scene: graph(frame, [curve]),
    });
    if (fac.xPower > 0 && factors.length + restDeg > 1) {
      const xp = fac.xPower === 1 ? 'x' : `x^{${fac.xPower}}`;
      const xpPlain = latexToPlain(xp);
      const inner = Poly.fromCoeffs(cs.slice(fac.xPower));
      steps.push({
        title: T(`Take out the common factor ${xpPlain}`, `Saca el factor común ${xpPlain}`),
        text: T(`Every term contains ${xpPlain}, so we can take it out in front of a bracket.`, `Todos los términos tienen ${xpPlain}, así que lo sacamos fuera de un paréntesis.`),
        latex: `${P.toLatex()} = ${xp}\\left(${inner.toLatex()}\\right)`,
        scene: graph(frame, [curve], [pt('root-0', 0, 0, COLORS.root, 'x = 0', true)]),
      });
      graphPts.push(pt('root-0', 0, 0, COLORS.root, 'x = 0', true));
    }
    // Explain the rational roots.
    let q = cs.slice(fac.xPower);
    const realRoots = fac.roots;
    if (realRoots.length) {
      const qdeg = q.length - 1;
      if (qdeg === 2 && q[2].eq(Fraction.ONE) && realRoots.every((r) => r.isInt())) {
        const [r1, r2] = realRoots;
        const a = -r1.n;
        const b = -r2.n;
        steps.push({
          title: T('Find two numbers', 'Busca dos números'),
          text: T(`For x² + bx + c we need two numbers that multiply to c = ${q[0]} and add to b = ${q[1]}. They are ${a} and ${b}.`, `Para x² + bx + c buscamos dos números que multiplicados den c = ${q[0]} y sumados den b = ${q[1]}. Son ${a} y ${b}.`),
          latex: `${a} \\times ${b < 0 ? `(${b})` : b} = ${q[0]} \\qquad ${a} + ${b < 0 ? `(${b})` : b} = ${q[1]}`,
          scene: graph(frame, [curve], graphPts.slice()),
        });
      } else {
        for (const r of realRoots) {
          const qp = Poly.fromCoeffs(q);
          if (q.length - 1 <= 1) break;
          const nq = divideByRoot(q, r);
          const lf = minus(linearFactorLatex(r).replace(/[()]/g, ''));
          steps.push({
            title: T(`Try x = ${r}`, `Prueba x = ${r}`),
            text: T(`Testing small numbers: when x = ${r}, ${qp} = 0. So ${lf} is a factor. Divide it out.`, `Probando números pequeños: cuando x = ${r}, ${qp} = 0. Entonces ${lf} es un factor. Divide entre él.`),
            latex: `${qp.toLatex()} = ${linearFactorLatex(r)}\\left(${Poly.fromCoeffs(nq).scale(F(r.d)).toLatex()}\\right)`,
            scene: graph(frame, [curve], [...graphPts, pt(`root-${r}`, r.value(), 0, COLORS.root, `x = ${r}`, true)]),
          });
          graphPts.push(pt(`root-${r}`, r.value(), 0, COLORS.root, `x = ${r}`, true));
          q = nq;
        }
      }
    }
    if (factors.length + (restDeg > 0 ? 1 : 0) > 1 || restDeg === 0) {
      steps.push({
        title: T('Factored form', 'Forma factorizada'),
        text: T('Now the left side is written as a multiplication of simpler pieces (factors).', 'Ahora el lado izquierdo está escrito como una multiplicación de piezas más simples (factores).'),
        latex: `${factoredLatex(factors, restLatex)} = 0`,
        scene: graph(frame, [curve], graphPts.slice()),
      });
    }
  }

  // 4. Zero product property.
  const allFactors = factors.slice();
  if (restDeg > 0) {
    allFactors.push(restFactor(fac.rest));
  }
  const unique = dedupeFactors(allFactors);
  if (unique.length > 1) {
    steps.push({
      title: T('If a product is 0, a factor is 0', 'Si un producto es 0, un factor es 0'),
      text: boxable
        ? deg === 2
          ? T('A rectangle can only have area 0 if one of its sides has length 0. So one of the factors must be 0.', 'Un rectángulo solo tiene área 0 si uno de sus lados mide 0. Así que uno de los factores debe ser 0.')
          : T('A box can only have volume 0 if one of its edges has length 0. So one of the factors must be 0.', 'Una caja solo tiene volumen 0 si una de sus aristas mide 0. Así que uno de los factores debe ser 0.')
        : T('If a × b = 0, then a = 0 or b = 0. So we set each factor equal to 0.', 'Si a × b = 0, entonces a = 0 o b = 0. Así que igualamos cada factor a 0.'),
      latex: unique.map((u) => `${unwrap(u.latex)} = 0`).join(` \\quad\\text{${T('or', 'o')}}\\quad `),
      scene: steps[steps.length - 1].scene,
    });
  }

  // 5. Solve each factor.
  const roots: { latex: string; value: number }[] = [];
  for (const u of unique) {
    roots.push(...u.roots);
    const pts = roots.map((r, i) => pt(`root-sol-${i}`, r.value, 0, COLORS.root, `x = ${fmtNum(r.value)}`, true));
    if (u.quad) steps.push(...u.quad(frame, curve, pts.slice(0, roots.length - u.roots.length)));
    steps.push({
      title: T(`Solve ${latexToPlain(unwrap(u.latex))} = 0`, `Resuelve ${latexToPlain(unwrap(u.latex))} = 0`),
      text: u.roots.length ? u.text : u.text || T('This factor is never 0 for real numbers.', 'Este factor nunca es 0 con números reales.'),
      latex: u.solve,
      scene: graph(frame, [curve], pts),
    });
  }

  const sorted = roots.sort((a, b) => a.value - b.value);
  steps.push({
    title: T('All the solutions', 'Todas las soluciones'),
    text: sorted.length
      ? T(`The graph of y = ${P} crosses (or touches) the x-axis exactly at the solutions.`, `La gráfica de y = ${P} cruza (o toca) el eje x justo en las soluciones.`)
      : T(`The graph of y = ${P} never touches the x-axis: there is no real solution.`, `La gráfica de y = ${P} nunca toca el eje x: no hay solución real.`),
    latex: sorted.length ? sorted.map(rootEq).join(',\\quad ') : NO_REAL(),
    scene: graph(
      frame,
      [curve],
      sorted.map((r, i) => pt(`root-sol-${i}`, r.value, 0, COLORS.root, `x = ${fmtNum(r.value)}`, true)),
    ),
  });

  return {
    kind: deg === 2 ? T('Quadratic equation', 'Ecuación cuadrática') : deg === 3 ? T('Cubic equation', 'Ecuación cúbica') : T(`Degree ${deg} equation`, `Ecuación de grado ${deg}`),
    inputLatex,
    steps,
    answer: sorted.length
      ? sorted.some((r) => r.latex.startsWith('\\approx'))
        ? sorted.map(rootEq).join(',\\ ')
        : `x = ${sorted.map((r) => r.latex).join(',\\ ')}`
      : NO_REAL(),
  };
}

const NO_REAL = () => `\\text{${T('no real solution', 'sin solución real')}}`;

const NO_SOL = () => `\\text{${T('no solution', 'sin solución')}}`;
const TABLE_TITLE = () => T('Make a table of values', 'Haz una tabla de valores');
const TABLE_TEXT = () => T('Choose some x values, work out y for each, and plot the points (x, y).', 'Elige algunos valores de x, calcula y para cada uno y grafica los puntos (x, y).');
const CROSS_TITLE = () => T('Where does it cross the x-axis?', '¿Dónde cruza el eje x?');

const rootEq = (r: { latex: string }) => (r.latex.startsWith('\\approx') ? `x ${r.latex}` : `x = ${r.latex}`);

function mergePowers(parts: string[]): string[] {
  const out: string[] = [];
  const counts = new Map<string, number>();
  for (const p of parts) counts.set(p, (counts.get(p) ?? 0) + 1);
  for (const [p, n] of counts) {
    if (n === 1) out.push(p);
    else if (p === 'x') out.push(`x^{${n}}`);
    else out.push(`${p}^{${n}}`);
  }
  return out;
}

interface FactorSolve extends Factor {
  text: string;
  quad?: (frame: GraphFrame, curve: GCurve, pts: GPoint[]) => Step[];
}

function dedupeFactors(fs: Factor[]): FactorSolve[] {
  const seen = new Set<string>();
  const out: FactorSolve[] = [];
  for (const f of fs) {
    if (seen.has(f.latex)) continue;
    seen.add(f.latex);
    out.push({ ...f, text: f.text ?? T('Undo each operation to get x on its own.', 'Deshaz cada operación para dejar x sola.') });
  }
  return out;
}

/** A factor with no rational roots: quadratic formula, or numbers from the graph. */
function restFactor(rest: Fraction[]): FactorSolve {
  const p = Poly.fromCoeffs(rest);
  const lat = `\\left(${p.toLatex()}\\right)`;
  if (rest.length === 3) {
    const q = solveQuadratic(rest);
    const roots = q.exact.map((e, i) => ({ latex: e, value: q.values[i] }));
    const fmt = (v: number) => (v < 0 ? `(${v})` : `${v}`);
    return {
      latex: lat,
      roots,
      text: q.disc < 0
        ? T(`The discriminant is negative (${q.disc}), so we can't take its square root: no real solutions from this factor.`, `El discriminante es negativo (${q.disc}), así que no podemos sacar su raíz cuadrada: este factor no da soluciones reales.`)
        : T(`So x = ${roots.map((r) => fmtNum(r.value)).join(' or x = ')} (rounded).`, `Entonces x = ${roots.map((r) => fmtNum(r.value)).join(' o x = ')} (redondeado).`),
      solve: q.disc < 0
        ? `\\Delta = ${q.disc} < 0 \\Rightarrow ${NO_REAL()}`
        : `x = ${q.exact.join(` \\ \\text{${T('or', 'o')}}\\ x = `)} \\approx ${q.values.map((v) => fmtNum(v)).join(',\\ ')}`,
      quad: (frame, curve, pts) => [
        {
          title: T('Use the quadratic formula', 'Usa la fórmula general'),
          text: T(`${p} has no nice factors, so we use the formula with a = ${q.a}, b = ${q.b}, c = ${q.c}. First, the discriminant Δ = b² − 4ac tells us how many solutions there are.`, `${p} no tiene factores sencillos, así que usamos la fórmula general con a = ${q.a}, b = ${q.b}, c = ${q.c}. Primero, el discriminante Δ = b² − 4ac nos dice cuántas soluciones hay.`),
          latex: `x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\qquad \\Delta = ${fmt(q.b)}^2 - 4\\cdot ${fmt(q.a)} \\cdot ${fmt(q.c)} = ${q.disc}`,
          scene: graph(frame, [curve], pts),
        },
      ],
    };
  }
  const nums = numericRoots(rest);
  return {
    latex: lat,
    roots: nums.map((v) => ({ latex: `\\approx ${fmtNum(v)}`, value: v })),
    text: nums.length
      ? T('This factor has no simple whole-number roots, so we read the solutions from the graph (zooming in until they are accurate).', 'Este factor no tiene raíces enteras sencillas, así que leemos las soluciones en la gráfica (acercándonos hasta que sean precisas).')
      : T('This factor is never zero.', 'Este factor nunca es cero.'),
    solve: nums.length ? `x \\approx ${nums.map((v) => fmtNum(v)).join(',\\ ')}` : NO_REAL(),
  };
}

// ---------------------------------------------------------------- y as a function of x

function functionSolution(rhs: Node, inputLatex: string): Solution {
  const P = toPoly(rhs);
  const f = compile(rhs);
  const fx = (x: number) => f(x);
  const steps: Step[] = [];
  const simplified = P ? `y = ${P.toLatex()}` : inputLatex;
  if (P && cleanLatex(simplified) !== cleanLatex(inputLatex)) {
    steps.push({
      title: T('Simplify', 'Simplifica'),
      text: T('Expand brackets and collect like terms first. It is the same function, written more simply.', 'Primero quita paréntesis y junta términos semejantes. Es la misma función, escrita de forma más sencilla.'),
      latex: `${inputLatex} \\;\\Longrightarrow\\; ${simplified}`,
      scene: graph(makeFrame([], [fx]), []),
    });
  }
  const deg = P ? P.degX() : -1;
  if (P && deg <= 1) return linearFunction(P, inputLatex, steps);
  if (P && deg === 2) return quadraticFunction(P, inputLatex, steps);
  return generalFunction(fx, P, inputLatex, steps);
}

function linearFunction(P: Poly, inputLatex: string, steps: Step[]): Solution {
  const m = P.coef(1);
  const b = P.coef(0);
  const f = (x: number) => P.evalX(x);
  const root = m.isZero() ? null : b.neg().div(m);
  const frame = makeFrame([0, root?.value() ?? 0, 2, -2], [f], [b.value()]);
  const line: GCurve = { id: 'line', fn: f, color: COLORS.curve, label: `y = ${P}`, draw: true };
  const xs = [-2, -1, 0, 1, 2];
  const table = tablePoints(xs, f);

  if (m.isZero()) {
    steps.push({
      title: T('A horizontal line', 'Una recta horizontal'),
      text: T(`There is no x in y = ${b}, so y is ${b} for every x. The graph is a flat (horizontal) line.`, `No hay x en y = ${b}, así que y vale ${b} para toda x. La gráfica es una recta plana (horizontal).`),
      latex: `y = ${b.toLatex()}`,
      scene: graph(frame, [], table),
    });
    steps.push({
      title: T('Draw the line', 'Traza la recta'),
      text: T(`Join the points: every point has height ${b}.`, `Une los puntos: todos tienen altura ${b}.`),
      latex: `y = ${b.toLatex()}`,
      scene: graph(frame, [line], table),
    });
    return { kind: T('Constant function', 'Función constante'), inputLatex, steps, answer: `y = ${b.toLatex()}` };
  }

  steps.push({
    title: T('Meet the line', 'Conoce la recta'),
    text: T(`This is a linear function y = mx + b, so its graph is a straight line. The slope is m = ${m} (how much y changes when x goes up by 1) and the y-intercept is b = ${b} (where it crosses the y-axis).`, `Es una función lineal y = mx + b, así que su gráfica es una línea recta. La pendiente es m = ${m} (cuánto cambia y cuando x aumenta 1) y la ordenada al origen es b = ${b} (donde cruza el eje y).`),
    latex: `y = \\underbrace{${m.eq(Fraction.ONE) ? '1' : fracLatex(m)}}_{m}\\,x ${b.sign() < 0 ? '-' : '+'} \\underbrace{${fracLatex(b.abs())}}_{b}`,
    scene: graph(frame, []),
  });
  steps.push({
    title: TABLE_TITLE(),
    text: TABLE_TEXT(),
    latex: tableLatex(xs, f),
    scene: graph(frame, [], table),
  });
  const B = pt('b', 0, b.value(), COLORS.vertex, T(`y-intercept (0, ${b})`, `ordenada al origen (0, ${b})`), true);
  steps.push({
    title: T('Start at the y-intercept', 'Empieza en la ordenada al origen'),
    text: T(`When x = 0, y = ${b}. That is where the line crosses the y-axis.`, `Cuando x = 0, y = ${b}. Ahí es donde la recta cruza el eje y.`),
    latex: `x = 0 \\Rightarrow y = ${m.toLatex()}\\cdot 0 ${b.sign() < 0 ? '-' : '+'} ${b.abs().toLatex()} = ${b.toLatex()}`,
    scene: graph(frame, [], [...table, B]),
  });
  const run = m.d;
  const rise = m.n;
  const segs: GSeg[] = [
    { id: 'run', from: [0, b.value()], to: [run, b.value()], color: COLORS.run, label: T(`run = ${run}`, `avanza = ${run}`), arrow: true },
    { id: 'rise', from: [run, b.value()], to: [run, b.value() + rise], color: COLORS.rise, label: minus(T(`rise = ${rise}`, `sube = ${rise}`)), arrow: true },
  ];
  steps.push({
    title: T('Use the slope: rise over run', 'Usa la pendiente: sube entre avanza'),
    text: T(
      `Slope m = ${m} = ${rise}/${run}: from any point, go ${run} to the right and ${Math.abs(rise)} ${rise >= 0 ? 'up' : 'down'} to reach the next point on the line.`,
      `Pendiente m = ${m} = ${rise}/${run}: desde cualquier punto, avanza ${run} a la derecha y ${rise >= 0 ? 'sube' : 'baja'} ${Math.abs(rise)} para llegar al siguiente punto de la recta.`,
    ),
    latex: `m = \\frac{\\text{${T('rise', 'sube')}}}{\\text{${T('run', 'avanza')}}} = \\frac{${rise}}{${run}}`,
    scene: graph(frame, [], [...table, B], segs),
  });
  steps.push({
    title: T('Draw the line', 'Traza la recta'),
    text: T('All the points lie on one straight line. Join them up and extend it in both directions.', 'Todos los puntos están sobre una misma recta. Únelos y alárgala en ambas direcciones.'),
    latex: `y = ${P.toLatex()}`,
    scene: graph(frame, [line], [...table, B], segs),
  });
  const R = pt('root', root!.value(), 0, COLORS.root, T(`x-intercept (${root}, 0)`, `corte con eje x (${root}, 0)`), true);
  steps.push({
    title: CROSS_TITLE(),
    text: T(`On the x-axis y = 0. Solve 0 = ${P}: x = ${root}.`, `En el eje x, y = 0. Resuelve 0 = ${P}: x = ${root}.`),
    latex: `0 = ${P.toLatex()} \\Rightarrow x = ${root!.toLatex()}`,
    scene: graph(frame, [line], [B, R], segs),
  });
  return { kind: T('Linear function', 'Función lineal'), inputLatex, steps, answer: `m = ${m.toLatex()},\\ b = ${b.toLatex()}` };
}

function quadraticFunction(P: Poly, inputLatex: string, steps: Step[]): Solution {
  const a = P.coef(2);
  const b = P.coef(1);
  const c = P.coef(0);
  const f = (x: number) => P.evalX(x);
  const xv = b.neg().div(a.mul(F(2)));
  const yv = evalFrac(P.coeffsX(), xv);
  const q = solveQuadratic(P.coeffsX());
  const frame = makeFrame([xv.value(), ...q.values, 0], [f], [yv.value(), c.value()]);
  const curve: GCurve = { id: 'parab', fn: f, color: COLORS.curve, label: `y = ${P}`, draw: true };
  const xs = [-2, -1, 0, 1, 2].map((d) => Math.round(xv.value()) + d);
  const table = tablePoints(xs, f);
  steps.push({
    title: T('Meet the parabola', 'Conoce la parábola'),
    text: T(
      `This is a quadratic: y = ax² + bx + c with a = ${a}, b = ${b}, c = ${c}. Its graph is a U-shaped curve called a parabola. Since a ${a.sign() > 0 ? '> 0 it opens upwards ∪ (a smile)' : '< 0 it opens downwards ∩ (a frown)'}.`,
      `Es una cuadrática: y = ax² + bx + c con a = ${a}, b = ${b}, c = ${c}. Su gráfica es una curva en forma de U llamada parábola. Como a ${a.sign() > 0 ? '> 0, abre hacia arriba ∪ (una sonrisa)' : '< 0, abre hacia abajo ∩ (una cara triste)'}.`,
    ),
    latex: `y = ${P.toLatex()} \\qquad a = ${a.toLatex()},\\ b = ${b.toLatex()},\\ c = ${c.toLatex()}`,
    scene: graph(frame, []),
  });
  steps.push({
    title: TABLE_TITLE(),
    text: T('Pick x values around the middle of the curve and compute y. Notice the y values repeat symmetrically!', 'Elige valores de x alrededor del centro de la curva y calcula y. ¡Observa que los valores de y se repiten de forma simétrica!'),
    latex: tableLatex(xs, f),
    scene: graph(frame, [], table),
  });
  const V = pt('vertex', xv.value(), yv.value(), COLORS.vertex, T(`vertex (${xv}, ${yv})`, `vértice (${xv}, ${yv})`), true);
  const axisSeg: GSeg = { id: 'axis', from: [xv.value(), frame.ymin], to: [xv.value(), frame.ymax], color: COLORS.vertex, dashed: true, label: `x = ${xv}` };
  steps.push({
    title: T('Find the vertex', 'Encuentra el vértice'),
    text: T(`The turning point (vertex) is at x = −b / 2a = ${xv}. The parabola is symmetric about the dashed line x = ${xv}.`, `El punto donde da la vuelta (vértice) está en x = −b / 2a = ${xv}. La parábola es simétrica respecto a la línea punteada x = ${xv}.`),
    latex: `x_v = \\frac{-b}{2a} = \\frac{${b.neg().toLatex()}}{${a.mul(F(2)).toLatex()}} = ${xv.toLatex()} \\qquad y_v = ${yv.toLatex()}`,
    scene: graph(frame, [], [...table, V], [axisSeg]),
  });
  const C = pt('c', 0, c.value(), COLORS.point, T(`y-intercept (0, ${c})`, `ordenada al origen (0, ${c})`), true);
  steps.push({
    title: T('Draw the parabola', 'Traza la parábola'),
    text: T(`Join the points with a smooth curve. It crosses the y-axis at c = ${c}.`, `Une los puntos con una curva suave. Cruza el eje y en c = ${c}.`),
    latex: `y = ${P.toLatex()}`,
    scene: graph(frame, [curve], [...table, V, C], [axisSeg]),
  });
  const roots = q.values.map((v, i) => pt(`r${i}`, v, 0, COLORS.root, `x = ${fmtNum(v)}`, true));
  const fmt = (v: number) => (v < 0 ? `(${v})` : `${v}`);
  steps.push({
    title: CROSS_TITLE(),
    text: q.disc < 0
      ? T(`Solve ${P} = 0. The discriminant b² − 4ac = ${q.disc} is negative, so the parabola never reaches the x-axis.`, `Resuelve ${P} = 0. El discriminante b² − 4ac = ${q.disc} es negativo, así que la parábola nunca llega al eje x.`)
      : q.disc === 0
        ? T(`Solve ${P} = 0. The discriminant is 0, so the parabola just touches the x-axis at its vertex.`, `Resuelve ${P} = 0. El discriminante es 0, así que la parábola solo toca el eje x en su vértice.`)
        : T(`Solve ${P} = 0 with the quadratic formula. The discriminant is ${q.disc} > 0, so there are two crossing points.`, `Resuelve ${P} = 0 con la fórmula general. El discriminante es ${q.disc} > 0, así que hay dos puntos de cruce.`),
    latex: q.disc < 0
      ? `\\Delta = ${fmt(q.b)}^2 - 4 \\cdot ${fmt(q.a)} \\cdot ${fmt(q.c)} = ${q.disc} < 0`
      : `x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} \\Rightarrow x = ${q.exact.join(',\\ ')}`,
    scene: graph(frame, [curve], [V, C, ...roots], [axisSeg]),
  });
  return {
    kind: T('Quadratic function', 'Función cuadrática'),
    inputLatex,
    steps,
    answer: `\\text{${T('vertex', 'vértice')} } (${xv.toLatex()}, ${yv.toLatex()})`,
  };
}

function generalFunction(f: (x: number) => number, P: Poly | null, inputLatex: string, steps: Step[]): Solution {
  let roots: number[];
  if (P) {
    const fac = factor(trim(P.coeffsX()));
    roots = numericRoots(trim(P.coeffsX()));
    void fac;
  } else roots = numericZeros(f, -20, 20);
  roots = roots.filter((r) => Math.abs(r) <= 20);
  const y0 = f(0);
  const frame = makeFrame(roots.length ? roots : [-3, 3], [f], Number.isFinite(y0) ? [y0] : []);
  const step = (frame.xmax - frame.xmin) / 8;
  const xs = Array.from({ length: 7 }, (_, i) => +(frame.xmin + step * (i + 1)).toFixed(1)).filter((x) => Number.isFinite(f(x)));
  const table = tablePoints(xs, f);
  const curve: GCurve = { id: 'f', fn: f, color: COLORS.curve, label: inputLatex.replace(/\\left|\\right|\\/g, ''), draw: true };
  const deg = P ? P.degX() : -1;
  steps.push({
    title: T('Meet the function', 'Conoce la función'),
    text: deg >= 3
      ? T(`This is a polynomial of degree ${deg}. Its graph can turn up to ${deg - 1} times and cross the x-axis up to ${deg} times.`, `Es un polinomio de grado ${deg}. Su gráfica puede dar vuelta hasta ${deg - 1} veces y cruzar el eje x hasta ${deg} veces.`)
      : T('For every x, the rule tells us one y. We will plot points and join them.', 'Para cada x, la regla nos da una y. Vamos a graficar puntos y unirlos.'),
    latex: inputLatex,
    scene: graph(frame, []),
  });
  steps.push({
    title: TABLE_TITLE(),
    text: TABLE_TEXT(),
    latex: tableLatex(xs, f),
    scene: graph(frame, [], table),
  });
  steps.push({
    title: T('Join the points', 'Une los puntos'),
    text: T('Join the points with a smooth curve.', 'Une los puntos con una curva suave.'),
    latex: inputLatex,
    scene: graph(frame, [curve], table),
  });
  const pts: GPoint[] = roots.map((r, i) => pt(`r${i}`, r, 0, COLORS.root, `x = ${fmtNum(r)}`, true));
  if (Number.isFinite(y0)) pts.push(pt('y0', 0, y0, COLORS.vertex, `(0, ${fmtNum(y0)})`, true));
  steps.push({
    title: T('Intercepts', 'Cortes con los ejes'),
    text: roots.length
      ? T(
          `The curve crosses the x-axis at x = ${roots.map((r) => fmtNum(r)).join(', ')}${Number.isFinite(y0) ? ` and the y-axis at y = ${fmtNum(y0)}` : ''}.`,
          `La curva cruza el eje x en x = ${roots.map((r) => fmtNum(r)).join(', ')}${Number.isFinite(y0) ? ` y el eje y en y = ${fmtNum(y0)}` : ''}.`,
        )
      : T('The curve never crosses the x-axis.', 'La curva nunca cruza el eje x.'),
    latex: roots.length
      ? `y = 0 \\iff x \\in \\{${roots.map((r) => fmtNum(r)).join(',\\ ')}\\}`
      : T('\\text{no } x\\text{-intercepts}', '\\text{no corta el eje } x'),
    scene: graph(frame, [curve], pts),
  });
  return {
    kind: P ? T(`Polynomial function (degree ${deg})`, `Función polinomial (grado ${deg})`) : T('Function', 'Función'),
    inputLatex,
    steps,
    answer: inputLatex,
  };
}

// ---------------------------------------------------------------- equations with x and y

function isolateYSolution(left: Node, right: Node, L: Poly, R: Poly, inputLatex: string): Solution {
  const s = newState(L, R);
  firstSteps(s, left, right, inputLatex, T('To draw this equation we first get y on its own, using the balance rules.', 'Para graficar esta ecuación primero despejamos y, usando las reglas de la balanza.'));
  collect(s, '0,1', T('y blocks', 'bloques y'));
  pushDivide(s, s.L.coef(0, 1), 'y');
  const fn = s.R;
  const fsol = functionSolutionFromPoly(fn);
  const steps = [...s.steps, ...fsol.steps];
  return { kind: T('Linear equation in x and y', 'Ecuación lineal en x y y'), inputLatex, steps, answer: `y = ${fn.toLatex()}` };
}

function functionSolutionFromPoly(P: Poly): Solution {
  const lat = `y = ${P.toLatex()}`;
  if (P.degX() <= 1) return linearFunction(P, lat, []);
  if (P.degX() === 2) return quadraticFunction(P, lat, []);
  return generalFunction((x) => P.evalX(x), P, lat, []);
}

function implicitSolution(
  fl: (x: number, y?: number) => number,
  fr: (x: number, y?: number) => number,
  inputLatex: string,
  D?: Poly,
): Solution {
  const F2 = (x: number, y: number) => fl(x, y) - fr(x, y);
  const steps: Step[] = [];
  // Circle: a(x² + y²) + dx + ey + f = 0
  const isCircle =
    D &&
    D.degX() <= 2 &&
    D.degY() <= 2 &&
    !D.coef(2, 0).isZero() &&
    D.coef(2, 0).eq(D.coef(0, 2)) &&
    D.coef(1, 1).isZero() &&
    [...D.terms.keys()].every((k) => ['2,0', '0,2', '1,0', '0,1', '0,0'].includes(k));
  if (D && isCircle) {
    const a = D.coef(2, 0);
    const h = D.coef(1, 0).div(a).div(F(-2));
    const k = D.coef(0, 1).div(a).div(F(-2));
    const r2 = h.mul(h).add(k.mul(k)).sub(D.coef(0, 0).div(a));
    const r = Math.sqrt(Math.max(r2.value(), 0));
    const frame = makeFrame([h.value() - r, h.value() + r], [], [k.value() - r, k.value() + r]);
    const sq = (v: string, c: Fraction) => (c.isZero() ? `${v}^2` : `(${v} ${c.sign() > 0 ? '-' : '+'} ${c.abs().toLatex()})^2`);
    steps.push({
      title: T('Is it a circle?', '¿Es una circunferencia?'),
      text: T('x² and y² appear with the same number in front and there is no xy term: that is the equation of a circle.', 'x² y y² tienen el mismo número enfrente y no hay término xy: es la ecuación de una circunferencia.'),
      latex: inputLatex,
      scene: { type: 'graph', frame, curves: [], points: [], segs: [] },
    });
    if (!h.isZero() || !k.isZero() || !a.eq(Fraction.ONE)) {
      steps.push({
        title: T('Complete the square', 'Completa el cuadrado'),
        text: T('Rewrite it in the standard form (x − h)² + (y − k)² = r². The centre is (h, k) and the radius is r.', 'Escríbela en la forma ordinaria (x − h)² + (y − k)² = r². El centro es (h, k) y el radio es r.'),
        latex: `${sq('x', h)} + ${sq('y', k)} = ${r2.toLatex()}`,
        scene: { type: 'graph', frame, curves: [], points: [pt('c', h.value(), k.value(), COLORS.vertex, T(`centre (${h}, ${k})`, `centro (${h}, ${k})`), true)], segs: [] },
      });
    }
    if (r2.sign() <= 0) {
      steps.push({
        title: r2.isZero() ? T('Just one point', 'Solo un punto') : T('No points at all', 'Ningún punto'),
        text: r2.isZero()
          ? T('The radius is 0, so the "circle" is just its centre.', 'El radio es 0, así que la "circunferencia" es solo su centro.')
          : T('r² would have to be negative, which is impossible: no point satisfies this equation.', 'r² tendría que ser negativo, lo cual es imposible: ningún punto cumple la ecuación.'),
        latex: `r^2 = ${r2.toLatex()}`,
        scene: { type: 'graph', frame, curves: [], points: [pt('c', h.value(), k.value(), COLORS.vertex, `(${h}, ${k})`, true)], segs: [] },
      });
      return { kind: T('Circle equation', 'Ecuación de circunferencia'), inputLatex, steps, answer: `r^2 = ${r2.toLatex()}` };
    }
    const rTex = Number.isInteger(r) ? `${r}` : `\\sqrt{${r2.toLatex()}} \\approx ${fmtNum(r)}`;
    const C = pt('c', h.value(), k.value(), COLORS.vertex, T(`centre (${h}, ${k})`, `centro (${h}, ${k})`), true);
    const radius: GSeg = { id: 'radius', from: [h.value(), k.value()], to: [h.value() + r, k.value()], color: COLORS.rise, label: `r = ${fmtNum(r)}`, arrow: true };
    steps.push({
      title: T('Centre and radius', 'Centro y radio'),
      text: T(`The centre is (${h}, ${k}) and the radius is ${fmtNum(r)}: every point on the circle is exactly that far from the centre.`, `El centro es (${h}, ${k}) y el radio es ${fmtNum(r)}: cada punto de la circunferencia está exactamente a esa distancia del centro.`),
      latex: `\\text{${T('centre', 'centro')} } (${h.toLatex()}, ${k.toLatex()}) \\qquad r = ${rTex}`,
      scene: { type: 'graph', frame, curves: [], points: [C], segs: [radius] },
    });
    steps.push({
      title: T('Draw the circle', 'Traza la circunferencia'),
      text: T('Swing the radius all the way round the centre.', 'Gira el radio una vuelta completa alrededor del centro.'),
      latex: inputLatex,
      scene: { type: 'graph', frame, curves: [], implicit: [{ id: 'imp', fn: F2, color: COLORS.curve }], points: [C], segs: [radius] },
    });
    return { kind: T('Circle', 'Circunferencia'), inputLatex, steps, answer: `\\text{${T('centre', 'centro')} } (${h.toLatex()}, ${k.toLatex()}),\\ r = ${rTex}` };
  }

  const frame: GraphFrame = { xmin: -10, xmax: 10, ymin: -8, ymax: 8 };
  steps.push({
    title: T('An equation with x and y', 'Una ecuación con x y y'),
    text: T('y cannot be put on its own easily here. Instead we colour every point (x, y) where the left side equals the right side.', 'Aquí no es fácil despejar y. En su lugar coloreamos cada punto (x, y) donde el lado izquierdo es igual al derecho.'),
    latex: inputLatex,
    scene: { type: 'graph', frame, curves: [], points: [], segs: [] },
  });
  steps.push({
    title: T('Draw all the solutions', 'Dibuja todas las soluciones'),
    text: T('Every point on this curve is a pair (x, y) that makes the equation true.', 'Cada punto de esta curva es una pareja (x, y) que hace verdadera la ecuación.'),
    latex: inputLatex,
    scene: { type: 'graph', frame, curves: [], implicit: [{ id: 'imp', fn: F2, color: COLORS.curve }], points: [], segs: [] },
  });
  return { kind: T('Curve in x and y', 'Curva en x y y'), inputLatex, steps, answer: inputLatex };
}

// ---------------------------------------------------------------- non-polynomial equations in x

function numericEquation(left: Node, right: Node, inputLatex: string): Solution {
  const fl = compile(left);
  const fr = compile(right);
  const g = (x: number) => fl(x) - fr(x);
  const roots = numericZeros(g, -20, 20).filter((r) => Math.abs(r) <= 20);
  const frame = makeFrame(roots.length ? roots : [-3, 3], [(x) => fl(x), (x) => fr(x)], roots.map((r) => fl(r)));
  const cl: GCurve = { id: 'L', fn: (x) => fl(x), color: COLORS.curve, label: `y = ${nodeLatex(left).replace(/\\left|\\right|\\/g, '')}`, draw: true };
  const cr: GCurve = { id: 'R', fn: (x) => fr(x), color: COLORS.curve2, label: `y = ${nodeLatex(right).replace(/\\left|\\right|\\/g, '')}`, draw: true };
  const pts = roots.map((r, i) => pt(`s${i}`, r, fl(r), COLORS.root, `x ≈ ${fmtNum(r)}`, true));
  const steps: Step[] = [
    {
      title: T('Two sides, two graphs', 'Dos lados, dos gráficas'),
      text: T('This equation is hard to solve with algebra alone. Draw each side as its own graph.', 'Esta ecuación es difícil de resolver solo con álgebra. Grafica cada lado por separado.'),
      latex: inputLatex,
      scene: graph(frame, [cl, cr]),
    },
    {
      title: T('Find where they meet', 'Encuentra dónde se cruzan'),
      text: roots.length
        ? T('Where the two graphs cross, both sides are equal: those x values are the solutions.', 'Donde las dos gráficas se cruzan, ambos lados son iguales: esos valores de x son las soluciones.')
        : T('The graphs never cross, so there is no solution in this range.', 'Las gráficas nunca se cruzan, así que no hay solución en este rango.'),
      latex: roots.length ? `x \\approx ${roots.map((r) => fmtNum(r)).join(',\\ ')}` : NO_SOL(),
      scene: graph(frame, [cl, cr], pts, roots.map((r, i) => ({ id: `d${i}`, from: [r, fl(r)], to: [r, 0], color: COLORS.root, dashed: true }))),
    },
  ];
  return {
    kind: T('Equation (solved with graphs)', 'Ecuación (resuelta con gráficas)'),
    inputLatex,
    steps,
    answer: roots.length ? `x \\approx ${roots.map((r) => fmtNum(r)).join(',\\ ')}` : NO_SOL(),
  };
}

// ---------------------------------------------------------------- 3D surfaces

function surfaceSolution(rhs: Node, inputLatex: string): Solution {
  const f = compile(rhs);
  const fn = (x: number, y: number) => f(x, y);
  const range = 5;
  const z0 = fn(0, 0);
  const origin = Number.isFinite(z0) ? [{ id: 'o', x: 0, y: 0, z: z0, label: `(0, 0, ${fmtNum(z0)})`, color: COLORS.vertex }] : [];
  const base = { type: 'surface' as const, fn, range };
  const rl = nodeLatex(rhs);
  const steps: Step[] = [
    {
      title: T('A function of two inputs', 'Una función de dos entradas'),
      text: T('Here every point (x, y) on the floor gets a height z. Together, all the heights make a surface in 3D. Drag to look around!', 'Aquí cada punto (x, y) del piso recibe una altura z. Juntas, todas las alturas forman una superficie en 3D. ¡Arrastra para mirar alrededor!'),
      latex: inputLatex,
      scene: { ...base, showSurface: false, slices: [], points: origin },
    },
    {
      title: T('Slice along y = 0', 'Corte en y = 0'),
      text: T('Fix y = 0: then z only depends on x, which is an ordinary graph. This is the orange curve.', 'Fija y = 0: entonces z solo depende de x, y es una gráfica normal. Es la curva naranja.'),
      latex: `y = 0 \\Rightarrow z = ${rl.replace(/y/g, '(0)')}`,
      scene: { ...base, showSurface: false, slices: ['y0'], points: origin },
    },
    {
      title: T('Slice along x = 0', 'Corte en x = 0'),
      text: T('Now fix x = 0: z only depends on y. This is the pink curve.', 'Ahora fija x = 0: z solo depende de y. Es la curva rosa.'),
      latex: `x = 0 \\Rightarrow z = ${rl.replace(/x/g, '(0)')}`,
      scene: { ...base, showSurface: false, slices: ['y0', 'x0'], points: origin },
    },
    {
      title: T('The whole surface', 'La superficie completa'),
      text: T('Do this for every slice and they fill in the whole surface. Colours show the height: blue is low, yellow is high.', 'Haz esto con cada corte y se llena toda la superficie. Los colores muestran la altura: azul es bajo, amarillo es alto.'),
      latex: inputLatex,
      scene: { ...base, showSurface: true, slices: ['y0', 'x0'], points: origin },
    },
  ];
  return { kind: T('3D surface', 'Superficie 3D'), inputLatex, steps, answer: inputLatex };
}
