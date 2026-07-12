import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const BOTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baidu', 'yandex', 'sogou',
  'exabot', 'facebot', 'facebook', 'ia_archiver', 'semrush', 'mj12bot', 'ahrefs',
];

export async function POST(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  if (BOTS.some((bot) => ua.includes(bot))) {
    return NextResponse.json({ skipped: true });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const today = new Date().toISOString().slice(0, 10);
  // Hash the IP instead of storing it raw - keeps the daily-unique dedup
  // without retaining personal data (GDPR-friendlier than the old approach).
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);

  try {
    await setDoc(
      doc(db, 'daily_visitors', `${ipHash}_${today}`),
      { visit_date: today, ts: serverTimestamp() },
      { merge: true }
    );
  } catch {
    // daily_visitors Firestore rule not applied yet, or transient error - non-critical.
  }

  return NextResponse.json({ ok: true });
}
