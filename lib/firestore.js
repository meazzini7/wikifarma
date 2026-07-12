// Public read helpers for the "posts" collection. Firestore rules allow
// unauthenticated reads on posts, so the client SDK can be used directly
// from Server Components without a service account.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';

const POSTS = 'posts';

function toPost(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

export async function getPostBySlug(slug) {
  const q = query(collection(db, POSTS), where('slug', '==', slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return toPost(snap.docs[0]);
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
  return snap.docs.map(toPost);
}

export async function getPostsByType(type, max = 50) {
  const q = query(
    collection(db, POSTS),
    where('type', '==', type),
    orderBy('created_at', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(toPost);
}

export async function getPostsByCategory(category, max = 50) {
  const q = query(
    collection(db, POSTS),
    where('category', '==', category),
    orderBy('created_at', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(toPost);
}

export async function getRecentPosts(max = 9) {
  const q = query(collection(db, POSTS), orderBy('created_at', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(toPost);
}
