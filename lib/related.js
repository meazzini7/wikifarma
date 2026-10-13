// Articoli correlati PERTINENTI e "piu' letti", per tenere il lettore sul sito.
//
// Prima i correlati erano "stessa categoria, i piu' recenti": chi leggeva i
// costi di una corona dentale riceveva l'ultimo articolo capitato. Ora si
// classifica ogni candidato per somiglianza (tema, stile del titolo, parole in
// comune, categoria) con un piccolo bonus di popolarita' (visite GA4 degli
// ultimi 28 giorni). Funziona anche per le versioni tradotte, che prima non
// avevano nessun correlato: erano un vicolo cieco proprio per il traffico estero.
//
// Costo: l'elenco dei candidati e i piu' letti stanno nella Data Cache di
// Next per 6 ore, quindi le pagine (rigenerate ogni 2h) non rileggono mai
// centinaia di articoli. Senza Firebase Admin o in caso di errore si ritorna
// null e la pagina usa i correlati classici.
import { unstable_cache } from 'next/cache';
import { getAdminDb, isFirebaseAdminConfigured } from './firebaseAdmin';
import { classifyTopic, titleStyleOf } from './performance';
import { SCHEMA_VERSION } from './insightsSchema';

const LANGS = ['en', 'es', 'fr', 'de'];
const CACHE_SECONDS = 6 * 3600;

function norm(s = '') {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokens(s) {
  return new Set(
    norm(s)
      .replace(/\(.*?\)/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter += 1;
  });
  return inter / (a.size + b.size - inter);
}

const snippetOf = (html = '') => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

const loadCandidates = unstable_cache(
  async () => {
    const snap = await getAdminDb()
      .collection('posts')
      .select('title', 'slug', 'category', 'image_url', 'created_at', 'content', ...LANGS.map((l) => `translations.${l}.title`))
      .get();
    return snap.docs
      .map((d) => {
        const x = d.data();
        if (!x.slug || !x.title) return null;
        return {
          slug: x.slug,
          title: x.title,
          category: x.category || '',
          image_url: x.image_url || null,
          created_at: x.created_at?.toMillis?.() || 0,
          theme: classifyTopic(x.title, snippetOf(x.content), x.category).id,
          style: titleStyleOf(x.title).id,
          tokens: [...tokens(x.title)],
          tr: Object.fromEntries(LANGS.filter((l) => x.translations?.[l]?.title).map((l) => [l, x.translations[l].title])),
        };
      })
      .filter(Boolean);
  },
  ['related-candidates-v1'],
  { revalidate: CACHE_SECONDS }
);

const loadPopular = unstable_cache(
  async () => {
    const snap = await getAdminDb().collection('analytics').doc('insights').get();
    if (!snap.exists || snap.data().schemaVersion !== SCHEMA_VERSION) return [];
    return JSON.parse(snap.data().report_json).popular || [];
  },
  ['related-popular-v1'],
  { revalidate: CACHE_SECONDS }
);

function toItem(c, lang) {
  return {
    slug: c.slug,
    title: lang === 'it' ? c.title : c.tr[lang],
    category: c.category,
    image_url: c.image_url,
    href: lang === 'it' ? `/${c.slug}` : `/${lang}/${c.slug}`,
  };
}

// Pura: nessun I/O, testabile con candidati simulati.
export function rankRelated(post, candidates, { lang = 'it', popularViews = {}, limit = 5 } = {}) {
  const self = candidates.find((c) => c.slug === post.slug);
  const cur = self || {
    theme: classifyTopic(post.title, '', post.category).id,
    style: titleStyleOf(post.title).id,
    tokens: [...tokens(post.title)],
  };
  const curTokens = new Set(cur.tokens);

  return candidates
    .filter((c) => c.slug !== post.slug && (lang === 'it' || c.tr?.[lang]))
    .map((c) => ({
      c,
      score:
        (c.theme === cur.theme ? 3 : 0) +
        (c.category === post.category ? 1.5 : 0) +
        (c.style === cur.style ? 1 : 0) +
        4 * jaccard(curTokens, new Set(c.tokens)) +
        Math.min(2, Math.log10(1 + (popularViews[c.slug] || 0))),
    }))
    .sort((a, b) => b.score - a.score || b.c.created_at - a.c.created_at)
    .slice(0, limit)
    .map(({ c }) => toItem(c, lang));
}

// { related, popular } oppure null (=> la pagina ripiega sui correlati classici).
export async function getRelated(post, { lang = 'it', limit = 5, popularLimit = 5 } = {}) {
  if (!isFirebaseAdminConfigured()) return null;
  try {
    const [candidates, popularRaw] = await Promise.all([loadCandidates(), loadPopular()]);
    const popularViews = Object.fromEntries(popularRaw.map((p) => [p.slug, p.views]));
    const related = rankRelated(post, candidates, { lang, popularViews, limit });
    const shown = new Set([post.slug, ...related.map((r) => r.slug)]);
    const bySlug = new Map(candidates.map((c) => [c.slug, c]));
    const popular = popularRaw
      .filter((p) => !shown.has(p.slug))
      .map((p) => bySlug.get(p.slug))
      .filter((c) => c && (lang === 'it' || c.tr?.[lang]))
      .slice(0, popularLimit)
      .map((c) => toItem(c, lang));
    return { related, popular };
  } catch (err) {
    console.error('related: uso i correlati classici:', err);
    return null;
  }
}

// Per la home: i piu' letti degli ultimi 28 giorni (solo italiano).
export async function getPopularItems(limit = 6) {
  if (!isFirebaseAdminConfigured()) return [];
  try {
    const [candidates, popularRaw] = await Promise.all([loadCandidates(), loadPopular()]);
    const bySlug = new Map(candidates.map((c) => [c.slug, c]));
    return popularRaw
      .map((p) => bySlug.get(p.slug))
      .filter(Boolean)
      .slice(0, limit)
      .map((c) => toItem(c, 'it'));
  } catch (err) {
    console.error('related: piu\' letti non disponibili:', err);
    return [];
  }
}
