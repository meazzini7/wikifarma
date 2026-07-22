const GEMINI_KEY = process.env.GEMINI_API_KEY;

async function pickModel() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`
  );
  const data = await res.json();
  const found = data.models?.find(
    (m) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent')
  );
  return found ? found.name.replace('models/', '') : 'gemini-1.5-flash';
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
