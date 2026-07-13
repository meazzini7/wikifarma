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
  } catch {
    // Firestore unreachable at build time - ship the static routes only.
  }

  return [...staticEntries, ...postEntries];
}
