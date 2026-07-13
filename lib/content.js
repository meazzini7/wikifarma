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

// Strips WordPress Gutenberg block comments (<!-- wp:paragraph -->, etc.)
// left over from the old WordPress-authored posts. Harmless to leave in
// (they're HTML comments) but cleaner to remove.
export function stripGutenbergComments(html) {
  if (!html) return html;
  return html.replace(/<!--\s*\/?wp:[^>]*-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
