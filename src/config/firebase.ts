import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const isEmulator = import.meta.env.VITE_USE_EMULATORS === 'true';

const firebaseConfig = {
  apiKey: isEmulator ? 'demo-api-key' : (import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key'),
  authDomain: isEmulator ? 'demo-byc-qip.firebaseapp.com' : (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-byc-qip.firebaseapp.com'),
  projectId: isEmulator ? 'demo-byc-qip' : (import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-byc-qip'),
  storageBucket: isEmulator ? 'demo-byc-qip.appspot.com' : (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-byc-qip.appspot.com'),
  messagingSenderId: isEmulator ? '123456789' : (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789'),
  appId: isEmulator ? '1:123456789:web:abcdef' : (import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef'),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Use connectAuthEmulator/connectFirestoreEmulator only when VITE_USE_EMULATORS=true
if (isEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// Note: App Check will be initialized in Phase 6
