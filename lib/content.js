export function insertInlineImage(html, imgUrl, altText) {
  if (!html || !imgUrl) return html;
  const imgTag = `<img src="${imgUrl}" alt="${altText}" loading="lazy" style="width:100%;border-radius:12px;margin:24px 0;" />`;
  const headingCloses = [...html.matchAll(/<\/h2>/gi)];

  if (headingCloses.length >= 2) {
    const at = headingCloses[1].index + headingCloses[1][0].length;
    return html.slice(0, at) + imgTag + html.slice(at);
  }
  if (headingCloses.length === 1) {
    const at = headingCloses[0].index + headingCloses[0][0].length;
    return html.slice(0, at) + imgTag + html.slice(at);
  }
  return imgTag + html;
}

// Strips WordPress Gutenberg block comments (<!-- wp:paragraph -->, etc.)
// left over from the old WordPress-authored posts. Harmless to leave in
// (they're HTML comments) but cleaner to remove.
export function stripGutenbergComments(html) {
  if (!html) return html;
  return html.replace(/<!--\s*\/?wp:[^>]*-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
