// Places the inline image after the paragraph closest to the midpoint of
// the article (by character offset), so it sits between two chunks of
// actual body text - never right under a heading with no text yet, which
// is what made the cover image and this one look stacked back-to-back.
// If the content is too short to have real text on both sides, skip the
// inline image entirely rather than place it awkwardly.
export function insertInlineImage(html, imgUrl, altText, fallbackUrl) {
  if (!html || !imgUrl) return html;
  const onError = fallbackUrl
    ? ` onerror="this.onerror=null;this.src='${fallbackUrl}'"`
    : '';
  const imgTag = `<img src="${imgUrl}" alt="${altText}" loading="lazy" class="article-inline-img"${onError} />`;

  const paragraphCloses = [...html.matchAll(/<\/p>/gi)];
  if (paragraphCloses.length === 0) return html;

  const target = html.length / 2;
  let best = paragraphCloses[0];
  let bestDistance = Infinity;
  for (const m of paragraphCloses) {
    const distance = Math.abs(m.index + m[0].length - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = m;
    }
  }

  const insertAt = best.index + best[0].length;
  if (insertAt < 200 || html.length - insertAt < 200) return html;

  return html.slice(0, insertAt) + imgTag + html.slice(insertAt);
}

// Toglie dal testo le immagini generate da servizi AI (pollinations.ai) inserite
// a meta' degli articoli piu' vecchi, insieme all'eventuale <p>/<figure> che le
// contiene. Si applica al momento della visualizzazione.
export function stripGeneratedImages(html = '') {
  return String(html)
    .replace(/<(p|figure)[^>]*>\s*<img[^>]*pollinations\.ai[^>]*>\s*<\/\1>/gi, '')
    .replace(/<img[^>]*pollinations\.ai[^>]*>/gi, '');
}

export function readingMinutes(html = '', wordsPerMinute = 200) {
  const words = String(html).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Inserisce un collegamento "Leggi anche" a circa due terzi dell'articolo, tra
// due paragrafi: il lettore lo incontra mentre sta ancora leggendo, invece di
// dover arrivare in fondo alla pagina. Si tiene a distanza dall'immagine
// inline e salta del tutto se il testo e' troppo corto per ospitarlo bene.
export function insertReadAlso(html, item, label = 'Leggi anche') {
  if (!html || !item?.href || !item?.title) return html;
  const closes = [...html.matchAll(/<\/p>/gi)];
  if (closes.length === 0) return html;

  const imgAt = html.search(/<img[^>]*article-inline-img/i);
  const target = html.length * 0.68;
  let best = null;
  let bestDistance = Infinity;
  for (const m of closes) {
    const at = m.index + m[0].length;
    if (at < 300 || html.length - at < 200) continue;
    if (imgAt !== -1 && Math.abs(at - imgAt) < 500) continue;
    const distance = Math.abs(at - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = at;
    }
  }
  if (best === null) return html;

  const box =
    `<aside class="read-also"><span class="read-also-label">${escapeHtml(label)}</span>` +
    `<a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></aside>`;
  return html.slice(0, best) + box + html.slice(best);
}

// Strips WordPress Gutenberg block comments (<!-- wp:paragraph -->, etc.)
// left over from the old WordPress-authored posts. Harmless to leave in
// (they're HTML comments) but cleaner to remove.
export function stripGutenbergComments(html) {
  if (!html) return html;
  return html.replace(/<!--\s*\/?wp:[^>]*-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
