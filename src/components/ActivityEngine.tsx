import React, { useState, useEffect, useRef } from 'react';
import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Activity, ActivityState } from '../types';
import { extractCarryForwardWrites } from '../utils/carryForward';

// Widgets
import { RatingScaleWidget } from './widgets/RatingScaleWidget';
import { ChoiceMatrixWidget } from './widgets/ChoiceMatrixWidget';
import { RankOrderWidget } from './widgets/RankOrderWidget';
import { ChecklistWidget } from './widgets/ChecklistWidget';
import { TableEntryWidget } from './widgets/TableEntryWidget';
import { FreeTextWidget } from './widgets/FreeTextWidget';
import { PollWidget } from './widgets/PollWidget';
import { CompositeWidget } from './widgets/CompositeWidget';
import { WorkingDocWidget } from './widgets/WorkingDocWidget';
import { FixedGridWidget } from './widgets/FixedGridWidget';
import { CrmMatrixWidget } from './widgets/CrmMatrixWidget';

interface ActivityEngineProps {
  activity: Activity;
  activityState?: ActivityState | null;
  onBack?: () => void;
}

const DEFAULT_DEPARTMENTS: { id: string; name: string }[] = [
  { id: 'computer-science', name: 'Computer Science' },
  { id: 'commerce', name: 'Commerce' },
  { id: 'management', name: 'Management' },
  { id: 'sciences', name: 'Sciences' },
  { id: 'economics-byc', name: 'Economics-BYC' },
];

const DEFAULT_GROUP_PROTOCOL =
  'GROUP ACTIVITY — 1) Sit with your group as directed by the facilitator. 2) Select your department / group from the list; every member of the group must select the SAME group. 3) Discuss and agree. 4) Each member records the answers in their OWN response and submits. The HoD sees the responses grouped by group number. Where the instructions say "your own course", record your own course, not the group\'s.';

export const ActivityEngine: React.FC<ActivityEngineProps> = ({
  activity,
  activityState,
  onBack,
}) => {
  const { user, rosterUser } = useAuth();
  const emailLower = user?.email?.toLowerCase().trim() || '';
  const userDept = rosterUser?.department || '';
  const userName = rosterUser?.name || user?.displayName || 'Participant';

  // Activity Status & Permission
  const isLocked = Boolean(activityState?.locked);
  const isEnabled = activityState ? activityState.enabled : true;
  const isReadOnly = isLocked || !isEnabled;

  // Local state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [groupLabel, setGroupLabel] = useState<string>('');
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'submitted' | 'not_started'>('not_started');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // App Config (Group Protocol & Group Labels)
  const [groupProtocol, setGroupProtocol] = useState<string>(DEFAULT_GROUP_PROTOCOL);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>(DEFAULT_DEPARTMENTS);

  // Determine user's department object
  const userDeptObj = React.useMemo(() => {
    return (
      departmentsList.find((d) => d.id === userDept) ||
      (userDept
        ? {
            id: userDept,
            name: userDept
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          }
        : null)
    );
  }, [departmentsList, userDept]);

  // Programme Name input display logic
  const showProgrammeInput =
    activity.activityId === 'd1s1_a3_ideal_graduate' ||
    activity.groupMode === 'group' ||
    activity.activityId.includes('ideal_graduate') ||
    activity.activityId.includes('draw_our_t') ||
    activity.activityId.includes('threshold_concepts') ||
    activity.activityId.includes('three_concepts');

  const isKnownGroup = (val: string) => {
    if (!val) return true;
    if (userDeptObj && val === userDeptObj.name) return true;
    if (userDeptObj && [1, 2, 3, 4, 5, 6].some((n) => val === `${userDeptObj.name} - Group ${n}`.slice(0, 40))) return true;
    if (departmentsList.some((d) => val === d.name || [1, 2, 3, 4, 5, 6].some((n) => val === `${d.name} - Group ${n}`.slice(0, 40)))) return true;
    if ([1, 2, 3, 4, 5, 6].some((n) => val === `Cross-Department - Group ${n}`)) return true;
    return false;
  };

  // Working Document (for Carry-Forward)
  const [workingDocFields, setWorkingDocFields] = useState<Record<string, any>>({});

  // UI accordion states
  const [instructionsExpanded, setInstructionsExpanded] = useState<boolean>(true);
  const [contextExpanded, setContextExpanded] = useState<boolean>(true);

  // Timer countdown
  const timeLimitSec = (activity.timeLimitMin || 0) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(timeLimitSec);
  const [timerRunning, setTimerRunning] = useState<boolean>(timeLimitSec > 0);

  // Debounce tracking
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const groupLabelRef = useRef(groupLabel);
  groupLabelRef.current = groupLabel;
  const isInitialLoad = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const existingDocExists = useRef<boolean>(false);

  // 1. Fetch config/app, departments, existing response, workingDoc, and pre-selected groupLabel
  useEffect(() => {
    if (!emailLower || !activity.activityId) return;

    let mounted = true;

    async function loadData() {
      try {
        // Load config/app (fallback gracefully if rule blocks)
        try {
          const cfgSnap = await getDoc(doc(db, 'config', 'app'));
          if (cfgSnap.exists() && mounted) {
            const data = cfgSnap.data();
            if (data.groupProtocol) setGroupProtocol(data.groupProtocol);
          }
        } catch {
          // Graceful fallback to default seed group protocol
        }

        // Load active departments for group selector
        try {
          const dSnap = await getDocs(collection(db, 'departments'));
          if (!dSnap.empty && mounted) {
            const list: { id: string; name: string }[] = [];
            dSnap.forEach((d) => {
              const data = d.data();
              list.push({ id: d.id, name: data.name || d.id });
            });
            list.sort((a, b) => a.name.localeCompare(b.name));
            setDepartmentsList(list);
          }
        } catch {
          // Graceful fallback
        }

        // Load existing response
        const respId = `${activity.activityId}__${emailLower}`;
        const respSnap = await getDoc(doc(db, 'responses', respId));

        if (respSnap.exists() && mounted) {
          existingDocExists.current = true;
          const data = respSnap.data();
          setAnswers(data.answers || {});
          if (data.groupLabel) setGroupLabel(data.groupLabel);
          if (data.status) setSubmissionStatus(data.status);
          if (data.updatedAt?.toDate) setLastSavedAt(data.updatedAt.toDate());
        } else if (activity.groupMode === 'group' && mounted) {
          // Pre-select group chosen in most recent group activity in the SAME session
          try {
            const progQuery = query(
              collection(db, 'progress'),
              where('department', '==', userDept),
              where('sessionId', '==', activity.sessionId),
              where('email', '==', emailLower)
            );
            const progSnap = await getDocs(progQuery);
            progSnap.forEach((d) => {
              const pData = d.data();
              if (pData.groupLabel && !groupLabelRef.current) {
                setGroupLabel(pData.groupLabel);
              }
            });
          } catch {
            // Non-critical
          }
        }

        // Load working document for carry-forward readKeys
        if (activity.carryForward?.readKeys?.length) {
          const wdSnap = await getDoc(doc(db, 'workingDocs', emailLower));
          if (wdSnap.exists() && mounted) {
            setWorkingDocFields(wdSnap.data()?.fields || {});
          }
        }
      } catch (err: any) {
        console.error('Error loading activity data:', err);
      } finally {
        if (mounted) {
          // Allow saving after initial load
          setTimeout(() => {
            isInitialLoad.current = false;
          }, 500);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [activity.activityId, emailLower, userDept, activity.sessionId, activity.groupMode]);

  // 2. Countdown Timer
  useEffect(() => {
    if (!timerRunning || secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, secondsRemaining]);

  // 3. Debounced Autosave (8 seconds)
  useEffect(() => {
    if (isInitialLoad.current || isReadOnly) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus('idle');

    debounceTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 8000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [answers, groupLabel, isReadOnly]);

  /**
   * Saves draft atomically writing to responses and progress
   */
  const saveDraft = async () => {
    if (isReadOnly || !user || !userDept) return;

    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const respId = `${activity.activityId}__${emailLower}`;
      const progId = respId;
      const batch = writeBatch(db);

      const respRef = doc(db, 'responses', respId);
      const progRef = doc(db, 'progress', progId);

      const now = serverTimestamp();

      const responsePayload: Record<string, any> = {
        activityId: activity.activityId,
        sessionId: activity.sessionId,
        department: userDept,
        email: emailLower,
        uid: user.uid,
        name: userName,
        answers: answersRef.current,
        status: submissionStatus === 'submitted' ? 'submitted' : 'draft',
        confidential: Boolean(activity.confidential),
        updatedAt: now,
      };

      if (groupLabelRef.current) {
        responsePayload.groupLabel = groupLabelRef.current;
      }

      if (!existingDocExists.current) {
        responsePayload.createdAt = now;
        batch.set(respRef, responsePayload);
        existingDocExists.current = true;
      } else {
        batch.update(respRef, responsePayload);
      }

      // Progress doc payload
      const progressPayload: Record<string, any> = {
        activityId: activity.activityId,
        sessionId: activity.sessionId,
        department: userDept,
        email: emailLower,
        name: userName,
        status: submissionStatus === 'submitted' ? 'submitted' : 'draft',
        updatedAt: now,
      };

      if (groupLabelRef.current) {
        progressPayload.groupLabel = groupLabelRef.current;
      }

      batch.set(progRef, progressPayload, { merge: true });

      await batch.commit();

      setSaveStatus('saved');
      setLastSavedAt(new Date());
      if (submissionStatus === 'not_started') {
        setSubmissionStatus('draft');
      }
    } catch (err: any) {
      console.error('Autosave failed:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'Failed to autosave changes.');
    }
  };

  /**
   * Submits the response, writes progress, and merges carry-forward keys to workingDocs
   */
  const handleSubmit = async () => {
    if (isReadOnly || !user || !userDept) return;

    // Validate group choice in group mode
    if (activity.groupMode === 'group' && !groupLabel) {
      setErrorMessage('Please select your Department / Group before submitting.');
      return;
    }

    setSaveStatus('saving');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const respId = `${activity.activityId}__${emailLower}`;
      const progId = respId;
      const batch = writeBatch(db);

      const respRef = doc(db, 'responses', respId);
      const progRef = doc(db, 'progress', progId);

      const now = serverTimestamp();

      const responsePayload: Record<string, any> = {
        activityId: activity.activityId,
        sessionId: activity.sessionId,
        department: userDept,
        email: emailLower,
        uid: user.uid,
        name: userName,
        answers: answersRef.current,
        status: 'submitted',
        confidential: Boolean(activity.confidential),
        updatedAt: now,
        submittedAt: now,
      };

      if (groupLabelRef.current) {
        responsePayload.groupLabel = groupLabelRef.current;
      }

      if (!existingDocExists.current) {
        responsePayload.createdAt = now;
        batch.set(respRef, responsePayload);
        existingDocExists.current = true;
      } else {
        batch.update(respRef, responsePayload);
      }

      const progressPayload: Record<string, any> = {
        activityId: activity.activityId,
        sessionId: activity.sessionId,
        department: userDept,
        email: emailLower,
        name: userName,
        status: 'submitted',
        updatedAt: now,
      };

      if (groupLabelRef.current) {
        progressPayload.groupLabel = groupLabelRef.current;
      }

      batch.set(progRef, progressPayload, { merge: true });

      // Carry-forward writeKeys into workingDocs
      const extractedWrites = extractCarryForwardWrites(answersRef.current, activity);
      if (Object.keys(extractedWrites).length > 0) {
        const wdRef = doc(db, 'workingDocs', emailLower);
        const wdSnap = await getDoc(wdRef);
        const existingFields = wdSnap.exists() ? wdSnap.data()?.fields || {} : {};

        batch.set(
          wdRef,
          {
            email: emailLower,
            department: userDept,
            fields: {
              ...existingFields,
              ...extractedWrites,
            },
            updatedAt: now,
          },
          { merge: true }
        );
      }

      await batch.commit();

      setSaveStatus('saved');
      setSubmissionStatus('submitted');
      setLastSavedAt(new Date());
      setSuccessMessage('Your response has been successfully submitted!');
    } catch (err: any) {
      console.error('Submission failed:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'Submission failed. Please check your network and try again.');
    }
  };

  // Format countdown mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Render the specific widget
  const renderWidget = () => {
    switch (activity.widgetType) {
      case 'rating_scale':
        return (
          <RatingScaleWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'choice_matrix':
        return (
          <ChoiceMatrixWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'rank_order':
        return (
          <RankOrderWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'checklist':
        return (
          <ChecklistWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'table_entry':
        return (
          <TableEntryWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'free_text':
        return (
          <FreeTextWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'poll':
        return (
          <PollWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'composite':
        return (
          <CompositeWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'working_doc':
        return (
          <WorkingDocWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'fixed_grid':
        return (
          <FixedGridWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      case 'crm_matrix':
        return (
          <CrmMatrixWidget
            activity={activity}
            answers={answers}
            onChange={setAnswers}
            readOnly={isReadOnly}
          />
        );
      default:
        return (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
            <h4 className="text-base font-bold text-slate-800">
              Widget ({activity.widgetType})
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              This widget type is scheduled for the Day 2–3 set.
            </p>
          </div>
        );
    }
  };

  const carryForwardKeys = activity.carryForward?.readKeys || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold text-slate-600 hover:text-christ-navy flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
            >
              ← Back to Schedule
            </button>
          )}
          <span className="text-xs font-mono font-bold text-christ-navy uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {activity.sessionId.toUpperCase()} • Activity {activity.order}
          </span>
        </div>

        {/* Save & Timer Indicators */}
        <div className="flex items-center gap-3">
          {timeLimitSec > 0 && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
                secondsRemaining < 180
                  ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <span>⏱</span>
              <span>{formatTime(secondsRemaining)}</span>
            </div>
          )}

          <div className="text-right">
            {saveStatus === 'saving' && (
              <span className="text-xs text-amber-600 font-semibold animate-pulse">
                Saving draft...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-emerald-600 font-semibold">
                ✓ Saved {lastSavedAt ? `at ${lastSavedAt.toLocaleTimeString()}` : ''}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-600 font-semibold">
                ⚠ Save error
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Locked / Read-Only Warning Banner */}
      {isLocked && (
        <div
          id="locked-activity-banner"
          className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3 shadow-sm"
        >
          <span className="text-xl">🔒</span>
          <div>
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
              Activity Locked
            </h4>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              This activity has been locked by your Head of Department. Your responses are preserved in read-only mode and cannot be modified.
            </p>
          </div>
        </div>
      )}

      {/* Group Protocol Banner (if group mode) */}
      {activity.groupMode === 'group' && (
        <div
          id="group-protocol-banner"
          className="p-4 rounded-xl bg-gradient-to-r from-blue-900 to-christ-navy text-white shadow-sm border border-blue-800 flex items-start gap-3.5"
        >
          <span className="text-2xl mt-0.5">👥</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-extrabold text-christ-gold">
                Group Activity Protocol
              </span>
              {activity.groupSetup && (
                <span
                  id="group-setup-chip"
                  className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                >
                  {activity.groupSetup}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-100 leading-relaxed">
              {groupProtocol}
            </p>
          </div>
        </div>
      )}

      {/* Activity Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {activity.widgetType.replace('_', ' ')}
              </span>

              {activity.derived && (
                <span
                  id="adapted-activity-badge"
                  className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200"
                >
                  Adapted activity
                </span>
              )}

              {activity.confidential && (
                <span
                  id="confidential-lock-badge"
                  className="bg-purple-100 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1"
                >
                  🔒 Confidential: your HoD sees only department averages
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              {activity.title}
            </h1>

            {activity.sourceRef && (
              <p className="text-xs text-slate-500 font-medium">
                Source: {activity.sourceRef}
              </p>
            )}
          </div>

          {/* Group Dropdown Selector (if groupMode == 'group') */}
          {activity.groupMode === 'group' && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0 w-full sm:w-64">
              <label
                htmlFor="group-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Select Department / Group *
              </label>
              <select
                id="group-select"
                disabled={isReadOnly}
                value={groupLabel}
                onChange={(e) => setGroupLabel(e.target.value.slice(0, 40))}
                className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy disabled:bg-slate-100"
              >
                <option value="">-- Choose Department / Group --</option>
                {/* User's Department First */}
                {userDeptObj && (
                  <optgroup label={`Your Department (${userDeptObj.name})`}>
                    <option value={userDeptObj.name.slice(0, 40)}>{userDeptObj.name} (General)</option>
                    {[1, 2, 3, 4, 5, 6].map((num) => {
                      const val = `${userDeptObj.name} - Group ${num}`.slice(0, 40);
                      return (
                        <option key={`my-dept-${num}`} value={val}>
                          {userDeptObj.name} - Group {num}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {/* Other Registered Departments */}
                {departmentsList
                  .filter((d) => !userDeptObj || d.id !== userDeptObj.id)
                  .map((dept) => (
                    <optgroup key={dept.id} label={dept.name}>
                      <option value={dept.name.slice(0, 40)}>{dept.name}</option>
                      {[1, 2, 3, 4, 5, 6].map((num) => {
                        const val = `${dept.name} - Group ${num}`.slice(0, 40);
                        return (
                          <option key={`${dept.id}-${num}`} value={val}>
                            {dept.name} - Group {num}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                {/* Cross-Department / Interdisciplinary Groups */}
                <optgroup label="Cross-Department / Mixed Programme Groups">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={`mixed-${num}`} value={`Cross-Department - Group ${num}`}>
                      Cross-Department - Group {num}
                    </option>
                  ))}
                </optgroup>
                {/* Preserved custom or existing groupLabel */}
                {groupLabel && !isKnownGroup(groupLabel) && (
                  <option value={groupLabel}>{groupLabel} (Current)</option>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Collapsible Instructions Panel */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
          <button
            type="button"
            onClick={() => setInstructionsExpanded((prev) => !prev)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <div className="flex items-center gap-2">
              <span>📋 Activity Instructions</span>
              {activity.timeLimitMin && (
                <span className="text-slate-500 font-normal">
                  (Suggested time: {activity.timeLimitMin} min)
                </span>
              )}
            </div>
            <span>{instructionsExpanded ? '▲ Collapse' : '▼ Expand'}</span>
          </button>

          {instructionsExpanded && (
            <div className="p-4 border-t border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed bg-white">
              {activity.instructions}
            </div>
          )}
        </div>

        {/* Collapsible Context Panel (config.context for case studies) */}
        {activity.config?.context && (
          <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
            <button
              type="button"
              onClick={() => setContextExpanded((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-christ-navy bg-blue-50/80 hover:bg-blue-100 transition"
            >
              <span className="flex items-center gap-1.5">
                <span>📖</span> Case Study Context & Background
              </span>
              <span>{contextExpanded ? '▲ Collapse' : '▼ Expand'}</span>
            </button>

            {contextExpanded && (
              <div className="p-4 border-t border-blue-200 text-xs sm:text-sm text-slate-800 leading-relaxed bg-white/90 whitespace-pre-line">
                {activity.config.context}
              </div>
            )}
          </div>
        )}

        {/* Carry-Forward Read-Only Banner */}
        {carryForwardKeys.length > 0 && (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-800">
                From your working document
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                Read-only context
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {carryForwardKeys.map((key) => {
                const val = workingDocFields[key];
                return (
                  <div key={key} className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-slate-600 block text-[11px] mb-0.5">
                      {key.replace(/_/g, ' ').toUpperCase()}:
                    </span>
                    <span className="text-slate-800 font-medium">
                      {val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '(Not set yet)'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Error and Success Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <span>❌</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Active Widget Body */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-7 space-y-6">
        {showProgrammeInput && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-1.5 shadow-sm">
            <label
              htmlFor="programme-name-input"
              className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"
            >
              <span>🎓</span> Programme Name <span className="text-red-500">*</span>
              <span className="text-slate-500 font-normal lowercase tracking-normal text-[11px]">
                (e.g., BSc Computer Science, BCA, MCA, BBA, MA English, MSc Economics)
              </span>
            </label>
            <input
              id="programme-name-input"
              type="text"
              disabled={isReadOnly}
              value={answers.programmeName || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  programmeName: e.target.value,
                }))
              }
              placeholder="Enter your programme name..."
              className="w-full text-sm font-semibold rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100 shadow-inner"
            />
          </div>
        )}

        {renderWidget()}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>
              Status:{' '}
              <span
                className={`font-semibold uppercase tracking-wider ${
                  submissionStatus === 'submitted'
                    ? 'text-emerald-600'
                    : submissionStatus === 'draft'
                    ? 'text-amber-600'
                    : 'text-slate-400'
                }`}
              >
                {submissionStatus}
              </span>
            </span>
            {!isReadOnly && (
              <span className="text-[11px] text-slate-400 font-normal">
                (autosaved every 8 seconds)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isReadOnly && (
              <button
                type="button"
                onClick={saveDraft}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm disabled:opacity-50"
              >
                Save Draft
              </button>
            )}

            {!isReadOnly && (
              <button
                type="button"
                id="submit-activity-btn"
                onClick={handleSubmit}
                disabled={saveStatus === 'saving'}
                className="px-6 py-2 text-xs font-bold text-white bg-christ-navy hover:bg-slate-800 rounded-lg shadow-md transition disabled:opacity-50 ring-1 ring-christ-gold"
              >
                {submissionStatus === 'submitted' ? 'Update & Re-Submit' : 'Submit Response'}
              </button>
            )}

            {isReadOnly && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                View Only (Locked)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
