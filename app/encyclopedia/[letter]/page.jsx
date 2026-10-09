import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostsByLetter } from '@/lib/firestore';
import SafeImage from '@/components/SafeImage';

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// Pagine statiche per lettera invece che una singola pagina dinamica con
// query param (?let=X): con generateStaticParams tutte le 26 vengono
// prerenderizzate e poi servite dalla cache, azzerando il costo per
// richiesta che prima si pagava ad ogni visita (query Firestore comprese).
export function generateStaticParams() {
  return LETTERS.map((letter) => ({ letter }));
}

export const revalidate = 10800;

export function generateMetadata({ params }) {
  const letter = params.letter.toUpperCase();
  return {
    title: `Medicinali ${letter} | Enciclopedia A-Z | WikiFarma`,
    description: `Elenco dei medicinali che iniziano per ${letter}: schede tecniche, indicazioni e posologia.`,
  };
}

export default async function EncyclopediaLetterPage({ params }) {
  const letter = params.letter.toUpperCase();
  if (!LETTERS.includes(letter)) notFound();

  const posts = await getPostsByLetter(letter);

  return (
    <div className="section-home">
      <div className="section-head">
        <h2>Medicinali dalla A alla Z</h2>
      </div>

      <div className="az-letters">
        {LETTERS.map((l) => (
          <Link key={l} href={`/encyclopedia/${l}`} className={l === letter ? 'active' : ''}>
            {l}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>
          Nessun articolo trovato per la lettera {letter}.
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
