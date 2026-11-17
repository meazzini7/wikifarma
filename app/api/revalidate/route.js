import { NextResponse } from 'next/server';
import { revalidateAfterPublish } from '@/lib/revalidateSite';
import { isAuthorizedCron } from '@/lib/cronAuth';

// Chiamata dal runner di GitHub Actions dopo la pubblicazione di un articolo:
// invalida SOLO home, elenchi, sitemap e la pagina nuova. Costa una richiesta
// minima (nessuna lettura di database). Stessa autenticazione dei cron.
export async function POST(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === 'string' && /^[a-z0-9-]{1,200}$/.test(body.slug) ? body.slug : undefined;
  revalidateAfterPublish({ slug });
  return NextResponse.json({ ok: true, slug: slug || null });
}
