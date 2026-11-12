import { NextResponse } from 'next/server';
import { revalidateAfterPublish } from '@/lib/revalidateSite';
import { refreshInsightsIfOld } from '@/lib/insights';
import { trackPending } from '@/lib/unsplash';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildProblemsPrompt, buildWellnessPrompt } from '@/lib/prompts';
import { PROBLEMS_TOPICS, WELLNESS_TOPICS } from '@/lib/cronTopics';
import { generateAndSaveArticle, pickRandomTopic } from '@/lib/articleGenerator';
import { chooseContentTopic, dailyCategory, getGenerationPlan, refreshStrategyIfStale, translateNextPopular } from '@/lib/strategy';

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

  // Il piano (pesi appresi da GA4) e' opzionale: senza dati sufficienti, o in
  // caso di errore, si torna ad alternare come prima. La categoria del giorno
  // (farmaco / benessere / problemi) e' decisa una volta sola per entrambe le
  // route (vedi dailyCategory): questa genera solo se oggi non e' "Farmaco".
  const plan = await getGenerationPlan();
  const today = dailyCategory(plan);
  if (today === 'Farmaco') {
    // Giorno libero di questa route: se la strategia editoriale e' scaduta
    // (o non esiste ancora) la ricostruiamo ora, con tutto il tempo a
    // disposizione, cosi' i giorni di generazione si limitano a leggerla.
    let strategyRefresh = null;
    try {
      strategyRefresh = await refreshStrategyIfStale();
    } catch (err) {
      console.error('/api/cron/content: aggiornamento strategia fallito:', err);
    }
    // Se la strategia non e' stata appena ricostruita (che gia' usa Gemini e
    // tempo), si traduce in inglese il prossimo articolo piu' letto.
    let translation = null;
    if (!strategyRefresh?.refreshed) {
      try {
        translation = await translateNextPopular('en');
      } catch (err) {
        console.error('/api/cron/content: traduzione non riuscita:', err);
      }
    }
    if (!strategyRefresh?.refreshed) await refreshInsightsIfOld();
    return NextResponse.json({
      skipped: true,
      reason: 'Oggi la categoria scelta e\' Farmaco (vedi api/cron/drugs).',
      strategy: strategyRefresh,
      translation,
    });
  }

  try {
    const category = today;
    const isWellness = category === 'Benessere';
    const topics = isWellness ? WELLNESS_TOPICS : PROBLEMS_TOPICS;
    const promptBuilder = isWellness ? buildWellnessPrompt : buildProblemsPrompt;

    const chosen = await chooseContentTopic({ category, topics, plan }).catch(() => null);
    const topic = chosen ? chosen.topic : await pickRandomTopic(topics);
    const result = await generateAndSaveArticle({
      topic,
      category,
      type: 'blog',
      promptBuilder,
      uniqueSuffix: Math.floor(1000 + Math.random() * 9000),
      brief: chosen ? plan.brief : undefined,
      genMode: chosen ? 'exploit' : 'explore',
    });

    if (result.error) {
      console.error('/api/cron/content fallito:', result.error);
      return NextResponse.json(result, { status: 502 });
    }
    // Dopo la pubblicazione si aggiorna lo snapshot GA4 (se vecchio): alimenta
    // "In tendenza" e i "piu' letti". Mai bloccante per l'esito del cron.
    await refreshInsightsIfOld();
    await trackPending({ limit: 10 }).catch(() => null);
    revalidateAfterPublish(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('/api/cron/content eccezione:', err);
    return NextResponse.json({ error: err.message || 'Errore sconosciuto.' }, { status: 500 });
  }
}
