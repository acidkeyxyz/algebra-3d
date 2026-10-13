// Learning path for ages 8–13: five tracks of levels, each level a generator of practice questions.
// Questions are built backwards from the answer so the numbers always come out clean.
// Text that contains words is bilingual ({ en, es }); numbers and formulas are language-neutral.

export interface Bi {
  en: string;
  es: string;
}
const bi = (en: string, es: string): Bi => ({ en, es });
const same = (s: string): Bi => ({ en: s, es: s });

export type TrackId = 'add' | 'mul' | 'div' | 'frac' | 'alg';
export type InputKind = 'int' | 'dec' | 'signed';

export type Visual =
  | { kind: 'array'; rows: number; cols: number }
  | { kind: 'groups'; total: number; groups: number }
  | { kind: 'pie'; num: number; den: number } // drawn as a pizza: num slices have toppings
  | { kind: 'hops'; step: number; count: number } // jumps along a number line: 0, step, 2·step …
  | { kind: 'paint'; rows: number; cols: number } // squares painted row by row with a running total
  | { kind: 'area'; n: number; parts: number[] }; // n × (part + part) as boxes

export interface Question {
  ask: Bi; // short instruction
  expr?: string; // big plain-text expression, e.g. "7 × 8 = ?"
  tex?: string; // or LaTeX, for fractions
  texEs?: string; // Spanish version when the LaTeX contains words
  answer: string; // ASCII, e.g. "-3", "1.5", "5/6"
  choices?: string[]; // multiple choice (answer is one of them); otherwise a keypad is used
  why: Bi; // explanation shown after a wrong answer
  visual?: Visual;
  explain?: Visual[]; // animated pictures shown after a wrong answer
  eq?: string; // an equation the 3D solver can open
}

export interface Level {
  id: string;
  track: TrackId;
  age: number; // age at which this level is the recommended place to start
  emoji: string;
  name: Bi;
  goal: Bi;
  input: InputKind;
  make: (r: Rng) => Question;
}

export type Rng = () => number;

/** Small seeded generator, so tests are repeatable. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r: Rng, lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = int(r, lo, hi);
  return v;
};
const pick = <T,>(r: Rng, xs: T[]) => xs[Math.floor(r() * xs.length)];
export function shuffle<T>(r: Rng, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
/** Display a number with a real minus sign. */
const fmt = (n: number | string) => String(n).replace(/-/g, '−');
/** Clean decimal text: no floating-point dust, no trailing zeros. */
const num = (x: number) => String(Math.round(x * 1e6) / 1e6);
/** Negative operands go in brackets: 5 − (−3). */
const paren = (n: number) => (n < 0 ? `(${fmt(n)})` : String(n));

// ---------- fractions as "n/d" text ----------

const frac = (n: number, d: number) => {
  const g = gcd(n, d);
  return `${n / g}/${d / g}`;
};
const same2 = (a: number, b: number, c: number, d: number) => a * d === b * c;
const parseFrac = (s: string): [number, number] => {
  const [n, d] = s.split('/').map(Number);
  return [n, d];
};
export const fracTex = (s: string) => {
  const [n, d] = parseFrac(s);
  return `\\frac{${n}}{${d}}`;
};
/** Three wrong fractions that look plausible and never equal the answer's value. */
function fracChoices(r: Rng, answer: string, wrong: [number, number][]): string[] {
  const [an, ad] = parseFrac(answer);
  const out: string[] = [answer];
  const ok = (n: number, d: number) => d > 0 && n > 0 && !same2(n, d, an, ad) && !out.includes(frac(n, d)) && !out.includes(`${n}/${d}`);
  for (const [n, d] of wrong) if (out.length < 4 && ok(n, d)) out.push(frac(n, d));
  let guard = 0;
  while (out.length < 4 && guard++ < 200) {
    const n = Math.max(1, an + int(r, -2, 2));
    const d = Math.max(2, ad + int(r, -2, 2));
    if (ok(n, d)) out.push(frac(n, d));
  }
  return shuffle(r, out);
}

// ---------- add / subtract ----------

function addSub(r: Rng, lo: number, hi: number): Question {
  const add = r() < 0.5;
  const a = int(r, lo, hi);
  const b = int(r, lo, hi);
  if (add) {
    const ans = a + b;
    return {
      ask: bi('Add.', 'Suma.'),
      expr: `${a} + ${b} = ?`,
      answer: String(ans),
      why: bi(
        `${a} + ${b} = ${ans}. Add the ones first, then the tens, then the hundreds, carrying when a column passes 9.`,
        `${a} + ${b} = ${ans}. Suma primero las unidades, luego las decenas y las centenas; si una columna pasa de 9, “llevas”.`,
      ),
    };
  }
  const [big, small] = a >= b ? [a, b] : [b, a];
  const ans = big - small;
  return {
    ask: bi('Subtract.', 'Resta.'),
    expr: `${big} − ${small} = ?`,
    answer: String(ans),
    why: bi(
      `${big} − ${small} = ${ans}. Check by adding back: ${ans} + ${small} = ${big}.`,
      `${big} − ${small} = ${ans}. Compruébalo sumando: ${ans} + ${small} = ${big}.`,
    ),
  };
}

function decAddSub(r: Rng): Question {
  const places = pick(r, [1, 2]);
  const k = 10 ** places;
  const a = int(r, 11, 20 * k - 1);
  const b = int(r, 11, 20 * k - 1);
  const add = r() < 0.5;
  const [big, small] = a >= b ? [a, b] : [b, a];
  const show = (n: number) => (n / k).toFixed(places);
  const ans = add ? a + b : big - small;
  return {
    ask: add ? bi('Add the decimals.', 'Suma los decimales.') : bi('Subtract the decimals.', 'Resta los decimales.'),
    expr: add ? `${show(a)} + ${show(b)} = ?` : `${show(big)} − ${show(small)} = ?`,
    answer: num(ans / k),
    why: bi(
      `Line up the decimal points, then ${add ? 'add' : 'subtract'} like whole numbers: ${num((add ? a + b : big - small) / k)}.`,
      `Alinea los puntos decimales y ${add ? 'suma' : 'resta'} como si fueran números enteros: ${num((add ? a + b : big - small) / k)}.`,
    ),
  };
}

function signedAddSub(r: Rng, lim: number, bracketed: boolean): Question {
  let a = 0;
  let b = 0;
  do {
    a = int(r, -lim, lim);
    b = nz(r, -lim, lim);
    if (bracketed && r() < 0.5) b = -Math.abs(b);
  } while (a >= 0 && b > 0);
  const add = r() < 0.5;
  const ans = add ? a + b : a - b;
  const op = add ? '+' : '−';
  const shown = fmt(`${a} ${op} ${paren(b)}`);
  const tip =
    !add && b < 0
      ? bi(`Subtracting a negative is the same as adding: ${fmt(`${a} − (${b})`)} = ${fmt(`${a} + ${-b}`)}.`, `Restar un negativo es sumar: ${fmt(`${a} − (${b})`)} = ${fmt(`${a} + ${-b}`)}.`)
      : add && b < 0
        ? bi('Adding a negative moves left on the number line.', 'Sumar un negativo es moverse a la izquierda en la recta numérica.')
        : bi(`Start at ${fmt(a)} on the number line and move ${b} steps ${add ? 'right' : 'left'}.`, `Empieza en ${fmt(a)} en la recta numérica y avanza ${b} pasos a la ${add ? 'derecha' : 'izquierda'}.`);
  return {
    ask: bi('Use the number line in your head.', 'Usa la recta numérica en tu mente.'),
    expr: `${shown} = ?`,
    answer: String(ans),
    why: { en: `${shown} = ${fmt(ans)}. ${tip.en}`, es: `${shown} = ${fmt(ans)}. ${tip.es}` },
  };
}

// ---------- multiply ----------

function table(r: Rng, factors: number[]): Question {
  const a = pick(r, factors);
  const b = int(r, 1, 10);
  const [x, y] = r() < 0.5 ? [a, b] : [b, a];
  const small = x * y <= 60;
  return {
    ask: bi('Multiply.', 'Multiplica.'),
    expr: `${x} × ${y} = ?`,
    answer: String(x * y),
    visual: small && x <= 10 && y <= 10 ? { kind: 'array', rows: y, cols: x } : undefined,
    explain: [{ kind: 'paint', rows: y, cols: x }, { kind: 'hops', step: x, count: y }],
    why: bi(
      `${x} × ${y} = ${x * y}: ${y} rows with ${x} in each row. Watch the squares fill up, or jump by ${x}, ${y} times.`,
      `${x} × ${y} = ${x * y}: ${y} filas con ${x} en cada una. Mira cómo se llenan los cuadros, o salta de ${x} en ${x}, ${y} veces.`,
    ),
  };
}

function digitsTimes(a: number, b: number): Question {
  // Split the bigger number into tens (or hundreds) and ones.
  const [split, other] = b >= 10 ? [b, a] : [a, b];
  const ones = split % 10;
  const hi = split - ones;
  const why =
    ones && hi
      ? bi(
          `Break ${split} into ${hi} + ${ones}: ${other} × ${hi} = ${other * hi} and ${other} × ${ones} = ${other * ones}. Add them: ${a * b}.`,
          `Separa ${split} en ${hi} + ${ones}: ${other} × ${hi} = ${other * hi} y ${other} × ${ones} = ${other * ones}. Suma: ${a * b}.`,
        )
      : bi(`${a} × ${b} = ${a * b}.`, `${a} × ${b} = ${a * b}.`);
  const explain: Visual[] | undefined = ones && hi ? [{ kind: 'area', n: other, parts: [hi, ones] }] : undefined;
  return { ask: bi('Multiply.', 'Multiplica.'), expr: `${a} × ${b} = ?`, answer: String(a * b), why, explain };
}

function mulTwoDigits(r: Rng): Question {
  if (r() < 0.3) return digitsTimes(int(r, 101, 499), int(r, 2, 9));
  const a = int(r, 12, 49);
  const b = int(r, 11, 29);
  return digitsTimes(a, b);
}

function decTimesWhole(r: Rng): Question {
  const t = int(r, 2, 59); // tenths
  const b = int(r, 2, 9);
  const prod = t * b;
  return {
    ask: bi('Multiply the decimal.', 'Multiplica el decimal.'),
    expr: `${(t / 10).toFixed(1)} × ${b} = ?`,
    answer: num(prod / 10),
    why: bi(
      `Ignore the point: ${t} × ${b} = ${prod}. ${(t / 10).toFixed(1)} has one decimal place, so the answer is ${num(prod / 10)}.`,
      `Ignora el punto: ${t} × ${b} = ${prod}. ${(t / 10).toFixed(1)} tiene un decimal, así que la respuesta es ${num(prod / 10)}.`,
    ),
  };
}

function signedMul(r: Rng): Question {
  let a = 0;
  let b = 0;
  do {
    a = nz(r, -9, 9);
    b = nz(r, -9, 9);
  } while (a > 0 && b > 0);
  const ans = a * b;
  return {
    ask: bi('Watch the signs.', 'Cuidado con los signos.'),
    expr: fmt(`${paren(a)} × ${paren(b)} = ?`),
    answer: String(ans),
    why: bi(
      `${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(ans)}. Same signs → positive, different signs → negative. So ${fmt(ans)}.`,
      `${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(ans)}. Signos iguales → positivo, signos distintos → negativo. Entonces ${fmt(ans)}.`,
    ),
  };
}

// ---------- divide ----------

function share(r: Rng, divisors: number[]): Question {
  const d = pick(r, divisors);
  const q = int(r, 1, 10);
  const total = d * q;
  return {
    ask: bi('Share equally.', 'Reparte en partes iguales.'),
    expr: `${total} ÷ ${d} = ?`,
    answer: String(q),
    visual: total <= 50 ? { kind: 'groups', total, groups: d } : undefined,
    explain: [{ kind: 'hops', step: d, count: q }],
    why: bi(
      `${total} shared into ${d} equal groups is ${q} each. Check: ${d} × ${q} = ${total}.`,
      `${total} repartido en ${d} grupos iguales son ${q} en cada uno. Comprueba: ${d} × ${q} = ${total}.`,
    ),
  };
}

function plainDiv(r: Rng, dLo: number, dHi: number, qLo: number, qHi: number, maxTotal = 999): Question {
  let d = 0;
  let q = 0;
  do {
    d = int(r, dLo, dHi);
    q = int(r, qLo, qHi);
  } while (d * q > maxTotal);
  const total = d * q;
  return {
    ask: bi('Divide.', 'Divide.'),
    expr: `${total} ÷ ${d} = ?`,
    answer: String(q),
    visual: total <= 50 && d <= 10 ? { kind: 'groups', total, groups: d } : undefined,
    explain: q <= 12 ? [{ kind: 'hops', step: d, count: q }] : undefined,
    why: bi(
      `${total} ÷ ${d} = ${q}, because ${d} × ${q} = ${total}. Division is multiplication backwards.`,
      `${total} ÷ ${d} = ${q}, porque ${d} × ${q} = ${total}. La división es una multiplicación al revés.`,
    ),
  };
}

function withRemainder(r: Rng): Question {
  const d = int(r, 3, 9);
  const q = int(r, 3, 15);
  const rem = int(r, 1, d - 1);
  const total = d * q + rem;
  const askRem = r() < 0.5;
  return {
    ask: askRem
      ? bi(`What is the remainder (what is left over)?`, `¿Cuál es el residuo (lo que sobra)?`)
      : bi(`How many whole groups of ${d} fit?`, `¿Cuántos grupos completos de ${d} caben?`),
    expr: `${total} ÷ ${d}`,
    answer: String(askRem ? rem : q),
    why: bi(
      `${d} × ${q} = ${d * q}, and ${total} − ${d * q} = ${rem} is left over. So ${total} ÷ ${d} = ${q} remainder ${rem}.`,
      `${d} × ${q} = ${d * q}, y ${total} − ${d * q} = ${rem} es lo que sobra. Entonces ${total} ÷ ${d} = ${q} residuo ${rem}.`,
    ),
  };
}

function decDivWhole(r: Rng): Question {
  const d = int(r, 2, 9);
  const qt = int(r, 2, 60); // quotient in tenths
  const total = d * qt;
  return {
    ask: bi('Divide the decimal.', 'Divide el decimal.'),
    expr: `${(total / 10).toFixed(1)} ÷ ${d} = ?`,
    answer: num(qt / 10),
    why: bi(
      `Ignore the point: ${total} ÷ ${d} = ${qt}. Put the point back (one decimal place): ${num(qt / 10)}.`,
      `Ignora el punto: ${total} ÷ ${d} = ${qt}. Vuelve a poner el punto (un decimal): ${num(qt / 10)}.`,
    ),
  };
}

// ---------- fractions, percent, ratio ----------

function namePie(r: Rng): Question {
  const den = pick(r, [2, 3, 4, 5, 6, 8]);
  const n = int(r, 1, den - 1);
  const answer = `${n}/${den}`;
  return {
    ask: bi('🍕 What fraction of the pizza has toppings?', '🍕 ¿Qué fracción de la pizza tiene ingredientes?'),
    answer,
    visual: { kind: 'pie', num: n, den },
    choices: fracChoices(r, answer, [[den, n], [n + 1, den], [n, den + 1], [den - n, den + 1]]),
    why: bi(
      `The pizza has ${den} equal slices and ${n} have toppings: ${n}/${den}. The bottom number counts all the slices.`,
      `La pizza tiene ${den} rebanadas iguales y ${n} tienen ingredientes: ${n}/${den}. El número de abajo cuenta todas las rebanadas.`,
    ),
  };
}

function fractionOf(r: Rng): Question {
  const den = pick(r, [2, 3, 4, 5, 10]);
  const n = r() < 0.6 ? 1 : int(r, 1, den - 1);
  const k = int(r, 1, 12);
  const total = den * k;
  return {
    ask: bi(`Find ${n}/${den} of ${total}.`, `Encuentra ${n}/${den} de ${total}.`),
    tex: `\\frac{${n}}{${den}} \\text{ of } ${total} = ?`,
    texEs: `\\frac{${n}}{${den}} \\text{ de } ${total} = ?`,
    answer: String(n * k),
    visual: total <= 40 ? { kind: 'groups', total, groups: den } : undefined,
    why: bi(
      `Split ${total} into ${den} equal parts: ${k} each. Take ${n} of them: ${n} × ${k} = ${n * k}.`,
      `Divide ${total} en ${den} partes iguales: ${k} cada una. Toma ${n}: ${n} × ${k} = ${n * k}.`,
    ),
  };
}

function equivalent(r: Rng): Question {
  const den = pick(r, [2, 3, 4, 5]);
  const n = int(r, 1, den - 1);
  const m = int(r, 2, 6);
  return {
    ask: bi('Find the missing top number.', 'Encuentra el numerador que falta.'),
    tex: `\\frac{${n}}{${den}} = \\frac{?}{${den * m}}`,
    answer: String(n * m),
    why: bi(
      `The bottom was multiplied by ${m} (${den} × ${m} = ${den * m}), so multiply the top too: ${n} × ${m} = ${n * m}.`,
      `El denominador se multiplicó por ${m} (${den} × ${m} = ${den * m}), así que multiplica también el numerador: ${n} × ${m} = ${n * m}.`,
    ),
  };
}

function sameDen(r: Rng): Question {
  const den = int(r, 4, 12);
  const add = r() < 0.5;
  let a = 0;
  let b = 0;
  do {
    a = int(r, 1, den - 2);
    b = int(r, 1, den - 2);
  } while (add ? a + b >= den : a <= b);
  const n = add ? a + b : a - b;
  const answer = frac(n, den);
  return {
    ask: add ? bi('Add the fractions.', 'Suma las fracciones.') : bi('Subtract the fractions.', 'Resta las fracciones.'),
    tex: `\\frac{${a}}{${den}} ${add ? '+' : '-'} \\frac{${b}}{${den}} = ?`,
    answer,
    choices: fracChoices(r, answer, [[add ? a + b : a - b, den * 2], [a * b, den], [n, den + 1], [n + 1, den]]),
    why: bi(
      `Same bottom number: just ${add ? 'add' : 'subtract'} the tops. ${a} ${add ? '+' : '−'} ${b} = ${n}, so ${n}/${den}${answer === `${n}/${den}` ? '' : ` = ${answer}`}.`,
      `Mismo denominador: solo ${add ? 'suma' : 'resta'} los numeradores. ${a} ${add ? '+' : '−'} ${b} = ${n}, así que ${n}/${den}${answer === `${n}/${den}` ? '' : ` = ${answer}`}.`,
    ),
  };
}

function unlikeDen(r: Rng): Question {
  let d1 = 0;
  let d2 = 0;
  do {
    d1 = pick(r, [2, 3, 4, 5, 6]);
    d2 = pick(r, [2, 3, 4, 5, 6]);
  } while (d1 === d2);
  const n1 = int(r, 1, d1 - 1);
  const n2 = int(r, 1, d2 - 1);
  const l = lcm(d1, d2);
  const t1 = n1 * (l / d1);
  const t2 = n2 * (l / d2);
  const add = r() < 0.6 || t1 <= t2;
  const top = add ? t1 + t2 : t1 - t2;
  const answer = frac(top, l);
  return {
    ask: add ? bi('Add. Find a common bottom number first.', 'Suma. Primero busca un denominador común.') : bi('Subtract. Find a common bottom number first.', 'Resta. Primero busca un denominador común.'),
    tex: `\\frac{${n1}}{${d1}} ${add ? '+' : '-'} \\frac{${n2}}{${d2}} = ?`,
    answer,
    choices: fracChoices(r, answer, [[add ? n1 + n2 : Math.abs(n1 - n2), d1 + d2], [add ? n1 + n2 : n1 + n2 + 1, d1 * d2], [n1 + n2, Math.max(d1, d2)], [top + 1, l]]),
    why: bi(
      `Common bottom number: ${l}. ${n1}/${d1} = ${t1}/${l} and ${n2}/${d2} = ${t2}/${l}. ${t1} ${add ? '+' : '−'} ${t2} = ${top}, so ${top}/${l}${answer === `${top}/${l}` ? '' : ` = ${answer}`}.`,
      `Denominador común: ${l}. ${n1}/${d1} = ${t1}/${l} y ${n2}/${d2} = ${t2}/${l}. ${t1} ${add ? '+' : '−'} ${t2} = ${top}, así que ${top}/${l}${answer === `${top}/${l}` ? '' : ` = ${answer}`}.`,
    ),
  };
}

function mulFrac(r: Rng): Question {
  const d1 = int(r, 2, 6);
  const d2 = int(r, 2, 6);
  const n1 = int(r, 1, d1 - 1);
  const n2 = int(r, 1, d2 - 1);
  const answer = frac(n1 * n2, d1 * d2);
  return {
    ask: bi('Multiply the fractions.', 'Multiplica las fracciones.'),
    tex: `\\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}} = ?`,
    answer,
    choices: fracChoices(r, answer, [[n1 + n2, d1 + d2], [n1 * n2, d1 + d2], [n1 * d2, d1 * n2], [n1 * n2 + 1, d1 * d2]]),
    why: bi(
      `Multiply the tops and the bottoms: ${n1 * n2}/${d1 * d2}${answer === `${n1 * n2}/${d1 * d2}` ? '' : `, then simplify to ${answer}`}.`,
      `Multiplica numeradores y denominadores: ${n1 * n2}/${d1 * d2}${answer === `${n1 * n2}/${d1 * d2}` ? '' : `, y simplifica a ${answer}`}.`,
    ),
  };
}

function percentOf(r: Rng): Question {
  const p = pick(r, [10, 20, 25, 50, 75]);
  const unit = 100 / gcd(p, 100);
  const total = unit * int(r, 1, Math.floor(100 / unit) * 2);
  const ans = (p * total) / 100;
  const hint: Bi =
    p === 10 ? bi('10% is one tenth: divide by 10.', '10% es un décimo: divide entre 10.')
    : p === 50 ? bi('50% is one half: divide by 2.', '50% es la mitad: divide entre 2.')
    : p === 25 ? bi('25% is one quarter: divide by 4.', '25% es un cuarto: divide entre 4.')
    : p === 20 ? bi('20% is one fifth: divide by 5.', '20% es un quinto: divide entre 5.')
    : bi('75% is three quarters: divide by 4, then multiply by 3.', '75% son tres cuartos: divide entre 4 y multiplica por 3.');
  return {
    ask: bi(`What is ${p}% of ${total}?`, `¿Cuánto es el ${p}% de ${total}?`),
    expr: `${p}% × ${total} = ?`,
    answer: String(ans),
    why: { en: `${hint.en} ${p}% of ${total} = ${ans}.`, es: `${hint.es} El ${p}% de ${total} = ${ans}.` },
  };
}

function ratio(r: Rng): Question {
  const item = pick(r, [
    bi('pencils', 'lápices'),
    bi('stickers', 'estampas'),
    bi('candies', 'dulces'),
  ]);
  const unit = int(r, 2, 9);
  const a = int(r, 2, 6);
  let b = a;
  while (b === a) b = int(r, 2, 12);
  return {
    ask: bi(
      `${a} ${item.en} cost $${a * unit}. How much do ${b} ${item.en} cost?`,
      `${a} ${item.es} cuestan $${a * unit}. ¿Cuánto cuestan ${b} ${item.es}?`,
    ),
    expr: `${a} → $${a * unit}     ${b} → $?`,
    answer: String(b * unit),
    why: bi(
      `One costs $${a * unit} ÷ ${a} = $${unit}. So ${b} cost ${b} × $${unit} = $${b * unit}.`,
      `Uno cuesta $${a * unit} ÷ ${a} = $${unit}. Entonces ${b} cuestan ${b} × $${unit} = $${b * unit}.`,
    ),
  };
}

// ---------- algebra ----------

function missing(r: Rng): Question {
  const kind = int(r, 0, 3);
  if (kind === 0) {
    const a = int(r, 2, 30);
    const x = int(r, 1, 30);
    return { ask: bi('Find the missing number.', 'Encuentra el número que falta.'), expr: `? + ${a} = ${a + x}`, answer: String(x), why: bi(`${a + x} − ${a} = ${x}. Subtraction undoes addition.`, `${a + x} − ${a} = ${x}. La resta deshace la suma.`) };
  }
  if (kind === 1) {
    const a = int(r, 2, 30);
    const x = int(r, 1, 30);
    return { ask: bi('Find the missing number.', 'Encuentra el número que falta.'), expr: `${a + x} − ? = ${a}`, answer: String(x), why: bi(`${a + x} − ${a} = ${x}, so ${a + x} − ${x} = ${a}.`, `${a + x} − ${a} = ${x}, así que ${a + x} − ${x} = ${a}.`) };
  }
  if (kind === 2) {
    const a = int(r, 2, 9);
    const x = int(r, 2, 9);
    return { ask: bi('Find the missing number.', 'Encuentra el número que falta.'), expr: `${a} × ? = ${a * x}`, answer: String(x), why: bi(`${a * x} ÷ ${a} = ${x}. Division undoes multiplication.`, `${a * x} ÷ ${a} = ${x}. La división deshace la multiplicación.`) };
  }
  const a = int(r, 2, 9);
  const x = int(r, 2, 9);
  return { ask: bi('Find the missing number.', 'Encuentra el número que falta.'), expr: `? ÷ ${a} = ${x}`, answer: String(a * x), why: bi(`${x} × ${a} = ${a * x}. Multiplication undoes division.`, `${x} × ${a} = ${a * x}. La multiplicación deshace la división.`) };
}

function oneStepAdd(r: Rng): Question {
  const a = int(r, 2, 20);
  const x = int(r, 1, 30);
  const add = r() < 0.5;
  const eq = add ? `x + ${a} = ${x + a}` : `x - ${a} = ${x - a}`;
  return {
    ask: bi('Find x.', 'Encuentra x.'),
    expr: fmt(eq),
    eq,
    answer: String(x),
    why: add
      ? bi(`Do the opposite to both sides: subtract ${a}. x = ${x + a} − ${a} = ${x}.`, `Haz lo contrario en ambos lados: resta ${a}. x = ${x + a} − ${a} = ${x}.`)
      : bi(`Do the opposite to both sides: add ${a}. x = ${x - a} + ${a} = ${x}.`, `Haz lo contrario en ambos lados: suma ${a}. x = ${x - a} + ${a} = ${x}.`),
  };
}

function orderOfOps(r: Rng): Question {
  const pat = int(r, 0, 3);
  let expr = '';
  let v = 0;
  let why: Bi;
  if (pat === 0) {
    const [a, b, c] = [int(r, 1, 12), int(r, 2, 9), int(r, 2, 9)];
    expr = `${a} + ${b} × ${c}`;
    v = a + b * c;
    why = bi(`Multiply first: ${b} × ${c} = ${b * c}. Then add: ${a} + ${b * c} = ${v}.`, `Primero multiplica: ${b} × ${c} = ${b * c}. Luego suma: ${a} + ${b * c} = ${v}.`);
  } else if (pat === 1) {
    const [b, c] = [int(r, 2, 9), int(r, 2, 9)];
    const a = int(r, 1, b * c - 1);
    expr = `${b} × ${c} − ${a}`;
    v = b * c - a;
    why = bi(`Multiply first: ${b} × ${c} = ${b * c}. Then subtract: ${b * c} − ${a} = ${v}.`, `Primero multiplica: ${b} × ${c} = ${b * c}. Luego resta: ${b * c} − ${a} = ${v}.`);
  } else if (pat === 2) {
    const [a, b, c] = [int(r, 1, 9), int(r, 1, 9), int(r, 2, 9)];
    expr = `(${a} + ${b}) × ${c}`;
    v = (a + b) * c;
    why = bi(`Brackets first: ${a} + ${b} = ${a + b}. Then multiply: ${a + b} × ${c} = ${v}.`, `Primero los paréntesis: ${a} + ${b} = ${a + b}. Luego multiplica: ${a + b} × ${c} = ${v}.`);
  } else {
    const c = int(r, 2, 9);
    const k = int(r, 2, 9);
    const a = int(r, 1, 12);
    expr = `${a} + ${c * k} ÷ ${c}`;
    v = a + k;
    why = bi(`Divide first: ${c * k} ÷ ${c} = ${k}. Then add: ${a} + ${k} = ${v}.`, `Primero divide: ${c * k} ÷ ${c} = ${k}. Luego suma: ${a} + ${k} = ${v}.`);
  }
  return { ask: bi('Follow the order of operations.', 'Sigue el orden de las operaciones.'), expr: `${expr} = ?`, answer: String(v), why };
}

function oneStepMul(r: Rng): Question {
  const x = int(r, 2, 12);
  if (r() < 0.6) {
    const a = int(r, 2, 9);
    const eq = `${a}x = ${a * x}`;
    return { ask: bi('Find x.', 'Encuentra x.'), expr: eq, eq, answer: String(x), why: bi(`${a}x means ${a} × x. Divide both sides by ${a}: x = ${a * x} ÷ ${a} = ${x}.`, `${a}x significa ${a} × x. Divide ambos lados entre ${a}: x = ${a * x} ÷ ${a} = ${x}.`) };
  }
  const a = int(r, 2, 9);
  const eq = `x/${a} = ${x}`;
  return { ask: bi('Find x.', 'Encuentra x.'), expr: `x ÷ ${a} = ${x}`, eq, answer: String(a * x), why: bi(`Multiply both sides by ${a}: x = ${x} × ${a} = ${a * x}.`, `Multiplica ambos lados por ${a}: x = ${x} × ${a} = ${a * x}.`) };
}

function evaluate(r: Rng): Question {
  const x = int(r, 1, 9);
  const form = int(r, 0, 2);
  const a = int(r, 2, 6);
  const b = int(r, 1, 9);
  let expr: string;
  let v: number;
  let sub: string;
  if (form === 0) {
    expr = `${a}x + ${b}`;
    v = a * x + b;
    sub = `${a} × ${x} + ${b} = ${a * x} + ${b} = ${v}`;
  } else if (form === 1) {
    const c = Math.min(b, a * x - 1) || 1;
    expr = `${a}x − ${c}`;
    v = a * x - c;
    sub = `${a} × ${x} − ${c} = ${a * x} − ${c} = ${v}`;
  } else {
    expr = `${a}(x + ${b})`;
    v = a * (x + b);
    sub = `${a} × (${x} + ${b}) = ${a} × ${x + b} = ${v}`;
  }
  return {
    ask: bi(`If x = ${x}, what is the value of the expression?`, `Si x = ${x}, ¿cuánto vale la expresión?`),
    expr,
    answer: String(v),
    why: bi(`Replace x with ${x}: ${sub}.`, `Cambia x por ${x}: ${sub}.`),
  };
}

const coef = (a: number) => (a === 1 ? '' : a === -1 ? '-' : String(a));
const lin = (a: number, b: number) => `${coef(a)}x ${b < 0 ? '-' : '+'} ${Math.abs(b)}`;

function twoStep(r: Rng): Question {
  const x = nz(r, -9, 9);
  const a = int(r, 2, 9);
  const b = nz(r, -12, 12);
  const c = a * x + b;
  const eq = `${lin(a, b)} = ${c}`;
  return {
    ask: bi('Find x. Undo the + or − first, then divide.', 'Encuentra x. Deshaz primero el + o − y luego divide.'),
    expr: fmt(eq),
    eq,
    answer: String(x),
    why: bi(
      `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides: ${a}x = ${c - b}. Divide by ${a}: x = ${x}.`,
      `${b > 0 ? 'Resta' : 'Suma'} ${Math.abs(b)} en ambos lados: ${a}x = ${c - b}. Divide entre ${a}: x = ${x}.`,
    ),
  };
}

function bothSides(r: Rng): Question {
  const x = nz(r, -8, 9);
  const a = int(r, 3, 8);
  let c = nz(r, -3, a - 1);
  if (c === a) c = a - 1;
  const b = nz(r, -9, 9);
  const d = a * x + b - c * x;
  const eq = `${lin(a, b)} = ${lin(c, d)}`;
  return {
    ask: bi('Get all the x terms on one side.', 'Junta todos los términos con x en un lado.'),
    expr: fmt(eq),
    eq,
    answer: String(x),
    why: bi(
      `Subtract ${c}x from both sides: ${a - c}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${d}. Then solve: x = ${x}.`,
      `Resta ${c}x en ambos lados: ${a - c}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${d}. Luego resuelve: x = ${x}.`,
    ),
  };
}

function brackets(r: Rng): Question {
  const x = nz(r, -6, 8);
  const a = int(r, 2, 6);
  const b = nz(r, -6, 6);
  const c = a * (x + b);
  const eq = `${a}(x ${b < 0 ? '-' : '+'} ${Math.abs(b)}) = ${c}`;
  return {
    ask: bi('Find x. Divide by the number outside the brackets first.', 'Encuentra x. Primero divide entre el número de afuera del paréntesis.'),
    expr: fmt(eq),
    eq,
    answer: String(x),
    why: bi(
      `Divide both sides by ${a}: x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${x + b}. Then x = ${x + b} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${x}.`,
      `Divide ambos lados entre ${a}: x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${x + b}. Entonces x = ${x + b} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${x}.`,
    ),
  };
}

// ---------- the map ----------

export const TRACKS: { id: TrackId; emoji: string; name: Bi; color: string }[] = [
  { id: 'add', emoji: '➕', name: bi('Add & Subtract', 'Sumas y restas'), color: '#22c55e' },
  { id: 'mul', emoji: '✖️', name: bi('Multiply', 'Multiplicar'), color: '#f97316' },
  { id: 'div', emoji: '➗', name: bi('Divide', 'Dividir'), color: '#a855f7' },
  { id: 'frac', emoji: '🍕', name: bi('Fractions & %', 'Fracciones y %'), color: '#ec4899' },
  { id: 'alg', emoji: '🔮', name: bi('Algebra', 'Álgebra'), color: '#38bdf8' },
];

const L = (id: string, track: TrackId, age: number, emoji: string, name: Bi, goal: Bi, input: InputKind, make: (r: Rng) => Question): Level => ({ id, track, age, emoji, name, goal, input, make });

export const LEVELS: Level[] = [
  L('add1', 'add', 8, '🌱', bi('Up to 100', 'Hasta 100'), bi('Add and subtract numbers up to 100.', 'Suma y resta números hasta 100.'), 'int', (r) => addSub(r, 10, 60)),
  L('add2', 'add', 8, '🏔️', bi('Up to 1,000', 'Hasta 1,000'), bi('Add and subtract with hundreds.', 'Suma y resta con centenas.'), 'int', (r) => addSub(r, 100, 600)),
  L('add3', 'add', 9, '🚀', bi('Big numbers', 'Números grandes'), bi('Add and subtract numbers up to 100,000.', 'Suma y resta números hasta 100,000.'), 'int', (r) => addSub(r, 1000, 50000)),
  L('add4', 'add', 10, '💧', bi('Decimals', 'Decimales'), bi('Add and subtract tenths and hundredths.', 'Suma y resta décimos y centésimos.'), 'dec', decAddSub),
  L('add5', 'add', 11, '🧊', bi('Below zero', 'Bajo cero'), bi('Add and subtract negative numbers.', 'Suma y resta números negativos.'), 'signed', (r) => signedAddSub(r, 9, false)),
  L('add6', 'add', 12, '🌋', bi('Integer master', 'Maestro de enteros'), bi('Double negatives and bigger numbers.', 'Doble negativo y números más grandes.'), 'signed', (r) => signedAddSub(r, 20, true)),

  L('mul1', 'mul', 8, '🖐️', bi('Tables 2, 5, 10', 'Tablas 2, 5, 10'), bi('Skip-count with rows of dots.', 'Cuenta de 2, 5 y 10 con filas de puntos.'), 'int', (r) => table(r, [2, 5, 10])),
  L('mul2', 'mul', 8, '🍀', bi('Tables 3 and 4', 'Tablas 3 y 4'), bi('Rows and columns.', 'Filas y columnas.'), 'int', (r) => table(r, [3, 4])),
  L('mul3', 'mul', 9, '⚡', bi('All the tables', 'Todas las tablas'), bi('Every table up to 10 × 10.', 'Todas las tablas hasta 10 × 10.'), 'int', (r) => table(r, [2, 3, 4, 5, 6, 7, 8, 9, 10])),
  L('mul4', 'mul', 9, '🧱', bi('Two digits × one', 'Dos cifras × una'), bi('Break the number into tens and ones.', 'Separa el número en decenas y unidades.'), 'int', (r) => digitsTimes(int(r, 11, 99), int(r, 2, 9))),
  L('mul5', 'mul', 10, '🏰', bi('Bigger products', 'Productos grandes'), bi('Two digits × two digits.', 'Dos cifras × dos cifras.'), 'int', mulTwoDigits),
  L('mul6', 'mul', 11, '🧪', bi('Decimal × whole', 'Decimal × entero'), bi('Multiply decimals by whole numbers.', 'Multiplica decimales por enteros.'), 'dec', decTimesWhole),
  L('mul7', 'mul', 12, '🌗', bi('Positive & negative', 'Positivos y negativos'), bi('Multiply with negative numbers.', 'Multiplica con números negativos.'), 'signed', signedMul),

  L('div1', 'div', 8, '🍪', bi('Fair shares', 'Repartos justos'), bi('Share into 2, 5 or 10 groups.', 'Reparte en 2, 5 o 10 grupos.'), 'int', (r) => share(r, [2, 5, 10])),
  L('div2', 'div', 8, '🔄', bi('Division facts', 'Tablas al revés'), bi('Division is multiplication backwards.', 'La división es una multiplicación al revés.'), 'int', (r) => plainDiv(r, 2, 10, 2, 10)),
  L('div3', 'div', 9, '🧩', bi('Bigger numbers', 'Números más grandes'), bi('Divide 2–3 digit numbers by one digit.', 'Divide números de 2–3 cifras entre una cifra.'), 'int', (r) => plainDiv(r, 2, 9, 11, 120)),
  L('div4', 'div', 9, '🍕', bi('Leftovers', 'Lo que sobra'), bi('Division with a remainder.', 'División con residuo.'), 'int', withRemainder),
  L('div5', 'div', 10, '🛰️', bi('Two-digit divisors', 'Divisores de dos cifras'), bi('Divide by numbers from 11 to 25.', 'Divide entre números del 11 al 25.'), 'int', (r) => plainDiv(r, 11, 25, 4, 39, 999)),
  L('div6', 'div', 11, '🧪', bi('Decimal ÷ whole', 'Decimal ÷ entero'), bi('Divide decimals by whole numbers.', 'Divide decimales entre enteros.'), 'dec', decDivWhole),

  L('frac1', 'frac', 8, '🥧', bi('Slices', 'Rebanadas'), bi('Name the fraction you see.', 'Nombra la fracción que ves.'), 'int', namePie),
  L('frac2', 'frac', 9, '🧁', bi('Fraction of a number', 'Fracción de un número'), bi('Find ¼ of 12, ⅗ of 20…', 'Encuentra ¼ de 12, ⅗ de 20…'), 'int', fractionOf),
  L('frac3', 'frac', 9, '🪞', bi('Equivalent fractions', 'Fracciones equivalentes'), bi('Different fractions, same amount.', 'Fracciones distintas, misma cantidad.'), 'int', equivalent),
  L('frac4', 'frac', 9, '🍫', bi('Same bottom', 'Mismo denominador'), bi('Add and subtract with equal denominators.', 'Suma y resta con igual denominador.'), 'int', sameDen),
  L('frac5', 'frac', 10, '🍰', bi('Different bottoms', 'Distinto denominador'), bi('Find a common denominator.', 'Busca un denominador común.'), 'int', unlikeDen),
  L('frac6', 'frac', 10, '✨', bi('Fraction × fraction', 'Fracción × fracción'), bi('Multiply tops and bottoms.', 'Multiplica arriba y abajo.'), 'int', mulFrac),
  L('frac7', 'frac', 11, '💯', bi('Percent', 'Porcentaje'), bi('Find 10%, 25%, 50%… of a number.', 'Encuentra 10%, 25%, 50%… de un número.'), 'int', percentOf),
  L('frac8', 'frac', 12, '⚖️', bi('Ratios', 'Razones'), bi('Scale a price or recipe up and down.', 'Escala un precio o una receta.'), 'int', ratio),

  L('alg1', 'alg', 8, '❓', bi('Missing number', 'Número escondido'), bi('Find the number hiding behind the ?.', 'Encuentra el número que se esconde tras el ?.'), 'int', missing),
  L('alg2', 'alg', 9, '🔎', bi('Meet x', 'Conoce a x'), bi('x + 7 = 12 — find the hidden x.', 'x + 7 = 12 — encuentra la x escondida.'), 'int', oneStepAdd),
  L('alg3', 'alg', 10, '🧮', bi('Order of operations', 'Orden de operaciones'), bi('What goes first? Brackets, × ÷, then + −.', '¿Qué va primero? Paréntesis, × ÷, luego + −.'), 'int', orderOfOps),
  L('alg4', 'alg', 11, '🔓', bi('Unlock x', 'Libera a x'), bi('Solve 3x = 12 and x ÷ 4 = 5.', 'Resuelve 3x = 12 y x ÷ 4 = 5.'), 'int', oneStepMul),
  L('alg5', 'alg', 11, '🧙', bi('Expressions', 'Expresiones'), bi('Replace x with a number.', 'Cambia x por un número.'), 'int', evaluate),
  L('alg6', 'alg', 12, '⚖️', bi('Two-step equations', 'Ecuaciones de dos pasos'), bi('Solve 3x + 4 = 19.', 'Resuelve 3x + 4 = 19.'), 'signed', twoStep),
  L('alg7', 'alg', 13, '🐉', bi('x on both sides', 'x en ambos lados'), bi('Solve 5x + 3 = 2x + 12.', 'Resuelve 5x + 3 = 2x + 12.'), 'signed', bothSides),
  L('alg8', 'alg', 13, '👑', bi('Brackets boss', 'Jefe de paréntesis'), bi('Solve 3(x + 2) = 15.', 'Resuelve 3(x + 2) = 15.'), 'signed', brackets),
];

export const levelsOf = (track: TrackId) => LEVELS.filter((l) => l.track === track);
export const levelById = (id: string) => LEVELS.find((l) => l.id === id);

export const AGES = [8, 9, 10, 11, 12, 13];

/** What is expected at each age (US grade = age − 5; Mexico: 3º primaria … 2º secundaria). */
export const AGE_INFO: Record<number, { grade: Bi; topics: Bi }> = {
  8: {
    grade: bi('Grade 3 · 3º primaria', '3º de primaria · Grade 3'),
    topics: bi(
      'Add and subtract to 1,000 · times tables 2–5 and 10 · sharing equally · simple fractions · missing numbers',
      'Sumar y restar hasta 1,000 · tablas del 2–5 y 10 · repartir en partes iguales · fracciones sencillas · números escondidos',
    ),
  },
  9: {
    grade: bi('Grade 4 · 4º primaria', '4º de primaria · Grade 4'),
    topics: bi(
      'All the times tables · 2-digit × 1-digit · long division with remainders · equivalent fractions · adding fractions · meet x',
      'Todas las tablas · 2 cifras × 1 · división con residuo · fracciones equivalentes · sumar fracciones · conoce a x',
    ),
  },
  10: {
    grade: bi('Grade 5 · 5º primaria', '5º de primaria · Grade 5'),
    topics: bi(
      'Decimals · 2-digit × 2-digit · dividing by 2 digits · fractions with different bottoms · multiplying fractions · order of operations',
      'Decimales · 2 cifras × 2 cifras · dividir entre 2 cifras · fracciones con distinto denominador · multiplicar fracciones · orden de operaciones',
    ),
  },
  11: {
    grade: bi('Grade 6 · 6º primaria', '6º de primaria · Grade 6'),
    topics: bi(
      'Negative numbers · decimal × and ÷ · percent · solving 3x = 12 and x + 5 = 9 · expressions with x',
      'Números negativos · multiplicar y dividir decimales · porcentaje · resolver 3x = 12 y x + 5 = 9 · expresiones con x',
    ),
  },
  12: {
    grade: bi('Grade 7 · 1º secundaria', '1º de secundaria · Grade 7'),
    topics: bi(
      'Operations with integers · ratios and proportions · two-step equations like 3x + 4 = 19',
      'Operaciones con enteros · razones y proporciones · ecuaciones de dos pasos como 3x + 4 = 19',
    ),
  },
  13: {
    grade: bi('Grade 8 · 2º secundaria', '2º de secundaria · Grade 8'),
    topics: bi(
      'Equations with x on both sides · brackets · lines and systems (open the 3D solver!)',
      'Ecuaciones con x en ambos lados · paréntesis · rectas y sistemas (¡abre el solucionador 3D!)',
    ),
  },
};

/** Index in a track where this age should start; earlier levels stay open for review. */
export function startIndex(track: TrackId, age: number): number {
  const ls = levelsOf(track);
  const i = ls.findIndex((l) => l.age >= age);
  return i < 0 ? ls.length - 1 : i;
}

// ---------- rounds ----------

export const ROUND_LENGTH = 10;
export const HEARTS = 5;

export const questionKey = (q: Question) => `${q.expr ?? q.tex ?? ''}|${q.ask.en}|${q.answer}|${JSON.stringify(q.visual ?? '')}`;

/** Ten different questions for one round. */
export function makeRound(level: Level, r: Rng = Math.random, n = ROUND_LENGTH): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard++ < 400) {
    const q = level.make(r);
    if (seen.has(questionKey(q))) continue;
    seen.add(questionKey(q));
    out.push(q);
  }
  while (out.length < n) out.push(level.make(r));
  return out;
}

/** Is the typed (or tapped) answer right? Numbers are compared as numbers. */
export function isCorrect(q: Question, given: string): boolean {
  if (q.choices) return given === q.answer;
  const norm = (s: string) => s.trim().replace(/[−–]/g, '-').replace(',', '.');
  const g = norm(given);
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(g)) return false;
  return Math.abs(parseFloat(g) - parseFloat(q.answer)) < 1e-9;
}

/** Stars from mistakes: 0–1 → 3, 2–3 → 2, 4 → 1, all hearts lost → 0. */
export function starsFor(mistakes: number): number {
  if (mistakes >= HEARTS) return 0;
  if (mistakes <= 1) return 3;
  if (mistakes <= 3) return 2;
  return 1;
}
