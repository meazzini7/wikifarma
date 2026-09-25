// Regole di stile condivise da tutti i prompt: ora che la generazione è
// stata dimezzata (un articolo al giorno invece di due, vedi api/cron/*),
// investiamo il tempo/token risparmiati in qualità - testi che leggano come
// scritti da un professionista italiano competente, non da un modello che
// riempie una scaletta. Vietato inventare studi, percentuali o citazioni
// specifiche: la profondità deve venire da sfumature cliniche reali e da
// un contesto italiano concreto (nomi commerciali, fasce di prezzo SSN vs
// privato, quando rivolgersi al medico), mai da statistiche fabbricate.
const STYLE_RULES = `Regole di stile obbligatorie:
- Scrivi come un professionista italiano esperto che scrive per un pubblico colto ma non specialistico, non come un assistente AI che riempie una scaletta.
- Varia il ritmo: alterna frasi brevi e incisive a frasi più articolate. Non aprire più di due paragrafi di fila con lo stesso tipo di connettivo (evita l'abuso di "Inoltre,", "Infine,", "È importante notare che", "In conclusione,").
- Niente saluti, niente preamboli, niente frasi tipo "Ecco l'articolo" o "Spero questo sia utile". Zero meta-commenti sul fatto di essere un'IA.
- Sii specifico e concreto: nomi di principi attivi, dosaggi tipici, tempistiche realistiche, quando è il caso di rivolgersi a un medico/specialista. Evita generalità vaghe che si potrebbero scrivere su qualsiasi argomento.
- NON inventare studi scientifici, percentuali, statistiche o fonti specifiche che non conosci con certezza. Se serve dare un'indicazione di evidenza, usa formulazioni prudenti e generiche ("le linee guida cliniche indicano", "è opinione diffusa tra gli specialisti") invece di citare numeri o studi inesistenti.
- Copri l'argomento con respiro reale: sfumature, eccezioni, casi limite, differenze tra situazioni diverse - non solo la superficie più ovvia.`;

export function buildDrugPrompt(topic) {
  return `Agisci come un farmacista esperto che scrive la scheda informativa di "${topic}" per un pubblico di pazienti italiani.
${STYLE_RULES}
NON INSERIRE SALUTI, NON SCRIVERE 'ECCO LA GUIDA'. INIZIA SUBITO CON <h2>.
Struttura OBBLIGATORIA (usa <h2>, <p>, <ul><li> dove utile):
<h2>1- Indicazioni ${topic}</h2>
<h2>2- Meccanismo d'azione</h2>
<h2>3 - Studi svolti ed efficacia clinica</h2>
<h2>4 - Modalità d'uso e posologia</h2>
<h2>5 - Avvertenze</h2>
<h2>6 - Interazioni</h2>
<h2>7 - Controindicazioni</h2>
<h2>8 - Effetti indesiderati</h2>
<p><strong>Note:</strong> ${topic} è un medicinale vendibile secondo norme.</p>
Nella sezione 3 non inventare studi specifici: descrivi il consenso clinico generale e il profilo di efficacia/sicurezza noto per la classe di farmaco, in modo qualitativo.
Nella sezione 4 sii concreto con dosaggi e modalità reali per un adulto medio, segnalando quando serve personalizzazione medica.
Lunghezza: almeno 900 parole complessive, con contenuto reale in ogni sezione (non riempitivo).`;
}

export function buildAdminBlogPrompt(topic) {
  return `Scrivi un articolo di salute completo e approfondito su "${topic}", per un portale italiano di informazione medica.
${STYLE_RULES}
Usa <h2> per i titoli di sezione e <p> per i paragrafi, <ul><li> dove aiuta la leggibilità.
Inserisci un box consiglio pratico e specifico (non generico): <div class="box-tip"><b>Il Consiglio del Farmacista:</b> ...</div>.
NON INSERIRE SALUTI, NON SCRIVERE 'ECCO L'ARTICOLO'. INIZIA SUBITO CON <h2>.
Struttura consigliata: apri inquadrando il problema/argomento con concretezza, sviluppa 3-5 sezioni tematiche distinte (cause, meccanismi, cosa fare in pratica, quando preoccuparsi), chiudi con qualcosa di realmente utile, non un riassunto generico.
Lunghezza: almeno 800 parole.`;
}

export function buildWellnessPrompt(topic) {
  return `Scrivi un articolo per la sezione 'Benessere' di un portale di salute italiano, approfondito e specifico, su: "${topic}".
${STYLE_RULES}
NON INSERIRE SALUTI, INIZIA SUBITO CON <h2>.
Struttura HTML (adatta liberamente il numero di sezioni al contenuto, non forzare sempre lo stesso schema):
- 3-5 blocchi <h2>Titolo Paragrafo</h2> + <p>Testo approfondito con contenuto reale, non riempitivo</p>, eventualmente con <ul><li>
- una sezione <h3>Curiosità</h3> con un dettaglio genuinamente interessante e specifico sull'argomento (non ovvio)
- una chiusura pratica con indicazioni applicabili, non un riepilogo generico
Lunghezza: almeno 800 parole, con contenuto sostanzioso in ogni sezione.`;
}

export function buildProblemsPrompt(topic) {
  return `Scrivi una guida "Problem Solving" approfondita e concreta per un portale di salute italiano su: "${topic}".
${STYLE_RULES}
NON INSERIRE SALUTI, INIZIA SUBITO CON <h2>. Usa <h2>, <p>, <ul><li>.
Copri, dove pertinente all'argomento: cause reali e meno ovvie, cosa fare in pratica, quando è il caso di rivolgersi a un medico/specialista invece di gestire il problema da soli, e se rilevante un'indicazione realistica di costi in Italia (fascia di prezzo pubblico/privato, senza cifre inventate con falsa precisione - usa range plausibili).
Lunghezza: almeno 800 parole, con profondità reale su ogni punto trattato.`;
}
