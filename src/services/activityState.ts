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
import { isMatchingDepartment, getDepartmentVariants } from '../utils/department';

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
 * Also synchronizes known department aliases (e.g. slug <-> display name) when permitted.
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

  // 1. Write primary activity state
  if (department === 'all') {
    const allDepts = ['all', 'computer-science', 'commerce', 'management', 'sciences', 'economics-byc'];
    for (const d of allDepts) {
      const ref = doc(db, 'activityState', `${d}__${activityId}`);
      await setDoc(ref, {
        department: d,
        activityId,
        sessionId,
        enabled,
        locked,
        updatedBy: normEmail,
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    await setDoc(stateRef, {
      department,
      activityId,
      sessionId,
      enabled,
      locked,
      updatedBy: normEmail,
      updatedAt: serverTimestamp(),
    });
  }

  // 2. Synchronize department variants (e.g., slug and display name) so all participants can access it
  const variants = getDepartmentVariants(department).filter((v) => v !== department);
  for (const altDept of variants) {
    try {
      const altRef = doc(db, 'activityState', `${altDept}__${activityId}`);
      await setDoc(altRef, {
        department: altDept,
        activityId,
        sessionId,
        enabled,
        locked,
        updatedBy: normEmail,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Best-effort: Ignored if rules prevent writing non-own department string for HoD
    }
  }

  // 3. Write audit log entry
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
 * Uses Firestore writeBatch for atomicity, and syncs department aliases when permitted.
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

  // If department is 'all', invoke universal institution-wide updater
  if (department === 'all') {
    await setSessionActivitiesForAllDepartments({
      session,
      activities,
      enabled,
      locked,
      userEmail: normEmail,
    });
    return;
  }

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

  // Commit the primary activity gates first
  await batch.commit();

  // Synchronize department variants for all activities in the session
  const variants = getDepartmentVariants(department).filter((v) => v !== department);
  for (const altDept of variants) {
    try {
      const altBatch = writeBatch(db);
      for (const act of activities) {
        const altRef = doc(db, 'activityState', `${altDept}__${act.activityId}`);
        altBatch.set(altRef, {
          department: altDept,
          activityId: act.activityId,
          sessionId: act.sessionId,
          enabled,
          locked,
          updatedBy: normEmail,
          updatedAt: serverTimestamp(),
        });
      }
      await altBatch.commit();
    } catch {
      // Best-effort sync
    }
  }

  // Audit log written asynchronously (never blocks the gate state)
  try {
    const action = locked
      ? 'LOCK_ALL_SESSION'
      : enabled
      ? 'ENABLE_ALL_SESSION'
      : 'DISABLE_ALL_SESSION';

    await addDoc(collection(db, 'auditLog'), {
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
  } catch (auditErr) {
    console.warn('Audit log write error:', auditErr);
  }
}

export interface SetSessionForAllParams {
  session: Session;
  activities: Activity[];
  enabled: boolean;
  locked: boolean;
  userEmail: string;
  departmentIds?: string[];
}

/**
 * Activates or locks a session for ALL departments across the institution at once.
 * Writes a master 'all' gate plus individual records for every registered department.
 */
export async function setSessionActivitiesForAllDepartments({
  session,
  activities,
  enabled,
  locked,
  userEmail,
  departmentIds = ['computer-science', 'commerce', 'management', 'sciences', 'economics-byc'],
}: SetSessionForAllParams): Promise<void> {
  const normEmail = userEmail.toLowerCase().trim();
  const allDepts = Array.from(new Set(['all', ...departmentIds]));

  const batch = writeBatch(db);
  for (const dept of allDepts) {
    for (const act of activities) {
      const stateRef = doc(db, 'activityState', `${dept}__${act.activityId}`);
      batch.set(stateRef, {
        department: dept,
        activityId: act.activityId,
        sessionId: act.sessionId,
        enabled,
        locked,
        updatedBy: normEmail,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();

  // Also best-effort write variant aliases
  for (const dept of departmentIds) {
    const variants = getDepartmentVariants(dept).filter((v) => v !== dept);
    if (variants.length === 0) continue;
    try {
      const altBatch = writeBatch(db);
      for (const altDept of variants) {
        for (const act of activities) {
          const altRef = doc(db, 'activityState', `${altDept}__${act.activityId}`);
          altBatch.set(altRef, {
            department: altDept,
            activityId: act.activityId,
            sessionId: act.sessionId,
            enabled,
            locked,
            updatedBy: normEmail,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await altBatch.commit();
    } catch {
      // Best-effort sync
    }
  }

  // Audit log
  try {
    await addDoc(collection(db, 'auditLog'), {
      actor: normEmail,
      action: enabled ? 'ENABLE_ALL_INSTITUTION' : 'DISABLE_ALL_INSTITUTION',
      target: `all__${session.sessionId}`,
      details: {
        sessionId: session.sessionId,
        sessionTitle: session.title,
        departments: allDepts,
        activityCount: activities.length,
        enabled,
        locked,
      },
      at: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log write error:', err);
  }
}

/**
 * Subscribe in real time to activity states for a department and its aliases.
 * Reads the activityState collection and matches using flexible department comparison
 * and checks the universal 'all' department master gate.
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

  // Subscribe to activityState collection in real time.
  // In-memory matching ensures that whether states are stored under slug (computer-science),
  // title (Computer Science), or 'all' (institution-wide), the participant receives all matching activity states instantly.
  const unsub = onSnapshot(
    collection(db, 'activityState'),
    (snapshot) => {
      const stateMap = new Map<string, ActivityState>();
      snapshot.forEach((d) => {
        const data = d.data() as ActivityState;
        if (data.department === 'all' || isMatchingDepartment(data.department, department)) {
          const existing = stateMap.get(data.activityId);
          // If any matching record has enabled=true, honor it
          if (!existing || (!existing.enabled && data.enabled) || (!existing.locked && data.locked)) {
            stateMap.set(data.activityId, data);
          }
        }
      });
      onUpdate(stateMap);
    },
    (err) => {
      console.warn('Real-time activityState collection listener warning:', err);
      if (onError) onError(err);
    }
  );

  return unsub;
}

/**
 * Subscribe in real time to progress for all activities across department aliases.
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

  const variants = getDepartmentVariants(department);
  const variantProgress = new Map<string, SubmissionProgress[]>();
  const unsubs: (() => void)[] = [];

  const emitMerged = () => {
    const itemMap = new Map<string, SubmissionProgress>();
    for (const list of variantProgress.values()) {
      for (const p of list) {
        const key = `${p.email.toLowerCase().trim()}__${p.activityId}`;
        itemMap.set(key, p);
      }
    }
    onUpdate(Array.from(itemMap.values()));
  };

  for (const variant of variants) {
    const q = query(
      collection(db, 'progress'),
      where('department', '==', variant)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SubmissionProgress[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as SubmissionProgress);
        });
        variantProgress.set(variant, list);
        emitMerged();
      },
      (err) => {
        if (variants.length === 1 && onError) {
          onError(err);
        }
      }
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

/**
 * Fetch participants across all department aliases from the roster.
 */
export async function getDepartmentParticipants(department: string): Promise<RosterUser[]> {
  if (!department) return [];

  const variants = getDepartmentVariants(department);
  const userMap = new Map<string, RosterUser>();

  for (const variant of variants) {
    try {
      const q = query(
        collection(db, 'roster'),
        where('department', '==', variant)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data() as RosterUser;
        if (data.role === 'participant' && data.active !== false) {
          userMap.set(data.email.toLowerCase().trim(), data);
        }
      });
    } catch {
      // Ignore variant errors
    }
  }

  return Array.from(userMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

