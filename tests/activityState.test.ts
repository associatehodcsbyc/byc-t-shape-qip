import { describe, it, expect } from 'vitest';
import { SubmissionProgress, RosterUser } from '../src/types';

describe('Activity State & Live Tracker Unit Tests', () => {
  it('correctly maps activityState enabled and locked flags to state labels', () => {
    const getStateLabel = (state?: { enabled: boolean; locked: boolean }) => {
      if (!state || !state.enabled) return 'Disabled';
      if (state.locked) return 'Locked';
      return 'Enabled';
    };

    expect(getStateLabel(undefined)).toBe('Disabled');
    expect(getStateLabel({ enabled: false, locked: false })).toBe('Disabled');
    expect(getStateLabel({ enabled: false, locked: true })).toBe('Disabled');
    expect(getStateLabel({ enabled: true, locked: false })).toBe('Enabled');
    expect(getStateLabel({ enabled: true, locked: true })).toBe('Locked');
  });

  it('computes submitted, draft, and not-started metrics accurately against roster size', () => {
    const mockRoster: RosterUser[] = [
      { email: 'p1@christuniversity.in', name: 'Faculty 1', department: 'cs', role: 'participant', active: true },
      { email: 'p2@christuniversity.in', name: 'Faculty 2', department: 'cs', role: 'participant', active: true },
      { email: 'p3@christuniversity.in', name: 'Faculty 3', department: 'cs', role: 'participant', active: true },
      { email: 'p4@christuniversity.in', name: 'Faculty 4', department: 'cs', role: 'participant', active: true },
    ];

    const mockProgress: SubmissionProgress[] = [
      { activityId: 'act_1', sessionId: 'd1s1', department: 'cs', email: 'p1@christuniversity.in', name: 'Faculty 1', status: 'submitted', updatedAt: null },
      { activityId: 'act_1', sessionId: 'd1s1', department: 'cs', email: 'p2@christuniversity.in', name: 'Faculty 2', status: 'draft', updatedAt: null },
      // p3 and p4 have not started
    ];

    const totalCount = mockRoster.length;
    const progressMap = new Map(mockProgress.map(p => [p.email.toLowerCase(), p]));

    let submittedCount = 0;
    let draftCount = 0;
    mockRoster.forEach(u => {
      const p = progressMap.get(u.email.toLowerCase());
      if (p?.status === 'submitted') submittedCount++;
      else if (p?.status === 'draft') draftCount++;
    });
    const notStartedCount = totalCount - submittedCount - draftCount;

    expect(totalCount).toBe(4);
    expect(submittedCount).toBe(1);
    expect(draftCount).toBe(1);
    expect(notStartedCount).toBe(2);

    expect(Math.round((submittedCount / totalCount) * 100)).toBe(25);
    expect(Math.round((draftCount / totalCount) * 100)).toBe(25);
    expect(Math.round((notStartedCount / totalCount) * 100)).toBe(50);
  });

  it('aggregates submission progress by groupLabel accurately', () => {
    const mockProgress: SubmissionProgress[] = [
      { activityId: 'act_1', sessionId: 'd1s1', department: 'cs', email: 'p1@christuniversity.in', name: 'F1', status: 'submitted', groupLabel: 'Group 1', updatedAt: null },
      { activityId: 'act_1', sessionId: 'd1s1', department: 'cs', email: 'p2@christuniversity.in', name: 'F2', status: 'draft', groupLabel: 'Group 1', updatedAt: null },
      { activityId: 'act_1', sessionId: 'd1s1', department: 'cs', email: 'p3@christuniversity.in', name: 'F3', status: 'submitted', groupLabel: 'Group 2', updatedAt: null },
      { activityId: 'act_1', sessionId: 'd1s1', department: 'cs', email: 'p4@christuniversity.in', name: 'F4', status: 'submitted', groupLabel: 'Group 2', updatedAt: null },
    ];

    const groupMap = new Map<string, { total: number; submitted: number; draft: number }>();
    mockProgress.forEach(p => {
      const grp = p.groupLabel || 'Ungrouped';
      const cur = groupMap.get(grp) || { total: 0, submitted: 0, draft: 0 };
      cur.total++;
      if (p.status === 'submitted') cur.submitted++;
      if (p.status === 'draft') cur.draft++;
      groupMap.set(grp, cur);
    });

    const g1 = groupMap.get('Group 1');
    expect(g1).toBeDefined();
    expect(g1?.total).toBe(2);
    expect(g1?.submitted).toBe(1);
    expect(g1?.draft).toBe(1);

    const g2 = groupMap.get('Group 2');
    expect(g2).toBeDefined();
    expect(g2?.total).toBe(2);
    expect(g2?.submitted).toBe(2);
    expect(g2?.draft).toBe(0);
  });

  it('creates valid activityState and auditLog action names', () => {
    const getAuditAction = (enabled: boolean, locked: boolean) => {
      if (!enabled) return 'DISABLE_ACTIVITY';
      return locked ? 'LOCK_ACTIVITY' : 'ENABLE_ACTIVITY';
    };

    expect(getAuditAction(true, false)).toBe('ENABLE_ACTIVITY');
    expect(getAuditAction(true, true)).toBe('LOCK_ACTIVITY');
    expect(getAuditAction(false, false)).toBe('DISABLE_ACTIVITY');
  });
});
