export function buildDrugPrompt(topic) {
  return `Agisci come redattore farmaceutico. Scrivi una scheda tecnica per "${topic}".
NON INSERIRE SALUTI, NON SCRIVERE 'ECCO LA GUIDA'. INIZIA SUBITO CON <h2>.
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
Tono professionale.`;
}

export function buildAdminBlogPrompt(topic) {
  return `Scrivi un articolo di salute completo su "${topic}". Usa <h2> per i titoli e <p> per i paragrafi. Inserisci un box consiglio: <div class="box-tip"><b>Il Consiglio del Farmacista:</b> ...</div>. NON INSERIRE SALUTI, NON SCRIVERE 'ECCO L'ARTICOLO'. INIZIA SUBITO CON <h2>. Tono chiaro e professionale.`;
}

export function buildWellnessPrompt(topic) {
  return `Scrivi un articolo di blog 'Benessere' dettagliato su: "${topic}".
Usa un tono professionale ma empatico. NON INSERIRE SALUTI, INIZIA SUBITO CON <h2>.
Struttura HTML richiesta:
- <h2>Titolo Paragrafo</h2>
- <p>Testo approfondito...</p>
- <ul><li>Lista puntata...</li></ul>
- <h3>Curiosità</h3>
- <p>Conclusione...</p>
Lunghezza: almeno 600 parole.`;
}

export function buildProblemsPrompt(topic) {
  return `Scrivi una guida "Problem Solving" su: "${topic}". NON INSERIRE SALUTI, INIZIA SUBITO CON <h2>. Usa tag HTML <h2>, <p>, <ul><li>. Tono professionale. Almeno 600 parole.`;
}
