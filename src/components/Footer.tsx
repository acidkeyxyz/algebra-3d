import type { Lang } from '../lib/i18n';

const AUTHOR_URL = 'https://github.com/acidkeyxyz';
const REPO_URL = 'https://github.com/acidkeyxyz/algebra-3d';

export default function Footer({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <footer class="site-footer">
      <span>
        {es ? 'Creado por' : 'Created by'}{' '}
        <a href={AUTHOR_URL} target="_blank" rel="noopener">Luis Mendoza</a>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {es ? 'Código abierto (GPL-3.0) en' : 'Open source (GPL-3.0) on'}{' '}
        <a href={REPO_URL} target="_blank" rel="noopener">GitHub</a>
      </span>
    </footer>
  );
}
