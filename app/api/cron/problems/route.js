import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { callGemini, isGeminiConfigured } from '@/lib/gemini';
import { buildProblemsPrompt } from '@/lib/prompts';
import { buildArticleImages } from '@/lib/imageGen';
import { insertInlineImage } from '@/lib/content';
import { sendNewArticleEmail } from '@/lib/email';
import { PROBLEMS_TOPICS } from '@/lib/cronTopics';

export const maxDuration = 60;

function cleanOutput(text) {
  let t = text.replace(/```html/g, '').replace(/```/g, '');
  const idx = t.indexOf('<h2>');
  if (idx !== -1) t = t.slice(idx);
  return t.trim();
}

function slugify(title) {
  return `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY o Firebase Admin non configurati.' });
  }

  const base = PROBLEMS_TOPICS[Math.floor(Math.random() * PROBLEMS_TOPICS.length)];
  const topic = `${base} (Guida ${new Date().getFullYear()})`;

  const raw = await callGemini(buildProblemsPrompt(topic));
  if (!raw) {
    return NextResponse.json({ error: 'Risposta AI vuota.' }, { status: 502 });
  }

  const content = cleanOutput(raw);
  const { cover, inline } = buildArticleImages(topic, 'Problemi Frequenti');
  const finalContent = insertInlineImage(content, inline, topic);
  const slug = slugify(topic);

  const db = getAdminDb();
  await db.collection('posts').add({
    title: topic,
    title_lower: topic.toLowerCase(),
    slug,
    content: finalContent,
    category: 'Problemi Frequenti',
    type: 'blog',
    image_url: cover,
    created_at: FieldValue.serverTimestamp(),
  });

  await sendNewArticleEmail({ title: topic, slug, category: 'Problemi Frequenti' });

  return NextResponse.json({ created: true, title: topic, slug });
}
