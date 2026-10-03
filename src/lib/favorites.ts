// Starred formulas, kept in this browser's localStorage.

import type { Example } from './generate';
import { normKey } from './generate';

const KEY = 'algebra3d.favorites';

export function loadFavorites(): Example[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(raw)) return raw.filter((e) => e && typeof e.q === 'string').map((e) => ({ q: e.q, level: String(e.level ?? '') }));
  } catch {
    /* storage blocked or corrupt */
  }
  return [];
}

export function saveFavorites(favs: Example[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(favs));
  } catch {
    /* ignore */
  }
}

export function isFav(favs: Example[], q: string): boolean {
  const k = normKey(q);
  return favs.some((f) => normKey(f.q) === k);
}

export function toggleFav(favs: Example[], ex: Example): Example[] {
  const k = normKey(ex.q);
  return isFav(favs, ex.q) ? favs.filter((f) => normKey(f.q) !== k) : [...favs, ex];
}
