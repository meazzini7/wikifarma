import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/verifyAdmin';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { getInsights } from '@/lib/insights';
import { getStrategy, rebuildStrategy } from '@/lib/strategy';

export const maxDuration = 60;

function publicStrategy(s) {
  if (!s) return null;
  return {
    built_at_ms: s.built_at_ms || null,
    active: Boolean(s.active),
    focus_brief: s.focus_brief || '',
    suggested_topics: s.suggested_topics || {},
    drug_picks: s.drug_picks || [],
    basis: s.basis || {},
    llm_ok: Boolean(s.llm_ok),
  };
}

async function handle(request, rebuild) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 });
  }
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin non configurato su Vercel.' }, { status: 503 });
  }
  try {
    // POST: dati GA4 forzati + ricostruzione della parte qualitativa (Gemini).
    // Se GA4 non e' configurato risponde ok:false con la guida di setup.
    if (rebuild) {
      const out = await rebuildStrategy();
      if (!out.ok) return NextResponse.json({ ok: false, setup: out.setup });
    }
    const insights = await getInsights();
    if (!insights.ok) return NextResponse.json(insights);
    const strategy = await getStrategy().catch(() => null);
    return NextResponse.json({ ...insights, strategy: publicStrategy(strategy) });
  } catch (err) {
    console.error('/api/admin/insights errore:', err);
    return NextResponse.json({ error: err.message || 'Errore sconosciuto.' }, { status: 500 });
  }
}

export function GET(request) {
  return handle(request, false);
}

export function POST(request) {
  return handle(request, true);
}
