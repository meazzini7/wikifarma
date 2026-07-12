'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getFirebaseAuth, googleProvider } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/lib/constants';

export default function Navbar() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(getFirebaseAuth(), googleProvider);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => signOut(getFirebaseAuth());

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link href="/" className="logo">
          WIKI<span>FARMA</span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label="Apri il menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-links${menuOpen ? ' open' : ''}`}>
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
