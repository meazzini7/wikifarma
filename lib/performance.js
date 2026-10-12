// Classificazione editoriale (pura, senza I/O): a quale TEMA appartiene un
// argomento e con quale STILE di titolo e' scritto. Sono le due dimensioni su
// cui lib/insights.js confronta le performance e su cui lib/strategy.js pesa
// la scelta dei prossimi argomenti.

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


// Stile del titolo: sui dati reali di WikiFarma i titoli che promettono una
// risposta concreta (costi, quando operare, confronti) leggono meglio delle
// liste generiche. Ordine = priorita', il primo che combacia vince.
const TITLE_STYLES = [
  { id: 'costi', label: 'Costi e prezzi', re: /quanto costa|\bcosto\b|\bcosti\b|\bprezzo\b|\bprezzi\b|invalidita|rimborso/ },
  { id: 'confronto', label: 'Confronti e scelte', re: /\bvs\b|differenz|confronto|quale scegliere|\bmigliori\b|\bmigliore\b|oppure|meglio/ },
  { id: 'decisione', label: 'Quando e se (decisioni)', re: /quando (operare|toglier|rivolgers|preoccup|serve|fare|iniziare)|conviene|serve davvero|ne vale la pena|si guarisce|si puo|si riassorbe|e' possibile|funziona davvero|funzionano/ },
  { id: 'sintomi', label: 'Sintomi e segnali', re: /sintom|segnali|riconoscere|campanelli/ },
  { id: 'rimedi', label: 'Rimedi e cure', re: /rimedi|\bcure\b|\bcura\b|terapia|trattament|come curare|come eliminare|come togliere|come ridurre|come combattere/ },
  { id: 'domanda', label: 'Domande e curiosità', re: /\?|^perche|come funziona|come guariscono|mistero|scienza/ },
  { id: 'elenco', label: 'Consigli ed elenchi', re: /consigli|\b\d+ (consigli|miti|modi)|come (prevenire|migliorare|evitare|scegliere)|tecniche/ },
  { id: 'benefici', label: 'Benefici e proprietà', re: /benefici|proprieta|superfood|fa bene|fanno bene|la verita su|tutto quello che devi sapere|guida completa/ },
];

const OTHER_STYLE = { id: 'generico', label: 'Titolo generico' };

export function titleStyleOf(title = '') {
  const text = norm(title).replace(/\(.*?\)/g, ' ');
  const hit = TITLE_STYLES.find((t) => t.re.test(text));
  return hit ? { id: hit.id, label: hit.label } : { id: OTHER_STYLE.id, label: OTHER_STYLE.label };
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
