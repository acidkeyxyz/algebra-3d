import { describe, expect, it } from 'vitest';
import { describeScene, speakMath } from '../src/lib/a11y';
import { solve } from '../src/lib/solver';

describe('speakMath', () => {
  it('speaks a linear equation', () => {
    expect(speakMath('2x + 3 = 7', 'en')).toBe('2x plus 3 equals 7');
    expect(speakMath('3x - 4 = x + 6', 'es')).toBe('3x menos 4 es igual a x más 6');
  });
  it('speaks powers, fractions and roots', () => {
    expect(speakMath('x^2 = 9', 'en')).toBe('x squared equals 9');
    expect(speakMath('x^{3} + 1', 'es')).toBe('x al cubo más 1');
    expect(speakMath('x^{10}', 'en')).toBe('x to the power 10');
    expect(speakMath('\\frac{3}{4}', 'en')).toBe('3 over 4');
    expect(speakMath('x = \\pm\\sqrt{9}', 'en')).toBe('x equals plus or minus square root of 9');
  });
  it('drops layout commands and keeps text', () => {
    expect(speakMath('\\left(x+1\\right)\\quad \\text{so}', 'en')).toBe('open parenthesis x plus 1 close parenthesis, so');
    expect(speakMath('\\color{#f00}{x}', 'en')).toBe('x');
  });
  it('never leaves LaTeX syntax in the spoken text', () => {
    for (const q of ['2x+3=7', 'x^2+5x+6=0', 'x^2+x-1=0', 'y=x^2-4x+3', 'x^2+y^2=25; y=x+1', 'z=x^2-y^2']) {
      for (const lang of ['en', 'es'] as const) {
        const sol = solve(q, lang);
        for (const s of sol.steps) {
          const spoken = speakMath(s.latex, lang);
          expect(spoken, `${q}: ${s.latex}`).not.toMatch(/[\\{}^_]/);
        }
        expect(speakMath(sol.answer, lang)).not.toMatch(/[\\{}^_]/);
      }
    }
  });
});

describe('describeScene', () => {
  it('describes every scene type of every step in words', () => {
    const kinds = new Set<string>();
    for (const q of ['2x+3=7', 'x^3+3x^2=0', 'y=x^2-4x+3', 'z=x^2-y^2', 'x^2+5x+6=0']) {
      for (const lang of ['en', 'es'] as const) {
        for (const s of solve(q, lang).steps) {
          kinds.add(s.scene.type);
          const d = describeScene(s.scene, lang);
          expect(d.length).toBeGreaterThan(20);
          expect(d).not.toMatch(/undefined|NaN|\[object|\\/);
        }
      }
    }
    expect([...kinds].sort()).toEqual(['balance', 'box', 'graph', 'surface']);
  });
  it('reads the balance sides', () => {
    const s = solve('2x + 3 = 7', 'en').steps[0];
    expect(describeScene(s.scene, 'en')).toMatch(/Left side: .*Right side: /);
  });
});
