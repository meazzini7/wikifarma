import Link from 'next/link';
import LiveSearch from '@/components/LiveSearch';
import SafeImage from '@/components/SafeImage';
import { getHomeStats, getRecentPosts } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [stats, recent] = await Promise.all([getHomeStats(), getRecentPosts(9)]);

  return (
    <>
      <header className="hero">
        <h1>WikiFarma: Il Portale della Salute</h1>
        <p>Medicinali dalla A alla Z, consigli medici e diagnosi virtuale intelligente.</p>
        <LiveSearch />
        <div className="stats-row">
          <div className="stat-box">
            <span className="stat-num">{stats.drugs}</span>
            <span className="stat-label">FARMACI</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{stats.guides}</span>
            <span className="stat-label">GUIDE</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{stats.visitors}</span>
            <span className="stat-label">UTENTI</span>
          </div>
        </div>
      </header>

      <section className="section-home">
        <div className="section-head">
          <h2>Esplora le Categorie</h2>
        </div>
        <div className="cat-grid">
          <Link href="/encyclopedia" className="cat-box">
            <span className="cat-icon">💊</span>
            <div className="cat-title">Medicinali A-Z</div>
            <div className="cat-desc">Schede tecniche.</div>
          </Link>
          <Link href="/diagnosis" className="cat-box">
            <span className="cat-icon">🩺</span>
            <div className="cat-title">Diagnosi AI</div>
            <div className="cat-desc">Analisi sintomi.</div>
          </Link>
          <Link href="/wellness" className="cat-box">
            <span className="cat-icon">🥗</span>
            <div className="cat-title">Benessere</div>
            <div className="cat-desc">Consigli e stile di vita.</div>
          </Link>
          <Link href="/problems" className="cat-box">
            <span className="cat-icon">🔥</span>
            <div className="cat-title">Problemi Frequenti</div>
            <div className="cat-desc">Guide e Rimedi.</div>
          </Link>
        </div>
      </section>

      <section className="features-section">
        <div className="section-head">
          <h2>Perché scegliere WikiFarma?</h2>
        </div>
        <p style={{ maxWidth: 800, margin: '0 auto 20px', color: '#666' }}>
          WikiFarma è il tuo assistente digitale per la salute.
        </p>
        <div className="features-grid">
          <div className="feature-item">
            <h3>🔍 Medicinali dalla A alla Z</h3>
            <p>Trova in pochi secondi il foglietto illustrativo di qualsiasi farmaco.</p>
          </div>
          <div className="feature-item">
            <h3>🤖 Triage Virtuale AI</h3>
            <p>Analizza i tuoi sintomi in tempo reale con l'intelligenza artificiale.</p>
          </div>
          <div className="feature-item">
            <h3>📚 Informazione Certificata</h3>
            <p>Contenuti aggiornati quotidianamente.</p>
          </div>
        </div>
      </section>

      <section className="home-diag-section">
        <div className="home-diag-wrap" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--primary)', fontSize: '2rem', marginBottom: 10 }}>
            Diagnosi Virtuale 🩺
          </h2>
          <p style={{ marginBottom: 20 }}>Descrivi i sintomi per un&apos;analisi immediata.</p>
          <Link href="/diagnosis" className="diag-btn" style={{ display: 'inline-block', textDecoration: 'none', padding: '14px 30px' }}>
            VAI ALLA DIAGNOSI AI ✨
          </Link>
        </div>
      </section>

      <section className="section-home">
        <div className="section-head">
          <h2>Ultimi Aggiornamenti</h2>
        </div>
        {recent.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>Nessun articolo pubblicato ancora.</p>
        ) : (
          <div className="news-grid">
            {recent.map((post) => (
              <Link key={post.id} href={`/${post.slug}`} className="card">
                <SafeImage
                  src={post.image_url}
                  category={post.category}
                  alt={post.title}
                  className="card-img"
                />
                <div className="card-body">
                  <div className="card-tag">{post.category}</div>
                  <h3>{post.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
