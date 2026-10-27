// Prodotti consigliati (Programma Affiliazione Amazon.it) pertinenti al tema
// dell'articolo. Nessuna API e nessun prezzo mostrato (regole del programma):
// link alla scheda del prodotto col nostro tag e foto ufficiale di Amazon.
// Mappa fissa, nessun costo Gemini.
//
// Prudenza editoriale (sito di salute): solo prodotti da banco di uso comune
// (cura personale, dispositivi domestici, accessori, libri), mai farmaci ne'
// integratori con promesse, e nessun box sui temi sensibili.
import { AMAZON_TAG } from './constants';
import { classifyTopic } from './performance';

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SENSITIVE = /tumor|cancro|oncolog|metastas|suicid|lutto|overdose|abort|\bhiv\b|\baids\b|dipendenz|alcolism|anoress|bulimi|autolesion/;

// Prodotti reali di Amazon.it (ASIN trovati nelle schede pubbliche): la foto e'
// quella ufficiale di Amazon (widget immagini del programma affiliati, con il
// nostro tag), il link porta alla scheda del prodotto. Nessun prezzo mostrato.
// Se un ASIN diventa non disponibile basta sostituirlo qui.
const P = {
  termometro: { asin: 'B07R2KJTVY', label: 'Braun Sensian 7 - termometro a infrarossi' },
  pressione: { asin: 'B084WT5FGT', label: 'Omron M3 - misuratore di pressione da braccio' },
  bilancia: { asin: 'B00DW5C79W', label: 'Beurer PS160 - bilancia pesapersone' },
  smartband: { asin: 'B0DYF82545', label: 'Xiaomi Smart Band 10 - fitness tracker' },
  organizer: { asin: 'B09V59NKGV', label: 'Portapillole settimanale 7 giorni' },
  primosoccorso: { asin: 'B00FERUUSQ', label: 'Valigetta di primo soccorso per casa' },
  impacco: { asin: 'B06Y418GMN', label: 'Impacco gel caldo/freddo riutilizzabile' },
  cervicale: { asin: 'B098TBBC6F', label: 'Cuscino cervicale in memory foam' },
  lombare: { asin: 'B0725LGGQN', label: 'Cuscino lombare per sedia da ufficio' },
  yoga: { asin: 'B0B9YR9HP4', label: 'Yogii - tappetino yoga antiscivolo' },
  acquacalda: { asin: 'B00DLXKGES', label: "Fashy - borsa dell'acqua calda" },
  tisanaDig: { asin: 'B014UTC76Q', label: 'Pompadour - tisana digestiva' },
  tisanaRelax: { asin: 'B00XUHRSQE', label: 'Bonomelli - tisana rilassante' },
  umidificatore: { asin: 'B095KGXPW5', label: 'Levoit - umidificatore ad ultrasuoni' },
  maschera: { asin: 'B0C7GPGR19', label: 'Maschera per dormire in seta' },
  diario: { asin: 'B09PMBKZJJ', label: 'Il quaderno della gratitudine' },
  spazzolino: { asin: 'B0CB66YPCC', label: 'Oral-B Pro Series 1 - spazzolino elettrico' },
  interdentali: { asin: 'B0010EOND0', label: 'TePe - scovolini interdentali' },
  solare: { asin: 'B0792N6CS5', label: 'La Roche-Posay Anthelios - solare viso SPF 50+' },
  cicatrizzante: { asin: 'B08WH83T7F', label: 'Kelo-Cote - gel al silicone per cicatrici' },
  idratante: { asin: 'B099MJH88B', label: 'Cetaphil - crema idratante pelle sensibile' },
  detergente: { asin: 'B09ZF9X3R1', label: 'Cetaphil - detergente delicato' },
  lucebl: { asin: 'B0CQRGFJCD', label: 'Occhiali con filtro luce blu' },
  tappi: { asin: 'B0D3V61JC8', label: 'Loop Quiet 2 - tappi per le orecchie' },
  cucina: { asin: 'B07QB34XH3', label: 'Bilancia da cucina digitale' },
  contenitori: { asin: 'B07VQJTWD1', label: 'Contenitori ermetici in vetro' },
  borraccia: { asin: 'B0CHHWJPH4', label: 'Borraccia termica in acciaio inox' },
  anatomia: { asin: '882144967X', label: "Netter - Atlante di anatomia umana" },
};

// id tema (lib/performance.js) -> prodotti, in ordine di pertinenza.
// Assenti di proposito: salute sessuale, ansia/depressione, urologia/ginecologia.
const BY_THEME = {
  occhi_orecchie: ['lucebl', 'tappi'],
  dentale: ['spazzolino', 'interdentali'],
  estetica: ['cicatrizzante', 'solare', 'idratante'],
  cute: ['idratante', 'detergente', 'solare'],
  mentale_sonno: ['maschera', 'tisanaRelax', 'diario'],
  cuore_metabolismo: ['pressione', 'bilancia', 'smartband'],
  ossa_dolore: ['cervicale', 'impacco', 'lombare'],
  digestivo: ['acquacalda', 'tisanaDig', 'cucina'],
  respiratorio: ['termometro', 'umidificatore'],
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

export const amazonProductUrl = (asin) => `https://www.amazon.it/dp/${asin}?tag=${AMAZON_TAG}`;

// Foto ufficiale del prodotto (widget immagini di Amazon Associates).
export const amazonImageUrl = (asin) =>
  `https://ws-eu.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=${asin}&Format=_SL250_&ID=AsinImage&MarketPlace=IT&ServiceVersion=20070822&WS=1&tag=${AMAZON_TAG}`;

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
    items: keys.slice(0, limit).map((k) => ({ key: k, label: P[k].label, href: amazonProductUrl(P[k].asin), image: amazonImageUrl(P[k].asin) })),
  };
}
