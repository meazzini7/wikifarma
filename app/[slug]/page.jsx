import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getPostBySlug } from '@/lib/firestore';
import { ADSENSE_ID } from '@/lib/constants';
import SafeImage from '@/components/SafeImage';
import FavoriteButton from '@/components/FavoriteButton';
import ReadingTracker from '@/components/ReadingTracker';

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  const description = stripHtml(post.content).slice(0, 160);

  return {
    title: `${post.title} | WikiFarma`,
    description,
    openGraph: {
      title: post.title,
      description,
      images: post.image_url ? [post.image_url] : undefined,
    },
  };
}

export default async function ArticlePage({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

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
      <ReadingTracker post={{ id: post.id, slug: post.slug, title: post.title, category: post.category }} />
      <div className="article-page">
        <h1 className="article-title">{post.title}</h1>
        <SafeImage
          src={post.image_url}
          category={post.category}
          alt={post.title}
          className="article-main-img"
        />

        <FavoriteButton
          post={{
            id: post.id,
            slug: post.slug,
            title: post.title,
            category: post.category,
            image_url: post.image_url || null,
          }}
        />

        {/* Contenuto generato dall'admin panel AI (fase 7): sorgente attendibile, non input utente. */}
        <div className="article-content" dangerouslySetInnerHTML={{ __html: post.content || '' }} />

        <div className="disclaimer-box">
          ⚠️ Le informazioni qui riportate non sostituiscono il parere del medico.
        </div>
      </div>
    </>
  );
}
