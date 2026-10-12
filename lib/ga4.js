// Client minimale per la Google Analytics Data API (v1beta, runReport).
// Usa lo stesso service account di Firebase Admin: va aggiunto come
// "Visualizzatore" nella proprieta' GA4 e l'API "Google Analytics Data API"
// deve essere abilitata nel progetto GCP. GA4_PROPERTY_ID e' l'ID numerico
// della PROPRIETA' (Amministrazione > Impostazioni proprieta'), non l'ID
// stream ne' l'ID misurazione G-XXXX.
import { GoogleAuth } from 'google-auth-library';

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const PAGE_LIMIT = 100000;

export class Ga4Error extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function serviceAccountEmail() {
  return process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
}

export function isGa4Configured() {
  return Boolean(
    process.env.GA4_PROPERTY_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

let authClient;
async function getAccessToken() {
  if (!authClient) {
    authClient = new GoogleAuth({
      credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: [SCOPE],
    });
  }
  const client = await authClient.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

// Traduce gli errori HTTP della Data API in istruzioni di setup leggibili.
export function mapGaError(status, bodyText = '') {
  const email = serviceAccountEmail() || 'il service account di Firebase Admin';
  const text = String(bodyText);
  if (status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(text)) {
    return new Ga4Error(
      'La "Google Analytics Data API" non è abilitata nel progetto Google Cloud: abilitala dalla libreria API e riprova.',
      'api_disabled'
    );
  }
  if (status === 403) {
    return new Ga4Error(
      `Il service account non ha accesso alla proprietà GA4: in Analytics > Amministrazione > Gestione accesso proprietà aggiungi ${email} come Visualizzatore.`,
      'no_access'
    );
  }
  if (status === 400 || status === 404) {
    return new Ga4Error(
      'GA4_PROPERTY_ID non sembra valido: serve l\'ID numerico della proprietà (Amministrazione > Impostazioni proprietà), non l\'ID stream né G-XXXX.',
      'bad_property'
    );
  }
  if (status === 401) {
    return new Ga4Error('Autenticazione con Google rifiutata: controlla FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY.', 'auth');
  }
  return new Ga4Error(`Errore della Data API GA4 (HTTP ${status}).`, 'http');
}

export async function runReport(body, { fetchImpl = fetch, token } = {}) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const accessToken = token || (await getAccessToken());
  const res = await fetchImpl(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw mapGaError(res.status, await res.text().catch(() => ''));
  return res.json();
}

// Righe della risposta -> oggetti { dimensione: valore, metrica: numero }.
export function parseRows(resp, dimNames, metricNames) {
  return (resp?.rows || []).map((row) => {
    const out = {};
    dimNames.forEach((d, i) => {
      out[d] = row.dimensionValues?.[i]?.value ?? '';
    });
    metricNames.forEach((m, i) => {
      out[m] = Number(row.metricValues?.[i]?.value) || 0;
    });
    return out;
  });
}

async function runPaged(base, dimNames, metricNames, opts) {
  const rows = [];
  let offset = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const resp = await runReport({ ...base, limit: PAGE_LIMIT, offset }, opts);
    rows.push(...parseRows(resp, dimNames, metricNames));
    offset += PAGE_LIMIT;
    if (offset >= (resp.rowCount || 0)) break;
  }
  return rows;
}

// pageDaily: visite, utenti e tempo di coinvolgimento per pagina e giorno
// sugli ultimi `lookbackDays` (serve a calcolare la prima settimana di vita
// di ogni articolo); channels/countries: ultimi `windowDays`.
export async function fetchGaData({ lookbackDays = 120, windowDays = 28 } = {}, opts = {}) {
  const [pageDaily, channels, countries] = await Promise.all([
    runPaged(
      {
        dateRanges: [{ startDate: `${lookbackDays}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'date' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }],
      },
      ['pagePath', 'date'],
      ['screenPageViews', 'activeUsers', 'userEngagementDuration'],
      opts
    ),
    runPaged(
      {
        dateRanges: [{ startDate: `${windowDays}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
      },
      ['sessionDefaultChannelGroup'],
      ['sessions', 'engagedSessions'],
      opts
    ),
    runPaged(
      {
        dateRanges: [{ startDate: `${windowDays}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      },
      ['country'],
      ['activeUsers', 'screenPageViews'],
      opts
    ),
  ]);

  return {
    pageDaily: pageDaily.map((r) => ({
      path: r.pagePath,
      date: r.date,
      views: r.screenPageViews,
      users: r.activeUsers,
      engagementSec: r.userEngagementDuration,
    })),
    channels: channels.map((r) => ({ channel: r.sessionDefaultChannelGroup, sessions: r.sessions, engaged: r.engagedSessions })),
    countries: countries.map((r) => ({ country: r.country, users: r.activeUsers, views: r.screenPageViews })),
  };
}
