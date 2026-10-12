// Motore di valutazione delle performance editoriali (puro, senza I/O):
// trasforma i contatori anonimi per articolo (collection article_stats) in
// punteggi, classifiche per tema e raccomandazioni. Usato sia dal pannello
// segreto (/admin/insights) sia dalla strategia che orienta la generazione
// automatica (lib/strategy.js).

// Le misure proprietarie partono da qui: le visite precedenti restano
// visibili solo su GA4. Serve a non penalizzare/avvantaggiare gli articoli
// in base a un'esposizione che non abbiamo mai misurato.
export const TRACKING_START_MS = Date.UTC(2026, 9, 12);

// Peso dei segnali: lettura reale e azioni volontarie valgono molto piu' di
// una semplice apertura di pagina (tempo e scroll sono cio' che porta
// annunci visualizzati davvero). views_intl e' un piccolo bonus: il traffico
// estero (US in primis) rende di norma di piu' per visualizzazione.
export const WEIGHTS = { views: 1, engaged: 3, deep: 3, shares: 5, favs: 5, views_intl: 1 };

const COUNTERS = ['views', 'engaged', 'deep', 'shares', 'favs', 'views_intl'];

// Soglie di fiducia: con poco traffico i numeri sono indizi, non verita'.
const CONFIDENCE = [
  { level: 'solid', minViews: 150, minArticles: 12, exploit: 0.65 },
  { level: 'emerging', minViews: 40, minArticles: 5, exploit: 0.5 },
  { level: 'cold', minViews: 0, minArticles: 0, exploit: 0.35 },
];

// Segnale iniziale preso da Google Analytics (ultimi 7 giorni al 11/10/2026),
// usato finche' le misure proprie sono troppo scarse per orientare da sole.
// Numeri minuscoli: valgono come indizio di partenza, mai come prova.
export const PRIOR_WINNERS = [
  { title: 'Helicobacter Pylori: terapia antibiotica pesante', category: 'Problemi Frequenti', views: 9 },
  { title: 'Costo corona dentale in ceramica vs zirconio', category: 'Problemi Frequenti', views: 6 },
  { title: 'Cataratta: quando operare e tempi attesa', category: 'Problemi Frequenti', views: 6 },
  { title: 'Aulin', category: 'Farmaco', views: 2 },
  { title: 'Migliori creme per dermatite atopica', category: 'Problemi Frequenti', views: 1 },
];

function norm(s = '') {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Ordine = priorita': il primo tema che combacia vince (i piu' specifici
// prima). cpc e' una STIMA mia della domanda pubblicitaria tipica per tema
// (dentale/estetica/cardio tendono a pagare di piu'), non un dato AdSense:
// va sostituita con gli RPM reali appena disponibili.
const THEMES = [
  { id: 'occhi_orecchie', label: 'Occhi e orecchie', cpc: 1.2, re: /cataratt|glaucom|maculopat|congiuntiv|acufene|apparecchio acustico|laser occhi|\bocchi\b|\bvista\b|occhiaie|fischiano|udito|orecchi/ },
  { id: 'dentale', label: 'Dentale', cpc: 1.5, re: /\bdent|gengiv|implant|ortodon|sbiancament|carie|bruxism|alito|\bbite\b|corona dentale|faccett|devitalizz|apparecchio invisibile|protesi/ },
  { id: 'estetica', label: 'Estetica e chirurgia', cpc: 1.4, re: /botox|filler|ialuronic|rinoplast|liposuz|blefaroplast|mastoplast|tatuagg|laser|trapianto capelli|caduta capelli|capelli|cellulite|smagliatur|antirugh|rughe|macchie|acne|finasteride|minoxidil|alopecia/ },
  { id: 'cute', label: 'Pelle', cpc: 1.1, re: /dermatit|psoriasi|rosacea|verruc|funghi della pelle|\bnei\b|\bneo\b|mappatura|eczema|prurito|pelle|crema|creme|scottatur|ustion|zanzara|aloe/ },
  { id: 'mentale_sonno', label: 'Mente e sonno', cpc: 1.0, re: /ansia|panico|depress|burnout|insonnia|melatonina|sonno|dormire|stress|meditazion|mindfulness|solitudine|procrastin|gratitudine|relazioni tossiche|derealizz|psicoterap|\bmente\b|cervello|memoria|concentrazione|umore/ },
  { id: 'uro_ginecologia', label: 'Urologia e ginecologia', cpc: 1.2, re: /cistite|candida|prostat|testosterone|mestru|endometriosi|ciste ovarich|cisti ovarich|viagra|cialis|levitra|erettile|menopausa|gravidanz|ovaie|ginecolog|urin/ },
  { id: 'cuore_metabolismo', label: 'Cuore e metabolismo', cpc: 1.3, re: /pression|colesterol|diabete|ipertension|cuore|infarto|gotta|glicemi|trigliceridi|circolazione|gambe gonfie|tiroid|obesita|dimagr|\bpeso\b/ },
  { id: 'ossa_dolore', label: 'Dolore e apparato muscolo-scheletrico', cpc: 1.2, re: /schiena|lombar|cervical|sciatalg|tunnel carpale|artrosi|\bernia\b|fascite|spalla|menisco|alluce|osteopor|fibromialg|muscol|crampi|postura|stretching|ginocchio|articolaz|dolor|mal di testa|pilates|camminata/ },
  { id: 'digestivo', label: 'Apparato digerente', cpc: 1.0, re: /reflusso|gastr|colon|helicobacter|emorroid|ragadi|intestin|digestion|digerire|lattosio|celiachia|diverticol|probiotic|fibre|fegato|pancia|addominal|stomaco|microbioma|nausea/ },
  { id: 'respiratorio', label: 'Respiro e infezioni', cpc: 1.0, re: /influenza|raffreddore|bronch|sinusit|otite|asma|febbre|virus|batter|antibiot|vaccin|tosse|\bgola\b|sistema immunitario|singhiozzo|starnut|allerg|\bnaso\b|suffumig|respir|polmon/ },
  { id: 'alimentazione', label: 'Alimentazione e integratori', cpc: 0.9, re: /dieta|vitamina|magnesio|omega|zenzero|curcuma|superfood|noci|\bsemi\b|integrator|zucchero|colazione|mirtill|avocado|te verde|cioccolat|\bolio\b|\bacqua\b|limone|miele|melograno|digiuno|aliment|\bcibo\b|\bcibi\b|mangiar|\bferro\b|calcio|potassio|collagene|zinco|selenio|papaya|quinoa|amaranto|grano|\briso\b|farro|orzo|avena|segale|miglio|tofu|seitan|aceto|bicarbonato|camomilla|tisane|kefir|miso|etichett|\bsale\b|caffeina|nutriz|banan/ },
  { id: 'stile_vita', label: 'Stile di vita e prevenzione', cpc: 0.9, re: /sedentari|doccia|sauna|bagno turco|massaggio|natura|animale|plastica|inquinamento|scarpe|correre|\bfumo\b|fumare|abbracci|contatto fisico|ridere|unghie|protezione solare|\bmani\b|russare|\bafte\b|argilla|scrub|mal d'auto|impacchi|lavaggi nasali|salute mentale|giocare/ },
  { id: 'curiosita_corpo', label: 'Curiosità sul corpo umano', cpc: 0.9, re: /perche|come funziona|come guariscono|mistero|effetto placebo|sbadigl|impronte|\bsangue\b|\breni\b|sudiamo|appendice|termoregolazione/ },
];

const OTHER_THEME = { id: 'altro', label: 'Altri temi di benessere', cpc: 0.9 };

// Le schede farmaco si classificano per indicazione (primi ~500 caratteri
// del contenuto), non per nome commerciale.
const DRUG_CLASSES = [
  { id: 'farmaci_sessuale', label: 'Farmaci - salute sessuale', cpc: 1.3, re: /erettile|disfunzione|sildenafil|tadalafil|vardenafil/ },
  { id: 'farmaci_psiche', label: 'Farmaci - ansia, sonno, umore', cpc: 1.1, re: /ansia|insonnia|depress|sedativ|benzodiazepin|antidepress|ansiolit|\bsonno\b/ },
  { id: 'farmaci_cardio', label: 'Farmaci - cuore e metabolismo', cpc: 1.2, re: /cardio|pression|colesterol|diabete|ipertension|cuore|antitrombotic|anticoagul|statina|glicemi|tiroid|diuretic/ },
  { id: 'farmaci_antibiotici', label: 'Farmaci - antibiotici e infezioni', cpc: 1.0, re: /antibiotic|infezion|batteri|antimicot|antivir|amoxicillina|cefalospor|macrolid|fluorochinolon/ },
  { id: 'farmaci_gastro', label: 'Farmaci - stomaco e intestino', cpc: 1.0, re: /reflusso|ulcera|gastr|stomaco|intestin|diarrea|stitichezza|nausea|vomito|acidit|colite|digestion/ },
  { id: 'farmaci_respiro', label: 'Farmaci - respiro e allergie', cpc: 1.0, re: /tosse|asma|bronch|muco|catarro|\bnaso\b|rinite|allerg|respir|raffreddore|\bgola\b/ },
  { id: 'farmaci_integratori', label: 'Integratori e vitamine', cpc: 0.9, re: /vitamin|integrator|minerali|magnesio|multivitamin|carenza|stanchezza/ },
  { id: 'farmaci_dolore', label: 'Farmaci - dolore e infiammazione', cpc: 1.0, re: /dolor|antinfiammator|febbre|\bfans\b|analges|artrosi|muscol|infiammazion|cefalea|emicrania|ibuprofene|paracetamolo|diclofenac|ketoprofene|nimesulide|naprossene/ },
];

const OTHER_DRUG = { id: 'farmaci_altri', label: 'Farmaci - altri', cpc: 1.0 };

export function classifyTopic(title = '', snippet = '', category = '') {
  const isDrug = category === 'Farmaco';
  const text = norm(`${title} ${isDrug ? snippet : ''}`);
  const table = isDrug ? DRUG_CLASSES : THEMES;
  const hit = table.find((t) => t.re.test(text));
  if (hit) return { id: hit.id, label: hit.label, cpc: hit.cpc };
  if (!isDrug && snippet) {
    // Titolo ambiguo: secondo tentativo sul testo iniziale.
    const second = THEMES.find((t) => t.re.test(norm(snippet)));
    if (second) return { id: second.id, label: second.label, cpc: second.cpc };
  }
  const fallback = isDrug ? OTHER_DRUG : OTHER_THEME;
  return { id: fallback.id, label: fallback.label, cpc: fallback.cpc };
}

export function statsOf(raw = {}) {
  const out = {};
  COUNTERS.forEach((c) => {
    const n = Number(raw[c]);
    out[c] = Number.isFinite(n) && n > 0 ? n : 0;
  });
  return out;
}

export function pointsOf(s) {
  return COUNTERS.reduce((sum, c) => sum + (WEIGHTS[c] || 0) * s[c], 0);
}

function exposureWeeks(createdMs, now) {
  const start = Math.max(createdMs || 0, TRACKING_START_MS);
  const days = Math.max(0, (now - start) / 86400000);
  return Math.min(60, Math.max(7, days)) / 7;
}

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function themeKey(post) {
  return classifyTopic(post.title, post.snippet, post.category);
}

// posts: [{id,title,slug,category,type,created_at(ms),gen_mode,snippet}]
// statsById: { [postId]: {views,engaged,deep,shares,favs,views_intl} }
export function buildReport(posts, statsById = {}, now = Date.now()) {
  const rows = posts.map((p) => {
    const s = statsOf(statsById[p.id]);
    const points = pointsOf(s);
    const weeks = exposureWeeks(p.created_at, now);
    const theme = themeKey(p);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      gen_mode: p.gen_mode || null,
      created_at: p.created_at || 0,
      theme: theme.id,
      themeLabel: theme.label,
      cpc: theme.cpc,
      ...s,
      points,
      perWeek: points / weeks,
      value: (points / weeks) * theme.cpc,
      engRate: s.views >= 5 ? s.engaged / s.views : null,
      deepRate: s.views >= 5 ? s.deep / s.views : null,
    };
  });

  const totals = rows.reduce(
    (t, r) => {
      COUNTERS.forEach((c) => {
        t[c] += r[c];
      });
      return t;
    },
    { views: 0, engaged: 0, deep: 0, shares: 0, favs: 0, views_intl: 0 }
  );
  totals.articles = rows.length;

  const withViews = rows.filter((r) => r.views >= 3);
  const conf = CONFIDENCE.find((c) => totals.views >= c.minViews && withViews.length >= c.minArticles);
  const confidence = {
    level: conf.level,
    exploit: conf.exploit,
    totalViews: totals.views,
    articlesWithViews: withViews.length,
    needed: conf.level === 'solid' ? null : conf.level === 'emerging'
      ? { views: 150, articles: 12 }
      : { views: 40, articles: 5 },
  };

  // Aggregazione per tema con shrinkage verso la media globale: un tema con
  // 1-2 articoli fortunati non deve scalzare uno solido con 20 articoli.
  const globalMean = rows.length ? rows.reduce((s, r) => s + r.value, 0) / rows.length : 0;
  const K = 3;
  const byTheme = new Map();
  rows.forEach((r) => {
    const t = byTheme.get(r.theme) || { id: r.theme, label: r.themeLabel, cpc: r.cpc, articles: 0, views: 0, engaged: 0, sumValue: 0 };
    t.articles += 1;
    t.views += r.views;
    t.engaged += r.engaged;
    t.sumValue += r.value;
    byTheme.set(r.theme, t);
  });
  const themes = [...byTheme.values()].map((t) => ({
    id: t.id,
    label: t.label,
    cpc: t.cpc,
    articles: t.articles,
    views: t.views,
    engRate: t.views >= 5 ? round(t.engaged / t.views, 2) : null,
    score: round((t.sumValue + globalMean * K) / (t.articles + K), 2),
  }));
  themes.sort((a, b) => b.score - a.score);

  const maxScore = themes.length ? themes[0].score : 0;
  const theme_weights = {};
  themes.forEach((t) => {
    theme_weights[t.id] = maxScore > 0 ? Math.max(0.15, round(t.score / maxScore, 2)) : 0.3;
  });

  const catMap = new Map();
  rows.forEach((r) => {
    const c = catMap.get(r.category) || { name: r.category, articles: 0, views: 0, engaged: 0, sumPerWeek: 0 };
    c.articles += 1;
    c.views += r.views;
    c.engaged += r.engaged;
    c.sumPerWeek += r.perWeek;
    catMap.set(r.category, c);
  });
  const categories = [...catMap.values()]
    .map((c) => ({
      name: c.name,
      articles: c.articles,
      views: c.views,
      engRate: c.views >= 5 ? round(c.engaged / c.views, 2) : null,
      avgPerWeek: round(c.sumPerWeek / c.articles, 2),
    }))
    .sort((a, b) => b.avgPerWeek - a.avgPerWeek);

  const ranked = [...rows].sort((a, b) => b.value - a.value);
  const top = ranked.filter((r) => r.points > 0).slice(0, 15);
  // Si giudica "andato male" solo chi ha avuto abbastanza prove (>=3 visite)
  // e abbastanza tempo: un articolo a zero visite non dice niente di lui,
  // dice solo che nessuno l'ha ancora trovato (vedi totals.no_views).
  const bottom = ranked
    .filter((r) => r.views >= 3 && now - Math.max(r.created_at, TRACKING_START_MS) >= 14 * 86400000)
    .slice(-10)
    .reverse();
  totals.no_views = rows.filter((r) => r.views === 0).length;

  const viewsSorted = withViews.map((r) => r.views).sort((a, b) => a - b);
  const p75 = Math.max(5, quantile(viewsSorted, 0.75));
  const median = quantile(viewsSorted, 0.5);
  const leaky = rows
    .filter((r) => r.views >= p75 && r.engRate !== null && r.engRate < 0.15)
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);
  const gems = rows
    .filter((r) => r.views >= 5 && r.views <= Math.max(median, 5) && r.engRate !== null && r.engRate >= 0.4)
    .sort((a, b) => b.engRate - a.engRate)
    .slice(0, 8);

  const modes = ['exploit', 'explore'].map((m) => {
    const g = rows.filter((r) => r.gen_mode === m);
    const views = g.reduce((s, r) => s + r.views, 0);
    const engaged = g.reduce((s, r) => s + r.engaged, 0);
    return {
      mode: m,
      articles: g.length,
      avgPerWeek: g.length ? round(g.reduce((s, r) => s + r.perWeek, 0) / g.length, 2) : null,
      engRate: views >= 5 ? round(engaged / views, 2) : null,
    };
  });

  const recommendations = buildRecommendations({ confidence, themes, leaky, gems, modes, totals });

  return { confidence, totals, themes, theme_weights, categories, top, bottom, leaky, gems, modes, recommendations };
}

function buildRecommendations({ confidence, themes, leaky, gems, modes, totals }) {
  const out = [];
  if (confidence.level === 'cold') {
    out.push(
      `Dati ancora scarsi (${totals.views} visite misurate da ${confidence.articlesWithViews} articoli): ` +
        'per ora la generazione usa soprattutto il segnale storico di Google Analytics e mantiene molta esplorazione. ' +
        `Servono circa ${confidence.needed.views} visite su ${confidence.needed.articles}+ articoli per iniziare a fidarsi dei numeri propri.`
    );
  }
  // Un tema entra nelle raccomandazioni solo con un minimo di evidenza
  // (visite), e "da spingere" solo se sta sopra la mediana dei punteggi:
  // altrimenti con pochi dati finiva in cima il meno peggio, non il migliore.
  const evidenced = themes.filter((t) => t.views >= 5);
  if (evidenced.length >= 3) {
    const scores = evidenced.map((t) => t.score).sort((a, b) => a - b);
    const median = scores[Math.floor(scores.length / 2)];
    const best = evidenced.filter((t) => t.score >= median).slice(0, 3);
    out.push(`Spingere di più: ${best.map((t) => t.label).join(', ')}. Sono i temi con il miglior rapporto lettura/interesse per articolo.`);
    const worst = [...evidenced].reverse().filter((t) => t.articles >= 3 && t.score < evidenced[0].score * 0.5).slice(0, 2);
    if (worst.length) {
      out.push(`Ridurre o ripensare: ${worst.map((t) => t.label).join(', ')} (molti articoli, poca lettura).`);
    }
  }
  if (leaky.length) {
    out.push(
      `${leaky.length} ${leaky.length === 1 ? 'articolo riceve' : 'articoli ricevono'} traffico ma quasi nessuno ${leaky.length === 1 ? 'lo legge' : 'li legge'} davvero: rivedere apertura e struttura ` +
        '(anche la resa degli annunci dipende dal tempo di permanenza).'
    );
  }
  if (gems.length) {
    out.push(
      `${gems.length} ${gems.length === 1 ? 'articolo è letto' : 'articoli sono letti'} a fondo ma ${gems.length === 1 ? 'poco visto' : 'poco visti'}: ${gems.length === 1 ? 'è il migliore candidato' : 'sono i migliori candidati'} per link interni, ` +
        'aggiornamenti SEO e condivisione.'
    );
  }
  const ex = modes.find((m) => m.mode === 'exploit');
  const xp = modes.find((m) => m.mode === 'explore');
  if (ex && xp && ex.articles >= 3 && xp.articles >= 3 && ex.avgPerWeek !== null && xp.avgPerWeek !== null) {
    out.push(
      ex.avgPerWeek > xp.avgPerWeek
        ? 'Gli articoli scelti dal sistema (sfruttamento) stanno rendendo meglio di quelli casuali: la strategia funziona.'
        : 'Gli articoli scelti dal sistema non stanno ancora battendo quelli casuali: aspettare più dati prima di spingere sullo sfruttamento.'
    );
  }
  if (out.length === 0) out.push('Nessuna raccomandazione forte per ora: continuare a raccogliere dati.');
  return out;
}

export function weightedPick(items, weightOf, rand = Math.random) {
  if (!items.length) return null;
  const weights = items.map((it) => Math.max(0.01, weightOf(it)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Pesi di partenza quando le misure proprie non bastano: temi dei vincitori
// storici GA4 in alto, tutti gli altri a un peso base per continuare a esplorare.
export function priorThemeWeights() {
  const weights = {};
  [...THEMES, OTHER_THEME].forEach((t) => {
    weights[t.id] = 0.3;
  });
  PRIOR_WINNERS.filter((w) => w.category !== 'Farmaco').forEach((w) => {
    weights[classifyTopic(w.title).id] = 1;
  });
  return weights;
}
