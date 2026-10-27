import { NextResponse } from 'next/server';
import { revalidateAfterPublish } from '@/lib/revalidateSite';
import { refreshInsightsIfOld } from '@/lib/insights';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildDrugPrompt } from '@/lib/prompts';
import { DRUG_TOPICS } from '@/lib/cronTopics';
import { generateAndSaveArticle, pickSequentialTopic } from '@/lib/articleGenerator';
import { chooseDrugTopic, getGenerationPlan } from '@/lib/strategy';

export const maxDuration = 60;

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY o Firebase Admin non configurati.' });
  }

  // Generazione dimezzata su richiesta esplicita (contenere CPU/quota e dare
  // priorita' alla qualita' sul volume): farmaci nei giorni pari, benessere/
  // problemi (vedi api/cron/content) nei giorni dispari - un solo articolo
  // al giorno in totale invece di due. Il cron-job.org esterno continua a
  // chiamare questa route ogni giorno; e' la route stessa a saltare.
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  if (dayOfYear % 2 !== 0) {
    return NextResponse.json({ skipped: true, reason: 'Generazione farmaci a giorni alterni: oggi tocca a benessere/problemi.' });
  }

  try {
    // Il piano (pesi appresi da GA4) e' opzionale: senza dati sufficienti, o
    // in caso di errore, si segue la lista storica come prima.
    const plan = await getGenerationPlan();
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
    revalidateAfterPublish(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('/api/cron/drugs eccezione:', err);
    return NextResponse.json({ error: err.message || 'Errore sconosciuto.' }, { status: 500 });
  }
}
