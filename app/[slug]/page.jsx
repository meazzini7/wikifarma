import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getPostBySlug, getRecommendedPosts } from '@/lib/firestore';
import { ADSENSE_ID, SITE_URL } from '@/lib/constants';
import { isTranslatable, SUPPORTED_LANGS } from '@/lib/translate';
import SafeImage from '@/components/SafeImage';
import FavoriteButton from '@/components/FavoriteButton';
import ReadingTracker from '@/components/ReadingTracker';
import ShareButtons from '@/components/ShareButtons';

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  const description = stripHtml(post.content).slice(0, 160);

  const languages = { 'x-default': `${SITE_URL}/${post.slug}` };
  if (isTranslatable(post.category)) {
    Object.keys(SUPPORTED_LANGS).forEach((code) => {
      languages[code] = `${SITE_URL}/${code}/${post.slug}`;
    });
  }

  return {
    title: `${post.title} | WikiFarma`,
    description,
    alternates: {
      canonical: `/${post.slug}`,
      languages,
    },
    openGraph: {
      title: post.title,
      description,
      url: `${SITE_URL}/${post.slug}`,
      type: 'article',
      images: post.image_url ? [post.image_url] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: post.image_url ? [post.image_url] : undefined,
    },
  };
}

export default async function ArticlePage({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const related = await getRecommendedPosts([post.category], new Set([post.slug]), 4);
  const url = `${SITE_URL}/${post.slug}`;
  const description = stripHtml(post.content).slice(0, 200);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': post.type === 'drug' ? 'MedicalWebPage' : 'Article',
    headline: post.title,
    description,
    image: post.image_url || undefined,
    url,
    datePublished: post.created_at?.toDate?.().toISOString() || undefined,
    dateModified: post.created_at?.toDate?.().toISOString() || undefined,
    publisher: {
      '@type': 'Organization',
      name: 'WikiFarma',
      url: SITE_URL,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  return (
    <>
      {/* AdSense Auto ads: caricato solo sulla pagina articolo, come nel sito
          originale. Nessuna unita' manuale: senza uno slot reale creato
          nella dashboard AdSense un <ins> con slot fittizio non mostra
          nulla - Auto ads (da abilitare per il sito in AdSense) decide da
          solo dove posizionare gli annunci su questa pagina. */}
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <Script id="article-jsonld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(jsonLd)}
      </Script>
      <ReadingTracker post={{ id: post.id, slug: post.slug, title: post.title, category: post.category }} />
      <div className="article-page">
        <h1 className="article-title">{post.title}</h1>
        <SafeImage
          src={post.image_url}
          category={post.category}
          alt={post.title}
          className="article-main-img"
        />

        <div className="article-actions">
          <FavoriteButton
            post={{
              id: post.id,
              slug: post.slug,
              title: post.title,
              category: post.category,
              image_url: post.image_url || null,
            }}
          />
          <ShareButtons url={url} title={post.title} />
        </div>

        {/* Contenuto generato dall'admin panel AI (fase 7): sorgente attendibile, non input utente. */}
        <div className="article-content" dangerouslySetInnerHTML={{ __html: post.content || '' }} />

        <div className="disclaimer-box">
          ⚠️ Le informazioni qui riportate non sostituiscono il parere del medico.
        </div>

        {related.length > 0 && (
          <div className="related-articles">
            <h2>Articoli correlati</h2>
            <div className="news-grid">
              {related.map((r) => (
                <Link key={r.id} href={`/${r.slug}`} className="card">
                  <SafeImage src={r.image_url} category={r.category} alt={r.title} className="card-img" />
                  <div className="card-body">
                    <div className="card-tag">{r.category}</div>
                    <h3>{r.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
