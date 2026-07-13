import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin';
import { callGemini } from './gemini';
import { buildArticleImages } from './imageGen';
import { insertInlineImage } from './content';
import { sendNewArticleEmail } from './email';

function cleanOutput(text) {
  let t = text.replace(/```html/g, '').replace(/```/g, '');
  const idx = t.indexOf('<h2>');
  if (idx !== -1) t = t.slice(idx);
  return t.trim();
}

function slugify(title, uniqueSuffix) {
  return `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${uniqueSuffix}`;
}

// Sequential mode (drugs): walk the priority list, generate the first topic
// that doesn't have a post yet.
export async function pickSequentialTopic(topics) {
  const db = getAdminDb();
  for (const candidate of topics) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('posts').where('title', '==', candidate).limit(1).get();
    if (snap.empty) return candidate;
  }
  return null;
}

// Random mode (wellness/problems): pick any topic, tag it with the year so
// re-picks don't collide with earlier posts of the same base topic.
export function pickRandomTopic(topics) {
  const base = topics[Math.floor(Math.random() * topics.length)];
  return `${base} (Guida ${new Date().getFullYear()})`;
}

export async function generateAndSaveArticle({ topic, category, type, promptBuilder, uniqueSuffix }) {
  const raw = await callGemini(promptBuilder(topic));
  if (!raw) return { error: 'Risposta AI vuota.' };

  const content = cleanOutput(raw);
  const { cover, inline, fallback } = buildArticleImages(topic, category);
  const finalContent = insertInlineImage(content, inline, topic, fallback);
  const slug = slugify(topic, uniqueSuffix);

  const db = getAdminDb();
  await db.collection('posts').add({
    title: topic,
    title_lower: topic.toLowerCase(),
    slug,
    content: finalContent,
    category,
    type,
    image_url: cover,
    created_at: FieldValue.serverTimestamp(),
  });

  await sendNewArticleEmail({ title: topic, slug, category });

  return { created: true, title: topic, slug };
}
