# WikiFarma - Contesto Progetto

## Stack
- Next.js 14 (App Router), React 18
- Firebase: Auth (login Google), Firestore (database), Storage (configurato, non ancora usato attivamente)
- Firebase Admin SDK (`firebase-admin`) per operazioni server-side senza sessione utente (cron)
- Gemini API (server-side, mai esposta al client) per diagnosi AI e generazione articoli
- Resend per email transazionali (notifica nuovo articolo)
- `jose` per verificare i Firebase ID token lato server senza Firebase Admin (solo per gating admin su `/api/generate-article`)
- Deploy: Vercel, dominio wikifarma.it **collegato e live sul branch `main`**
- Firebase project ID: `wikifarma-db37a`
- Admin: solo `meazzini7@gmail.com` (vedi `lib/constants.js`)

## Origine
Migrazione da vecchio sito PHP/MySQL (one.com) a questo stack. 445 articoli sono stati migrati dal
vecchio database MySQL (poi ridotti a 383 dopo deduplicazione, vedi sotto). La logica di business
(routing, diagnosi AI, admin, generazione automatica) è stata replicata fedelmente dal PHP originale,
poi migliorata dove il vecchio codice aveva bug conosciuti (vedi "Bug ereditati dal vecchio sito").

## Struttura del codice

```
app/
  page.jsx                    Homepage (hero, ricerca live, contatori, ultimi articoli)
  [slug]/page.jsx             Pagina articolo (dinamica, JSON-LD, canonical, correlati, condivisione)
  encyclopedia/page.jsx       Redirect a /encyclopedia/[letter] (compat per i vecchi link ?let=X)
  encyclopedia/[letter]/page.jsx  Enciclopedia A-Z, statica (generateStaticParams, 26 lettere)
  wellness/page.jsx           Guide benessere (type=blog, category=Benessere)
  problems/page.jsx           Problemi frequenti (category=Problemi Frequenti)
  diagnosis/page.jsx          Diagnosi AI (client component, chiama /api/diagnose)
  profile/page.jsx            Profilo utente: preferiti + storico diagnosi
  per-te/page.jsx             Raccomandazioni personalizzate (preferiti + cronologia letture)
  admin/page.jsx              Pannello admin protetto (generazione articoli, eliminazione)
  admin/insights/page.jsx     Pannello SEGRETO di valutazione (temi/articoli che rendono, strategia, dove spingere)
  privacy/, contact/          Pagine statiche
  sitemap.js, robots.js       SEO tecnico (sitemap dinamica da Firestore, revalidate 3h)
  api/diagnose/               Gemini server-side per la diagnosi
  api/generate-article/       Generazione manuale da admin panel (protetta da lib/verifyAdmin.js)
  api/track-visit/            Contatore visite privacy-friendly (IP hashato)
  api/admin/insights/         Dati del pannello insights (solo admin, verifica JWT; POST = ricostruisce la strategia)
  api/cron/drugs/             Cron farmaci (lista prioritaria, sequenziale, dedup)
  api/cron/content/           Cron benessere/problemi (alterna per giorno, random+dedup)

lib/
  firebase.js                 Client SDK (auth lazy-init per non rompere il build)
  firebaseAdmin.js             Admin SDK (solo cron, richiede FIREBASE_ADMIN_*)
  firestore.js                 Query pubbliche sulla collection posts
  favorites.js                  Preferiti + storico letture (collections favorites, reading_history)
  gemini.js, prompts.js         Client Gemini + prompt per farmaco/benessere/problemi
  articleGenerator.js           Logica condivisa di generazione articolo (usata dai cron)
  imageGen.js                   Immagini: pollinations.ai primario (univoco per titolo) +
                                 pool Unsplash curato come fallback (scelto per hash del titolo)
  content.js                    Inserimento immagine inline a meta' articolo (tra due paragrafi)
  cleanContent.js                Pulizia output Gemini (fence, doc HTML completo, preamboli)
  cronTopics.js, cronAuth.js     Liste argomenti + verifica secret cron esterno
  email.js                      Notifica Resend (degrada in silenzio se non configurata)
  verifyAdmin.js                 Verifica JWT Firebase (per gating /api/generate-article)
  gtag.js                        Helper eventi GA4 custom
  ga4.js                         Client GA4 Data API (runReport) col service account di Firebase Admin
  insightsSchema.js              SCHEMA_VERSION (4) dello snapshot, separato per non far importare il client GA4 alle pagine pubbliche
  related.js                     Correlati per pertinenza (tema/stile/parole/categoria + popolarita' GA), "piu' letti", anche per le
                                  pagine tradotte; candidati e popolari in Data Cache 6h
  affiliate.js                   Prodotti Amazon.it per tema (mappa fissa, link di RICERCA col tag, nessun prezzo/API); [] per temi sensibili
  insights.js                    Valutazione da GA4: punteggio prima settimana, gruppi, pesi, soglie, cache 12h
  performance.js                 Classificazione pura: tema (classifyTopic), stile del titolo, scelta pesata
  performanceData.js             Lettura Admin SDK dei metadati degli articoli
  strategy.js                    Piano di generazione: pesi da GA4 + brief/idee Gemini settimanali (strategy/current)
  constants.js                   ADMIN_EMAIL, SITE_URL, GA_ID, ADSENSE_ID, AMAZON_TAG, PLACEHOLDER_IMAGE

components/
  Navbar.jsx, Footer.jsx        Layout globale (menu mobile hamburger)
  LiveSearch.jsx                 Ricerca live con navigazione da tastiera (query diretta a Firestore
                                  dal client, nessuna funzione serverless dedicata)
  SafeImage.jsx                  Immagine con fallback a cascata (generata -> pool -> placeholder)
  FavoriteButton.jsx, ShareButtons.jsx, ReadingTracker.jsx
  GAListener.jsx, VisitorTracker.jsx
  GoogleAnalytics.jsx            Script GA4, escluso sotto /admin (le visite admin non sporcano i dati)
  InsightsView.jsx               Parte visiva del pannello /admin/insights (incl. card "Fidelizzazione")
  AffiliateBox.jsx               Box "Prodotti utili" (client: evento GA4 affiliate_click)
  RelatedSection.jsx, Breadcrumb.jsx, ReadingProgress.jsx   Fidelizzazione in pagina articolo (correlati/piu' letti, breadcrumb, barra di lettura)
```

## Collection Firestore
- `posts` — articoli. Campi chiave: `title`, `title_lower`, `slug`, `content` (HTML), `category`
  (`Farmaco` | `Benessere` | `Problemi Frequenti` | `Salute`), `type` (`drug` | `blog`), `image_url`,
  `created_at`. Regole: lettura pubblica, scrittura solo admin autenticato o Admin SDK.
- `diagnoses` — storico diagnosi utente (`userEmail`, `symptoms`, `response`). Regole: utente legge/scrive solo le proprie.
- `favorites` — preferiti (`userEmail`, `postId`, `slug`, `title`, `category`). Doc ID: `{userEmail}_{postId}`.
- `reading_history` — proxy per interesse utente (view count per post, non tempo di lettura preciso).
- `daily_visitors` — contatore visite anonimizzato (hash IP, non IP in chiaro).
- `analytics` — doc `insights`: snapshot della valutazione da GA4 (JSON in `report_json`, `schemaVersion`,
  `generated_at`). Cache di 12h; se GA4 non risponde si usa l'ultimo snapshot buono. Solo Admin SDK.
- `strategy` — doc `current`: parte qualitativa della strategia (brief editoriale, idee di titolo, farmaci da
  anticipare, titoli vincenti/perdenti come esempi). Ricostruita ogni 7 giorni nel giorno libero della route
  cron/content, o dal pannello insights. Solo Admin SDK. I post hanno anche `gen_mode` (`exploit`|`explore`).

## Variabili d'ambiente (Vercel)
Vedi `.env.example` per la lista completa. In sintesi:
- `NEXT_PUBLIC_FIREBASE_*` — config client Firebase (pubblica, non segreta)
- `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` — service account, **mai committare**, usato solo server-side dai cron
- `GEMINI_API_KEY` — server-side, mai esposta al client
- `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL` — opzionali, email degrada in silenzio se assenti
- `GA4_PROPERTY_ID` — ID numerico della PROPRIETA' GA4 (Analytics > Amministrazione > Impostazioni proprieta'),
  non l'ID stream ne' l'ID misurazione G-XXXX. Serve anche: Google Analytics Data API abilitata nel progetto GCP e
  `FIREBASE_ADMIN_CLIENT_EMAIL` aggiunto come Visualizzatore nella proprieta' GA4.
- `CRON_SECRET` — verificato contro l'header `Authorization: Bearer` inviato da cron-job.org (servizio esterno
  gratuito; Vercel Cron Jobs richiede piano Pro, non usato)

## Convenzioni codice
- Componenti in `app/` (App Router), client component solo dove serve interattivita'/auth (`'use client'`)
- Mai esporre chiavi API segrete lato client — solo in funzioni server-side (`app/api/*/route.js`), mai in `NEXT_PUBLIC_*`
- Query Firestore: evitare `where().orderBy()` su campi diversi (richiede indice composito manuale non
  creabile da qui) — filtrare e ordinare in memoria quando il volume dati lo consente
- Usa la semplicita': evita astrazioni premature, no over-engineering
- Prima di editare un file, leggilo con Read (necessario per Edit)
- Build di verifica (`npm run build`) prima di ogni commit che tocca codice server/route

## Bug ereditati dal vecchio sito (gia' risolti qui, da non reintrodurre)
- Il vecchio `cleanAIOutput` PHP (e la sua prima porta qui) cercava solo `<h2>` letterale e un fence
  ```` ```html ````: se Gemini rispondeva con un documento HTML completo o usava `<h1>`, restava HTML
  grezzo visibile in testa all'articolo. Ora `lib/cleanContent.js` estrae `<body>`, scarta preamboli,
  normalizza `<h1>`→`<h2>`.
- I cron benessere/problemi (`cron_daily2/3.php` originali) sceglievano un argomento a caso senza
  controllare se esisteva gia' un post con quel titolo, generando doppioni. `pickRandomTopic` in
  `lib/articleGenerator.js` ora controlla Firestore prima di generare.
- La mappa parole-chiave -> foto era troppo piccola (5-20 voci) per centinaia di articoli, causando
  immagini identiche su articoli diversi. `lib/imageGen.js` ora genera un'immagine univoca per titolo
  via pollinations.ai, con pool curato solo come fallback su errore di caricamento.
- `data-ad-slot="AUTO"` (AdSense) non e' mai stato un ID slot valido: rimosso, si usa Auto Ads
  (script scoped alla sola pagina articolo).

## Stato attuale (fedele al codice, luglio 2026)
1. ✅ Scaffold base (package.json, layout, Firebase client/admin)
2. ✅ Enciclopedia A-Z + pagina articolo singolo (JSON-LD, canonical, correlati, condivisione)
3. ✅ Diagnosi AI (Gemini server-side) + storico utente + preferiti + "Per Te"
4. ✅ Pannello Admin (solo `meazzini7@gmail.com`): generazione articoli, eliminazione per intervallo/selezione
5. ✅ Cron generazione automatica (1/giorno: farmaci nei giorni pari, benessere/problemi alternati nei giorni
   dispari - ridotto da 2/giorno su richiesta esplicita per contenere CPU/quota e dare priorità alla qualità
   sul volume) + email Resend
6. ✅ AdSense (Auto ads), GA4 (+ eventi custom: search, diagnosis_completed, favorite_added), ads.txt, privacy, sitemap.xml, robots.txt

7. ✅ Ciclo di apprendimento da GA4 (`lib/ga4.js`, `lib/insights.js`, `lib/strategy.js`): punteggio sulla PRIMA
   settimana di vita di ogni articolo (visite x (1 + min(secondi di lettura, 180)/60)), stati provvisorio/
   confrontabile (7-120 gg, solo se creato dopo il lancio del sito 13/07/2026)/datato, gruppi per tema, stile del
   titolo e categoria con shrinkage verso la media (K=3), peso = indice limitato a 0,4-2,5. L'apprendimento si attiva
   solo con >=6 articoli confrontabili e >=25 visite di prima settimana; sotto soglia tutto resta casuale. Quando e'
   attivo, il 75% delle generazioni (categoria + argomento) segue i pesi e riceve nel prompt il brief editoriale con
   titoli vincenti/perdenti; il 25% resta sempre casuale. `gen_mode` permette al pannello di misurare se la
   strategia batte il caso. Pannello riservato: `/admin/insights` (login Google admin, dati via API che verifica il
   JWT). Il traffico `/admin` e' escluso da GA.

Prossimi passi aperti: nessuna fase strutturale mancante: eventuali richieste sono miglioramenti
incrementali (i18n, performance, nuove feature) da trattare come task a se stanti.

## Regole di lavoro
- Testa sempre in locale (`npm run build`, e quando serve `npm run dev`/screenshot) prima di pushare
- Fai commit dopo ogni fase/fix completato, con messaggio chiaro sul "perche'"
- Il dominio wikifarma.it e' **gia' collegato a `main`** ed e' il sito live: ogni merge su `main` va in
  produzione. Verificare build pulita prima di mergere.
- Non committare mai chiavi private (service account, API key) — se usate temporaneamente per uno
  script di migrazione/patch dati, tenerle fuori dal repo (scratchpad) ed eliminarle a fine uso
- Quando la conversazione si allunga, ricorda all'utente di usare `/clear` o `/compact`

## Fidelizzazione (obiettivo: tenere i lettori sul portale)
- Pagina articolo (it e tradotte): breadcrumb + BreadcrumbList JSON-LD, tempo di lettura, barra di avanzamento, box "Leggi anche"
  inline a ~68% (`insertReadAlso` in `lib/content.js`), correlati pertinenti (`lib/related.js`), lista "I piu' letti"; home: "I piu' letti
  del momento". Niente elementi fissi/invadenti (AdSense).
- Le pagine tradotte linkano solo articoli gia' tradotti (altrimenti i crawler farebbero partire traduzioni in massa). Il pool inglese cresce
  nel giorno libero di `cron/content` con `translateNextPopular` (l'articolo piu' letto non ancora tradotto, 1 ogni 2 giorni).
- Misura: card "Fidelizzazione" in `/admin/insights` (pagine per sessione vs periodo precedente, pagine d'ingresso che trattengono/perdono).
  GA4 report `site` e `landing` in `lib/ga4.js`.

## Affiliazione Amazon (monetizzazione)
- Tracking ID `wikifarma7-21` (Amazon.it; lo Store ID paolomeazzini-21 raggruppa i tracking ID, il parametro `tag` usa il tracking ID; `AMAZON_TAG` in `lib/constants.js`, override con `NEXT_PUBLIC_AMAZON_TAG`). Box "Prodotti utili" in fondo
  agli articoli italiani (non nelle pagine tradotte), 3 link di RICERCA su amazon.it scelti per tema (`lib/affiliate.js`).
- Regole da rispettare: avviso di affiliazione nel box + footer + privacy; link con `rel="sponsored nofollow noopener noreferrer"`;
  NON mostrare prezzi/immagini Amazon senza PA-API; niente link nelle email. Sito di salute: solo prodotti da banco di uso comune
  (cura personale, dispositivi domestici, libri), mai farmaci/integratori con promesse; nessun box per temi sensibili (oncologia, suicidio,
  dipendenze...), salute sessuale, psiche, urologia/ginecologia, farmaci di classe non riconosciuta.
- Misura: evento GA4 `affiliate_click` (parametri item, theme, article) -> Eventi in GA4; vendite reali nel report Amazon Associates.
