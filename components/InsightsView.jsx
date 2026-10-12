import Link from 'next/link';

const GREEN = '#054d2e';
const GCP_PROJECT = 'wikifarma-db37a';

const card = { background: '#fff', border: '1px solid #e3e8e4', borderRadius: 12, padding: '16px 18px', marginBottom: 18 };
const h2 = { fontSize: 18, margin: '0 0 12px', color: GREEN };
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#667', borderBottom: '1px solid #e3e8e4', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 14, borderBottom: '1px solid #f0f3f1', verticalAlign: 'top' };
const note = { fontSize: 13, color: '#667', marginTop: 0 };
const btn = { background: GREEN, color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' };

const dateIt = (ms) => (ms ? new Date(ms).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
const secs = (n) => (n ? `${Math.round(n)} s` : '–');

function Table({ head, children }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
        <thead>
          <tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Progress({ label, value, need }) {
  const pct = Math.min(100, Math.round((value / need) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 13, color: '#445' }}>{label}: <b>{value}</b> / {need}</div>
      <div style={{ background: '#eef2ef', borderRadius: 6, height: 10 }}>
        <div style={{ width: `${pct}%`, background: GREEN, height: 10, borderRadius: 6 }} />
      </div>
    </div>
  );
}

function Groups({ rows, empty }) {
  if (!rows.length) return <p style={{ ...note, marginBottom: 0 }}>{empty}</p>;
  return (
    <Table head={['Gruppo', 'Art.', 'Punteggio medio', 'Indice (× media)', 'Peso nella scelta']}>
      {rows.map((g) => (
        <tr key={g.id}>
          <td style={td}>{g.label}</td>
          <td style={td}>{g.n}</td>
          <td style={td}>{g.mean}</td>
          <td style={td}>{g.index}×</td>
          <td style={td}>{g.weight}</td>
        </tr>
      ))}
    </Table>
  );
}

function ArticleList({ rows, empty, last }) {
  if (!rows.length) return <p style={{ ...note, marginBottom: 0 }}>{empty}</p>;
  return (
    <Table head={['Articolo', 'Tema · stile', last.label]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td style={td}>
            <Link href={`/${r.slug}`} style={{ color: GREEN, fontWeight: 600 }}>{r.title}</Link>
            <div style={{ fontSize: 12, color: '#889' }}>
              {r.category}
              {r.gen_mode ? ` · ${r.gen_mode === 'exploit' ? 'scelto dalla strategia' : 'casuale'}` : ''}
            </div>
          </td>
          <td style={td}>{r.themeLabel}<div style={{ fontSize: 12, color: '#889' }}>{r.styleLabel}</div></td>
          <td style={td}>{last.get(r)}</td>
        </tr>
      ))}
    </Table>
  );
}

function SetupGuide({ setup }) {
  const step = { margin: '0 0 10px', fontSize: 14, lineHeight: 1.55 };
  return (
    <div style={card}>
      <h2 style={h2}>Collegamento a Google Analytics da completare</h2>
      <p style={{ ...step, color: '#8a5a00', background: '#fff4e0', padding: '8px 12px', borderRadius: 8 }}>{setup.message}</p>
      <p style={step}>
        <b>1.</b> Abilita la <b>Google Analytics Data API</b> nel progetto Google Cloud:{' '}
        <a href={`https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=${GCP_PROJECT}`} target="_blank" rel="noopener noreferrer" style={{ color: GREEN }}>apri la libreria API</a>{' '}
        e premi «Abilita».
      </p>
      <p style={step}>
        <b>2.</b> In Analytics → Amministrazione → <b>Gestione accesso proprietà</b> aggiungi come <b>Visualizzatore</b> questo indirizzo:
        <br /><code style={{ background: '#f2f5f3', padding: '2px 6px', borderRadius: 4, wordBreak: 'break-all' }}>{setup.service_account || 'FIREBASE_ADMIN_CLIENT_EMAIL (non impostata)'}</code>
      </p>
      <p style={step}>
        <b>3.</b> Su Vercel aggiungi la variabile <code>GA4_PROPERTY_ID</code> con l&apos;<b>ID proprietà</b> numerico (Analytics → Amministrazione → Impostazioni proprietà, in alto a destra).
        Non è l&apos;ID stream e non è l&apos;ID di misurazione che inizia per «G-». Poi rifai il deploy.
        {setup.property_id_set ? ' (La variabile risulta già impostata.)' : ''}
      </p>
      <p style={{ ...note, marginBottom: 0 }}>Appena i tre passaggi sono fatti, ricarica questa pagina: i dati compaiono da soli.</p>
    </div>
  );
}

const LEVEL_ON = { bg: '#e4f5ea', fg: '#14532d' };
const LEVEL_OFF = { bg: '#fff4e0', fg: '#8a5a00' };

export default function InsightsView({ data, onRefresh, refreshing }) {
  if (!data.ok) return <SetupGuide setup={data.setup} />;

  const { report: r, meta, strategy } = data;
  const l = r.learning;
  const t = r.totals;
  const tone = l.active ? LEVEL_ON : LEVEL_OFF;

  const stat = (label, value) => (
    <div style={{ flex: '1 1 120px', background: '#f6f9f7', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{value}</div>
      <div style={{ fontSize: 12, color: '#667' }}>{label}</div>
    </div>
  );

  return (
    <>
      <p style={{ ...note, marginBottom: 12 }}>
        Fonte: Google Analytics · aggiornato il {dateIt(meta.generated_at)}
        {meta.source === 'stale' ? ` · ⚠️ GA4 non risponde, mostro l'ultimo snapshot buono (${meta.ga_error})` : ''}
      </p>

      <div style={{ ...card, background: tone.bg, borderColor: 'transparent' }}>
        <div style={{ fontWeight: 700, color: tone.fg, marginBottom: 6 }}>
          {l.active ? 'Apprendimento attivo' : 'Apprendimento in attesa di dati'}
        </div>
        <Progress label="Articoli confrontabili (7-120 giorni di vita)" value={l.comparable} need={l.needArticles} />
        <Progress label="Visite nella prima settimana (somma dei confrontabili)" value={l.firstWeekViews} need={l.needViews} />
        <div style={{ fontSize: 13, color: tone.fg }}>
          {l.active
            ? `Gli articoli nuovi sono scelti dai pesi appresi nel ${Math.round((1 - l.exploreProbability) * 100)}% dei casi; il ${Math.round(l.exploreProbability * 100)}% resta sempre casuale per continuare a scoprire.`
            : 'Finché non si superano le due soglie gli articoli vengono scelti a caso: il sistema non promette nulla che i dati non sostengano.'}
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Cosa fare adesso</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.6 }}>
          {r.recommendations.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {stat('Visualizzazioni totali (28 gg)', t.views28All)}
        {stat('…di cui articoli', t.articleViews28)}
        {stat('Articoli con visite (28 gg)', `${t.articlesWithViews28}/${t.articles}`)}
        {stat('Visite da versioni tradotte', `${Math.round(t.intlShare28 * 100)}%`)}
        {stat('Articoli confrontabili', t.comparable)}
        {stat('…senza visite in 1ª settimana', t.comparableNoViews)}
      </div>

      <div style={card}>
        <h2 style={h2}>Cosa funziona</h2>
        <p style={note}>
          Si confronta la <b>prima settimana di vita</b> di ogni articolo (non il totale, che favorirebbe i più vecchi). Punteggio = visite × (1 + secondi di lettura medi / 60, massimo 180 s).
          L&apos;indice è corretto verso la media per non premiare i colpi di fortuna: 1× = nella media. Il peso (da 0,4 a 2,5) è quanto spinge quel gruppo nella scelta degli argomenti.
        </p>
        <h3 style={{ fontSize: 15, margin: '12px 0 6px' }}>Per tema</h3>
        <Groups rows={r.themes} empty="Nessun articolo confrontabile." />
        <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>Per stile del titolo</h3>
        <Groups rows={r.styles} empty="Nessun articolo confrontabile." />
        <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>Per categoria</h3>
        <Groups rows={r.categories} empty="Nessun articolo confrontabile." />
      </div>

      <div style={card}>
        <h2 style={h2}>I migliori articoli (prima settimana)</h2>
        <ArticleList rows={r.top} empty="Ancora nessun articolo confrontabile con visite." last={{ label: 'Visite · lettura · punteggio', get: (x) => `${x.fwViews} · ${secs(x.fwEngSec)} · ${x.score}` }} />
      </div>

      <div style={card}>
        <h2 style={h2}>I più deboli (prima settimana)</h2>
        <ArticleList rows={r.bottom} empty="Nessun articolo confrontabile." last={{ label: 'Visite · lettura · punteggio', get: (x) => `${x.fwViews} · ${secs(x.fwEngSec)} · ${x.score}` }} />
      </div>

      <div style={card}>
        <h2 style={h2}>Pagine più viste (ultimi 28 giorni)</h2>
        <Table head={['Pagina', 'Visualizzazioni']}>
          {r.topPages.map((p) => (
            <tr key={p.name}>
              <td style={td}>{p.name}{p.article ? '' : <span style={{ color: '#889', fontSize: 12 }}> · pagina del sito</span>}</td>
              <td style={td}>{p.views}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div style={card}>
        <h2 style={h2}>Traffico che non legge (da rivedere)</h2>
        <ArticleList rows={r.leaky} empty="Nessun articolo molto visitato con lettura sotto i 15 secondi." last={{ label: 'Visite 28 gg · lettura', get: (x) => `${x.views28} · ${secs(x.engSec28)}` }} />
      </div>

      <div style={card}>
        <h2 style={h2}>Gemme nascoste (lette a fondo ma poco viste)</h2>
        <ArticleList rows={r.gems} empty="Nessuna per ora." last={{ label: 'Visite 28 gg · lettura', get: (x) => `${x.views28} · ${secs(x.engSec28)}` }} />
      </div>

      <div style={card}>
        <h2 style={h2}>Da dove arrivano (ultimi 28 giorni)</h2>
        <Table head={['Canale', 'Sessioni', 'Coinvolte']}>
          {r.channels.map((c) => (
            <tr key={c.channel}><td style={td}>{c.channel || '(non assegnato)'}</td><td style={td}>{c.sessions}</td><td style={td}>{c.sessions ? `${Math.round((c.engaged / c.sessions) * 100)}%` : '–'}</td></tr>
          ))}
        </Table>
        <div style={{ height: 12 }} />
        <Table head={['Paese', 'Utenti', 'Visualizzazioni']}>
          {r.countries.map((c) => (
            <tr key={c.country}><td style={td}>{c.country}</td><td style={td}>{c.users}</td><td style={td}>{c.views}</td></tr>
          ))}
        </Table>
      </div>

      <div style={card}>
        <h2 style={h2}>La strategia batte il caso?</h2>
        <Table head={['Come è stato scelto', 'Articoli confrontabili', 'Punteggio medio']}>
          {r.modes.map((m) => (
            <tr key={m.mode}>
              <td style={td}>{m.mode === 'exploit' ? 'Dalla strategia (sfruttamento)' : 'Casuale (esplorazione)'}</td>
              <td style={td}>{m.n}</td>
              <td style={td}>{m.avgScore === null ? '–' : m.avgScore}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div style={card}>
        <h2 style={h2}>Strategia attuale</h2>
        {strategy ? (
          <>
            <p style={{ fontSize: 14, margin: '0 0 8px' }}>
              Parte qualitativa aggiornata il {dateIt(strategy.built_at_ms)}
              {strategy.active ? '' : ' · inattiva finché i dati non bastano'}
              {strategy.active && !strategy.llm_ok ? ' · (l\'analisi testuale non è riuscita: restano solo i pesi)' : ''}
            </p>
            {strategy.focus_brief ? (
              <blockquote style={{ margin: '0 0 12px', padding: '8px 12px', borderLeft: `3px solid ${GREEN}`, background: '#f6f9f7', fontSize: 14 }}>
                {strategy.focus_brief}
              </blockquote>
            ) : null}
            {['Benessere', 'Problemi Frequenti'].map((cat) => (
              <p key={cat} style={{ fontSize: 14, margin: '0 0 6px' }}>
                <b>Idee in coda · {cat}:</b> {(strategy.suggested_topics?.[cat] || []).join(' · ') || '–'}
              </p>
            ))}
            <p style={{ fontSize: 14, margin: '0 0 6px' }}><b>Farmaci da anticipare:</b> {strategy.drug_picks.join(', ') || '–'}</p>
            <p style={{ fontSize: 13, color: '#667', margin: '0 0 6px' }}><b>Esempi vincenti passati ai prompt:</b> {(strategy.basis?.winners || []).slice(0, 5).join(' · ') || '–'}</p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: '#667' }}>Non ancora creata: si costruisce da sola nel primo giorno libero del cron, oppure subito col pulsante qui sotto.</p>
        )}
        <button type="button" onClick={onRefresh} disabled={refreshing} style={{ ...btn, marginTop: 6 }}>
          {refreshing ? 'Aggiornamento in corso…' : 'Aggiorna da GA4 e ricostruisci la strategia'}
        </button>
      </div>
    </>
  );
}
