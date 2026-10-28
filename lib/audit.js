// Controllo e riparazione degli articoli gia' pubblicati. Funzioni pure (nessun
// I/O): auditPost trova i difetti e, quando la correzione e' sicura e
// automatica, restituisce i campi corretti; i difetti che richiedono una nuova
// generazione (testo vuoto o troncato) sono segnalati con "regen".
import { cleanGeneratedContent } from './cleanContent';
import { stripGeneratedImages, stripGutenbergComments } from './content';
import { normalizeArticleHtml } from './formatContent';

// Sequenze tipiche di testo UTF-8 letto come Windows-1252 (migrazione dal vecchio sito).
const MOJIBAKE = [
  ['Ã ', 'à'], ['Ã¨', 'è'], ['Ã©', 'é'], ['Ã¬', 'ì'], ['Ã²', 'ò'], ['Ã¹', 'ù'],
  ['Ã€', 'À'], ['Ã‰', 'É'], ['Ãˆ', 'È'], ['Ã’', 'Ò'], ['Ã™', 'Ù'],
  ['â€™', '’'], ['â€˜', '‘'], ['â€œ', '“'], ['â€\u009d', '”'], ['â€“', '–'], ['â€”', '—'], ['â€¦', '…'],
  ['Â°', '°'], ['Â ', ' '], ['Â«', '«'], ['Â»', '»'],
];
const MOJIBAKE_RE = /Ã[\u0080-¿€‰ˆ’™ ]|â€|Â[ -¿]/;

export function fixMojibake(text = '') {
  let t = String(text);
  for (const [bad, good] of MOJIBAKE) t = t.split(bad).join(good);
  return t;
}

const textOf = (html = '') => String(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const count = (s, re) => (s.match(re) || []).length;

export const SEVERITY = { fix: 'fix', regen: 'regen', manual: 'manual' };

// -> { issues: [{code, kind, msg}], patch: {campo: nuovo valore} }
export function auditPost(p) {
  const issues = [];
  const patch = {};
  const add = (code, kind, msg) => issues.push({ code, kind, msg });

  if (!p.title || !String(p.title).trim()) add('no_title', 'manual', 'Titolo mancante.');
  if (!p.slug) add('no_slug', 'manual', 'Slug mancante: la pagina non e\' raggiungibile.');
  if (!p.created_at) add('no_date', 'manual', 'Data di creazione mancante.');

  // categoria / tipo coerenti
  if (!p.category) {
    patch.category = p.type === 'drug' ? 'Farmaco' : 'Benessere';
    add('no_category', 'fix', `Categoria mancante: impostata a ${patch.category}.`);
  }
  if (!p.type && (p.category || patch.category)) {
    patch.type = (p.category || patch.category) === 'Farmaco' ? 'drug' : 'blog';
    add('no_type', 'fix', 'Tipo mancante.');
  }

  // titolo con residui tecnici dei cron
  if (p.title) {
    const cleaned = String(p.title).replace(/\s*#\d{3,6}\s*$/g, '').replace(/(\(Guida \d{4}\))(\s*\1)+/gi, '$1').replace(/\s+/g, ' ').trim();
    if (cleaned && cleaned !== p.title) {
      patch.title = cleaned;
      patch.title_lower = cleaned.toLowerCase();
      add('title_junk', 'fix', 'Titolo con numero tecnico o ripetizioni: ripulito.');
    }
  }

  let content = String(p.content || '');
  let next = content;
  if (/<!doctype|<\/?(html|head|body)\b|```/i.test(next)) {
    next = cleanGeneratedContent(next);
    add('raw_html', 'fix', 'Documento HTML grezzo / blocco di codice nel testo.');
  } else if (/<h1[\s>]/i.test(next)) {
    next = cleanGeneratedContent(next);
    add('h1', 'fix', 'Titolo <h1> dentro l\'articolo (duplica quello della pagina).');
  } else if (next.trim() && !next.trim().startsWith('<')) {
    // Solo una breve frase tipo "Certo! Ecco l'articolo..." prima del primo tag:
    // testo piu' lungo e' contenuto vero (es. articoli migrati) e non si tocca.
    const first = next.search(/<[a-z]/i);
    const lead = first > 0 ? next.slice(0, first).trim() : '';
    if (lead && lead.length < 250 && /^(certo|ecco|ok\b|va bene|sure|here|assolutamente|perfetto)/i.test(lead)) {
      next = next.slice(first);
      add('preamble', 'fix', 'Frase introduttiva dell\'AI prima dell\'articolo.');
    }
  }
  if (/<!--\s*\/?wp:/i.test(next)) {
    next = stripGutenbergComments(next);
    add('gutenberg', 'fix', 'Commenti del vecchio editor WordPress nel testo.');
  }
  if (/pollinations\.ai/i.test(next)) {
    next = stripGeneratedImages(next);
    add('ai_inline_img', 'fix', 'Immagine AI dentro il testo rimossa.');
  }
  if (MOJIBAKE_RE.test(next) || (p.title && MOJIBAKE_RE.test(p.title))) {
    const fixedText = fixMojibake(next);
    const fixedTitle = p.title ? fixMojibake(patch.title || p.title) : p.title;
    if (fixedText !== next) next = fixedText;
    if (fixedTitle && fixedTitle !== (patch.title || p.title)) {
      patch.title = fixedTitle;
      patch.title_lower = fixedTitle.toLowerCase();
    }
    if (MOJIBAKE_RE.test(next)) add('mojibake', 'manual', 'Caratteri accentati rovinati non tutti riparabili.');
    else add('mojibake', 'fix', 'Caratteri accentati rovinati riparati.');
  }
  // Testo in markdown/senza paragrafi (asterischi visibili, tutto in un blocco).
  const formatted = normalizeArticleHtml(next);
  if (formatted.replace(/\s+/g, '') !== next.replace(/\s+/g, '')) {
    next = formatted;
    add('markdown', 'fix', 'Testo senza paragrafi/elenchi (asterischi e a-capo grezzi): formattato.');
  }
  if (next !== content) patch.content = next.trim();

  // Controlli sul testo gia' ripulito: vuoto/corto/troncato richiedono una riscrittura.
  const rawLen = textOf(next).length;
  if (rawLen < 500) {
    add(rawLen === 0 ? 'empty_content' : 'short_content', 'regen', rawLen === 0 ? 'Testo vuoto.' : `Testo troppo corto (${rawLen} caratteri).`);
  } else {
    // troncato: finisce a meta' frase, senza chiudere l'ultimo tag
    const tail = next.trim();
    if (!tail.endsWith('>') && !/[.!?»"')]$/.test(tail)) add('truncated', 'regen', 'Il testo finisce a meta\' (interrotto).');
  }

  // immagine: i vecchi URL (AI o foto di stock ripetute) non servono piu'; la
  // copertina e' sempre garantita, la foto Unsplash viene assegnata a parte.
  if (/pollinations\.ai/i.test(String(p.image_url || ''))) {
    patch.image_url = null;
    add('ai_cover', 'fix', 'Copertina generata dall\'AI rimossa.');
  }
  if (!p.photo?.id) add('no_photo', 'photo', 'Nessuna foto Unsplash assegnata.');

  // struttura HTML sbilanciata (solo segnalazione)
  const body = patch.content ?? content;
  if (count(body, /<p[\s>]/gi) !== count(body, /<\/p>/gi) || count(body, /<ul[\s>]/gi) !== count(body, /<\/ul>/gi)) {
    add('unbalanced', 'manual', 'Tag HTML non bilanciati (paragrafi o elenchi non chiusi).');
  }

  return { issues, patch };
}

// Doppioni di titolo (dopo la pulizia): [{title, slugs: [...]}]
export function findDuplicates(posts) {
  const by = new Map();
  posts.forEach((p) => {
    const key = String(p.title || '').replace(/\s*#\d{3,6}\s*$/g, '').replace(/\(Guida \d{4}\)/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key) return;
    by.set(key, [...(by.get(key) || []), p.slug]);
  });
  return [...by.entries()].filter(([, s]) => s.length > 1).map(([title, slugs]) => ({ title, slugs }));
}

export function summarize(results) {
  const byCode = {};
  results.forEach((r) => r.issues.forEach((i) => {
    byCode[i.code] = byCode[i.code] || { code: i.code, kind: i.kind, count: 0, msg: i.msg };
    byCode[i.code].count += 1;
  }));
  return Object.values(byCode).sort((a, b) => b.count - a.count);
}
