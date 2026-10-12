import Link from 'next/link';

const GREEN = '#054d2e';

const card = {
  background: '#fff',
  border: '1px solid #e3e8e4',
  borderRadius: 12,
  padding: '16px 18px',
  marginBottom: 18,
};
const h2 = { fontSize: 18, margin: '0 0 12px', color: GREEN };
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#667', borderBottom: '1px solid #e3e8e4', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 14, borderBottom: '1px solid #f0f3f1', verticalAlign: 'top' };

const LEVELS = {
  cold: { label: 'Dati scarsi', bg: '#fff4e0', fg: '#8a5a00', note: 'Per ora le decisioni si appoggiano soprattutto al segnale storico di Google Analytics.' },
  emerging: { label: 'Dati in crescita', bg: '#e6f0ff', fg: '#164a99', note: 'I numeri propri iniziano a contare, ma restano indizi.' },
  solid: { label: 'Dati solidi', bg: '#e4f5ea', fg: '#14532d', note: 'Il campione è sufficiente per orientare le scelte.' },
};

const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`);
const dateIt = (ms) => (ms ? new Date(ms).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '–');

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

function Bar({ value, max }) {
  const w = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: '#eef2ef', borderRadius: 6, height: 8, minWidth: 80 }}>
      <div style={{ width: `${w}%`, background: GREEN, height: 8, borderRadius: 6 }} />
    </div>
  );
}

function ArticleList({ rows, empty, metric }) {
  if (!rows.length) return <p style={{ color: '#667', fontSize: 14, margin: 0 }}>{empty}</p>;
  return (
    <Table head={['Articolo', 'Tema', 'Visite', 'Lettura', metric.label]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td style={td}>
            <Link href={`/${r.slug}`} style={{ color: GREEN, fontWeight: 600 }}>{r.title}</Link>
            <div style={{ fontSize: 12, color: '#889' }}>{r.category}{r.gen_mode ? ` · ${r.gen_mode === 'exploit' ? 'scelto dalla strategia' : 'casuale'}` : ''}</div>
          </td>
          <td style={td}>{r.themeLabel}</td>
          <td style={td}>{r.views}</td>
          <td style={td}>{pct(r.engRate)}</td>
          <td style={td}>{metric.get(r)}</td>
        </tr>
      ))}
    </Table>
  );
}

export default function InsightsView({ data, onRefresh, refreshing }) {
  const level = LEVELS[data.confidence.level] || LEVELS.cold;
  const maxTheme = Math.max(0, ...data.themes.map((t) => t.score));
  const weights = data.strategy?.theme_weights || {};
  const t = data.totals;

  const stat = (label, value) => (
    <div style={{ flex: '1 1 110px', background: '#f6f9f7', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{value}</div>
      <div style={{ fontSize: 12, color: '#667' }}>{label}</div>
    </div>
  );

  return (
    <>
      <div style={{ ...card, background: level.bg, borderColor: 'transparent' }}>
        <div style={{ fontWeight: 700, color: level.fg }}>{level.label}</div>
        <div style={{ fontSize: 14, color: level.fg }}>
          {level.note} Misure proprie attive dal {dateIt(data.tracking_start_ms).split(',')[0]}: {data.confidence.totalViews} visite da {data.confidence.articlesWithViews} articoli con almeno 3 visite.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {stat('Articoli', t.articles)}
        {stat('Visite misurate', t.views)}
        {stat('Letture da 30s+', t.engaged)}
        {stat('Scroll fino in fondo', t.deep)}
        {stat('Condivisioni', t.shares)}
        {stat('Preferiti', t.favs)}
        {stat('Visite estere', t.views_intl)}
      </div>

      <div style={card}>
        <h2 style={h2}>Dove spingere</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.6 }}>
          {data.recommendations.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>

      <div style={card}>
        <h2 style={h2}>Temi</h2>
        <p style={{ fontSize: 13, color: '#667', marginTop: 0 }}>
          Punteggio = lettura reale per articolo (non il numero di articoli), corretto verso la media per non premiare i colpi di fortuna.
          «Valore» è una mia stima della domanda pubblicitaria tipica del tema, non un dato AdSense. «Peso» è quanto la generazione automatica spinge quel tema.
        </p>
        <Table head={['Tema', 'Art.', 'Visite', 'Lettura', 'Punteggio', 'Valore', 'Peso']}>
          {data.themes.map((th2) => (
            <tr key={th2.id}>
              <td style={td}>{th2.label}</td>
              <td style={td}>{th2.articles}</td>
              <td style={td}>{th2.views}</td>
              <td style={td}>{pct(th2.engRate)}</td>
              <td style={{ ...td, minWidth: 110 }}>
                <Bar value={th2.score} max={maxTheme} />
                <span style={{ fontSize: 12, color: '#667' }}>{th2.score}</span>
              </td>
              <td style={td}>×{th2.cpc}</td>
              <td style={td}>{weights[th2.id] !== undefined ? weights[th2.id] : '–'}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div style={card}>
        <h2 style={h2}>Categorie</h2>
        <Table head={['Categoria', 'Articoli', 'Visite', 'Lettura', 'Punti/settimana per articolo']}>
          {data.categories.map((c) => (
            <tr key={c.name}>
              <td style={td}>{c.name}</td>
              <td style={td}>{c.articles}</td>
              <td style={td}>{c.views}</td>
              <td style={td}>{pct(c.engRate)}</td>
              <td style={td}>{c.avgPerWeek}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div style={card}>
        <h2 style={h2}>I migliori articoli</h2>
        <ArticleList rows={data.top} empty="Ancora nessun dato di lettura." metric={{ label: 'Punti/sett.', get: (r) => Math.round(r.perWeek * 10) / 10 }} />
      </div>

      <div style={card}>
        <h2 style={h2}>Traffico che non legge (da rivedere)</h2>
        <ArticleList rows={data.leaky} empty="Nessun articolo con molto traffico e lettura quasi nulla, per ora." metric={{ label: 'Scroll', get: (r) => pct(r.deepRate) }} />
      </div>

      <div style={card}>
        <h2 style={h2}>Gemme nascoste (lette a fondo ma poco viste)</h2>
        <ArticleList rows={data.gems} empty="Servono più dati per individuarle." metric={{ label: 'Scroll', get: (r) => pct(r.deepRate) }} />
      </div>

      <div style={card}>
        <h2 style={h2}>Fanalino di coda</h2>
        <p style={{ fontSize: 13, color: '#667', marginTop: 0 }}>
          Solo articoli con almeno 3 visite e 2 settimane di vita (un articolo a zero visite non è «andato male»: nessuno l&apos;ha ancora trovato).
          Articoli senza alcuna visita misurata: <b>{t.no_views}</b> su {t.articles}.
        </p>
        <ArticleList rows={data.bottom} empty="Nessun articolo ha ancora abbastanza dati per essere giudicato." metric={{ label: 'Punti/sett.', get: (r) => Math.round(r.perWeek * 10) / 10 }} />
      </div>

      <div style={card}>
        <h2 style={h2}>La strategia batte il caso?</h2>
        <Table head={['Come è stato scelto', 'Articoli', 'Lettura', 'Punti/settimana per articolo']}>
          {data.modes.map((m) => (
            <tr key={m.mode}>
              <td style={td}>{m.mode === 'exploit' ? 'Dalla strategia (sfruttamento)' : 'Casuale (esplorazione)'}</td>
              <td style={td}>{m.articles}</td>
              <td style={td}>{pct(m.engRate)}</td>
              <td style={td}>{m.avgPerWeek === null ? '–' : m.avgPerWeek}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div style={card}>
        <h2 style={h2}>Strategia attuale</h2>
        {data.strategy ? (
          <>
            <p style={{ fontSize: 14, margin: '0 0 8px' }}>
              Aggiornata il {dateIt(data.strategy.built_at_ms)} · fiducia: <b>{data.strategy.confidence}</b> · scelta dalla strategia nel{' '}
              <b>{Math.round((data.strategy.exploit_prob || 0) * 100)}%</b> dei casi, il resto casuale
              {data.strategy.llm_ok ? '' : ' · (l\'analisi testuale non è riuscita: restano solo i pesi per tema)'}
            </p>
            {data.strategy.focus_brief ? (
              <blockquote style={{ margin: '0 0 12px', padding: '8px 12px', borderLeft: `3px solid ${GREEN}`, background: '#f6f9f7', fontSize: 14 }}>
                {data.strategy.focus_brief}
              </blockquote>
            ) : null}
            {['Benessere', 'Problemi Frequenti'].map((cat) => (
              <p key={cat} style={{ fontSize: 14, margin: '0 0 6px' }}>
                <b>Idee in coda · {cat}:</b> {(data.strategy.suggested_topics?.[cat] || []).join(' · ') || '–'}
              </p>
            ))}
            <p style={{ fontSize: 14, margin: '0 0 6px' }}>
              <b>Farmaci da anticipare:</b> {data.strategy.drug_picks.join(', ') || '–'}
            </p>
            <p style={{ fontSize: 13, color: '#667', margin: '0 0 6px' }}>
              <b>Vincitori usati come riferimento:</b> {(data.strategy.basis?.winners || []).join(' · ') || '–'}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: '#667' }}>Non ancora creata: si costruisce da sola nel primo giorno libero del cron, oppure subito col pulsante qui sotto.</p>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          style={{ marginTop: 6, background: GREEN, color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          {refreshing ? 'Ricostruzione in corso…' : 'Ricostruisci la strategia ora'}
        </button>
      </div>
    </>
  );
}
