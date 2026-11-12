import { NextResponse } from 'next/server';
import { revalidateAfterPublish } from '@/lib/revalidateSite';
import { refreshInsightsIfOld } from '@/lib/insights';
import { trackPending } from '@/lib/unsplash';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildDrugPrompt } from '@/lib/prompts';
import { DRUG_TOPICS } from '@/lib/cronTopics';
import { generateAndSaveArticle, pickSequentialTopic } from '@/lib/articleGenerator';
import { chooseDrugTopic, dailyCategory, getGenerationPlan } from '@/lib/strategy';

export const maxDuration = 60;

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY o Firebase Admin non configurati.' });
  }

  // Un solo articolo al giorno in totale (contenere CPU/quota). La categoria
  // del giorno e' decisa una volta sola per entrambe le route (dailyCategory):
  // questa genera solo se oggi tocca a "Farmaco". Il cron-job.org esterno
  // continua a chiamarla ogni giorno; e' la route stessa a saltare.
  const plan = await getGenerationPlan();
  if (dailyCategory(plan) !== 'Farmaco') {
    return NextResponse.json({ skipped: true, reason: 'Oggi la categoria scelta non e\' Farmaco (vedi api/cron/content).' });
  }

  try {
    const chosen = await chooseDrugTopic({ plan }).catch(() => null);
    const topic = chosen ? chosen.topic : await pickSequentialTopic(DRUG_TOPICS);
    if (!topic) {
      return NextResponse.json({ created: false, reason: 'Tutti i farmaci della lista sono già stati creati.' });
    }

    const result = await generateAndSaveArticle({
      topic,
      category: 'Farmaco',
      type: 'drug',
      promptBuilder: buildDrugPrompt,
      uniqueSuffix: Date.now(),
      brief: chosen ? plan.brief : undefined,
      genMode: chosen ? 'exploit' : 'explore',
    });

    if (result.error) {
      console.error('/api/cron/drugs fallito:', result.error);
      return NextResponse.json(result, { status: 502 });
    }
    // Dopo la pubblicazione si aggiorna lo snapshot GA4 (se vecchio): alimenta
    // "In tendenza" e i "piu' letti". Mai bloccante per l'esito del cron.
    await refreshInsightsIfOld();
    await trackPending({ limit: 10 }).catch(() => null);
    revalidateAfterPublish(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('/api/cron/drugs eccezione:', err);
    return NextResponse.json({ error: err.message || 'Errore sconosciuto.' }, { status: 500 });
  }
}
