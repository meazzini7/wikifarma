import Link from 'next/link';
import { getPostsByLetter } from '@/lib/firestore';
import SafeImage from '@/components/SafeImage';

export const metadata = {
  title: 'Medicinali dalla A alla Z | WikiFarma',
  description: 'Enciclopedia dei farmaci: schede tecniche, indicazioni e posologia dalla A alla Z.',
};

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export default async function EncyclopediaPage({ searchParams }) {
  const raw = Array.isArray(searchParams?.let) ? searchParams.let[0] : searchParams?.let;
  const letter = (raw || 'A').toUpperCase();
  const activeLetter = LETTERS.includes(letter) ? letter : 'A';
  const posts = await getPostsByLetter(activeLetter);

  return (
    <div className="section-home">
      <div className="section-head">
        <h2>Medicinali dalla A alla Z</h2>
      </div>

      <div className="az-letters">
        {LETTERS.map((l) => (
          <Link key={l} href={`/encyclopedia?let=${l}`} className={l === activeLetter ? 'active' : ''}>
            {l}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>
          Nessun articolo trovato per la lettera {activeLetter}.
        </p>
      ) : (
        <div className="news-grid">
          {posts.map((post) => (
            <Link key={post.id} href={`/${post.slug}`} className="card">
              <SafeImage
                src={post.image_url}
                category={post.category}
                alt={post.title}
                className="card-img"
              />
              <div className="card-body">
                <h3>{post.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
