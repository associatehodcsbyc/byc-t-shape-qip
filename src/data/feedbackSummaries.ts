import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FeedbackDoc } from './feedback';

export interface FeedbackPartAStats {
  [itemId: string]: {
    mean: number;
    count: number;
    distribution: Record<number, number>;
  };
}

export interface FeedbackPartBStats {
  [itemId: string]: {
    counts: Record<string, number>;
    total: number;
  };
}

export interface FeedbackPartC1Stats {
  counts: Record<string, number>;
  total: number;
}

export interface FeedbackPartC2Stats {
  mean: number;
  count: number;
  distribution: Record<number, number>;
}

export interface FeedbackPartD1Stats {
  counts: Record<string, number>;
  total: number;
  otherComments?: string[];
}

export interface OverallFeedbackSummaryDoc {
  n: number;
  pA?: FeedbackPartAStats;
  pB?: FeedbackPartBStats;
  pC1?: FeedbackPartC1Stats;
  pC2?: FeedbackPartC2Stats;
  pD1?: FeedbackPartD1Stats;
  pD2Anonymous?: string[];
  updatedAt: any;
  updatedBy?: string;
}

const summaryRef = () => doc(db, 'feedbackSummaries', 'overall');

export const getOverallFeedbackSummary = async (): Promise<OverallFeedbackSummaryDoc | null> => {
  const snap = await getDoc(summaryRef());
  return snap.exists() ? (snap.data() as OverallFeedbackSummaryDoc) : null;
};

export const subscribeToOverallFeedbackSummary = (
  onUpdate: (summary: OverallFeedbackSummaryDoc | null) => void,
  onError?: (err: any) => void
) => {
  return onSnapshot(
    summaryRef(),
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as OverallFeedbackSummaryDoc) : null);
    },
    (err) => {
      console.error('Error subscribing to feedbackSummaries/overall:', err);
      if (onError) onError(err);
    }
  );
};

export const publishOverallFeedbackSummary = async (
  data: Omit<OverallFeedbackSummaryDoc, 'updatedAt'>,
  updatedBy?: string
) => {
  await setDoc(summaryRef(), {
    ...data,
    updatedAt: serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  });
};

export const fetchAllRawFeedbacks = async (): Promise<FeedbackDoc[]> => {
  const snap = await getDocs(collection(db, 'feedback'));
  const list: FeedbackDoc[] = [];
  snap.forEach((d) => {
    list.push(d.data() as FeedbackDoc);
  });
  return list;
};

export const subscribeToAllRawFeedbacks = (
  onUpdate: (feedbacks: FeedbackDoc[]) => void,
  onError?: (err: any) => void
) => {
  return onSnapshot(
    collection(db, 'feedback'),
    (snap) => {
      const list: FeedbackDoc[] = [];
      snap.forEach((d) => {
        list.push(d.data() as FeedbackDoc);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Error subscribing to raw feedbacks:', err);
      if (onError) onError(err);
    }
  );
};

export function computeFeedbackSummary(
  feedbacks: FeedbackDoc[],
  updatedBy?: string
): Omit<OverallFeedbackSummaryDoc, 'updatedAt'> {
  const n = feedbacks.length;
  if (n === 0) {
    return { n: 0, pD2Anonymous: [], updatedBy };
  }

  // pA: rating_scale a1..a5
  const pAItems = ['a1', 'a2', 'a3', 'a4', 'a5'];
  const pA: FeedbackPartAStats = {};
  for (const itemId of pAItems) {
    pA[itemId] = { mean: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  // pB: choice_matrix b1..b5
  const pBItems = ['b1', 'b2', 'b3', 'b4', 'b5'];
  const pB: FeedbackPartBStats = {};
  for (const itemId of pBItems) {
    pB[itemId] = {
      counts: { Excellent: 0, Good: 0, Satisfactory: 0, 'Needs Improvement': 0 },
      total: 0,
    };
  }

  // pC1: poll
  const pC1: FeedbackPartC1Stats = { counts: {}, total: 0 };

  // pC2: rating_scale c2
  const pC2: FeedbackPartC2Stats = { mean: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  // pD1: checklist
  const pD1: FeedbackPartD1Stats = { counts: {}, total: 0, otherComments: [] };

  // pD2: anonymous quotes
  const rawPD2Quotes: string[] = [];

  for (const f of feedbacks) {
    const ans = f.answers || {};

    // pA
    if (ans.pA) {
      for (const itemId of pAItems) {
        const val = Number(ans.pA[itemId]);
        if (val >= 1 && val <= 5) {
          pA[itemId].count++;
          pA[itemId].distribution[val] = (pA[itemId].distribution[val] || 0) + 1;
        }
      }
    }

    // pB
    if (ans.pB) {
      for (const itemId of pBItems) {
        const val = ans.pB[itemId];
        if (val && typeof val === 'string') {
          pB[itemId].total++;
          pB[itemId].counts[val] = (pB[itemId].counts[val] || 0) + 1;
        }
      }
    }

    // pC1
    if (ans.pC1) {
      const selected =
        typeof ans.pC1 === 'string'
          ? ans.pC1
          : ans.pC1.q1 || ans.pC1.selected || ans.pC1.optionId || Object.values(ans.pC1)[0];
      if (selected && typeof selected === 'string') {
        pC1.total++;
        pC1.counts[selected] = (pC1.counts[selected] || 0) + 1;
      }
    }

    // pC2
    if (ans.pC2 && ans.pC2.c2) {
      const val = Number(ans.pC2.c2);
      if (val >= 1 && val <= 5) {
        pC2.count++;
        pC2.distribution[val] = (pC2.distribution[val] || 0) + 1;
      }
    }

    // pD1 (checklist)
    if (ans.pD1) {
      if (Array.isArray(ans.pD1)) {
        for (const optId of ans.pD1) {
          if (typeof optId === 'string') {
            pD1.counts[optId] = (pD1.counts[optId] || 0) + 1;
          }
        }
        pD1.total++;
      } else if (typeof ans.pD1 === 'object') {
        let anyChecked = false;
        // Case A: ChecklistWidget format { selected: ['o1', 'o2'], other: '...' }
        if (Array.isArray(ans.pD1.selected)) {
          for (const optId of ans.pD1.selected) {
            if (typeof optId === 'string') {
              pD1.counts[optId] = (pD1.counts[optId] || 0) + 1;
              anyChecked = true;
            }
          }
          if (typeof ans.pD1.other === 'string' && ans.pD1.other.trim()) {
            pD1.otherComments?.push(ans.pD1.other.trim());
          }
        } else {
          // Case B: Map format { o1: true, o2: true, other: '...' }
          for (const [k, v] of Object.entries(ans.pD1)) {
            if (k === 'otherText' || k === 'other') {
              if (typeof v === 'string' && v.trim()) {
                pD1.otherComments?.push(v.trim());
              }
            } else if (v === true || v === 1 || v === 'true') {
              pD1.counts[k] = (pD1.counts[k] || 0) + 1;
              anyChecked = true;
            }
          }
        }
        if (anyChecked) pD1.total++;
      }
    }

    // pD2 (anonymous free text)
    if (ans.pD2) {
      const text =
        typeof ans.pD2 === 'string'
          ? ans.pD2
          : ans.pD2.q1 || ans.pD2.text || ans.pD2.response || Object.values(ans.pD2)[0];
      if (text && typeof text === 'string' && text.trim().length > 0) {
        rawPD2Quotes.push(text.trim());
      }
    }
  }

  // Calculate means for pA
  for (const itemId of pAItems) {
    if (pA[itemId].count > 0) {
      let sum = 0;
      for (let score = 1; score <= 5; score++) {
        sum += score * (pA[itemId].distribution[score] || 0);
      }
      pA[itemId].mean = Number((sum / pA[itemId].count).toFixed(2));
    }
  }

  // Calculate mean for pC2
  if (pC2.count > 0) {
    let sum = 0;
    for (let score = 1; score <= 5; score++) {
      sum += score * (pC2.distribution[score] || 0);
    }
    pC2.mean = Number((sum / pC2.count).toFixed(2));
  }

  // Shuffle pD2 anonymous quotes (Fisher-Yates)
  const pD2Anonymous = [...rawPD2Quotes];
  for (let i = pD2Anonymous.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pD2Anonymous[i], pD2Anonymous[j]] = [pD2Anonymous[j], pD2Anonymous[i]];
  }

  return {
    n,
    pA,
    pB,
    pC1,
    pC2,
    pD1,
    pD2Anonymous,
    updatedBy,
  };
}
