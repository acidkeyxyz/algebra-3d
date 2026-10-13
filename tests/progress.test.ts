import { describe, expect, it } from 'vitest';
import { emptyProgress, levelStates, nextDays, rankOf, recordRound, xpForAnswer, BADGES } from '../src/lib/progress';
import { LEVELS, levelById, levelsOf } from '../src/lib/learn';

const add1 = levelById('add1')!;

describe('progress', () => {
  it('XP grows with the answer streak, capped', () => {
    expect([0, 1, 5, 9].map(xpForAnswer)).toEqual([10, 12, 20, 20]);
  });

  it('ranks by XP', () => {
    expect(rankOf(0).index).toBe(0);
    expect(rankOf(150).index).toBe(1);
    expect(rankOf(99999).pct).toBe(1);
  });

  it('a pass stores stars, XP bonus and the first-win badge; a fail stores nothing', () => {
    const win = recordRound(emptyProgress(), add1, { mistakes: 0, maxCombo: 10, xp: 100 }, '2026-10-12');
    expect(win.stars).toBe(3);
    expect(win.xpTotal).toBe(175);
    expect(win.progress.stars.add1).toBe(3);
    expect(win.newBadges.map((b) => b.id)).toEqual(expect.arrayContaining(['first', 'perfect', 'combo']));
    const lose = recordRound(emptyProgress(), add1, { mistakes: 5, maxCombo: 2, xp: 20 }, '2026-10-12');
    expect(lose.stars).toBe(0);
    expect(lose.progress.stars.add1).toBeUndefined();
    expect(lose.newBadges).toHaveLength(0);
  });

  it('keeps the best stars', () => {
    const a = recordRound(emptyProgress(), add1, { mistakes: 0, maxCombo: 5, xp: 90 }).progress;
    const b = recordRound(a, add1, { mistakes: 4, maxCombo: 2, xp: 50 });
    expect(b.progress.stars.add1).toBe(3);
    expect(b.newBest).toBe(false);
  });

  it('counts days in a row, across month ends', () => {
    const p = { ...emptyProgress(), days: 2, lastDay: '2026-09-30' };
    expect(nextDays(p, '2026-10-01')).toBe(3);
    expect(nextDays(p, '2026-09-30')).toBe(2);
    expect(nextDays(p, '2026-10-03')).toBe(1);
  });

  it('awards a track master badge when all levels pass', () => {
    let p = emptyProgress();
    let last;
    for (const l of levelsOf('div')) {
      last = recordRound(p, l, { mistakes: 2, maxCombo: 3, xp: 80 });
      p = last.progress;
    }
    expect(p.badges).toContain('master-div');
    expect(last!.newBadges.map((b) => b.id)).toContain('master-div');
  });

  it('unlocks levels from the age, with earlier ones open for review', () => {
    const p = { ...emptyProgress(), age: 10 };
    const s = levelStates(p, 'mul');
    expect(s.mul1).toBe('review');
    expect(s.mul4).toBe('review');
    expect(s.mul5).toBe('recommended');
    expect(s.mul6).toBe('locked');
    const passed = { ...p, stars: { mul5: 2 } };
    const s2 = levelStates(passed, 'mul');
    expect(s2.mul5).toBe('open');
    expect(s2.mul6).toBe('recommended');
    expect(s2.mul7).toBe('locked');
  });

  it('every track has a playable first level for each age', () => {
    for (let age = 8; age <= 13; age++) {
      for (const t of ['add', 'mul', 'div', 'frac', 'alg'] as const) {
        const states = Object.values(levelStates({ ...emptyProgress(), age }, t));
        expect(states).toContain('recommended');
      }
    }
  });

  it('has a unique id for each badge', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(LEVELS.length).toBeGreaterThan(30);
  });
});

describe('test mode', () => {
  it('opens every level when unlockAll is set', () => {
    const s = levelStates({ ...emptyProgress(), age: 8 }, 'mul', true);
    expect(Object.values(s)).not.toContain('locked');
    expect(Object.values(levelStates({ ...emptyProgress(), age: 8 }, 'mul'))).toContain('locked');
  });
});
