// Copertine degli articoli generate dal codice, una diversa per ogni titolo.
//
// Perche': le foto del pool Unsplash si ripetevano su articoli diversi, alcune
// non si caricavano piu' (riquadro con "?") e spesso erano fuori tema (un
// barbiere per l'alluce valgo); le immagini AI sembravano finte. Qui non c'e'
// nessun file esterno: ogni copertina e' un SVG calcolato dal titolo (colori,
// forme e testo derivati da un hash), quindi non si rompe mai, non si ripete
// (titoli diversi => testo e geometria diversi) e riporta il nome dell'articolo.

const W = 1200;
const H = 750;

// Tinta di base per categoria (gradi HSL): farmaci blu/azzurro, benessere verde,
// problemi frequenti ambra/corallo, salute turchese.
const BASE_HUE = { Farmaco: 205, Benessere: 150, 'Problemi Frequenti': 22, Salute: 175 };
const LABEL = { Farmaco: 'FARMACO', Benessere: 'BENESSERE', 'Problemi Frequenti': 'PROBLEMI FREQUENTI', Salute: 'SALUTE' };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// HSL -> #rrggbb (il renderer PNG delle anteprime non capisce hsl()).
function hsl(h, sat, light) {
  const s1 = sat / 100;
  const l = light / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s1 * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// PRNG deterministico (mulberry32): stesso titolo => stessa copertina.
function rng(seed) {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Titolo "pulito" da mostrare: via suffissi tecnici dei cron.
export function displayTitle(title = '') {
  return String(title)
    .replace(/\(\s*Guida\s+\d{4}\s*\)/gi, '')
    .replace(/#\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrap(text, maxChars, maxLines) {
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    if (!cur) cur = word;
    else if ((cur + ' ' + word).length <= maxChars) cur += ` ${word}`;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s.,;:]+$/, '')}…`;
    return kept;
  }
  return lines;
}

// Descrizione pura della copertina: usata sia dall'SVG (<img>) sia dalla route
// PNG per le anteprime di condivisione.
export function coverSpec(title, category) {
  const seed = hash(`${category || ''}|${title || ''}`);
  const rand = rng(seed);
  const base = BASE_HUE[category] ?? BASE_HUE.Benessere;
  const h1 = (base + Math.round((rand() - 0.5) * 50) + 360) % 360;
  const h2 = (h1 + 25 + Math.round(rand() * 40)) % 360;
  const text = displayTitle(title) || 'WikiFarma';
  const size = text.length <= 28 ? 104 : text.length <= 55 ? 84 : 68;
  const lines = wrap(text, Math.floor(1040 / (size * 0.56)), 4);
  const shapes = Array.from({ length: 6 }, () => ({
    cx: Math.round(rand() * W),
    cy: Math.round(rand() * H),
    r: Math.round(70 + rand() * 230),
    o: +(0.07 + rand() * 0.13).toFixed(2),
  }));
  return {
    angle: Math.round(rand() * 360),
    c1: hsl(h1, 62, 34),
    c2: hsl(h2, 58, 22),
    accent: hsl(h2, 80, 78),
    shapes,
    label: LABEL[category] || 'WIKIFARMA',
    category,
    size,
    lines,
  };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Piccolo simbolo per categoria, in alto a destra.
function glyph(category, color) {
  const g = (inner) => `<g transform="translate(940 70)" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">${inner}</g>`;
  if (category === 'Farmaco') {
    return g('<g transform="rotate(-40 90 90)"><rect x="20" y="55" width="140" height="70" rx="35"/><line x1="90" y1="55" x2="90" y2="125"/></g>');
  }
  if (category === 'Problemi Frequenti') {
    return g('<circle cx="90" cy="90" r="70"/><line x1="90" y1="55" x2="90" y2="125"/><line x1="55" y1="90" x2="125" y2="90"/>');
  }
  if (category === 'Salute') {
    return g('<path d="M90 150 C20 100 20 40 62 40 C80 40 90 54 90 62 C90 54 100 40 118 40 C160 40 160 100 90 150 Z"/>');
  }
  return g('<path d="M30 140 C30 60 90 25 160 30 C165 100 130 150 60 150 Z"/><path d="M30 150 C60 110 90 85 125 65"/>');
}

export function coverSvg(title, category) {
  const s = coverSpec(title, category);
  const rad = (s.angle * Math.PI) / 180;
  const x2 = Math.round(50 + 50 * Math.cos(rad));
  const y2 = Math.round(50 + 50 * Math.sin(rad));
  const x1 = 100 - x2;
  const y1 = 100 - y2;
  const circles = s.shapes.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="#fff" opacity="${c.o}"/>`).join('');
  const lineH = Math.round(s.size * 1.12);
  const top = H - 70 - (s.lines.length - 1) * lineH;
  const text = s.lines
    .map((l, i) => `<text x="70" y="${top + i * lineH}" font-size="${s.size}" font-weight="800" fill="#fff" font-family="Inter,Helvetica,Arial,sans-serif">${esc(l)}</text>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><linearGradient id="g" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0" stop-color="${s.c1}"/><stop offset="1" stop-color="${s.c2}"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>${circles}${glyph(s.category, s.accent)}` +
    `<rect x="70" y="68" width="${s.label.length * 17 + 44}" height="48" rx="24" fill="#fff" opacity="0.18"/>` +
    `<text x="92" y="101" font-size="26" font-weight="700" letter-spacing="2" fill="#fff" font-family="Inter,Helvetica,Arial,sans-serif">${esc(s.label)}</text>` +
    `${text}</svg>`
  );
}

// URL da mettere in <img src>: nessuna richiesta di rete, non puo' rompersi.
export function coverDataUri(title, category) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coverSvg(title, category))}`;
}

export const COVER_SIZE = { width: W, height: H };
