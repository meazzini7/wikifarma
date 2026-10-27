import { SITE_URL } from './constants';

// URL assoluto (PNG) della copertina per anteprime di condivisione e dati
// strutturati: servito da app/api/cover/route.js, che usa lib/cover.js.
export function coverUrl(title, category) {
  return `${SITE_URL}/api/cover?t=${encodeURIComponent(String(title || '').slice(0, 140))}&c=${encodeURIComponent(category || '')}`;
}
