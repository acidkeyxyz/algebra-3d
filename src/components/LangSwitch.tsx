import type { Lang } from '../lib/i18n';

/** ES / EN toggle switch. */
export default function LangSwitch({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  const es = lang === 'es';
  return (
    <button
      type="button"
      class={`lang-switch${es ? '' : ' en'}`}
      role="switch"
      aria-checked={!es}
      aria-label={`${label}: ${es ? 'Español (México)' : 'English (US)'}`}
      title={es ? 'Cambiar a English (US)' : 'Switch to Español (México)'}
      onClick={() => onChange(es ? 'en' : 'es')}
    >
      <span class={`opt${es ? ' on' : ''}`}>🇲🇽 ES</span>
      <span class={`opt${es ? '' : ' on'}`}>🇺🇸 EN</span>
      <span class="knob" aria-hidden="true" />
    </button>
  );
}
