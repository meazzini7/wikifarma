'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth, googleProvider } from '@/lib/firebase';
import { saveDiagnosis } from '@/lib/firestore';
import { trackEvent } from '@/lib/gtag';

export default function DiagnosisPage() {
  const [user, setUser] = useState(undefined);
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);

  const handleLogin = () => {
    signInWithPopup(getFirebaseAuth(), googleProvider).catch((err) => alert(err.message));
  };

  const handleAnalyze = async () => {
    const text = symptoms.trim();
    if (text.length < 5) {
      alert('Descrivi meglio i sintomi.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: text }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Errore durante l'analisi.");
      } else {
        setResult(data.text);
        trackEvent('diagnosis_completed', { logged_in: Boolean(user) });
        if (user) {
          saveDiagnosis({ userEmail: user.email, symptoms: text, response: data.text }).catch(() => {});
        }
      }
    } catch {
      setError('Errore di connessione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="hero" style={{ padding: '40px 20px' }}>
        <h1>Diagnosi Virtuale 🩺</h1>
        <p>Descrivi i sintomi per un&apos;analisi immediata.</p>
      </header>
      <div className="diagnosis-container">
        <div className="diagnosis-box">
          <div className="diag-warning">
            ⚠️ <b>ATTENZIONE:</b> Questa non è una diagnosi medica. In emergenza chiama il 112.
          </div>

          {user === null && (
            <p style={{ color: 'var(--primary)', fontSize: 14, marginBottom: 10 }}>
              💡 <b>Suggerimento:</b>{' '}
              <span onClick={handleLogin} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                Accedi con Google
              </span>{' '}
              per salvare lo storico.
            </p>
          )}

          <textarea
            className="diag-textarea"
            placeholder="Es: Ho febbre a 38, mal di gola forte e tosse secca..."
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
          />

          <button className="diag-btn" onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analisi AI... ⏳' : 'ANALIZZA SINTOMI ✨'}
          </button>

          {error && (
            <div
              className="diag-result"
              style={{ marginTop: 30, background: '#ffebee', borderColor: '#ef9a9a', color: '#b71c1c' }}
            >
              {error}
            </div>
          )}

          {result && (
            <div className="diag-result" style={{ marginTop: 30 }}>
              <h3 style={{ color: 'var(--primary)' }}>📋 Risultato:</h3>
              <div style={{ lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: result }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
