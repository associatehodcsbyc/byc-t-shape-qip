import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Session, Activity, SubmissionProgress, RosterUser, Department } from '../../types';
import defaultSessions from '../../../seed/sessions.json';
import defaultActivities from '../../../seed/activities.json';
import { exportQipReportPackXlsx } from '../../utils/exports';
import { isEligibleParticipant } from '../../utils/department';

export const SessionSummaryView: React.FC = () => {
  const { rosterUser, isHoDStrict, isCoordinator, isResourcePerson, isAppAdmin } = useAuth();
  const isLockedToDept = isHoDStrict && !isCoordinator && !isResourcePerson && !isAppAdmin;

  const [sessions, setSessions] = useState<Session[]>(defaultSessions.sessions as Session[]);
  const [activities, setActivities] = useState<Activity[]>(defaultActivities.activities as Activity[]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('d1s1');
  const [selectedDept, setSelectedDept] = useState<string>(
    isLockedToDept ? rosterUser?.department || 'computer-science' : 'all'
  );

  const [progressList, setProgressList] = useState<SubmissionProgress[]>([]);
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Load sessions and activities from Firestore
  useEffect(() => {
    async function loadData() {
      try {
        const sSnap = await getDocs(collection(db, 'sessions'));
        if (!sSnap.empty) {
          const sList: Session[] = [];
          sSnap.forEach((d) => sList.push(d.data() as Session));
          sList.sort((a, b) => a.order - b.order);
          setSessions(sList);
        }

        const aSnap = await getDocs(collection(db, 'activities'));
        if (!aSnap.empty) {
          const aList: Activity[] = [];
          aSnap.forEach((d) => aList.push(d.data() as Activity));
          aList.sort((a, b) => a.order - b.order);
          setActivities(aList);
        }

        const dSnap = await getDocs(collection(db, 'departments'));
        const dList: Department[] = [];
        dSnap.forEach((d) => dList.push({ id: d.id, ...(d.data() as any) }));
        setDepartments(dList);
      } catch (err) {
        console.error('Error loading session summary metadata:', err);
      }
    }
    loadData();
  }, []);

  // Fetch progress and roster for selected department
  const fetchSessionData = async () => {
    setLoading(true);
    try {
      // 1. Fetch progress
      let pQuery;
      if (selectedDept !== 'all') {
        pQuery = query(collection(db, 'progress'), where('department', '==', selectedDept));
      } else {
        pQuery = collection(db, 'progress');
      }
      const pSnap = await getDocs(pQuery);
      const pList: SubmissionProgress[] = [];
      pSnap.forEach((d) => pList.push(d.data() as SubmissionProgress));
      setProgressList(pList);

      // 2. Fetch roster
      let rQuery;
      if (selectedDept !== 'all') {
        rQuery = query(collection(db, 'roster'), where('department', '==', selectedDept));
      } else {
        rQuery = collection(db, 'roster');
      }
      const rSnap = await getDocs(rQuery);
      const rList: RosterUser[] = [];
      rSnap.forEach((d) => {
        const u = d.data() as RosterUser;
        if (isEligibleParticipant(u)) {
          rList.push(u);
        }
      });
      setRoster(rList);
    } catch (err) {
      console.error('Failed to fetch session progress:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [selectedDept]);

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.sessionId === selectedSessionId) || sessions[0];
  }, [sessions, selectedSessionId]);

  const sessionActivities = useMemo(() => {
    return activities
      .filter((a) => a.sessionId === selectedSessionId)
      .sort((a, b) => a.order - b.order);
  }, [activities, selectedSessionId]);

  const targetDeptName =
    selectedDept === 'all'
      ? 'All BYC Departments'
      : departments.find((d) => d.id === selectedDept)?.name || selectedDept;

  const totalParticipants = roster.length;

  return (
    <div className="space-y-6" id="session-summary-root">
      {/* Top Header with Print & Report Pack Export */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:border-none print:shadow-none print:p-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
              QIP Session Report Summary
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Dept: <strong>{targetDeptName}</strong>
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            Session {currentSession?.slot}: {currentSession?.title}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Day {currentSession?.day} ({currentSession?.date}) • {currentSession?.time} • Facilitator: {currentSession?.facilitator}
          </p>
        </div>

        {/* Buttons (Hidden when printing) */}
        <div className="flex flex-wrap items-center gap-2 print:hidden self-stretch md:self-auto justify-end">
          <button
            onClick={() => window.print()}
            id="print-session-summary-btn"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save PDF
          </button>

          <button
            onClick={() =>
              exportQipReportPackXlsx(progressList, sessions, activities, roster, selectedDept)
            }
            id="download-qip-pack-btn"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
            title="Download full 3-sheet QIP Report Pack (Attendance, E-Certificate Eligibility, Participation)"
          >
            📊 Download QIP Report Pack (XLSX)
          </button>
        </div>
      </div>

      {/* Selectors Bar (Hidden when printing) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex-1 min-w-[220px]">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Select Session ({sessions.findIndex((s) => s.sessionId === selectedSessionId) + 1} of {sessions.length})
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            id="session-summary-session-selector"
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                Day {s.day} Slot {s.slot} ({s.time}): {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px]">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Department Scope
          </label>
          {isLockedToDept ? (
            <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs font-bold text-purple-900">
              {targetDeptName}
            </div>
          ) : (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              id="session-summary-dept-selector"
              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Session Activities Report Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">
              Session Worksheet Activities ({sessionActivities.length} Activities)
            </h3>
            {loading && <span className="text-xs text-purple-600 font-medium">Loading...</span>}
          </div>
          <span className="text-xs text-slate-500">
            Registered Faculty in Scope: <strong>{totalParticipants}</strong>
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {sessionActivities.map((act) => {
            const actProg = progressList.filter((p) => p.activityId === act.activityId);
            const submitted = actProg.filter((p) => p.status === 'submitted').length;
            const drafts = actProg.filter((p) => p.status === 'draft').length;
            const notStarted = Math.max(0, totalParticipants - submitted - drafts);
            const pct = totalParticipants > 0 ? Math.round((submitted / totalParticipants) * 100) : 0;

            return (
              <div key={act.activityId} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800">
                      Act {act.order}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {act.widgetType.replace('_', ' ')}
                    </span>
                    {act.confidential && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        🔒 Confidential
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-1">{act.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{act.sourceRef}</p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 block font-mono text-sm">
                      {submitted} / {totalParticipants} submitted ({pct}%)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {drafts} drafts • {notStarted} not started
                    </span>
                  </div>

                  <div className="w-24 h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                    <div className="bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
