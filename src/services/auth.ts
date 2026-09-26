import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { RosterUser } from '../types';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: 'christuniversity.in',
  prompt: 'select_account',
});

/**
 * Sign in using Google OAuth with popup, falling back to redirect.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (
      error.code === 'auth/popup-blocked' ||
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request'
    ) {
      console.warn('Popup blocked or closed, falling back to redirect...', error);
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

/**
 * Handle redirect result on page load if redirect was used.
 */
export async function handleRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Redirect sign-in error:', error);
    return null;
  }
}

/**
 * Sign out the currently authenticated user.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Lookup user in the roster collection by lowercase email.
 */
export async function getRosterUser(email: string): Promise<RosterUser | null> {
  const emailLower = email.toLowerCase().trim();
  const snap = await getDoc(doc(db, 'roster', emailLower));
  if (!snap.exists()) {
    return null;
  }
  return snap.data() as RosterUser;
}

/**
 * In emulator mode, creates a test Google credential so automated browser tests
 * and developers can sign in as specific seeded personas instantly without popup blockers.
 */
export async function emulatorSignInAs(email: string, displayName: string): Promise<User> {
  // In Firebase Auth emulator, signInWithCredential with mock token produces sign_in_provider == 'google.com'
  // and email_verified == true
  const mockIdToken = [
    // Header
    btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    // Payload
    btoa(JSON.stringify({
      iss: `https://securetoken.google.com/demo-byc-qip`,
      aud: 'demo-byc-qip',
      auth_time: Math.floor(Date.now() / 1000),
      user_id: `uid-${email.replace(/[^a-zA-Z0-9]/g, '-')}`,
      sub: `uid-${email.replace(/[^a-zA-Z0-9]/g, '-')}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: email.toLowerCase().trim(),
      email_verified: true,
      firebase: {
        identities: {
          'google.com': [email.toLowerCase().trim()],
          email: [email.toLowerCase().trim()],
        },
        sign_in_provider: 'google.com',
      },
      name: displayName,
    })),
    // Signature
    btoa('mock-sig'),
  ].join('.');

  const credential = GoogleAuthProvider.credential(mockIdToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}
