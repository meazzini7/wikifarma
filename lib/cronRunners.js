// Logica dei due cron (farmaci e contenuti), separata da Next.js.
//
// Le stesse funzioni sono usate da:
//   - app/api/cron/*/route.js  (uso manuale / test: la route aggiunge solo
//                                l'autenticazione e l'invalidazione delle pagine)
//   - scripts/run-cron.mjs     (GitHub Actions, che esegue il lavoro FUORI da
//                                Vercel: cosi' Gemini, Firestore, GA4 e Unsplash
//                                non consumano Active CPU Vercel)
//
// Nessun import da next/server: ogni funzione ritorna { status, body } e chi la
// chiama decide come rispondere. Un solo articolo al giorno in totale: la
// categoria del giorno e' decisa da dailyCategory (identica per le due funzioni).
import { refreshInsightsIfOld } from './insights';
import { trackPending } from './unsplash';
import { isFirebaseAdminConfigured } from './firebaseAdmin';
import { isGeminiConfigured } from './gemini';
import { buildDrugPrompt, buildProblemsPrompt, buildWellnessPrompt } from './prompts';
import { DRUG_TOPICS, PROBLEMS_TOPICS, WELLNESS_TOPICS } from './cronTopics';
import { generateAndSaveArticle, pickRandomTopic, pickSequentialTopic } from './articleGenerator';
import { chooseContentTopic, chooseDrugTopic, dailyCategory, getGenerationPlan, refreshStrategyIfStale, translateNextPopular } from './strategy';

function notConfigured() {
  return {
    status: 200,
    body: { skipped: true, configError: true, reason: 'GEMINI_API_KEY o Firebase Admin non configurati.' },
  };
}

// Farmaci: genera solo se la categoria del giorno e' "Farmaco".
export async function runDrugsCron() {
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) return notConfigured();

  const plan = await getGenerationPlan();
  if (dailyCategory(plan) !== 'Farmaco') {
    return { status: 200, body: { skipped: true, reason: "Oggi la categoria scelta non e' Farmaco (vedi contenuti)." } };
  }

  try {
    const chosen = await chooseDrugTopic({ plan }).catch(() => null);
    const topic = chosen ? chosen.topic : await pickSequentialTopic(DRUG_TOPICS);
    if (!topic) {
      return { status: 200, body: { created: false, reason: 'Tutti i farmaci della lista sono già stati creati.' } };
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
      console.error('cron farmaci fallito:', result.error);
      return { status: 502, body: result };
    }
    // Dopo la pubblicazione si aggiorna lo snapshot GA4 (se vecchio): alimenta
    // "In tendenza" e i "piu' letti". Mai bloccante per l'esito.
    await refreshInsightsIfOld();
    await trackPending({ limit: 10 }).catch(() => null);
    return { status: 200, body: result };
  } catch (err) {
    console.error('cron farmaci eccezione:', err);
    return { status: 500, body: { error: err.message || 'Errore sconosciuto.' } };
  }
}

// Benessere / Problemi Frequenti: genera se la categoria del giorno non e'
// "Farmaco"; altrimenti e' il giorno libero (strategia settimanale con Gemini,
// traduzione dell'articolo piu' letto, aggiornamento dati GA4).
export async function runContentCron() {
  if (!isGeminiConfigured() || !isFirebaseAdminConfigured()) return notConfigured();

  const plan = await getGenerationPlan();
  const today = dailyCategory(plan);

  if (today === 'Farmaco') {
    let strategyRefresh = null;
    try {
      strategyRefresh = await refreshStrategyIfStale();
    } catch (err) {
      console.error('cron contenuti: aggiornamento strategia fallito:', err);
    }
    // Se la strategia non e' stata appena ricostruita (usa gia' Gemini), si
    // traduce in inglese il prossimo articolo piu' letto.
    let translation = null;
    if (!strategyRefresh?.refreshed) {
      try {
        translation = await translateNextPopular('en');
      } catch (err) {
        console.error('cron contenuti: traduzione non riuscita:', err);
      }
    }
    if (!strategyRefresh?.refreshed) await refreshInsightsIfOld();
    return {
      status: 200,
      body: { skipped: true, reason: "Oggi la categoria scelta e' Farmaco (vedi farmaci).", strategy: strategyRefresh, translation },
    };
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
      console.error('cron contenuti fallito:', result.error);
      return { status: 502, body: result };
    }
    await refreshInsightsIfOld();
    await trackPending({ limit: 10 }).catch(() => null);
    return { status: 200, body: result };
  } catch (err) {
    console.error('cron contenuti eccezione:', err);
    return { status: 500, body: { error: err.message || 'Errore sconosciuto.' } };
  }
}
