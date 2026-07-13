import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 3600; // regenerate at most once an hour

const STATIC_ROUTES = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: 'encyclopedia', priority: 0.9, changeFrequency: 'daily' },
  { path: 'wellness', priority: 0.8, changeFrequency: 'daily' },
  { path: 'problems', priority: 0.8, changeFrequency: 'daily' },
  { path: 'diagnosis', priority: 0.7, changeFrequency: 'monthly' },
  { path: 'privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: 'contact', priority: 0.2, changeFrequency: 'yearly' },
];

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
    const snap = await getDocs(collection(db, 'posts'));
    postEntries = snap.docs.map((doc) => {
      const data = doc.data();
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
    snap.docs.forEach((doc) => {
      const data = doc.data();
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
