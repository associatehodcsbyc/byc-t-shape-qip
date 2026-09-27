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
import defaultSessions from '../../seed/sessions.json';
import defaultActivities from '../../seed/activities.json';

export const ParticipantLanding: React.FC = () => {
  const { user, rosterUser } = useAuth();
  const navigate = useNavigate();

  const userDept = rosterUser?.department || '';
  const emailLower = user?.email?.toLowerCase().trim() || '';

  const [activeDay, setActiveDay] = useState<1 | 2 | 3>(1);
  const [sessions, setSessions] = useState<Session[]>(defaultSessions.sessions as Session[]);
  const [activities, setActivities] = useState<Activity[]>(defaultActivities.activities as Activity[]);
  const [activityStates, setActivityStates] = useState<Map<string, ActivityState>>(new Map());
  const [userProgress, setUserProgress] = useState<Map<string, SubmissionProgress>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Fetch sessions & activities from Firestore (fallback to bundled seed)
  useEffect(() => {
    async function loadContent() {
      try {
        const sessSnap = await getDocs(collection(db, 'sessions'));
        if (!sessSnap.empty) {
          const list: Session[] = [];
          sessSnap.forEach((d) => list.push(d.data() as Session));
          list.sort((a, b) => a.order - b.order);
          setSessions(list);
        }

        const actSnap = await getDocs(collection(db, 'activities'));
        if (!actSnap.empty) {
          const list: Activity[] = [];
          actSnap.forEach((d) => list.push(d.data() as Activity));
          list.sort((a, b) => a.order - b.order);
          setActivities(list);
        }
      } catch (err) {
        console.error('Failed to load sessions/activities:', err);
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, []);

  // 2. Listen LIVE to activityState for current department
  useEffect(() => {
    if (!userDept) return;

    // Rules require: where('department', '==', myDept())
    const q = query(
      collection(db, 'activityState'),
      where('department', '==', userDept)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const stateMap = new Map<string, ActivityState>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ActivityState;
          stateMap.set(data.activityId, data);
        });
        setActivityStates(stateMap);
      },
      (err) => {
        console.error('Error listening to activityState:', err);
      }
    );

    return () => unsub();
  }, [userDept]);

  // 3. Listen LIVE to progress for current user
  useEffect(() => {
    if (!userDept || !emailLower) return;

    const q = query(
      collection(db, 'progress'),
      where('department', '==', userDept),
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
        console.error('Error listening to user progress:', err);
      }
    );

    return () => unsub();
  }, [userDept, emailLower]);

  // Filter sessions by active day
  const daySessions = sessions.filter((s) => s.day === activeDay);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <div className="w-10 h-10 border-4 border-christ-navy border-t-christ-gold rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading session workspace...</p>
          </div>
        ) : (
          <>
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

          <div className="flex gap-2">
            <button
              onClick={() => alert('Working Document view is available in Day 2-3.')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm"
            >
              📄 Working Document
            </button>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6 sm:space-x-8">
            {[
              { day: 1, label: 'Day 1 (28 Sept)' },
              { day: 2, label: 'Day 2 (29 Sept)' },
              { day: 3, label: 'Day 3 (30 Sept)' },
            ].map(({ day, label }) => (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day as any)}
                className={`py-3 px-1 text-sm font-bold border-b-2 transition ${
                  activeDay === day
                    ? 'border-christ-navy text-christ-navy'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Sessions & Activities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {daySessions.map((session) => {
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
                      SLOT {session.slot} • {session.time} IST
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        enabledCount > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {enabledCount > 0 ? `${enabledCount} Open` : 'Awaiting HoD'}
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
                            <span className="text-[11px] italic shrink-0">
                              Awaiting HoD
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
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ Submitted
                              </span>
                            ) : status === 'draft' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ✏ Draft
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-christ-navy text-white hover:bg-slate-800">
                                Start →
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
          </>
        )}
      </main>
    </div>
  );
};
