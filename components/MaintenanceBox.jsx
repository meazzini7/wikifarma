'use client';

import { useState } from 'react';

const KIND = { fix: 'si ripara da solo', regen: 'da riscrivere', manual: 'da guardare a mano' };

// Manutenzione degli articoli (admin): controllo, riparazione automatica,
// rigenerazione dei testi rotti, assegnazione delle foto Unsplash.
export default function MaintenanceBox({ user }) {
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState(null);
  const [msg, setMsg] = useState(null);

  async function call(action) {
    setBusy(action);
    setMsg(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/maintenance', {
        method: action === 'audit' ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: action === 'audit' ? undefined : JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Errore.');
      if (action === 'audit') {
        setReport(data);
      } else if (action === 'fix') {
        setMsg({ ok: true, text: `Riparati ${data.fixed} articoli. Rilancio il controllo...` });
        await call('audit');
        return;
      } else if (action === 'regenerate') {
        setMsg({ ok: true, text: `Riscritti ${data.regenerated?.length || 0} articoli${data.failed?.length ? `, ${data.failed.length} non riusciti` : ''}. Ne restano ${data.remaining ?? 0}.` });
      } else if (action === 'photos') {
        if (data.ok === false) setMsg({ ok: false, text: data.error });
        else setMsg({ ok: true, text: `Foto assegnate: ${data.assigned}. Articoli ancora senza foto: ${data.remaining}.${data.stopped ? ` (${data.stopped})` : ''}` });
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  const btn = (action, label, bg) => (
    <button className="btn-tool" style={{ background: bg, marginRight: 8, marginBottom: 8 }} disabled={Boolean(busy)} onClick={() => call(action)}>
      {busy === action ? 'ATTENDI...' : label}
    </button>
  );

  return (
    <div className="tool-box" style={{ marginBottom: 20 }}>
      <div className="tool-title">🧰 Manutenzione articoli</div>
      <p style={{ fontSize: 13, color: '#666' }}>
        Controlla tutti gli articoli, ripara i difetti sicuri (HTML grezzo, titoli sporchi, caratteri rovinati...), riscrive quelli vuoti o troncati
        e assegna una foto Unsplash unica a ciascuno.
      </p>
      {btn('audit', 'CONTROLLA', '#054d2e')}
      {btn('fix', 'RIPARA AUTOMATICAMENTE', '#1565c0')}
      {btn('regenerate', 'RISCRIVI I ROTTI (3 alla volta)', '#e65100')}
      {btn('photos', 'ASSEGNA FOTO UNSPLASH', '#6a1b9a')}
      {msg && (
        <p style={{ background: msg.ok ? '#d4edda' : '#f8d7da', padding: 10, borderRadius: 6 }}>
          {msg.ok ? '✅' : '⚠️'} {msg.text}
        </p>
      )}
      {report && (
        <div style={{ fontSize: 14 }}>
          <p>
            <b>{report.total}</b> articoli · <b>{report.withProblems}</b> con difetti · <b>{report.noPhoto}</b> senza foto Unsplash
            {!report.unsplash && ' (manca UNSPLASH_ACCESS_KEY su Vercel)'}
          </p>
          {report.summary.length === 0 ? (
            <p>✅ Nessun difetto trovato.</p>
          ) : (
            <ul>
              {report.summary.map((s) => (
                <li key={s.code}>
                  <b>{s.count}</b> · {s.msg} <i>({KIND[s.kind]})</i>
                </li>
              ))}
            </ul>
          )}
          {report.duplicates?.length > 0 && (
            <p>
              ⚠️ Titoli doppi: {report.duplicates.slice(0, 8).map((d) => `${d.title} (${d.slugs.length})`).join('; ')}
              {report.duplicates.length > 8 ? '…' : ''}
            </p>
          )}
          {report.items?.length > 0 && (
            <details>
              <summary>Elenco articoli con difetti ({report.items.length})</summary>
              <ul>
                {report.items.map((it) => (
                  <li key={it.slug}>
                    <a href={`/${it.slug}`} target="_blank" rel="noreferrer">{it.title || it.slug}</a>: {it.issues.map((i) => i.code).join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
