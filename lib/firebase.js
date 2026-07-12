// Firebase client SDK - safe to run in the browser.
// Config values below are public identifiers (not secrets); Firestore/Storage
// access is still governed by security rules, and Auth restricts sign-in.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// getAuth() validates the API key immediately and throws if it's missing or
// malformed. Lazily initializing it (only called from client-side effects/
// handlers, never at module load) keeps server-side prerendering safe even
// if NEXT_PUBLIC_FIREBASE_* env vars are misconfigured.
let _auth;
export function getFirebaseAuth() {
  if (!_auth) _auth = getAuth(app);
  return _auth;
}

export default app;
