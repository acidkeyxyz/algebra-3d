import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { solve } from '../lib/solver';
import { buildView } from '../lib/view';
import { COLORS, type Solution } from '../lib/scene';
import type { CameraPreset } from '../three/Stage';
import Viewer from './Viewer';
import MathTex from './Math';
import Footer from './Footer';
import LangSwitch from './LangSwitch';
import ExampleList from './ExampleList';
import HelpModal from './HelpModal';
import Learn from './Learn';
import { loadFavorites, saveFavorites, toggleFav, isFav } from '../lib/favorites';
import { pretty, type Example } from '../lib/generate';
import { LANGS, UI, loadLang, saveLang, setLang as setI18nLang, type Lang } from '../lib/i18n';
import { describeScene, speakMath } from '../lib/a11y';

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

type Mode = 'learn' | 'solver';
const MODE_KEY = 'algebra3d.mode';

function initialMode(): Mode {
  try {
    if (new URLSearchParams(location.search).get('q')) return 'solver'; // shared formula links open the solver
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'learn' || m === 'solver') return m;
  } catch {
    /* ignore */
  }
  return 'learn';
}

export default function App() {
  const [mode, setModeState] = useState<Mode>(initialMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [preset, setPreset] = useState<{ name: CameraPreset; n: number }>({ name: 'step', n: 0 });
  const [help, setHelp] = useState(false);
  const [lang, setLangState] = useState<Lang>(() => {
    const l = loadLang();
    setI18nLang(l); // formulas speak the right language from the very first render
    return l;
  });
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
    setI18nLang(l);
    setLangState(l);
    saveLang(l);
  };
  useEffect(() => {
    document.documentElement.lang = LANGS.find((x) => x.id === lang)!.locale;
    const app = lang === 'es' ? 'Álgebra 3D' : 'Algebra 3D';
    document.title = mode === 'solver' ? `${t.solverTitle} · ${app}` : app;
  }, [lang, mode]);

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
  const sceneText = useMemo(() => describeScene(step?.scene, lang), [step, lang]);
  // Spoken to screen readers whenever the step changes (polite live region).
  const announcement = useMemo(() => {
    if (!step || !sol) return '';
    const idx = Math.min(stepIdx, last);
    const end = idx === last ? ` ${t.spokenAnswer}: ${speakMath(sol.answer, lang)}.` : '';
    return `${t.step} ${idx + 1} / ${steps.length}. ${step.title}. ${speakMath(step.latex, lang)}. ${step.text}${end}`;
  }, [step, sol, stepIdx, lang]);

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
    if (mode !== 'solver') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      // Leave native behaviour alone for form fields, buttons, links and the dialog (Space/Enter activate buttons).
      if (el?.closest('input, textarea, select, button, a, summary, [role="dialog"], [role="switch"], [role="slider"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
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
  }, [go, move, last, mode]);

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

  /** From the learning game: open the 3D solver, optionally on one equation. */
  const openSolver = (q?: string) => {
    setMode('solver');
    if (q) submit(q);
  };

  const cam = (name: CameraPreset) => setPreset((p) => ({ name, n: p.n + 1 }));

  const solver = (
    <div class={`app${expanded ? ` x-${expanded}` : ''}`}>
      <nav aria-label={t.skipToSteps}>
        <a class="skip-link" href="#step-card" onClick={(e) => { e.preventDefault(); document.getElementById('step-card')?.focus(); }}>{t.skipToSteps}</a>
      </nav>
      <header class="top">
        <button type="button" class="expand-btn top-expand" onClick={() => expand('input')} title={t.expandInput} aria-label={t.expandInput} aria-expanded={expanded === 'input'}>
          <ExpandIcon />
        </button>
        <div class="brand">
          <img class="logo" src={`${import.meta.env.BASE_URL}/logo-120.webp`} alt="" width="40" height="40" />
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
            autocapitalize="off"
            autocorrect="off"
            aria-label={t.equation}
            aria-describedby="eq-hint"
            aria-invalid={result.error ? true : undefined}
            aria-errormessage={result.error ? 'eq-error' : undefined}
          />
          <span id="eq-hint" class="sr-only">{t.equationHint}</span>
          <button
            type="button"
            class={`star big${isFav(favs, query) ? ' on' : ''}`}
            onClick={() => flipFav(EXAMPLES.find((e) => e.q === query) ?? { q: query, level: '' })}
            aria-pressed={isFav(favs, query)}
            title={t.star}
            aria-label={`${t.favorite}: ${pretty(query)}`}
          >
            <span aria-hidden="true">{isFav(favs, query) ? '★' : '☆'}</span>
          </button>
          <button type="submit" class="primary">
            {t.solve}
          </button>
        </form>
        <button type="button" class={`side-toggle${sideOpen ? ' on' : ''}`} onClick={() => setSideOpen((o) => !o)} aria-expanded={sideOpen} aria-controls="examples-panel">
          <span aria-hidden="true">☰</span> {t.showExamples}
        </button>
        <div class="top-right">
          <LangSwitch lang={lang} onChange={setLang} label={t.language} />
          <button type="button" class="learn-btn" onClick={() => setMode('learn')} title={t.learnMode}>
            <span aria-hidden="true">🎮</span> {t.learnMode}
          </button>
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
        <Viewer view={view} preset={preset} autoRotate={autoRotate} inset={inset} label={`${t.viewLabel}. ${t.viewHint}`} describedBy="scene-desc" />
        <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
        <div id="scene-desc" class="sr-only">{t.sceneDescription}: {sceneText}</div>

        <div class="hud-top">
          {sol && (
            <div class="kind">
              <span class="tag">{sol.kind}</span>
              <MathTex tex={sol.inputLatex} />
            </div>
          )}
          <div class="cam" role="group" aria-label={t.cameraGroup}>
            <button type="button" title={t.camStep} aria-label={t.camStep} onClick={() => cam('step')}><span aria-hidden="true">🎯</span></button>
            <button type="button" title={t.frontTitle} aria-label={t.frontTitle} onClick={() => cam('front')}>{t.front}</button>
            <button type="button" title={t.topTitle} aria-label={t.topTitle} onClick={() => cam('top')}>{t.top}</button>
            <button type="button" title={t.sideTitle} aria-label={t.sideTitle} onClick={() => cam('side')}>{t.side}</button>
            <button type="button" title={t.spin} aria-label={t.spin} aria-pressed={autoRotate} class={autoRotate ? 'on' : ''} onClick={() => setAutoRotate((a) => !a)}><span aria-hidden="true">⟳</span></button>
            <button type="button" title={t.helpTitle} aria-label={t.helpTitle} aria-expanded={help} aria-controls="controls-help" class={help ? 'on' : ''} onClick={() => setHelp((h) => !h)}><span aria-hidden="true">?</span></button>
            <button type="button" class="expand-btn" onClick={() => expand('stage')} title={t.expandStage} aria-label={t.expandStage} aria-expanded={expanded === 'stage'}>
              <ExpandIcon />
            </button>
          </div>
        </div>

        {help && (
          <div class="help" id="controls-help" role="region" aria-label={t.helpHead}>
            <b>{t.helpHead}</b>
            <p class="hint">{t.helpFocus}</p>
            <ul>
              <li><kbd>{t.helpMouse[0]}</kbd> {t.helpMouse[1]} · <kbd>{t.helpMouse[2]}</kbd> {t.helpMouse[3]} · <kbd>{t.helpMouse[4]}</kbd> {t.helpMouse[5]}</li>
              <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> {t.helpWalk} · <kbd>Q</kbd><kbd>E</kbd> {t.helpTurn} · <kbd>R</kbd><kbd>F</kbd> {t.helpUpDown} · <kbd>+</kbd><kbd>−</kbd> {t.helpZoom}</li>
              <li><kbd>←</kbd><kbd>→</kbd> {t.helpSteps} · <kbd>{lang === 'es' ? 'Espacio' : 'Space'}</kbd> {t.helpPlay} · <kbd>{lang === 'es' ? 'Fin' : 'End'}</kbd> {t.helpFinal}</li>
            </ul>
          </div>
        )}

        {step?.scene.type === 'balance' || step?.scene.type === 'box' ? (
          <div class="legend" role="group" aria-label={t.legend}>
            <span><i style={`--c:${COLORS.x3}`} aria-hidden="true" />x³</span>
            <span><i style={`--c:${COLORS.x2}`} aria-hidden="true" />x²</span>
            <span><i style={`--c:${COLORS.x}`} aria-hidden="true" />x</span>
            <span><i style={`--c:${COLORS.y}`} aria-hidden="true" />y</span>
            <span><i style={`--c:${COLORS.one}`} aria-hidden="true" />1</span>
            <span><i class="neg" style={`--c:${COLORS.neg}`} aria-hidden="true" />{t.negative} ({t.striped})</span>
          </div>
        ) : null}

        {result.error ? (
          <div class="card error" id="eq-error" role="alert">
            <h2>{t.errTitle}</h2>
            <p>{result.error}</p>
            <p class="hint">
              {t.errHint} <code>2x + 3 = 7</code>, <code>y = x^2 - 4</code> {t.or} <code>x^3 + 3x^2 = 0</code>.
            </p>
          </div>
        ) : (
          step && (
            <section class="card" ref={card} id="step-card" tabIndex={-1} aria-label={`${t.stepsRegion} ${Math.min(stepIdx, last) + 1} / ${steps.length}`}>
              <nav class="nav" aria-label={t.stepsNav}>
                <button type="button" class="arrow" onClick={() => go(stepIdx - 1)} disabled={stepIdx === 0} aria-label={t.prev}>
                  <span aria-hidden="true">◀</span>
                </button>
                <div class="progress">
                  <div class="count">
                    {t.step} {stepIdx + 1} / {steps.length}
                    <button class="expand-btn steps-expand" onClick={() => expand('steps')} title={t.expandSteps} aria-label={t.expandSteps} aria-expanded={expanded === 'steps'}>
                      <ExpandIcon />
                    </button>
                  </div>
                  <ol class="dots">
                    {steps.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          class={`dot${i === stepIdx ? ' on' : ''}${i < stepIdx ? ' done' : ''}`}
                          title={s.title}
                          onClick={() => go(i)}
                          aria-current={i === stepIdx ? 'step' : undefined}
                          aria-label={`${t.step} ${i + 1}: ${s.title}`}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
                <button type="button" class="arrow" onClick={() => go(stepIdx + 1)} disabled={stepIdx === last} aria-label={t.next}>
                  <span aria-hidden="true">▶</span>
                </button>
              </nav>
              <h2>{step.title}</h2>
              <div class="eq">
                <MathTex tex={step.latex} block />
              </div>
              <p>{step.text}</p>
              <div class="actions">
                <button type="button" onClick={() => go(0)} disabled={stepIdx === 0}>{t.start}</button>
                <button type="button" onClick={() => setPlaying((p) => !p)} class={playing ? 'on' : ''}>
                  {playing ? t.pause : t.play}
                </button>
                <button type="button" onClick={() => go(last)} disabled={stepIdx === last}>{t.final}</button>
                {sol && stepIdx === last && (
                  <span class="answer">
                    {t.answer} <MathTex tex={sol.answer} />
                  </span>
                )}
              </div>
            </section>
          )
        )}
      </main>
      </div>
      <Footer lang={lang} />
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

  return (
    <>
      <div class="learn-host" hidden={mode !== 'learn'}>
        <Learn lang={lang} onLang={setLang} onSolver={openSolver} />
      </div>
      {mode === 'solver' && solver}
    </>
  );
}
