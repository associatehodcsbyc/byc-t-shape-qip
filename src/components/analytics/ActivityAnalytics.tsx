import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Activity,
  ActivityResponse,
  ActivitySummary,
  Department,
  RosterUser,
} from '../../types';
import {
  computeRatingScaleItemStats,
  computeRatingScaleSectionStats,
  computeBandCounts,
  computeChoiceMatrixStats,
  computeChecklistStats,
  computePollStats,
  computeRankOrderStats,
  computeCrmMatrixStats,
  BLOOM_LEVELS,
  DOK_LEVELS,
} from '../../utils/analytics';
import { exportActivityToCsv, exportActivityToXlsx } from '../../utils/exports';
import defaultActivities from '../../../seed/activities.json';

interface ActivityAnalyticsProps {
  initialActivityId?: string;
  activitiesList?: Activity[];
  departmentsList?: Department[];
}

export function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const ma = a.sessionId.match(/^d(\d+)s(\d+)/i);
    const mb = b.sessionId.match(/^d(\d+)s(\d+)/i);
    const dayA = ma ? parseInt(ma[1], 10) : 0;
    const dayB = mb ? parseInt(mb[1], 10) : 0;
    if (dayA !== dayB) return dayA - dayB;
    const sessA = ma ? parseInt(ma[2], 10) : 0;
    const sessB = mb ? parseInt(mb[2], 10) : 0;
    if (sessA !== sessB) return sessA - sessB;
    return (a.order || 0) - (b.order || 0);
  });
}

export const ActivityAnalytics: React.FC<ActivityAnalyticsProps> = ({
  initialActivityId,
  activitiesList = [],
  departmentsList = [],
}) => {
  const { rosterUser, isHoDStrict, isCoordinator, isResourcePerson, isAppAdmin } = useAuth();
  const isLockedToDept = isHoDStrict && !isCoordinator && !isResourcePerson && !isAppAdmin;

  const [activities, setActivities] = useState<Activity[]>(() =>
    activitiesList.length > 0 ? sortActivities(activitiesList) : []
  );
  const [departments, setDepartments] = useState<Department[]>(departmentsList);
  const [selectedActId, setSelectedActId] = useState<string>(
    initialActivityId || activitiesList[0]?.activityId || 'd1s1_a1_four_pillars'
  );

  const [selectedDept, setSelectedDept] = useState<string>(
    isLockedToDept ? rosterUser?.department || 'computer-science' : 'all'
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Data states
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [activeTab, setActiveTab] = useState<'charts' | 'responses' | 'comments'>('charts');

  // Load activities and departments if not provided
  useEffect(() => {
    async function loadMeta() {
      if (activities.length === 0) {
        try {
          const aSnap = await getDocs(collection(db, 'activities'));
          if (!aSnap.empty) {
            const list: Activity[] = [];
            aSnap.forEach((d) => list.push(d.data() as Activity));
            const sorted = sortActivities(list);
            setActivities(sorted);
            if (!initialActivityId && sorted[0]) {
              setSelectedActId(sorted[0].activityId);
            }
          } else {
            const sorted = sortActivities(defaultActivities.activities as Activity[]);
            setActivities(sorted);
          }
        } catch {
          const sorted = sortActivities(defaultActivities.activities as Activity[]);
          setActivities(sorted);
        }
      }

      if (departments.length === 0) {
        try {
          const dSnap = await getDocs(collection(db, 'departments'));
          const list: Department[] = [];
          dSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          list.sort((a, b) => a.name.localeCompare(b.name));
          setDepartments(list);
        } catch {
          setDepartments([
            { id: 'computer-science', name: 'Computer Science', campus: 'BYC' },
            { id: 'commerce', name: 'Commerce', campus: 'BYC' },
            { id: 'management', name: 'Management', campus: 'BYC' },
            { id: 'sciences', name: 'Sciences', campus: 'BYC' },
          ]);
        }
      }
    }
    loadMeta();
  }, []);

  // Ensure HoD is strictly locked to own department
  useEffect(() => {
    if (isLockedToDept && rosterUser?.department) {
      setSelectedDept(rosterUser.department);
    }
  }, [isLockedToDept, rosterUser?.department]);

  const sortedActivities = useMemo(() => {
    return sortActivities(activities);
  }, [activities]);

  const currentActivity = useMemo(() => {
    return sortedActivities.find((a) => a.activityId === selectedActId) || sortedActivities[0];
  }, [sortedActivities, selectedActId]);

  const isConfidential = currentActivity?.confidential === true;

  // Fetch responses or summary for the selected activity and department
  // (SPEC §8: Read-cost limit - fetch only on demand/refresh, no onSnapshot)
  const fetchAnalyticsData = async () => {
    if (!currentActivity) return;
    setLoading(true);

    try {
      // 1. Fetch roster participants to calculate participation rates
      let rosterQuery;
      if (selectedDept !== 'all') {
        rosterQuery = query(collection(db, 'roster'), where('department', '==', selectedDept));
      } else {
        rosterQuery = collection(db, 'roster');
      }
      const rSnap = await getDocs(rosterQuery);
      const rList: RosterUser[] = [];
      rSnap.forEach((d) => {
        const u = d.data() as RosterUser;
        if (u.role === 'participant' && u.active !== false) {
          rList.push(u);
        }
      });
      setRoster(rList);

      // 2. If confidential and NOT App Admin -> Read summary document ONLY
      if (isConfidential && !isAppAdmin) {
        setResponses([]);
        if (selectedDept !== 'all') {
          const sumDocId = `${selectedDept}__${currentActivity.activityId}`;
          const sumSnap = await getDoc(doc(db, 'summaries', sumDocId));
          if (sumSnap.exists()) {
            setSummary(sumSnap.data() as ActivitySummary);
          } else {
            setSummary({
              department: selectedDept,
              activityId: currentActivity.activityId,
              n: 0,
              suppressed: true,
              updatedAt: null,
            });
          }
        } else {
          // For all departments view with confidential activities, aggregate published summaries
          const allSumSnap = await getDocs(collection(db, 'summaries'));
          let combinedN = 0;
          allSumSnap.forEach((d) => {
            const sumData = d.data() as ActivitySummary;
            if (sumData.activityId === currentActivity.activityId && !sumData.suppressed) {
              combinedN += sumData.n;
            }
          });
          setSummary({
            department: 'all',
            activityId: currentActivity.activityId,
            n: combinedN,
            suppressed: combinedN < 3,
            updatedAt: null,
          });
        }
      } else {
        // Non-confidential OR App Admin -> Read responses
        let q;
        if (isConfidential && isAppAdmin) {
          // App Admin can read confidential responses
          if (selectedDept !== 'all') {
            q = query(
              collection(db, 'responses'),
              where('department', '==', selectedDept),
              where('activityId', '==', currentActivity.activityId)
            );
          } else {
            q = query(
              collection(db, 'responses'),
              where('activityId', '==', currentActivity.activityId)
            );
          }
        } else {
          // HoD / Dean non-confidential: MUST include where('confidential', '==', false)
          if (selectedDept !== 'all') {
            q = query(
              collection(db, 'responses'),
              where('department', '==', selectedDept),
              where('activityId', '==', currentActivity.activityId),
              where('confidential', '==', false)
            );
          } else {
            q = query(
              collection(db, 'responses'),
              where('activityId', '==', currentActivity.activityId),
              where('confidential', '==', false)
            );
          }
        }

        const respSnap = await getDocs(q);
        const list: ActivityResponse[] = [];
        respSnap.forEach((d) => {
          list.push(d.data() as ActivityResponse);
        });
        setResponses(list);
        setSummary(null);
      }
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedActId, selectedDept]);

  // Filter responses by group if group filter applied
  const filteredResponses = useMemo(() => {
    if (selectedGroup === 'all') return responses;
    return responses.filter((r) => r.groupLabel === selectedGroup);
  }, [responses, selectedGroup]);

  // Extract distinct groups for group filter
  const availableGroups = useMemo(() => {
    const s = new Set<string>();
    responses.forEach((r) => {
      if (r.groupLabel) s.add(r.groupLabel);
    });
    return Array.from(s).sort();
  }, [responses]);

  // Participation counts
  const totalRoster = roster.length;
  const submittedResponses = filteredResponses.filter((r) => r.status === 'submitted');
  const submittedCount = isConfidential && !isAppAdmin ? summary?.n || 0 : submittedResponses.length;
  const draftCount = filteredResponses.filter((r) => r.status === 'draft').length;
  const notStartedCount = Math.max(0, totalRoster - submittedCount - draftCount);
  const participationRate = totalRoster > 0 ? Math.round((submittedCount / totalRoster) * 100) : 0;

  // Helper to give descriptive titles to composite parts
  const getPartTitle = (part: any, idx: number) => {
    if (part.title) return part.title;
    switch (part.widgetType) {
      case 'poll':
        return 'Pillar / Poll Assessment';
      case 'free_text':
        return 'Qualitative Reflection & Justification';
      case 'rating_scale':
        return 'Rating Scale Assessment';
      case 'choice_matrix':
        return 'Categorical Choice Matrix';
      case 'checklist':
        return 'Diagnostic Checklist';
      case 'rank_order':
        return 'Rank Order Prioritization';
      case 'crm_matrix':
        return 'Cognitive Rigour Matrix (CRM)';
      case 'table_entry':
        return 'Structured Data Entries';
      case 'fixed_grid':
        return 'Multi-Dimensional Action Grid';
      case 'working_doc':
        return 'Working Document Carry-Forward';
      default:
        return `Part ${idx + 1}`;
    }
  };

  // 1. Rating Scale Visual
  const renderRatingScale = (subResponses: ActivityResponse[], act: Activity) => {
    let itemStats: Record<string, any> | null = null;
    let sectionStats: Record<string, any> | null = null;
    let bandCounts: Record<string, number> | null = null;

    if (isConfidential && !isAppAdmin && summary && !summary.suppressed) {
      itemStats = summary.itemStats || null;
      sectionStats = summary.sectionStats || null;
      bandCounts = summary.bandCounts || null;
    } else {
      itemStats = computeRatingScaleItemStats(subResponses, act);
      sectionStats = computeRatingScaleSectionStats(subResponses, act);
      bandCounts = computeBandCounts(subResponses, act);
    }

    const sortedItems = itemStats
      ? Object.entries(itemStats)
          .map(([id, stat]) => ({ id, mean: stat.mean, sd: stat.sd }))
          .sort((a, b) => b.mean - a.mean)
      : [];
    const strongest = sortedItems.slice(0, 5);
    const weakest = [...sortedItems].reverse().slice(0, 5);

    return (
      <div className="space-y-6">
        {bandCounts && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
              Distribution Across Score Interpretation Bands
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(bandCounts).map(([bandLabel, count]) => {
                const pct =
                  submittedCount > 0 ? Math.round((count / submittedCount) * 100) : 0;
                return (
                  <div
                    key={bandLabel}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center"
                  >
                    <div className="text-xs font-bold text-slate-700 truncate">{bandLabel}</div>
                    <div className="text-3xl font-black text-indigo-900 mt-1 font-mono">{count}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">{pct}% of faculty</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {strongest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
                <span>🌟 5 Highest Rated Items (Strengths)</span>
              </h3>
              <div className="space-y-2.5">
                {strongest.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-emerald-950 truncate max-w-[70%]">
                      #{idx + 1}. {item.id}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-emerald-700 font-mono text-sm">{item.mean}</span>
                      <span className="text-[10px] text-emerald-600 block">±{item.sd} SD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 mb-3 flex items-center gap-1.5">
                <span>⚠️ 5 Lowest Rated Items (Areas for Growth)</span>
              </h3>
              <div className="space-y-2.5">
                {weakest.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-amber-950 truncate max-w-[70%]">
                      #{idx + 1}. {item.id}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-amber-700 font-mono text-sm">{item.mean}</span>
                      <span className="text-[10px] text-amber-600 block">±{item.sd} SD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {sectionStats && Object.keys(sectionStats).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
              Section Mean Subtotals
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(sectionStats).map(([sId, stat]) => (
                <div key={sId} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="font-bold text-xs text-slate-800 block truncate">{sId}</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-black text-slate-900 font-mono">{stat.mean}</span>
                    <span className="text-xs text-slate-500 font-mono">SD: ±{stat.sd}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 2. CRM Matrix Visual
  const renderCrmMatrix = (subResponses: ActivityResponse[]) => {
    const crmStats = computeCrmMatrixStats(subResponses);
    if (!crmStats) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Cognitive Rigour Matrix (CRM) Department Heat Map
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Bloom’s Revised Taxonomy (6 rows) × Webb’s Depth of Knowledge (4 columns). Shows count of syllabus items placed in each cell.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Items Placed</span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">{crmStats.totalItems}</div>
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-700 uppercase">DOK 1 & 2 (Foundation)</span>
            <div className="text-2xl font-black text-blue-700 font-mono mt-1">
              {crmStats.dok1_2Count} ({crmStats.dok1_2Percentage}%)
            </div>
          </div>
          <div>
            <span className="text-[11px] font-bold text-purple-700 uppercase">DOK 3 & 4 (Deep Rigour)</span>
            <div className="text-2xl font-black text-purple-700 font-mono mt-1">
              {crmStats.dok3_4Count} ({crmStats.dok3_4Percentage}%)
            </div>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase">Rigour Ratio (DOK 3+4 : Total)</span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
              {crmStats.dok3_4Percentage}%
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-center text-xs">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3 text-left">Bloom Level</th>
                {DOK_LEVELS.map((d) => (
                  <th key={d} className="px-4 py-3">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {BLOOM_LEVELS.map((b) => (
                <tr key={b} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-left font-bold text-slate-900 bg-slate-50">{b}</td>
                  {DOK_LEVELS.map((d) => {
                    const count = crmStats.heatMap[b]?.[d] || 0;
                    return (
                      <td
                        key={d}
                        className={`px-4 py-3 font-mono font-bold text-sm ${
                          count > 5
                            ? 'bg-purple-600 text-white'
                            : count > 2
                            ? 'bg-purple-200 text-purple-900'
                            : count > 0
                            ? 'bg-purple-50 text-purple-800'
                            : 'text-slate-300'
                        }`}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 3. Rank Order Visual
  const renderRankOrder = (subResponses: ActivityResponse[], act: Activity) => {
    const stats = computeRankOrderStats(subResponses, act);
    if (!stats || stats.length === 0) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          Mean Rank Order (Sorted from Most to Least Preferred)
        </h3>
        <div className="space-y-2">
          {stats.map((item, idx) => (
            <div
              key={item.id}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                  {idx + 1}
                </span>
                <span className="font-semibold text-slate-800">{item.text}</span>
              </div>
              <span className="font-bold font-mono text-purple-700 text-sm">
                Avg Rank: {item.meanRank}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 4. Choice Matrix Visual
  const renderChoiceMatrix = (subResponses: ActivityResponse[], act: Activity) => {
    const stats = computeChoiceMatrixStats(subResponses, act);
    if (!stats || stats.length === 0) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Choice Matrix Response Distribution</h3>
        <div className="space-y-4">
          {stats.map((item) => (
            <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="font-bold text-xs text-slate-900 block mb-2">{item.text}</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(item.counts).map(([opt, cnt]) => (
                  <div key={opt} className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="text-[11px] font-semibold text-slate-600 block truncate">{opt}</span>
                    <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">{cnt}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {item.percentages[opt]}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 5. Checklist Visual
  const renderChecklist = (subResponses: ActivityResponse[], act: Activity) => {
    const stats = computeChecklistStats(subResponses, act);
    if (!stats) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Checklist Selection Frequency</h3>
        <div className="space-y-2.5">
          {stats.options.map((opt) => (
            <div key={opt.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-slate-800">{opt.text}</span>
                <span className="font-bold text-slate-900 font-mono">
                  {opt.count} ({opt.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${opt.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
        {stats.otherResponses && stats.otherResponses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 mb-2">Other Responses Specified:</h4>
            <div className="space-y-1.5">
              {stats.otherResponses.map((other, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded-lg text-xs text-slate-700">
                  • {other}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 6. Poll Visual
  const renderPoll = (subResponses: ActivityResponse[], act: Activity) => {
    const stats = computePollStats(subResponses, act);
    if (!stats || stats.length === 0) {
      return (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
          No poll responses or options available to display.
        </div>
      );
    }
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {stats.map((q) => (
          <div key={q.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">{q.prompt}</h4>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {q.totalVotes} vote{q.totalVotes === 1 ? '' : 's'} recorded
              </span>
            </div>
            <div className="space-y-2">
              {q.options.map((opt) => (
                <div key={opt.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-semibold text-slate-800">{opt.text}</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">
                      {opt.count} ({opt.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${opt.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 7. Free Text Visual
  const renderFreeText = (subResponses: ActivityResponse[], act: Activity) => {
    let questions = act.config?.questions || [];
    if (questions.length === 0 && act.config?.prompt) {
      questions = [{ id: 'default', prompt: act.config.prompt }];
    }
    if (questions.length === 0) {
      questions = [{ id: 'default', prompt: act.instructions || act.title || 'Written Faculty Submissions' }];
    }

    return (
      <div className="space-y-6">
        {questions.map((q: any, idx: number) => {
          const entries = subResponses
            .map((r) => {
              const text =
                typeof r.answers?.[q.id] === 'string'
                  ? r.answers[q.id]
                  : typeof r.answers === 'string'
                  ? r.answers
                  : typeof r.answers?.text === 'string'
                  ? r.answers.text
                  : '';
              return {
                name: r.name || 'Anonymous Faculty',
                group: r.groupLabel,
                text: text.trim(),
              };
            })
            .filter((item) => item.text.length > 0);

          return (
            <div key={q.id || idx} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span>{q.prompt}</span>
                </h4>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  {entries.length} reflections recorded
                </span>
              </div>

              {entries.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 text-center">
                  No text reflections submitted yet for this prompt.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {entries.map((item, eIdx) => (
                    <div
                      key={eIdx}
                      className="p-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl space-y-2 transition shadow-2xs"
                    >
                      <p className="text-xs text-slate-800 leading-relaxed italic whitespace-pre-wrap">
                        "{item.text}"
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 font-medium">
                        <span className="font-semibold text-slate-700">
                          {isConfidential && !isAppAdmin ? 'Anonymous Faculty' : item.name}
                        </span>
                        {item.group && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                            {item.group}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 8. Table Entry Visual
  const renderTableEntry = (subResponses: ActivityResponse[], act: Activity) => {
    const columns = act.config?.columns || [];
    const allRows: Array<{ name: string; group?: string; row: Record<string, any> }> = [];

    subResponses.forEach((r) => {
      const rows = Array.isArray(r.answers?.rows) ? r.answers.rows : [];
      rows.forEach((row: any) => {
        if (row && typeof row === 'object') {
          allRows.push({
            name: r.name || 'Anonymous Faculty',
            group: r.groupLabel,
            row,
          });
        }
      });
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500 font-medium">
            Total entries logged across faculty: <strong className="text-slate-800 font-bold">{allRows.length}</strong>
          </div>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
            {columns.length} columns configured
          </span>
        </div>

        {allRows.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 text-center">
            No table entries logged yet.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 w-12">#</th>
                  {(!isConfidential || isAppAdmin) && <th className="px-3 py-2.5">Faculty</th>}
                  {columns.map((col: any) => (
                    <th key={col.id} className="px-3 py-2.5">
                      {col.label || col.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {allRows.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    {(!isConfidential || isAppAdmin) && (
                      <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                        {entry.name}
                        {entry.group && (
                          <span className="ml-1.5 px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[9px] rounded font-bold">
                            {entry.group}
                          </span>
                        )}
                      </td>
                    )}
                    {columns.map((col: any) => (
                      <td key={col.id} className="px-3 py-2 text-slate-800">
                        {entry.row[col.id] !== undefined ? String(entry.row[col.id]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // 9. Fixed Grid Visual
  const renderFixedGrid = (subResponses: ActivityResponse[], act: Activity) => {
    const rows = act.config?.rows || [];
    const columns = act.config?.columns || [];

    let totalCellsFilled = 0;
    subResponses.forEach((r) => {
      const cells = r.answers?.cells || {};
      Object.values(cells).forEach((v) => {
        if (typeof v === 'string' && v.trim().length > 0) totalCellsFilled++;
      });
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500 font-medium">
            Dimensions: <strong className="text-slate-800">{rows.length} rows × {columns.length} columns</strong>
          </div>
          <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
            {totalCellsFilled} total cell inputs recorded
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
          <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
              <tr>
                <th className="px-3 py-2.5 w-1/4">Dimension</th>
                {columns.map((col: string, cIdx: number) => (
                  <th key={cIdx} className="px-3 py-2.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((rowLabel: string, rIdx: number) => (
                <tr key={rIdx} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 font-bold text-slate-900 bg-slate-50">
                    {rowLabel}
                  </td>
                  {columns.map((_col: string, cIdx: number) => {
                    const cellKey = `${rIdx}_${cIdx}`;
                    const cellEntries = subResponses
                      .map((r) => ({ name: r.name, text: r.answers?.cells?.[cellKey] }))
                      .filter((x) => typeof x.text === 'string' && x.text.trim().length > 0);

                    return (
                      <td key={cIdx} className="px-3 py-2.5 text-slate-700 align-top">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200 mb-1">
                          {cellEntries.length} responses
                        </span>
                        {cellEntries.length > 0 && (
                          <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-slate-600">
                            {cellEntries.slice(0, 3).map((e, idx) => (
                              <div key={idx} className="truncate" title={e.text}>
                                • {e.text}
                              </div>
                            ))}
                            {cellEntries.length > 3 && (
                              <div className="text-[10px] text-slate-400 font-semibold">
                                +{cellEntries.length - 3} more...
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 10. Working Doc Visual
  const renderWorkingDoc = (subResponses: ActivityResponse[], act: Activity) => {
    const fields = act.config?.fields || [];
    if (fields.length === 0) {
      return (
        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
          No fields configured for this working document.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field: any) => {
            const filledEntries = subResponses
              .map((r) => ({
                name: r.name || 'Anonymous Faculty',
                group: r.groupLabel,
                val: r.answers?.[field.key],
              }))
              .filter((x) => typeof x.val === 'string' && x.val.trim().length > 0);

            const completionPct =
              submittedResponses.length > 0
                ? Math.round((filledEntries.length / submittedResponses.length) * 100)
                : 0;

            return (
              <div
                key={field.key}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h5 className="text-xs font-bold text-slate-900 leading-snug">{field.label || field.key}</h5>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {completionPct}% filled
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {filledEntries.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">No entries submitted yet.</div>
                  ) : (
                    filledEntries.slice(0, 5).map((e, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <div className="text-slate-800 line-clamp-3">{e.val}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-1">
                          — {isConfidential && !isAppAdmin ? 'Anonymous Faculty' : e.name}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Dispatcher for any widget
  const renderWidgetVisual = (subResponses: ActivityResponse[], act: Activity): React.ReactNode => {
    switch (act.widgetType) {
      case 'rating_scale':
        return renderRatingScale(subResponses, act);
      case 'crm_matrix':
        return renderCrmMatrix(subResponses);
      case 'rank_order':
        return renderRankOrder(subResponses, act);
      case 'choice_matrix':
        return renderChoiceMatrix(subResponses, act);
      case 'checklist':
        return renderChecklist(subResponses, act);
      case 'poll':
        return renderPoll(subResponses, act);
      case 'free_text':
        return renderFreeText(subResponses, act);
      case 'table_entry':
        return renderTableEntry(subResponses, act);
      case 'fixed_grid':
        return renderFixedGrid(subResponses, act);
      case 'working_doc':
        return renderWorkingDoc(subResponses, act);
      default:
        return (
          <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
            Visual metrics not available for widget type: {act.widgetType}
          </div>
        );
    }
  };

  // Current scope label for exports
  const currentDeptObj = departments.find((d) => d.id === selectedDept);
  const scopeLabel = selectedDept === 'all' ? 'All-Departments' : currentDeptObj?.name || selectedDept;

  return (
    <div className="space-y-6" id="activity-analytics-root">
      {/* Top Header & Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-200">
              Activity Analytics & Insights
            </span>
            {isConfidential && (
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                🔒 Confidential Perception Activity
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            {currentActivity
              ? `${currentActivity.sessionId.toUpperCase()}A${currentActivity.order}-${currentActivity.title}`
              : 'Activity Analysis'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Raw answers are dynamically recomputed on demand. Showing responses for{' '}
            <strong className="text-slate-800">{scopeLabel}</strong>.
          </p>
        </div>

        {/* Action Buttons: Refresh, CSV, XLSX */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            id="analytics-refresh-btn"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition shadow-sm flex items-center gap-1.5"
            title="Reload analysis data (Read-cost limit: loads on demand)"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <button
            onClick={() =>
              exportActivityToCsv(
                currentActivity,
                filteredResponses,
                summary,
                isConfidential,
                isAppAdmin,
                scopeLabel
              )
            }
            id="export-csv-btn"
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 transition shadow-sm flex items-center gap-1.5"
          >
            Export CSV
          </button>

          <button
            onClick={() =>
              exportActivityToXlsx(
                currentActivity,
                filteredResponses,
                summary,
                isConfidential,
                isAppAdmin,
                scopeLabel
              )
            }
            id="export-xlsx-btn"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Selectors Bar: Activity, Department, Group */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Activity Selector */}
        <div className="flex-1 min-w-[240px]">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Choose Activity
          </label>
          <select
            value={selectedActId}
            onChange={(e) => setSelectedActId(e.target.value)}
            id="analytics-activity-selector"
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {sortedActivities.map((act) => {
              const prefix = `${act.sessionId.toUpperCase()}A${act.order}`;
              return (
                <option key={act.activityId} value={act.activityId}>
                  {prefix}-{act.title}
                </option>
              );
            })}
          </select>
        </div>

        {/* Department Selector */}
        <div className="min-w-[180px]">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Department Scope
          </label>
          {isLockedToDept ? (
            <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs font-bold text-purple-900">
              {currentDeptObj?.name || rosterUser?.department}
            </div>
          ) : (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              id="analytics-department-selector"
              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Departments (Campus-wide)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Group Filter */}
        {availableGroups.length > 0 && (
          <div className="min-w-[140px]">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Filter by Group
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              id="analytics-group-selector"
              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Groups</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Participation Rate Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Target Roster</span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalRoster}</div>
          <span className="text-[11px] text-slate-400">Registered faculty</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-800 uppercase">Submitted ({participationRate}%)</span>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">{submittedCount}</div>
          <span className="text-[11px] text-emerald-600">Completed responses</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-800 uppercase">In Progress / Draft</span>
          <div className="text-2xl font-black text-amber-700 mt-1 font-mono">{draftCount}</div>
          <span className="text-[11px] text-amber-600">Drafts recorded</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Not Started</span>
          <div className="text-2xl font-black text-slate-600 mt-1 font-mono">{notStartedCount}</div>
          <span className="text-[11px] text-slate-400">Pending</span>
        </div>
      </div>

      {/* Confidential Activity Notice & Suppression Guard (SPEC §8A) */}
      {isConfidential && !isAppAdmin && summary?.suppressed && (
        <div
          id="confidential-suppressed-notice"
          className="p-8 rounded-2xl bg-amber-50 border-2 border-amber-300 text-center space-y-3 shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-2xl mx-auto">
            🔒
          </div>
          <h3 className="text-lg font-bold text-amber-900">Department Summary Suppressed</h3>
          <p className="text-sm text-amber-800 max-w-lg mx-auto">
            Summary appears when at least 3 colleagues have responded.
          </p>
          <p className="text-xs text-amber-700 font-mono">
            Currently submitted: {summary.n} / 3 minimum required responses.
          </p>
        </div>
      )}

      {/* Main Analytics Display */}
      {(!isConfidential || isAppAdmin || (summary && !summary.suppressed)) && (
        <div className="space-y-6">
          {/* Navigation View Tabs (Charts / Raw Responses / Shuffled Comments) */}
          <div className="border-b border-slate-200">
            <nav className="flex space-x-6 text-xs font-bold">
              <button
                onClick={() => setActiveTab('charts')}
                className={`py-2.5 border-b-2 transition ${
                  activeTab === 'charts'
                    ? 'border-christ-navy text-christ-navy'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                📊 Visual Metrics & Breakdown
              </button>

              {(!isConfidential || isAppAdmin) && (
                <button
                  onClick={() => setActiveTab('responses')}
                  className={`py-2.5 border-b-2 transition ${
                    activeTab === 'responses'
                      ? 'border-christ-navy text-christ-navy'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📝 Submissions List ({filteredResponses.length})
                </button>
              )}

              {isConfidential && summary?.comments && summary.comments.length > 0 && (
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`py-2.5 border-b-2 transition ${
                    activeTab === 'comments'
                      ? 'border-christ-navy text-christ-navy'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  💬 Shuffled Anonymous Reflections ({summary.comments.length})
                </button>
              )}
            </nav>
          </div>

          {/* VIEW: Charts & Visual Breakdown */}
          {activeTab === 'charts' && (
            <div className="space-y-6">
              {/* If no submissions recorded yet and no summary, show clean empty state */}
              {submittedCount === 0 && (!summary || !summary.n) ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto">
                    📊
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">No Submissions Recorded Yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Visual metrics, charts, and breakdown distributions will automatically appear here once faculty submit their responses.
                  </p>
                </div>
              ) : currentActivity?.widgetType === 'composite' ? (
                /* Composite Activity: Render each part with a distinct section header and appropriate visual */
                <div className="space-y-8">
                  {(currentActivity.config?.parts || []).map((part: any, idx: number) => {
                    const subActivity: Activity = {
                      ...currentActivity,
                      widgetType: part.widgetType,
                      config: part.config || {},
                    };
                    const subResponses: ActivityResponse[] = submittedResponses.map((r) => ({
                      ...r,
                      answers: r.answers?.[part.id] !== undefined ? r.answers[part.id] : r.answers,
                    }));

                    return (
                      <div
                        key={part.id || idx}
                        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
                      >
                        <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                              Part {idx + 1} • {part.widgetType?.replace('_', ' ').toUpperCase()}
                            </span>
                            <h4 className="text-sm font-black text-slate-900">
                              {getPartTitle(part, idx)}
                            </h4>
                          </div>
                          {part.description && (
                            <p className="text-xs text-slate-500 w-full mt-1">{part.description}</p>
                          )}
                        </div>
                        {renderWidgetVisual(subResponses, subActivity)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Standalone Activity: Dispatch to appropriate widget visual */
                renderWidgetVisual(submittedResponses, currentActivity)
              )}
            </div>
          )}

          {/* VIEW: Submissions Table */}
          {activeTab === 'responses' && (!isConfidential || isAppAdmin) && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Faculty Submissions ({filteredResponses.length})
                </h3>
                <input
                  type="text"
                  placeholder="Search respondent..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-3 py-1.5"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Faculty Name</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Group</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredResponses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No submissions recorded yet for this activity.
                        </td>
                      </tr>
                    ) : (
                      filteredResponses
                        .filter(
                          (r) =>
                            !searchFilter.trim() ||
                            r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                            r.email.toLowerCase().includes(searchFilter.toLowerCase())
                        )
                        .map((r) => (
                          <tr key={r.email} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{r.name}</div>
                              <div className="font-mono text-[11px] text-slate-400">{r.email}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{r.department}</td>
                            <td className="px-4 py-3 text-slate-700">{r.groupLabel || '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                                  r.status === 'submitted'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                              {r.submittedAt?.toDate
                                ? r.submittedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: Anonymous Shuffled Comments (Confidential activities) */}
          {activeTab === 'comments' && summary?.comments && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Anonymous Faculty Reflections & Evidence (Names Removed & Order Shuffled)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.comments.map((comment, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed">
                    <span className="text-[10px] font-bold uppercase text-purple-700 block mb-1">
                      Comment #{idx + 1}
                    </span>
                    &ldquo;{comment}&rdquo;
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
