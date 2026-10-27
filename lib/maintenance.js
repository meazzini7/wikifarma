// Manutenzione degli articoli gia' pubblicati (solo admin, Admin SDK):
// controllo, riparazione automatica dei difetti sicuri e rigenerazione del
// testo quando e' vuoto o troncato.
import { revalidatePath, revalidateTag } from 'next/cache';
import { getAdminDb } from './firebaseAdmin';
import { auditPost, findDuplicates, summarize } from './audit';
import { callGemini, isGeminiConfigured } from './gemini';
import { cleanGeneratedContent } from './cleanContent';
import { buildAdminBlogPrompt, buildDrugPrompt, buildProblemsPrompt, buildWellnessPrompt } from './prompts';

async function loadAll() {
  const snap = await getAdminDb().collection('posts').get();
  return snap.docs.map((d) => ({ ref: d.ref, id: d.id, ...d.data() }));
}

const VISIBLE_KINDS = new Set(['fix', 'regen', 'manual']);

export async function auditAll() {
  const posts = await loadAll();
  const results = posts.map((p) => ({ post: p, ...auditPost(p) }));
  const problems = results
    .map((r) => ({ slug: r.post.slug, title: r.post.title, issues: r.issues.filter((i) => VISIBLE_KINDS.has(i.kind)) }))
    .filter((r) => r.issues.length);
  return {
    total: posts.length,
    withProblems: problems.length,
    noPhoto: results.filter((r) => r.issues.some((i) => i.code === 'no_photo')).length,
    summary: summarize(results).filter((s) => s.kind !== 'photo'),
    duplicates: findDuplicates(posts),
    items: problems.slice(0, 200),
  };
}

// Applica le correzioni automatiche (campo `patch` di auditPost).
export async function fixAll() {
  const posts = await loadAll();
  const db = getAdminDb();
  const changed = [];
  let batch = db.batch();
  let n = 0;
  for (const p of posts) {
    const { patch } = auditPost(p);
    if (!Object.keys(patch).length) continue;
    batch.update(p.ref, patch);
    changed.push(p.slug);
    n += 1;
    if (n % 400 === 0) {
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      batch = db.batch();
    }
  }
  if (n % 400 !== 0) await batch.commit();
  try {
    changed.slice(0, 300).forEach((slug) => slug && revalidatePath(`/${slug}`));
    revalidateTag('related');
    revalidatePath('/');
  } catch {
    // le pagine si rigenerano comunque alla scadenza della cache
  }
  return { fixed: changed.length };
}

function promptFor(p) {
  if (p.category === 'Farmaco') return buildDrugPrompt(p.title);
  if (p.category === 'Problemi Frequenti') return buildProblemsPrompt(p.title);
  if (p.category === 'Salute') return buildAdminBlogPrompt(p.title);
  return buildWellnessPrompt(p.title);
}

// Rigenera il testo di fino a `limit` articoli con testo vuoto/corto/troncato.
// Non sovrascrive mai un testo con uno piu' corto di 1000 caratteri.
export async function regenerateBroken({ limit = 3 } = {}) {
  if (!isGeminiConfigured()) return { regenerated: [], error: 'GEMINI_API_KEY mancante.' };
  const posts = await loadAll();
  const broken = posts.filter((p) => p.title && auditPost(p).issues.some((i) => i.kind === 'regen'));
  const done = [];
  const failed = [];
  for (const p of broken.slice(0, limit)) {
    // eslint-disable-next-line no-await-in-loop
    const raw = await callGemini(promptFor(p)).catch(() => null);
    const content = cleanGeneratedContent(raw || '');
    if (content.replace(/<[^>]*>/g, '').length < 1000) {
      failed.push(p.slug);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await p.ref.update({ content, regenerated_at: new Date() });
    try {
      revalidatePath(`/${p.slug}`);
    } catch {
      // ignorato
    }
    done.push(p.slug);
  }
  return { regenerated: done, failed, remaining: Math.max(0, broken.length - done.length - failed.length) };
}
