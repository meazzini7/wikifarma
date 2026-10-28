import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin';
import { assignPhotoToNewPost } from './unsplash';
import { callGemini } from './gemini';
import { cleanGeneratedContent } from './cleanContent';
import { sendNewArticleEmail } from './email';

function slugify(title, uniqueSuffix) {
  // NFD toglie gli accenti (verita' -> verita, non "verit"), cosi' lo slug resta leggibile.
  const base = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return `${base.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${uniqueSuffix}`;
}

// Un'unica lettura di tutti i titoli esistenti, invece di una query Firestore
// per ogni candidato: con ~200 farmaci in lista e la maggior parte gia'
// esistenti, il controllo uno-alla-volta richiedeva decine di round-trip
// sequenziali (misurato: oltre 25s), superando il tempo massimo di
// esecuzione della funzione serverless del cron e facendolo fallire con un
// 500 senza mai generare nulla.
async function getExistingTitleSet(db) {
  const snap = await db.collection('posts').select('title').get();
  return new Set(snap.docs.map((doc) => doc.data().title));
}

// Stessa lettura unica, ma con titoli in minuscolo: serve alla strategia per
// scartare i doppioni senza dipendere da maiuscole o suffissi.
export async function getExistingTitlesLower() {
  const set = await getExistingTitleSet(getAdminDb());
  return new Set([...set].map((t) => String(t || '').toLowerCase()));
}

// Sequential mode (drugs): walk the priority list, generate the first topic
// that doesn't have a post yet.
export async function pickSequentialTopic(topics) {
  const db = getAdminDb();
  const existing = await getExistingTitleSet(db);
  return topics.find((candidate) => !existing.has(candidate)) || null;
}

// Random mode (wellness/problems): pick any topic, tag it with the year.
// Checks for an existing post with the same resulting title first (the old
// PHP cron_daily2/3.php scripts didn't, which is why the migrated data has
// ~50 duplicate-titled articles) and retries a few times before falling
// back to a suffixed title that's guaranteed unique.
export async function pickRandomTopic(topics, maxAttempts = 8) {
  const db = getAdminDb();
  const existing = await getExistingTitleSet(db);
  const year = new Date().getFullYear();

  for (let i = 0; i < maxAttempts; i += 1) {
    const base = topics[Math.floor(Math.random() * topics.length)];
    const candidate = `${base} (Guida ${year})`;
    if (!existing.has(candidate)) return candidate;
  }

  const base = topics[Math.floor(Math.random() * topics.length)];
  return `${base} (Guida ${year}) #${Math.floor(1000 + Math.random() * 9000)}`;
}

// brief: indicazioni editoriali apprese dalle performance (lib/strategy.js),
// iniettate nel prompt. genMode: 'exploit' (argomento scelto dalla strategia)
// o 'explore' (scelta casuale) - salvato sul post per poter misurare se la
// strategia batte il caso.
export async function generateAndSaveArticle({ topic, category, type, promptBuilder, uniqueSuffix, brief, genMode }) {
  const raw = await callGemini(promptBuilder(topic, brief));
  if (!raw) {
    console.error(`Risposta AI vuota per il topic "${topic}" (categoria ${category}).`);
    return { error: 'Risposta AI vuota.' };
  }

  const content = cleanGeneratedContent(raw);
  const slug = slugify(topic, uniqueSuffix);
  // Il numero "#1234" serve solo a evitare doppioni nella scelta dell'argomento:
  // non deve comparire nel titolo mostrato ai lettori.
  const title = topic.replace(/\s*#\d{3,6}\s*$/, '').trim();

  const db = getAdminDb();
  let docRef;
  try {
    docRef = await db.collection('posts').add({
      title,
      title_lower: title.toLowerCase(),
      slug,
      content,
      category,
      type,
      image_url: null,
      gen_mode: genMode || 'explore',
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Scrittura post su Firestore fallita:', err);
    return { error: `Scrittura Firestore fallita: ${err.message}` };
  }

  // Foto Unsplash unica per l'articolo (se configurata). Mai bloccante: senza
  // foto resta comunque la copertina generata dal titolo.
  const photoId = await assignPhotoToNewPost(docRef, {
    title,
    category,
    snippet: content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 400),
  });

  await sendNewArticleEmail({ title, slug, category });

  return { created: true, title, slug, photo: photoId };
}
