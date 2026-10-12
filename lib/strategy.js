// Strategia editoriale appresa dalle performance: orienta cosa e come
// generare. Ricostruita al massimo una volta a settimana (e su richiesta dal
// pannello /admin/insights), salvata in strategy/current e solo LETTA al
// momento di generare un articolo - cosi' il costo extra (lettura dati +
// una chiamata Gemini) non pesa sulla generazione quotidiana.
//
// Principio: sfruttamento + esplorazione. Con probabilita' exploit_prob
// l'argomento viene scelto dalla strategia (temi che rendono, idee nuove nello
// stesso filone); altrimenti resta casuale. L'esplorazione non scende mai
// sotto il 35%, cosi' il sistema non si chiude su pochi temi e continua a
// scoprire cosa funziona. Ogni articolo salva gen_mode, quindi il pannello
// puo' misurare se la strategia batte davvero il caso.
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin';
import { callGemini, isGeminiConfigured } from './gemini';
import { loadPerformanceData } from './performanceData';
import { getExistingTitlesLower } from './articleGenerator';
import { DRUG_TOPICS } from './cronTopics';
import { buildReport, classifyTopic, PRIOR_WINNERS, priorThemeWeights, weightedPick } from './performance';

const STALE_AFTER_MS = 7 * 86400000;
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

function mergeWeights(dataWeights, priorWeights, level) {
  if (level === 'solid') return dataWeights;
  if (level === 'cold') return priorWeights;
  const keys = new Set([...Object.keys(dataWeights), ...Object.keys(priorWeights)]);
  const out = {};
  keys.forEach((k) => {
    out[k] = Math.round((((dataWeights[k] ?? 0.3) + (priorWeights[k] ?? 0.3)) / 2) * 100) / 100;
  });
  return out;
}

export function buildStrategyPrompt({ winners, losers, themes, level, drugCandidates }) {
  const winnersText = winners.length
    ? winners.map((w) => `- ${w.title} | ${w.category} | ${w.detail}`).join('\n')
    : '- (nessun dato)';
  const losersText = losers.length ? losers.map((w) => `- ${w.title} | ${w.category} | ${w.detail}`).join('\n') : '- (nessun dato)';
  const themesText = themes.slice(0, 5).map((t) => t.label).join(', ') || 'nessuno';
  const caution =
    level === 'solid'
      ? ''
      : '\nATTENZIONE: i dati sono ancora pochi. Trattali come indizi, non come verita\': non estremizzare.\n';

  return `Sei il direttore editoriale di WikiFarma, portale italiano di informazione sanitaria monetizzato con pubblicità. Decidi dove concentrare i prossimi articoli in base ai dati reali di lettura.
${caution}
ARTICOLI CHE HANNO FUNZIONATO MEGLIO:
${winnersText}

ARTICOLI CHE HANNO FUNZIONATO PEGGIO:
${losersText}

TEMI PIÙ FORTI: ${themesText}

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
    list.forEach((raw) => {
      const topic = cleanTopic(raw);
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

export async function rebuildStrategy() {
  const { posts, stats } = await loadPerformanceData();
  const report = buildReport(posts, stats);
  const level = report.confidence.level;

  const useData = level !== 'cold' || report.confidence.articlesWithViews >= 5;
  const winners = useData
    ? report.top
        .filter((r) => r.views >= 3)
        .slice(0, 10)
        .map((r) => ({
          title: r.title,
          category: r.category,
          detail: `${r.views} visite, ${r.engaged} letture complete, ${r.shares + r.favs} azioni`,
        }))
    : PRIOR_WINNERS.map((w) => ({ title: w.title, category: w.category, detail: `${w.views} visite (Google Analytics, 7 giorni)` }));
  const losers = useData
    ? report.bottom
        .slice(0, 6)
        .map((r) => ({ title: r.title, category: r.category, detail: `${r.views} visite, ${r.engaged} letture complete` }))
    : [];

  const theme_weights = mergeWeights(report.theme_weights, priorThemeWeights(), level);

  let llm = null;
  if (isGeminiConfigured()) {
    try {
      const existing = await getExistingTitlesLower();
      const existingBases = [...existing].map((t) => tokens(t));
      const drugCandidates = DRUG_TOPICS.filter((t) => !existing.has(t.toLowerCase())).slice(0, 90);
      const prompt = buildStrategyPrompt({ winners, losers, themes: report.themes, level, drugCandidates });
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
    built_at_ms: Date.now(),
    confidence: level,
    exploit_prob: report.confidence.exploit,
    theme_weights,
    basis: {
      winners: winners.map((w) => w.title),
      losers: losers.map((l) => l.title),
      top_themes: report.themes.slice(0, 4).map((t) => t.label),
    },
    focus_brief: llm?.focus_brief || '',
    suggested_topics: llm?.suggested_topics || { Benessere: [], 'Problemi Frequenti': [] },
    drug_picks: llm?.drug_picks || [],
    llm_ok: Boolean(llm),
  };

  await getAdminDb()
    .collection('strategy')
    .doc('current')
    .set({ ...doc, built_at: FieldValue.serverTimestamp() });
  return doc;
}

export async function refreshStrategyIfStale() {
  const current = await getStrategy();
  if (!isStale(current)) return { refreshed: false };
  const doc = await rebuildStrategy();
  return { refreshed: true, confidence: doc.confidence, llm_ok: doc.llm_ok };
}

// Scelta dell'argomento per benessere/problemi. Ritorna null quando conviene
// l'esplorazione (scelta casuale classica) o non c'e' strategia.
export async function chooseContentTopic({ category, topics, strategy }) {
  if (!strategy || Math.random() >= (strategy.exploit_prob ?? 0)) return null;

  const existing = await getExistingTitlesLower();
  const year = new Date().getFullYear();
  const withYear = (base) => `${base} (Guida ${year})`;
  const free = (base) => !existing.has(base.toLowerCase()) && !existing.has(withYear(base).toLowerCase());

  const suggested = (strategy.suggested_topics?.[category] || []).filter(free);
  if (suggested.length && Math.random() < 0.5) {
    return { topic: withYear(suggested[0]), mode: 'exploit' };
  }

  const weights = strategy.theme_weights || {};
  const pick = weightedPick(topics.filter(free), (t) => weights[classifyTopic(t).id] ?? 0.3);
  return pick ? { topic: withYear(pick), mode: 'exploit' } : null;
}

// Scelta del farmaco: la lista resta quella storica (ordine di priorita'),
// ma con probabilita' exploit_prob si anticipa uno dei farmaci che la
// strategia ritiene piu' promettenti.
export async function chooseDrugTopic({ strategy }) {
  if (!strategy || Math.random() >= (strategy.exploit_prob ?? 0)) return null;
  const picks = strategy.drug_picks || [];
  if (!picks.length) return null;
  const existing = await getExistingTitlesLower();
  const next = picks.find((d) => !existing.has(String(d).toLowerCase()));
  return next ? { topic: next, mode: 'exploit' } : null;
}
