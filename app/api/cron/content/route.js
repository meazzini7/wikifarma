import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildProblemsPrompt, buildWellnessPrompt } from '@/lib/prompts';
import { PROBLEMS_TOPICS, WELLNESS_TOPICS } from '@/lib/cronTopics';
import { generateAndSaveArticle, pickRandomTopic } from '@/lib/articleGenerator';
import { chooseCategory, chooseContentTopic, getGenerationPlan, refreshStrategyIfStale } from '@/lib/strategy';

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
    // Giorno libero di questa route: se la strategia editoriale e' scaduta
    // (o non esiste ancora) la ricostruiamo ora, con tutto il tempo a
    // disposizione, cosi' i giorni di generazione si limitano a leggerla.
    let strategyRefresh = null;
    try {
      strategyRefresh = await refreshStrategyIfStale();
    } catch (err) {
      console.error('/api/cron/content: aggiornamento strategia fallito:', err);
    }
    return NextResponse.json({
      skipped: true,
      reason: 'Generazione benessere/problemi a giorni alterni: oggi tocca ai farmaci.',
      strategy: strategyRefresh,
    });
  }
  const defaultCategory = Math.floor(dayOfYear / 2) % 2 === 0 ? 'Benessere' : 'Problemi Frequenti';

  try {
    // Il piano (pesi appresi da GA4) e' opzionale: senza dati sufficienti, o
    // in caso di qualsiasi errore, si genera a caso esattamente come prima.
    const plan = await getGenerationPlan();
    const category = chooseCategory(plan, defaultCategory);
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
    return NextResponse.json(result);
  } catch (err) {
    console.error('/api/cron/content eccezione:', err);
    return NextResponse.json({ error: err.message || 'Errore sconosciuto.' }, { status: 500 });
  }
}
