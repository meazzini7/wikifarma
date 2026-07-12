'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseAuth, googleProvider, db } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/lib/constants';

export default function AdminPage() {
  const [user, setUser] = useState(undefined);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [genTopic, setGenTopic] = useState('');
  const [genType, setGenType] = useState('drug');
  const [genLoading, setGenLoading] = useState(false);
  const [genMessage, setGenMessage] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);

  const isAdmin = user && user.email === ADMIN_EMAIL;

  async function loadPosts() {
    setLoadingPosts(true);
    try {
      const q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), fbLimit(200));
      const snap = await getDocs(q);
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleLogin = () => signInWithPopup(getFirebaseAuth(), googleProvider).catch((e) => alert(e.message));

  async function handleGenerate(e) {
    e.preventDefault();
    setGenLoading(true);
    setGenMessage(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ topic: genTopic, type: genType }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Errore generazione.');

      const title = genTopic.trim();
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;

      await addDoc(collection(db, 'posts'), {
        title,
        title_lower: title.toLowerCase(),
        slug,
        content: data.content,
        category: genType === 'drug' ? 'Farmaco' : 'Salute',
        type: genType,
        image_url: data.image_url,
        created_at: serverTimestamp(),
      });

      setGenMessage({ ok: true, text: `Articolo "${title}" creato.` });
      setGenTopic('');
      loadPosts();
    } catch (err) {
      setGenMessage({ ok: false, text: err.message });
    } finally {
      setGenLoading(false);
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Eliminare ${selected.size} articoli selezionati?`)) return;
    const batch = writeBatch(db);
    selected.forEach((id) => batch.delete(doc(db, 'posts', id)));
    await batch.commit();
    setSelected(new Set());
    loadPosts();
  }

  async function handleDeleteDateRange() {
    if (!dateFrom || !dateTo) {
      alert('Seleziona entrambe le date.');
      return;
    }
    if (!confirm(`Eliminare tutti gli articoli creati tra ${dateFrom} e ${dateTo}?`)) return;

    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59`);
    const toDelete = posts.filter((p) => {
      const created = p.created_at?.toDate?.();
      return created && created >= from && created <= to;
    });

    if (toDelete.length === 0) {
      alert('Nessun articolo in questo intervallo (tra i più recenti 200 caricati).');
      return;
    }

    const batch = writeBatch(db);
    toDelete.forEach((p) => batch.delete(doc(db, 'posts', p.id)));
    await batch.commit();
    loadPosts();
  }

  function toggleAll(checked) {
    setSelected(checked ? new Set(posts.map((p) => p.id)) : new Set());
  }

  function toggleOne(id, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (user === undefined) return null;

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <h2>Accesso Negato</h2>
        <span onClick={handleLogin} className="btn-login" style={{ cursor: 'pointer' }}>
          Accedi
        </span>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <h1>Admin Dashboard 🛠️</h1>

      {genMessage && (
        <div
          style={{
            background: genMessage.ok ? '#d4edda' : '#f8d7da',
            padding: 15,
            marginBottom: 15,
            borderLeft: `5px solid ${genMessage.ok ? 'green' : '#d32f2f'}`,
          }}
        >
          {genMessage.ok ? '✅' : '⚠️'} {genMessage.text}
        </div>
      )}

      <div className="tools-grid">
        <div className="tool-box">
          <div className="tool-title">📅 Eliminazione per Intervallo Date</div>
          <p style={{ fontSize: 13, color: '#666' }}>
            Cancella gli articoli creati tra due date (tra i più recenti 200 caricati).
          </p>
          <div className="input-group">
            <input
              type="date"
              className="search-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <input
              type="date"
              className="search-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button className="btn-tool" style={{ background: '#d32f2f', width: '100%' }} onClick={handleDeleteDateRange}>
            ELIMINA INTERVALLO
          </button>
        </div>

        <div className="tool-box">
          <div className="tool-title">🤖 Genera Articolo AI</div>
          <form onSubmit={handleGenerate}>
            <div className="input-group">
              <input
                type="text"
                placeholder="Titolo..."
                className="search-input"
                required
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
              />
              <select className="search-input" value={genType} onChange={(e) => setGenType(e.target.value)}>
                <option value="drug">Farmaco</option>
                <option value="blog">Salute</option>
              </select>
            </div>
            <button className="btn-tool" style={{ background: '#2e7d32', width: '100%' }} disabled={genLoading}>
              {genLoading ? 'GENERAZIONE...' : 'GENERA'}
            </button>
          </form>
        </div>
      </div>

      <div className="admin-tools">
        <button className="admin-btn" style={{ background: 'var(--alert)', marginBottom: 10 }} onClick={handleDeleteSelected}>
          ELIMINA SELEZIONATI ({selected.size})
        </button>
        {loadingPosts ? (
          <p>Caricamento...</p>
        ) : posts.length === 0 ? (
          <p>Nessun articolo pubblicato ancora.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} />
                </th>
                <th>Titolo</th>
                <th>Data</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={(e) => toggleOne(p.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <b>{p.title}</b>
                  </td>
                  <td style={{ fontSize: 12, color: '#666' }}>
                    {p.created_at?.toDate?.().toLocaleDateString('it-IT') || ''}
                  </td>
                  <td>
                    <Link href={`/${p.slug}`} target="_blank" style={{ color: 'blue' }}>
                      Vedi
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
