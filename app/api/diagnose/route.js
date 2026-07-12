import { NextResponse } from 'next/server';
import { callGemini, isGeminiConfigured } from '@/lib/gemini';

export async function POST(request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Servizio diagnosi non ancora configurato. Riprova più tardi." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const symptoms = (body.symptoms || '').trim();

  if (symptoms.length < 5) {
    return NextResponse.json({ error: 'Descrivi meglio i sintomi.' }, { status: 400 });
  }

  const prompt = `Sei un assistente medico virtuale. Utente: "${symptoms}". Inizia la risposta con '⚠️ NON SONO UN MEDICO.' Analizza i sintomi descritti, consiglia rimedi da banco (OTC) adeguati oppure segnala se è necessario rivolgersi al Pronto Soccorso. Usa tag HTML semplici (<p>, <strong>, <ul><li>). Tono serio e professionale, in italiano.`;

  try {
    const text = await callGemini(prompt);
    if (!text) {
      return NextResponse.json({ error: 'Servizio momentaneamente non disponibile.' }, { status: 502 });
    }
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: 'Errore del servizio AI.' }, { status: 500 });
  }
}
