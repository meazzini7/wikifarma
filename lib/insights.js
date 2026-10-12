// Valutazione degli articoli a partire dai dati reali di GA4.
//
// Metodo (lo stesso gia' validato su WikiTravels):
// - si confronta la PRIMA SETTIMANA di vita di ogni articolo, non il totale:
//   dividere per l'eta' favorirebbe gli articoli nuovi, il totale quelli vecchi.
// - punteggio = visite prima settimana x (1 + min(coinvolgimento medio s, 180) / 60)
// - stati: provvisorio (<7 giorni), confrontabile (7-120), datato (oltre o senza
//   dati osservabili). Solo i confrontabili entrano nelle statistiche di gruppo.
// - gruppi (tema, stile del titolo, categoria) con shrinkage verso la media
//   globale, per non premiare i colpi di fortuna: (n*media + 3*mediaGlobale)/(n+3).
// - l'apprendimento si attiva solo con abbastanza dati; sotto soglia il
//   sistema resta casuale e lo dice, senza promettere nulla.
import { getAdminDb } from './firebaseAdmin';
import { fetchGaData, Ga4Error, isGa4Configured, serviceAccountEmail } from './ga4';
import { loadPosts } from './performanceData';
import { classifyTopic, titleStyleOf } from './performance';

export const SCHEMA_VERSION = 3;

export const CONFIG = {
  lookbackDays: 120,
  windowDays: 28,
  firstWeekDays: 7,
  minComparable: 6,
  minFirstWeekViews: 25,
  exploreProbability: 0.25,
  shrinkK: 3,
  engagementCapSec: 180,
  ttlMs: 12 * 3600 * 1000,
  weightMin: 0.4,
  weightMax: 2.5,
};

// Il sito Next.js e' online dal 13/07/2026: gli articoli precedenti
// vivevano sul vecchio sito con URL diversi, quindi la loro prima settimana
// non e' osservabile sotto questi percorsi e non va confrontata.
export const SITE_LAUNCH_MS = Date.UTC(2026, 6, 13);

const LANGS = new Set(['en', 'es', 'fr', 'de']);
const DAY = 86400000;

const STATIC_NAMES = {
  '': 'Home',
  wellness: 'Benessere (elenco)',
  problems: 'Problemi Frequenti (elenco)',
  diagnosis: 'Diagnosi AI',
  encyclopedia: 'Enciclopedia',
  contact: 'Contatti',
  privacy: 'Privacy',
  'per-te': 'Per Te',
  profile: 'Profilo',
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

const romeFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
function ymd(ms) {
  return romeFmt.format(ms).replace(/-/g, '');
}
function addDaysYmd(s, n) {
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) + n * DAY);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// "/en/slug" -> {lang:'en', slug}; "/slug" -> {lang:'it', slug}; altro -> slug null.
export function parsePath(path = '') {
  const clean = String(path).split('?')[0].split('#')[0];
  const segs = clean.split('/').filter(Boolean);
  if (segs.length === 1) return { lang: 'it', slug: segs[0] };
  if (segs.length === 2 && LANGS.has(segs[0])) return { lang: segs[0], slug: segs[1] };
  return { lang: 'it', slug: null };
}

function staticName(path) {
  const clean = String(path).split('?')[0].replace(/\/+$/, '').replace(/^\//, '');
  if (clean in STATIC_NAMES) return STATIC_NAMES[clean];
  if (clean.startsWith('encyclopedia/')) return `Enciclopedia ${clean.split('/')[1]}`;
  return `/${clean}`;
}

function quantile(sorted, q) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
}

function groupStats(rows, globalMean, keyOf, labelOf) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyOf(r);
    const g = map.get(k) || { id: k, label: labelOf(r), n: 0, sum: 0, views: 0 };
    g.n += 1;
    g.sum += r.score;
    g.views += r.fwViews;
    map.set(k, g);
  });
  return [...map.values()]
    .map((g) => {
      const mean = g.sum / g.n;
      const shrunk = globalMean > 0 ? (g.n * mean + CONFIG.shrinkK * globalMean) / (g.n + CONFIG.shrinkK) : 0;
      const index = globalMean > 0 ? shrunk / globalMean : 1;
      return {
        id: g.id,
        label: g.label,
        n: g.n,
        mean: round(mean),
        index: round(index),
        weight: round(clamp(index, CONFIG.weightMin, CONFIG.weightMax)),
        firstWeekViews: g.views,
      };
    })
    .sort((a, b) => b.index - a.index);
}

// Pura: nessun I/O, testabile con GA e Firestore simulati.
export function buildInsights({ posts, ga, now = Date.now() }) {
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  const windowStart = ymd(now - CONFIG.windowDays * DAY);

  const acc = new Map();
  const staticViews = new Map();
  let views28All = 0;

  ga.pageDaily.forEach((r) => {
    const inWindow = r.date >= windowStart;
    if (inWindow) views28All += r.views;
    const { lang, slug } = parsePath(r.path);
    const post = slug ? bySlug.get(slug) : null;
    if (!post) {
      if (inWindow) staticViews.set(r.path, (staticViews.get(r.path) || 0) + r.views);
      return;
    }
    const a = acc.get(slug) || { byDate: new Map(), views28: 0, intl28: 0, users28: 0, eng28: 0 };
    const d = a.byDate.get(r.date) || { views: 0, users: 0, eng: 0 };
    d.views += r.views;
    d.users += r.users;
    d.eng += r.engagementSec;
    a.byDate.set(r.date, d);
    if (inWindow) {
      a.views28 += r.views;
      a.users28 += r.users;
      a.eng28 += r.engagementSec;
      if (lang !== 'it') a.intl28 += r.views;
    }
    acc.set(slug, a);
  });

  const rows = posts.map((p) => {
    const a = acc.get(p.slug);
    const created = p.created_at || 0;
    const ageDays = created ? (now - created) / DAY : null;
    let status = 'outdated';
    if (created && created >= SITE_LAUNCH_MS) {
      if (ageDays < CONFIG.firstWeekDays) status = 'provisional';
      else if (ageDays <= CONFIG.lookbackDays) status = 'comparable';
    }

    let fwViews = 0;
    let fwUsers = 0;
    let fwEng = 0;
    if (a && created) {
      const start = ymd(created);
      const end = addDaysYmd(start, CONFIG.firstWeekDays);
      a.byDate.forEach((d, date) => {
        if (date >= start && date < end) {
          fwViews += d.views;
          fwUsers += d.users;
          fwEng += d.eng;
        }
      });
    }
    const fwEngSec = fwUsers > 0 ? fwEng / fwUsers : 0;
    const theme = classifyTopic(p.title, p.snippet, p.category);
    const style = titleStyleOf(p.title);

    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      gen_mode: p.gen_mode,
      created_at: created,
      ageDays: ageDays === null ? null : round(ageDays, 1),
      status,
      theme: theme.id,
      themeLabel: theme.label,
      style: style.id,
      styleLabel: style.label,
      fwViews,
      fwEngSec: round(fwEngSec, 1),
      score: round(fwViews * (1 + Math.min(fwEngSec, CONFIG.engagementCapSec) / 60)),
      views28: a ? a.views28 : 0,
      intl28: a ? a.intl28 : 0,
      engSec28: a && a.users28 > 0 ? round(a.eng28 / a.users28, 1) : 0,
    };
  });

  const comp = rows.filter((r) => r.status === 'comparable');
  const globalMean = comp.length ? sum(comp, (r) => r.score) / comp.length : 0;
  const fwViewsTotal = sum(comp, (r) => r.fwViews);

  const learning = {
    active: comp.length >= CONFIG.minComparable && fwViewsTotal >= CONFIG.minFirstWeekViews,
    comparable: comp.length,
    firstWeekViews: fwViewsTotal,
    needArticles: CONFIG.minComparable,
    needViews: CONFIG.minFirstWeekViews,
    exploreProbability: CONFIG.exploreProbability,
  };

  const themes = groupStats(comp, globalMean, (r) => r.theme, (r) => r.themeLabel);
  const styles = groupStats(comp, globalMean, (r) => r.style, (r) => r.styleLabel);
  const categories = groupStats(comp, globalMean, (r) => r.category, (r) => r.category);

  const lite = (r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category, gen_mode: r.gen_mode,
    themeLabel: r.themeLabel, styleLabel: r.styleLabel, fwViews: r.fwViews, fwEngSec: r.fwEngSec,
    score: r.score, views28: r.views28, engSec28: r.engSec28, ageDays: r.ageDays,
  });

  const ranked = [...comp].sort((a, b) => b.score - a.score);
  const top = ranked.filter((r) => r.score > 0).slice(0, 5).map(lite);
  // "Deboli" = sotto la media dei confrontabili: con pochi articoli il
  // fondo della classifica altrimenti coinciderebbe con tutta la lista.
  const bottom = [...ranked].reverse().filter((r) => r.score < globalMean).slice(0, 5).map(lite);

  const withViews = rows.filter((r) => r.views28 > 0);
  const viewsSorted = withViews.map((r) => r.views28).sort((a, b) => a - b);
  const p75 = Math.max(5, quantile(viewsSorted, 0.75));
  const median = quantile(viewsSorted, 0.5);
  const leaky = rows
    .filter((r) => r.views28 >= p75 && r.engSec28 < 15)
    .sort((a, b) => b.views28 - a.views28)
    .slice(0, 8)
    .map(lite);
  const gems = rows
    .filter((r) => r.views28 >= 3 && r.views28 <= Math.max(median, 3) && r.engSec28 >= 60)
    .sort((a, b) => b.engSec28 - a.engSec28)
    .slice(0, 8)
    .map(lite);

  const modes = ['exploit', 'explore'].map((m) => {
    const g = comp.filter((r) => r.gen_mode === m);
    return { mode: m, n: g.length, avgScore: g.length ? round(sum(g, (r) => r.score) / g.length) : null };
  });

  const topPages = [
    ...rows.filter((r) => r.views28 > 0).map((r) => ({ name: r.title, views: r.views28, article: true })),
    ...[...staticViews.entries()].map(([path, views]) => ({ name: staticName(path), views, article: false })),
  ]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const articleViews28 = sum(rows, (r) => r.views28);
  const intlViews28 = sum(rows, (r) => r.intl28);
  const totals = {
    articles: rows.length,
    comparable: comp.length,
    provisional: rows.filter((r) => r.status === 'provisional').length,
    outdated: rows.filter((r) => r.status === 'outdated').length,
    views28All,
    articleViews28,
    articlesWithViews28: withViews.length,
    intlShare28: articleViews28 > 0 ? round(intlViews28 / articleViews28) : 0,
    comparableNoViews: comp.filter((r) => r.fwViews === 0).length,
  };

  const channels = [...ga.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  const countries = [...ga.countries].sort((a, b) => b.users - a.users).slice(0, 6);

  return {
    learning,
    totals,
    themes,
    styles,
    categories,
    weights: {
      theme: Object.fromEntries(themes.map((g) => [g.id, g.weight])),
      style: Object.fromEntries(styles.map((g) => [g.id, g.weight])),
      category: Object.fromEntries(categories.map((g) => [g.id, g.weight])),
    },
    top,
    bottom,
    leaky,
    gems,
    modes,
    topPages,
    channels,
    countries,
    recommendations: buildRecommendations({ learning, themes, styles, leaky, gems, totals }),
  };
}

function buildRecommendations({ learning, themes, styles, leaky, gems, totals }) {
  const recs = [];
  if (!learning.active) {
    recs.push(
      `Apprendimento in attesa di dati: ${learning.comparable}/${learning.needArticles} articoli confrontabili e ` +
        `${learning.firstWeekViews}/${learning.needViews} visite di prima settimana. Finché non scatta, gli articoli vengono scelti a caso: nessuna promessa dal sistema.`
    );
  } else {
    const bestTheme = themes.find((t) => t.n >= 2 && t.index >= 1.15);
    const bestStyle = styles.find((s) => s.n >= 2 && s.index >= 1.15);
    if (bestTheme || bestStyle) {
      recs.push(
        'Spingere: ' +
          [bestTheme && `tema «${bestTheme.label}» (${bestTheme.index}× la media)`, bestStyle && `titoli in stile «${bestStyle.label}» (${bestStyle.index}×)`]
            .filter(Boolean)
            .join(' e ') +
          '.'
      );
    }
    const worstTheme = [...themes].reverse().find((t) => t.n >= 3 && t.index <= 0.7);
    const worstStyle = [...styles].reverse().find((s) => s.n >= 3 && s.index <= 0.7);
    if (worstTheme || worstStyle) {
      recs.push(
        'Ridurre: ' +
          [worstTheme && `tema «${worstTheme.label}» (${worstTheme.index}×)`, worstStyle && `titoli «${worstStyle.label}» (${worstStyle.index}×)`]
            .filter(Boolean)
            .join(' e ') +
          '.'
      );
    }
  }
  if (leaky.length) {
    recs.push(
      `${leaky.length} ${leaky.length === 1 ? 'articolo riceve' : 'articoli ricevono'} visite ma quasi nessuna lettura (meno di 15 s): rivedere apertura e struttura. ` +
        'Anche la resa degli annunci dipende dal tempo di permanenza.'
    );
  }
  if (gems.length) {
    recs.push(
      `${gems.length} ${gems.length === 1 ? 'articolo è letto' : 'articoli sono letti'} a fondo (oltre 60 s) ma ${gems.length === 1 ? 'poco visto' : 'poco visti'}: ` +
        'candidati ideali per link interni, aggiornamenti SEO e condivisione.'
    );
  }
  if (totals.intlShare28 >= 0.2 && totals.articleViews28 >= 30) {
    recs.push(`Il ${Math.round(totals.intlShare28 * 100)}% delle visite agli articoli arriva dalle versioni tradotte: estendere le traduzioni ai temi che rendono.`);
  }
  return recs.slice(0, 3);
}

// --- I/O: cache in Firestore (analytics/insights), TTL 12h ---------------

function setupInfo(code, message) {
  return {
    ok: false,
    setup: {
      code,
      message,
      service_account: serviceAccountEmail(),
      property_id_set: Boolean(process.env.GA4_PROPERTY_ID),
    },
  };
}

// maxAgeMs: eta' massima accettata per lo snapshot in cache (il cruscotto usa
// il TTL di 12h, la generazione tollera piu' giorni: meglio dati un po' vecchi
// che una chiamata a GA4 dentro il cron).
export async function getInsights({ force = false, maxAgeMs = CONFIG.ttlMs } = {}) {
  if (!isGa4Configured()) {
    return setupInfo('not_configured', 'Manca GA4_PROPERTY_ID (o le credenziali Firebase Admin) su Vercel.');
  }

  const ref = getAdminDb().collection('analytics').doc('insights');
  let cached = null;
  try {
    const snap = await ref.get();
    if (snap.exists && snap.data().schemaVersion === SCHEMA_VERSION) cached = snap.data();
  } catch {
    // lettura cache fallita: si prosegue senza
  }

  if (cached && !force && Date.now() - cached.generated_at < maxAgeMs) {
    return { ok: true, report: JSON.parse(cached.report_json), meta: { source: 'cache', generated_at: cached.generated_at } };
  }

  try {
    const [posts, ga] = await Promise.all([loadPosts(), fetchGaData({ lookbackDays: CONFIG.lookbackDays, windowDays: CONFIG.windowDays })]);
    const report = buildInsights({ posts, ga });
    const generated_at = Date.now();
    try {
      await ref.set({ schemaVersion: SCHEMA_VERSION, generated_at, report_json: JSON.stringify(report) });
    } catch (err) {
      console.error('insights: salvataggio snapshot fallito:', err);
    }
    return { ok: true, report, meta: { source: 'live', generated_at } };
  } catch (err) {
    console.error('insights: errore GA4:', err);
    // Se GA non risponde si usa l'ultimo snapshot buono, dichiarandolo.
    if (cached) {
      return {
        ok: true,
        report: JSON.parse(cached.report_json),
        meta: { source: 'stale', generated_at: cached.generated_at, ga_error: err.message },
      };
    }
    const code = err instanceof Ga4Error ? err.code : 'unknown';
    return setupInfo(code, err.message || 'Errore sconosciuto nella lettura di GA4.');
  }
}
