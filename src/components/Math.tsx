import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'preact/hooks';

export default function MathTex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: block, trust: false, strict: 'ignore' }),
    [tex, block],
  );
  return <span class={block ? 'math block' : 'math'} dangerouslySetInnerHTML={{ __html: html }} />;
}
