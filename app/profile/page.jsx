'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { getUserDiagnoses } from '@/lib/firestore';
import { getUserFavorites, removeFavorite } from '@/lib/favorites';
import SafeImage from '@/components/SafeImage';

export default function ProfilePage() {
  const [user, setUser] = useState(undefined);
  const [history, setHistory] = useState(null);
  const [favorites, setFavorites] = useState(null);
  const router = useRouter();

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);

  useEffect(() => {
    if (user === null) {
      router.replace('/');
      return;
    }
    if (user) {
      getUserDiagnoses(user.email).then(setHistory).catch(() => setHistory([]));
      getUserFavorites(user.email).then(setFavorites).catch(() => setFavorites([]));
    }
  }, [user, router]);

  async function handleRemoveFavorite(postId) {
    await removeFavorite(user.email, postId);
    setFavorites((prev) => prev.filter((f) => f.postId !== postId));
  }

  if (user === undefined || (user && (history === null || favorites === null))) {
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

      <h2 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>❤️ Articoli Preferiti</h2>
      {favorites.length === 0 ? (
        <p style={{ color: '#666' }}>
          Nessun preferito ancora. Vai su un articolo e clicca &quot;Aggiungi ai preferiti&quot;.
        </p>
      ) : (
        <div className="news-grid" style={{ marginBottom: 30 }}>
          {favorites.map((f) => (
            <div key={f.id} className="card" style={{ position: 'relative' }}>
              <Link href={`/${f.slug}`}>
                <SafeImage src={f.image_url} category={f.category} alt={f.title} className="card-img" />
                <div className="card-body">
                  <div className="card-tag">{f.category}</div>
                  <h3>{f.title}</h3>
                </div>
              </Link>
              <button
                onClick={() => handleRemoveFavorite(f.postId)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  background: 'rgba(255,255,255,0.9)',
                  cursor: 'pointer',
                }}
                title="Rimuovi dai preferiti"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <hr style={{ margin: '20px 0', border: 0, borderTop: '1px solid #eee' }} />

      <h2 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>📋 Storico Diagnosi</h2>
      {history.length === 0 ? (
        <p style={{ color: '#666' }}>Nessuna diagnosi salvata.</p>
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
