import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildProblemsPrompt, buildWellnessPrompt } from '@/lib/prompts';
import { PROBLEMS_TOPICS, WELLNESS_TOPICS } from '@/lib/cronTopics';
import { generateAndSaveArticle, pickRandomTopic } from '@/lib/articleGenerator';

export const maxDuration = 60;

// Gira nei giorni dispari (i farmaci, vedi api/cron/drugs, nei giorni pari):
// un solo articolo al giorno in totale invece di due, su richiesta esplicita
// per contenere CPU/quota Gemini e dare priorita' alla qualita' sul volume.
// Nei giorni in cui gira, alterna comunque Benessere/Problemi Frequenti.
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
  if (dayOfYear % 2 === 0) {
    return NextResponse.json({ skipped: true, reason: 'Generazione benessere/problemi a giorni alterni: oggi tocca ai farmaci.' });
  }
  const isWellnessDay = Math.floor(dayOfYear / 2) % 2 === 0;

  const topics = isWellnessDay ? WELLNESS_TOPICS : PROBLEMS_TOPICS;
  const category = isWellnessDay ? 'Benessere' : 'Problemi Frequenti';
  const promptBuilder = isWellnessDay ? buildWellnessPrompt : buildProblemsPrompt;

  try {
    const topic = await pickRandomTopic(topics);
    const result = await generateAndSaveArticle({
      topic,
      category,
      type: 'blog',
      promptBuilder,
      uniqueSuffix: Math.floor(1000 + Math.random() * 9000),
    });

    if (result.error) {
      console.error('/api/cron/content fallito:', result.error);
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('/api/cron/content eccezione:', err);
    return NextResponse.json({ error: err.message || 'Errore sconosciuto.' }, { status: 500 });
  }
}
