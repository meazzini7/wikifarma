import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { callGemini, isGeminiConfigured } from '@/lib/gemini';
import { buildDrugPrompt } from '@/lib/prompts';
import { buildArticleImages } from '@/lib/imageGen';
import { insertInlineImage } from '@/lib/content';
import { sendNewArticleEmail } from '@/lib/email';
import { DRUG_TOPICS } from '@/lib/cronTopics';

export const maxDuration = 60;

function cleanOutput(text) {
  let t = text.replace(/```html/g, '').replace(/```/g, '');
  const idx = t.indexOf('<h2>');
  if (idx !== -1) t = t.slice(idx);
  return t.trim();
}

function slugify(title) {
  return `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY o Firebase Admin non configurati.' });
  }

  const db = getAdminDb();

  let topic = null;
  for (const candidate of DRUG_TOPICS) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('posts').where('title', '==', candidate).limit(1).get();
    if (snap.empty) {
      topic = candidate;
      break;
    }
  }

  if (!topic) {
    return NextResponse.json({ created: false, reason: 'Tutti i farmaci della lista sono già stati creati.' });
  }

  const raw = await callGemini(buildDrugPrompt(topic));
  if (!raw) {
    return NextResponse.json({ error: 'Risposta AI vuota.' }, { status: 502 });
  }

  const content = cleanOutput(raw);
  const { cover, inline } = buildArticleImages(topic, 'Farmaco');
  const finalContent = insertInlineImage(content, inline, topic);
  const slug = slugify(topic);

  await db.collection('posts').add({
    title: topic,
    title_lower: topic.toLowerCase(),
    slug,
    content: finalContent,
    category: 'Farmaco',
    type: 'drug',
    image_url: cover,
    created_at: FieldValue.serverTimestamp(),
  });

  await sendNewArticleEmail({ title: topic, slug, category: 'Farmaco' });

  return NextResponse.json({ created: true, title: topic, slug });
}
