import { notFound, redirect } from 'next/navigation';
import { getPostBySlug } from '@/lib/firestore';
import { getOrCreateTranslation, isTranslatable, SUPPORTED_LANGS } from '@/lib/translate';
import { SITE_URL } from '@/lib/constants';
import SafeImage from '@/components/SafeImage';

const DISCLAIMERS = {
  en: '⚠️ The information provided here does not replace medical advice. If in doubt, consult your doctor.',
  es: '⚠️ La información aquí proporcionada no sustituye el consejo médico. En caso de duda, consulta a tu médico.',
  fr: '⚠️ Les informations fournies ici ne remplacent pas un avis médical. En cas de doute, consultez votre médecin.',
  de: '⚠️ Die hier bereitgestellten Informationen ersetzen keine ärztliche Beratung. Wenden Sie sich im Zweifel an Ihren Arzt.',
};

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }) {
  // Route folder is named [slug]/[articleSlug] to satisfy Next.js's
  // constraint that sibling dynamic segments share a name with the
  // existing Italian app/[slug]/page.jsx - here params.slug is actually
  // the language code and params.articleSlug the real post slug.
  const lang = params.slug;
  const slug = params.articleSlug;
  if (!SUPPORTED_LANGS[lang]) return {};

  const post = await getPostBySlug(slug);
  if (!post || !isTranslatable(post.category)) return {};

  const translated = await getOrCreateTranslation(post, lang);
  if (!translated) return {};

  const languages = { it: `${SITE_URL}/${slug}`, 'x-default': `${SITE_URL}/${slug}` };
  Object.keys(SUPPORTED_LANGS).forEach((code) => {
    languages[code] = `${SITE_URL}/${code}/${slug}`;
  });

  return {
    title: `${translated.title} | WikiFarma`,
    description: stripHtml(translated.content).slice(0, 160),
    alternates: {
      canonical: `/${lang}/${slug}`,
      languages,
    },
  };
}

export default async function TranslatedArticlePage({ params }) {
  const lang = params.slug;
  const slug = params.articleSlug;
  if (!SUPPORTED_LANGS[lang]) notFound();

  const post = await getPostBySlug(slug);
  if (!post) notFound();
  if (!isTranslatable(post.category)) redirect(`/${slug}`);

  const translated = await getOrCreateTranslation(post, lang);
  if (!translated) redirect(`/${slug}`);

  return (
    <div className="article-page">
      <h1 className="article-title">{translated.title}</h1>
      <SafeImage
        src={post.image_url}
        category={post.category}
        alt={translated.title}
        className="article-main-img"
      />
      <div className="article-content" dangerouslySetInnerHTML={{ __html: translated.content }} />
      <div className="disclaimer-box">{DISCLAIMERS[lang]}</div>
    </div>
  );
}
