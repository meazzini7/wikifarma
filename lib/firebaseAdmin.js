// Server-only Firebase Admin SDK - used where there's no authenticated
// browser session to rely on (Vercel Cron jobs). Never import this from
// a client component.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  // cert() valida la chiave localmente prima di qualunque chiamata di rete:
  // se FIREBASE_ADMIN_PRIVATE_KEY e' malformata (es. "a capo" persi
  // incollandola su Vercel) lancia qui, in modo sincrono - senza questo
  // try/catch il messaggio reale andava perso.
  try {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } catch (err) {
    console.error('Firebase Admin init fallito:', err);
    throw new Error(`Firebase Admin init fallito: ${err.message}`);
  }
}

export function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY);
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
