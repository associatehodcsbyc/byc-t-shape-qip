import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Session, Activity } from '../types';
import defaultSessions from '../../seed/sessions.json';
import defaultActivities from '../../seed/activities.json';

// In-memory singletons initialized synchronously with bundled seed data
let cachedSessions: Session[] = [...(defaultSessions.sessions as Session[])].sort((a, b) => a.order - b.order);
let cachedActivities: Activity[] = [...(defaultActivities.activities as Activity[])].sort((a, b) => a.order - b.order);
const activityMap = new Map<string, Activity>();
cachedActivities.forEach((act) => activityMap.set(act.activityId, act));

let hasRevalidated = false;

/**
 * Returns sorted sessions instantly from memory cache.
 */
export function getCachedSessions(): Session[] {
  return cachedSessions;
}

/**
 * Returns sorted activities instantly from memory cache.
 */
export function getCachedActivities(): Activity[] {
  return cachedActivities;
}

/**
 * Instant lookup for an activity by its ID without network delay.
 */
export function getCachedActivityById(activityId: string): Activity | undefined {
  return activityMap.get(activityId);
}

/**
 * Loads content with Stale-While-Revalidate:
 * Immediately returns cached data, while asynchronously fetching remote updates if not yet checked.
 */
export async function loadContentWithRevalidation(
  onUpdate?: (sessions: Session[], activities: Activity[]) => void
): Promise<{ sessions: Session[]; activities: Activity[] }> {
  // If already revalidated in this browser session, return in-memory cache
  if (hasRevalidated) {
    return { sessions: cachedSessions, activities: cachedActivities };
  }

  // Asynchronously fetch updates in background without blocking caller
  (async () => {
    try {
      const [sessSnap, actSnap] = await Promise.all([
        getDocs(collection(db, 'sessions')),
        getDocs(collection(db, 'activities')),
      ]);

      let updated = false;

      if (!sessSnap.empty) {
        const list: Session[] = [];
        sessSnap.forEach((d) => list.push(d.data() as Session));
        list.sort((a, b) => a.order - b.order);
        cachedSessions = list;
        updated = true;
      }

      if (!actSnap.empty) {
        const list: Activity[] = [];
        actSnap.forEach((d) => {
          const act = d.data() as Activity;
          list.push(act);
          activityMap.set(act.activityId, act);
        });
        list.sort((a, b) => a.order - b.order);
        cachedActivities = list;
        updated = true;
      }

      hasRevalidated = true;
      if (updated && onUpdate) {
        onUpdate(cachedSessions, cachedActivities);
      }
    } catch (err) {
      // Graceful fallback to cached seed data on network failure
      hasRevalidated = true;
    }
  })();

  return { sessions: cachedSessions, activities: cachedActivities };
}

/**
 * Fetches an activity by ID instantly from memory, falling back to Firestore if new/custom.
 */
export async function fetchActivityById(activityId: string): Promise<Activity | null> {
  const existing = activityMap.get(activityId);
  if (existing) {
    return existing;
  }

  try {
    const actSnap = await getDoc(doc(db, 'activities', activityId));
    if (actSnap.exists()) {
      const data = actSnap.data() as Activity;
      activityMap.set(activityId, data);
      return data;
    }
  } catch (err) {
    console.error('Error fetching activity:', err);
  }
  return null;
}
