import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { generateExamples, normKey, pretty, rng, type Example } from '../lib/generate';
import { isFav } from '../lib/favorites';
import type { UI } from '../lib/i18n';

interface Props {
  curated: Example[];
  favs: Example[];
  query: string;
  t: (typeof UI)['es'];
  onPick: (q: string) => void;
  onToggleFav: (ex: Example) => void;
}

const BATCH = 14;

function Row({ ex, starred, active, t, onPick, onToggleFav }: { ex: Example; starred: boolean; active: boolean } & Pick<Props, 't' | 'onPick' | 'onToggleFav'>) {
  return (
    <div class={`ex-row${active ? ' on' : ''}`} role="listitem">
      <button type="button" class="ex-main" onClick={() => onPick(ex.q)} title={pretty(ex.q)} aria-current={active ? 'true' : undefined}>
        <span class="lvl">{t.levels[ex.level] ?? (ex.level || t.mine)}</span>
        <span class="f">{pretty(ex.q)}</span>
      </button>
      {/* The name never changes; aria-pressed carries the on/off state. */}
      <button
        type="button"
        class={`star${starred ? ' on' : ''}`}
        onClick={() => onToggleFav(ex)}
        aria-pressed={starred}
        aria-label={`${t.favorite}: ${pretty(ex.q)}`}
        title={starred ? t.unstar : t.star}
      >
        <span aria-hidden="true">{starred ? '★' : '☆'}</span>
      </button>
    </div>
  );
}

export default function ExampleList({ curated, favs, query, t, onPick, onToggleFav }: Props) {
  // A new random seed per visit, so the endless list feels fresh each time.
  const random = useMemo(() => rng((Date.now() ^ (Math.random() * 1e9)) >>> 0), []);
  const seen = useRef(new Set(curated.map((e) => normKey(e.q))));
  const [generated, setGenerated] = useState<Example[]>(() => generateExamples(random, BATCH, seen.current));
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Infinite scroll: when the "more" marker comes into view, generate another batch.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setGenerated((g) => [...g, ...generateExamples(random, BATCH, seen.current)]);
      },
      { root: scroller.current, rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // Re-observe after each batch: fires again at once if the marker is still visible.
  }, [random, generated.length]);

  const qk = normKey(query);
  const rest = [...curated, ...generated].filter((e) => !isFav(favs, e.q));

  return (
    <aside class="side" id="examples-panel" aria-label={t.examplesRegion}>
      <h2 class="side-head">
        <span><span aria-hidden="true">★</span> {t.favorites}</span>
        <span class="count">{favs.length}</span>
      </h2>
      <div class="favs" role={favs.length ? 'list' : undefined} aria-label={favs.length ? t.favorites : undefined}>
        {favs.length ? (
          favs.map((ex) => (
            <Row key={`f-${ex.q}`} ex={ex} starred active={normKey(ex.q) === qk} t={t} onPick={onPick} onToggleFav={onToggleFav} />
          ))
        ) : (
          <p class="empty">{t.emptyFavs}</p>
        )}
      </div>
      <h2 class="side-head">
        <span>{t.examples}</span>
      </h2>
      <div class="list" ref={scroller} role="list" aria-label={t.examples}>
        {rest.map((ex) => (
          <Row key={ex.q} ex={ex} starred={false} active={normKey(ex.q) === qk} t={t} onPick={onPick} onToggleFav={onToggleFav} />
        ))}
        <div class="more" ref={sentinel} role="listitem">
          {t.generating}
        </div>
      </div>
    </aside>
  );
}
