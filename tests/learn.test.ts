import { describe, expect, it } from 'vitest';
import { LEVELS, TRACKS, AGES, AGE_INFO, isCorrect, makeRound, questionKey, seeded, startIndex, starsFor, levelsOf, type Question } from '../src/lib/learn';
import { solve } from '../src/lib/solver';

/** Independent check of the arithmetic shown in the question text. */
function evalExpr(e: string): number | null {
  const s = e.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s*=\s*\?$/, '');
  if (!/^[-\d.+*/() ]+$/.test(s)) return null;
  return Function(`return (${s})`)() as number;
}

describe('learning path', () => {
  it('has levels for every track and every age', () => {
    for (const t of TRACKS) expect(levelsOf(t.id).length).toBeGreaterThanOrEqual(6);
    for (const a of AGES) {
      expect(AGE_INFO[a]).toBeTruthy();
      for (const t of TRACKS) expect(startIndex(t.id, a)).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('orders levels by age inside a track', () => {
    for (const t of TRACKS) {
      const ages = levelsOf(t.id).map((l) => l.age);
      expect(ages).toEqual([...ages].sort((a, b) => a - b));
    }
  });

  for (const level of LEVELS) {
    it(`${level.id}: 300 clean questions with a correct answer`, () => {
      const r = seeded(level.id.length * 977 + level.age);
      for (let i = 0; i < 300; i++) {
        const q: Question = level.make(r);
        expect(q.answer).not.toMatch(/NaN|undefined|Infinity/);
        expect(q.why.en + q.why.es + q.ask.en).not.toMatch(/NaN|undefined/);
        expect(q.expr ?? q.tex ?? q.visual).toBeTruthy();
        if (q.choices) {
          expect(q.choices).toHaveLength(4);
          expect(new Set(q.choices).size).toBe(4);
          expect(q.choices).toContain(q.answer);
        } else {
          expect(isCorrect(q, q.answer)).toBe(true);
          expect(isCorrect(q, '')).toBe(false);
          expect(isCorrect(q, 'abc')).toBe(false);
          if (level.input === 'int') expect(q.answer).toMatch(/^\d+$/);
          if (level.input !== 'signed') expect(q.answer).not.toMatch(/-/);
        }
        // Plain arithmetic: recompute from the text.
        if (q.expr && /^[\d.+−×÷() -]+= \?$/.test(q.expr) && !/%/.test(q.expr)) {
          const v = evalExpr(q.expr);
          if (v !== null && level.id !== 'div4') expect(v).toBeCloseTo(parseFloat(q.answer), 6);
        }
      }
    });
  }

  it('rounds have 10 different questions', () => {
    for (const level of LEVELS) {
      const qs = makeRound(level, seeded(7));
      expect(qs).toHaveLength(10);
      expect(new Set(qs.map((q) => questionKey(q))).size).toBeGreaterThanOrEqual(8);
    }
  });

  it('every equation offered for 3D opens in the solver and gets the same answer', () => {
    const r = seeded(42);
    for (const level of LEVELS.filter((l) => l.track === 'alg')) {
      for (let i = 0; i < 40; i++) {
        const q = level.make(r);
        if (!q.eq) continue;
        const sol = solve(q.eq, 'en');
        expect(sol.answer.replace(/\\ /g, ' ')).toContain(`x = ${q.answer}`);
      }
    }
  });

  it('remainder questions are consistent', () => {
    const level = LEVELS.find((l) => l.id === 'div4')!;
    const r = seeded(3);
    for (let i = 0; i < 100; i++) {
      const q = level.make(r);
      const [t, d] = q.expr!.split(' ÷ ').map(Number);
      const want = /remainder/.test(q.ask.en) ? t % d : Math.floor(t / d);
      expect(q.answer).toBe(String(want));
    }
  });

  it('compares typed answers as numbers', () => {
    const q = { ask: { en: '', es: '' }, answer: '1.5', why: { en: '', es: '' } } as Question;
    for (const ok of ['1.5', '1,5', ' 1.50 ', '01.5']) expect(isCorrect(q, ok)).toBe(true);
    expect(isCorrect(q, '15')).toBe(false);
    expect(isCorrect({ ...q, answer: '-3' }, '−3')).toBe(true);
    expect(isCorrect({ ...q, answer: '3' }, '-3')).toBe(false);
  });

  it('awards stars from mistakes', () => {
    expect([0, 1, 2, 3, 4, 5].map(starsFor)).toEqual([3, 3, 2, 2, 1, 0]);
  });
});
