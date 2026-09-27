import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Activity, ActivityResponse, ActivitySummary, Department } from '../../types';
import {
  CONFIDENTIAL_ACTIVITY_IDS,
  publishDepartmentSummary,
  fetchPublishedSummaries,
  subscribeToConfidentialResponses,
} from '../../services/summaryPublisher';
import defaultActivities from '../../../seed/activities.json';

export const SummaryPublisher: React.FC = () => {
  const { isAppAdmin } = useAuth();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [confidentialResponses, setConfidentialResponses] = useState<ActivityResponse[]>([]);
  const [publishedSummaries, setPublishedSummaries] = useState<Map<string, ActivitySummary>>(new Map());
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lastAutoRun, setLastAutoRun] = useState<Date | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch departments and activities
  useEffect(() => {
    async function loadData() {
      try {
        const dSnap = await getDocs(collection(db, 'departments'));
        const dList: Department[] = [];
        dSnap.forEach((d) => dList.push({ id: d.id, ...(d.data() as any) }));
        dList.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(dList);

        const aSnap = await getDocs(collection(db, 'activities'));
        if (!aSnap.empty) {
          const aList: Activity[] = [];
          aSnap.forEach((d) => aList.push(d.data() as Activity));
          setActivities(aList);
        } else {
          setActivities(defaultActivities.activities as Activity[]);
        }

        const summaries = await fetchPublishedSummaries();
        setPublishedSummaries(summaries);
      } catch (err) {
        console.error('Error loading summary publisher data:', err);
      }
    }
    loadData();
  }, []);

  // Filter down to the 5 confidential activities
  const confidentialActivities = useMemo(() => {
    return activities.filter((a) =>
      CONFIDENTIAL_ACTIVITY_IDS.includes(a.activityId as any)
    );
  }, [activities]);

  // 2. Real-time subscription to confidential responses (App Admin only)
  useEffect(() => {
    if (!isAppAdmin) return;

    const unsub = subscribeToConfidentialResponses((responses) => {
      setConfidentialResponses(responses);
    });

    return () => unsub();
  }, [isAppAdmin]);

  // 3. Debounced Auto-Publish every 60 seconds
  useEffect(() => {
    if (!isAppAdmin || departments.length === 0 || confidentialActivities.length === 0) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await handlePublishAll(true);
        setLastAutoRun(new Date());
      } catch (err) {
        console.error('Auto-publish failed:', err);
      }
    }, 60000); // 60 seconds

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [confidentialResponses, departments, confidentialActivities, isAppAdmin]);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Publish a single department + activity summary
  const handlePublishOne = async (deptId: string, activity: Activity) => {
    const key = `${deptId}__${activity.activityId}`;
    setPublishingKey(key);

    try {
      const relevantResponses = confidentialResponses.filter(
        (r) => r.department === deptId && r.activityId === activity.activityId
      );

      const summary = await publishDepartmentSummary(deptId, activity, relevantResponses);

      setPublishedSummaries((prev) => {
        const next = new Map(prev);
        next.set(key, summary);
        return next;
      });

      const note = summary.suppressed
        ? `Published as suppressed (N=${summary.n} < 3).`
        : `Published statistics & anonymous comments for N=${summary.n} responses.`;
      notify(`Summary updated for ${activity.title} (${deptId}). ${note}`, 'success');
    } catch (err: any) {
      console.error('Publish error:', err);
      notify(`Failed to publish: ${err.message}`, 'error');
    } finally {
      setPublishingKey(null);
    }
  };

  // Publish all combinations
  const handlePublishAll = async (isAuto = false) => {
    setPublishingKey('all');
    let publishedCount = 0;

    try {
      for (const dept of departments) {
        for (const act of confidentialActivities) {
          const relevant = confidentialResponses.filter(
            (r) => r.department === dept.id && r.activityId === act.activityId
          );
          const summary = await publishDepartmentSummary(dept.id, act, relevant);
          const key = `${dept.id}__${act.activityId}`;
          setPublishedSummaries((prev) => {
            const next = new Map(prev);
            next.set(key, summary);
            return next;
          });
          publishedCount++;
        }
      }

      if (!isAuto) {
        notify(`Successfully published summaries for all ${publishedCount} department & activity targets.`, 'success');
      }
    } catch (err: any) {
      console.error('Batch publish error:', err);
      if (!isAuto) {
        notify(`Batch publish error: ${err.message}`, 'error');
      }
    } finally {
      setPublishingKey(null);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Never';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' (' + d.toLocaleDateString() + ')';
    } catch {
      return 'Never';
    }
  };

  if (!isAppAdmin) {
    return (
      <div className="p-6 bg-red-50 text-red-800 rounded-xl border border-red-200">
        Access Denied: Only App Admin can publish confidential department summaries.
      </div>
    );
  }

  return (
    <div className="space-y-6" id="summary-publisher-root">
      {/* Informative Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-purple-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
              App Admin Console
            </span>
            <span className="text-xs text-purple-200">
              SPEC §8A • Confidential Department Perception Ratings
            </span>
          </div>
          <h2 className="text-2xl font-black mt-2 tracking-tight">
            Summary Publisher for Confidential Activities
          </h2>
          <p className="text-sm text-purple-200 mt-1 max-w-2xl">
            Recomputes anonymous department statistics (means, SDs, score distributions, and shuffled comments) for the 5 confidential rating activities. If $N &lt; 3$, results are automatically suppressed to protect faculty anonymity.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            onClick={() => handlePublishAll(false)}
            disabled={publishingKey !== null}
            id="publish-all-summaries-btn"
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {publishingKey === 'all' ? 'Publishing All...' : '⚡ Publish All Now'}
          </button>
        </div>
      </div>

      {/* Auto-Publish Listener Status Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">Live Listener Active:</span>
          <span>
            Listening to incoming confidential submissions. Debounced auto-publish triggers every 60 seconds while this page is open.
          </span>
        </div>
        {lastAutoRun && (
          <span className="text-amber-700 font-mono">
            Last auto-run: {lastAutoRun.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between shadow-sm animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Activities Summary Grid / Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Confidential Department Summaries ({confidentialActivities.length} Activities × {departments.length} Departments)
          </h3>
          <span className="text-xs text-slate-500">
            Total Confidential Submissions: <strong>{confidentialResponses.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th scope="col" className="px-5 py-3.5">Activity</th>
                <th scope="col" className="px-5 py-3.5">Department</th>
                <th scope="col" className="px-5 py-3.5 text-center">Submissions (N)</th>
                <th scope="col" className="px-5 py-3.5">Published Status</th>
                <th scope="col" className="px-5 py-3.5">Last Published</th>
                <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {departments.length === 0 || confidentialActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Loading departments and confidential activities...
                  </td>
                </tr>
              ) : (
                departments.flatMap((dept) =>
                  confidentialActivities.map((act) => {
                    const key = `${dept.id}__${act.activityId}`;
                    const summary = publishedSummaries.get(key);
                    const relevantCount = confidentialResponses.filter(
                      (r) => r.department === dept.id && r.activityId === act.activityId
                    ).length;

                    const isBusy = publishingKey === key || publishingKey === 'all';

                    return (
                      <tr key={key} className="hover:bg-slate-50/80 transition" id={`row-${key}`}>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{act.title}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            Act {act.order} • {act.activityId}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 font-semibold text-slate-700">
                          {dept.name}
                        </td>

                        <td className="px-5 py-3.5 text-center font-mono font-bold text-sm">
                          <span
                            className={`px-2.5 py-1 rounded-full ${
                              relevantCount >= 5
                                ? 'bg-emerald-100 text-emerald-800'
                                : relevantCount > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {relevantCount}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          {!summary ? (
                            <span className="text-slate-400 italic">Not published yet</span>
                          ) : summary.suppressed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              🔒 Suppressed (N &lt; 3)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ Published (N={summary.n})
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                          {summary ? formatTimestamp(summary.updatedAt) : 'Never'}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handlePublishOne(dept.id, act)}
                            disabled={isBusy}
                            id={`btn-publish-${key}`}
                            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
                          >
                            {isBusy ? 'Publishing...' : 'Publish Now'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
