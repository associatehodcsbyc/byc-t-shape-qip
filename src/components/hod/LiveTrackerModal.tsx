import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, Session, SubmissionProgress, RosterUser } from '../../types';

interface LiveTrackerModalProps {
  activity: Activity;
  session?: Session;
  allActivitiesInSession?: Activity[];
  department: string;
  departmentName?: string;
  participants: RosterUser[];
  progressList: SubmissionProgress[];
  onSelectActivity?: (activity: Activity) => void;
  onClose: () => void;
}

export const LiveTrackerModal: React.FC<LiveTrackerModalProps> = ({
  activity,
  session,
  allActivitiesInSession = [],
  department,
  departmentName,
  participants,
  progressList,
  onSelectActivity,
  onClose,
}) => {
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'draft' | 'not-started'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter progress for this specific activity
  const activityProgress = useMemo(() => {
    const map = new Map<string, SubmissionProgress>();
    for (const p of progressList) {
      if (p.activityId === activity.activityId) {
        map.set(p.email.toLowerCase().trim(), p);
      }
    }
    return map;
  }, [progressList, activity.activityId]);

  // Combine roster participants with their activity progress
  const participantStatuses = useMemo(() => {
    return participants.map((p) => {
      const emailLower = p.email.toLowerCase().trim();
      const prog = activityProgress.get(emailLower);
      const status: 'submitted' | 'draft' | 'not-started' = prog
        ? prog.status
        : 'not-started';
      const groupLabel = prog?.groupLabel || '';
      const updatedAt = prog?.updatedAt;

      return {
        email: p.email,
        name: p.name,
        status,
        groupLabel,
        updatedAt,
      };
    });
  }, [participants, activityProgress]);

  // Computed metrics
  const totalCount = participants.length;
  const submittedCount = participantStatuses.filter((p) => p.status === 'submitted').length;
  const draftCount = participantStatuses.filter((p) => p.status === 'draft').length;
  const notStartedCount = totalCount - submittedCount - draftCount;

  const submittedPct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;
  const draftPct = totalCount > 0 ? Math.round((draftCount / totalCount) * 100) : 0;
  const notStartedPct = totalCount > 0 ? Math.max(0, 100 - submittedPct - draftPct) : 0;

  // Extract all distinct groups present in progress
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    participantStatuses.forEach((p) => {
      if (p.groupLabel) groups.add(p.groupLabel);
    });
    return Array.from(groups).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [participantStatuses]);

  // Group breakdown stats
  const groupBreakdowns = useMemo(() => {
    if (availableGroups.length === 0) return [];
    return availableGroups.map((grp) => {
      const inGroup = participantStatuses.filter((p) => p.groupLabel === grp);
      const submitted = inGroup.filter((p) => p.status === 'submitted').length;
      const draft = inGroup.filter((p) => p.status === 'draft').length;
      return {
        group: grp,
        total: inGroup.length,
        submitted,
        draft,
      };
    });
  }, [availableGroups, participantStatuses]);

  // Filtered participants list
  const filteredParticipants = useMemo(() => {
    return participantStatuses.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (selectedGroup !== 'all' && p.groupLabel !== selectedGroup) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesEmail = p.email.toLowerCase().includes(q);
        const matchesGroup = p.groupLabel.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesGroup) return false;
      }
      return true;
    });
  }, [participantStatuses, statusFilter, selectedGroup, searchQuery]);

  // Handle Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  };

  // Keyboard listener for ESC to close or exit projector mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isProjectorMode && !document.fullscreenElement) {
          setIsProjectorMode(false);
        } else if (!isProjectorMode) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [isProjectorMode, onClose]);

  // Format timestamp helper
  const formatTime = (ts: any) => {
    if (!ts) return '';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ==========================================================================
  // PROJECTOR MODE (Large text, high contrast, seminar hall presentation)
  // ==========================================================================
  if (isProjectorMode) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-y-auto"
        id="projector-mode-view"
      >
        {/* Top Projector Bar */}
        <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 backdrop-blur z-20">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-md">
              Projector Mode
            </span>
            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
              {departmentName || department} • {session ? `${session.title} (${session.slot})` : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              id="projector-fullscreen-btn"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg border border-slate-700 flex items-center gap-2 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={
                    isFullscreen
                      ? 'M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5'
                      : 'M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
                  }
                />
              </svg>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>

            <button
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
                setIsProjectorMode(false);
              }}
              id="exit-projector-btn"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition"
            >
              Exit Projector
            </button>
          </div>
        </header>

        {/* Projector Main Stage */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 flex flex-col justify-between">
          <div>
            {/* Title & Activity Info */}
            <div className="text-center mb-8">
              <span className="text-amber-400 font-mono text-base font-bold uppercase tracking-widest">
                Activity {activity.order} • {activity.widgetType.replace('_', ' ')}
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-white mt-2 tracking-tight">
                {activity.title}
              </h1>
              {activity.confidential && (
                <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs rounded-full">
                  <span>🔒 Confidential activity: displaying submission progress only (answers hidden)</span>
                </div>
              )}
            </div>

            {/* Giant Metric Scoreboards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
              {/* Total Roster */}
              <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 text-center shadow-lg">
                <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Total Participants</span>
                <div className="text-6xl md:text-7xl font-black text-white mt-3 font-mono">
                  {totalCount}
                </div>
                <p className="text-xs text-slate-500 mt-2">Registered in department</p>
              </div>

              {/* Submitted */}
              <div className="bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl p-6 text-center shadow-lg shadow-emerald-950/50">
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Submitted
                </div>
                <div className="text-6xl md:text-7xl font-black text-emerald-400 mt-3 font-mono">
                  {submittedCount}
                </div>
                <p className="text-sm font-bold text-emerald-300 mt-2">{submittedPct}% Completed</p>
              </div>

              {/* Drafts */}
              <div className="bg-amber-950/30 border-2 border-amber-500/80 rounded-2xl p-6 text-center shadow-lg">
                <span className="text-sm font-bold uppercase tracking-wider text-amber-400">In Progress / Draft</span>
                <div className="text-6xl md:text-7xl font-black text-amber-400 mt-3 font-mono">
                  {draftCount}
                </div>
                <p className="text-sm font-bold text-amber-300 mt-2">{draftPct}% Active</p>
              </div>

              {/* Not Started */}
              <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 text-center shadow-lg">
                <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Not Started</span>
                <div className="text-6xl md:text-7xl font-black text-slate-400 mt-3 font-mono">
                  {notStartedCount}
                </div>
                <p className="text-sm font-bold text-slate-500 mt-2">{notStartedPct}% Pending</p>
              </div>
            </div>

            {/* Giant Progress Bar */}
            <div className="mb-10">
              <div className="h-6 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner border border-slate-700">
                <div
                  className="bg-emerald-500 transition-all duration-500 flex items-center justify-center text-[11px] font-black text-slate-950"
                  style={{ width: `${submittedPct}%` }}
                >
                  {submittedPct > 8 ? `${submittedPct}%` : ''}
                </div>
                <div
                  className="bg-amber-400 transition-all duration-500 flex items-center justify-center text-[11px] font-black text-slate-950"
                  style={{ width: `${draftPct}%` }}
                >
                  {draftPct > 8 ? `${draftPct}%` : ''}
                </div>
                <div
                  className="bg-slate-700 transition-all duration-500"
                  style={{ width: `${notStartedPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-2 px-1 font-semibold">
                <span className="text-emerald-400">● {submittedCount} Submitted</span>
                <span className="text-amber-400">● {draftCount} Drafts in progress</span>
                <span className="text-slate-400">● {notStartedCount} Not started</span>
              </div>
            </div>

            {/* Group Status Chips (if groups present) */}
            {groupBreakdowns.length > 0 && (
              <div className="mb-10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Group Progress</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {groupBreakdowns.map((gb) => (
                    <div
                      key={gb.group}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center"
                    >
                      <div className="text-sm font-bold text-white">{gb.group}</div>
                      <div className="text-xs text-emerald-400 font-semibold mt-1">
                        {gb.submitted} / {gb.total} submitted
                      </div>
                      {gb.draft > 0 && (
                        <div className="text-[10px] text-amber-400">{gb.draft} drafting</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participant Real-time Status Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold uppercase tracking-wider text-slate-300">
                  Faculty Roster Status ({filteredParticipants.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      statusFilter === 'all' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter('submitted')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      statusFilter === 'submitted' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Submitted ({submittedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('draft')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      statusFilter === 'draft' ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Drafts ({draftCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('not-started')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      statusFilter === 'not-started' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Not Started ({notStartedCount})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[38vh] overflow-y-auto pr-1">
                {filteredParticipants.map((p) => {
                  const isSub = p.status === 'submitted';
                  const isDft = p.status === 'draft';
                  return (
                    <div
                      key={p.email}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                        isSub
                          ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100'
                          : isDft
                          ? 'bg-amber-950/30 border-amber-500/50 text-amber-100'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-sm truncate text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.groupLabel ? (
                            <span className="font-mono text-amber-300 mr-2">{p.groupLabel}</span>
                          ) : null}
                          {p.email}
                        </div>
                      </div>
                      <div>
                        {isSub && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-slate-950 inline-flex items-center gap-1">
                            ✓ Done
                          </span>
                        )}
                        {isDft && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-400 text-slate-950">
                            Drafting
                          </span>
                        )}
                        {!isSub && !isDft && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                            Waiting
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================================================
  // STANDARD MODAL VIEW (Clean, high functionality, full controls)
  // ==========================================================================
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      id="live-tracker-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <header className="px-6 py-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-christ-gold text-slate-950 uppercase tracking-wider">
                Live Tracker
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Dept: <strong className="text-white">{departmentName || department}</strong>
              </span>
              {session && (
                <span className="text-xs text-slate-400">
                  • {session.title} ({session.slot})
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              Activity {activity.order}: {activity.title}
            </h2>
            {activity.confidential && (
              <p className="text-xs text-amber-300 mt-1 flex items-center gap-1.5">
                <span>🔒 Confidential activity: shows participant status only. Individual responses are strictly private.</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Projector Mode Launch Button */}
            <button
              onClick={() => setIsProjectorMode(true)}
              id="launch-projector-mode-btn"
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition"
              title="Launch large-text Projector Mode for seminar hall projection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Projector Mode
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              id="close-live-tracker-btn"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Close modal (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Activity Quick Switcher Bar (if session has multiple activities) */}
        {allActivitiesInSession.length > 1 && onSelectActivity && (
          <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="font-semibold text-slate-600 whitespace-nowrap">Switch Activity:</span>
            <div className="flex gap-1.5">
              {allActivitiesInSession.map((act) => (
                <button
                  key={act.activityId}
                  onClick={() => onSelectActivity(act)}
                  className={`px-3 py-1 rounded font-medium transition whitespace-nowrap ${
                    act.activityId === activity.activityId
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  Act {act.order}: {act.title.slice(0, 24)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Faculty</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 font-mono">{totalCount}</div>
              <span className="text-[11px] text-slate-400">Registered participants</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Submitted</span>
                <span className="text-xs font-bold text-emerald-700">{submittedPct}%</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1 font-mono">{submittedCount}</div>
              <span className="text-[11px] text-emerald-600">Completed & submitted</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">In Progress</span>
                <span className="text-xs font-bold text-amber-700">{draftPct}%</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-1 font-mono">{draftCount}</div>
              <span className="text-[11px] text-amber-600">Drafts saved in progress</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Not Started</span>
                <span className="text-xs font-bold text-slate-600">{notStartedPct}%</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-700 mt-1 font-mono">{notStartedCount}</div>
              <span className="text-[11px] text-slate-400">Pending activity start</span>
            </div>
          </div>

          {/* Completion Progress Bar */}
          <div>
            <div className="h-3.5 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${submittedPct}%` }} />
              <div className="bg-amber-400 transition-all duration-300" style={{ width: `${draftPct}%` }} />
              <div className="bg-slate-300 transition-all duration-300" style={{ width: `${notStartedPct}%` }} />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-1.5 font-medium px-1">
              <span className="text-emerald-700 font-semibold">{submittedCount} submitted ({submittedPct}%)</span>
              <span className="text-amber-700 font-semibold">{draftCount} in progress ({draftPct}%)</span>
              <span className="text-slate-600">{notStartedCount} not started ({notStartedPct}%)</span>
            </div>
          </div>

          {/* Group Breakdown (if groupMode or groups present) */}
          {groupBreakdowns.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Group Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {groupBreakdowns.map((gb) => (
                  <div key={gb.group} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm text-center">
                    <span className="font-bold text-xs text-slate-900 block">{gb.group}</span>
                    <span className="text-xs font-semibold text-emerald-600 mt-0.5 block">
                      {gb.submitted} / {gb.total} done
                    </span>
                    {gb.draft > 0 && (
                      <span className="text-[10px] text-amber-600 block">{gb.draft} drafting</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter('submitted')}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === 'submitted' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Submitted ({submittedCount})
              </button>
              <button
                onClick={() => setStatusFilter('draft')}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === 'draft' ? 'bg-amber-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Drafts ({draftCount})
              </button>
              <button
                onClick={() => setStatusFilter('not-started')}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === 'not-started' ? 'bg-slate-700 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Not Started ({notStartedCount})
              </button>
            </div>

            {/* Group Filter & Search Input */}
            <div className="flex items-center gap-2">
              {availableGroups.length > 0 && (
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Groups</option>
                  {availableGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                placeholder="Search faculty name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-56"
              />
            </div>
          </div>

          {/* Participant Roster Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th scope="col" className="px-4 py-3">Faculty Name</th>
                  <th scope="col" className="px-4 py-3">Email ID</th>
                  <th scope="col" className="px-4 py-3">Group</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No participants match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => {
                    const isSub = p.status === 'submitted';
                    const isDft = p.status === 'draft';
                    return (
                      <tr key={p.email} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{p.email}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {p.groupLabel ? (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-semibold text-[11px]">
                              {p.groupLabel}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isSub && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Submitted
                            </span>
                          )}
                          {isDft && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                              Draft Saved
                            </span>
                          )}
                          {!isSub && !isDft && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Not Started
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                          {formatTime(p.updatedAt) || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {filteredParticipants.length} of {totalCount} faculty members
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
