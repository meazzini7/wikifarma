import { NextResponse } from 'next/server';
import { callGemini, isGeminiConfigured } from '@/lib/gemini';
import { requireAdmin } from '@/lib/verifyAdmin';

function cleanOutput(text) {
  let t = text.replace(/```html/g, '').replace(/```/g, '');
  const idx = t.indexOf('<h2>');
  if (idx !== -1) t = t.slice(idx);
  return t.trim();
}

function buildImageUrl(topic) {
  const clean = topic.replace(/[^a-zA-Z0-9 ]/g, '');
  const words = clean.trim().split(' ').filter(Boolean);
  let main = words[0] || 'medicine';
  if (main.length < 3 && words[1]) main = words[1];
  const prompt = encodeURIComponent(
    `${main} medicine box packaging white background studio product photography`
  );
  const seed = Math.floor(Math.random() * 9999);
  return `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=600&nologo=true&seed=${seed}`;
}

function buildPrompt(topic, type) {
  if (type === 'drug') {
    return `Agisci come redattore farmaceutico. Crea una scheda tecnica dettagliata per "${topic}". Usa SOLO tag <h2> e <p>. NON INSERIRE SALUTI, NON SCRIVERE 'ECCO LA GUIDA'. INIZIA SUBITO CON <h2>.
Struttura OBBLIGATORIA:
<h2>1- Indicazioni ${topic}</h2>
<h2>2- Meccanismo d'azione</h2>
<h2>3 - Studi svolti ed efficacia clinica</h2>
<h2>4 - Modalità d'uso e posologia</h2>
<h2>5 - Avvertenze</h2>
<h2>6 - Interazioni</h2>
<h2>7 - Controindicazioni</h2>
<h2>8 - Effetti indesiderati</h2>
<p><strong>Note:</strong> ${topic} è un medicinale vendibile secondo norme.</p>
Tono professionale e scientifico.`;
  }
  return `Scrivi un articolo di salute completo su "${topic}". Usa <h2> per i titoli e <p> per i paragrafi. Inserisci un box consiglio: <div class="box-tip"><b>Il Consiglio del Farmacista:</b> ...</div>. NON INSERIRE SALUTI, NON SCRIVERE 'ECCO L'ARTICOLO'. INIZIA SUBITO CON <h2>. Tono chiaro e professionale.`;
}

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

  if (!topic) {
    return NextResponse.json({ error: 'Titolo mancante.' }, { status: 400 });
  }

  try {
    const raw = await callGemini(buildPrompt(topic, type));
    if (!raw) {
      return NextResponse.json({ error: 'Risposta AI vuota.' }, { status: 502 });
    }
    return NextResponse.json({ content: cleanOutput(raw), image_url: buildImageUrl(topic) });
  } catch {
    return NextResponse.json({ error: 'Errore del servizio AI.' }, { status: 500 });
  }
}
