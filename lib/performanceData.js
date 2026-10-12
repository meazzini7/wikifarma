// Lettura server-side (Admin SDK) dei dati che servono alla valutazione:
// metadati degli articoli + contatori anonimi in article_stats.
import { getAdminDb } from './firebaseAdmin';

function snippetOf(html = '') {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function loadPerformanceData() {
  const db = getAdminDb();
  const [postSnap, statSnap] = await Promise.all([
    db.collection('posts').select('title', 'slug', 'category', 'type', 'created_at', 'gen_mode', 'content').get(),
    db.collection('article_stats').get(),
  ]);

  const posts = postSnap.docs.map((d) => {
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

  const stats = {};
  statSnap.docs.forEach((d) => {
    stats[d.id] = d.data();
  });

  return { posts, stats };
}
