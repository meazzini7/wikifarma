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
  encyclopedia/page.jsx       Enciclopedia A-Z
  wellness/page.jsx           Guide benessere (type=blog, category=Benessere)
  problems/page.jsx           Problemi frequenti (category=Problemi Frequenti)
  diagnosis/page.jsx          Diagnosi AI (client component, chiama /api/diagnose)
  profile/page.jsx            Profilo utente: preferiti + storico diagnosi
  per-te/page.jsx             Raccomandazioni personalizzate (preferiti + cronologia letture)
  admin/page.jsx              Pannello admin protetto (generazione articoli, eliminazione)
  privacy/, contact/          Pagine statiche
  sitemap.js, robots.js       SEO tecnico (sitemap dinamica da Firestore, revalidate 1h)
  api/diagnose/               Gemini server-side per la diagnosi
  api/generate-article/       Generazione manuale da admin panel (protetta da lib/verifyAdmin.js)
  api/search/                 Ricerca live (prefix match su title_lower)
  api/track-visit/            Contatore visite privacy-friendly (IP hashato)
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
  cronTopics.js, cronAuth.js     Liste argomenti + verifica secret Vercel Cron
  email.js                      Notifica Resend (degrada in silenzio se non configurata)
  verifyAdmin.js                 Verifica JWT Firebase (per gating /api/generate-article)
  gtag.js                        Helper eventi GA4 custom
  constants.js                   ADMIN_EMAIL, SITE_URL, GA_ID, ADSENSE_ID, PLACEHOLDER_IMAGE

components/
  Navbar.jsx, Footer.jsx        Layout globale (menu mobile hamburger)
  LiveSearch.jsx                 Ricerca live con navigazione da tastiera
  SafeImage.jsx                  Immagine con fallback a cascata (generata -> pool -> placeholder)
  FavoriteButton.jsx, ShareButtons.jsx, ReadingTracker.jsx
  GAListener.jsx, VisitorTracker.jsx
```

## Collection Firestore
- `posts` — articoli. Campi chiave: `title`, `title_lower`, `slug`, `content` (HTML), `category`
  (`Farmaco` | `Benessere` | `Problemi Frequenti` | `Salute`), `type` (`drug` | `blog`), `image_url`,
  `created_at`. Regole: lettura pubblica, scrittura solo admin autenticato o Admin SDK.
- `diagnoses` — storico diagnosi utente (`userEmail`, `symptoms`, `response`). Regole: utente legge/scrive solo le proprie.
- `favorites` — preferiti (`userEmail`, `postId`, `slug`, `title`, `category`). Doc ID: `{userEmail}_{postId}`.
- `reading_history` — proxy per interesse utente (view count per post, non tempo di lettura preciso).
- `daily_visitors` — contatore visite anonimizzato (hash IP, non IP in chiaro).

## Variabili d'ambiente (Vercel)
Vedi `.env.example` per la lista completa. In sintesi:
- `NEXT_PUBLIC_FIREBASE_*` — config client Firebase (pubblica, non segreta)
- `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` — service account, **mai committare**, usato solo server-side dai cron
- `GEMINI_API_KEY` — server-side, mai esposta al client
- `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL` — opzionali, email degrada in silenzio se assenti
- `CRON_SECRET` — verificato contro l'header `Authorization` che Vercel invia automaticamente ai Cron Job

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
5. ✅ Cron generazione automatica (2/giorno, farmaci + benessere/problemi alternati) + email Resend
6. ✅ AdSense (Auto ads), GA4 (+ eventi custom: search, diagnosis_completed, favorite_added), ads.txt, privacy, sitemap.xml, robots.txt

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
