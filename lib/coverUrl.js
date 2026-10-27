import { SITE_URL } from './constants';

const isCurated = (url) => /^https:\/\/images\.unsplash\.com\/.*[?&]wf=1(&|$)/.test(String(url || ''));

// URL assoluto per anteprime di condivisione e dati strutturati: la foto
// assegnata all'articolo se c'e', altrimenti il PNG della copertina generata
// (app/api/cover/route.js, basato su lib/cover.js).
export function coverUrl(title, category, imageUrl) {
  if (isCurated(imageUrl)) return imageUrl;
  return `${SITE_URL}/api/cover?t=${encodeURIComponent(String(title || '').slice(0, 140))}&c=${encodeURIComponent(category || '')}`;
}
