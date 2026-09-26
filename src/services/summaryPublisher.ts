import {
  collection,
  doc,
  setDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Activity, ActivityResponse, ActivitySummary } from '../types';
import { generateConfidentialSummary } from '../utils/analytics';

export const CONFIDENTIAL_ACTIVITY_IDS = [
  'd1s1_a2_tl_questionnaire',
  'd1s3_a1_rigour_checklist',
  'd1s3_a3_curriculum_for_depth',
  'd1s4_a1_quality_dimensions',
  'd3s4_a6_scorecard_15',
] as const;

/**
 * Publishes a department summary for a confidential activity.
 * Writes to summaries/{department}__{activityId}.
 */
export async function publishDepartmentSummary(
  department: string,
  activity: Activity,
  submittedResponses: ActivityResponse[]
): Promise<ActivitySummary> {
  const summary = generateConfidentialSummary(submittedResponses, activity, department);
  const sumDocId = `${department}__${activity.activityId}`;
  const sumRef = doc(db, 'summaries', sumDocId);

  // Firestore rules require: sumId == department + '__' + activityId, n is int, updatedAt == request.time
  const payload: Record<string, any> = {
    department: summary.department,
    activityId: summary.activityId,
    n: summary.n,
    suppressed: summary.suppressed,
    updatedAt: serverTimestamp(),
  };

  if (!summary.suppressed) {
    if (summary.itemStats) payload.itemStats = summary.itemStats;
    if (summary.sectionStats) payload.sectionStats = summary.sectionStats;
    if (summary.totalStats) payload.totalStats = summary.totalStats;
    if (summary.bandCounts) payload.bandCounts = summary.bandCounts;
    if (summary.comments) payload.comments = summary.comments;
  }

  await setDoc(sumRef, payload);
  return summary;
}

/**
 * Fetches all published summaries from summaries collection.
 */
export async function fetchPublishedSummaries(): Promise<Map<string, ActivitySummary>> {
  const snap = await getDocs(collection(db, 'summaries'));
  const map = new Map<string, ActivitySummary>();
  snap.forEach((d) => {
    map.set(d.id, d.data() as ActivitySummary);
  });
  return map;
}

/**
 * Listens to all submitted confidential responses (App Admin only).
 */
export function subscribeToConfidentialResponses(
  onUpdate: (responses: ActivityResponse[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'responses'),
    where('confidential', '==', true),
    where('status', '==', 'submitted')
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: ActivityResponse[] = [];
      snap.forEach((d) => {
        list.push(d.data() as ActivityResponse);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Error listening to confidential responses:', err);
      if (onError) onError(err);
    }
  );
}
