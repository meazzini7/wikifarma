// Runner dei cron per GitHub Actions: esegue la logica dei cron direttamente
// qui (nessuna chiamata agli endpoint Vercel, altrimenti la CPU la pagherebbe
// comunque Vercel).
//
// Uso:  npx tsx scripts/run-cron.mjs drugs | content | all
//   all = farmaci e poi contenuti (la categoria del giorno decide quale dei due
//         genera; l'altro fa solo i lavori del "giorno libero").
// Stampa l'esito in JSON; exit 0 se tutto ok, 1 se un job e' fallito o manca
// la configurazione (cosi' GitHub segna la run in rosso e ti avvisa).
// Import dinamici con interop: i file di lib/ non hanno "type": "module", quindi
// a seconda della versione di Node/tsx gli export con nome arrivano come export
// ESM oppure dentro `default`. Cosi' il runner funziona su Node 20 e 22.
const load = async (path) => {
  const mod = await import(path);
  return { ...(mod.default && typeof mod.default === 'object' ? mod.default : {}), ...mod };
};
const { runContentCron, runDrugsCron } = await load('../lib/cronRunners.js');
const { SITE_URL } = await load('../lib/constants.js');

const JOBS = { drugs: runDrugsCron, content: runContentCron };
const arg = process.argv[2] || 'all';
const names = arg === 'all' ? ['drugs', 'content'] : [arg];

if (!names.every((n) => JOBS[n])) {
  console.error(`Job sconosciuto "${arg}". Usa: drugs | content | all`);
  process.exit(1);
}

// Facoltativo: dice al sito di rigenerare subito home/elenchi/sitemap e la
// pagina nuova. Senza CRON_SECRET si salta e le pagine si aggiornano da sole
// con l'ISR (6 ore per home ed elenchi, 12 per sitemap e articoli).
async function notifySite(slug) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { revalidated: false, reason: 'CRON_SECRET assente: aggiornamento via ISR' };
  try {
    const res = await fetch(`${SITE_URL}/api/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    return { revalidated: res.ok, http: res.status };
  } catch (err) {
    return { revalidated: false, reason: err.message };
  }
}

let failed = false;
const report = {};

for (const name of names) {
  const started = Date.now();
  try {
    const { status, body } = await JOBS[name]();
    const out = { ok: status < 400 && !body.configError, status, seconds: Math.round((Date.now() - started) / 1000), ...body };
    if (body.created) out.site = await notifySite(body.slug);
    if (!out.ok) failed = true;
    report[name] = out;
  } catch (err) {
    failed = true;
    report[name] = { ok: false, error: err.message || String(err), seconds: Math.round((Date.now() - started) / 1000) };
  }
}

console.log(JSON.stringify(report, null, 2));
// exit esplicito: il client Firestore lascia connessioni aperte e il processo non terminerebbe da solo.
process.exit(failed ? 1 : 0);
