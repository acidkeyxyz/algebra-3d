// @vitest-environment jsdom
// Automated accessibility audit: renders the real UI in jsdom and runs axe-core (WCAG 2.0–2.2 A/AA + best practice).
// jsdom has no layout, so colour-contrast is excluded here (contrast is a design-token rule, see CLAUDE.md) and the
// 3D renderer is stubbed. Everything else axe checks (names, roles, ARIA, landmarks, headings, lists, focus) is real.
import axe from 'axe-core';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/three/Stage', () => ({
  Stage: class {
    setInset() {}
    setView() {}
    preset() {}
    setAutoRotate() {}
    dispose() {}
  },
}));

import App from '../src/components/App';
import ExampleList from '../src/components/ExampleList';
import HelpModal from '../src/components/HelpModal';
import Learn from '../src/components/Learn';
import { UI, type Lang } from '../src/lib/i18n';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
let root: HTMLElement;

beforeAll(() => {
  const w = window as unknown as Record<string, unknown>;
  w.matchMedia ??= (q: string) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  const Obs = class { observe() {} disconnect() {} unobserve() {} };
  w.IntersectionObserver = Obs;
  w.ResizeObserver = Obs;
  // index.astro provides these in the real page.
  document.title = 'Álgebra 3D';
  document.documentElement.lang = 'es-MX';
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  render(null, root);
  root?.remove();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

function mount(ui: preact.VNode, url = '/'): HTMLElement {
  history.replaceState(null, '', url);
  root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(ui, root));
  return root;
}

async function audit() {
  const r = await axe.run(document, { rules: { 'color-contrast': { enabled: false } }, runOnly: { type: 'tag', values: TAGS } });
  const msg = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.map((n) => n.target.join(' ')).join('\n   ')}`).join('\n');
  expect(r.violations, msg).toEqual([]);
}

const click = (sel: string) => act(() => (document.querySelector(sel) as HTMLElement).click());

for (const lang of ['es', 'en'] as Lang[]) {
  describe(`axe (${lang})`, () => {
    it('Learn: age picker, home, a round, feedback and the result', async () => {
      mount(<Learn lang={lang} onLang={() => {}} onSolver={() => {}} />, '/?test=true');
      await audit(); // welcome
      click('.ln-age');
      await audit(); // home
      click('.ln-level:not([aria-disabled="true"])');
      await audit(); // question
      // answer everything wrong until the result screen shows
      for (let i = 0; i < 14 && !document.querySelector('.ln-result'); i++) {
        if (document.querySelector('.ln-choice')) click('.ln-choice');
        else {
          click('.ln-keypad .k');
          click('.ln-ok');
        }
        if (i === 0) await audit(); // feedback
        const next = document.querySelector('.ln-fb-actions .primary');
        if (next) act(() => (next as HTMLElement).click());
      }
      expect(document.querySelector('.ln-result')).not.toBeNull();
      await audit(); // result
    });

    it('Solver: first and later steps, and with the help dialog open', async () => {
      mount(<App />, `/?q=${encodeURIComponent('x^2 - 5x + 6 = 0')}&lang=${lang}`);
      await audit();
      click('.arrow:last-of-type');
      await audit();
      click('.help-btn');
      await audit();
    });

    it('Solver: an unreadable equation shows an accessible error', async () => {
      mount(<App />, `/?q=${encodeURIComponent('2x +* 3')}&lang=${lang}`);
      expect(document.querySelector('[role="alert"]')).not.toBeNull();
      await audit();
    });

    it('Example list and help guide', async () => {
      mount(<ExampleList curated={[{ q: '2x + 3 = 7', level: 'Balance' }]} favs={[]} query="2x + 3 = 7" t={UI[lang]} onPick={() => {}} onToggleFav={() => {}} />);
      await audit();
      render(null, root);
      act(() => render(<HelpModal lang={lang} onClose={() => {}} onTry={() => {}} />, root));
      await audit();
    });
  });
}
