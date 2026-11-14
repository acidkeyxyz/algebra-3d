// Text alternatives for screen-reader users: spoken math and a plain-words description of each 3D scene.

import type { Lang } from './i18n';
import type { Scene, TileGroup } from './scene';

const W = {
  en: {
    plus: 'plus', minus: 'minus', times: 'times', div: 'divided by', eq: 'equals', over: 'over', plusMinus: 'plus or minus',
    sqrt: 'square root of', cbrt: 'cube root of', nroot: (n: string) => `root ${n} of`, sq: 'squared', cu: 'cubed',
    pow: (n: string) => `to the power ${n}`, sub: 'sub', open: 'open parenthesis', close: 'close parenthesis',
    le: 'is less than or equal to', ge: 'is greater than or equal to', lt: 'is less than', gt: 'is greater than', ne: 'is not equal to',
    approx: 'is approximately', implies: 'so', iff: 'if and only if', in: 'in', cap: 'intersect', empty: 'the empty set', ok: 'check',
    delta: 'delta', pi: 'pi', inf: 'infinity', abs: 'absolute value of',
    fn: { sin: 'sine', cos: 'cosine', tan: 'tangent', log: 'log', ln: 'natural log' } as Record<string, string>,
  },
  es: {
    plus: 'más', minus: 'menos', times: 'por', div: 'entre', eq: 'es igual a', over: 'sobre', plusMinus: 'más o menos',
    sqrt: 'raíz cuadrada de', cbrt: 'raíz cúbica de', nroot: (n: string) => `raíz ${n} de`, sq: 'al cuadrado', cu: 'al cubo',
    pow: (n: string) => `elevado a ${n}`, sub: 'sub', open: 'abre paréntesis', close: 'cierra paréntesis',
    le: 'es menor o igual que', ge: 'es mayor o igual que', lt: 'es menor que', gt: 'es mayor que', ne: 'es distinto de',
    approx: 'es aproximadamente', implies: 'entonces', iff: 'si y solo si', in: 'en', cap: 'intersección', empty: 'el conjunto vacío', ok: 'correcto',
    delta: 'delta', pi: 'pi', inf: 'infinito', abs: 'valor absoluto de',
    fn: { sin: 'seno', cos: 'coseno', tan: 'tangente', log: 'logaritmo', ln: 'logaritmo natural' } as Record<string, string>,
  },
};

/** Index just past the `{...}` group that starts at `i` (or one token if there are no braces). */
function group(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] !== '{') return [s[i] ?? '', i + 1];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return [s.slice(i + 1), s.length];
}

/** Turns the LaTeX this app produces into a sentence a screen reader can speak clearly. */
export function speakMath(tex: string, lang: Lang): string {
  const w = W[lang];
  const walk = (s: string): string => {
    let out = '';
    for (let i = 0; i < s.length; ) {
      const c = s[i];
      if (c === '\\') {
        const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
        const name = m ? m[1] : '';
        i += 1 + name.length;
        switch (name) {
          case 'frac': case 'dfrac': case 'tfrac': {
            const [a, j] = group(s, i);
            const [b, k] = group(s, j);
            i = k;
            out += ` ${walk(a)} ${w.over} ${walk(b)} `;
            break;
          }
          case 'sqrt': {
            let n = '';
            if (s[i] === '[') {
              const e = s.indexOf(']', i);
              n = s.slice(i + 1, e);
              i = e + 1;
            }
            const [a, j] = group(s, i);
            i = j;
            out += ` ${n === '3' ? w.cbrt : n ? w.nroot(n) : w.sqrt} ${walk(a)} `;
            break;
          }
          case 'text': case 'mathrm': case 'textbf': case 'operatorname': {
            const [a, j] = group(s, i);
            i = j;
            out += ` ${a} `;
            break;
          }
          case 'color': {
            const [, j] = group(s, i);
            const [a, k] = group(s, j);
            i = k;
            out += ` ${walk(a)} `;
            break;
          }
          case 'underbrace': case 'overbrace': {
            const [a, j] = group(s, i);
            i = j;
            if (s[i] === '_' || s[i] === '^') i = group(s, i + 1)[1];
            out += ` ${walk(a)} `;
            break;
          }
          case 'begin': case 'end': i = group(s, i)[1]; break;
          case 'left': case 'right': case 'big': case 'Big': case 'bigl': case 'bigr': case 'hline': case 'displaystyle': break;
          case 'cdot': case 'times': out += ` ${w.times} `; break;
          case 'div': out += ` ${w.div} `; break;
          case 'pm': out += ` ${w.plusMinus} `; break;
          case 'le': case 'leq': out += ` ${w.le} `; break;
          case 'ge': case 'geq': out += ` ${w.ge} `; break;
          case 'ne': case 'neq': out += ` ${w.ne} `; break;
          case 'approx': out += ` ${w.approx} `; break;
          case 'Rightarrow': case 'Longrightarrow': case 'implies': case 'to': out += ` ${w.implies} `; break;
          case 'iff': out += ` ${w.iff} `; break;
          case 'in': out += ` ${w.in} `; break;
          case 'cap': out += ` ${w.cap} `; break;
          case 'varnothing': case 'emptyset': out += ` ${w.empty} `; break;
          case 'checkmark': out += ` ${w.ok} `; break;
          case 'Delta': out += ` ${w.delta} `; break;
          case 'pi': out += ` ${w.pi} `; break;
          case 'infty': out += ` ${w.inf} `; break;
          case 'sin': case 'cos': case 'tan': case 'log': case 'ln': out += ` ${w.fn[name]} `; break;
          case 'quad': case 'qquad': case ',': case ';': case ':': case '!': case ' ': case '\\': out += ', '; break;
          default: break; // unknown command: say nothing rather than its name
        }
        continue;
      }
      if (c === '^' || c === '_') {
        const [a, j] = group(s, i + 1);
        i = j;
        const inner = walk(a).trim();
        if (c === '_') out += ` ${w.sub} ${inner} `;
        else if (inner === '2') out += ` ${w.sq} `;
        else if (inner === '3') out += ` ${w.cu} `;
        else out += ` ${w.pow(inner)} `;
        continue;
      }
      i++;
      if (c === '{' || c === '}' || c === '&' || c === '$') out += c === '&' ? ', ' : ' ';
      else if (c === '+') out += ` ${w.plus} `;
      else if (c === '-' || c === '−') out += ` ${w.minus} `;
      else if (c === '=') out += ` ${w.eq} `;
      else if (c === '<') out += ` ${w.lt} `;
      else if (c === '>') out += ` ${w.gt} `;
      else if (c === '(') out += ` ${w.open} `;
      else if (c === ')') out += ` ${w.close} `;
      else if (c === '|') out += ` ${w.abs} `;
      else if (c === '/') out += ` ${w.over} `;
      else if (c === '*') out += ` ${w.times} `;
      else if (c === '±') out += ` ${w.plusMinus} `;
      else if (c === '²') out += ` ${w.sq} `;
      else if (c === '³') out += ` ${w.cu} `;
      else if (c === '≤') out += ` ${w.le} `;
      else if (c === '≥') out += ` ${w.ge} `;
      else if (c === '≈') out += ` ${w.approx} `;
      else if (c === '×' || c === '·') out += ` ${w.times} `;
      else if (c === '÷') out += ` ${w.div} `;
      else out += c;
    }
    return out;
  };
  return walk(tex).replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
}

/** Spoken name of one kind of block ("x squared", "unit"…). `term` is "i,j": the powers of x and y. */
function termWords(term: string, n: number, lang: Lang): string {
  const w = W[lang];
  const [i, j] = term.split(',').map(Number);
  const pw = (v: string, p: number) => (p === 1 ? v : p === 2 ? `${v} ${w.sq}` : p === 3 ? `${v} ${w.cu}` : `${v} ${w.pow(String(p))}`);
  if (!i && !j) return lang === 'es' ? (n === 1 ? 'unidad' : 'unidades') : n === 1 ? 'unit' : 'units';
  const parts = [i ? pw('x', i) : '', j ? pw('y', j) : ''].filter(Boolean);
  return parts.join(' ');
}

function sideWords(groups: TileGroup[], lang: Lang): string {
  const w = W[lang];
  if (!groups.length) return lang === 'es' ? 'vacío' : 'empty';
  return groups
    .map((g) => {
      const v = g.count.value();
      const n = Math.abs(v);
      const num = g.count.isInt() ? String(n) : speakMath(g.count.abs().toLatex(), lang);
      const neg = v < 0 ? (lang === 'es' ? 'negativas' : 'negative') : '';
      const name = termWords(g.term, n, lang);
      const sign = v < 0 ? ` ${w.minus}` : '';
      const kind = g.term === '0,0' ? '' : lang === 'es' ? (n === 1 ? 'bloque de ' : 'bloques de ') : n === 1 ? 'block of ' : 'blocks of ';
      return `${sign ? sign.trim() + ' ' : ''}${num} ${neg ? neg + ' ' : ''}${kind}${name}`.replace(/\s+/g, ' ').trim();
    })
    .join(', ');
}

/** A plain-words description of what the 3D scene is showing, for people who cannot see it. */
export function describeScene(scene: Scene | undefined, lang: Lang): string {
  const es = lang === 'es';
  if (!scene) return es ? 'Escena 3D vacía.' : 'Empty 3D scene.';
  switch (scene.type) {
    case 'balance': {
      const l = sideWords(scene.left.groups, lang);
      const r = sideWords(scene.right.groups, lang);
      const op = scene.op ? (es ? ` Se aplica ${speakMath(scene.op, lang)} a los dos lados.` : ` ${speakMath(scene.op, lang)} is applied to both sides.`) : '';
      const g = scene.groups ? (es ? ` Cada lado se reparte en ${scene.groups} grupos iguales.` : ` Each side is split into ${scene.groups} equal groups.`) : '';
      return es
        ? `Balanza con bloques. Lado izquierdo: ${l}. Lado derecho: ${r}.${op}${g}`
        : `Balance scale with blocks. Left side: ${l}. Right side: ${r}.${op}${g}`;
    }
    case 'box': {
      const dims = scene.dims.map((d) => speakMath(d, lang)).join(es ? ', por ' : ', times ');
      return es ? `Caja 3D hecha con bloques. Sus tres lados miden: ${dims}.` : `A 3D box built from blocks. Its three edges measure: ${dims}.`;
    }
    case 'graph': {
      const f = scene.frame;
      const names = [...scene.curves.map((c) => c.label), ...(scene.implicit ?? []).map((c) => c.label)].filter(Boolean).map((x) => speakMath(x!, lang));
      const pts = scene.points.filter((p) => p.label || p.big);
      const ptText = pts
        .slice(0, 6)
        .map((p) => `${p.label ? speakMath(p.label, lang) + ' ' : ''}(${+p.x.toFixed(2)}, ${+p.y.toFixed(2)})`)
        .join('; ');
      const head = es
        ? `Gráfica con x de ${f.xmin} a ${f.xmax} y y de ${f.ymin} a ${f.ymax}.`
        : `Graph with x from ${f.xmin} to ${f.xmax} and y from ${f.ymin} to ${f.ymax}.`;
      const cv = names.length ? (es ? ` Curvas: ${names.join(', ')}.` : ` Curves: ${names.join(', ')}.`) : '';
      const pp = ptText ? (es ? ` Puntos marcados: ${ptText}.` : ` Marked points: ${ptText}.`) : '';
      return head + cv + pp;
    }
    case 'surface': {
      const pts = scene.points
        .slice(0, 6)
        .map((p) => `(${+p.x.toFixed(2)}, ${+p.y.toFixed(2)}, ${+p.z.toFixed(2)})`)
        .join('; ');
      const sl = scene.slices.length ? (es ? ' Se muestran cortes de la superficie.' : ' Slices of the surface are shown.') : '';
      const sf = scene.showSurface ? (es ? 'Superficie 3D sobre el piso.' : '3D surface rising from the floor.') : es ? 'Ejes 3D.' : '3D axes.';
      const pp = pts ? (es ? ` Puntos: ${pts}.` : ` Points: ${pts}.`) : '';
      return sf + sl + pp;
    }
  }
}
