import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import { getTrendingItems } from '@/lib/related';
import { getRecentPosts } from '@/lib/firestore';
import { categoryLabel } from '@/components/Breadcrumb';

// La classifica viene da Google Analytics (snapshot aggiornato ogni giorno dai
// cron) e la pagina si rigenera da sola: nessuna selezione manuale.
export const revalidate = 3600;

export const metadata = {
  title: 'Articoli di tendenza | WikiFarma',
  description: 'I 10 articoli di salute più letti e più apprezzati del momento su WikiFarma: i contenuti dove i lettori si fermano di più.',
  alternates: { canonical: '/tendenza' },
};

function formatTime(sec) {
  const s = Math.round(sec || 0);
  if (s < 10) return null;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

export default async function TrendingPage() {
  const items = await getTrendingItems();
  // Finche' non ci sono abbastanza letture (o GA4 non e' collegato) la pagina
  // non resta vuota: mostra gli ultimi articoli pubblicati.
  let fallback = [];
  if (items.length === 0) {
    try {
      fallback = (await getRecentPosts(10)).map((p) => ({ slug: p.slug, title: p.title, category: p.category, image_url: p.image_url || null, href: `/${p.slug}` }));
    } catch (err) {
      console.error('tendenza: ultimi articoli non disponibili:', err);
    }
  }
  const list = items.length ? items : fallback;

  return (
    <section className="section-home trending-page">
      <div className="section-head">
        <h1>🔥 In tendenza</h1>
      </div>
      <p className="trending-intro">
        {items.length
          ? 'I 10 articoli più letti e più apprezzati delle ultime due settimane: contano le letture e il tempo che i lettori dedicano all’articolo. La classifica si aggiorna ogni giorno.'
          : 'La classifica si forma man mano che gli articoli vengono letti. Intanto, ecco gli ultimi pubblicati.'}
      </p>
      <div className="news-grid">
        {list.map((a, i) => (
          <Link key={a.slug} href={a.href} className="card trending-card">
            <div className="trending-media">
              <SafeImage src={a.image_url} category={a.category} alt={a.title} className="card-img" />
              {items.length > 0 && <span className="trending-rank">{a.rank}</span>}
            </div>
            <div className="card-body">
              <div className="card-tag">{categoryLabel(a.category)}</div>
              <h3>{a.title}</h3>
              {items.length > 0 && (
                <p className="trending-stats">
                  {a.views} {a.views === 1 ? 'lettura' : 'letture'}
                  {formatTime(a.avgSec) ? ` · tempo medio ${formatTime(a.avgSec)}` : ''}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
