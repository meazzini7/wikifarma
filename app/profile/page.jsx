'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { getUserDiagnoses } from '@/lib/firestore';

export default function ProfilePage() {
  const [user, setUser] = useState(undefined);
  const [history, setHistory] = useState(null);
  const router = useRouter();

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);

  useEffect(() => {
    if (user === null) {
      router.replace('/');
      return;
    }
    if (user) {
      getUserDiagnoses(user.email)
        .then(setHistory)
        .catch(() => setHistory([]));
    }
  }, [user, router]);

  if (user === undefined || (user && history === null)) {
    return (
      <div className="diagnosis-container">
        <p>Caricamento...</p>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="diagnosis-container">
      <h1>Il tuo Profilo</h1>
      <p style={{ color: '#666' }}>{user.email}</p>
      <button
        onClick={() => signOut(getFirebaseAuth())}
        className="admin-btn"
        style={{ background: '#666', fontSize: 12 }}
      >
        Esci
      </button>
      <hr style={{ margin: '20px 0', border: 0, borderTop: '1px solid #eee' }} />
      {history.length === 0 ? (
        <p>Nessuna diagnosi salvata.</p>
      ) : (
        history.map((item) => (
          <div key={item.id} className="diag-history-item">
            <small>{item.created_at?.toDate?.().toLocaleString('it-IT') || ''}</small>
            <br />
            <b>Sintomi:</b> {item.symptoms}
            <details style={{ marginTop: 10 }}>
              <summary>Risposta</summary>
              <div style={{ marginTop: 10 }} dangerouslySetInnerHTML={{ __html: item.response }} />
            </details>
          </div>
        ))
      )}
    </div>
  );
}
