import { NextResponse } from 'next/server';

const SUPPORTED_LANGS = ['en', 'es', 'fr', 'de'];

// Top-level single-segment paths that are never article slugs - never
// redirect these regardless of browser language.
const RESERVED_PATHS = new Set([
  'encyclopedia', 'wellness', 'problems', 'diagnosis', 'profile', 'per-te',
  'admin', 'privacy', 'contact', 'ads.txt', 'sitemap.xml', 'robots.txt',
  'icon.svg', 'favicon.ico',
  ...SUPPORTED_LANGS,
]);

const BOT_UA_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|preview/i;

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);

  // Only single-segment paths look like Italian article slugs at the root.
  if (segments.length !== 1) return NextResponse.next();

  const slug = segments[0];
  if (RESERVED_PATHS.has(slug)) return NextResponse.next();

  // Never redirect crawlers/bots - they must always see the canonical
  // Italian page directly; language variants are discovered via hreflang.
  const userAgent = request.headers.get('user-agent') || '';
  if (BOT_UA_RE.test(userAgent)) return NextResponse.next();

  // Respect a previously stored choice (including "stay in Italian") so we
  // only ever redirect once per browser, not on every visit.
  if (request.cookies.get('wf_lang')) return NextResponse.next();

  const acceptLanguage = (request.headers.get('accept-language') || '').toLowerCase();
  const preferred = SUPPORTED_LANGS.find((lang) => acceptLanguage.includes(lang));
  if (!preferred) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}/${slug}`;
  const response = NextResponse.redirect(url);
  response.cookies.set('wf_lang', preferred, { maxAge: 60 * 60 * 24 * 365, path: '/' });
  return response;
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
