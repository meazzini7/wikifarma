import { NextResponse } from 'next/server';
import { callGemini, isGeminiConfigured } from '@/lib/gemini';
import { requireAdmin } from '@/lib/verifyAdmin';
import { buildAdminBlogPrompt, buildDrugPrompt } from '@/lib/prompts';
import { buildArticleImages } from '@/lib/imageGen';
import { insertInlineImage } from '@/lib/content';
import { cleanGeneratedContent } from '@/lib/cleanContent';

export const maxDuration = 60;

export async function POST(request) {
  const isAdmin = await requireAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY non configurata su Vercel.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const topic = (body.topic || '').trim();
  const type = body.type === 'blog' ? 'blog' : 'drug';
  const category = type === 'drug' ? 'Farmaco' : 'Salute';

  if (!topic) {
    return NextResponse.json({ error: 'Titolo mancante.' }, { status: 400 });
  }

  try {
    const prompt = type === 'drug' ? buildDrugPrompt(topic) : buildAdminBlogPrompt(topic);
    const [raw, images] = await Promise.all([callGemini(prompt), buildArticleImages(topic, category)]);
    if (!raw) {
      return NextResponse.json({ error: 'Risposta AI vuota.' }, { status: 502 });
    }
    const content = cleanGeneratedContent(raw);
    const { cover, inline, fallback } = images;
    const finalContent = insertInlineImage(content, inline, topic, fallback);
    return NextResponse.json({ content: finalContent, image_url: cover });
  } catch {
    return NextResponse.json({ error: 'Errore del servizio AI.' }, { status: 500 });
  }
}
