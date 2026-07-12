'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/lib/constants';

export default function Navbar() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link href="/" className="logo">
          WIKI<span>FARMA</span>
        </Link>
        <div className="nav-links">
          <Link href="/encyclopedia">Medicinali dalla A alla Z</Link>
          <Link href="/wellness" style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>
            Benessere
          </Link>
          <Link href="/problems" style={{ color: '#e65100', fontWeight: 700 }}>
            Problemi Frequenti
          </Link>
          <Link href="/diagnosis" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            Diagnosi AI
          </Link>
          {user === undefined ? null : user ? (
            user.email === ADMIN_EMAIL ? (
              <Link href="/admin" className="btn-admin">
                ADMIN
              </Link>
            ) : (
              <>
                <Link href="/profile" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  👤 Profilo
                </Link>
                <span onClick={handleLogout} className="btn-login" style={{ background: '#666' }}>
                  ESCI
                </span>
              </>
            )
          ) : (
            <span onClick={handleLogin} className="btn-login">
              ACCEDI
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
