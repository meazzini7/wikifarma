'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth, googleProvider } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/lib/constants';
import InsightsView from '@/components/InsightsView';

// Pannello riservato: la pagina non e' linkata da nessuna parte pubblica,
// i dati arrivano da /api/admin/insights che verifica lato server che il
// token sia davvero quello dell'admin, e article_stats non e' leggibile dal
// client (solo Admin SDK). Anche chi indovinasse l'URL vedrebbe solo il login.
export default function InsightsPage() {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);
  const isAdmin = user && user.email === ADMIN_EMAIL;

  const load = useCallback(
    async (refresh) => {
      if (!user) return;
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/admin/insights', {
          method: refresh ? 'POST' : 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || 'Errore nel caricamento.');
        setData(json);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (isAdmin) load(false);
  }, [isAdmin, load]);

  return (
    <div className="section-home" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="section-head">
        <h2>Insights riservati</h2>
      </div>
      <p style={{ marginTop: 0 }}>
        <Link href="/admin" style={{ color: '#054d2e' }}>← Pannello admin</Link>
      </p>

      {user === undefined && <p>Verifica accesso…</p>}

      {user === null && (
        <button
          type="button"
          className="diag-btn"
          onClick={() => signInWithPopup(getFirebaseAuth(), googleProvider).catch((e) => alert(e.message))}
        >
          Accedi con Google
        </button>
      )}

      {user && !isAdmin && <p>Accesso riservato.</p>}

      {isAdmin && loading && <p>Caricamento dati…</p>}
      {isAdmin && error && <p style={{ color: '#b00020' }}>⚠️ {error}</p>}
      {isAdmin && data && <InsightsView data={data} onRefresh={() => load(true)} refreshing={refreshing} />}
    </div>
  );
}
