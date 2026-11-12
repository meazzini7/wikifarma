// Scene fotografiche (query in inglese per Unsplash) e scelta della scena per
// un articolo. Una "scena" e' un soggetto visivo generico ma pertinente (denti,
// sonno, pressione, farmacia...): da ogni scena si ricava un insieme di foto
// diverse, quindi bastano poche decine di ricerche per dare una foto UNICA a
// centinaia di articoli (il limite di Unsplash in modalita' demo e' 50
// richieste/ora). Funzione pura, testabile senza rete.
import { classifyTopic } from './performance';

export const SCENES = {
  // farmaci
  pills: 'medicine pills capsules',
  pharmacy: 'pharmacy shelves medicine',
  blister: 'blister pack tablets',
  syringe: 'syringe vaccine injection',
  cream: 'skin cream ointment tube',
  inhaler: 'inhaler asthma',
  vitamins: 'vitamins supplements',
  pharmacist: 'pharmacist counter',
  // benessere e problemi
  dental: 'dentist teeth dental care',
  eyes: 'eye exam optician',
  hearing: 'ear hearing test',
  skincare: 'skincare face routine',
  beauty: 'beauty clinic treatment',
  hair: 'hair care brush',
  mind: 'person relaxing stress relief',
  sleep: 'sleeping bed night rest',
  heart: 'blood pressure measurement',
  nutrition: 'healthy food vegetables',
  tea: 'herbal tea cup',
  digestion: 'digestive health stomach ginger',
  liver: 'healthy liver detox lemon water',
  banana: 'banana potassium fruit',
  grains: 'whole grains seeds bowl',
  allergy: 'allergy pollen flowers sneezing',
  diabetes: 'blood glucose meter',
  muscle: 'stretching muscle recovery',
  coldflu: 'cold flu tea tissues',
  back: 'back pain physiotherapy',
  joints: 'knee joint exercise',
  fitness: 'running outdoor exercise',
  yoga: 'yoga stretching',
  foot: 'feet foot care',
  doctor: 'doctor consultation',
  hospital: 'hospital corridor',
  lab: 'laboratory research microscope',
  nature: 'nature wellness green',
  pregnancy: 'pregnancy wellness',
};

// Regole per parola chiave del TITOLO: hanno la precedenza sul tema, perche' il
// tema e' largo (es. "occhi e orecchie") e la foto di un orecchio sulla
// cataratta e' fuori luogo. La prima regola che combacia decide la scena.
const KEYWORD_SCENES = [
  [/cataratt|maculo|glaucom|retina|congiuntiv|\bocchi\b|\bvista\b|miopia|occhiaie/, ['eyes']],
  [/acufen|udito|orecchi|sordit|otite|fischiano/, ['hearing']],
  [/denti|dente|dentale|gengiv|carie|bruxism|corona|sbiancament|faccett|devitalizz|alito/, ['dental']],
  [/botox|filler|ialuronic|rinoplast|liposuz|blefaroplast|mastoplast|tatuagg|macchie|rughe/, ['beauty', 'skincare']],
  [/capelli|calvizie|alopecia|forfora|finasteride|minoxidil/, ['hair']],
  [/dermatit|eczema|psoriasi|acne|pelle|crema|creme|scottatur|ustion|zanzara|\bneo\b|nei\b/, ['skincare', 'cream']],
  [/fegato|alcol|epatic/, ['liver']],
  [/starnut|allergi|polline|rinite/, ['allergy']],
  [/raffreddor|influenz|febbre|tosse|\bgola\b|sinusit|bronch|asma|virus|batter/, ['coldflu']],
  [/melaton|insonni|sonno|dormire|dormir|cuscino/, ['sleep']],
  [/ansia|stress|depress|burnout|umore|meditazion|mindfulness|solitudine|gratitudine/, ['mind']],
  [/pressione|cuore|infarto|colesterol|ipertens|circolazione/, ['heart']],
  [/diabet|glicemi/, ['diabetes']],
  [/potassio|crampi|muscol|stretching|pilates|palestra/, ['muscle']],
  [/ginocchio|menisco|artrosi|articolaz|spalla|\banca\b|tunnel carpale/, ['joints']],
  [/schiena|lombar|cervical|sciatalg|ernia|postura/, ['back']],
  [/alluce|piede|piedi|unghie|fascite|verruc|scarpe/, ['foot']],
  [/correre|corsa|camminata|nuoto|sport|sedentari|allenamento/, ['fitness']],
  [/yoga/, ['yoga']],
  [/pylori|gastr|reflusso|stomaco|intestin|colon|digestion|probiotic|emorroid|nausea|pancia|microbioma|fibre/, ['digestion']],
  [/orzo|tofu|quinoa|miso|seitan|amaranto|farro|avena|segale|miglio|riso|cereali|grano|kefir/, ['grains']],
  [/vitamin|collagene|integrator|omega|magnesio|zinco|selenio|ferro\b|calcio/, ['vitamins']],
  [/dieta|dimagr|peso|obesit|zenzero|curcuma|noci|chia|mirtill|avocado|melograno|papaya|colazione|frutta|verdur|olio|miele|zucchero|caffeina|\bte\b|tisane|camomilla/, ['nutrition']],
  [/gravidanz|mestru|ovai|menopausa|cistite/, ['pregnancy', 'doctor']],
];

// tema (lib/performance.js) -> scene candidate, in ordine di preferenza.
const BY_THEME = {
  occhi_orecchie: ['eyes', 'hearing'],
  dentale: ['dental'],
  estetica: ['beauty', 'skincare', 'hair'],
  cute: ['skincare', 'cream'],
  mentale_sonno: ['sleep', 'mind'],
  uro_ginecologia: ['doctor', 'pregnancy'],
  cuore_metabolismo: ['heart', 'doctor'],
  ossa_dolore: ['back', 'joints', 'foot'],
  digestivo: ['digestion', 'tea'],
  respiratorio: ['coldflu', 'tea'],
  alimentazione: ['nutrition', 'vitamins'],
  stile_vita: ['fitness', 'yoga', 'nature'],
  curiosita_corpo: ['lab', 'doctor'],
  altro: ['nature', 'doctor', 'mind'],
  farmaci_sessuale: ['pharmacy', 'pills'],
  farmaci_psiche: ['pills', 'pharmacy'],
  farmaci_cardio: ['pills', 'heart', 'blister'],
  farmaci_antibiotici: ['blister', 'pills'],
  farmaci_gastro: ['pills', 'pharmacy'],
  farmaci_respiro: ['inhaler', 'pharmacy'],
  farmaci_integratori: ['vitamins', 'pills'],
  farmaci_dolore: ['pills', 'blister', 'cream'],
  farmaci_altri: ['pills', 'pharmacy', 'blister', 'pharmacist', 'syringe', 'cream'],
};

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i += 1) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function themeScenes({ title = '', category = '', snippet = '' }, rotate) {
  const theme = classifyTopic(title, snippet, category).id;
  const list = BY_THEME[theme] || BY_THEME.altro;
  const start = rotate ? hash(title) % list.length : 0;
  return [...list.slice(start), ...list.slice(0, start)];
}

const normTitle = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Scene PERTINENTI per un articolo, dalla piu' alla meno adatta: se il titolo
// contiene una parola chiave decidono solo le regole per parola chiave (una
// cataratta non deve mai prendere la foto di un orecchio perche' appartiene
// allo stesso tema "occhi e orecchie"); altrimenti decide il tema, ruotando per
// titolo solo per dare varieta'.
export function relevantScenes(post) {
  const text = normTitle(post.title);
  const byKeyword = [...new Set(KEYWORD_SCENES.filter(([re]) => re.test(text)).flatMap(([, scenes]) => scenes))];
  return byKeyword.length ? byKeyword : themeScenes(post, true);
}

// Scene da provare per un articolo: le pertinenti, poi quelle del tema e in
// fondo un ripiego generico per non lasciare mai un articolo senza foto.
export function scenesForPost(post) {
  const generic = post.category === 'Farmaco' ? ['pills', 'pharmacy', 'blister'] : ['nature', 'doctor'];
  return [...new Set([...relevantScenes(post), ...themeScenes(post, false), ...generic])];
}
