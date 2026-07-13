'use client';

import Link from 'next/link';

const LANGS = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

function setLangCookie(code) {
  document.cookie = `wf_lang=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function LanguageSwitcher({ current, slug }) {
  return (
    <div className="lang-switcher">
      {LANGS.map((l, i) => {
        const isCurrent = l.code === current;
        const href = l.code === 'it' ? `/${slug}` : `/${l.code}/${slug}`;
        return (
          <span key={l.code}>
            {i > 0 && <span className="lang-sep">·</span>}
            {isCurrent ? (
              <span className="lang-current">{l.label}</span>
            ) : (
              <Link href={href} className="lang-link" onClick={() => setLangCookie(l.code)}>
                {l.label}
              </Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
