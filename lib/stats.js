// Contatori anonimi di performance per articolo (collection article_stats).
// Scritti direttamente dal browser con l'SDK client: nessuna funzione
// serverless coinvolta, quindi nessun costo CPU su Vercel. Niente dati
// personali: solo incrementi di contatori aggregati per articolo.
import { doc, increment, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i;

// fields: nomi dei contatori da incrementare di 1 (views, engaged, deep,
// shares, favs, views_intl). Una sola volta per sessione e per articolo,
// cosi' ricaricare la pagina o cliccare piu' volte non gonfia i numeri.
export function trackArticleEvent(postId, fields) {
  if (typeof window === 'undefined' || !postId || !fields?.length) return;
  if (BOT_RE.test(navigator.userAgent || '')) return;

  try {
    const key = `wfs:${postId}:${fields.join('+')}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage non disponibile: si conta comunque
  }

  const data = {};
  fields.forEach((f) => {
    data[f] = increment(1);
  });
  setDoc(doc(db, 'article_stats', postId), data, { merge: true }).catch(() => {
    // regole non ancora pubblicate o errore transitorio: non e' critico
  });
}
