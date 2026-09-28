import {
  Activity,
  ActivityResponse,
  ActivitySummary,
  ItemStat,
  SectionStat,
  Session,
  SubmissionProgress,
  RosterUser,
} from '../types';
import { computeRatingScaleScore } from './scoring';
import { isEligibleParticipant } from './department';

/**
 * Computes arithmetic mean and population standard deviation.
 */
export function computeMeanAndSD(values: number[]): { mean: number; sd: number } {
  if (!values || values.length === 0) {
    return { mean: 0, sd: 0 };
  }
  const n = values.length;
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = Math.round((sum / n) * 100) / 100;

  const sumSquares = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const sd = Math.round(Math.sqrt(sumSquares / n) * 100) / 100;

  return { mean, sd };
}

/**
 * Fisher-Yates array shuffle helper (for anonymous comments).
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Computes item statistics (mean, SD, distribution 1..5) for rating_scale.
 */
export function computeRatingScaleItemStats(
  responses: ActivityResponse[],
  activity: Activity
): Record<string, ItemStat> {
  const itemStats: Record<string, ItemStat> = {};
  const config = activity.config || {};
  const sections = config.sections || [];

  // Collect all item IDs
  const allItemIds: string[] = [];
  if (sections.length > 0) {
    sections.forEach((sec: any) => {
      (sec.items || []).forEach((it: any) => allItemIds.push(it.id));
    });
  } else if (config.items && Array.isArray(config.items)) {
    config.items.forEach((it: any) => allItemIds.push(it.id));
  }

  for (const itemId of allItemIds) {
    const ratings: number[] = [];
    const dist = [0, 0, 0, 0, 0]; // counts for 1, 2, 3, 4, 5

    for (const r of responses) {
      const val = r.answers?.[itemId];
      if (typeof val === 'number' && !isNaN(val) && val >= 1 && val <= 5) {
        ratings.push(val);
        dist[Math.round(val) - 1]++;
      }
    }

    const { mean, sd } = computeMeanAndSD(ratings);
    itemStats[itemId] = { mean, sd, dist };
  }

  return itemStats;
}

/**
 * Computes section statistics (mean, SD) for rating_scale.
 */
export function computeRatingScaleSectionStats(
  responses: ActivityResponse[],
  activity: Activity
): Record<string, SectionStat> {
  const sectionStats: Record<string, SectionStat> = {};
  const sections = activity.config?.sections || [];

  for (const sec of sections) {
    const sectionTotals: number[] = [];
    const secItems: string[] = (sec.items || []).map((it: any) => it.id);

    for (const r of responses) {
      let secSum = 0;
      let hasAny = false;
      for (const itId of secItems) {
        const val = r.answers?.[itId];
        if (typeof val === 'number' && !isNaN(val)) {
          secSum += val;
          hasAny = true;
        }
      }
      if (hasAny) {
        sectionTotals.push(secSum);
      }
    }

    sectionStats[sec.id] = computeMeanAndSD(sectionTotals);
  }

  return sectionStats;
}

/**
 * Computes total statistics (grand total mean, SD) for rating_scale.
 */
export function computeRatingScaleTotalStats(
  responses: ActivityResponse[],
  activity: Activity
): { mean: number; sd: number } {
  const totals: number[] = [];

  for (const r of responses) {
    const scoreResult = computeRatingScaleScore(r.answers, activity);
    totals.push(scoreResult.totalScore);
  }

  return computeMeanAndSD(totals);
}

/**
 * Computes distribution of responses across score interpretation bands.
 */
export function computeBandCounts(
  responses: ActivityResponse[],
  activity: Activity
): Record<string, number> {
  const bandCounts: Record<string, number> = {};
  const bands = activity.scoring?.bands || [];

  bands.forEach((b) => {
    bandCounts[b.label] = 0;
  });

  for (const r of responses) {
    const scoreResult = computeRatingScaleScore(r.answers, activity);
    if (scoreResult.band) {
      bandCounts[scoreResult.band.label] = (bandCounts[scoreResult.band.label] || 0) + 1;
    }
  }

  return bandCounts;
}

/**
 * Extracts all reflection and evidence comments, removing author names and shuffling order.
 */
export function extractAnonymousShuffledComments(responses: ActivityResponse[]): string[] {
  const comments: string[] = [];

  for (const r of responses) {
    const answers = r.answers || {};

    // 1. Reflections
    if (answers.reflections && typeof answers.reflections === 'object') {
      for (const val of Object.values(answers.reflections)) {
        if (typeof val === 'string' && val.trim().length > 0) {
          comments.push(val.trim());
        }
      }
    }

    // 2. Item evidence text boxes (ending in _ev)
    for (const [k, v] of Object.entries(answers)) {
      if (k.endsWith('_ev') && typeof v === 'string' && v.trim().length > 0) {
        comments.push(v.trim());
      }
    }
  }

  return shuffleArray(comments);
}

/**
 * Generates an anonymous department summary for a confidential activity.
 * Anonymity threshold: If n < 3, suppressed: true with no statistics or comments.
 */
export function generateConfidentialSummary(
  responses: ActivityResponse[],
  activity: Activity,
  department: string
): ActivitySummary {
  const n = responses.length;

  if (n < 3) {
    return {
      department,
      activityId: activity.activityId,
      n,
      suppressed: true,
      updatedAt: new Date(),
    };
  }

  const itemStats = computeRatingScaleItemStats(responses, activity);
  const sectionStats = computeRatingScaleSectionStats(responses, activity);
  const totalStats = computeRatingScaleTotalStats(responses, activity);
  const bandCounts = computeBandCounts(responses, activity);
  const comments = extractAnonymousShuffledComments(responses);

  return {
    department,
    activityId: activity.activityId,
    n,
    itemStats,
    sectionStats,
    totalStats,
    bandCounts,
    comments,
    suppressed: false,
    updatedAt: new Date(),
  };
}

/**
 * Rank order statistics: calculates mean rank per option and sorts ascending.
 * Lower rank means higher preference (e.g. rank 1 vs rank 10).
 */
export interface RankOptionStat {
  id: string;
  text: string;
  meanRank: number;
}

export function computeRankOrderStats(
  responses: ActivityResponse[],
  activity: Activity
): RankOptionStat[] {
  const options = activity.config?.options || [];
  const rankSums: Record<string, number> = {};
  const rankCounts: Record<string, number> = {};

  options.forEach((opt: any) => {
    rankSums[opt.id] = 0;
    rankCounts[opt.id] = 0;
  });

  for (const r of responses) {
    const order: string[] = r.answers?.order || [];
    order.forEach((optId, idx) => {
      if (rankSums[optId] !== undefined) {
        rankSums[optId] += idx + 1; // 1-based rank
        rankCounts[optId]++;
      }
    });
  }

  const result: RankOptionStat[] = options.map((opt: any) => {
    const count = rankCounts[opt.id] || 0;
    const meanRank = count > 0 ? Math.round((rankSums[opt.id] / count) * 100) / 100 : 0;
    return {
      id: opt.id,
      text: opt.text,
      meanRank,
    };
  });

  return result.sort((a, b) => a.meanRank - b.meanRank);
}

/**
 * Choice matrix stats: item × categorical options counts and percentages.
 */
export interface ChoiceItemStat {
  id: string;
  text: string;
  counts: Record<string, number>;
  percentages: Record<string, number>;
  totalAnswered: number;
}

export function computeChoiceMatrixStats(
  responses: ActivityResponse[],
  activity: Activity
): ChoiceItemStat[] {
  const items = activity.config?.items || [];
  const options: string[] = activity.config?.options || [];

  return items.map((item: any) => {
    const counts: Record<string, number> = {};
    options.forEach((opt) => (counts[opt] = 0));
    let totalAnswered = 0;

    for (const r of responses) {
      const chosen = r.answers?.[item.id];
      if (chosen && counts[chosen] !== undefined) {
        counts[chosen]++;
        totalAnswered++;
      }
    }

    const percentages: Record<string, number> = {};
    options.forEach((opt) => {
      percentages[opt] = totalAnswered > 0 ? Math.round((counts[opt] / totalAnswered) * 100) : 0;
    });

    return {
      id: item.id,
      text: item.text,
      counts,
      percentages,
      totalAnswered,
    };
  });
}

/**
 * Checklist stats: selection counts and percentages for each option.
 */
export interface ChecklistStat {
  id: string;
  text: string;
  count: number;
  percentage: number;
}

export function computeChecklistStats(
  responses: ActivityResponse[],
  activity: Activity
): { options: ChecklistStat[]; otherResponses: string[]; totalResponses: number } {
  const options = activity.config?.options || [];
  const counts: Record<string, number> = {};
  options.forEach((opt: any) => (counts[opt.id] = 0));
  const otherResponses: string[] = [];

  const total = responses.length;

  for (const r of responses) {
    const selected: string[] = r.answers?.selected || [];
    selected.forEach((id) => {
      if (counts[id] !== undefined) {
        counts[id]++;
      }
    });
    if (r.answers?.other && typeof r.answers.other === 'string' && r.answers.other.trim()) {
      otherResponses.push(r.answers.other.trim());
    }
  }

  const optionStats: ChecklistStat[] = options.map((opt: any) => {
    const c = counts[opt.id] || 0;
    return {
      id: opt.id,
      text: opt.text,
      count: c,
      percentage: total > 0 ? Math.round((c / total) * 100) : 0,
    };
  });

  return {
    options: optionStats,
    otherResponses,
    totalResponses: total,
  };
}

/**
 * Poll stats: single/multiple choice options counts and percentages per question.
 */
export interface PollQuestionStat {
  id: string;
  prompt: string;
  multi: boolean;
  options: { id: string; text: string; count: number; percentage: number }[];
  totalVotes: number;
}

export function computePollStats(
  responses: ActivityResponse[],
  activity: Activity
): PollQuestionStat[] {
  let questions: Array<{ q: any; partId?: string }> = [];

  if (activity.config?.questions && Array.isArray(activity.config.questions)) {
    questions = activity.config.questions.map((q: any) => ({ q }));
  } else if (activity.config?.parts && Array.isArray(activity.config.parts)) {
    for (const part of activity.config.parts) {
      if (part.widgetType === 'poll' && part.config?.questions) {
        for (const q of part.config.questions) {
          questions.push({ q, partId: part.id });
        }
      }
    }
  }

  return questions.map(({ q, partId }) => {
    const counts: Record<string, number> = {};
    (q.options || []).forEach((opt: any) => (counts[opt.id] = 0));
    let totalVotes = 0;

    for (const r of responses) {
      const ans =
        partId && r.answers?.[partId]?.[q.id] !== undefined
          ? r.answers[partId][q.id]
          : r.answers?.[q.id];

      if (Array.isArray(ans)) {
        ans.forEach((optId) => {
          if (counts[optId] !== undefined) {
            counts[optId]++;
            totalVotes++;
          }
        });
      } else if (ans && counts[ans] !== undefined) {
        counts[ans]++;
        totalVotes++;
      }
    }

    const optionStats = (q.options || []).map((opt: any) => {
      const c = counts[opt.id] || 0;
      return {
        id: opt.id,
        text: opt.text,
        count: c,
        percentage: totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0,
      };
    });

    return {
      id: q.id,
      prompt: q.prompt,
      multi: !!q.multi,
      options: optionStats,
      totalVotes,
    };
  });
}

/**
 * Cognitive Rigour Matrix (CRM) stats:
 * 6 Bloom rows × 4 DOK columns heat map, plus DOK 3–4 vs 1–2 percentage.
 */
export const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const;
export const DOK_LEVELS = ['DOK 1', 'DOK 2', 'DOK 3', 'DOK 4'] as const;

export interface CrmMatrixStats {
  heatMap: Record<string, Record<string, number>>; // heatMap[bloom][dok] = count
  totalItems: number;
  dok1_2Count: number;
  dok3_4Count: number;
  dok1_2Percentage: number;
  dok3_4Percentage: number;
}

export function computeCrmMatrixStats(responses: ActivityResponse[]): CrmMatrixStats {
  const heatMap: Record<string, Record<string, number>> = {};

  BLOOM_LEVELS.forEach((b) => {
    heatMap[b] = {};
    DOK_LEVELS.forEach((d) => {
      heatMap[b][d] = 0;
    });
  });

  let totalItems = 0;
  let dok1_2Count = 0;
  let dok3_4Count = 0;

  for (const r of responses) {
    const items: Array<{ bloom: string; dok: string }> = r.answers?.items || [];
    for (const it of items) {
      if (it.bloom && it.dok && heatMap[it.bloom] && heatMap[it.bloom][it.dok] !== undefined) {
        heatMap[it.bloom][it.dok]++;
        totalItems++;

        if (it.dok === 'DOK 1' || it.dok === 'DOK 2') {
          dok1_2Count++;
        } else if (it.dok === 'DOK 3' || it.dok === 'DOK 4') {
          dok3_4Count++;
        }
      }
    }
  }

  const dok1_2Percentage = totalItems > 0 ? Math.round((dok1_2Count / totalItems) * 100) : 0;
  const dok3_4Percentage = totalItems > 0 ? Math.round((dok3_4Count / totalItems) * 100) : 0;

  return {
    heatMap,
    totalItems,
    dok1_2Count,
    dok3_4Count,
    dok1_2Percentage,
    dok3_4Percentage,
  };
}

/**
 * Attendance and Certificate Eligibility (QIP Report Pack):
 * Rule per prompt: A participant is present in a session if they submitted at least ONE activity in it.
 * E-certificate list: Participants present in all 12 sessions.
 */
export interface ParticipantSessionAttendance {
  name: string;
  email: string;
  department: string;
  attendedSessions: Record<string, boolean>; // sessionId -> true/false
  totalAttended: number;
  attendancePct: number;
  isEligibleForCertificate: boolean;
}

export interface ActivityParticipationSummary {
  activityId: string;
  sessionId: string;
  order: number;
  title: string;
  widgetType: string;
  submittedCount: number;
  draftCount: number;
  notStartedCount: number;
  completionPercentage: number;
}

export interface QipAttendanceAnalysisResult {
  sessionAttendance: ParticipantSessionAttendance[];
  certificateRecipients: ParticipantSessionAttendance[];
  activityParticipation: ActivityParticipationSummary[];
}

export function computeAttendanceAndCertificates(
  progressList: SubmissionProgress[],
  sessions: Session[],
  activities: Activity[],
  roster: RosterUser[]
): QipAttendanceAnalysisResult {
  const activeParticipants = roster.filter((u) => isEligibleParticipant(u));
  const totalSessions = sessions.length || 12;

  // 1. Map of participantEmail -> Set of attended sessionIds (where at least one submitted activity exists)
  const attendedMap = new Map<string, Set<string>>();

  for (const prog of progressList) {
    if (prog.status === 'submitted') {
      const email = prog.email.toLowerCase().trim();
      const set = attendedMap.get(email) || new Set<string>();
      set.add(prog.sessionId);
      attendedMap.set(email, set);
    }
  }

  // 2. Generate attendance records per participant
  const sessionAttendance: ParticipantSessionAttendance[] = activeParticipants.map((p) => {
    const email = p.email.toLowerCase().trim();
    const attendedSet = attendedMap.get(email) || new Set<string>();

    const attendedSessions: Record<string, boolean> = {};
    for (const s of sessions) {
      attendedSessions[s.sessionId] = attendedSet.has(s.sessionId);
    }

    const totalAttended = attendedSet.size;
    const attendancePct = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;
    const isEligibleForCertificate = totalAttended >= totalSessions;

    return {
      name: p.name,
      email: p.email,
      department: p.department,
      attendedSessions,
      totalAttended,
      attendancePct,
      isEligibleForCertificate,
    };
  });

  // Sort alphabetically by name
  sessionAttendance.sort((a, b) => a.name.localeCompare(b.name));

  // 3. E-certificate recipients (all 12 sessions attended)
  const certificateRecipients = sessionAttendance.filter((p) => p.isEligibleForCertificate);

  // 4. Per-activity participation breakdown
  const rosterSize = activeParticipants.length;
  const activityParticipation: ActivityParticipationSummary[] = activities.map((act) => {
    const actProgress = progressList.filter((p) => p.activityId === act.activityId);
    const submittedCount = actProgress.filter((p) => p.status === 'submitted').length;
    const draftCount = actProgress.filter((p) => p.status === 'draft').length;
    const notStartedCount = Math.max(0, rosterSize - submittedCount - draftCount);
    const completionPercentage = rosterSize > 0 ? Math.round((submittedCount / rosterSize) * 100) : 0;

    return {
      activityId: act.activityId,
      sessionId: act.sessionId,
      order: act.order,
      title: act.title,
      widgetType: act.widgetType,
      submittedCount,
      draftCount,
      notStartedCount,
      completionPercentage,
    };
  });

  activityParticipation.sort((a, b) => a.order - b.order);

  return {
    sessionAttendance,
    certificateRecipients,
    activityParticipation,
  };
}
