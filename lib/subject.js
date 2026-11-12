// "Soggetto" di un titolo: il titolo senza gli abbellimenti usati dai cron
// ("La verita' su", "Guida completa a", "(Guida 2026)", "#1234"...). Serve a non
// pubblicare piu' guide sullo stesso argomento con titoli solo diversi
// (es. "La verita' su Collagene" e "Tutto quello che devi sapere su Collagene").
const PREFIXES = [
  'la verita su', 'tutto quello che devi sapere su', 'guida completa a', 'guida completa al', 'i rischi di', 'i benefici nascosti di',
  'i benefici del', 'i benefici della', 'i benefici di', 'i benefici dei', 'i benefici delle', 'i benefici dello', "i benefici dell'",
];

export function subjectKey(title = '') {
  let t = String(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(\s*guida\s+\d{4}\s*\)/g, '')
    .replace(/#\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  for (const p of PREFIXES) {
    if (t.startsWith(`${p} `)) {
      t = t.slice(p.length + 1).trim();
      break;
    }
  }
  return t;
}
