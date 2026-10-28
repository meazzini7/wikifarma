import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/verifyAdmin';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { auditAll, fixAll, regenerateBroken } from '@/lib/maintenance';
import { assignPhotos, isUnsplashConfigured, trackPending } from '@/lib/unsplash';

export const maxDuration = 60;

// Manutenzione articoli, solo admin. GET = controllo (nessuna modifica).
// POST { action: 'fix' | 'regenerate' | 'photos' }.
async function guard(request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 });
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: 'Firebase Admin non configurato su Vercel.' }, { status: 503 });
  return null;
}

export async function GET(request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, unsplash: isUnsplashConfigured(), ...(await auditAll()) });
  } catch (err) {
    console.error('maintenance GET:', err);
    return NextResponse.json({ error: err.message || 'Errore.' }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await guard(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === 'fix') return NextResponse.json({ ok: true, ...(await fixAll()) });
    if (body.action === 'regenerate') return NextResponse.json({ ok: true, ...(await regenerateBroken({ limit: 3 })) });
    if (body.action === 'photos') {
      if (!isUnsplashConfigured()) {
        return NextResponse.json({ ok: false, error: 'Manca UNSPLASH_ACCESS_KEY su Vercel (Settings > Environment Variables) e un nuovo deploy.' });
      }
      const res = await assignPhotos({ limit: 120 });
      const tracking = await trackPending({ limit: 15 });
      return NextResponse.json({ ...res, ...tracking });
    }
    return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 });
  } catch (err) {
    console.error('maintenance POST:', err);
    return NextResponse.json({ error: err.message || 'Errore.' }, { status: 500 });
  }
}
