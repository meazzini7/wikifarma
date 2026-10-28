import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getPostBySlug, getRecommendedPosts } from '@/lib/firestore';
import { ADSENSE_ID, SITE_URL } from '@/lib/constants';
import { isTranslatable, SUPPORTED_LANGS } from '@/lib/translate';
import SafeImage from '@/components/SafeImage';
import FavoriteButton from '@/components/FavoriteButton';
import ReadingTracker from '@/components/ReadingTracker';
import ShareButtons from '@/components/ShareButtons';
import Breadcrumb, { categoryHref, categoryLabel } from '@/components/Breadcrumb';
import ReadingProgress from '@/components/ReadingProgress';
import RelatedSection, { PopularList } from '@/components/RelatedSection';
import { getRelated } from '@/lib/related';
import AffiliateBox from '@/components/AffiliateBox';
import { getAffiliateProducts } from '@/lib/affiliate';
import { insertReadAlso, readingMinutes, stripGeneratedImages } from '@/lib/content';
import { normalizeArticleHtml } from '@/lib/formatContent';
import { coverUrl } from '@/lib/coverUrl';

// Senza generateStaticParams ogni pagina articolo viene renderizzata a
// richiesta (query Firestore comprese) - senza una cache, questo succede
// ad ogni singola visita, la fonte piu' pesante di consumo CPU su Vercel
// dato che sono le pagine piu' visitate del sito. Gli articoli cambiano di
// fatto solo quando generati o editati da admin, mai in tempo reale, quindi
// 12 ore di cache sono sicure (i cron invalidano le liste alla pubblicazione).
export const revalidate = 43200;

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  const description = stripHtml(post.content).slice(0, 160);

  // Solo le lingue gia' tradotte (cache su post.translations) finiscono nei
  // tag hreflang: pubblicizzare tutte e 4 le lingue per ogni articolo
  // invitava i crawler a visitare sistematicamente ogni combinazione
  // articolo x lingua, generando traduzioni nuove (chiamata Gemini +
  // scrittura Firestore) solo per essere indicizzate, non per traffico
  // reale - la causa principale del consumo CPU/quota fuori scala.
  const languages = { 'x-default': `${SITE_URL}/${post.slug}` };
  if (isTranslatable(post.category)) {
    Object.keys(SUPPORTED_LANGS).forEach((code) => {
      if (post.translations?.[code]) {
        languages[code] = `${SITE_URL}/${code}/${post.slug}`;
      }
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
      images: [coverUrl(post.title, post.category, post.image_url)],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [coverUrl(post.title, post.category, post.image_url)],
    },
  };
}

export default async function ArticlePage({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  // Correlati pertinenti (tema/stile/parole del titolo + popolarita'); se non
  // disponibili si ripiega sui correlati classici (stessa categoria, recenti).
  const rel = await getRelated(post, { lang: 'it' });
  const readAlso = rel?.related[0] || null;
  const moreItems = rel
    ? rel.related.slice(1, 5)
    : (await getRecommendedPosts([post.category], new Set([post.slug]), 4)).map((r) => ({
        slug: r.slug,
        title: r.title,
        category: r.category,
        image_url: r.image_url,
        href: `/${r.slug}`,
      }));
  const cleanHtml = normalizeArticleHtml(stripGeneratedImages(post.content || ''));
  const bodyHtml = readAlso ? insertReadAlso(cleanHtml, readAlso) : cleanHtml;
  const minutes = readingMinutes(post.content);
  const affiliate = getAffiliateProducts(post);
  const url = `${SITE_URL}/${post.slug}`;
  const description = stripHtml(post.content).slice(0, 200);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': post.type === 'drug' ? 'MedicalWebPage' : 'Article',
    headline: post.title,
    description,
    image: coverUrl(post.title, post.category, post.image_url),
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

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: categoryLabel(post.category), item: `${SITE_URL}${categoryHref(post.category, post.title)}` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  return (
    <>
      <ReadingProgress />
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
      <Script id="breadcrumb-jsonld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(breadcrumbLd)}
      </Script>
      <ReadingTracker post={{ id: post.id, slug: post.slug, title: post.title, category: post.category }} />
      <div className="article-page">
        <Breadcrumb category={post.category} title={post.title} />
        <h1 className="article-title">{post.title}</h1>
        <p className="article-meta">⏱ {minutes} min di lettura</p>
        <SafeImage
          src={post.image_url}
          category={post.category}
          alt={post.title}
          className="article-main-img"
        />
        {post.photo?.author && (
          <p className="photo-credit">
            Foto: <a href={post.photo.author_url} target="_blank" rel="noopener noreferrer nofollow">{post.photo.author}</a> su{' '}
            <a href="https://unsplash.com/?utm_source=wikifarma&utm_medium=referral" target="_blank" rel="noopener noreferrer nofollow">Unsplash</a>
          </p>
        )}

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
        <div className="article-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        <AffiliateBox items={affiliate.items} theme={affiliate.theme} slug={post.slug} />

        <div className="disclaimer-box">
          ⚠️ Le informazioni qui riportate non sostituiscono il parere del medico.
        </div>

        <RelatedSection heading="Continua a leggere" items={moreItems} />
        <PopularList heading="I più letti del momento" items={rel?.popular} />
      </div>
    </>
  );
}
