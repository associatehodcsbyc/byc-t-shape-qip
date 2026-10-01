import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Session, Activity, ActivityState, SubmissionProgress } from '../types';
import {
  getCachedSessions,
  getCachedActivities,
  loadContentWithRevalidation,
} from '../services/content';
import { subscribeToDepartmentActivityStates } from '../services/activityState';
import { isMatchingDepartment } from '../utils/department';
import { getMyFeedback } from '../data/feedback';

export const ParticipantLanding: React.FC = () => {
  const { user, rosterUser } = useAuth();
  const navigate = useNavigate();

  const userDept = rosterUser?.department || '';
  const emailLower = user?.email?.toLowerCase().trim() || '';

  const [activeDay, setActiveDay] = useState<1 | 2 | 3 | 'all'>(1);
  const [sessions, setSessions] = useState<Session[]>(() => getCachedSessions());
  const [activities, setActivities] = useState<Activity[]>(() => getCachedActivities());
  const [activityStates, setActivityStates] = useState<Map<string, ActivityState>>(new Map());
  const [userProgress, setUserProgress] = useState<Map<string, SubmissionProgress>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'not_started' | 'draft' | 'submitted'>('not_started');

  useEffect(() => {
    async function checkFeedback() {
      try {
        const fb = await getMyFeedback();
        if (fb) {
          setFeedbackStatus(fb.status || 'draft');
        }
      } catch (err) {
        console.error('Check feedback error:', err);
      }
    }
    checkFeedback();
  }, [emailLower]);

  // 1. Instant cache with background revalidation
  useEffect(() => {
    loadContentWithRevalidation((updatedSess, updatedActs) => {
      setSessions(updatedSess);
      setActivities(updatedActs);
    });
  }, []);

  // 2. Listen LIVE to activityState for current department (fuzzy/flexible matching across all aliases)
  useEffect(() => {
    if (!userDept) return;

    const unsub = subscribeToDepartmentActivityStates(
      userDept,
      (stateMap) => {
        setActivityStates(stateMap);
      },
      (err) => {
        console.warn('ParticipantLanding activityState error:', err);
      }
    );

    return () => unsub();
  }, [userDept]);

  // 3. Listen LIVE to progress for current user
  useEffect(() => {
    if (!emailLower) return;

    const q = query(
      collection(db, 'progress'),
      where('email', '==', emailLower)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const progMap = new Map<string, SubmissionProgress>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as SubmissionProgress;
          progMap.set(data.activityId, data);
        });
        setUserProgress(progMap);
      },
      (err) => {
        console.warn('ParticipantLanding progress listener warning:', err);
      }
    );

    return () => unsub();
  }, [emailLower]);

  // Find currently open/live activities for this participant
  const liveActivities = React.useMemo(() => {
    const list: {
      activity: Activity;
      session: Session;
      state: ActivityState;
    }[] = [];

    for (const act of activities) {
      const st = activityStates.get(act.activityId);
      if (st?.enabled === true && !st.locked) {
        const sess = sessions.find((s) => s.sessionId === act.sessionId);
        if (sess) {
          list.push({ activity: act, session: sess, state: st });
        }
      }
    }

    return list.sort((a, b) => a.activity.order - b.activity.order);
  }, [activities, activityStates, sessions]);

  // Live activity counts per day
  const liveCountByDay = React.useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const item of liveActivities) {
      if (item.session.day >= 1 && item.session.day <= 3) {
        counts[item.session.day] = (counts[item.session.day] || 0) + 1;
      }
    }
    return counts;
  }, [liveActivities]);

  // Filter sessions by active day
  const displayedSessions = activeDay === 'all'
    ? sessions
    : sessions.filter((s) => s.day === activeDay);

  const handleManualRefresh = async () => {
    if (!userDept) return;
    setIsRefreshing(true);
    try {
      const snap = await getDocs(collection(db, 'activityState'));
      const deptSpecificMap = new Map<string, ActivityState>();
      const allFallbackMap = new Map<string, ActivityState>();

      snap.forEach((d) => {
        const data = d.data() as ActivityState;
        if (!data || !data.activityId) return;

        if (data.department === 'all') {
          allFallbackMap.set(data.activityId, data);
        } else if (isMatchingDepartment(data.department, userDept)) {
          const existing = deptSpecificMap.get(data.activityId);
          if (!existing) {
            deptSpecificMap.set(data.activityId, data);
          } else {
            const existingTime = (existing as any).updatedAt?.toMillis?.() || 0;
            const newTime = (data as any).updatedAt?.toMillis?.() || 0;
            if (newTime >= existingTime) {
              deptSpecificMap.set(data.activityId, data);
            }
          }
        }
      });

      const stateMap = new Map<string, ActivityState>();
      allFallbackMap.forEach((val, actId) => stateMap.set(actId, val));
      deptSpecificMap.forEach((val, actId) => stateMap.set(actId, val));

      setActivityStates(stateMap);
    } catch (err) {
      console.error('Manual refresh error:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Participant Portal
              </span>
              <span className="text-xs font-mono text-slate-500">
                Dept: <strong className="text-slate-800">{rosterUser?.department}</strong>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              Welcome, {rosterUser?.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Select an enabled activity below to complete your worksheets. Progress autosaves continuously.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              id="btn-refresh-activities"
              className="px-3.5 py-2 text-xs font-semibold text-christ-navy bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              title="Check for newly enabled activities"
            >
              <span className={isRefreshing ? 'animate-spin inline-block' : ''}>🔄</span>
              <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
            </button>
            <button
              onClick={() => alert('Working Document view is available in Day 2-3.')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm"
            >
              📄 Working Document
            </button>
          </div>
        </div>

        {/* Closing Programme Feedback Callout Card */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500 text-slate-900 rounded text-[10px] font-extrabold uppercase tracking-wide">
                Mandatory HRDC Submission
              </span>
              <span className="text-xs font-semibold text-amber-950">
                Programme Concluded 30 Sept 2026
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Closing Programme Feedback (8–10 mins)
            </h3>
            <p className="text-xs text-slate-600 max-w-2xl">
              Please share your valuable evaluation of T-Shaped Learning, curriculum rigour, and session delivery.
            </p>
          </div>

          <button
            onClick={() => navigate('/feedback')}
            id="btn-open-feedback"
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm shrink-0 flex items-center gap-2 ${
              feedbackStatus === 'submitted'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
            }`}
          >
            {feedbackStatus === 'submitted' ? (
              <>
                <span>✅</span> View Submitted Feedback
              </>
            ) : feedbackStatus === 'draft' ? (
              <>
                <span>✏️</span> Resume Feedback (Draft)
              </>
            ) : (
              <>
                <span>📝</span> Fill Closing Feedback
              </>
            )}
          </button>
        </div>

        {/* Live Activity In Progress Alert Banner (Instant Jump) */}
        {liveActivities.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 text-white rounded-2xl p-5 shadow-md border border-emerald-500/30 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                    Active Workshop Activity • HoD Enabled
                  </span>
                </div>
                <h3 className="text-lg font-black text-white leading-tight">
                  {liveActivities[0].activity.title}
                </h3>
                <p className="text-xs text-emerald-100">
                  {liveActivities[0].session.title} (Slot {liveActivities[0].session.slot} • {liveActivities[0].session.time} IST)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {liveActivities.length > 1 && (
                  <span className="text-xs text-emerald-200 font-medium">
                    +{liveActivities.length - 1} other open
                  </span>
                )}
                <button
                  type="button"
                  id="btn-jump-live-activity"
                  onClick={() => navigate(`/activity/${liveActivities[0].activity.activityId}`)}
                  className="px-5 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-bold text-xs sm:text-sm transition shadow flex items-center gap-2"
                >
                  <span>Start Worksheet Now</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Day Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-1">
            {[
              { day: 1 as const, label: 'Day 1 (28 Sept)' },
              { day: 2 as const, label: 'Day 2 (29 Sept)' },
              { day: 3 as const, label: 'Day 3 (30 Sept)' },
              { day: 'all' as const, label: 'All Days' },
            ].map(({ day, label }) => {
              const count = typeof day === 'number' ? liveCountByDay[day] : liveActivities.length;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`py-3 px-2 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeDay === day
                      ? 'border-christ-navy text-christ-navy'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {count} Live
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sessions & Activities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedSessions.map((session) => {
            const sessionActivities = activities.filter(
              (a) => a.sessionId === session.sessionId
            );

            // Enabled activities count
            const enabledCount = sessionActivities.filter((a) => {
              const state = activityStates.get(a.activityId);
              return state?.enabled === true;
            }).length;

            return (
              <div
                key={session.sessionId}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-christ-gold mb-2">
                    <span className="font-mono">
                      DAY {session.day} • SLOT {session.slot} • {session.time} IST
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        enabledCount > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {enabledCount > 0 ? `${enabledCount} Open` : 'Awaiting Session'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {session.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Facilitator: {session.facilitator} • Session ID:{' '}
                    <span className="font-mono">{session.sessionId}</span>
                  </p>

                  {/* Activities List */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-4">
                    {sessionActivities.map((act) => {
                      const state = activityStates.get(act.activityId);
                      const isEnabled = state?.enabled === true;
                      const isLocked = state?.locked === true;
                      const prog = userProgress.get(act.activityId);
                      const status = prog?.status;

                      if (!isEnabled) {
                        return (
                          <div
                            key={act.activityId}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-400 select-none"
                          >
                            <span className="truncate pr-2 flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-500">Activity {act.order}:</span>
                              <span>{act.title}</span>
                            </span>
                            <span className="text-[11px] italic shrink-0 text-slate-400">
                              Awaiting Coordinator
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={act.activityId}
                          onClick={() => navigate(`/activity/${act.activityId}`)}
                          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition shadow-sm ${
                            isLocked
                              ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
                              : 'bg-white border-slate-200 hover:border-christ-navy hover:shadow'
                          }`}
                        >
                          <div className="flex-1 pr-3">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-mono font-bold text-christ-navy bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                                Activity {act.order}
                              </span>
                              <span className="font-bold text-slate-800">
                                {act.title}
                              </span>
                              {act.derived && (
                                <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-semibold">
                                  Adapted
                                </span>
                              )}
                              {act.confidential && (
                                <span className="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-semibold">
                                  🔒
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {act.widgetType.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isLocked ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                🔒 Locked
                              </span>
                            ) : status === 'submitted' ? (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ Submitted
                              </span>
                            ) : status === 'draft' ? (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ✏ Draft
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-christ-navy text-white hover:bg-slate-800 shadow-sm flex items-center gap-1">
                                <span>Start</span>
                                <span>→</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};


