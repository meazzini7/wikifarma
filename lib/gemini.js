const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Cache del modello scelto (e della promise in corso, per non farne due in
// parallelo quando testo e immagine partono insieme) per il ciclo di vita
// dell'istanza serverless: prima veniva richiamato listModels() a ogni
// singola generateContent (2 chiamate per ogni articolo, 4 da quando
// l'immagine ha un suo prompt AI), sprecando quota Gemini inutilmente dato
// che il modello disponibile non cambia da una chiamata all'altra.
let modelPromise = null;

function pickModel() {
  if (modelPromise) return modelPromise;
  modelPromise = fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`)
    .then((res) => res.json())
    .then((data) => {
      const found = data.models?.find(
        (m) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent')
      );
      return found ? found.name.replace('models/', '') : 'gemini-1.5-flash';
    })
    .catch((err) => {
      modelPromise = null;
      throw err;
    });
  return modelPromise;
}

export function isGeminiConfigured() {
  return Boolean(GEMINI_KEY);
}

export async function callGemini(prompt) {
  const model = await pickModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }],
    }),
  });

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error(
      `Gemini (${model}) non ha restituito testo. Status HTTP: ${res.status}. ` +
        `finishReason: ${data?.candidates?.[0]?.finishReason || 'n/d'}. ` +
        `Errore: ${JSON.stringify(data?.error || data)}`
    );
    return null;
  }
  return text;
}
