import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'preact/hooks';
import { getLang } from '../lib/i18n';
import { speakMath } from '../lib/a11y';

/**
 * A formula. The typeset version is hidden from assistive tech and replaced by a spoken sentence,
 * so every screen reader reads it the same way (MathML support varies a lot).
 */
export default function MathTex({ tex, block = false }: { tex: string; block?: boolean }) {
  const lang = getLang();
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: block, trust: false, strict: 'ignore', output: 'html' }),
    [tex, block],
  );
  const spoken = useMemo(() => speakMath(tex, lang), [tex, lang]);
  return <span class={block ? 'math block' : 'math'} role="img" aria-label={spoken} dangerouslySetInnerHTML={{ __html: html }} />;
}
