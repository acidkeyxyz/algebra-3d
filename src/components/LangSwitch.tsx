import type { Lang } from '../lib/i18n';

/** ES / EN toggle switch. */
export default function LangSwitch({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  const es = lang === 'es';
  return (
    <button
      type="button"
      class={`lang-switch${es ? '' : ' en'}`}
      title={es ? 'Cambiar a English (US)' : 'Switch to Español (México)'}
      onClick={() => onChange(es ? 'en' : 'es')}
    >
      {/* One clear name per state, each in its own language (WCAG 3.1.2). */}
      <span class="sr-only">
        {label}: <span lang={es ? 'es-MX' : 'en-US'}>{es ? 'Español (México)' : 'English (US)'}</span>.{' '}
        <span lang={es ? 'en-US' : 'es-MX'}>{es ? 'Switch to English (US)' : 'Cambiar a Español (México)'}</span>
      </span>
      <span class={`opt${es ? ' on' : ''}`} aria-hidden="true">🇲🇽 ES</span>
      <span class={`opt${es ? '' : ' on'}`} aria-hidden="true">🇺🇸 EN</span>
      <span class="knob" aria-hidden="true" />
    </button>
  );
}
