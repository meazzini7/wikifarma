// Normalizza il corpo di un articolo in HTML pulito.
//
// Perche': Gemini spesso mette <h2> per i titoli ma poi scrive il resto in
// markdown/testo semplice ("*   **Voce:** testo", righe separate da a-capo,
// nessun <p> o <ul>). Nel browser gli a-capo collassano e restano asterischi
// visibili, con tutto il testo in un unico blocco. Qui il testo "sciolto" tra
// i blocchi HTML diventa <p>/<ul>/<ol> e il grassetto/corsivo markdown diventa
// <strong>/<em>. Idempotente: su HTML gia' corretto non cambia nulla.
const BLOCK_RE = /<(\/?)(h[1-6]|p|ul|ol|div|table|blockquote|aside|figure|section|details)\b[^>]*>/gi;

function inline(s) {
  return s
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(>])\*(?!\s)([^*\n]+?)(?<!\s)\*(?=[\s).,;:!?<]|$)/g, '$1<em>$2</em>');
}

const BULLET = /^\s*(?:[*\-•–]|•)\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

// Testo sciolto -> blocchi HTML.
function looseToHtml(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  let list = null; // { tag, items }
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushPara();
      flushList();
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      const level = Math.min(h[1].length, 3);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    const b = raw.match(BULLET);
    const n = !b && raw.match(NUMBERED);
    if (b || n) {
      flushPara();
      const tag = b ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list = list || { tag, items: [] };
      list.items.push((b || n)[1].trim());
      continue;
    }
    // riga di continuazione di una voce di elenco (indentata)
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join('');
}

export function normalizeArticleHtml(html) {
  if (!html) return html;
  const src = String(html);
  const parts = [];
  let last = 0;
  let depth = 0;
  let start = 0;
  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(src))) {
    const closing = m[1] === '/';
    if (depth === 0) {
      if (closing) continue; // chiusura orfana: la lasciamo com'e'
      if (m.index > last) parts.push({ loose: src.slice(last, m.index) });
      start = m.index;
      depth = 1;
    } else {
      depth += closing ? -1 : 1;
      if (depth === 0) {
        parts.push({ html: src.slice(start, m.index + m[0].length) });
        last = m.index + m[0].length;
      }
    }
  }
  if (depth > 0) parts.push({ html: src.slice(start) });
  else if (last < src.length) parts.push({ loose: src.slice(last) });

  return parts
    .map((p) => {
      if (p.html !== undefined) return p.html.replace(/\*\*([^*\n<]+?)\*\*/g, '<strong>$1</strong>');
      return p.loose.trim() ? looseToHtml(p.loose) : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}
