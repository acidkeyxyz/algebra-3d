import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import MathTex from './Math';
import { speakMath } from '../lib/a11y';
import Footer from './Footer';
import LangSwitch from './LangSwitch';
import { AGES, AGE_INFO, HEARTS, ROUND_LENGTH, TRACKS, fracTex, isCorrect, levelsOf, makeRound, type Level, type Question, type TrackId, type Visual } from '../lib/learn';
import {
  BADGES,
  bonusForStars,
  levelStates,
  loadProgress,
  nextLevel,
  rachaState,
  useComodin,
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
    solver: '3D solver',
    solverSub: 'Any equation',
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
    rachaRisk: "Don't lose your streak! Pass a round today.",
    rachaDone: (n: number) => `Your streak is ${n} ${n === 1 ? 'day' : 'days'}`,
    rachaStart: 'Pass a round today to start your streak.',
    rachaBroken: (n: number) => `You lost your ${n}-day streak.`,
    comodin: 'Use a joker',
    comodinsLeft: (n: number) => `Jokers left: ${n}`,
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
    xpLong: 'experience points',
    skip: 'Skip to main content',
    levelsDone: 'levels completed',
    starsOf: (n: number) => `${n} of 3 stars`,
    heartsLeft: (n: number) => `${n} of ${HEARTS} hearts left`,
    progressLabel: 'Round progress',
    keypad: 'Number keypad',
    correctChoice: 'Correct answer',
    wrongChoice: 'Your answer, not correct',
    lockedSr: 'Locked. Pass the level before to unlock it.',
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
    solver: 'Solucionador 3D',
    solverSub: 'Cualquier ecuación',
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
    rachaRisk: '¡No pierdas la racha! Pasa una ronda hoy.',
    rachaDone: (n: number) => `Tu racha es de ${n} ${n === 1 ? 'día' : 'días'}`,
    rachaStart: 'Pasa una ronda hoy para empezar tu racha.',
    rachaBroken: (n: number) => `Perdiste tu racha de ${n} ${n === 1 ? 'día' : 'días'}.`,
    comodin: 'Usar comodín',
    comodinsLeft: (n: number) => `Comodines: ${n}`,
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
    xpLong: 'puntos de experiencia',
    skip: 'Saltar al contenido principal',
    levelsDone: 'niveles completados',
    starsOf: (n: number) => `${n} de 3 estrellas`,
    heartsLeft: (n: number) => `${n} de ${HEARTS} corazones`,
    progressLabel: 'Progreso de la ronda',
    keypad: 'Teclado numérico',
    correctChoice: 'Respuesta correcta',
    wrongChoice: 'Tu respuesta, incorrecta',
    lockedSr: 'Bloqueado. Pasa el nivel anterior para desbloquearlo.',
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
  const firstScreen = useRef(true);
  useEffect(() => {
    root.current?.scrollTo({ top: 0 });
    // Screen changes are announced by moving focus to the new content (the round manages its own focus).
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    if (screen.name === 'round') return;
    const el = root.current?.querySelector<HTMLElement>(screen.name === 'result' ? 'main h2' : 'main');
    el?.focus();
  }, [screen.name]);

  const finishRound = (level: Level, result: RoundResult) => {
    const outcome = recordRound(progress, level, result);
    update(outcome.progress);
    setScreen({ name: 'result', level, outcome, result });
  };

  return (
    <div class="ln" ref={root}>
      <a
        class="skip-link"
        href="#learn-main"
        onClick={(e) => {
          e.preventDefault();
          root.current?.querySelector<HTMLElement>('main')?.focus();
        }}
      >
        {t.skip}
      </a>
      <header class="ln-top">
        <div class="brand">
          <img class="logo" src={`${import.meta.env.BASE_URL}/logo-120.webp`} alt="" width="40" height="40" />
          <h1>{t.appName}</h1>
          {TEST_MODE && <span class="ln-test">🧪 TEST</span>}
        </div>
        <div class="top-right">
          <LangSwitch lang={lang} onChange={onLang} label={lang === 'es' ? 'Idioma' : 'Language'} />
          <button
            type="button"
            class="sound-btn"
            title={muted ? t.soundOn : t.soundOff}
            aria-label={muted ? t.soundOn : t.soundOff}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
              if (muted) playCorrect(0);
            }}
          >
            <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
          </button>
        </div>
      </header>

      {screen.name === 'home' &&
        (progress.age == null ? (
          <Welcome lang={lang} onPick={(age) => update({ ...progress, age })} />
        ) : (
          <Home lang={lang} onSolver={() => onSolver()} progress={progress} track={track} setTrack={setTrack} setAge={(age) => update({ ...progress, age })} setProgress={update} onPlay={start} />
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
      <Footer lang={lang} />
    </div>
  );
}

// ---------- welcome + home ----------

function AgePicker({ lang, age, onPick }: { lang: Lang; age: number | null; onPick: (a: number) => void }) {
  const t = S[lang];
  return (
    <div class="ln-ages" role="group" aria-label={t.howOld}>
      {AGES.map((a) => (
        <button key={a} type="button" aria-pressed={age === a} aria-label={`${a} ${t.yearsOld}`} class={`ln-age${age === a ? ' on' : ''}`} onClick={() => onPick(a)}>
          <b aria-hidden="true">{a}</b>
          <span aria-hidden="true">{t.yearsOld}</span>
        </button>
      ))}
    </div>
  );
}

function Welcome({ lang, onPick }: { lang: Lang; onPick: (a: number) => void }) {
  const t = S[lang];
  return (
    <main class="ln-main ln-welcome" id="learn-main" tabIndex={-1} aria-label={t.appName}>
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
  onSolver,
  progress,
  track,
  setTrack,
  setAge,
  setProgress,
  onPlay,
}: {
  lang: Lang;
  onSolver: () => void;
  progress: Progress;
  track: TrackId;
  setTrack: (t: TrackId) => void;
  setAge: (a: number) => void;
  setProgress: (p: Progress) => void;
  onPlay: (l: Level) => void;
}) {
  const t = S[lang];
  const rank = rankOf(progress.xp);
  const age = progress.age ?? 8;
  const info = AGE_INFO[age];
  const states = useMemo(() => levelStates(progress, track, TEST_MODE), [progress, track]);
  const cur = TRACKS.find((x) => x.id === track)!;
  const [openBadge, setOpenBadge] = useState<string | null>(null);

  const racha = rachaState(progress);

  return (
    <main class="ln-main" id="learn-main" tabIndex={-1} aria-label={t.appName}>
      <section class={`ln-racha ${racha.status}`} aria-label={t.dayStreak}>
        <span aria-hidden="true">🔥</span>
        <div>
          <b>
            {racha.status === 'done' && t.rachaDone(racha.days)}
            {racha.status === 'risk' && t.rachaRisk}
            {racha.status === 'none' && t.rachaStart}
            {racha.status === 'broken' && t.rachaBroken(racha.lost)}
          </b>
          {racha.status === 'risk' && <div class="ln-racha-sub">{t.rachaDone(racha.days)}</div>}
          <div class="ln-racha-sub">🃏 {t.comodinsLeft(progress.comodines)}</div>
        </div>
        {racha.status === 'broken' && racha.canRestore && (
          <button type="button" class="ln-racha-btn" onClick={() => setProgress(useComodin(progress))}>
            🃏 {t.comodin}
          </button>
        )}
      </section>

      <section class="ln-hero">
        <div class="ln-rank" aria-hidden="true">{rank.emoji}</div>
        <div class="ln-hero-body">
          <div class="ln-rank-name">
            {rank.name[lang]} <small>· {t.level} {rank.index + 1}</small>
          </div>
          <div class="ln-xp" role="progressbar" aria-label={`${rank.name[lang]}: ${progress.xp} ${t.xpLong}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.pct * 100)}>
            <i style={`width:${Math.round(rank.pct * 100)}%`} />
          </div>
          <div class="ln-xp-text">
            {progress.xp} <abbr title={t.xpLong}>{t.xp}</abbr>
            {rank.next ? (
              <>
                {' · '}{rank.next.xp - progress.xp} <abbr title={t.xpLong}>{t.xp}</abbr> {t.toNext} {rank.next.name[lang]} <span aria-hidden="true">{rank.next.emoji}</span>
              </>
            ) : (
              ` · ${t.maxRank}`
            )}
          </div>
        </div>
        <div class="ln-stats">
          <span title={t.dayStreak}><span aria-hidden="true">🔥</span> <b>{racha.status === 'broken' || racha.status === 'none' ? 0 : racha.days}</b> <small>{t.dayStreak}</small></span>
          <span title={t.stars}><span aria-hidden="true">⭐</span> <b>{totalStars(progress)}</b> <small>{t.stars}</small></span>
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
        <div class="ln-tracks" role="group" aria-label={t.pickPath}>
          {TRACKS.map((tr) => {
            const ls = levelsOf(tr.id);
            const done = ls.filter((l) => (progress.stars[l.id] ?? 0) >= 1).length;
            return (
              <button key={tr.id} type="button" aria-pressed={tr.id === track} class={`ln-track${tr.id === track ? ' on' : ''}`} style={`--c:${tr.color}`} onClick={() => setTrack(tr.id)}>
                <span class="e" aria-hidden="true">{tr.emoji}</span>
                <b>{tr.name[lang]}</b>
                <small>
                  <span aria-hidden="true">{done}/{ls.length}</span>
                  <span class="sr-only">{done} / {ls.length} {t.levelsDone}</span>
                </small>
              </button>
            );
          })}
          <button type="button" class="ln-track solver" style="--c:#14b8a6" onClick={onSolver}>
            <span class="e" aria-hidden="true">🧮</span>
            <b>{t.solver}</b>
            <small>{t.solverSub}</small>
          </button>
        </div>

        <div class="ln-path" style={`--c:${cur.color}`} role="group" aria-label={cur.name[lang]}>
          {levelsOf(track).map((l, i) => {
            const st = states[l.id];
            const stars = progress.stars[l.id] ?? 0;
            const locked = st === 'locked';
            return (
              <button
                key={l.id}
                type="button"
                class={`ln-level ${st}${stars ? ' done' : ''}`}
                aria-disabled={locked ? 'true' : undefined}
                onClick={() => !locked && onPlay(l)}
              >
                {st === 'recommended' && <span class="ribbon">{t.recommended}</span>}
                {st === 'review' && <span class="ribbon soft">{t.review}</span>}
                <span class="num" aria-hidden="true">{locked ? '🔒' : l.emoji}</span>
                <b>{i + 1}. {l.name[lang]}</b>
                <small>{l.goal[lang]}</small>
                {locked && <span class="sr-only">{t.lockedSr}</span>}
                <span class="stars" role="img" aria-label={t.starsOf(stars)}>
                  {[1, 2, 3].map((n) => (
                    <i key={n} class={n <= stars ? 'on' : ''} aria-hidden="true">{n <= stars ? '★' : '☆'}</i>
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
              <button key={b.id} type="button" class={`ln-badge${has ? ' on' : ''}`} onClick={() => setOpenBadge(openBadge === b.id ? null : b.id)} aria-expanded={openBadge === b.id} aria-label={`${b.name[lang]}: ${b.how[lang]}${has ? ` (${t.done})` : ''}`}>
                <span aria-hidden="true">{has ? b.emoji : '❔'}</span>
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

/** Keeps only what the question's answer can contain: digits, one optional leading minus, one decimal point. */
function cleanAnswer(v: string, kind: 'int' | 'dec' | 'signed'): string {
  let out = '';
  for (const ch of v.replace(/−/g, '-').replace(',', '.')) {
    if (/\d/.test(ch)) out = out === '0' ? ch : out + ch;
    else if (ch === '-' && kind === 'signed' && out === '') out = '-';
    else if (ch === '.' && kind === 'dec' && !out.includes('.')) out += out === '' || out === '-' ? '0.' : '.';
  }
  return out.slice(0, 8);
}

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
  const fbRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [heard, setHeard] = useState('');

  // New question: read it aloud to screen readers and put focus where the answer goes.
  useEffect(() => {
    const choices = q.choices ? ` ${q.choices.map((c, n) => `${n + 1}: ${isFrac(c) ? speakMath(fracTex(c), lang) : c}`).join('; ')}.` : '';
    const expr = q.tex ? speakMath(lang === 'es' && q.texEs ? q.texEs : q.tex, lang) : q.expr;
    setHeard(`${t.question} ${i + 1} / ${qs.length}. ${q.ask[lang]} ${expr}.${choices}`);
    if (!q.choices && inputRef.current && window.matchMedia?.('(pointer: fine)').matches) inputRef.current.focus();
    else cardRef.current?.focus();
  }, [i]);

  // Phones: after a wrong answer, bring the explanation into view.
  useEffect(() => {
    if (!fb || fb.ok || !fbRef.current) return;
    try {
      if (!window.matchMedia('(max-width: 720px)').matches) return;
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      fbRef.current.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    } catch {
      /* ignore */
    }
  }, [fb]);
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
    const el = e.target as HTMLElement | null;
    // Enter on a button/link/field keeps its own meaning (activate / submit the form).
    if (e.key === 'Enter') {
      if (el?.closest('button, a, input, textarea, select')) return;
      if (fb) {
        e.preventDefault();
        next();
      }
      return;
    }
    if (fb || !q.choices) return; // typed answers are a real text field now
    // WCAG 2.1.4: the 1–4 shortcuts only work while focus is inside the question.
    if (!cardRef.current?.contains(el)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= q.choices.length) submit(q.choices[n - 1]);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current?.(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const shownAnswer = isFrac(q.answer) ? <MathTex tex={fracTex(q.answer)} /> : <b>{q.answer.replace(/-/g, '−')}</b>;

  return (
    <main class="ln-main ln-round" id="learn-main" tabIndex={-1} aria-label={`${level.name[lang]}. ${t.question} ${i + 1} / ${qs.length}`}>
      <div class="ln-bar">
        <button type="button" class="ln-x" onClick={onQuit} aria-label={t.quit} title={t.quit}>✕</button>
        <div class="ln-prog" role="progressbar" aria-label={t.progressLabel} aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={i + (fb?.ok ? 1 : 0)} aria-valuetext={`${i + 1} / ${qs.length}`}>
          <i style={`width:${((i + (fb ? 1 : 0)) / qs.length) * 100}%`} />
        </div>
        <div class="ln-hearts" role="img" aria-label={t.heartsLeft(hearts)}>
          {Array.from({ length: HEARTS }, (_, n) => (
            <span key={n} class={n < hearts ? '' : 'lost'} aria-hidden="true">{n < hearts ? '❤️' : '🖤'}</span>
          ))}
        </div>
      </div>

      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{heard}</div>
      <div class="ln-qcard" ref={cardRef} tabIndex={-1} role="group" aria-label={`${t.question} ${i + 1} / ${qs.length}`}>
        <div class="ln-qmeta">
          <span><span aria-hidden="true">{level.emoji}</span> {level.name[lang]}</span>
          <span>{t.question} {i + 1}/{qs.length}</span>
          {combo >= 2 && <span class="combo"><span aria-hidden="true">🔥</span> {combo} {t.combo}</span>}
        </div>
        <p class="ln-ask">{q.ask[lang]}</p>
        {q.visual && <VisualView v={q.visual} />}
        <div class="ln-expr">{q.tex ? <MathTex tex={lang === 'es' && q.texEs ? q.texEs : q.tex} block /> : q.expr}</div>

        {q.choices ? (
          <div class="ln-choices">
            {q.choices.map((c, n) => {
              const state = fb ? (c === q.answer ? ' right' : c === fb.picked ? ' bad' : ' dim') : '';
              return (
                <button key={c} type="button" class={`ln-choice${state}`} aria-disabled={fb ? 'true' : undefined} aria-keyshortcuts={String(n + 1)} onClick={() => submit(c)}>
                  <kbd aria-hidden="true">{n + 1}</kbd>
                  {isFrac(c) ? <MathTex tex={fracTex(c)} /> : c}
                  {fb && c === q.answer && <span class="sr-only"> — {t.correctChoice}</span>}
                  {fb && !fb.ok && c === fb.picked && <span class="sr-only"> — {t.wrongChoice}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <form
              id="answer-form"
              class="ln-answer"
              onSubmit={(e) => {
                e.preventDefault();
                if (fb) next();
                else submit(typed);
              }}
            >
              <input
                ref={inputRef}
                class={`ln-typed${fb ? (fb.ok ? ' right' : ' bad') : ''}`}
                type="text"
                value={typed}
                placeholder="?"
                readOnly={!!fb}
                inputMode="none"
                autocomplete="off"
                autocapitalize="off"
                spellcheck={false}
                enterKeyHint="done"
                aria-label={t.yourAnswer}
                onInput={(e) => setTyped(cleanAnswer((e.target as HTMLInputElement).value, level.input))}
              />
            </form>
            {!fb && <Keypad kind={level.input} onKey={press} t={t} />}
          </>
        )}
      </div>

      {!fb && !q.choices && (
        <div class="ln-okbar">
          <button type="submit" form="answer-form" class="ln-ok" disabled={!typed || typed === '-'}>{t.check}</button>
        </div>
      )}

      {fb && (
        <div class={`ln-fb ${fb.ok ? 'ok' : 'no'}`} role="alert" ref={fbRef}>
          <div class="ln-fb-head">
            <span class="face" aria-hidden="true">{fb.ok ? '🎉' : '💡'}</span>
            <b>{fb.praise}</b>
            {fb.ok && <span class="gain">+{fb.gain} <abbr title={t.xpLong}>{t.xp}</abbr></span>}
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
                <b><span aria-hidden="true">🔍</span> {t.seeWhy}</b>
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
            <button type="button" class="primary" onClick={next}>
              {hearts === 0 || last ? t.finish : t.next}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Keypad({ kind, onKey, t }: { kind: 'int' | 'dec' | 'signed'; onKey: (k: string) => void; t: (typeof S)['en'] }) {
  const d = (n: string) => (
    <button key={n} type="button" class="k" onClick={() => onKey(n)}>{n}</button>
  );
  return (
    <div class="ln-keypad" role="group" aria-label={t.keypad}>
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
    <main class="ln-main ln-result" id="learn-main" tabIndex={-1} aria-label={t.appName}>
      <div class="ln-mascot" aria-hidden="true">{pass ? (outcome.stars === 3 ? '🏆' : '🎊') : '🦉'}</div>
      <h2 tabIndex={-1}>{pass ? t.passed : t.failed}</h2>
      <p class="ln-sub">{level.emoji} {level.name[lang]}</p>
      <div class="ln-bigstars" role="img" aria-label={t.starsOf(outcome.stars)}>
        {[1, 2, 3].map((n) => (
          <i key={n} class={n <= outcome.stars ? 'on' : ''} style={`--d:${n * 260}ms`} aria-hidden="true">{n <= outcome.stars ? '★' : '☆'}</i>
        ))}
      </div>
      {outcome.newBest && pass && <div class="ln-pill"><span aria-hidden="true">✨</span> {t.newBest}</div>}
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
