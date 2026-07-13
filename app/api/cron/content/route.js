import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildProblemsPrompt, buildWellnessPrompt } from '@/lib/prompts';
import { PROBLEMS_TOPICS, WELLNESS_TOPICS } from '@/lib/cronTopics';
import { generateAndSaveArticle, pickRandomTopic } from '@/lib/articleGenerator';

export const maxDuration = 60;

// Alterna Benessere/Problemi Frequenti in base al giorno dell'anno, per
// coprire entrambe le categorie restando a 2 cron job totali nel progetto
// (il piano Vercel Hobby ne permette al massimo 2 al giorno).
export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY o Firebase Admin non configurati.' });
  }

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const isWellnessDay = dayOfYear % 2 === 0;

  const topics = isWellnessDay ? WELLNESS_TOPICS : PROBLEMS_TOPICS;
  const category = isWellnessDay ? 'Benessere' : 'Problemi Frequenti';
  const promptBuilder = isWellnessDay ? buildWellnessPrompt : buildProblemsPrompt;

  const topic = pickRandomTopic(topics);
  const result = await generateAndSaveArticle({
    topic,
    category,
    type: 'blog',
    promptBuilder,
    uniqueSuffix: Math.floor(1000 + Math.random() * 9000),
  });

  if (result.error) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
