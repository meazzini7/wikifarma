import { notFound, redirect } from 'next/navigation';
import { getPostBySlug } from '@/lib/firestore';
import { getOrCreateTranslation, isTranslatable, SUPPORTED_LANGS } from '@/lib/translate';
import { SITE_URL } from '@/lib/constants';
import SafeImage from '@/components/SafeImage';
import ReadingProgress from '@/components/ReadingProgress';
import RelatedSection, { PopularList } from '@/components/RelatedSection';
import { getRelated } from '@/lib/related';
import { insertReadAlso, readingMinutes } from '@/lib/content';

const DISCLAIMERS = {
  en: '⚠️ The information provided here does not replace medical advice. If in doubt, consult your doctor.',
  es: '⚠️ La información aquí proporcionada no sustituye el consejo médico. En caso de duda, consulta a tu médico.',
  fr: '⚠️ Les informations fournies ici ne remplacent pas un avis médical. En cas de doute, consultez votre médecin.',
  de: '⚠️ Die hier bereitgestellten Informationen ersetzen keine ärztliche Beratung. Wenden Sie sich im Zweifel an Ihren Arzt.',
};

// Stesso ragionamento della pagina italiana (vedi app/[slug]/page.jsx):
// senza cache, ogni visita rifà la query Firestore e, se la traduzione non
// è già in cache su Firestore, anche una chiamata Gemini - 2 ore di ISR
// evitano entrambe le cose per le richieste ripetute.
export const revalidate = 7200;

// Testi delle sezioni di fidelizzazione per lingua: queste pagine portano il
// traffico estero e prima erano un vicolo cieco (nessun altro articolo).
const UI = {
  en: { more: 'Keep reading', popular: 'Most read right now', also: 'Read also', min: 'min read' },
  es: { more: 'Sigue leyendo', popular: 'Lo más leído ahora', also: 'Lee también', min: 'min de lectura' },
  fr: { more: 'Continuez la lecture', popular: 'Les plus lus du moment', also: 'À lire aussi', min: 'min de lecture' },
  de: { more: 'Weiterlesen', popular: 'Aktuell am meisten gelesen', also: 'Auch interessant', min: 'Min. Lesezeit' },
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

  // Solo le lingue gia' in cache (piu' quella appena servita in questa
  // richiesta) vanno in hreflang - stesso motivo di app/[slug]/page.jsx:
  // non invitare i crawler a generare le altre 2-3 traduzioni mancanti
  // solo per essere indicizzate.
  const languages = { it: `${SITE_URL}/${slug}`, 'x-default': `${SITE_URL}/${slug}` };
  Object.keys(SUPPORTED_LANGS).forEach((code) => {
    if (code === lang || post.translations?.[code]) {
      languages[code] = `${SITE_URL}/${code}/${slug}`;
    }
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

  const ui = UI[lang];
  const rel = await getRelated(post, { lang });
  const readAlso = rel?.related[0] || null;
  const bodyHtml = readAlso ? insertReadAlso(translated.content, readAlso, ui.also) : translated.content;
  const minutes = readingMinutes(translated.content);

  return (
    <div className="article-page">
      <ReadingProgress />
      <h1 className="article-title">{translated.title}</h1>
      <p className="article-meta">⏱ {minutes} {ui.min}</p>
      <SafeImage
        src={post.image_url}
        category={post.category}
        alt={translated.title}
        className="article-main-img"
      />
      <div className="article-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <div className="disclaimer-box">{DISCLAIMERS[lang]}</div>
      <RelatedSection heading={ui.more} items={rel?.related.slice(1, 5)} showTag={false} />
      <PopularList heading={ui.popular} items={rel?.popular} />
    </div>
  );
}
