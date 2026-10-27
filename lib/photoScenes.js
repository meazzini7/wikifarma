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
  mind: 'meditation calm mindfulness',
  sleep: 'sleeping bed night rest',
  heart: 'blood pressure measurement',
  nutrition: 'healthy food vegetables',
  tea: 'herbal tea cup',
  digestion: 'healthy breakfast fiber fruit',
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

// Scene da provare per un articolo, dalla piu' pertinente alla piu' generica.
// Le altre scene dello stesso tema servono quando la prima ha finito le foto
// ancora libere.
export function scenesForPost({ title = '', category = '', snippet = '' }) {
  const theme = classifyTopic(title, snippet, category).id;
  const list = BY_THEME[theme] || BY_THEME.altro;
  const start = hash(title) % list.length;
  const ordered = [...list.slice(start), ...list.slice(0, start)];
  const generic = category === 'Farmaco' ? ['pills', 'pharmacy', 'blister'] : ['nature', 'doctor'];
  return [...new Set([...ordered, ...generic])];
}
