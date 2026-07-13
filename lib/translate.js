import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, isFirebaseAdminConfigured } from './firebaseAdmin';
import { callGemini, isGeminiConfigured } from './gemini';

export const SUPPORTED_LANGS = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
};

// Only general health/wellness content is translated. Drug-specific sheets
// (dosages, Italian brand names/availability) are Italy-market-specific and
// risky to machine-translate as if valid elsewhere - they stay Italian-only.
export const TRANSLATABLE_CATEGORIES = ['Benessere', 'Problemi Frequenti'];

export function isTranslatable(category) {
  return TRANSLATABLE_CATEGORIES.includes(category);
}

function buildTranslationPrompt(title, content, lang) {
  return `Translate the following Italian health/wellness article into ${SUPPORTED_LANGS[lang]}.
Keep every HTML tag exactly as it is (do not add, remove or change any <tag>), translate only the
visible text between tags. Keep the same professional-but-approachable tone. Do not add any
preamble, greeting, or explanation. Respond with ONLY a JSON object, no markdown fences, in this
exact shape: {"title": "...", "content": "..."}

TITLE: ${title}

CONTENT:
${content}`;
}

function parseTranslationResponse(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed.title || !parsed.content) return null;
    if (!/<(h2|p)[ >]/i.test(parsed.content)) return null;
    return { title: parsed.title, content: parsed.content };
  } catch {
    return null;
  }
}

// Translations are generated on first request and cached on the post
// document (translations.{lang}), rather than pre-translating everything
// upfront - keeps Gemini usage proportional to actual international
// traffic instead of a costly one-shot batch job.
export async function getOrCreateTranslation(post, lang) {
  if (!SUPPORTED_LANGS[lang] || !isTranslatable(post.category)) return null;
  if (post.translations?.[lang]) return post.translations[lang];
  if (!isGeminiConfigured()) return null;

  const raw = await callGemini(buildTranslationPrompt(post.title, post.content, lang));
  if (!raw) return null;

  const translated = parseTranslationResponse(raw);
  if (!translated) return null;

  if (isFirebaseAdminConfigured()) {
    try {
      const db = getAdminDb();
      await db.collection('posts').doc(post.id).update({
        [`translations.${lang}`]: translated,
        translations_updated_at: FieldValue.serverTimestamp(),
      });
    } catch {
      // Caching failed - still return the translation for this request.
    }
  }

  return translated;
}
