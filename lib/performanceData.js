// Lettura server-side (Admin SDK) dei metadati degli articoli che servono
// alla valutazione. Le visite non stanno su Firestore: arrivano da GA4.
import { getAdminDb } from './firebaseAdmin';

function snippetOf(html = '') {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function loadPosts() {
  const snap = await getAdminDb()
    .collection('posts')
    .select('title', 'slug', 'category', 'type', 'created_at', 'gen_mode', 'content')
    .get();

  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      title: x.title || '',
      slug: x.slug || '',
      category: x.category || '',
      type: x.type || '',
      created_at: x.created_at?.toMillis?.() || 0,
      gen_mode: x.gen_mode || null,
      snippet: snippetOf(x.content),
    };
  });
}
