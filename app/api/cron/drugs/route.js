import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildDrugPrompt } from '@/lib/prompts';
import { DRUG_TOPICS } from '@/lib/cronTopics';
import { generateAndSaveArticle, pickSequentialTopic } from '@/lib/articleGenerator';

export const maxDuration = 60;

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY o Firebase Admin non configurati.' });
  }

  const topic = await pickSequentialTopic(DRUG_TOPICS);
  if (!topic) {
    return NextResponse.json({ created: false, reason: 'Tutti i farmaci della lista sono già stati creati.' });
  }

  const result = await generateAndSaveArticle({
    topic,
    category: 'Farmaco',
    type: 'drug',
    promptBuilder: buildDrugPrompt,
    uniqueSuffix: Date.now(),
  });

  if (result.error) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
