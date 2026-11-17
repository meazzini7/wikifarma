// Server-only Firebase Admin SDK - used where there's no authenticated
// browser session to rely on (Vercel Cron jobs). Never import this from
// a client component.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Rende leggibile la chiave privata qualunque sia il modo in cui e' stata
// incollata nei secrets/variabili: con "\n" letterali, tutta su una riga con
// spazi al posto degli a-capo, tra virgolette o con la virgola finale del JSON,
// con CRLF. Ricostruisce il PEM standard (corpo base64 a righe da 64).
export function normalizePrivateKey(raw = '') {
  let k = String(raw).trim().replace(/^["']+/, '').replace(/["',]+$/, '');
  k = k.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '');
  const m = k.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return k;
  const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN ${m[1]}-----\n${lines.join('\n')}\n-----END ${m[1]}-----\n`;
}

// Descrizione della chiave SENZA rivelarla (solo forma): serve a capire dai log
// se e' arrivata troncata, senza intestazione, ecc.
export function describePrivateKey(raw = '') {
  const k = normalizePrivateKey(raw);
  const header = /-----BEGIN [A-Z ]+-----/.test(k);
  const footer = /-----END [A-Z ]+-----/.test(k);
  const body = (k.match(/-----BEGIN [A-Z ]+-----([\s\S]*?)-----END/) || [, ''])[1].replace(/\s/g, '');
  return `chiave: ${String(raw).length} caratteri in origine, intestazione ${header ? 'ok' : 'MANCANTE'}, chiusura ${footer ? 'ok' : 'MANCANTE'}, corpo base64 ${body.length} caratteri (una chiave RSA completa ne ha ~1600)`;
}

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
        privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
      }),
    });
  } catch (err) {
    const detail = describePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
    console.error('Firebase Admin init fallito:', err.message, '|', detail);
    throw new Error(`Firebase Admin init fallito: ${err.message} (${detail})`);
  }
}

export function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY);
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
