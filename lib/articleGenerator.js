import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin';
import { callGemini } from './gemini';
import { buildArticleImages } from './imageGen';
import { insertInlineImage } from './content';
import { cleanGeneratedContent } from './cleanContent';
import { sendNewArticleEmail } from './email';

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

// Random mode (wellness/problems): pick any topic, tag it with the year.
// Checks for an existing post with the same resulting title first (the old
// PHP cron_daily2/3.php scripts didn't, which is why the migrated data has
// ~50 duplicate-titled articles) and retries a few times before falling
// back to a suffixed title that's guaranteed unique.
export async function pickRandomTopic(topics, maxAttempts = 8) {
  const db = getAdminDb();
  const year = new Date().getFullYear();

  for (let i = 0; i < maxAttempts; i += 1) {
    const base = topics[Math.floor(Math.random() * topics.length)];
    const candidate = `${base} (Guida ${year})`;
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('posts').where('title', '==', candidate).limit(1).get();
    if (snap.empty) return candidate;
  }

  const base = topics[Math.floor(Math.random() * topics.length)];
  return `${base} (Guida ${year}) #${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function generateAndSaveArticle({ topic, category, type, promptBuilder, uniqueSuffix }) {
  const raw = await callGemini(promptBuilder(topic));
  if (!raw) return { error: 'Risposta AI vuota.' };

  const content = cleanGeneratedContent(raw);
  const { cover, inline, fallback } = await buildArticleImages(topic, category);
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
