import Papa from 'papaparse';
import {
  Activity,
  ActivityResponse,
  ActivitySummary,
  Session,
  SubmissionProgress,
  RosterUser,
} from '../types';
import {
  computeAttendanceAndCertificates,
  computeRatingScaleItemStats,
  computeRatingScaleSectionStats,
  computeBandCounts,
} from './analytics';

/**
 * Downloads a Blob as a file in the browser.
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export single activity data to CSV.
 * Honors confidentiality and permissions:
 * - Confidential activity: exports summary only (means, SDs, band counts, comments) for HoD/Dean.
 * - Individual rows exported ONLY for non-confidential or for App Admin.
 */
export function exportActivityToCsv(
  activity: Activity,
  responses: ActivityResponse[],
  summary: ActivitySummary | null,
  isConfidential: boolean,
  isAppAdmin: boolean,
  departmentName: string
): void {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${activity.activityId}_${departmentName}_${timestamp}.csv`;

  // Confidential & NOT App Admin -> Export anonymous summary
  if (isConfidential && !isAppAdmin) {
    if (!summary || summary.suppressed) {
      const csv = Papa.unparse([
        {
          Activity: activity.title,
          Department: departmentName,
          Status: 'Suppressed (fewer than 3 responses submitted)',
          Note: 'Confidential ratings appear only when at least 3 faculty respond.',
        },
      ]);
      downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
      return;
    }

    const rows: Record<string, any>[] = [];
    // Band counts
    if (summary.bandCounts) {
      for (const [band, count] of Object.entries(summary.bandCounts)) {
        rows.push({ Category: 'Interpretation Band', Metric: band, Value: count });
      }
    }
    // Item Means & SD
    if (summary.itemStats) {
      for (const [itId, stat] of Object.entries(summary.itemStats)) {
        rows.push({
          Category: 'Item Statistic',
          Metric: itId,
          Mean: stat.mean,
          StandardDeviation: stat.sd,
          Distribution1to5: stat.dist.join(', '),
        });
      }
    }
    // Comments
    if (summary.comments) {
      summary.comments.forEach((c, idx) => {
        rows.push({
          Category: 'Anonymous Reflection/Evidence',
          Metric: `Comment #${idx + 1}`,
          Value: c,
        });
      });
    }

    const csv = Papa.unparse(rows);
    downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
    return;
  }

  // Non-confidential OR App Admin -> Export response rows
  const rows = responses.map((r, idx) => {
    const row: Record<string, any> = {
      'S.No': idx + 1,
      Name: isConfidential && !isAppAdmin ? 'Anonymous' : r.name,
      Email: isConfidential && !isAppAdmin ? 'Anonymous' : r.email,
      Department: r.department,
      Group: r.groupLabel || '',
      Status: r.status,
    };

    // Flatten answers
    const answers = r.answers || {};
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === 'object' && v !== null) {
        row[k] = JSON.stringify(v);
      } else {
        row[k] = v;
      }
    }

    return row;
  });

  const csv = Papa.unparse(rows);
  downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/**
 * Export single activity data to XLSX (Excel).
 * Dynamically imports xlsx to reduce bundle size.
 */
export async function exportActivityToXlsx(
  activity: Activity,
  responses: ActivityResponse[],
  summary: ActivitySummary | null,
  isConfidential: boolean,
  isAppAdmin: boolean,
  departmentName: string
): Promise<void> {
  const XLSX = await import('xlsx');
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${activity.activityId}_${departmentName}_${timestamp}.xlsx`;
  const wb = XLSX.utils.book_new();

  // Confidential & NOT App Admin -> Summary sheet only
  if (isConfidential && !isAppAdmin) {
    if (!summary || summary.suppressed) {
      const wsData = [
        ['Activity', activity.title],
        ['Department', departmentName],
        ['Status', 'Suppressed (fewer than 3 responses submitted)'],
        ['Note', 'Confidential summaries require at least 3 submitted responses.'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    } else {
      const wsData: any[][] = [
        ['Activity Title', activity.title],
        ['Department', departmentName],
        ['Total Responses (N)', summary.n],
        ['Grand Mean', summary.totalStats?.mean ?? '—'],
        ['Grand SD', summary.totalStats?.sd ?? '—'],
        [],
        ['--- Score Interpretation Bands ---'],
        ['Band', 'Count'],
      ];

      if (summary.bandCounts) {
        for (const [b, c] of Object.entries(summary.bandCounts)) {
          wsData.push([b, c]);
        }
      }

      wsData.push([]);
      wsData.push(['--- Item Statistics ---']);
      wsData.push(['Item ID', 'Mean', 'Standard Deviation', 'Score Dist [1, 2, 3, 4, 5]']);

      if (summary.itemStats) {
        for (const [itId, stat] of Object.entries(summary.itemStats)) {
          wsData.push([itId, stat.mean, stat.sd, stat.dist.join(', ')]);
        }
      }

      if (summary.comments && summary.comments.length > 0) {
        wsData.push([]);
        wsData.push(['--- Anonymous Comments (Names Removed & Shuffled) ---']);
        summary.comments.forEach((c, idx) => {
          wsData.push([`#${idx + 1}`, c]);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Department Summary');
    }
  } else {
    // Detailed Responses sheet
    const rows = responses.map((r, idx) => {
      const row: Record<string, any> = {
        'S.No': idx + 1,
        Name: r.name,
        Email: r.email,
        Department: r.department,
        Group: r.groupLabel || '',
        Status: r.status,
      };

      const answers = r.answers || {};
      for (const [k, v] of Object.entries(answers)) {
        if (typeof v === 'object' && v !== null) {
          row[k] = JSON.stringify(v);
        } else {
          row[k] = v;
        }
      }

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Responses');

    // If rating_scale, add a statistics summary sheet as well
    if (activity.widgetType === 'rating_scale' && responses.length > 0) {
      const itemStats = computeRatingScaleItemStats(responses, activity);
      const sectionStats = computeRatingScaleSectionStats(responses, activity);
      const bandCounts = computeBandCounts(responses, activity);

      const statsData: any[][] = [
        ['Metric', 'Value'],
        ['Total Submitted', responses.length],
        [],
        ['Band', 'Count'],
      ];
      for (const [b, c] of Object.entries(bandCounts)) {
        statsData.push([b, c]);
      }
      statsData.push([]);
      statsData.push(['Section ID', 'Mean Score', 'Standard Deviation']);
      for (const [sId, sStat] of Object.entries(sectionStats)) {
        statsData.push([sId, sStat.mean, sStat.sd]);
      }
      statsData.push([]);
      statsData.push(['Item ID', 'Mean', 'Standard Deviation', 'Distribution [1..5]']);
      for (const [itId, stat] of Object.entries(itemStats)) {
        statsData.push([itId, stat.mean, stat.sd, stat.dist.join(', ')]);
      }

      const statsWs = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, statsWs, 'Statistics');
    }
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  );
}

/**
 * Generates the complete 3-sheet QIP Report Pack as XLSX:
 * - Sheet 1: Attendance per session (A participant is present in a session if they submitted at least 1 activity in it, based on progress).
 * - Sheet 2: Participants present in all 12 sessions (the e-certificate list).
 * - Sheet 3: Participation per activity.
 */
export async function exportQipReportPackXlsx(
  progressList: SubmissionProgress[],
  sessions: Session[],
  activities: Activity[],
  roster: RosterUser[],
  scopeLabel: string
): Promise<void> {
  const XLSX = await import('xlsx');
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `QIP_Report_Pack_${scopeLabel}_${timestamp}.xlsx`;

  const { sessionAttendance, certificateRecipients, activityParticipation } =
    computeAttendanceAndCertificates(progressList, sessions, activities, roster);

  const wb = XLSX.utils.book_new();

  // --------------------------------------------------------------------------
  // SHEET 1: Attendance Per Session
  // --------------------------------------------------------------------------
  const sheet1Headers = [
    'S.No',
    'Faculty Name',
    'Email ID',
    'Department',
    ...sessions.map((s) => `${s.sessionId.toUpperCase()} (${s.slot})`),
    'Total Sessions Attended (out of ' + sessions.length + ')',
    'Attendance %',
    'E-Certificate Eligible (100%)',
  ];

  const sheet1Rows: any[][] = [sheet1Headers];

  sessionAttendance.forEach((p, idx) => {
    const row = [
      idx + 1,
      p.name,
      p.email,
      p.department,
      ...sessions.map((s) => (p.attendedSessions[s.sessionId] ? 'P' : 'A')),
      p.totalAttended,
      `${p.attendancePct}%`,
      p.isEligibleForCertificate ? 'YES' : 'NO',
    ];
    sheet1Rows.push(row);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Session Attendance');

  // --------------------------------------------------------------------------
  // SHEET 2: E-Certificate Eligibility (Present in all sessions)
  // --------------------------------------------------------------------------
  const sheet2Headers = [
    'Certificate No',
    'Faculty Name',
    'Email ID',
    'Department',
    'Sessions Completed',
    'Attendance Rate',
    'Status',
  ];

  const sheet2Rows: any[][] = [sheet2Headers];

  certificateRecipients.forEach((p, idx) => {
    sheet2Rows.push([
      `BYC-QIP-2026-${String(idx + 1).padStart(3, '0')}`,
      p.name,
      p.email,
      p.department,
      `${p.totalAttended} / ${sessions.length}`,
      '100%',
      'Eligible for HRDC E-Certificate',
    ]);
  });

  if (certificateRecipients.length === 0) {
    sheet2Rows.push([`No participants have completed all ${sessions.length} sessions yet.`]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  XLSX.utils.book_append_sheet(wb, ws2, 'E-Certificate List');

  // --------------------------------------------------------------------------
  // SHEET 3: Activity Participation
  // --------------------------------------------------------------------------
  const sheet3Headers = [
    'Order',
    'Activity ID',
    'Session',
    'Activity Title',
    'Widget Type',
    'Submitted Count',
    'Draft Count',
    'Not Started Count',
    'Completion %',
  ];

  const sheet3Rows: any[][] = [sheet3Headers];

  activityParticipation.forEach((act) => {
    sheet3Rows.push([
      act.order,
      act.activityId,
      act.sessionId,
      act.title,
      act.widgetType,
      act.submittedCount,
      act.draftCount,
      act.notStartedCount,
      `${act.completionPercentage}%`,
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Activity Participation');

  // Write and trigger download
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  );
}
