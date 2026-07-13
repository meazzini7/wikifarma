import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

function favId(userEmail, postId) {
  return `${userEmail}_${postId}`;
}

export async function isFavorited(userEmail, postId) {
  if (!userEmail) return false;
  const snap = await getDoc(doc(db, 'favorites', favId(userEmail, postId)));
  return snap.exists();
}

export async function addFavorite(userEmail, post) {
  await setDoc(doc(db, 'favorites', favId(userEmail, post.id)), {
    userEmail,
    postId: post.id,
    slug: post.slug,
    title: post.title,
    category: post.category || null,
    image_url: post.image_url || null,
    created_at: serverTimestamp(),
  });
}

export async function removeFavorite(userEmail, postId) {
  await deleteDoc(doc(db, 'favorites', favId(userEmail, postId)));
}

export async function getUserFavorites(userEmail, max = 50) {
  if (!userEmail) return [];
  const q = query(collection(db, 'favorites'), where('userEmail', '==', userEmail), limit(max));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
  return docs;
}

// One view record per (user, post), with a running count - used as a proxy
// for "articles the user cares about" (precise reading-time/dwell tracking
// would need beacon-on-unload instrumentation; view frequency is a simpler,
// more robust signal for the same purpose).
export async function recordView(userEmail, post) {
  if (!userEmail) return;
  try {
    await setDoc(
      doc(db, 'reading_history', favId(userEmail, post.id)),
      {
        userEmail,
        postId: post.id,
        slug: post.slug,
        title: post.title,
        category: post.category || null,
        viewCount: increment(1),
        lastViewedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Firestore rule for reading_history not yet applied, or transient error.
  }
}

export async function getUserReadingHistory(userEmail, max = 50) {
  if (!userEmail) return [];
  const q = query(collection(db, 'reading_history'), where('userEmail', '==', userEmail), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
