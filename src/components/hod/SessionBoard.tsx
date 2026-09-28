import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Session, Activity, ActivityState, SubmissionProgress, Department, RosterUser } from '../../types';
import {
  getCachedSessions,
  getCachedActivities,
  loadContentWithRevalidation,
} from '../../services/content';
import {
  setActivityState,
  setSessionActivitiesState,
  subscribeToDepartmentActivityStates,
  subscribeToDepartmentProgress,
  getDepartmentParticipants,
} from '../../services/activityState';
import { LiveTrackerModal } from './LiveTrackerModal';

export const SessionBoard: React.FC = () => {
  const { user, rosterUser, isHoD, isCoordinator, isHoDStrict, isResourcePerson, isAdmin, isAppAdmin, canManageGates } = useAuth();
  const isLockedToDept = isHoDStrict && !isCoordinator && !isAdmin && !isAppAdmin && !isResourcePerson;

  // Departments and active selection
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>(rosterUser?.department || 'all');

  // Content (initialized instantly from memory cache)
  const [sessions, setSessions] = useState<Session[]>(() => getCachedSessions());
  const [activities, setActivities] = useState<Activity[]>(() => getCachedActivities());

  // Real-time state
  const [activityStates, setActivityStates] = useState<Map<string, ActivityState>>(new Map());
  const [deptProgress, setDeptProgress] = useState<SubmissionProgress[]>([]);
  const [deptParticipants, setDeptParticipants] = useState<RosterUser[]>([]);

  // UI state
  const [activeDay, setActiveDay] = useState<1 | 2 | 3 | 'all'>('all');
  const [selectedActivityForTracker, setSelectedActivityForTracker] = useState<Activity | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isReadOnly = !canManageGates;
  const userEmail = user?.email || rosterUser?.email || '';

  // 1. Fetch departments
  useEffect(() => {
    async function loadDepts() {
      try {
        const snap = await getDocs(collection(db, 'departments'));
        if (!snap.empty) {
          const list: Department[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          list.sort((a, b) => a.name.localeCompare(b.name));
          setDepartments(list);
        } else {
          setDepartments([
            { id: 'computer-science', name: 'Computer Science', campus: 'BYC' },
            { id: 'commerce', name: 'Commerce', campus: 'BYC' },
            { id: 'management', name: 'Management', campus: 'BYC' },
            { id: 'sciences', name: 'Sciences', campus: 'BYC' },
          ]);
        }
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    }
    loadDepts();
  }, []);

  // 2. Background revalidation of sessions and activities
  useEffect(() => {
    loadContentWithRevalidation((updatedSess, updatedActs) => {
      setSessions(updatedSess);
      setActivities(updatedActs);
    });
  }, []);

  // 3. Ensure HoD is strictly locked to their own department only if strictly departmental HoD
  useEffect(() => {
    if (isLockedToDept && rosterUser?.department) {
      setSelectedDept(rosterUser.department);
    }
  }, [isLockedToDept, rosterUser?.department]);

  // 4. Subscribe to activityState for selected department
  useEffect(() => {
    if (!selectedDept) return;
    const unsub = subscribeToDepartmentActivityStates(selectedDept, (states) => {
      setActivityStates(states);
    });
    return () => unsub();
  }, [selectedDept]);

  // 5. Subscribe to progress for selected department
  useEffect(() => {
    if (!selectedDept) return;
    const unsub = subscribeToDepartmentProgress(selectedDept, (prog) => {
      setDeptProgress(prog);
    });
    return () => unsub();
  }, [selectedDept]);

  // 6. Fetch active participants for selected department
  useEffect(() => {
    if (!selectedDept) return;
    getDepartmentParticipants(selectedDept)
      .then((users) => setDeptParticipants(users))
      .catch((err) => console.error('Failed to load participants for dept:', err));
  }, [selectedDept]);

  // Flash status message helper
  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Handle single activity toggle
  const handleSetState = async (
    activity: Activity,
    enabled: boolean,
    locked: boolean
  ) => {
    if (isReadOnly) {
      notify('Read-only: Only the QIP Coordinator can enable, lock, or disable activities.', 'error');
      return;
    }

    const key = `${activity.activityId}`;
    setActionLoading(key);
    try {
      await setActivityState({
        department: selectedDept,
        activityId: activity.activityId,
        sessionId: activity.sessionId,
        enabled,
        locked,
        userEmail,
      });

      const label = !enabled ? 'Disabled' : locked ? 'Locked' : 'Enabled';
      notify(`Activity ${activity.order} set to ${label}.`, 'success');
    } catch (err: any) {
      console.error('Failed to update activity state:', err);
      notify(`Failed to update state: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle session-level bulk toggle ("Enable all" / "Lock all")
  const handleBulkSetSession = async (
    session: Session,
    sessionActivities: Activity[],
    enabled: boolean,
    locked: boolean
  ) => {
    if (isReadOnly) {
      notify('Read-only: Only the QIP Coordinator can enable, lock, or disable activities.', 'error');
      return;
    }

    const key = `session-${session.sessionId}`;
    setActionLoading(key);
    try {
      await setSessionActivitiesState({
        department: selectedDept,
        session,
        activities: sessionActivities,
        enabled,
        locked,
        userEmail,
      });

      const label = locked ? 'Locked all' : 'Enabled all';
      notify(`${label} activities in ${session.title}.`, 'success');
    } catch (err: any) {
      console.error('Failed to bulk update session:', err);
      notify(`Failed to update session: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };


  // Group activities by sessionId
  const activitiesBySession = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const act of activities) {
      const list = map.get(act.sessionId) || [];
      list.push(act);
      map.set(act.sessionId, list);
    }
    // Ensure sorted order
    map.forEach((list) => list.sort((a, b) => a.order - b.order));
    return map;
  }, [activities]);

  // Filter sessions by selected day
  const filteredSessions = useMemo(() => {
    if (activeDay === 'all') return sessions;
    return sessions.filter((s) => s.day === activeDay);
  }, [sessions, activeDay]);

  // Selected department metadata
  const currentDeptObj = departments.find((d) => d.id === selectedDept);
  const currentDeptName = selectedDept === 'all'
    ? 'All Departments (Institution-wide)'
    : currentDeptObj ? currentDeptObj.name : selectedDept;

  // Department active participants count
  const totalFacultyCount = deptParticipants.length;

  return (
    <div className="space-y-6" id="session-board-root">
      {/* Top Banner & Department Scoping */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                isCoordinator
                  ? 'bg-teal-100 text-teal-900 border border-teal-200'
                  : isAppAdmin
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : isResourcePerson
                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                  : isHoD
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {isCoordinator
                ? 'QIP Coordinator Console (Gate Controller)'
                : isAppAdmin
                ? 'App Admin Console (Gate Controller)'
                : isResourcePerson
                ? 'Resource Person Console (Facilitator & Live Tracker)'
                : isHoD
                ? 'HoD Console (Department Tracking & Analytics)'
                : 'Leadership View (Read-Only)'}
            </span>

            {isReadOnly && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                🔒 Read-Only
              </span>
            )}
          </div>

          <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            {canManageGates
              ? 'Session Board & Activity Gate Controls'
              : isResourcePerson
              ? 'Facilitator Console & Live Tracker'
              : 'Department Progress & Live Tracker'}
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {canManageGates
              ? 'Control which activities are Enabled, Locked, or Disabled for faculty participants. Open the Live Submission Tracker or launch Projector Mode during sessions.'
              : isResourcePerson
              ? 'Monitor participant submissions in real time across sessions. Launch the Live Submission Tracker to view drafted and submitted responses.'
              : 'Monitor departmental participant submissions in real time across sessions. Launch the Live Submission Tracker to view drafted and submitted responses.'}
          </p>
          <div className="mt-3">
            <Link
              to="/analytics"
              id="sessionboard-goto-analytics"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              📊 View Analytics & Department Reports
            </Link>
          </div>
        </div>

        {/* Department Selector / Badge */}
        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Target Department
          </label>
          {isLockedToDept ? (
            <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              <span>{currentDeptName}</span>
            </div>
          ) : (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              id="hod-department-selector"
              className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">🌟 All Departments (Institution-wide)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.id})
                </option>
              ))}
            </select>
          )}
          <span className="text-[11px] text-slate-500">
            {totalFacultyCount} active faculty registered
          </span>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
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

      {/* Day Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveDay('all')}
            id="tab-day-all"
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeDay === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All {sessions.length} Sessions
          </button>
          <button
            onClick={() => setActiveDay(1)}
            id="tab-day-1"
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeDay === 1
                ? 'bg-christ-navy text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Day 1 (28 Sept)
          </button>
          <button
            onClick={() => setActiveDay(2)}
            id="tab-day-2"
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeDay === 2
                ? 'bg-christ-navy text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Day 2 (29 Sept)
          </button>
          <button
            onClick={() => setActiveDay(3)}
            id="tab-day-3"
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeDay === 3
                ? 'bg-christ-navy text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Day 3 (30 Sept)
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredSessions.length} sessions across {currentDeptName}
        </div>
      </div>

      {/* Sessions Grid / List */}
      <div className="space-y-6">
        {filteredSessions.map((session) => {
          const sessActivities = activitiesBySession.get(session.sessionId) || [];
          const sessionKey = `session-${session.sessionId}`;
          const isSessionBusy = actionLoading === sessionKey;

          return (
            <div
              key={session.sessionId}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              id={`session-card-${session.sessionId}`}
            >
              {/* Session Header */}
              <div className="p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white uppercase tracking-wider">
                      Day {session.day} • Slot {session.slot}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{session.time}</span>
                    <span className="text-xs text-slate-400">• Facilitator: {session.facilitator}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {session.title}
                  </h3>
                </div>

                {/* Session-level Bulk Controls */}
                {canManageGates ? (
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => handleBulkSetSession(session, sessActivities, true, false)}
                      disabled={isSessionBusy || sessActivities.length === 0}
                      id={`enable-all-${session.sessionId}`}
                      className="px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                      title={`Enable all activities in this session for ${selectedDept === 'all' ? 'All Departments' : currentDeptName}`}
                    >
                      <span>🔓</span>
                      <span>{isSessionBusy ? 'Updating...' : selectedDept === 'all' ? 'Enable (Current)' : `Enable (${currentDeptName})`}</span>
                    </button>

                    <button
                      onClick={() => handleBulkSetSession(session, sessActivities, true, true)}
                      disabled={isSessionBusy || sessActivities.length === 0}
                      id={`lock-all-${session.sessionId}`}
                      className="px-3.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                      title={`Lock all activities in this session for ${selectedDept === 'all' ? 'All Departments' : currentDeptName} (freeze edits)`}
                    >
                      <span>🔒</span>
                      <span>{isSessionBusy ? 'Updating...' : selectedDept === 'all' ? 'Lock All' : `Lock All (${currentDeptName})`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      {isResourcePerson
                        ? 'Facilitator View (Use Live Tracker)'
                        : isHoD
                        ? 'Department View (Use Live Tracker)'
                        : 'Read-only view'}
                    </span>
                  </div>
                )}
              </div>

              {/* Activities List */}
              <div className="divide-y divide-slate-100">
                {sessActivities.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400 italic">
                    No activities configured for this session yet.
                  </div>
                ) : (
                  sessActivities.map((act) => {
                    const state = activityStates.get(act.activityId);
                    const isEnabled = state ? state.enabled : false;
                    const isLocked = state ? state.locked : false;

                    // Progress counts for this activity
                    const actProgress = deptProgress.filter((p) => p.activityId === act.activityId);
                    const submittedCount = actProgress.filter((p) => p.status === 'submitted').length;
                    const draftCount = actProgress.filter((p) => p.status === 'draft').length;
                    const notStartedCount = Math.max(0, totalFacultyCount - submittedCount - draftCount);
                    const completionPct =
                      totalFacultyCount > 0 ? Math.round((submittedCount / totalFacultyCount) * 100) : 0;

                    const isActBusy = actionLoading === act.activityId;

                    return (
                      <div
                        key={act.activityId}
                        className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                        id={`activity-row-${act.activityId}`}
                      >
                        {/* Left: Info & Badges */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Activity {act.order}
                            </span>

                            {/* Current State Badge */}
                            {isEnabled && !isLocked && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                Enabled (Open)
                              </span>
                            )}
                            {isEnabled && isLocked && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <svg className="w-3 h-3 text-amber-700" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Locked (Read-Only)
                              </span>
                            )}
                            {(!state || !isEnabled) && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-700">
                                Disabled (Hidden)
                              </span>
                            )}

                            {/* Additional metadata chips */}
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                              {act.widgetType.replace('_', ' ')}
                            </span>

                            {act.confidential && (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                🔒 Confidential
                              </span>
                            )}

                            {act.derived && (
                              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                                Adapted
                              </span>
                            )}

                            {act.groupMode === 'group' && (
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                Group Activity
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-900 mt-1.5 truncate">
                            {act.title}
                          </h4>

                          {/* Live Tracker Preview Chip */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                            <span className="font-semibold text-slate-700">
                              Live Progress:
                            </span>
                            <span className="text-emerald-700 font-bold">
                              {submittedCount}/{totalFacultyCount} submitted ({completionPct}%)
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-amber-700 font-medium">
                              {draftCount} in progress
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">
                              {notStartedCount} not started
                            </span>
                          </div>
                        </div>

                        {/* Right: State Action Toggles & Tracker Button */}
                        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
                          {/* Enable / Lock / Disable segmented control */}
                          {!isReadOnly ? (
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                              {/* Enable Button */}
                              <button
                                onClick={() => handleSetState(act, true, false)}
                                disabled={isActBusy || (isEnabled && !isLocked)}
                                id={`btn-enable-${act.activityId}`}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  isEnabled && !isLocked
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-emerald-700'
                                }`}
                                title="Enable activity for faculty (visible and editable)"
                              >
                                Enable
                              </button>

                              {/* Lock Button */}
                              <button
                                onClick={() => handleSetState(act, true, true)}
                                disabled={isActBusy || (isEnabled && isLocked)}
                                id={`btn-lock-${act.activityId}`}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  isEnabled && isLocked
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-amber-700'
                                }`}
                                title="Lock activity (read-only for faculty, freeze edits)"
                              >
                                Lock
                              </button>

                              {/* Disable Button */}
                              <button
                                onClick={() => handleSetState(act, false, false)}
                                disabled={isActBusy || (!state || !isEnabled)}
                                id={`btn-disable-${act.activityId}`}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  !state || !isEnabled
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-red-700'
                                }`}
                                title="Disable activity (hidden from faculty)"
                              >
                                Disable
                              </button>
                            </div>
                          ) : (
                            <div className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold border border-slate-200">
                              Status: {isEnabled ? (isLocked ? 'Locked' : 'Enabled') : 'Disabled'}
                            </div>
                          )}

                          {/* Live Tracker Modal Launcher */}
                          <button
                            onClick={() => setSelectedActivityForTracker(act)}
                            id={`btn-tracker-${act.activityId}`}
                            className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                            title="Open detailed live tracker with names and groups"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                              />
                            </svg>
                            Live Tracker
                          </button>

                          {/* Preview Link */}
                          <Link
                            to={`/activity/${act.activityId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Preview activity worksheet (opens in new tab)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Tracker Modal & Projector Mode */}
      {selectedActivityForTracker && (
        <LiveTrackerModal
          activity={selectedActivityForTracker}
          session={sessions.find((s) => s.sessionId === selectedActivityForTracker.sessionId)}
          allActivitiesInSession={activitiesBySession.get(selectedActivityForTracker.sessionId) || []}
          department={selectedDept}
          departmentName={currentDeptName}
          participants={deptParticipants}
          progressList={deptProgress}
          onSelectActivity={(act) => setSelectedActivityForTracker(act)}
          onClose={() => setSelectedActivityForTracker(null)}
        />
      )}
    </div>
  );
};
