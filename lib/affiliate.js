// Prodotti consigliati (Programma Affiliazione Amazon.it) pertinenti al tema
// dell'articolo. Nessuna API e nessun prezzo mostrato: sono link a una RICERCA
// su amazon.it col nostro tag, quindi sempre validi (nessun ASIN che scade) e
// conformi alle regole del programma. Mappa fissa, nessun costo Gemini.
//
// Prudenza editoriale (sito di salute): solo prodotti da banco di uso comune
// (cura personale, dispositivi domestici, accessori, libri), mai farmaci ne'
// integratori con promesse, e nessun box sui temi sensibili.
import { AMAZON_TAG } from './constants';
import { classifyTopic } from './performance';

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SENSITIVE = /tumor|cancro|oncolog|metastas|suicid|lutto|overdose|abort|\bhiv\b|\baids\b|dipendenz|alcolism|anoress|bulimi|autolesion/;

const P = {
  termometro: { icon: '🌡️', label: 'Termometro digitale', q: 'termometro digitale' },
  pressione: { icon: '🩺', label: 'Misuratore di pressione da braccio', q: 'misuratore di pressione da braccio' },
  bilancia: { icon: '⚖️', label: 'Bilancia pesapersone', q: 'bilancia pesapersone digitale' },
  smartband: { icon: '⌚', label: 'Smartband fitness', q: 'smartband fitness contapassi' },
  organizer: { icon: '💊', label: 'Portapillole settimanale', q: 'portapillole settimanale organizer' },
  primosoccorso: { icon: '🧰', label: 'Kit di primo soccorso', q: 'kit primo soccorso casa' },
  impacco: { icon: '🧊', label: 'Impacco caldo/freddo riutilizzabile', q: 'impacco caldo freddo riutilizzabile' },
  cervicale: { icon: '🛏️', label: 'Cuscino cervicale ergonomico', q: 'cuscino cervicale ergonomico' },
  lombare: { icon: '🪑', label: 'Supporto lombare per sedia', q: 'cuscino lombare supporto sedia' },
  yoga: { icon: '🧘', label: 'Tappetino yoga antiscivolo', q: 'tappetino yoga antiscivolo' },
  acquacalda: { icon: '♨️', label: "Borsa dell'acqua calda", q: 'borsa acqua calda' },
  tisanaDig: { icon: '🍵', label: 'Tisana digestiva', q: 'tisana digestiva finocchio' },
  tisanaRelax: { icon: '🍵', label: 'Tisana rilassante', q: 'tisana rilassante camomilla' },
  umidificatore: { icon: '💧', label: 'Umidificatore ambiente', q: 'umidificatore ambiente' },
  ffp2: { icon: '😷', label: 'Mascherine FFP2', q: 'mascherine ffp2 certificate' },
  maschera: { icon: '😴', label: 'Maschera per dormire', q: 'maschera per dormire notte' },
  diario: { icon: '📓', label: 'Diario della gratitudine', q: 'diario della gratitudine' },
  spazzolino: { icon: '🪥', label: 'Spazzolino elettrico', q: 'spazzolino elettrico' },
  interdentali: { icon: '🦷', label: 'Scovolini interdentali', q: 'scovolini interdentali' },
  collutorio: { icon: '🫧', label: 'Collutorio senza alcol', q: 'collutorio senza alcol' },
  bite: { icon: '🦷', label: 'Bite notturno', q: 'bite dentale notturno' },
  solare: { icon: '☀️', label: 'Crema solare viso SPF 50', q: 'crema solare viso spf 50' },
  cicatrizzante: { icon: '🧴', label: 'Gel al silicone per cicatrici', q: 'gel silicone cicatrici' },
  idratante: { icon: '🧴', label: 'Crema idratante viso', q: 'crema idratante viso' },
  pelleSens: { icon: '🧴', label: 'Crema per pelle sensibile', q: 'crema pelle sensibile idratante' },
  detergente: { icon: '🧼', label: 'Detergente delicato', q: 'detergente delicato pelle sensibile' },
  lucebl: { icon: '👓', label: 'Occhiali filtro luce blu', q: 'occhiali filtro luce blu' },
  maschOcchi: { icon: '😌', label: 'Maschera riscaldante per occhi', q: 'maschera riscaldante occhi' },
  tappi: { icon: '🎧', label: 'Tappi per le orecchie', q: 'tappi per orecchie dormire' },
  cucina: { icon: '🍽️', label: 'Bilancia da cucina digitale', q: 'bilancia da cucina digitale' },
  contenitori: { icon: '🥗', label: 'Contenitori per pasti', q: 'contenitori ermetici pasti' },
  borraccia: { icon: '🚰', label: 'Borraccia riutilizzabile', q: 'borraccia riutilizzabile' },
  anatomia: { icon: '📚', label: 'Atlante illustrato di anatomia', q: 'atlante anatomia umana libro' },
};

// id tema (lib/performance.js) -> prodotti, in ordine di pertinenza.
// Assenti di proposito: salute sessuale, ansia/depressione, urologia/ginecologia.
const BY_THEME = {
  occhi_orecchie: ['lucebl', 'maschOcchi', 'tappi'],
  dentale: ['spazzolino', 'interdentali', 'collutorio'],
  estetica: ['cicatrizzante', 'solare', 'idratante'],
  cute: ['pelleSens', 'detergente', 'solare'],
  mentale_sonno: ['maschera', 'tisanaRelax', 'diario'],
  cuore_metabolismo: ['pressione', 'bilancia', 'smartband'],
  ossa_dolore: ['cervicale', 'impacco', 'lombare'],
  digestivo: ['acquacalda', 'tisanaDig', 'cucina'],
  respiratorio: ['termometro', 'umidificatore', 'ffp2'],
  alimentazione: ['cucina', 'contenitori', 'borraccia'],
  stile_vita: ['yoga', 'smartband', 'borraccia'],
  curiosita_corpo: ['anatomia'],
  altro: ['primosoccorso', 'termometro', 'organizer'],
  farmaci_cardio: ['pressione', 'organizer', 'bilancia'],
  farmaci_dolore: ['impacco', 'cervicale', 'organizer'],
  farmaci_gastro: ['acquacalda', 'tisanaDig', 'organizer'],
  farmaci_respiro: ['termometro', 'umidificatore', 'organizer'],
  farmaci_antibiotici: ['termometro', 'organizer'],
  farmaci_integratori: ['organizer', 'cucina'],
};

export function amazonSearchUrl(query) {
  return `https://www.amazon.it/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}

const snippetOf = (html = '') => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

// Prodotti per un articolo: [] se il tema e' sensibile o non ha prodotti adatti.
// Per i farmaci il titolo e' solo il nome commerciale: la classe terapeutica si
// ricava dall'inizio del testo, e una classe non riconosciuta non da' nessun box.
export function getAffiliateProducts(post, limit = 3) {
  const snippet = snippetOf(post.content);
  if (SENSITIVE.test(norm(`${post.title} ${snippet}`))) return { theme: null, items: [] };
  const theme = classifyTopic(post.title, snippet, post.category).id;
  const keys = BY_THEME[theme] || [];
  return {
    theme,
    items: keys.slice(0, limit).map((k) => ({ key: k, icon: P[k].icon, label: P[k].label, href: amazonSearchUrl(P[k].q) })),
  };
}
