import { describe, expect, it } from 'vitest';
import { solve } from '../src/lib/solver';
import { buildView } from '../src/lib/view';

const cases: [string, string | RegExp][] = [
  ['y = x + 2', 'm = 1,\\ b = 2'],
  ['x^3+3x^2=0', 'x = -3,\\ 0'],
  ['2x + 3 = 7', 'x = 2'],
  ['3x - 4 = x + 6', 'x = 5'],
  ['x + 5 = 3x - 1', 'x = 3'],
  ['2(x - 1) = x + 4', 'x = 6'],
  ['x/2 + 1 = 4', 'x = 6'],
  ['x^2 + 5x + 6 = 0', 'x = -3,\\ -2'],
  ['x^2 - 5x + 6 = 0', 'x = 2,\\ 3'],
  ['x^2 = 9', /\\pm 3/],
  ['x^2 = -4', /no real/],
  ['x^2 + x - 1 = 0', /sqrt\{5\}/],
  ['x^3 - 6x^2 + 11x - 6 = 0', 'x = 1,\\ 2,\\ 3'],
  ['x^3 + 5x^2 + 6x = 0', 'x = -3,\\ -2,\\ 0'],
  ['2x^2 + 4x = 0', 'x = -2,\\ 0'],
  ['y = x^2 - 4x + 3', /vertex/],
  ['y = x^3 - x', /x\^\{3\}/],
  ['2x + 3y = 6', /y = /],
  ['x^2 + y^2 = 25', /r = 5/],
  ['z = x^2 - y^2', /z/],
  ['y = sin(x)', /sin/],
  ['sqrt(x) = 3 - x', /x \\approx/],
  ['x + 1 = x + 1', /all/],
  ['x + 1 = x + 2', /no solution/],
  ['x^2 + 1 = 0', /no real/],
  ['x^2 - 4x', /vertex/],
  ['3 = x', 'x = 3'],
  ['-x = 4', 'x = -4'],
  ['x^3 = 8', 'x = 2'],
  ['x^3 - 2 = 0', /approx/],
  ['x^4 - 5x^2 + 4 = 0', 'x = -2,\\ -1,\\ 1,\\ 2'],
  ['x^2 + 2x + 1 = 0', 'x = -1'],
  ['y = 2', /y = 2/],
  ['2y = 4x - 6', /y = 2x - 3/],
  ['(x+1)(x+2) = 0', 'x = -2,\\ -1'],
  ['x^3 + x + 1 = 0', /x \\approx -0.682/],
];

describe('solve', () => {
  for (const [input, answer] of cases) {
    it(input, () => {
      const s = solve(input, 'en');
      expect(s.steps.length).toBeGreaterThan(0);
      if (typeof answer === 'string') expect(s.answer).toBe(answer);
      else expect(s.answer).toMatch(answer);
      for (const st of s.steps) {
        expect(st.title).toBeTruthy();
        expect(st.latex).not.toMatch(/undefined|NaN/);
        expect(st.text).not.toMatch(/undefined|NaN/);
        const v = buildView(st.scene);
        expect(v.camera.pos.every(Number.isFinite)).toBe(true);
        for (const t of v.tiles) expect([...t.pos, ...t.size].every(Number.isFinite)).toBe(true);
      }
    });
  }
  it('rejects garbage', () => {
    expect(() => solve('x + * 2')).toThrow();
    expect(() => solve('x = = 2')).toThrow();
    expect(() => solve('q + 1 = 2')).toThrow();
  });
});

describe('spanish', () => {
  it('defaults to Spanish (Mexico)', () => {
    const s = solve('2x + 3 = 7');
    expect(s.kind).toBe('Ecuación lineal');
    expect(s.steps[0].title).toBe('La ecuación es una balanza');
    expect(s.answer).toBe('x = 2');
  });
  it('translates every case without leaking English titles', () => {
    for (const [input] of cases) {
      const es = solve(input, 'es');
      const en = solve(input, 'en');
      expect(es.steps.length).toBe(en.steps.length);
      es.steps.forEach((st, i) => {
        if (!/^(Solve|Try) /.test(en.steps[i].title)) expect(st.title).not.toBe(en.steps[i].title);
        expect(st.text).not.toBe(en.steps[i].text);
      });
    }
  });
  it('parser errors in Spanish', () => {
    expect(() => solve('q + 1 = 2', 'es')).toThrow(/Letra desconocida/);
  });
});

describe('systems', () => {
  const sys: [string, string | RegExp][] = [
    ['x+2=y;3x-2y=2;', '(6,\\ 8)'],
    ['y = x^2 - 4; y = 2x - 1', /\(-1,\\ -3\),\\ \(3,\\ 5\)/],
    ['x^2 + y^2 = 25; y = x + 1', /\(-4,\\ -3\),\\ \(3,\\ 4\)/],
    ['x^2 + y^2 = 25; (x-4)^2 + y^2 = 9', /\(4,\\ -3\),\\ \(4,\\ 3\)/],
    ['y = x^2; y = 2 - x^2', /\(-1,\\ 1\),\\ \(1,\\ 1\)/],
    ['y = 2x + 1; y = 2x + 3', /no solution/],
    ['y = x + 1; 2y = 2x + 2', /infinitely/],
    ['x = y^2; y = x - 2', /\(1,\\ -1\),\\ \(4,\\ 2\)/],
    ['y = x; y = -x; y = 2x', '(0,\\ 0)'],
    ['y = x; y = -x + 2; y = 3', /no solution/],
    ['x^2 + y^2 = 4; y = x^3', /approx|\./],
    ['y = sin(x); y = x/2', /0/],
  ];
  for (const [q, ans] of sys) {
    it(q, () => {
      const s = solve(q, 'en');
      expect(s.kind).toBe('System of equations');
      if (typeof ans === 'string') expect(s.answer).toBe(ans);
      else expect(s.answer).toMatch(ans);
      for (const st of s.steps) {
        expect(st.latex).not.toMatch(/undefined|NaN/);
        expect(st.text).not.toMatch(/undefined|NaN/);
        const v = buildView(st.scene);
        expect(v.camera.pos.every(Number.isFinite)).toBe(true);
        for (const a of v.arrows) expect([...a.from, ...a.to].every(Number.isFinite)).toBe(true);
      }
    });
  }
  it('explains x+2=y;3x-2y=2 by substitution (Spanish)', () => {
    const s = solve('x+2=y;3x-2y=2;', 'es');
    const titles = s.steps.map((x) => x.title);
    expect(titles).toContain('Grafica la ecuación (1)');
    expect(titles).toContain('Sustituye en la ecuación (2)');
    expect(s.steps.find((x) => x.title === 'Resuelve para x')!.latex).toMatch(/x = 6/);
    expect(s.steps.find((x) => x.title === 'Encuentra y')!.latex).toMatch(/= 8/);
  });
  it('limits to 10 equations', () => {
    expect(() => solve(Array.from({ length: 11 }, (_, i) => `y = x + ${i}`).join(';'), 'en')).toThrow(/at most 10/);
  });
});

import { generateExamples, rng } from '../src/lib/generate';

describe('generated examples', () => {
  it('are all solvable and unique', () => {
    const seen = new Set<string>();
    const exs = generateExamples(rng(42), 300, seen);
    expect(exs.length).toBe(300);
    expect(new Set(exs.map((e) => e.q)).size).toBe(300);
    for (const ex of exs) {
      const s = solve(ex.q, 'es');
      expect(s.steps.length, ex.q).toBeGreaterThan(0);
      expect(s.answer, ex.q).not.toMatch(/undefined|NaN/);
    }
  });
});
