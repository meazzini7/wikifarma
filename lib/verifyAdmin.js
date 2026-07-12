// Verifies a Firebase Auth ID token against Google's public keys, without
// needing the Firebase Admin SDK / a service account. Firebase ID tokens are
// standard signed JWTs, so this is enough to confirm the caller is really
// signed in as the admin email before we spend Gemini API quota on them.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ADMIN_EMAIL } from './constants';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken || !PROJECT_ID) return false;

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return payload.email === ADMIN_EMAIL && payload.email_verified !== false;
  } catch {
    return false;
  }
}
