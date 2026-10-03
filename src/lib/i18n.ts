// Two languages: Spanish (Mexico), the default, and English (US).
// Solver text is written inline as T('english', 'español'); UI text lives in UI below.

export type Lang = 'es' | 'en';

export const LANGS: { id: Lang; label: string; locale: string }[] = [
  { id: 'es', label: 'Español (MX)', locale: 'es-MX' },
  { id: 'en', label: 'English (US)', locale: 'en-US' },
];

export const DEFAULT_LANG: Lang = 'es';

let current: Lang = DEFAULT_LANG;

export function setLang(l: Lang) {
  current = l;
}
export function getLang(): Lang {
  return current;
}

/** Pick the string for the current language. */
export function T(en: string, es: string): string {
  return current === 'es' ? es : en;
}

const KEY = 'algebra3d.lang';

export function loadLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'es' || q === 'en') return q;
    const v = localStorage.getItem(KEY);
    if (v === 'es' || v === 'en') return v;
  } catch {
    /* storage may be blocked */
  }
  return DEFAULT_LANG;
}

export function saveLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
}

const en = {
  tagline: 'Type an equation. Watch it get solved, step by step.',
  placeholder: 'e.g. y = x + 2   ·   x^3 + 3x^2 = 0   ·   x + 2 = y; 3x - 2y = 2',
  equation: 'Equation',
  solve: 'Solve ▶',
  camStep: 'Camera for this step',
  front: 'Front',
  top: 'Top',
  side: 'Side',
  frontTitle: 'Front view',
  topTitle: 'Top view',
  sideTitle: 'Side view',
  spin: 'Spin around',
  helpTitle: 'Controls help',
  helpHead: 'Move around like in a game',
  helpMouse: ['drag', 'rotate', 'right-drag', 'pan', 'wheel', 'zoom'],
  helpWalk: 'walk',
  helpTurn: 'turn',
  helpUpDown: 'up/down',
  helpZoom: 'zoom',
  helpSteps: 'previous / next step',
  helpPlay: 'play',
  helpFinal: 'final view',
  negative: 'negative',
  errTitle: "Hmm, I couldn't read that",
  errHint: 'Try something like',
  or: 'or',
  step: 'Step',
  prev: 'Previous step',
  next: 'Next step',
  start: '⏮ Start',
  play: '⏵ Play',
  pause: '⏸ Pause',
  final: 'Final view ⏭',
  answer: 'Answer:',
  language: 'Language',
  favorites: 'Favorites',
  examples: 'Examples',
  emptyFavs: 'Tap ☆ on any formula to pin it here.',
  generating: 'Generating more…',
  star: 'Pin to favorites',
  unstar: 'Remove from favorites',
  mine: 'Mine',
  showExamples: 'Examples',
  helpGuide: 'Help',
  expandInput: 'Expand formula and examples',
  expandStage: 'Expand 3D view',
  expandSteps: 'Expand steps',
  closeExpanded: 'Close',
  levels: {
    Line: 'Line',
    Balance: 'Balance',
    Brackets: 'Brackets',
    'Square root': 'Square root',
    Rectangle: 'Rectangle',
    Factor: 'Factor',
    Formula: 'Formula',
    Box: 'Box',
    Parabola: 'Parabola',
    'Isolate y': 'Isolate y',
    Circle: 'Circle',
    '3D': '3D',
    System: 'System',
  } as Record<string, string>,
};

const es: typeof en = {
  tagline: 'Escribe una ecuación y mira cómo se resuelve, paso a paso.',
  placeholder: 'ej. y = x + 2   ·   x^3 + 3x^2 = 0   ·   x + 2 = y; 3x - 2y = 2',
  equation: 'Ecuación',
  solve: 'Resolver ▶',
  camStep: 'Cámara de este paso',
  front: 'Frente',
  top: 'Arriba',
  side: 'Lado',
  frontTitle: 'Vista de frente',
  topTitle: 'Vista desde arriba',
  sideTitle: 'Vista lateral',
  spin: 'Girar alrededor',
  helpTitle: 'Ayuda de controles',
  helpHead: 'Muévete como en un videojuego',
  helpMouse: ['arrastrar', 'girar', 'clic derecho', 'desplazar', 'rueda', 'zoom'],
  helpWalk: 'caminar',
  helpTurn: 'voltear',
  helpUpDown: 'subir/bajar',
  helpZoom: 'zoom',
  helpSteps: 'paso anterior / siguiente',
  helpPlay: 'reproducir',
  helpFinal: 'vista final',
  negative: 'negativo',
  errTitle: 'Mmm, no pude leer eso',
  errHint: 'Prueba algo como',
  or: 'o',
  step: 'Paso',
  prev: 'Paso anterior',
  next: 'Paso siguiente',
  start: '⏮ Inicio',
  play: '⏵ Reproducir',
  pause: '⏸ Pausa',
  final: 'Vista final ⏭',
  answer: 'Respuesta:',
  language: 'Idioma',
  favorites: 'Favoritas',
  examples: 'Ejemplos',
  emptyFavs: 'Toca ☆ en cualquier fórmula para fijarla aquí.',
  generating: 'Generando más…',
  star: 'Fijar en favoritas',
  unstar: 'Quitar de favoritas',
  mine: 'Mía',
  showExamples: 'Ejemplos',
  helpGuide: 'Ayuda',
  expandInput: 'Ampliar fórmula y ejemplos',
  expandStage: 'Ampliar vista 3D',
  expandSteps: 'Ampliar pasos',
  closeExpanded: 'Cerrar',
  levels: {
    Line: 'Recta',
    Balance: 'Balanza',
    Brackets: 'Paréntesis',
    'Square root': 'Raíz cuadrada',
    Rectangle: 'Rectángulo',
    Factor: 'Factorizar',
    Formula: 'Fórmula general',
    Box: 'Caja',
    Parabola: 'Parábola',
    'Isolate y': 'Despejar y',
    Circle: 'Circunferencia',
    '3D': '3D',
    System: 'Sistema',
  },
};

export const UI: Record<Lang, typeof en> = { en, es };
