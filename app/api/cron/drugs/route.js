import { NextResponse } from 'next/server';
import { revalidateAfterPublish } from '@/lib/revalidateSite';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { runDrugsCron } from '@/lib/cronRunners';

export const maxDuration = 60;

// Il cron vero gira su GitHub Actions (scripts/run-cron.mjs, .github/workflows/cron.yml)
// e usa la stessa funzione runDrugsCron: questa route resta per l'uso manuale
// (Authorization: Bearer CRON_SECRET) e in piu' invalida le pagine dopo la pubblicazione.
export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }
  const { status, body } = await runDrugsCron();
  if (body.created) revalidateAfterPublish(body);
  return NextResponse.json(body, { status });
}
