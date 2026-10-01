import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

export interface FeedbackDoc {
  email: string;
  uid: string;
  name: string;
  department: string;
  role: string;
  answers: Record<string, any>;
  status: 'draft' | 'submitted';
  createdAt: any;
  updatedAt: any;
  submittedAt?: any;
}

const feedbackRef = (email: string) => doc(db, 'feedback', email);

export const getMyFeedback = async (): Promise<FeedbackDoc | null> => {
  const email = auth.currentUser?.email?.toLowerCase().trim();
  if (!email) return null;
  const snap = await getDoc(feedbackRef(email));
  return snap.exists() ? (snap.data() as FeedbackDoc) : null;
};

export const saveFeedbackDraft = async (
  answers: Record<string, any>,
  rosterUser: { email: string; name: string; department: string; role: string }
) => {
  const email = rosterUser.email.toLowerCase().trim();
  const uid = auth.currentUser?.uid || '';
  const ref = feedbackRef(email);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    // Update — only allowed fields
    await setDoc(ref, {
      ...existing.data(),
      answers,
      status: 'draft',
      updatedAt: serverTimestamp(),
      name: rosterUser.name,
    });
  } else {
    // Create
    await setDoc(ref, {
      email,
      uid,
      name: rosterUser.name,
      department: rosterUser.department,
      role: rosterUser.role,
      answers,
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};

export const submitFeedback = async (
  answers: Record<string, any>,
  rosterUser: { email: string; name: string; department: string; role: string }
) => {
  const email = rosterUser.email.toLowerCase().trim();
  const uid = auth.currentUser?.uid || '';
  const ref = feedbackRef(email);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    await setDoc(ref, {
      ...existing.data(),
      answers,
      status: 'submitted',
      updatedAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
      name: rosterUser.name,
    });
  } else {
    await setDoc(ref, {
      email,
      uid,
      name: rosterUser.name,
      department: rosterUser.department,
      role: rosterUser.role,
      answers,
      status: 'submitted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
    });
  }
};
