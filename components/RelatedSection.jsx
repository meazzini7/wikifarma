import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

// Schede "Continua a leggere" (stesso aspetto delle schede del sito) e
// classifica "I piu' letti". Gli item arrivano gia' con titolo e link nella
// lingua giusta (lib/related.js), quindi vale anche per le pagine tradotte.
export default function RelatedSection({ heading, items, showTag = true, bare = false }) {
  if (!items?.length) return null;

  const grid = (
    <div className="news-grid">
      {items.map((r) => (
        <Link key={r.href} href={r.href} className="card">
          <SafeImage src={r.image_url} category={r.category} alt={r.title} className="card-img" />
          <div className="card-body">
            {showTag && r.category ? <div className="card-tag">{r.category}</div> : null}
            <h3>{r.title}</h3>
          </div>
        </Link>
      ))}
    </div>
  );

  if (bare) return grid;
  return (
    <div className="related-articles">
      <h2>{heading}</h2>
      {grid}
    </div>
  );
}

export function PopularList({ heading, items }) {
  if (!items?.length) return null;
  return (
    <div className="popular-box">
      <h2>{heading}</h2>
      <ol className="popular-list">
        {items.map((p) => (
          <li key={p.href}>
            <Link href={p.href}>{p.title}</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
