import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getPostBySlug } from '@/lib/firestore';
import { ADSENSE_ID, PLACEHOLDER_IMAGE } from '@/lib/constants';
import AdUnit from '@/components/AdUnit';

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
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <div className="article-page">
        <h1 className="article-title">{post.title}</h1>
        <img
          src={post.image_url || PLACEHOLDER_IMAGE}
          alt={post.title}
          className="article-main-img"
        />

        <AdUnit />

        {/* Contenuto generato dall'admin panel AI (fase 7): sorgente attendibile, non input utente. */}
        <div className="article-content" dangerouslySetInnerHTML={{ __html: post.content || '' }} />

        <AdUnit />

        <div className="disclaimer-box">
          ⚠️ Le informazioni qui riportate non sostituiscono il parere del medico.
        </div>
      </div>
    </>
  );
}
