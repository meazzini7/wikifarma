import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/verifyAdmin';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { loadPerformanceData } from '@/lib/performanceData';
import { buildReport, TRACKING_START_MS } from '@/lib/performance';
import { getStrategy, rebuildStrategy } from '@/lib/strategy';

export const maxDuration = 60;

function publicStrategy(s) {
  if (!s) return null;
  return {
    built_at_ms: s.built_at_ms || null,
    confidence: s.confidence,
    exploit_prob: s.exploit_prob,
    focus_brief: s.focus_brief || '',
    suggested_topics: s.suggested_topics || {},
    drug_picks: s.drug_picks || [],
    theme_weights: s.theme_weights || {},
    basis: s.basis || {},
    llm_ok: Boolean(s.llm_ok),
  };
}

async function buildResponse(refresh) {
  if (refresh) await rebuildStrategy();
  const [{ posts, stats }, strategy] = await Promise.all([loadPerformanceData(), getStrategy()]);
  const report = buildReport(posts, stats);
  return {
    generated_at: Date.now(),
    tracking_start_ms: TRACKING_START_MS,
    ...report,
    strategy: publicStrategy(strategy),
  };
}

async function handle(request, refresh) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 });
  }
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin non configurato su Vercel.' }, { status: 503 });
  }
  try {
    return NextResponse.json(await buildResponse(refresh));
  } catch (err) {
    console.error('/api/admin/insights errore:', err);
    return NextResponse.json({ error: err.message || 'Errore sconosciuto.' }, { status: 500 });
  }
}

export function GET(request) {
  return handle(request, false);
}

// Ricostruisce la strategia subito (una chiamata Gemini) invece di aspettare
// la scadenza settimanale.
export function POST(request) {
  return handle(request, true);
}
