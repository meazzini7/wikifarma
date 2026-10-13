// Strategia editoriale appresa dai dati reali di GA4 (vedi lib/insights.js).
//
// Due livelli:
// - PESI (tema, stile del titolo, categoria): calcolati da lib/insights.js
//   sui dati GA4, sempre freschi (cache 12h); decidono COSA generare.
// - PARTE QUALITATIVA (brief editoriale, idee di titolo, farmaci da anticipare):
//   una chiamata Gemini a settimana, salvata in strategy/current; decide COME
//   scrivere. Ricostruita nel giorno libero della route cron/content, cosi'
//   non pesa sulla generazione quotidiana.
//
// Principio: sfruttamento + esplorazione. Con probabilita' 75% (e solo se
// l'apprendimento e' attivo, cioe' ci sono abbastanza dati) argomento e
// categoria sono scelti dai pesi; nel restante 25% resta tutto casuale, cosi'
// il sistema non si chiude sui temi gia' noti. Sotto soglia dati resta
// sempre casuale, senza promettere nulla. Ogni articolo salva gen_mode, quindi
// il pannello misura se la strategia batte davvero il caso.
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin';
import { callGemini, isGeminiConfigured } from './gemini';
import { getExistingTitlesLower } from './articleGenerator';
import { CONFIG, getInsights } from './insights';
import { DRUG_TOPICS } from './cronTopics';
import { getPostBySlug } from './firestore';
import { getOrCreateTranslation, isTranslatable } from './translate';
import { classifyTopic, titleStyleOf, weightedPick } from './performance';

const STALE_AFTER_MS = 7 * 86400000;
const PLAN_MAX_INSIGHTS_AGE_MS = 3 * 86400000;
const LLM_TIMEOUT_MS = 25000;

export async function getStrategy() {
  const snap = await getAdminDb().collection('strategy').doc('current').get();
  return snap.exists ? snap.data() : null;
}

function isStale(strategy) {
  return !strategy || !strategy.built_at_ms || Date.now() - strategy.built_at_ms > STALE_AFTER_MS;
}

function norm(s = '') {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokens(s) {
  return new Set(
    norm(s)
      .replace(/\(.*?\)/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter += 1;
  });
  return inter / (a.size + b.size - inter);
}

function cleanTopic(t) {
  const s = String(t || '')
    .replace(/\(\s*guida[^)]*\)/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!]+$/, '');
  return s.length >= 20 && s.length <= 90 ? s : null;
}

export function buildStrategyPrompt({ winners, losers, strongThemes, strongStyles, weakThemes, drugCandidates }) {
  const fmt = (list) => (list.length ? list.map((w) => `- ${w.title} | ${w.category} | ${w.detail}`).join('\n') : '- (nessun dato)');
  return `Sei il direttore editoriale di WikiFarma, portale italiano di informazione sanitaria monetizzato con pubblicità. Decidi dove concentrare i prossimi articoli in base ai dati reali di lettura (prima settimana di vita di ogni articolo, da Google Analytics).

ARTICOLI CHE HANNO FUNZIONATO MEGLIO:
${fmt(winners)}

ARTICOLI CHE HANNO FUNZIONATO PEGGIO:
${fmt(losers)}

TEMI FORTI: ${strongThemes.join(', ') || 'nessuno in particolare'}
TEMI DEBOLI: ${weakThemes.join(', ') || 'nessuno in particolare'}
STILI DI TITOLO FORTI: ${strongStyles.join(', ') || 'nessuno in particolare'}

Rispondi SOLO con un oggetto JSON valido (niente markdown) in questa forma esatta:
{"focus_brief":"...","suggested_topics":{"Benessere":["..."],"Problemi Frequenti":["..."]},"drug_picks":["..."]}

Regole:
- focus_brief: 4-6 frasi IMPERATIVE rivolte a chi scrive (max 800 caratteri) su cosa hanno in comune gli articoli vincenti (angolazione, formato, concretezza) e quindi come impostare i prossimi. Basati SOLO su ciò che è scritto sopra: non dedurre mai che un tipo di contenuto "funziona meno" se non compare tra i peggiori, e non fare affermazioni sul pubblico che i dati non mostrano. Nessuna statistica inventata.
- suggested_topics: 6 titoli NUOVI per Benessere e 6 per Problemi Frequenti, NON duplicati né quasi-duplicati di articoli già esistenti. Devono imitare il FORMATO dei vincenti: una domanda o decisione concreta del paziente (costi, tempi, terapie, quando operare o rivolgersi allo specialista, confronto tra opzioni). Evita titoli generici da rivista di benessere ("consigli per...", "l'importanza di...", "i benefici di..."). Specifici, 25-80 caratteri, senza anno, tono informativo (no clickbait). Mai argomenti che promettono guarigioni miracolose o sostituiscono cure mediche.
- drug_picks: scegli fino a 6 nomi dalla lista seguente (copiali ESATTAMENTE), quelli con più probabilità di interessare lo stesso pubblico dei vincenti:
${drugCandidates.join(', ')}`;
}

export function parseStrategyResponse(raw, { existingBases, drugCandidates }) {
  const match = raw && raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  const brief = typeof parsed.focus_brief === 'string' ? parsed.focus_brief.trim().slice(0, 900) : '';

  const seen = [...existingBases];
  const suggested = {};
  ['Benessere', 'Problemi Frequenti'].forEach((cat) => {
    const list = Array.isArray(parsed.suggested_topics?.[cat]) ? parsed.suggested_topics[cat] : [];
    suggested[cat] = [];
    list.forEach((raw2) => {
      const topic = cleanTopic(raw2);
      if (!topic || suggested[cat].length >= 6) return;
      const tk = tokens(topic);
      if (seen.some((s) => jaccard(tk, s) >= 0.5)) return;
      seen.push(tk);
      suggested[cat].push(topic);
    });
  });

  const canonical = new Map(drugCandidates.map((d) => [d.toLowerCase(), d]));
  const picks = [];
  (Array.isArray(parsed.drug_picks) ? parsed.drug_picks : []).forEach((d) => {
    const hit = canonical.get(String(d || '').toLowerCase().trim());
    if (hit && !picks.includes(hit) && picks.length < 6) picks.push(hit);
  });

  if (!brief && !suggested.Benessere.length && !suggested['Problemi Frequenti'].length && !picks.length) return null;
  return { focus_brief: brief, suggested_topics: suggested, drug_picks: picks };
}

// Ricostruisce la parte qualitativa. Accetta un risultato di getInsights gia'
// letto (evita una seconda chiamata a GA4); altrimenti lo legge forzando.
export async function rebuildStrategy(insightsResult) {
  const res = insightsResult || (await getInsights({ force: true }));
  if (!res.ok) return { ok: false, setup: res.setup };

  const { report } = res;
  const db = getAdminDb();
  const base = { built_at_ms: Date.now(), active: report.learning.active };

  if (!report.learning.active) {
    // Nessuna chiamata Gemini sprecata finche' i dati non bastano.
    const doc = { ...base, basis: { winners: [], losers: [] }, focus_brief: '', suggested_topics: { Benessere: [], 'Problemi Frequenti': [] }, drug_picks: [], llm_ok: false };
    await db.collection('strategy').doc('current').set({ ...doc, built_at: FieldValue.serverTimestamp() });
    return { ok: true, doc };
  }

  const detail = (r) => `${r.fwViews} visite nella prima settimana, ${Math.round(r.fwEngSec)} s di lettura media`;
  const winners = report.top.slice(0, 8).map((r) => ({ title: r.title, category: r.category, detail: detail(r) }));
  const losers = report.bottom.slice(0, 5).map((r) => ({ title: r.title, category: r.category, detail: detail(r) }));

  let llm = null;
  if (isGeminiConfigured()) {
    try {
      const existing = await getExistingTitlesLower();
      const existingBases = [...existing].map((t) => tokens(t));
      const drugCandidates = DRUG_TOPICS.filter((t) => !existing.has(t.toLowerCase())).slice(0, 90);
      const prompt = buildStrategyPrompt({
        winners,
        losers,
        strongThemes: report.themes.filter((t) => t.n >= 2 && t.index >= 1.15).map((t) => t.label),
        weakThemes: report.themes.filter((t) => t.n >= 3 && t.index <= 0.7).map((t) => t.label),
        strongStyles: report.styles.filter((s) => s.n >= 2 && s.index >= 1.15).map((s) => s.label),
        drugCandidates,
      });
      const raw = await Promise.race([
        callGemini(prompt),
        new Promise((resolve) => {
          setTimeout(() => resolve(null), LLM_TIMEOUT_MS);
        }),
      ]);
      llm = parseStrategyResponse(raw, { existingBases, drugCandidates });
    } catch (err) {
      console.error('Strategia: chiamata Gemini fallita:', err);
    }
  }

  const doc = {
    ...base,
    basis: { winners: winners.map((w) => w.title), losers: losers.map((l) => l.title) },
    focus_brief: llm?.focus_brief || '',
    suggested_topics: llm?.suggested_topics || { Benessere: [], 'Problemi Frequenti': [] },
    drug_picks: llm?.drug_picks || [],
    llm_ok: Boolean(llm),
  };
  await db.collection('strategy').doc('current').set({ ...doc, built_at: FieldValue.serverTimestamp() });
  return { ok: true, doc };
}

// Giorno libero della route: dati GA freschi sempre, parte Gemini solo se
// la strategia ha piu' di 7 giorni.
export async function refreshStrategyIfStale() {
  const res = await getInsights({ force: true });
  if (!res.ok) return { refreshed: false, reason: res.setup.code };
  const current = await getStrategy().catch(() => null);
  if (!isStale(current)) return { refreshed: false, insights: 'aggiornati' };
  const out = await rebuildStrategy(res);
  return { refreshed: true, active: out.doc?.active, llm_ok: out.doc?.llm_ok };
}

function composeBrief(strategy) {
  if (!strategy) return '';
  const parts = [];
  if (strategy.focus_brief) parts.push(strategy.focus_brief);
  const winners = (strategy.basis?.winners || []).slice(0, 5);
  if (winners.length) parts.push(`Titoli che hanno attirato più lettori (ispirati al formato, senza copiarli): ${winners.join(' | ')}`);
  const losers = (strategy.basis?.losers || []).slice(0, 3);
  if (losers.length) parts.push(`Titoli con poco riscontro (da non imitare): ${losers.join(' | ')}`);
  return parts.join('\n');
}

// Piano di generazione: legge pesi (insights, cache) e parte qualitativa.
// exploit=false => tutto casuale come prima. Ogni errore degrada a casuale.
export async function getGenerationPlan() {
  try {
    const res = await getInsights({ maxAgeMs: PLAN_MAX_INSIGHTS_AGE_MS });
    if (!res.ok || !res.report.learning.active) return { exploit: false };
    const strategy = await getStrategy().catch(() => null);
    const exploit = Math.random() >= CONFIG.exploreProbability;
    return {
      exploit,
      weights: res.report.weights,
      strategy,
      brief: exploit && strategy?.active ? composeBrief(strategy) : '',
    };
  } catch (err) {
    console.error('Strategia: piano di generazione non disponibile, si procede a caso:', err);
    return { exploit: false };
  }
}

export function chooseCategory(plan, fallback) {
  if (!plan.exploit) return fallback;
  const cats = ['Benessere', 'Problemi Frequenti'];
  return weightedPick(cats, (c) => plan.weights.category?.[c] ?? 1) || fallback;
}

// Argomento per benessere/problemi: 50% un'idea nuova della strategia (se
// disponibile), altrimenti un argomento curato non ancora usato, pesato per
// tema e stile del titolo.
export async function chooseContentTopic({ category, topics, plan, existing: known }) {
  if (!plan.exploit) return null;

  const existing = known || (await getExistingTitlesLower());
  const year = new Date().getFullYear();
  const withYear = (base) => `${base} (Guida ${year})`;
  const free = (base) => !existing.has(base.toLowerCase()) && !existing.has(withYear(base).toLowerCase());

  const suggested = (plan.strategy?.suggested_topics?.[category] || []).filter(free);
  if (suggested.length && Math.random() < 0.5) return { topic: withYear(suggested[0]) };

  const w = plan.weights;
  const pick = weightedPick(
    topics.filter(free),
    (t) => (w.theme?.[classifyTopic(t).id] ?? 1) * (w.style?.[titleStyleOf(t).id] ?? 1)
  );
  return pick ? { topic: withYear(pick) } : null;
}

// Farmaco: la lista resta quella storica (ordine di priorita'), ma quando si
// sfrutta si anticipa uno dei farmaci che la strategia ritiene piu' promettenti.
export async function chooseDrugTopic({ plan, existing: known }) {
  if (!plan.exploit) return null;
  const picks = plan.strategy?.drug_picks || [];
  if (!picks.length) return null;
  const existing = known || (await getExistingTitlesLower());
  const next = picks.find((d) => !existing.has(String(d).toLowerCase()));
  return next ? { topic: next } : null;
}

// Giorno libero del cron: traduce in inglese l'articolo piu' letto che non lo
// e' ancora. Le pagine tradotte mostrano come "correlati" solo articoli gia'
// tradotti (linkare gli altri farebbe partire traduzioni in massa dai
// crawler), quindi il pool in inglese cresce cosi', con un articolo ogni due
// giorni e partendo da quelli che hanno traffico reale.
export async function translateNextPopular(lang = 'en') {
  const res = await getInsights({ maxAgeMs: 7 * 86400000 });
  if (!res.ok) return { translated: false, reason: 'no_insights' };
  for (const p of res.report.popular) {
    if (!isTranslatable(p.category)) continue;
    // eslint-disable-next-line no-await-in-loop
    const post = await getPostBySlug(p.slug);
    if (!post || post.translations?.[lang]) continue;
    // eslint-disable-next-line no-await-in-loop
    const t = await getOrCreateTranslation(post, lang);
    return { translated: Boolean(t), slug: p.slug };
  }
  return { translated: false, reason: 'nothing_to_do' };
}
