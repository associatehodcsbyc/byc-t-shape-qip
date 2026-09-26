import { describe, it, expect } from 'vitest';
import {
  computeMeanAndSD,
  computeRatingScaleItemStats,
  computeRatingScaleSectionStats,
  computeRatingScaleTotalStats,
  computeBandCounts,
  generateConfidentialSummary,
  computeRankOrderStats,
  computeChoiceMatrixStats,
  computeChecklistStats,
  computePollStats,
  computeCrmMatrixStats,
  computeAttendanceAndCertificates,
} from '../src/utils/analytics';
import { Activity, ActivityResponse, Session, SubmissionProgress, RosterUser } from '../src/types';
import seedActivitiesData from '../seed/activities.json';
import seedSessionsData from '../seed/sessions.json';

const seedActivities = seedActivitiesData.activities as Activity[];
const seedSessions = seedSessionsData.sessions as Session[];

describe('Phase 5 — Analytics & Aggregation Engine Unit Tests', () => {
  // 1. Mean and SD
  describe('Mean and Standard Deviation Calculation', () => {
    it('accurately computes arithmetic mean and standard deviation', () => {
      const { mean, sd } = computeMeanAndSD([2, 4, 4, 4, 5, 5, 7, 9]);
      // Mean = 40/8 = 5.0
      // Variance = ((9 + 1 + 1 + 1 + 0 + 0 + 4 + 16) / 8) = 32 / 8 = 4.0
      // SD = sqrt(4.0) = 2.0
      expect(mean).toBe(5);
      expect(sd).toBe(2);
    });

    it('handles empty input gracefully', () => {
      const res = computeMeanAndSD([]);
      expect(res.mean).toBe(0);
      expect(res.sd).toBe(0);
    });

    it('handles single value input', () => {
      const res = computeMeanAndSD([4]);
      expect(res.mean).toBe(4);
      expect(res.sd).toBe(0);
    });
  });

  // 2. The N < 5 Suppression Rule (SPEC §8A)
  describe('Confidential Summary N < 5 Suppression Rule (SPEC §8A)', () => {
    const tlActivity = seedActivities.find(
      (a) => a.activityId === 'd1s1_a2_tl_questionnaire'
    )!;

    it('suppresses statistics and comments when n < 5', () => {
      const responses: ActivityResponse[] = [
        {
          activityId: tlActivity.activityId,
          sessionId: tlActivity.sessionId,
          department: 'computer-science',
          email: 'p1@christuniversity.in',
          uid: 'u1',
          name: 'P1',
          answers: { q1: 5, q2: 4, reflections: { r1: 'Confidential feedback 1' } },
          status: 'submitted',
          confidential: true,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: tlActivity.activityId,
          sessionId: tlActivity.sessionId,
          department: 'computer-science',
          email: 'p2@christuniversity.in',
          uid: 'u2',
          name: 'P2',
          answers: { q1: 4, q2: 3, reflections: { r1: 'Confidential feedback 2' } },
          status: 'submitted',
          confidential: true,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: tlActivity.activityId,
          sessionId: tlActivity.sessionId,
          department: 'computer-science',
          email: 'p3@christuniversity.in',
          uid: 'u3',
          name: 'P3',
          answers: { q1: 3, q2: 2, reflections: { r1: 'Confidential feedback 3' } },
          status: 'submitted',
          confidential: true,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: tlActivity.activityId,
          sessionId: tlActivity.sessionId,
          department: 'computer-science',
          email: 'p4@christuniversity.in',
          uid: 'u4',
          name: 'P4',
          answers: { q1: 5, q2: 5, reflections: { r1: 'Confidential feedback 4' } },
          status: 'submitted',
          confidential: true,
          createdAt: null,
          updatedAt: null,
        },
      ];

      expect(responses.length).toBe(4);
      const summary = generateConfidentialSummary(responses, tlActivity, 'computer-science');

      expect(summary.n).toBe(4);
      expect(summary.suppressed).toBe(true);
      expect(summary.itemStats).toBeUndefined();
      expect(summary.sectionStats).toBeUndefined();
      expect(summary.bandCounts).toBeUndefined();
      expect(summary.comments).toBeUndefined();
    });

    it('unsuppresses and computes complete statistics & shuffled comments when n >= 5', () => {
      const responses: ActivityResponse[] = [];
      for (let i = 1; i <= 5; i++) {
        responses.push({
          activityId: tlActivity.activityId,
          sessionId: tlActivity.sessionId,
          department: 'computer-science',
          email: `p${i}@christuniversity.in`,
          uid: `u${i}`,
          name: `P${i}`,
          answers: {
            t1_q1: 4,
            t1_q2: 5,
            reflections: { r1: `Faculty reflection ${i}` },
          },
          status: 'submitted',
          confidential: true,
          createdAt: null,
          updatedAt: null,
        });
      }

      expect(responses.length).toBe(5);
      const summary = generateConfidentialSummary(responses, tlActivity, 'computer-science');

      expect(summary.n).toBe(5);
      expect(summary.suppressed).toBe(false);
      expect(summary.itemStats).toBeDefined();
      expect(summary.sectionStats).toBeDefined();
      expect(summary.totalStats).toBeDefined();
      expect(summary.bandCounts).toBeDefined();
      expect(summary.comments).toBeDefined();
      expect(summary.comments?.length).toBe(5);
      // Verify names are not included in comments
      summary.comments?.forEach((c) => {
        expect(c).not.toContain('P1');
        expect(c).not.toContain('p1@christuniversity.in');
      });
    });
  });

  // 3. Rating Scale Widget & Band Counts (Real Seed: Academic Rigour Checklist)
  describe('Rating Scale Widget Analytics & Score Bands (Real Seed: Rigour Checklist)', () => {
    const rigourAct = seedActivities.find(
      (a) => a.activityId === 'd1s3_a1_rigour_checklist'
    )!;

    it('computes item distributions, section subtotals, and score interpretation bands', () => {
      expect(rigourAct).toBeDefined();
      expect(rigourAct.scoring?.bands).toBeDefined();

      const responses: ActivityResponse[] = [
        {
          activityId: rigourAct.activityId,
          sessionId: rigourAct.sessionId,
          department: 'cs',
          email: 'p1@christ.in',
          uid: 'u1',
          name: 'P1',
          answers: {
            a1: 5,
            a2: 5,
            b1: 5,
          },
          status: 'submitted',
          confidential: true,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: rigourAct.activityId,
          sessionId: rigourAct.sessionId,
          department: 'cs',
          email: 'p2@christ.in',
          uid: 'u2',
          name: 'P2',
          answers: {
            a1: 3,
            a2: 4,
            b1: 3,
          },
          status: 'submitted',
          confidential: true,
          createdAt: null,
          updatedAt: null,
        },
      ];

      const itemStats = computeRatingScaleItemStats(responses, rigourAct);
      expect(itemStats.a1).toBeDefined();
      // a1 ratings: 5 and 3 -> mean 4.0, sd 1.0
      expect(itemStats.a1.mean).toBe(4);
      expect(itemStats.a1.sd).toBe(1);
      // dist counts: index 2 (val 3) = 1, index 4 (val 5) = 1
      expect(itemStats.a1.dist[2]).toBe(1);
      expect(itemStats.a1.dist[4]).toBe(1);

      const sectionStats = computeRatingScaleSectionStats(responses, rigourAct);
      expect(sectionStats.A).toBeDefined();
      // P1 Section A total: 5+5=10; P2 Section A total: 3+4=7. Mean: (10+7)/2 = 8.5
      expect(sectionStats.A.mean).toBe(8.5);

      const totalStats = computeRatingScaleTotalStats(responses, rigourAct);
      expect(totalStats.mean).toBeGreaterThan(0);

      const bandCounts = computeBandCounts(responses, rigourAct);
      expect(typeof bandCounts).toBe('object');
      const totalCount = Object.values(bandCounts).reduce((a, b) => a + b, 0);
      expect(totalCount).toBe(2);
    });
  });

  // 4. Rank Order Widget (Real Seed: Disciplinary Depth Ranking)
  describe('Rank Order Widget Analytics (Real Seed: Depth Ranking)', () => {
    const rankAct = seedActivities.find((a) => a.activityId === 'd1s2_a1_depth_ranking')!;

    it('calculates average rank per option and sorts ascending', () => {
      expect(rankAct).toBeDefined();

      const responses: ActivityResponse[] = [
        {
          activityId: rankAct.activityId,
          sessionId: rankAct.sessionId,
          department: 'cs',
          email: 'p1@christ.in',
          uid: 'u1',
          name: 'P1',
          answers: {
            order: ['o1', 'o2', 'o3', 'o4'],
          },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: rankAct.activityId,
          sessionId: rankAct.sessionId,
          department: 'cs',
          email: 'p2@christ.in',
          uid: 'u2',
          name: 'P2',
          answers: {
            order: ['o1', 'o3', 'o2', 'o4'],
          },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
      ];

      const stats = computeRankOrderStats(responses, rankAct);
      expect(stats.length).toBeGreaterThan(0);

      // o1 was ranked 1st by both respondents -> meanRank = 1.0
      const o1 = stats.find((s) => s.id === 'o1');
      expect(o1?.meanRank).toBe(1);

      // Verify that result is sorted ascending by meanRank
      for (let i = 1; i < stats.length; i++) {
        expect(stats[i].meanRank).toBeGreaterThanOrEqual(stats[i - 1].meanRank);
      }
    });
  });

  // 5. Choice Matrix Widget (Real Seed: Teaching for Disciplinary Mastery)
  describe('Choice Matrix Widget Analytics (Real Seed: Teaching for Mastery)', () => {
    const choiceAct = seedActivities.find(
      (a) => a.activityId === 'd1s3_a4_teaching_for_mastery'
    )!;

    it('counts chosen options and percentages per item', () => {
      expect(choiceAct).toBeDefined();
      const firstItemId = choiceAct.config?.items?.[0]?.id || 'c1';

      const responses: ActivityResponse[] = [
        {
          activityId: choiceAct.activityId,
          sessionId: choiceAct.sessionId,
          department: 'cs',
          email: 'p1@christ.in',
          uid: 'u1',
          name: 'P1',
          answers: { [firstItemId]: 'Frequently' },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: choiceAct.activityId,
          sessionId: choiceAct.sessionId,
          department: 'cs',
          email: 'p2@christ.in',
          uid: 'u2',
          name: 'P2',
          answers: { [firstItemId]: 'Occasionally' },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
      ];

      const stats = computeChoiceMatrixStats(responses, choiceAct);
      const itemStat = stats.find((s) => s.id === firstItemId);
      expect(itemStat).toBeDefined();
      expect(itemStat?.counts['Frequently']).toBe(1);
      expect(itemStat?.counts['Occasionally']).toBe(1);
      expect(itemStat?.percentages['Frequently']).toBe(50);
      expect(itemStat?.percentages['Occasionally']).toBe(50);
    });
  });

  // 6. Checklist Widget (Real Seed: Reading for Depth)
  describe('Checklist Widget Analytics (Real Seed: Reading for Depth)', () => {
    const checkAct = seedActivities.find(
      (a) => a.activityId === 'd1s3_a5_reading_for_depth'
    )!;

    it('tallies selection counts and percentages for checklist options', () => {
      expect(checkAct).toBeDefined();
      const firstOptId = checkAct.config?.options?.[0]?.id || 'rd_1';

      const responses: ActivityResponse[] = [
        {
          activityId: checkAct.activityId,
          sessionId: checkAct.sessionId,
          department: 'cs',
          email: 'p1@christ.in',
          uid: 'u1',
          name: 'P1',
          answers: { selected: [firstOptId], other: 'Custom read source' },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: checkAct.activityId,
          sessionId: checkAct.sessionId,
          department: 'cs',
          email: 'p2@christ.in',
          uid: 'u2',
          name: 'P2',
          answers: { selected: [] },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
      ];

      const res = computeChecklistStats(responses, checkAct);
      const opt = res.options.find((o) => o.id === firstOptId);
      expect(opt?.count).toBe(1);
      expect(opt?.percentage).toBe(50);
      expect(res.otherResponses).toContain('Custom read source');
    });
  });

  // 7. Poll Widget (Real Seed: Sort the Scholarship)
  describe('Poll Widget Analytics (Real Seed: Sort the Scholarship)', () => {
    const pollAct = seedActivities.find(
      (a) => a.activityId === 'd3s3_a2_sort_scholarship'
    )!;

    it('tallies votes and percentages per poll question', () => {
      expect(pollAct).toBeDefined();

      const responses: ActivityResponse[] = [
        {
          activityId: pollAct.activityId,
          sessionId: pollAct.sessionId,
          department: 'cs',
          email: 'p1@christ.in',
          uid: 'u1',
          name: 'P1',
          answers: { p1: { a: 'o1' } },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
      ];

      const stats = computePollStats(responses, pollAct);
      expect(stats.length).toBeGreaterThan(0);
      const q1 = stats[0];
      expect(q1.totalVotes).toBe(1);
      const opt1 = q1.options.find((o) => o.id === 'o1');
      expect(opt1?.count).toBe(1);
      expect(opt1?.percentage).toBe(100);
    });
  });

  // 8. Cognitive Rigour Matrix (CRM) Widget (Real Seed: CRM Syllabus Map)
  describe('CRM Matrix Heat Map & DOK Rigour Ratio (Real Seed: CRM Syllabus Map)', () => {
    it('populates 6x4 heat map and computes DOK 3–4 vs 1–2 percentage', () => {
      const responses: ActivityResponse[] = [
        {
          activityId: 'd2s3_a1_crm_syllabus_map',
          sessionId: 'd2s3',
          department: 'cs',
          email: 'p1@christ.in',
          uid: 'u1',
          name: 'P1',
          answers: {
            items: [
              { type: 'co', text: 'Define terms', bloom: 'Remember', dok: 'DOK 1' },
              { type: 'assessment', text: 'Solve routine bug', bloom: 'Apply', dok: 'DOK 2' },
              { type: 'co', text: 'Design complex algorithm', bloom: 'Create', dok: 'DOK 4' },
            ],
          },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
        {
          activityId: 'd2s3_a1_crm_syllabus_map',
          sessionId: 'd2s3',
          department: 'cs',
          email: 'p2@christ.in',
          uid: 'u2',
          name: 'P2',
          answers: {
            items: [
              { type: 'assessment', text: 'Analyze trade-offs', bloom: 'Analyze', dok: 'DOK 3' },
            ],
          },
          status: 'submitted',
          confidential: false,
          createdAt: null,
          updatedAt: null,
        },
      ];

      const res = computeCrmMatrixStats(responses);

      expect(res.totalItems).toBe(4);
      expect(res.heatMap['Remember']['DOK 1']).toBe(1);
      expect(res.heatMap['Apply']['DOK 2']).toBe(1);
      expect(res.heatMap['Analyze']['DOK 3']).toBe(1);
      expect(res.heatMap['Create']['DOK 4']).toBe(1);

      // DOK 1 & 2: 2 items = 50%
      expect(res.dok1_2Count).toBe(2);
      expect(res.dok1_2Percentage).toBe(50);

      // DOK 3 & 4: 2 items = 50%
      expect(res.dok3_4Count).toBe(2);
      expect(res.dok3_4Percentage).toBe(50);
    });
  });

  // 9. Session Attendance & E-Certificate Eligibility (QIP Report Pack)
  describe('Session Attendance & E-Certificate Eligibility Rules', () => {
    const mockSessions: Session[] = seedSessions;
    const mockActivities: Activity[] = seedActivities;

    const mockRoster: RosterUser[] = [
      { email: 'perfect@christuniversity.in', name: 'Dr Perfect Attendance', department: 'cs', role: 'participant', active: true },
      { email: 'partial@christuniversity.in', name: 'Dr Partial Attendance', department: 'cs', role: 'participant', active: true },
      { email: 'inactive@christuniversity.in', name: 'Dr Inactive', department: 'cs', role: 'participant', active: false },
    ];

    it('marks participant present in a session if at least one activity was submitted in that session', () => {
      const progressList: SubmissionProgress[] = [];

      // Perfect participant submitted at least 1 activity in ALL 12 sessions
      for (const s of mockSessions) {
        progressList.push({
          activityId: `act_for_${s.sessionId}`,
          sessionId: s.sessionId,
          department: 'cs',
          email: 'perfect@christuniversity.in',
          name: 'Dr Perfect Attendance',
          status: 'submitted',
          updatedAt: null,
        });
      }

      // Partial participant submitted activities ONLY in d1s1 and d1s2, but had draft in d1s3
      progressList.push({
        activityId: 'act_1',
        sessionId: 'd1s1',
        department: 'cs',
        email: 'partial@christuniversity.in',
        name: 'Dr Partial Attendance',
        status: 'submitted',
        updatedAt: null,
      });
      progressList.push({
        activityId: 'act_2',
        sessionId: 'd1s2',
        department: 'cs',
        email: 'partial@christuniversity.in',
        name: 'Dr Partial Attendance',
        status: 'submitted',
        updatedAt: null,
      });
      // Draft does NOT count as attended
      progressList.push({
        activityId: 'act_3',
        sessionId: 'd1s3',
        department: 'cs',
        email: 'partial@christuniversity.in',
        name: 'Dr Partial Attendance',
        status: 'draft',
        updatedAt: null,
      });

      const res = computeAttendanceAndCertificates(progressList, mockSessions, mockActivities, mockRoster);

      // Inactive user excluded
      expect(res.sessionAttendance.length).toBe(2);

      const perfect = res.sessionAttendance.find((p) => p.email === 'perfect@christuniversity.in')!;
      expect(perfect).toBeDefined();
      expect(perfect.totalAttended).toBe(12);
      expect(perfect.attendancePct).toBe(100);
      expect(perfect.isEligibleForCertificate).toBe(true);

      const partial = res.sessionAttendance.find((p) => p.email === 'partial@christuniversity.in')!;
      expect(partial).toBeDefined();
      expect(partial.totalAttended).toBe(2);
      expect(partial.attendancePct).toBe(Math.round((2 / 12) * 100));
      expect(partial.isEligibleForCertificate).toBe(false);

      // E-Certificate list should contain ONLY perfect attendee
      expect(res.certificateRecipients.length).toBe(1);
      expect(res.certificateRecipients[0].email).toBe('perfect@christuniversity.in');
    });
  });
});
