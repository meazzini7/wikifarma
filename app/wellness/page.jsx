import Link from 'next/link';
import { getPostsByType } from '@/lib/firestore';
import SafeImage from '@/components/SafeImage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Benessere | WikiFarma',
  description: 'Guide, consigli e prevenzione per il tuo benessere quotidiano.',
};

function excerpt(html = '', len = 80) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > len ? `${text.slice(0, len)}...` : text;
}

export default async function WellnessPage() {
  const posts = await getPostsByType('blog', 50);

  return (
    <>
      <header className="hero" style={{ background: 'linear-gradient(135deg, #2e9e68 0%, #054d2e 100%)' }}>
        <h1>WikiFarma: Benessere</h1>
        <p>Guide, Consigli e Prevenzione.</p>
      </header>
      <div className="section-home">
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>Nessuna guida pubblicata ancora.</p>
        ) : (
          <div className="news-grid">
            {posts.map((post) => (
              <Link key={post.id} href={`/${post.slug}`} className="card">
                <SafeImage
                  src={post.image_url}
                  category={post.category}
                  alt={post.title}
                  className="card-img"
                  style={{ height: 220 }}
                />
                <div className="card-body">
                  <div className="card-tag" style={{ background: '#054d2e' }}>
                    Benessere
                  </div>
                  <h3>{post.title}</h3>
                  <p style={{ fontSize: 13, color: '#666', marginTop: 5 }}>{excerpt(post.content)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
