import {
  collection,
  doc,
  setDoc,
  addDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Activity, ActivityState, SubmissionProgress, Session, RosterUser } from '../types';

export interface SetActivityStateParams {
  department: string;
  activityId: string;
  sessionId: string;
  enabled: boolean;
  locked: boolean;
  userEmail: string;
}

export interface SetSessionActivitiesParams {
  department: string;
  session: Session;
  activities: Activity[];
  enabled: boolean;
  locked: boolean;
  userEmail: string;
}

/**
 * Update state for a single activity in a department.
 * Writes to activityState/{department}__{activityId} and creates an auditLog entry.
 */
export async function setActivityState({
  department,
  activityId,
  sessionId,
  enabled,
  locked,
  userEmail,
}: SetActivityStateParams): Promise<void> {
  const normEmail = userEmail.toLowerCase().trim();
  const stateDocId = `${department}__${activityId}`;
  const stateRef = doc(db, 'activityState', stateDocId);

  // 1. Write activity state
  await setDoc(stateRef, {
    department,
    activityId,
    sessionId,
    enabled,
    locked,
    updatedBy: normEmail,
    updatedAt: serverTimestamp(),
  });

  // 2. Write audit log entry
  const action = !enabled
    ? 'DISABLE_ACTIVITY'
    : locked
    ? 'LOCK_ACTIVITY'
    : 'ENABLE_ACTIVITY';

  await addDoc(collection(db, 'auditLog'), {
    actor: normEmail,
    action,
    target: stateDocId,
    details: {
      department,
      activityId,
      sessionId,
      enabled,
      locked,
    },
    at: serverTimestamp(),
  });
}

/**
 * Bulk update state for all activities in a session for a department.
 * Uses Firestore writeBatch for atomicity.
 */
export async function setSessionActivitiesState({
  department,
  session,
  activities,
  enabled,
  locked,
  userEmail,
}: SetSessionActivitiesParams): Promise<void> {
  const normEmail = userEmail.toLowerCase().trim();
  const batch = writeBatch(db);

  for (const act of activities) {
    const stateRef = doc(db, 'activityState', `${department}__${act.activityId}`);
    batch.set(stateRef, {
      department,
      activityId: act.activityId,
      sessionId: act.sessionId,
      enabled,
      locked,
      updatedBy: normEmail,
      updatedAt: serverTimestamp(),
    });
  }

  const action = locked
    ? 'LOCK_ALL_SESSION'
    : enabled
    ? 'ENABLE_ALL_SESSION'
    : 'DISABLE_ALL_SESSION';

  const auditRef = doc(collection(db, 'auditLog'));
  batch.set(auditRef, {
    actor: normEmail,
    action,
    target: `${department}__${session.sessionId}`,
    details: {
      department,
      sessionId: session.sessionId,
      sessionTitle: session.title,
      activityCount: activities.length,
      enabled,
      locked,
    },
    at: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Subscribe in real time to activity states for a specific department.
 */
export function subscribeToDepartmentActivityStates(
  department: string,
  onUpdate: (stateMap: Map<string, ActivityState>) => void,
  onError?: (err: Error) => void
): () => void {
  if (!department) {
    onUpdate(new Map());
    return () => {};
  }

  const q = query(
    collection(db, 'activityState'),
    where('department', '==', department)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const map = new Map<string, ActivityState>();
      snapshot.forEach((d) => {
        const data = d.data() as ActivityState;
        map.set(data.activityId, data);
      });
      onUpdate(map);
    },
    (err) => {
      console.error('Error listening to activity states:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe in real time to progress for all activities in a department.
 */
export function subscribeToDepartmentProgress(
  department: string,
  onUpdate: (progressList: SubmissionProgress[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!department) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, 'progress'),
    where('department', '==', department)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SubmissionProgress[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as SubmissionProgress);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Error listening to department progress:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch participants in a department from the roster.
 */
export async function getDepartmentParticipants(department: string): Promise<RosterUser[]> {
  if (!department) return [];

  const q = query(
    collection(db, 'roster'),
    where('department', '==', department)
  );

  const snap = await getDocs(q);
  const users: RosterUser[] = [];
  snap.forEach((d) => {
    const data = d.data() as RosterUser;
    if (data.role === 'participant' && data.active !== false) {
      users.push(data);
    }
  });

  return users.sort((a, b) => a.name.localeCompare(b.name));
}
