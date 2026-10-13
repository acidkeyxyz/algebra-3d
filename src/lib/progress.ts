// Player progress for the learning game: XP, ranks, stars per level, badges, daily streak.
// Everything lives in this browser's localStorage; the functions below are pure so they can be tested.

import { LEVELS, TRACKS, levelsOf, starsFor, startIndex, type Bi, type Level, type TrackId } from './learn';

export interface Progress {
  age: number | null;
  xp: number;
  stars: Record<string, number>; // best stars per level id
  badges: string[];
  days: number; // days in a row with a round played
  lastDay: string; // YYYY-MM-DD
}

export const emptyProgress = (): Progress => ({ age: null, xp: 0, stars: {}, badges: [], days: 0, lastDay: '' });

const KEY = 'algebra3d.progress';

export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      const p = emptyProgress();
      if (typeof raw.age === 'number') p.age = raw.age;
      if (typeof raw.xp === 'number') p.xp = Math.max(0, raw.xp);
      if (raw.stars && typeof raw.stars === 'object') {
        for (const l of LEVELS) {
          const v = Number(raw.stars[l.id]);
          if (v >= 1 && v <= 3) p.stars[l.id] = Math.floor(v);
        }
      }
      if (Array.isArray(raw.badges)) p.badges = raw.badges.filter((b: unknown) => typeof b === 'string');
      if (typeof raw.days === 'number') p.days = raw.days;
      if (typeof raw.lastDay === 'string') p.lastDay = raw.lastDay;
      return p;
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return emptyProgress();
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

// ---------- ranks ----------

export const RANKS: { xp: number; emoji: string; name: Bi }[] = [
  { xp: 0, emoji: '🐣', name: { en: 'Apprentice', es: 'Aprendiz' } },
  { xp: 150, emoji: '🧭', name: { en: 'Explorer', es: 'Explorador' } },
  { xp: 400, emoji: '🛡️', name: { en: 'Adventurer', es: 'Aventurero' } },
  { xp: 800, emoji: '🦸', name: { en: 'Hero', es: 'Héroe' } },
  { xp: 1400, emoji: '🧙', name: { en: 'Wizard', es: 'Mago' } },
  { xp: 2400, emoji: '🐉', name: { en: 'Legend', es: 'Leyenda' } },
];

export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  return { index: i, ...RANKS[i], next, into: xp - RANKS[i].xp, span: next ? next.xp - RANKS[i].xp : 1, pct: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}

/** XP for one right answer: 10, plus 2 for each answer already in the current streak (up to 10). */
export const xpForAnswer = (combo: number) => 10 + 2 * Math.min(combo, 5);
export const bonusForStars = (stars: number) => 25 * stars;

// ---------- badges ----------

export interface BadgeInfo {
  id: string;
  emoji: string;
  name: Bi;
  how: Bi;
}

export const BADGES: BadgeInfo[] = [
  { id: 'first', emoji: '🥇', name: { en: 'First win', es: 'Primera victoria' }, how: { en: 'Pass your first level.', es: 'Pasa tu primer nivel.' } },
  { id: 'perfect', emoji: '💎', name: { en: 'Perfect round', es: 'Ronda perfecta' }, how: { en: 'Finish a round with no mistakes.', es: 'Termina una ronda sin errores.' } },
  { id: 'combo', emoji: '🔥', name: { en: 'On fire', es: 'En racha' }, how: { en: 'Get 8 answers right in a row.', es: 'Acierta 8 respuestas seguidas.' } },
  { id: 'stars20', emoji: '🌟', name: { en: 'Star collector', es: 'Coleccionista de estrellas' }, how: { en: 'Collect 20 stars.', es: 'Reúne 20 estrellas.' } },
  { id: 'streak3', emoji: '📅', name: { en: 'Three days', es: 'Tres días' }, how: { en: 'Play 3 days in a row.', es: 'Juega 3 días seguidos.' } },
  ...TRACKS.map((t) => ({
    id: `master-${t.id}`,
    emoji: t.emoji,
    name: { en: `${t.name.en} master`, es: `Maestro de ${t.name.es.toLowerCase()}` },
    how: { en: `Pass every level of ${t.name.en}.`, es: `Pasa todos los niveles de ${t.name.es}.` },
  })),
];

export const totalStars = (p: Progress) => Object.values(p.stars).reduce((a, b) => a + b, 0);

// ---------- levels: locked / open ----------

export type LevelState = 'locked' | 'review' | 'recommended' | 'open';

/** Levels before the age's starting point stay open for review; after it, you pass one to open the next. */
export function levelStates(p: Progress, track: TrackId, unlockAll = false): Record<string, LevelState> {
  const ls = levelsOf(track);
  const start = startIndex(track, p.age ?? 8);
  const out: Record<string, LevelState> = {};
  let recommended = false;
  ls.forEach((l, i) => {
    const prevPassed = i === 0 || (p.stars[ls[i - 1].id] ?? 0) >= 1;
    if (i < start) out[l.id] = 'review';
    else if (i === start || prevPassed) {
      if (!recommended && !(p.stars[l.id] >= 1)) {
        out[l.id] = 'recommended';
        recommended = true;
      } else out[l.id] = 'open';
    } else out[l.id] = unlockAll ? 'open' : 'locked';
  });
  return out;
}

export function nextLevel(level: Level): Level | undefined {
  const ls = levelsOf(level.track);
  return ls[ls.findIndex((l) => l.id === level.id) + 1];
}

// ---------- recording a finished round ----------

export interface RoundResult {
  mistakes: number;
  maxCombo: number;
  xp: number; // XP earned by answers
}

export interface RoundOutcome {
  progress: Progress;
  stars: number;
  bonus: number;
  xpTotal: number;
  newBadges: BadgeInfo[];
  rankUp: boolean;
  newBest: boolean;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => dayKey(new Date());

export function nextDays(p: Progress, day: string): number {
  if (p.lastDay === day) return p.days;
  const [y, m, d] = day.split('-').map(Number);
  const yesterday = dayKey(new Date(y, m - 1, d - 1));
  return p.lastDay === yesterday ? p.days + 1 : 1;
}

export function recordRound(p: Progress, level: Level, r: RoundResult, day = today()): RoundOutcome {
  const stars = starsFor(r.mistakes);
  const bonus = bonusForStars(stars);
  const xpTotal = r.xp + bonus;
  const before = rankOf(p.xp).index;
  const next: Progress = {
    ...p,
    xp: p.xp + xpTotal,
    stars: { ...p.stars },
    badges: [...p.badges],
    days: nextDays(p, day),
    lastDay: day,
  };
  const newBest = stars > (p.stars[level.id] ?? 0);
  if (newBest) next.stars[level.id] = stars;

  const earned: string[] = [];
  const give = (id: string, ok: boolean) => {
    if (ok && !next.badges.includes(id)) {
      next.badges.push(id);
      earned.push(id);
    }
  };
  give('first', stars >= 1);
  give('perfect', stars >= 1 && r.mistakes === 0);
  give('combo', r.maxCombo >= 8);
  give('stars20', totalStars(next) >= 20);
  give('streak3', next.days >= 3);
  for (const t of TRACKS) give(`master-${t.id}`, levelsOf(t.id).every((l) => (next.stars[l.id] ?? 0) >= 1));

  return {
    progress: next,
    stars,
    bonus,
    xpTotal,
    newBadges: BADGES.filter((b) => earned.includes(b.id)),
    rankUp: rankOf(next.xp).index > before,
    newBest,
  };
}
