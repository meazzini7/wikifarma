import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SITE_URL } from '@/lib/constants';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

export const revalidate = 43200; // ora che il cron genera 1 articolo/giorno invece di 2, 3h di cache bastano

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const STATIC_ROUTES = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  ...LETTERS.map((l) => ({ path: `encyclopedia/${l}`, priority: 0.7, changeFrequency: 'weekly' })),
  { path: 'wellness', priority: 0.8, changeFrequency: 'daily' },
  { path: 'problems', priority: 0.8, changeFrequency: 'daily' },
  { path: 'tendenza', priority: 0.8, changeFrequency: 'daily' },
  { path: 'diagnosis', priority: 0.7, changeFrequency: 'monthly' },
  { path: 'privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: 'contact', priority: 0.2, changeFrequency: 'yearly' },
];

// Solo i campi che servono (slug, data, esistenza delle traduzioni): la lettura
// con l'SDK client scaricava per ogni articolo l'intero testo e TUTTE le
// traduzioni (decine di MB a ogni rigenerazione della sitemap).
async function loadPostsForSitemap() {
  if (isFirebaseAdminConfigured()) {
    const langs = ['en', 'es', 'fr', 'de'];
    const snap = await getAdminDb()
      .collection('posts')
      .select('slug', 'created_at', 'translations_updated_at', ...langs.map((l) => `translations.${l}.title`))
      .get();
    return snap.docs.map((d) => d.data());
  }
  const snap = await getDocs(collection(db, 'posts'));
  return snap.docs.map((d) => d.data());
}

export default async function sitemap() {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}/${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let postEntries = [];
  let translationEntries = [];
  try {
    const posts = await loadPostsForSitemap();
    postEntries = posts.map((data) => {
      return {
        url: `${SITE_URL}/${data.slug}`,
        lastModified: data.created_at?.toDate?.() || new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      };
    });

    // Only list translations already generated and cached - listing every
    // possible language combination upfront would push Google to crawl (and
    // therefore trigger, since translation happens on first request) many
    // pages at once, risking Gemini rate limits. Cached translations grow
    // in here naturally as real visitors/crawls generate them.
    posts.forEach((data) => {
      if (!data.translations) return;
      Object.keys(data.translations).forEach((lang) => {
        translationEntries.push({
          url: `${SITE_URL}/${lang}/${data.slug}`,
          lastModified: data.translations_updated_at?.toDate?.() || new Date(),
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      });
    });
  } catch {
    // Firestore unreachable at build time - ship the static routes only.
  }

  return [...staticEntries, ...postEntries, ...translationEntries];
}
