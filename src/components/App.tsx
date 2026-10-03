import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { solve } from '../lib/solver';
import { buildView } from '../lib/view';
import type { Solution } from '../lib/scene';
import type { CameraPreset } from '../three/Stage';
import Viewer from './Viewer';
import MathTex from './Math';
import LangSwitch from './LangSwitch';
import ExampleList from './ExampleList';
import HelpModal from './HelpModal';
import { loadFavorites, saveFavorites, toggleFav, isFav } from '../lib/favorites';
import type { Example } from '../lib/generate';
import { LANGS, UI, loadLang, saveLang, type Lang } from '../lib/i18n';

const EXAMPLES: (Example & { label: string })[] = [
  { label: 'y = x + 2', q: 'y = x + 2', level: 'Line' },
  { label: '2x + 3 = 7', q: '2x + 3 = 7', level: 'Balance' },
  { label: '3x − 4 = x + 6', q: '3x - 4 = x + 6', level: 'Balance' },
  { label: '2(x − 1) = x + 4', q: '2(x - 1) = x + 4', level: 'Brackets' },
  { label: 'x² = 9', q: 'x^2 = 9', level: 'Square root' },
  { label: 'x² + 5x + 6 = 0', q: 'x^2 + 5x + 6 = 0', level: 'Rectangle' },
  { label: 'x² − 5x + 6 = 0', q: 'x^2 - 5x + 6 = 0', level: 'Factor' },
  { label: 'x² + x − 1 = 0', q: 'x^2 + x - 1 = 0', level: 'Formula' },
  { label: 'x³ + 3x² = 0', q: 'x^3 + 3x^2 = 0', level: 'Box' },
  { label: 'x³ + 5x² + 6x = 0', q: 'x^3 + 5x^2 + 6x = 0', level: 'Box' },
  { label: 'y = x² − 4x + 3', q: 'y = x^2 - 4x + 3', level: 'Parabola' },
  { label: '2x + 3y = 6', q: '2x + 3y = 6', level: 'Isolate y' },
  { label: 'x² + y² = 25', q: 'x^2 + y^2 = 25', level: 'Circle' },
  { label: 'z = x² − y²', q: 'z = x^2 - y^2', level: '3D' },
  { label: 'x + 2 = y; 3x − 2y = 2', q: 'x + 2 = y; 3x - 2y = 2', level: 'System' },
  { label: 'y = x² − 4; y = 2x − 1', q: 'y = x^2 - 4; y = 2x - 1', level: 'System' },
  { label: 'x² + y² = 25; y = x + 1', q: 'x^2 + y^2 = 25; y = x + 1', level: 'System' },
  { label: 'x² + y² = 25; (x − 4)² + y² = 9', q: 'x^2 + y^2 = 25; (x - 4)^2 + y^2 = 9', level: 'System' },
  { label: 'y = x²; y = 2 − x²; y = x', q: 'y = x^2; y = 2 - x^2; y = x', level: 'System' },
];

/** Mobile only: one section takes the whole screen. */
type Expanded = 'input' | 'stage' | 'steps' | null;

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function initialQuery(): string {
  try {
    const q = new URLSearchParams(location.search).get('q');
    if (q) return q;
  } catch {
    /* ignore */
  }
  return 'x^3 + 3x^2 = 0';
}

export default function App() {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [preset, setPreset] = useState<{ name: CameraPreset; n: number }>({ name: 'step', n: 0 });
  const [help, setHelp] = useState(false);
  const [lang, setLangState] = useState<Lang>(loadLang);
  const [favs, setFavs] = useState<Example[]>(loadFavorites);
  const [sideOpen, setSideOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [expanded, setExpanded] = useState<Expanded>(null);
  const expand = (x: Expanded) => {
    setSideOpen(false);
    setExpanded(x);
  };
  const flipFav = (ex: Example) =>
    setFavs((f) => {
      const next = toggleFav(f, ex);
      saveFavorites(next);
      return next;
    });
  const t = UI[lang];

  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };
  useEffect(() => {
    document.documentElement.lang = LANGS.find((x) => x.id === lang)!.locale;
    document.title = lang === 'es' ? 'Álgebra 3D' : 'Algebra 3D';
  }, [lang]);

  const result = useMemo((): { sol?: Solution; error?: string } => {
    try {
      return { sol: solve(query, lang) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [query, lang]);
  const sol = result.sol;
  const steps = sol?.steps ?? [];
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const view = useMemo(() => (step ? buildView(step.scene) : null), [step]);
  const last = steps.length - 1;

  const go = useCallback((i: number) => setStepIdx(Math.max(0, Math.min(last, i))), [last]);
  const move = useCallback((d: number) => setStepIdx((i) => Math.max(0, Math.min(last, i + d))), [last]);

  // Measure the step card so the 3D picture is framed in the space above it.
  const card = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInset(el.offsetHeight + 14));
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!step]);

  const submit = (q = input) => {
    setInput(q);
    setQuery(q);
    setStepIdx(0);
    setPlaying(false);
    setExpanded((x) => (x === 'input' ? null : x));
    try {
      const url = new URL(location.href);
      url.searchParams.set('q', q);
      history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
  };

  // ← → to move between steps (outside the text box).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') move(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') move(-1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(last);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, move, last]);

  // Autoplay through the steps.
  useEffect(() => {
    if (!playing) return;
    if (stepIdx >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => go(stepIdx + 1), 3800);
    return () => clearTimeout(t);
  }, [playing, stepIdx, last, go]);

  const cam = (name: CameraPreset) => setPreset((p) => ({ name, n: p.n + 1 }));

  return (
    <div class={`app${expanded ? ` x-${expanded}` : ''}`}>
      <header class="top">
        <button type="button" class="expand-btn top-expand" onClick={() => expand('input')} title={t.expandInput} aria-label={t.expandInput}>
          <ExpandIcon />
        </button>
        <div class="brand">
          <span class="logo">∑</span>
          <div>
            <h1>{lang === 'es' ? 'Álgebra 3D' : 'Algebra 3D'}</h1>
            <p>{t.tagline}</p>
          </div>
        </div>
        <form
          class="ask"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            placeholder={t.placeholder}
            spellcheck={false}
            autocomplete="off"
            aria-label={t.equation}
          />
          <button
            type="button"
            class={`star big${isFav(favs, query) ? ' on' : ''}`}
            onClick={() => flipFav(EXAMPLES.find((e) => e.q === query) ?? { q: query, level: '' })}
            aria-pressed={isFav(favs, query)}
            title={isFav(favs, query) ? t.unstar : t.star}
            aria-label={isFav(favs, query) ? t.unstar : t.star}
          >
            {isFav(favs, query) ? '★' : '☆'}
          </button>
          <button type="submit" class="primary">
            {t.solve}
          </button>
        </form>
        <button type="button" class={`side-toggle${sideOpen ? ' on' : ''}`} onClick={() => setSideOpen((o) => !o)} aria-expanded={sideOpen}>
          ☰ {t.showExamples}
        </button>
        <div class="top-right">
          <LangSwitch lang={lang} onChange={setLang} label={t.language} />
          <button type="button" class="help-btn" onClick={() => setGuideOpen(true)} aria-haspopup="dialog" title={t.helpGuide}>
            <span aria-hidden="true">?</span> {t.helpGuide}
          </button>
        </div>
      </header>

      <div class={`body${sideOpen ? ' side-open' : ''}`}>
      <ExampleList
        curated={EXAMPLES}
        favs={favs}
        query={query}
        t={t}
        onPick={(q) => {
          submit(q);
          setSideOpen(false);
        }}
        onToggleFav={flipFav}
      />
      <main class="stage-wrap">
        <Viewer view={view} preset={preset} autoRotate={autoRotate} inset={inset} />

        <div class="hud-top">
          {sol && (
            <div class="kind">
              <span class="tag">{sol.kind}</span>
              <MathTex tex={sol.inputLatex} />
            </div>
          )}
          <div class="cam">
            <button title={t.camStep} onClick={() => cam('step')}>🎯</button>
            <button title={t.frontTitle} onClick={() => cam('front')}>{t.front}</button>
            <button title={t.topTitle} onClick={() => cam('top')}>{t.top}</button>
            <button title={t.sideTitle} onClick={() => cam('side')}>{t.side}</button>
            <button title={t.spin} class={autoRotate ? 'on' : ''} onClick={() => setAutoRotate((a) => !a)}>⟳</button>
            <button title={t.helpTitle} class={help ? 'on' : ''} onClick={() => setHelp((h) => !h)}>?</button>
            <button class="expand-btn" onClick={() => expand('stage')} title={t.expandStage} aria-label={t.expandStage}>
              <ExpandIcon />
            </button>
          </div>
        </div>

        {help && (
          <div class="help">
            <b>{t.helpHead}</b>
            <ul>
              <li><kbd>{t.helpMouse[0]}</kbd> {t.helpMouse[1]} · <kbd>{t.helpMouse[2]}</kbd> {t.helpMouse[3]} · <kbd>{t.helpMouse[4]}</kbd> {t.helpMouse[5]}</li>
              <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> {t.helpWalk} · <kbd>Q</kbd><kbd>E</kbd> {t.helpTurn} · <kbd>R</kbd><kbd>F</kbd> {t.helpUpDown} · <kbd>+</kbd><kbd>−</kbd> {t.helpZoom}</li>
              <li><kbd>←</kbd><kbd>→</kbd> {t.helpSteps} · <kbd>{lang === 'es' ? 'Espacio' : 'Space'}</kbd> {t.helpPlay} · <kbd>{lang === 'es' ? 'Fin' : 'End'}</kbd> {t.helpFinal}</li>
            </ul>
          </div>
        )}

        {step?.scene.type === 'balance' || step?.scene.type === 'box' ? (
          <div class="legend">
            <span><i style="--c:#f2a93b" />x³</span>
            <span><i style="--c:#3b82f6" />x²</span>
            <span><i style="--c:#22c55e" />x</span>
            <span><i style="--c:#a855f7" />y</span>
            <span><i style="--c:#facc15" />1</span>
            <span><i style="--c:#ef4444" />{t.negative}</span>
          </div>
        ) : null}

        {result.error ? (
          <div class="card error">
            <h2>{t.errTitle}</h2>
            <p>{result.error}</p>
            <p class="hint">
              {t.errHint} <code>2x + 3 = 7</code>, <code>y = x^2 - 4</code> {t.or} <code>x^3 + 3x^2 = 0</code>.
            </p>
          </div>
        ) : (
          step && (
            <div class="card" ref={card}>
              <div class="nav">
                <button class="arrow" onClick={() => go(stepIdx - 1)} disabled={stepIdx === 0} aria-label={t.prev}>
                  ◀
                </button>
                <div class="progress">
                  <div class="count">
                    {t.step} {stepIdx + 1} / {steps.length}
                    <button class="expand-btn steps-expand" onClick={() => expand('steps')} title={t.expandSteps} aria-label={t.expandSteps}>
                      <ExpandIcon />
                    </button>
                  </div>
                  <div class="dots">
                    {steps.map((s, i) => (
                      <button
                        key={i}
                        class={`dot${i === stepIdx ? ' on' : ''}${i < stepIdx ? ' done' : ''}`}
                        title={s.title}
                        onClick={() => go(i)}
                        aria-label={`${t.step} ${i + 1}: ${s.title}`}
                      />
                    ))}
                  </div>
                </div>
                <button class="arrow" onClick={() => go(stepIdx + 1)} disabled={stepIdx === last} aria-label={t.next}>
                  ▶
                </button>
              </div>
              <h2>{step.title}</h2>
              <div class="eq">
                <MathTex tex={step.latex} block />
              </div>
              <p>{step.text}</p>
              <div class="actions">
                <button onClick={() => go(0)} disabled={stepIdx === 0}>{t.start}</button>
                <button onClick={() => setPlaying((p) => !p)} class={playing ? 'on' : ''}>
                  {playing ? t.pause : t.play}
                </button>
                <button onClick={() => go(last)} disabled={stepIdx === last}>{t.final}</button>
                {sol && stepIdx === last && (
                  <span class="answer">
                    {t.answer} <MathTex tex={sol.answer} />
                  </span>
                )}
              </div>
            </div>
          )
        )}
      </main>
      </div>
      {expanded && (
        <button type="button" class="close-expanded" onClick={() => setExpanded(null)}>
          ✕ {t.closeExpanded}
        </button>
      )}
      {guideOpen && (
        <HelpModal
          lang={lang}
          onClose={() => setGuideOpen(false)}
          onTry={(q) => {
            setGuideOpen(false);
            submit(q);
          }}
        />
      )}
    </div>
  );
}
