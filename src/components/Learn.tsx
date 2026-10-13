import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import MathTex from './Math';
import LangSwitch from './LangSwitch';
import { AGES, AGE_INFO, HEARTS, ROUND_LENGTH, TRACKS, fracTex, isCorrect, levelsOf, makeRound, type Level, type Question, type TrackId, type Visual } from '../lib/learn';
import {
  BADGES,
  bonusForStars,
  levelStates,
  loadProgress,
  nextLevel,
  rankOf,
  recordRound,
  saveProgress,
  totalStars,
  xpForAnswer,
  type Progress,
  type RoundOutcome,
  type RoundResult,
} from '../lib/progress';
import type { Lang } from '../lib/i18n';
import { isMuted, playCorrect, setMuted } from '../lib/sound';

const S = {
  en: {
    appName: 'Algebra 3D',
    solver: '🧮 3D solver',
    welcome: 'Hi! Ready to level up your math?',
    howOld: 'How old are you?',
    howOldHint: 'We pick the right starting point for you. You can change it any time.',
    yearsOld: 'years old',
    age: 'Age',
    youLearn: 'This year you learn',
    pickPath: 'Pick a path',
    review: 'Review',
    recommended: 'Start here',
    locked: 'Pass the level before to unlock',
    play: 'Play',
    xp: 'XP',
    toNext: 'to',
    maxRank: 'Top rank!',
    dayStreak: 'day streak',
    stars: 'stars',
    badges: 'Badges',
    quit: 'Quit round',
    check: 'Check ✓',
    next: 'Continue ▶',
    finish: 'See result ▶',
    backspace: 'Delete',
    correct: ['Great!', 'Awesome!', 'You got it!', 'Super!', 'Nice one!', 'Brilliant!'],
    wrong: 'Not quite',
    answerWas: 'The answer is',
    see3d: '🔭 See it in 3D',
    soundOn: 'Turn sound on',
    soundOff: 'Turn sound off',
    seeWhy: "Let's see why",
    replay: '↻ Replay',
    combo: 'in a row',
    level: 'Level',
    passed: 'Level passed!',
    failed: 'Out of hearts',
    failedHint: 'Read the explanations and try again — you can do it!',
    newBest: 'New best!',
    xpEarned: 'XP earned',
    starBonus: 'star bonus',
    newBadge: 'New badge!',
    rankUp: 'Rank up!',
    nextLevel: 'Next level ▶',
    retry: '🔁 Play again',
    map: '🗺️ Map',
    done: 'Done',
    mistakes: (n: number) => (n === 0 ? 'No mistakes!' : n === 1 ? '1 mistake' : `${n} mistakes`),
    question: 'Question',
    yourAnswer: 'Your answer',
    rules: `${ROUND_LENGTH} questions · ${HEARTS} hearts · every mistake costs a heart`,
    starRule: '3 ⭐ with at most 1 mistake',
  },
  es: {
    appName: 'Álgebra 3D',
    solver: '🧮 Solucionador 3D',
    welcome: '¡Hola! ¿Listo para subir de nivel en mates?',
    howOld: '¿Cuántos años tienes?',
    howOldHint: 'Elegimos el mejor punto de partida para ti. Puedes cambiarlo cuando quieras.',
    yearsOld: 'años',
    age: 'Edad',
    youLearn: 'Este año aprendes',
    pickPath: 'Elige un camino',
    review: 'Repaso',
    recommended: 'Empieza aquí',
    locked: 'Pasa el nivel anterior para abrirlo',
    play: 'Jugar',
    xp: 'XP',
    toNext: 'para',
    maxRank: '¡Rango máximo!',
    dayStreak: 'días seguidos',
    stars: 'estrellas',
    badges: 'Insignias',
    quit: 'Salir de la ronda',
    check: 'Comprobar ✓',
    next: 'Continuar ▶',
    finish: 'Ver resultado ▶',
    backspace: 'Borrar',
    correct: ['¡Genial!', '¡Increíble!', '¡Lo lograste!', '¡Súper!', '¡Muy bien!', '¡Brillante!'],
    wrong: 'Casi',
    answerWas: 'La respuesta es',
    see3d: '🔭 Verlo en 3D',
    soundOn: 'Activar sonido',
    soundOff: 'Silenciar',
    seeWhy: 'Veamos por qué',
    replay: '↻ Repetir',
    combo: 'seguidas',
    level: 'Nivel',
    passed: '¡Nivel superado!',
    failed: 'Sin corazones',
    failedHint: 'Lee las explicaciones e inténtalo otra vez, ¡tú puedes!',
    newBest: '¡Nuevo récord!',
    xpEarned: 'XP ganados',
    starBonus: 'bono de estrellas',
    newBadge: '¡Nueva insignia!',
    rankUp: '¡Subiste de rango!',
    nextLevel: 'Siguiente nivel ▶',
    retry: '🔁 Jugar otra vez',
    map: '🗺️ Mapa',
    done: 'Listo',
    mistakes: (n: number) => (n === 0 ? '¡Sin errores!' : n === 1 ? '1 error' : `${n} errores`),
    question: 'Pregunta',
    yourAnswer: 'Tu respuesta',
    rules: `${ROUND_LENGTH} preguntas · ${HEARTS} corazones · cada error cuesta un corazón`,
    starRule: '3 ⭐ con máximo 1 error',
  },
};

type Screen = { name: 'home' } | { name: 'round'; level: Level; id: number } | { name: 'result'; level: Level; outcome: RoundOutcome; result: RoundResult };

/** ?test=true opens every level, so all the questions can be tried. */
const TEST_MODE = (() => {
  try {
    const v = new URLSearchParams(location.search).get('test');
    return v === 'true' || v === '1';
  } catch {
    return false;
  }
})();

const pickOne = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export default function Learn({ lang, onLang, onSolver }: { lang: Lang; onLang: (l: Lang) => void; onSolver: (q?: string) => void }) {
  const t = S[lang];
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [track, setTrack] = useState<TrackId>('add');
  const root = useRef<HTMLDivElement>(null);
  const rounds = useRef(0);
  const [muted, setMutedState] = useState(isMuted);
  const start = (level: Level) => setScreen({ name: 'round', level, id: ++rounds.current });

  const update = (p: Progress) => {
    setProgress(p);
    saveProgress(p);
  };
  useEffect(() => {
    root.current?.scrollTo({ top: 0 });
  }, [screen.name]);

  const finishRound = (level: Level, result: RoundResult) => {
    const outcome = recordRound(progress, level, result);
    update(outcome.progress);
    setScreen({ name: 'result', level, outcome, result });
  };

  return (
    <div class="ln" ref={root}>
      <header class="ln-top">
        <div class="brand">
          <span class="logo">∑</span>
          <h1>{t.appName}</h1>
          {TEST_MODE && <span class="ln-test">🧪 TEST</span>}
        </div>
        <div class="top-right">
          <LangSwitch lang={lang} onChange={onLang} label={lang === 'es' ? 'Idioma' : 'Language'} />
          <button
            type="button"
            class="sound-btn"
            aria-pressed={!muted}
            title={muted ? t.soundOn : t.soundOff}
            aria-label={muted ? t.soundOn : t.soundOff}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
              if (muted) playCorrect(0);
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" class="solver-btn" onClick={() => onSolver()}>
            {t.solver}
          </button>
        </div>
      </header>

      {screen.name === 'home' &&
        (progress.age == null ? (
          <Welcome lang={lang} onPick={(age) => update({ ...progress, age })} />
        ) : (
          <Home lang={lang} progress={progress} track={track} setTrack={setTrack} setAge={(age) => update({ ...progress, age })} onPlay={start} />
        ))}

      {screen.name === 'round' && (
        <Round
          key={screen.id}
          lang={lang}
          level={screen.level}
          onQuit={() => setScreen({ name: 'home' })}
          onFinish={(r) => finishRound(screen.level, r)}
          on3D={(q) => onSolver(q)}
        />
      )}

      {screen.name === 'result' && (
        <Result
          lang={lang}
          level={screen.level}
          outcome={screen.outcome}
          result={screen.result}
          onRetry={() => start(screen.level)}
          onNext={() => {
            const n = nextLevel(screen.level);
            if (n) start(n);
          }}
          onMap={() => {
            setTrack(screen.level.track);
            setScreen({ name: 'home' });
          }}
        />
      )}
    </div>
  );
}

// ---------- welcome + home ----------

function AgePicker({ lang, age, onPick }: { lang: Lang; age: number | null; onPick: (a: number) => void }) {
  const t = S[lang];
  return (
    <div class="ln-ages" role="radiogroup" aria-label={t.age}>
      {AGES.map((a) => (
        <button key={a} type="button" role="radio" aria-checked={age === a} class={`ln-age${age === a ? ' on' : ''}`} onClick={() => onPick(a)}>
          <b>{a}</b>
          <span>{t.yearsOld}</span>
        </button>
      ))}
    </div>
  );
}

function Welcome({ lang, onPick }: { lang: Lang; onPick: (a: number) => void }) {
  const t = S[lang];
  return (
    <main class="ln-main ln-welcome">
      <div class="ln-mascot" aria-hidden="true">🦉</div>
      <h2>{t.welcome}</h2>
      <h3>{t.howOld}</h3>
      <AgePicker lang={lang} age={null} onPick={onPick} />
      <p class="ln-hint">{t.howOldHint}</p>
    </main>
  );
}

function Home({
  lang,
  progress,
  track,
  setTrack,
  setAge,
  onPlay,
}: {
  lang: Lang;
  progress: Progress;
  track: TrackId;
  setTrack: (t: TrackId) => void;
  setAge: (a: number) => void;
  onPlay: (l: Level) => void;
}) {
  const t = S[lang];
  const rank = rankOf(progress.xp);
  const age = progress.age ?? 8;
  const info = AGE_INFO[age];
  const states = useMemo(() => levelStates(progress, track, TEST_MODE), [progress, track]);
  const cur = TRACKS.find((x) => x.id === track)!;
  const [openBadge, setOpenBadge] = useState<string | null>(null);

  return (
    <main class="ln-main">
      <section class="ln-hero">
        <div class="ln-rank" aria-hidden="true">{rank.emoji}</div>
        <div class="ln-hero-body">
          <div class="ln-rank-name">
            {rank.name[lang]} <small>· {t.level} {rank.index + 1}</small>
          </div>
          <div class="ln-xp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.pct * 100)}>
            <i style={`width:${Math.round(rank.pct * 100)}%`} />
          </div>
          <div class="ln-xp-text">
            {progress.xp} {t.xp}
            {rank.next ? ` · ${rank.next.xp - progress.xp} ${t.xp} ${t.toNext} ${rank.next.name[lang]} ${rank.next.emoji}` : ` · ${t.maxRank}`}
          </div>
        </div>
        <div class="ln-stats">
          <span title={t.dayStreak}>🔥 <b>{progress.days}</b> <small>{t.dayStreak}</small></span>
          <span title={t.stars}>⭐ <b>{totalStars(progress)}</b> <small>{t.stars}</small></span>
        </div>
      </section>

      <section class="ln-card">
        <h2>{t.howOld}</h2>
        <AgePicker lang={lang} age={age} onPick={setAge} />
        <p class="ln-info">
          <b>{info.grade[lang]}</b>
          <br />
          {t.youLearn}: {info.topics[lang]}
        </p>
      </section>

      <section>
        <h2 class="ln-h">{t.pickPath}</h2>
        <div class="ln-tracks" role="tablist">
          {TRACKS.map((tr) => {
            const ls = levelsOf(tr.id);
            const done = ls.filter((l) => (progress.stars[l.id] ?? 0) >= 1).length;
            return (
              <button key={tr.id} role="tab" aria-selected={tr.id === track} class={`ln-track${tr.id === track ? ' on' : ''}`} style={`--c:${tr.color}`} onClick={() => setTrack(tr.id)}>
                <span class="e">{tr.emoji}</span>
                <b>{tr.name[lang]}</b>
                <small>{done}/{ls.length}</small>
              </button>
            );
          })}
        </div>

        <div class="ln-path" style={`--c:${cur.color}`}>
          {levelsOf(track).map((l, i) => {
            const st = states[l.id];
            const stars = progress.stars[l.id] ?? 0;
            const locked = st === 'locked';
            return (
              <button
                key={l.id}
                type="button"
                class={`ln-level ${st}${stars ? ' done' : ''}`}
                disabled={locked}
                title={locked ? t.locked : undefined}
                onClick={() => onPlay(l)}
              >
                {st === 'recommended' && <span class="ribbon">{t.recommended}</span>}
                {st === 'review' && <span class="ribbon soft">{t.review}</span>}
                <span class="num">{locked ? '🔒' : l.emoji}</span>
                <b>{i + 1}. {l.name[lang]}</b>
                <small>{l.goal[lang]}</small>
                <span class="stars" aria-label={`${stars} / 3`}>
                  {[1, 2, 3].map((n) => (
                    <i key={n} class={n <= stars ? 'on' : ''}>★</i>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <p class="ln-hint">{t.rules} · {t.starRule}</p>
      </section>

      <section>
        <h2 class="ln-h">{t.badges}</h2>
        <div class="ln-badges">
          {BADGES.map((b) => {
            const has = progress.badges.includes(b.id);
            return (
              <button key={b.id} type="button" class={`ln-badge${has ? ' on' : ''}`} onClick={() => setOpenBadge(openBadge === b.id ? null : b.id)} aria-label={`${b.name[lang]}: ${b.how[lang]}`}>
                <span>{has ? b.emoji : '❔'}</span>
                <small>{b.name[lang]}</small>
                {openBadge === b.id && <em>{b.how[lang]}</em>}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

// ---------- a round of questions ----------

function VisualView({ v }: { v: Visual }) {
  if (v.kind === 'array') {
    return (
      <div class="vis-array" style={`grid-template-columns:repeat(${v.cols}, 1fr)`} aria-hidden="true">
        {Array.from({ length: v.rows * v.cols }, (_, i) => (
          <i key={i} style={`--d:${i * 12}ms`} />
        ))}
      </div>
    );
  }
  if (v.kind === 'groups') {
    const each = v.total / v.groups;
    return (
      <div class="vis-groups" aria-hidden="true">
        {Array.from({ length: v.groups }, (_, g) => (
          <div key={g} class="g">
            {Array.from({ length: each }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (v.kind === 'hops') {
    const W = 60 * (v.count + 1);
    const x = (i: number) => 30 + i * 60;
    return (
      <svg class="vis-hops" viewBox={`0 0 ${W} 96`} role="img" aria-label={`${v.step} × ${v.count}`}>
        <line x1={x(0) - 14} y1="66" x2={x(v.count) + 14} y2="66" class="base" />
        {Array.from({ length: v.count + 1 }, (_, i) => (
          <g key={i} class="stop" style={`--d:${i * 0.6}s`}>
            <circle cx={x(i)} cy="66" r={i === v.count ? 7 : 4.5} class={i === v.count ? 'end' : ''} />
            <text x={x(i)} y="88" class={i === v.count ? 'end' : ''}>{i * v.step}</text>
          </g>
        ))}
        {Array.from({ length: v.count }, (_, i) => (
          <g key={i}>
            <path d={`M${x(i)} 66 Q${(x(i) + x(i + 1)) / 2} 6 ${x(i + 1)} 66`} pathLength="1" class="arc" style={`--d:${i * 0.6 + 0.05}s`} />
            <text x={(x(i) + x(i + 1)) / 2} y="26" class="plus" style={`--d:${i * 0.6 + 0.3}s`}>+{v.step}</text>
          </g>
        ))}
      </svg>
    );
  }
  if (v.kind === 'paint') {
    return (
      <div class="vis-paint" style={`--n:${v.cols}`} aria-hidden="true">
        {Array.from({ length: v.rows }, (_, r) => (
          <div key={r} class="pr">
            {Array.from({ length: v.cols }, (_, c) => (
              <i key={c} style={`--d:${(r * v.cols + c) * 0.05}s`} />
            ))}
            <b style={`--d:${(r * v.cols + v.cols) * 0.05}s`}>{(r + 1) * v.cols}</b>
          </div>
        ))}
      </div>
    );
  }
  if (v.kind === 'area') {
    return (
      <div class="vis-area" aria-hidden="true">
        {v.parts.map((p, i) => (
          <Fragment key={p}>
            {i > 0 && <span class="op">+</span>}
            <div class={`box b${i}`} style={`--d:${i * 0.5}s`}>
              <small>{v.n} × {p}</small>
              <b>{v.n * p}</b>
            </div>
          </Fragment>
        ))}
        <span class="op">=</span>
        <div class="box total" style={`--d:${v.parts.length * 0.5}s`}>
          <b>{v.parts.reduce((s, p) => s + v.n * p, 0)}</b>
        </div>
      </div>
    );
  }
  // pizza: slices with toppings are the fraction, plain dough slices are the rest
  const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [60 + r * Math.cos(a), 60 + r * Math.sin(a)];
  };
  const slice = 360 / v.den;
  return (
    <svg class="vis-pizza" viewBox="0 0 120 120" role="img" aria-label={`${v.num}/${v.den}`}>
      <circle cx="60" cy="60" r="59" class="plate" />
      <circle cx="60" cy="60" r="55" class="crust" />
      {Array.from({ length: v.den }, (_, i) => {
        const a0 = -90 + i * slice;
        const [x0, y0] = pt(a0, 50);
        const [x1, y1] = pt(a0 + slice, 50);
        const on = i < v.num;
        const [px, py] = pt(a0 + slice / 2, v.den > 5 ? 32 : 30);
        const [qx, qy] = pt(a0 + slice / 2, 16);
        return (
          <g key={i} class={`slice${on ? ' on' : ''}`} style={`--d:${i * 0.08}s`}>
            <path d={`M60 60 L${x0} ${y0} A50 50 0 0 1 ${x1} ${y1} Z`} />
            {on && <circle cx={px} cy={py} r={v.den > 6 ? 5 : 7} class="pep" />}
            {on && v.den <= 6 && <circle cx={qx} cy={qy} r="4" class="pep" />}
            {on && <circle cx={(px + qx) / 2 + 5} cy={(py + qy) / 2 - 3} r="2.2" class="basil" />}
          </g>
        );
      })}
    </svg>
  );
}

const isFrac = (s: string) => /^\d+\/\d+$/.test(s);

function Round({ lang, level, onQuit, onFinish, on3D }: { lang: Lang; level: Level; onQuit: () => void; onFinish: (r: RoundResult) => void; on3D: (q: string) => void }) {
  const t = S[lang];
  const qs = useMemo(() => makeRound(level), [level]);
  const [i, setI] = useState(0);
  const [hearts, setHearts] = useState(HEARTS);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [typed, setTyped] = useState('');
  const [replay, setReplay] = useState(0);
  const [fb, setFb] = useState<null | { ok: boolean; gain: number; praise: string; picked?: string }>(null);
  const q: Question = qs[i];
  const mistakes = HEARTS - hearts;
  const last = i === qs.length - 1;

  const submit = (given: string) => {
    if (fb || !given.trim()) return;
    if (isCorrect(q, given)) {
      playCorrect(combo);
      const gain = xpForAnswer(combo);
      setXp((x) => x + gain);
      setCombo((c) => c + 1);
      setMaxCombo((m) => Math.max(m, combo + 1));
      setFb({ ok: true, gain, praise: pickOne(t.correct), picked: given });
    } else {
      setHearts((h) => h - 1);
      setCombo(0);
      setFb({ ok: false, gain: 0, praise: t.wrong, picked: given });
    }
  };

  const next = () => {
    if (!fb) return;
    if (hearts === 0 || last) {
      onFinish({ mistakes, maxCombo, xp });
      return;
    }
    setI(i + 1);
    setTyped('');
    setFb(null);
  };

  const press = (k: string) => {
    if (fb) return;
    setTyped((s) => {
      if (k === 'back') return s.slice(0, -1);
      if (s.length >= 8) return s;
      if (k === '-') return s === '' ? '-' : s;
      if (k === '.') return s.includes('.') ? s : s === '' || s === '-' ? s + '0.' : s + '.';
      return s === '0' ? k : s + k;
    });
  };

  // Physical keyboard: digits, minus, point, backspace, Enter; 1–4 pick a choice.
  const keyRef = useRef<(e: KeyboardEvent) => void>();
  keyRef.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (fb) next();
      else if (!q.choices) submit(typed);
      return;
    }
    if (fb) return;
    if (q.choices) {
      const n = Number(e.key);
      if (n >= 1 && n <= q.choices.length) submit(q.choices[n - 1]);
      return;
    }
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === '-' && level.input === 'signed') press('-');
    else if ((e.key === '.' || e.key === ',') && level.input === 'dec') press('.');
    else if (e.key === 'Backspace') press('back');
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current?.(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const shownAnswer = isFrac(q.answer) ? <MathTex tex={fracTex(q.answer)} /> : <b>{q.answer.replace(/-/g, '−')}</b>;

  return (
    <main class="ln-main ln-round">
      <div class="ln-bar">
        <button type="button" class="ln-x" onClick={onQuit} aria-label={t.quit} title={t.quit}>✕</button>
        <div class="ln-prog" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={i + (fb?.ok ? 1 : 0)}>
          <i style={`width:${((i + (fb ? 1 : 0)) / qs.length) * 100}%`} />
        </div>
        <div class="ln-hearts" aria-label={`${hearts} / ${HEARTS}`}>
          {Array.from({ length: HEARTS }, (_, n) => (
            <span key={n} class={n < hearts ? '' : 'lost'}>{n < hearts ? '❤️' : '🖤'}</span>
          ))}
        </div>
      </div>

      <div class="ln-qcard">
        <div class="ln-qmeta">
          <span>{level.emoji} {level.name[lang]}</span>
          <span>{t.question} {i + 1}/{qs.length}</span>
          {combo >= 2 && <span class="combo">🔥 {combo} {t.combo}</span>}
        </div>
        <p class="ln-ask">{q.ask[lang]}</p>
        {q.visual && <VisualView v={q.visual} />}
        <div class="ln-expr">{q.tex ? <MathTex tex={lang === 'es' && q.texEs ? q.texEs : q.tex} block /> : q.expr}</div>

        {q.choices ? (
          <div class="ln-choices">
            {q.choices.map((c, n) => {
              const state = fb ? (c === q.answer ? ' right' : c === fb.picked ? ' bad' : ' dim') : '';
              return (
                <button key={c} type="button" class={`ln-choice${state}`} disabled={!!fb} onClick={() => submit(c)}>
                  <kbd>{n + 1}</kbd>
                  {isFrac(c) ? <MathTex tex={fracTex(c)} /> : c}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div class={`ln-typed${fb ? (fb.ok ? ' right' : ' bad') : ''}`} aria-live="polite" aria-label={t.yourAnswer}>
              {typed ? typed.replace(/-/g, '−') : <span class="ph">?</span>}
            </div>
            {!fb && <Keypad kind={level.input} onKey={press} onOk={() => submit(typed)} t={t} disabledOk={!typed || typed === '-'} />}
          </>
        )}
      </div>

      {fb && (
        <div class={`ln-fb ${fb.ok ? 'ok' : 'no'}`} role="status">
          <div class="ln-fb-head">
            <span class="face">{fb.ok ? '🎉' : '💡'}</span>
            <b>{fb.praise}</b>
            {fb.ok && <span class="gain">+{fb.gain} {t.xp}</span>}
          </div>
          {!fb.ok && (
            <p>
              {t.answerWas} {shownAnswer}
            </p>
          )}
          {!fb.ok && <p class="why">{q.why[lang]}</p>}
          {!fb.ok && q.explain && (
            <div class="ln-explain" key={replay}>
              <div class="ln-explain-head">
                <b>🔍 {t.seeWhy}</b>
                <button type="button" class="ghost mini" onClick={() => setReplay((n) => n + 1)}>{t.replay}</button>
              </div>
              {q.explain.map((v, n) => (
                <VisualView key={n} v={v} />
              ))}
            </div>
          )}
          <div class="ln-fb-actions">
            {q.eq && (
              <button type="button" class="ghost" onClick={() => on3D(q.eq!)}>
                {t.see3d}
              </button>
            )}
            <button type="button" class="primary" onClick={next} autoFocus>
              {hearts === 0 || last ? t.finish : t.next}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Keypad({ kind, onKey, onOk, t, disabledOk }: { kind: 'int' | 'dec' | 'signed'; onKey: (k: string) => void; onOk: () => void; t: (typeof S)['en']; disabledOk: boolean }) {
  const d = (n: string) => (
    <button key={n} type="button" class="k" onClick={() => onKey(n)}>{n}</button>
  );
  return (
    <div class="ln-keypad">
      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(d)}
      {kind === 'signed' ? (
        <button type="button" class="k alt" onClick={() => onKey('-')} aria-label="−">−</button>
      ) : kind === 'dec' ? (
        <button type="button" class="k alt" onClick={() => onKey('.')} aria-label=".">.</button>
      ) : (
        <span />
      )}
      {d('0')}
      <button type="button" class="k alt" onClick={() => onKey('back')} aria-label={t.backspace}>⌫</button>
      <button type="button" class="k ok" onClick={onOk} disabled={disabledOk}>{t.check}</button>
    </div>
  );
}

// ---------- result ----------

function Result({
  lang,
  level,
  outcome,
  result,
  onRetry,
  onNext,
  onMap,
}: {
  lang: Lang;
  level: Level;
  outcome: RoundOutcome;
  result: RoundResult;
  onRetry: () => void;
  onNext: () => void;
  onMap: () => void;
}) {
  const t = S[lang];
  const pass = outcome.stars > 0;
  const nxt = nextLevel(level);
  const rank = rankOf(outcome.progress.xp);
  return (
    <main class="ln-main ln-result">
      <div class="ln-mascot" aria-hidden="true">{pass ? (outcome.stars === 3 ? '🏆' : '🎊') : '🦉'}</div>
      <h2>{pass ? t.passed : t.failed}</h2>
      <p class="ln-sub">{level.emoji} {level.name[lang]}</p>
      <div class="ln-bigstars" aria-label={`${outcome.stars} / 3`}>
        {[1, 2, 3].map((n) => (
          <i key={n} class={n <= outcome.stars ? 'on' : ''} style={`--d:${n * 260}ms`}>★</i>
        ))}
      </div>
      {outcome.newBest && pass && <div class="ln-pill">✨ {t.newBest}</div>}
      <p class="ln-sub">{t.mistakes(result.mistakes)}</p>
      {!pass && <p class="ln-hint">{t.failedHint}</p>}

      <div class="ln-xpbox">
        <div><b>+{outcome.xpTotal}</b> {t.xpEarned}</div>
        {pass && <small>{result.xp} + {bonusForStars(outcome.stars)} ({t.starBonus})</small>}
      </div>
      {outcome.rankUp && (
        <div class="ln-pill gold">{rank.emoji} {t.rankUp} {rank.name[lang]}</div>
      )}
      {outcome.newBadges.map((b) => (
        <div key={b.id} class="ln-pill gold">
          {b.emoji} {t.newBadge} {b.name[lang]}
        </div>
      ))}

      <div class="ln-result-actions">
        {pass && nxt && (
          <button type="button" class="primary" onClick={onNext}>
            {t.nextLevel}
          </button>
        )}
        <button type="button" class={pass && nxt ? 'ghost' : 'primary'} onClick={onRetry}>
          {t.retry}
        </button>
        <button type="button" class="ghost" onClick={onMap}>
          {t.map}
        </button>
      </div>
    </main>
  );
}
