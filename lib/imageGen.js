// Cover + inline image URL builder for generated articles.
//
// Cover images are generated per-title via pollinations.ai with a
// deterministic seed, so every distinct article gets a distinct image
// (this used to instead match a small set of ~5-20 curated Unsplash photos
// by keyword, which meant dozens of articles sharing the exact same
// picture - e.g. every "Oki"/"Aulin"/"Nimesulide" article got one single
// photo). Those curated photos are kept as a *pool*, used only as a
// reliable fallback when the generated image fails to load, and the
// specific pool member is chosen by hashing the article title so that
// even simultaneous failures across articles don't all show one identical
// fallback image either.
//
// The pollinations.ai prompt itself is derived by Gemini from the article
// title rather than by directly concatenating the raw Italian title into a
// generic English template: titles often carry noise the old cron scripts
// added (e.g. "(Guida 2026)" suffixes, "La verita' su..." prefixes) and
// text-to-image models respond far better to a clean, specific English
// description of the actual subject than to raw Italian text glued onto a
// template. If the AI call fails or returns something unusable, we fall
// back to the previous raw-title template so image generation never blocks
// article generation.

import { callGemini, isGeminiConfigured } from './gemini';

const DRUG_POOL = [
  'https://images.unsplash.com/photo-1626968361222-dc3620583191?w=800&q=80',
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
  'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=800&q=80',
  'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80',
  'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80',
  'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80',
];

const WELLNESS_POOL = [
  'https://images.unsplash.com/photo-1615485290382-441e4d04fcad?w=800&q=80',
  'https://images.unsplash.com/photo-1615485500704-8e99099928b3?w=800&q=80',
  'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80',
  'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80',
  'https://images.unsplash.com/photo-1615477021379-38708c02c086?w=800&q=80',
  'https://images.unsplash.com/photo-1552014763-952402434524?w=800&q=80',
  'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=800&q=80',
  'https://images.unsplash.com/photo-1511381971705-4bfe24d86922?w=800&q=80',
  'https://images.unsplash.com/photo-1523049673856-38240640c525?w=800&q=80',
  'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=800&q=80',
  'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80',
  'https://images.unsplash.com/photo-1571771896612-418b9503a341?w=800&q=80',
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80',
  'https://images.unsplash.com/photo-1520206183501-b80df61043c2?w=800&q=80',
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80',
  'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&q=80',
  'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80',
  'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80',
  'https://images.unsplash.com/photo-1544367563-12123d8965cd?w=800&q=80',
  'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80',
  'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80',
];

const PROBLEMS_POOL = [
  'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800&q=80',
  'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80',
  'https://images.unsplash.com/photo-1556760544-74068565f05c?w=800&q=80',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=80',
  'https://images.unsplash.com/photo-1527137342181-19aab11a8ee8?w=800&q=80',
  'https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?w=800&q=80',
  'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=800&q=80',
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&q=80',
];

function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pollinationsUrl(promptText, seed) {
  const encoded = encodeURIComponent(`${promptText}, photorealistic, 4k, bright lighting`);
  return `https://image.pollinations.ai/prompt/${encoded}?width=800&height=500&nologo=true&seed=${seed % 9999}`;
}

function poolFor(category) {
  if (category === 'Farmaco') return DRUG_POOL;
  if (category === 'Problemi Frequenti') return PROBLEMS_POOL;
  return WELLNESS_POOL;
}

// Deterministic per-title pick from the reliable pool - same title always
// gets the same fallback, different titles spread across the whole pool.
export function getFallbackForTitle(title, category) {
  const pool = poolFor(category);
  const idx = seedFromString(title || '') % pool.length;
  return pool[idx];
}

function templatePrompts(title, category) {
  let coverPrompt;
  let inlinePrompt;
  if (category === 'Farmaco') {
    coverPrompt = `${title} medicine box packaging white background studio product photography`;
    inlinePrompt = `${title} medicine pack close up detail`;
  } else if (category === 'Problemi Frequenti') {
    coverPrompt = `${title} medical clinic doctor consultation`;
    inlinePrompt = `${title} medical consultation healthcare closeup`;
  } else {
    coverPrompt = `${title} wellness healthy lifestyle nature`;
    inlinePrompt = `${title} healthy lifestyle wellness closeup`;
  }
  return { coverPrompt, inlinePrompt };
}

// Asks Gemini to turn a (possibly noisy, Italian) article title into two
// distinct, specific, English photo-prompt descriptions. Returns null on
// any failure so the caller can fall back to templatePrompts().
async function getAIImagePrompts(title, category) {
  if (!isGeminiConfigured()) return null;

  const categoryHint =
    category === 'Farmaco'
      ? 'a medicine/drug product photo'
      : category === 'Problemi Frequenti'
        ? 'a healthcare/medical consultation scene'
        : 'a wellness/healthy-lifestyle scene';

  const prompt = `Titolo articolo (italiano, puo' contenere prefissi/suffissi non rilevanti come "Guida 2026" o "La verita' su"): "${title}"
Categoria: ${category}

Individua il vero soggetto specifico dell'articolo (es. il farmaco, la condizione medica, l'attivita' o alimento). Poi scrivi due prompt in INGLESE per un generatore di immagini fotorealistiche, entrambi su ${categoryHint}, che rappresentino chiaramente e specificamente quel soggetto (non generici). Il secondo prompt deve mostrare un dettaglio/inquadratura diversa dal primo.

Rispondi SOLO con un oggetto JSON valido, senza markdown, in questo formato esatto:
{"cover":"...","inline":"..."}`;

  try {
    const raw = await callGemini(prompt);
    if (!raw) return null;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.cover !== 'string' || typeof parsed.inline !== 'string') return null;
    if (!parsed.cover.trim() || !parsed.inline.trim()) return null;
    return { coverPrompt: parsed.cover.trim(), inlinePrompt: parsed.inline.trim() };
  } catch {
    return null;
  }
}

export async function buildArticleImages(title, category) {
  const seed = seedFromString(title);
  const fallback = getFallbackForTitle(title, category);

  const aiPrompts = await getAIImagePrompts(title, category);
  const { coverPrompt, inlinePrompt } = aiPrompts || templatePrompts(title, category);

  const cover = pollinationsUrl(coverPrompt, seed);
  const inline = pollinationsUrl(inlinePrompt, seed + 1);
  return { cover, inline, fallback };
}
