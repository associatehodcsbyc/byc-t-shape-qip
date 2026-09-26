import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  addDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Activity, Session } from '../types';
import { validateActivitiesSeed, ValidationResult } from '../utils/schemaValidator';

export interface DiffItem<T> {
  id: string;
  item: T;
  type: 'new' | 'changed' | 'unchanged';
  diffNotes?: string[];
}

export interface DryRunDiffResult {
  validation: ValidationResult;
  sessions: {
    total: number;
    newCount: number;
    changedCount: number;
    unchangedCount: number;
    items: DiffItem<Session>[];
  };
  activities: {
    total: number;
    newCount: number;
    changedCount: number;
    unchangedCount: number;
    items: DiffItem<Activity>[];
  };
  groupProtocol: string;
  groupLabels: string[];
}

/**
 * Compares two objects shallowly/deeply for differences.
 */
function areObjectsEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Computes dry-run diff between seed data and Firestore collections.
 */
export async function computeContentDryRun(
  sessionsSeed: { sessions: Session[] },
  activitiesSeed: {
    version: string;
    groupProtocol?: string;
    groupLabels?: string[];
    activities: Activity[];
  }
): Promise<DryRunDiffResult> {
  // 1. Validate activities schema
  const validation = validateActivitiesSeed(activitiesSeed);

  // 2. Fetch existing sessions from Firestore
  const sessionsSnap = await getDocs(collection(db, 'sessions'));
  const existingSessions = new Map<string, any>();
  sessionsSnap.forEach((d) => existingSessions.set(d.id, d.data()));

  // 3. Fetch existing activities from Firestore
  const activitiesSnap = await getDocs(collection(db, 'activities'));
  const existingActivities = new Map<string, any>();
  activitiesSnap.forEach((d) => existingActivities.set(d.id, d.data()));

  // 4. Diff sessions
  const sessionDiffItems: DiffItem<Session>[] = [];
  let sessNew = 0;
  let sessChanged = 0;
  let sessUnchanged = 0;

  for (const s of sessionsSeed.sessions) {
    const existing = existingSessions.get(s.sessionId);
    if (!existing) {
      sessNew++;
      sessionDiffItems.push({ id: s.sessionId, item: s, type: 'new' });
    } else if (areObjectsEqual(existing, s)) {
      sessUnchanged++;
      sessionDiffItems.push({ id: s.sessionId, item: s, type: 'unchanged' });
    } else {
      sessChanged++;
      const notes: string[] = [];
      if (existing.title !== s.title) notes.push(`Title changed from "${existing.title}"`);
      if (existing.facilitator !== s.facilitator) notes.push(`Facilitator changed`);
      if (existing.time !== s.time) notes.push(`Time changed from "${existing.time}"`);
      sessionDiffItems.push({ id: s.sessionId, item: s, type: 'changed', diffNotes: notes });
    }
  }

  // 5. Diff activities
  const actDiffItems: DiffItem<Activity>[] = [];
  let actNew = 0;
  let actChanged = 0;
  let actUnchanged = 0;

  for (const a of activitiesSeed.activities) {
    const existing = existingActivities.get(a.activityId);
    if (!existing) {
      actNew++;
      actDiffItems.push({ id: a.activityId, item: a, type: 'new' });
    } else if (areObjectsEqual(existing, a)) {
      actUnchanged++;
      actDiffItems.push({ id: a.activityId, item: a, type: 'unchanged' });
    } else {
      actChanged++;
      const notes: string[] = [];
      if (existing.title !== a.title) notes.push(`Title changed`);
      if (existing.widgetType !== a.widgetType) notes.push(`WidgetType: ${existing.widgetType} -> ${a.widgetType}`);
      if (existing.confidential !== a.confidential) notes.push(`Confidential: ${existing.confidential} -> ${a.confidential}`);
      if (!notes.length) notes.push('Config or instructions modified');
      actDiffItems.push({ id: a.activityId, item: a, type: 'changed', diffNotes: notes });
    }
  }

  return {
    validation,
    sessions: {
      total: sessionsSeed.sessions.length,
      newCount: sessNew,
      changedCount: sessChanged,
      unchangedCount: sessUnchanged,
      items: sessionDiffItems,
    },
    activities: {
      total: activitiesSeed.activities.length,
      newCount: actNew,
      changedCount: actChanged,
      unchangedCount: actUnchanged,
      items: actDiffItems,
    },
    groupProtocol: activitiesSeed.groupProtocol || '',
    groupLabels: activitiesSeed.groupLabels || [],
  };
}

/**
 * Commits the validated seed data to Firestore in batched writes.
 */
export async function commitContentImport(
  sessions: Session[],
  activities: Activity[],
  groupProtocol: string,
  groupLabels: string[],
  adminEmail: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; sessionsCommitted: number; activitiesCommitted: number }> {
  const total = sessions.length + activities.length;
  let processed = 0;

  // We write in batches of up to 400 (well within Firestore 500 limit)
  const BATCH_SIZE = 400;

  // Combine items to write
  const operations: Array<{ type: 'session' | 'activity'; id: string; data: any }> = [];

  for (const s of sessions) {
    operations.push({ type: 'session', id: s.sessionId, data: s });
  }

  for (const a of activities) {
    operations.push({ type: 'activity', id: a.activityId, data: a });
  }

  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const chunk = operations.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const op of chunk) {
      if (op.type === 'session') {
        const ref = doc(db, 'sessions', op.id);
        batch.set(ref, op.data);
      } else {
        const ref = doc(db, 'activities', op.id);
        batch.set(ref, op.data);
      }
    }

    await batch.commit();
    processed += chunk.length;
    if (onProgress) {
      onProgress(processed, total);
    }
  }

  // Attempt to store config/app if permitted by rules (graceful fallback)
  try {
    const configRef = doc(db, 'config', 'app');
    await setDoc(configRef, {
      groupProtocol,
      groupLabels,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('config/app document could not be written to Firestore (may require rule permission):', err);
  }

  // Write audit log entry
  try {
    await addDoc(collection(db, 'auditLog'), {
      actor: adminEmail,
      action: 'content_import',
      target: 'sessions_activities',
      details: {
        sessionsCount: sessions.length,
        activitiesCount: activities.length,
      },
      at: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write audit log for content import:', err);
  }

  return {
    success: true,
    sessionsCommitted: sessions.length,
    activitiesCommitted: activities.length,
  };
}
