const FIRST_CONTENT_TAG_RE = /<(h1|h2|h3|h4|p|ul|ol|div|table)[ >]/i;

// Gemini doesn't always follow the "start immediately with <h2>" instruction:
// sometimes it wraps the article in a full HTML document (<!DOCTYPE>, <head>,
// <body>...), sometimes it adds a conversational preamble ("Certo! Ecco la
// guida..."), sometimes both. This normalizes any of those into a clean
// content fragment ready to drop into the article body.
export function cleanGeneratedContent(text) {
  if (!text) return '';
  let t = text;

  // Strip markdown code fences in any form (```html, ```, ```HTML, etc.)
  t = t.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');

  const bodyMatch = t.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    t = bodyMatch[1];
  } else {
    t = t.replace(/<!DOCTYPE[^>]*>/gi, '');
    t = t.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    t = t.replace(/<\/?html[^>]*>/gi, '');
    t = t.replace(/<\/?body[^>]*>/gi, '');
  }

  const firstTag = t.match(FIRST_CONTENT_TAG_RE);
  if (firstTag) {
    t = t.slice(firstTag.index);
  }

  // A stray <h1> inside the article body would duplicate the page's own
  // <h1> (the post title, rendered separately) - demote to <h2>.
  t = t.replace(/<h1(\s[^>]*)?>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>');

  return t.trim();
}
