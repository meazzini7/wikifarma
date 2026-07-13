// Public read helpers for the "posts" collection. Firestore rules allow
// unauthenticated reads on posts, so the client SDK can be used directly
// from Server Components without a service account.
import {
  addDoc,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const POSTS = 'posts';
const DIAGNOSES = 'diagnoses';
const VISITORS = 'daily_visitors';

function toDoc(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

export async function getPostBySlug(slug) {
  const q = query(collection(db, POSTS), where('slug', '==', slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return toDoc(snap.docs[0]);
}

export async function getPostsByLetter(letter) {
  const start = letter.toUpperCase();
  const end = start + '';
  const q = query(
    collection(db, POSTS),
    where('title', '>=', start),
    where('title', '<', end),
    orderBy('title', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(toDoc);
}

// Firestore requires a composite index for `where(fieldA).orderBy(fieldB)`
// on two different fields. Rather than depend on a manually-created index
// (which needs Firebase console access), fetch by the equality filter alone
// and sort client-side. Fine at our current/expected scale.
async function getSortedByField(filterField, filterValue, max) {
  const q = query(collection(db, POSTS), where(filterField, '==', filterValue), limit(300));
  const snap = await getDocs(q);
  const docs = snap.docs.map(toDoc);
  docs.sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
  return docs.slice(0, max);
}

export function getPostsByType(type, max = 50) {
  return getSortedByField('type', type, max);
}

export function getPostsByCategory(category, max = 50) {
  return getSortedByField('category', category, max);
}

export async function getRecentPosts(max = 9) {
  const q = query(collection(db, POSTS), orderBy('created_at', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(toDoc);
}

export async function getRecommendedPosts(categories, excludeSlugs = new Set(), max = 12) {
  if (!categories || categories.length === 0) {
    const recent = await getRecentPosts(max + excludeSlugs.size);
    return recent.filter((p) => !excludeSlugs.has(p.slug)).slice(0, max);
  }
  const q = query(collection(db, POSTS), where('category', 'in', categories.slice(0, 10)), limit(80));
  const snap = await getDocs(q);
  const docs = snap.docs.map(toDoc).filter((p) => !excludeSlugs.has(p.slug));
  docs.sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
  return docs.slice(0, max);
}

export async function searchPosts(rawQuery, max = 6) {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];
  const qy = query(
    collection(db, POSTS),
    where('title_lower', '>=', q),
    where('title_lower', '<', q + ''),
    orderBy('title_lower', 'asc'),
    limit(max)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data();
    return { slug: data.slug, title: data.title, category: data.category };
  });
}

async function countWhere(field, value) {
  try {
    const q = query(collection(db, POSTS), where(field, '==', value));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    return 0;
  }
}

async function countAll(collectionName) {
  try {
    const snap = await getCountFromServer(collection(db, collectionName));
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function getHomeStats() {
  const [drugs, guides, visitors] = await Promise.all([
    countWhere('type', 'drug'),
    countWhere('type', 'blog'),
    countAll(VISITORS),
  ]);
  return { drugs, guides, visitors };
}

// Diagnoses: written by the client under the user's own authenticated
// session (Firestore rules enforce userEmail === request.auth.token.email),
// so no server-side credential is needed here.
export async function saveDiagnosis({ userEmail, symptoms, response }) {
  await addDoc(collection(db, DIAGNOSES), {
    userEmail,
    symptoms,
    response,
    created_at: serverTimestamp(),
  });
}

export async function getUserDiagnoses(userEmail, max = 10) {
  const q = query(collection(db, DIAGNOSES), where('userEmail', '==', userEmail), limit(100));
  const snap = await getDocs(q);
  const docs = snap.docs.map(toDoc);
  docs.sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
  return docs.slice(0, max);
}
