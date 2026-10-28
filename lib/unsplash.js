// Foto vere da Unsplash, una diversa per ogni articolo.
//
// Regole dell'API Unsplash rispettate: foto servite dagli URL ufficiali
// (hotlink), credito al fotografo con link (utm_source), e chiamata di
// "download tracking" quando una foto viene usata. Limite demo: 50 richieste/ora,
// quindi i risultati di ogni ricerca (30 foto) restano in Firestore
// (photo_pools/{scena}) e si riusano per molti articoli.
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin';
import { SCENES, scenesForPost } from './photoScenes';

const API = 'https://api.unsplash.com';
const UTM = 'utm_source=wikifarma&utm_medium=referral';
const MAX_PAGES = 4;
const PER_PAGE = 30;

export const isUnsplashConfigured = () => Boolean(process.env.UNSPLASH_ACCESS_KEY);

// Foto assegnate da noi hanno questo marcatore nell'URL: serve a distinguerle
// dai vecchi image_url (foto di stock ripetute, immagini AI) da non mostrare.
export const isCuratedPhoto = (url) => /^https:\/\/images\.unsplash\.com\/.*[?&]wf=1(&|$)/.test(String(url || ''));

export function photoUrl(rawUrl) {
  const u = new URL(rawUrl);
  u.searchParams.set('w', '1200');
  u.searchParams.set('h', '750');
  u.searchParams.set('fit', 'crop');
  u.searchParams.set('crop', 'entropy');
  u.searchParams.set('q', '75');
  u.searchParams.set('auto', 'format');
  u.searchParams.set('wf', '1');
  return u.toString();
}

export class UnsplashError extends Error {
  constructor(message, code, remaining) {
    super(message);
    this.code = code;
    this.remaining = remaining;
  }
}

// Stato della quota letto dagli header dell'ultima risposta.
export const quota = { remaining: null };

async function api(path, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${API}${path}`, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' },
  });
  const remaining = Number(res.headers?.get?.('x-ratelimit-remaining'));
  if (Number.isFinite(remaining)) quota.remaining = remaining;
  if (res.status === 403 || res.status === 429) throw new UnsplashError('Limite orario di Unsplash raggiunto: riprova tra un po\'.', 'rate_limit', 0);
  if (res.status === 401) throw new UnsplashError('UNSPLASH_ACCESS_KEY non valida.', 'auth', quota.remaining);
  if (!res.ok) throw new UnsplashError(`Errore Unsplash (HTTP ${res.status}).`, 'http', quota.remaining);
  return res.json();
}

export async function searchPage(query, page, opts) {
  const q = `/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${PER_PAGE}&orientation=landscape&content_filter=high`;
  const data = await api(q, opts);
  return (data.results || [])
    .filter((p) => p?.id && p.urls?.raw)
    .map((p) => ({
      id: p.id,
      url: photoUrl(p.urls.raw),
      author: p.user?.name || 'Unsplash',
      author_url: `${p.user?.links?.html || 'https://unsplash.com'}?${UTM}`,
      link: `${p.links?.html || 'https://unsplash.com'}?${UTM}`,
      dl: p.links?.download_location || null,
    }));
}

// Pool di una scena (cache in Firestore). `more` carica la pagina successiva.
async function getPool(scene, { more = false, opts, cache } = {}) {
  if (!more && cache?.has(scene)) return cache.get(scene);
  const ref = getAdminDb().collection('photo_pools').doc(scene);
  const snap = await ref.get();
  let pool = snap.exists ? snap.data() : { photos: [], page: 0, exhausted: false };
  if (pool.page === 0 || (more && !pool.exhausted && pool.page < MAX_PAGES)) {
    const next = pool.page + 1;
    const photos = await searchPage(SCENES[scene], next, opts);
    const known = new Set(pool.photos.map((p) => p.id));
    pool = {
      photos: [...pool.photos, ...photos.filter((p) => !known.has(p.id))],
      page: next,
      exhausted: photos.length < PER_PAGE || next >= MAX_PAGES,
    };
    await ref.set({ ...pool, scene, updated_at: FieldValue.serverTimestamp() });
  }
  cache?.set(scene, pool);
  return pool;
}

// Sceglie una foto non ancora usata: prima nelle scene dell'articolo, caricando
// altre pagine solo se serve. Ritorna null se non ne trova (l'articolo resta
// con la copertina generata, mai senza immagine).
export async function pickPhoto(post, used, opts, cache) {
  for (const scene of scenesForPost(post)) {
    for (let attempt = 0; attempt < MAX_PAGES + 1; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const pool = await getPool(scene, { more: attempt > 0, opts, cache });
      const free = pool.photos.filter((p) => !used.has(p.id));
      if (free.length) return { ...free[0], scene };
      if (pool.exhausted) break;
    }
  }
  return null;
}

// "Download" richiesto da Unsplash quando una foto viene usata.
export async function trackDownload(dl, opts) {
  if (!dl) return false;
  try {
    const u = new URL(dl);
    await api(`${u.pathname}${u.search}`, opts);
    return true;
  } catch {
    return false;
  }
}

export function photoFields(photo) {
  return {
    image_url: photo.url,
    photo: { id: photo.id, author: photo.author, author_url: photo.author_url, link: photo.link, scene: photo.scene, source: 'unsplash', tracked: false, dl: photo.dl || null },
  };
}

// Insieme degli id di foto gia' assegnate (per garantire l'unicita').
export async function loadUsedPhotoIds() {
  const snap = await getAdminDb().collection('posts').select('photo.id').get();
  const used = new Set();
  snap.docs.forEach((d) => {
    const id = d.data().photo?.id;
    if (id) used.add(id);
  });
  return used;
}

// Assegna foto a fino a `limit` articoli che non ne hanno una. Si ferma se la
// quota Unsplash sta per finire. Idempotente: si puo' rilanciare.
export async function assignPhotos({ limit = 25, opts } = {}) {
  if (!isUnsplashConfigured()) return { ok: false, error: 'not_configured' };
  const db = getAdminDb();
  const snap = await db.collection('posts').select('title', 'category', 'content', 'photo.id').get();
  const pending = snap.docs.filter((d) => !d.data().photo?.id);
  const used = await loadUsedPhotoIds();
  let assigned = 0;
  let stopped = null;
  const cache = new Map(); // i pool restano in memoria durante la corsa: niente riletture di Firestore
  for (const d of pending.slice(0, limit)) {
    const x = d.data();
    try {
      // eslint-disable-next-line no-await-in-loop
      const photo = await pickPhoto(
        { title: x.title, category: x.category, snippet: String(x.content || '').replace(/<[^>]*>/g, ' ').slice(0, 400) },
        used,
        opts,
        cache
      );
      if (!photo) continue;
      // eslint-disable-next-line no-await-in-loop
      await d.ref.update(photoFields(photo));
      used.add(photo.id);
      assigned += 1;
    } catch (err) {
      stopped = err.message;
      if (err instanceof UnsplashError && (err.code === 'rate_limit' || err.code === 'auth')) break;
    }
  }
  return { ok: true, assigned, remaining: Math.max(0, pending.length - assigned), quota: quota.remaining, stopped };
}

// Chiama il "download tracking" per le foto gia' assegnate e non ancora
// tracciate, finche' la quota lo consente.
export async function trackPending({ limit = 20, opts } = {}) {
  if (!isUnsplashConfigured()) return { tracked: 0 };
  const snap = await getAdminDb().collection('posts').where('photo.tracked', '==', false).limit(limit).get();
  let tracked = 0;
  for (const d of snap.docs) {
    if (quota.remaining !== null && quota.remaining < 5) break;
    // eslint-disable-next-line no-await-in-loop
    const ok = await trackDownload(d.data().photo?.dl, opts);
    if (ok) {
      // eslint-disable-next-line no-await-in-loop
      await d.ref.update({ 'photo.tracked': true });
      tracked += 1;
    }
  }
  return { tracked, pending: snap.size - tracked };
}

// Per un articolo appena creato (cron): foto unica, senza bloccare mai la pubblicazione.
export async function assignPhotoToNewPost(ref, post) {
  if (!isUnsplashConfigured()) return null;
  try {
    const used = await loadUsedPhotoIds();
    const photo = await pickPhoto(post, used);
    if (!photo) return null;
    await ref.update(photoFields(photo));
    return photo.id;
  } catch (err) {
    console.error('assignPhotoToNewPost:', err);
    return null;
  }
}
