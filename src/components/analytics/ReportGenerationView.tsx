import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  getReportMeta,
  updateReportMetaFields,
  PhotoEntry,
  AttendanceEntry,
  ReportFields,
  ActionPlanRow,
} from '../../data/reportMeta';
import {
  OverallFeedbackSummaryDoc,
  getOverallFeedbackSummary,
} from '../../data/feedbackSummaries';
import { getCachedSessions, getCachedActivities } from '../../services/content';
import { Session, Activity, ActivityResponse, SubmissionProgress, Department, RosterUser } from '../../types';
import { compressImage } from '../../utils/imageCompressor';

const DEFAULT_OBJECTIVES = [
  '• Deepen vertical disciplinary depth (70%) and horizontal interdisciplinary breadth (30%) across undergraduate curricula.',
  "• Institutionalise cognitive rigour using Bloom's Revised Taxonomy, Webb's Depth of Knowledge (DOK), and the Cognitive Rigour Matrix (CRM).",
  '• Foster higher-order thinking, intellectual curiosity, and scholarship of teaching and learning (SoTL) among faculty.',
  '• Construct authentic, rigorous assessment tasks, criterion-referenced rubrics, and conceptual inquiry mechanisms.',
  '• Establish departmental action plans and 90-day implementation roadmaps for sustainable curricular transformation.',
];

const ACTION_PLAN_DIMENSIONS = [
  '1. Curriculum Depth',
  '2. Teaching & Learning',
  '3. Assessment Rigour',
  '4. Research Integration',
  '5. Scholarly Culture',
  '6. Faculty Development',
  '7. Student Research',
  '8. Benchmarking',
];

export const ReportGenerationView: React.FC = () => {
  const { canEditReport, user, rosterUser, isAppAdmin, isDeanOrLeadership } = useAuth();

  // Department State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [rosterList, setRosterList] = useState<RosterUser[]>([]);

  // Report Content State
  const [fields, setFields] = useState<ReportFields>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [progressList, setProgressList] = useState<SubmissionProgress[]>([]);
  const [actionPlanResponses, setActionPlanResponses] = useState<ActivityResponse[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<OverallFeedbackSummaryDoc | null>(null);

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [uploadingAttendance, setUploadingAttendance] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');

  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const attendanceFileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if user's role is department-specific (HoD or QIP Coordinator)
  const isHoD = rosterUser?.role === 'hod';
  const isCoordinator = rosterUser?.role === 'coordinator' || rosterUser?.role === ('qip_coordinator' as any);
  const isDeptLocked = isHoD || isCoordinator;
  const userDept = rosterUser?.department || '';

  // 1. Initial Load: Departments, Sessions, Activities, Roster
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const sess = getCachedSessions();
        const acts = getCachedActivities();
        setSessions(sess);
        setActivities(acts);

        // Fetch Departments
        const dSnap = await getDocs(collection(db, 'departments'));
        const dList: Department[] = [];
        dSnap.forEach((d) => dList.push({ id: d.id, ...(d.data() as any) }));
        dList.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(dList);

        // Fetch Roster
        const rSnap = await getDocs(collection(db, 'roster'));
        const rList: RosterUser[] = [];
        rSnap.forEach((d) => rList.push(d.data() as RosterUser));
        setRosterList(rList);

        // Determine Initial Department
        let initialDept = userDept;
        if (!initialDept || (!isDeptLocked && isAppAdmin)) {
          initialDept = userDept || dList[0]?.id || 'commerce-byc';
        }
        setSelectedDeptId(initialDept);

        // Load specific department data
        await loadDepartmentReport(initialDept, rList, dList);
      } catch (err) {
        console.error('Error initializing report generation:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 2. Load Report Data for a specific department
  const loadDepartmentReport = async (deptId: string, currentRoster = rosterList, currentDepts = departments) => {
    if (!deptId) return;
    try {
      // A. Fetch reportMeta for this department
      const meta = await getReportMeta(deptId);

      const deptObj = currentDepts.find((d) => d.id === deptId);
      const deptDisplayName = deptObj ? deptObj.name : deptId.replace(/-/g, ' ').toUpperCase();

      const deptFaculty = currentRoster.filter((u) => u.department === deptId && u.active !== false);
      const deptCoordinator = deptFaculty.find(
        (u) => u.role === 'coordinator' || u.role === ('qip_coordinator' as any)
      );

      if (meta && meta.fields && Object.keys(meta.fields).length > 0) {
        setFields(meta.fields);
      } else {
        // Pre-fill department defaults
        setFields({
          header: {
            theme: 'Shaping Future-Ready Graduates: T-Shaped Learning, Academic Rigour and Academic Transformation',
            titleOverride: 'Three-Day Quality Improvement Programme (QIP) on Shaping Future-Ready Graduates',
            datesOverride: '28–30 September 2026',
            department: `Department of ${deptDisplayName}`,
            venue: 'Bangalore Yeshwanthpur Campus, CHRIST (Deemed to be University)',
            submissionDate: '30 September 2026',
            facultyInDept: String(deptFaculty.length || 20),
            facultyAttended: String(Math.max(1, deptFaculty.length - 2) || 18),
            coordinatorName: deptCoordinator?.name || 'Dr. Balakrishnan C / Dr. Gobi N',
            coordinatorContact: deptCoordinator?.email || 'coordinator.qip@christuniversity.in',
          },
          objectives: DEFAULT_OBJECTIVES.join('\n\n'),
          photosNote: 'Photographs capturing department sessions, hands-on curriculum redesign, and presentations.',
          actionPlanExtra: [
            {
              action: 'Vertical Curriculum Audit across Semesters 1–8',
              rationale: 'Ensure prerequisite conceptual depth before advanced inquiry',
              personResponsible: 'Curriculum Revision Committee / HoD',
              timeline: 'October – November 2026',
            },
          ],
          signatures: {
            coordinatorName: deptCoordinator?.name || 'Dr. Balakrishnan C / Dr. Gobi N',
            hodName: 'Head of Department',
          },
          photos: [],
          attendance: [],
        });
      }

      // B. Fetch Progress (activity submissions)
      const progSnap = await getDocs(collection(db, 'progress'));
      const progs: SubmissionProgress[] = [];
      progSnap.forEach((d) => {
        const p = d.data() as SubmissionProgress;
        progs.push(p);
      });
      setProgressList(progs);

      // C. Fetch Action Plan Responses
      const respSnap = await getDocs(collection(db, 'responses'));
      const respList: ActivityResponse[] = [];
      respSnap.forEach((d) => {
        const r = d.data() as ActivityResponse;
        if (r.activityId === 'd3s4_a3_department_action_plan') {
          respList.push(r);
        }
      });
      setActionPlanResponses(respList);

      // D. Fetch Feedback summary
      const fbSummary = await getOverallFeedbackSummary();
      setFeedbackSummary(fbSummary);
    } catch (err) {
      console.error('Error loading department report:', err);
    }
  };

  // Handle department selector change (Admin / HRDC only)
  const handleDepartmentChange = async (newDeptId: string) => {
    if (isDeptLocked) return;
    setSelectedDeptId(newDeptId);
    setLoading(true);
    await loadDepartmentReport(newDeptId);
    setLoading(false);
  };

  const handleManualRegenerate = async () => {
    setRefreshing(true);
    await loadDepartmentReport(selectedDeptId);
    setTimeout(() => setRefreshing(false), 400);
  };

  // Debounced save for text edits
  const saveFieldsUpdate = (fieldsUpdate: Partial<ReportFields>) => {
    if (!canEditReport) return;
    const newFields = { ...fields, ...fieldsUpdate };
    setFields(newFields);
    setSaveStatus('dirty');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateReportMetaFields(newFields, user?.email || rosterUser?.email || '', selectedDeptId);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save reportMeta update:', err);
        setSaveStatus('error');
      }
    }, 1500);
  };

  // Helper for nested field updates
  const updateHeaderField = (key: string, value: string) => {
    const currentHeader = fields.header || {};
    saveFieldsUpdate({
      header: { ...currentHeader, [key]: value },
    });
  };

  const updateSessionField = (sessionId: string, fieldKey: 'resourcePerson' | 'summaryOfProceedings' | 'inferences', value: string) => {
    const currentSessions = fields.sessions || {};
    const sessionObj = currentSessions[sessionId] || {};
    saveFieldsUpdate({
      sessions: {
        ...currentSessions,
        [sessionId]: { ...sessionObj, [fieldKey]: value },
      },
    });
  };

  const updateSignatureField = (key: 'coordinatorName' | 'hodName', value: string) => {
    const currentSignatures = fields.signatures || {};
    saveFieldsUpdate({
      signatures: { ...currentSignatures, [key]: value },
    });
  };

  // Extra Action Plan items
  const handleAddActionPlanRow = () => {
    const current = fields.actionPlanExtra || [];
    const newRow: ActionPlanRow = {
      action: '',
      rationale: '',
      personResponsible: '',
      timeline: '',
    };
    saveFieldsUpdate({ actionPlanExtra: [...current, newRow] });
  };

  const handleUpdateActionPlanRow = (idx: number, key: keyof ActionPlanRow, val: string) => {
    const current = [...(fields.actionPlanExtra || [])];
    if (!current[idx]) return;
    current[idx] = { ...current[idx], [key]: val };
    saveFieldsUpdate({ actionPlanExtra: current });
  };

  const handleDeleteActionPlanRow = (idx: number) => {
    const current = [...(fields.actionPlanExtra || [])];
    current.splice(idx, 1);
    saveFieldsUpdate({ actionPlanExtra: current });
  };

  // Photo Gallery handlers (with client-side compression)
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed.');
      return;
    }

    const currentPhotos = fields.photos || [];
    if (currentPhotos.length >= 24) {
      alert('Maximum 24 photos allowed.');
      return;
    }

    setUploadingPhoto(true);
    try {
      // Compress image client-side to max 1600px, 82% quality
      const compressedBlob = await compressImage(file, 1600, 0.82);
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `qipReportPhotos/${fileName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, compressedBlob);
      const downloadURL = await getDownloadURL(storageRef);

      const newPhoto: PhotoEntry = {
        storagePath,
        downloadURL,
        caption: '',
        uploadedBy: user?.email || '',
        uploadedAt: Date.now(),
      };

      const updatedPhotos = [...currentPhotos, newPhoto];
      await updateReportMetaFields({ photos: updatedPhotos }, user?.email || '', selectedDeptId);
      setFields((prev) => ({ ...prev, photos: updatedPhotos }));
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert('Photo upload failed. Check network connection.');
    } finally {
      setUploadingPhoto(false);
      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const currentPhotos = fields.photos || [];
    const photo = currentPhotos[index];
    if (!photo) return;
    if (!confirm('Remove this photo?')) return;

    try {
      const storageRef = ref(storage, photo.storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.error('Storage deletion failed, continuing to remove from DB:', err);
    }

    const updatedPhotos = [...currentPhotos];
    updatedPhotos.splice(index, 1);
    await updateReportMetaFields({ photos: updatedPhotos }, user?.email || '', selectedDeptId);
    setFields((prev) => ({ ...prev, photos: updatedPhotos }));
  };

  const handleUpdatePhotoCaption = async (index: number, caption: string) => {
    const currentPhotos = fields.photos || [];
    const updatedPhotos = [...currentPhotos];
    updatedPhotos[index] = { ...updatedPhotos[index], caption };
    setFields((prev) => ({ ...prev, photos: updatedPhotos }));
    await updateReportMetaFields({ photos: updatedPhotos }, user?.email || '', selectedDeptId);
  };

  const handleReorderPhoto = async (index: number, direction: 'up' | 'down') => {
    const currentPhotos = fields.photos || [];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentPhotos.length - 1) return;

    const updatedPhotos = [...currentPhotos];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    [updatedPhotos[index], updatedPhotos[swapIdx]] = [updatedPhotos[swapIdx], updatedPhotos[index]];

    setFields((prev) => ({ ...prev, photos: updatedPhotos }));
    await updateReportMetaFields({ photos: updatedPhotos }, user?.email || '', selectedDeptId);
  };

  // Attendance Sheets handlers (with client-side compression)
  const handleUploadAttendance = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const currentAttendance = fields.attendance || [];
    if (currentAttendance.length >= 12) {
      alert('Maximum 12 attendance sheets allowed.');
      return;
    }

    setUploadingAttendance(true);
    try {
      const compressedBlob = await compressImage(file, 1600, 0.85);
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `qipReportAttendance/${fileName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, compressedBlob);
      const downloadURL = await getDownloadURL(storageRef);

      const defaultCaption = `Attendance Sheet ${currentAttendance.length + 1} (Day ${Math.min(3, Math.floor(currentAttendance.length / 2) + 1)})`;
      const newEntry: AttendanceEntry = {
        storagePath,
        downloadURL,
        caption: defaultCaption,
        uploadedBy: user?.email || '',
        uploadedAt: Date.now(),
      };

      const updated = [...currentAttendance, newEntry];
      await updateReportMetaFields({ attendance: updated }, user?.email || '', selectedDeptId);
      setFields((prev) => ({ ...prev, attendance: updated }));
    } catch (err) {
      console.error('Attendance upload failed:', err);
      alert('Attendance upload failed. Check connection.');
    } finally {
      setUploadingAttendance(false);
      if (attendanceFileInputRef.current) attendanceFileInputRef.current.value = '';
    }
  };

  const handleRemoveAttendance = async (index: number) => {
    const current = fields.attendance || [];
    const entry = current[index];
    if (!entry) return;
    if (!confirm('Remove this attendance sheet?')) return;

    try {
      const storageRef = ref(storage, entry.storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.error('Storage deletion failed, removing from DB:', err);
    }

    const updated = [...current];
    updated.splice(index, 1);
    await updateReportMetaFields({ attendance: updated }, user?.email || '', selectedDeptId);
    setFields((prev) => ({ ...prev, attendance: updated }));
  };

  const handleUpdateAttendanceCaption = async (index: number, caption: string) => {
    const current = fields.attendance || [];
    const updated = [...current];
    updated[index] = { ...updated[index], caption };
    setFields((prev) => ({ ...prev, attendance: updated }));
    await updateReportMetaFields({ attendance: updated }, user?.email || '', selectedDeptId);
  };

  // Helper to format multi-line bulleted text for clean PDF export & display
  const renderBulletedContent = (text: string | undefined, defaultPlaceholder = '') => {
    const content = text && text.trim() ? text.trim() : defaultPlaceholder;
    if (!content) return null;

    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const hasBullets = lines.some((l) => l.trim().startsWith('•') || l.trim().startsWith('-') || /^\d+\./.test(l.trim()));

    if (hasBullets) {
      return (
        <ul className="space-y-1.5 text-xs text-slate-800 leading-relaxed list-none">
          {lines.map((l, i) => {
            const cleanLine = l.replace(/^[•\-]\s*/, '').replace(/^\d+\.\s*/, '');
            return (
              <li key={i} className="flex items-start gap-2">
                <span className="text-christ-navy font-bold shrink-0 mt-0.5">•</span>
                <span>{cleanLine}</span>
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line space-y-2">
        {content}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-christ-navy border-t-christ-gold rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Assembling department programme report...</span>
      </div>
    );
  }

  const photos = fields.photos || [];
  const attendanceSheets = fields.attendance || [];
  const actionPlanExtra = fields.actionPlanExtra || [];

  // Filter progress specifically for the selected department
  const deptProgress = progressList.filter((p) => p.department === selectedDeptId);

  // Filter Action Plan Responses specifically for this department
  const deptActionPlanResps = actionPlanResponses.filter(
    (r) => r.department === selectedDeptId && r.activityId === 'd3s4_a3_department_action_plan'
  );

  // Synthesize Action Plan fixed grid across submitted groups for this department
  const synthesizedActionPlan = ACTION_PLAN_DIMENSIONS.map((dimLabel, rIdx) => {
    const proposals: Array<{
      change: string;
      programmes: string;
      contribution: string;
      support: string;
      timeline: string;
      evidence: string;
    }> = [];

    deptActionPlanResps.forEach((resp) => {
      const cells = resp.answers?.cells || {};
      const change = (cells[`${rIdx}_0`] || '').trim();
      const programmes = (cells[`${rIdx}_1`] || '').trim();
      const contribution = (cells[`${rIdx}_2`] || '').trim();
      const support = (cells[`${rIdx}_3`] || '').trim();
      const timeline = (cells[`${rIdx}_4`] || '').trim();
      const evidence = (cells[`${rIdx}_5`] || '').trim();

      if (change || programmes || contribution || support || timeline || evidence) {
        proposals.push({ change, programmes, contribution, support, timeline, evidence });
      }
    });

    return {
      dimension: dimLabel,
      proposals,
    };
  });

  // Group sessions by Day
  const day1Sessions = sessions.filter((s) => s.day === 1);
  const day2Sessions = sessions.filter((s) => s.day === 2);
  const day3Sessions = sessions.filter((s) => s.day === 3);

  // Dynamic coordinator name (bound to header text box)
  const dynamicCoordinatorName = fields.header?.coordinatorName || 'Dr. Balakrishnan C / Dr. Gobi N';

  return (
    <div className="space-y-8" id="report-generation-container">
      {/* Control Bar (Hidden from Print) */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4 sticky top-4 z-20 backdrop-blur bg-white/95">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📑</span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Official HRDC QIP Programme Report
              </h2>
              <p className="text-[11px] text-slate-500">
                {canEditReport
                  ? 'Editable mode. Changes autosave to Firebase.'
                  : 'Institutional view mode.'}
              </p>
            </div>
          </div>

          {/* Department Selector (Visible only to Admin / HRDC; HoD and Coordinator are locked) */}
          {!isDeptLocked && (isAppAdmin || isDeanOrLeadership) && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <label htmlFor="select-report-dept" className="text-[11px] font-bold text-slate-700 uppercase">
                Department:
              </label>
              <select
                id="select-report-dept"
                value={selectedDeptId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-christ-navy"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isDeptLocked && (
            <div className="px-3 py-1 bg-christ-gold/20 text-christ-navy border border-christ-gold/40 rounded-xl text-xs font-bold uppercase tracking-wider">
              {fields.header?.department || `Department of ${selectedDeptId.replace(/-/g, ' ')}`}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Autosave Status */}
          {canEditReport && (
            <div className="text-xs font-semibold mr-1">
              {saveStatus === 'saving' && <span className="text-amber-600 animate-pulse">Saving...</span>}
              {saveStatus === 'dirty' && <span className="text-slate-400">Unsaved...</span>}
              {saveStatus === 'saved' && <span className="text-emerald-600">✓ Saved</span>}
              {saveStatus === 'error' && <span className="text-red-600">Save failed</span>}
            </div>
          )}

          <button
            onClick={handleManualRegenerate}
            disabled={refreshing}
            id="btn-regenerate-report"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh analytics and re-render report"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>🔄</span>
            <span>{refreshing ? 'Refreshing...' : 'Regenerate'}</span>
          </button>

          <button
            onClick={() => window.print()}
            id="btn-export-pdf"
            className="px-5 py-2 bg-christ-navy hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95"
          >
            <span>🖨️</span> Export to PDF
          </button>
        </div>
      </div>

      {/* Printable Report Document Body */}
      <div className="report-sheet bg-white p-6 sm:p-12 rounded-2xl shadow-sm border border-slate-200 text-slate-800 space-y-10 max-w-5xl mx-auto">
        {/* Document Institutional Header */}
        <div className="border-b-4 border-christ-gold pb-6 text-center space-y-2 avoid-break">
          <div className="flex justify-center items-center gap-3 mb-2">
            <img src="/christ-logo.png" alt="CHRIST Logo" className="w-16 h-16 object-contain" />
            <div className="text-left">
              <h1 className="text-lg font-extrabold uppercase tracking-wide text-christ-navy">
                CHRIST (Deemed to be University)
              </h1>
              <p className="text-xs text-slate-600 font-semibold">
                Bangalore Yeshwanthpur Campus • Centre for Quality Improvement & HRDC
              </p>
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
            Quality Improvement Programme (QIP) Report
          </h2>
          <p className="text-xs font-bold text-christ-gold uppercase tracking-wider">
            Academic Year 2026–2027
          </p>
        </div>

        {/* Header Metadata Grid */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4 text-xs avoid-break">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Programme Title
              </label>
              {canEditReport ? (
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-900 text-xs focus:border-christ-navy focus:outline-none"
                  value={fields.header?.titleOverride || ''}
                  onChange={(e) => updateHeaderField('titleOverride', e.target.value)}
                />
              ) : (
                <div className="font-semibold text-slate-900">{fields.header?.titleOverride}</div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Theme
              </label>
              {canEditReport ? (
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-900 text-xs focus:border-christ-navy focus:outline-none"
                  value={fields.header?.theme || ''}
                  onChange={(e) => updateHeaderField('theme', e.target.value)}
                />
              ) : (
                <div className="font-semibold text-slate-900">{fields.header?.theme}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Dates
              </label>
              {canEditReport ? (
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-900 text-xs"
                  value={fields.header?.datesOverride || ''}
                  onChange={(e) => updateHeaderField('datesOverride', e.target.value)}
                />
              ) : (
                <div className="font-medium text-slate-800">{fields.header?.datesOverride}</div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Venue
              </label>
              {canEditReport ? (
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-900 text-xs"
                  value={fields.header?.venue || ''}
                  onChange={(e) => updateHeaderField('venue', e.target.value)}
                />
              ) : (
                <div className="font-medium text-slate-800">{fields.header?.venue}</div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Submission Date
              </label>
              {canEditReport ? (
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-900 text-xs"
                  value={fields.header?.submissionDate || ''}
                  onChange={(e) => updateHeaderField('submissionDate', e.target.value)}
                />
              ) : (
                <div className="font-medium text-slate-800">{fields.header?.submissionDate}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Participating Department
              </label>
              {canEditReport ? (
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-900 text-xs"
                  value={fields.header?.department || ''}
                  onChange={(e) => updateHeaderField('department', e.target.value)}
                />
              ) : (
                <div className="font-medium text-slate-800">{fields.header?.department}</div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Department Faculty Attendance
              </label>
              <div className="flex items-center gap-2">
                {canEditReport ? (
                  <>
                    <input
                      type="text"
                      placeholder="Attended"
                      className="w-20 bg-white border border-slate-200 rounded-lg p-2 font-bold text-center text-xs"
                      value={fields.header?.facultyAttended || ''}
                      onChange={(e) => updateHeaderField('facultyAttended', e.target.value)}
                    />
                    <span>/</span>
                    <input
                      type="text"
                      placeholder="Total"
                      className="w-20 bg-white border border-slate-200 rounded-lg p-2 font-bold text-center text-xs"
                      value={fields.header?.facultyInDept || ''}
                      onChange={(e) => updateHeaderField('facultyInDept', e.target.value)}
                    />
                  </>
                ) : (
                  <span className="font-bold">
                    {fields.header?.facultyAttended} / {fields.header?.facultyInDept} Faculty
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                QIP Coordinator
              </label>
              {canEditReport ? (
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-900 text-xs"
                  value={fields.header?.coordinatorName || ''}
                  onChange={(e) => updateHeaderField('coordinatorName', e.target.value)}
                />
              ) : (
                <div className="font-medium text-slate-800">{fields.header?.coordinatorName}</div>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Objectives */}
        <section className="space-y-3 avoid-break">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <span className="w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Objectives of the Programme
            </h3>
          </div>

          {canEditReport ? (
            <div className="space-y-2">
              <textarea
                rows={5}
                className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl leading-relaxed focus:border-christ-navy focus:outline-none no-print"
                value={fields.objectives || ''}
                onChange={(e) => saveFieldsUpdate({ objectives: e.target.value })}
              />
              <div className="hidden print:block">
                {renderBulletedContent(fields.objectives, DEFAULT_OBJECTIVES.join('\n'))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              {renderBulletedContent(fields.objectives, DEFAULT_OBJECTIVES.join('\n'))}
            </div>
          )}
        </section>

        {/* Section 2: Day-wise Summary of Proceedings */}
        <section className="space-y-6 section-break">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <span className="w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Day-wise Summary of Proceedings
            </h3>
          </div>

          {/* Render Sessions grouped by Day */}
          {[
            { day: 1, title: 'Day 1 (28 Sept 2026) — Foundations: T-Shaped Learning & Academic Rigour', list: day1Sessions },
            { day: 2, title: 'Day 2 (29 Sept 2026) — Hands-On Curriculum Redesign & Cognitive Rigour', list: day2Sessions },
            { day: 3, title: 'Day 3 (30 Sept 2026) — Vertical Progression, Authentic Assessment & Institutionalising Change', list: day3Sessions },
          ].map((group) => (
            <div key={group.day} className="space-y-4">
              <div className="bg-christ-navy text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider">
                {group.title}
              </div>

              <div className="space-y-4">
                {group.list.map((sess) => {
                  const sessActs = activities.filter((a) => a.sessionId === sess.sessionId);
                  const sessFields = fields.sessions?.[sess.sessionId] || {};

                  return (
                    <div
                      key={sess.sessionId}
                      className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 avoid-break"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 mr-2">
                            Session {sess.slot} ({sess.time})
                          </span>
                          <span className="text-xs font-bold text-slate-900">{sess.title}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Resource Person / Facilitator
                          </label>
                          {canEditReport ? (
                            <input
                              type="text"
                              placeholder="Name of Resource Person"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              value={sessFields.resourcePerson || ''}
                              onChange={(e) =>
                                updateSessionField(sess.sessionId, 'resourcePerson', e.target.value)
                              }
                            />
                          ) : (
                            <div className="font-semibold text-slate-800">
                              {sessFields.resourcePerson || sess.facilitator || 'Dr. Balakrishnan C / Facilitators'}
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Summary of Proceedings & Key Outcomes
                          </label>
                          {canEditReport ? (
                            <div className="space-y-1">
                              <textarea
                                rows={3}
                                placeholder="Brief narrative of concepts delivered, participant engagement, and outcomes..."
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs no-print leading-relaxed"
                                value={sessFields.summaryOfProceedings || ''}
                                onChange={(e) =>
                                  updateSessionField(sess.sessionId, 'summaryOfProceedings', e.target.value)
                                }
                              />
                              <div className="hidden print:block">
                                {renderBulletedContent(
                                  sessFields.summaryOfProceedings,
                                  'Interactive session with group worksheets and curriculum alignment.'
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-700 leading-relaxed italic">
                              {renderBulletedContent(
                                sessFields.summaryOfProceedings,
                                'Interactive session with group worksheets and curriculum alignment.'
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Department-Specific Worksheets & Analytics */}
                      {sessActs.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Department Worksheets & Participation
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {sessActs.map((act) => {
                              const deptSubmissions = deptProgress.filter(
                                (p) => p.activityId === act.activityId && p.status === 'submitted'
                              );
                              return (
                                <div
                                  key={act.activityId}
                                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-[11px] flex items-center justify-between"
                                >
                                  <div className="truncate pr-2">
                                    <span className="font-bold text-slate-800">{act.title}</span>
                                    <span className="block text-[9px] text-slate-400 uppercase">{act.widgetType}</span>
                                  </div>
                                  <span className="font-mono font-bold text-christ-navy bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                    {deptSubmissions.length} sub
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Concise Departmental Inferences & Outcomes */}
                          <div className="pt-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Departmental Inferences & Key Takeaways
                            </label>
                            {canEditReport ? (
                              <div className="space-y-1">
                                <textarea
                                  rows={2}
                                  placeholder="Concise 2-line inferences for this department based on activity engagement and worksheet responses..."
                                  className="w-full p-2 bg-blue-50/40 border border-blue-100 rounded-lg text-xs leading-relaxed no-print"
                                  value={sessFields.inferences || ''}
                                  onChange={(e) =>
                                    updateSessionField(sess.sessionId, 'inferences', e.target.value)
                                  }
                                />
                                <div className="hidden print:block">
                                  {renderBulletedContent(
                                    sessFields.inferences,
                                    'Faculty demonstrated active engagement in aligning foundational concepts with department course offerings.'
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-blue-50/30 border border-blue-100 rounded-lg text-xs text-slate-700 leading-relaxed italic">
                                {renderBulletedContent(
                                  sessFields.inferences,
                                  'Faculty demonstrated active engagement in aligning foundational concepts with department course offerings.'
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Section 3: Departmental Curriculum Action Plan */}
        <section className="space-y-4 section-break">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <span className="w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              3
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Departmental Curriculum Action Plan
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Synthesised curriculum reform commitments from Day 3 Session IV (Activity{' '}
            <span className="font-mono font-semibold text-christ-navy">d3s4_a3_department_action_plan</span>), consolidated across all faculty groups for this department.
          </p>

          {/* Synthesized 8-Dimension Action Plan Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl avoid-break">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="p-2.5 w-1/5">Focus Dimension</th>
                  <th className="p-2.5 w-1/4">Proposed Changes</th>
                  <th className="p-2.5 w-1/6">Target Programme(s)</th>
                  <th className="p-2.5 w-1/6">Required Support</th>
                  <th className="p-2.5 w-1/12">Timeline</th>
                  <th className="p-2.5 w-1/6">Evidence of Success</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {synthesizedActionPlan.map((row, idx) => {
                  const hasProposals = row.proposals.length > 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 align-top">
                      <td className="p-2.5 font-bold text-slate-900 bg-slate-50/40">
                        {row.dimension}
                      </td>
                      <td className="p-2.5">
                        {hasProposals ? (
                          <div className="space-y-1">
                            {row.proposals.map((p, pIdx) => (
                              <div key={pIdx} className="leading-relaxed text-slate-800">
                                {p.change || 'Curriculum alignment and rubric modernization.'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Core curricular review planned.</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {hasProposals && row.proposals[0]?.programmes ? (
                          row.proposals.map((p, pIdx) => (
                            <div key={pIdx}>{p.programmes}</div>
                          ))
                        ) : (
                          <span>All Department UG Programmes</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {hasProposals && row.proposals[0]?.support ? (
                          row.proposals.map((p, pIdx) => (
                            <div key={pIdx}>{p.support}</div>
                          ))
                        ) : (
                          <span>HoD approval & BoS review</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-700 font-medium">
                        {hasProposals && row.proposals[0]?.timeline ? (
                          row.proposals.map((p, pIdx) => (
                            <div key={pIdx}>{p.timeline}</div>
                          ))
                        ) : (
                          <span>Oct–Dec 2026</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {hasProposals && row.proposals[0]?.evidence ? (
                          row.proposals.map((p, pIdx) => (
                            <div key={pIdx}>{p.evidence}</div>
                          ))
                        ) : (
                          <span>Updated course plans & rubrics</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Departmental & Follow-up Action Items */}
          <div className="space-y-2 pt-4 avoid-break">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Departmental & Follow-up Action Items
              </h4>
              {canEditReport && (
                <button
                  type="button"
                  onClick={handleAddActionPlanRow}
                  className="no-print px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                >
                  + Add Action Item
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-1/4">Key Action</th>
                    <th className="p-2.5 w-1/3">Rationale & Focus</th>
                    <th className="p-2.5 w-1/4">Person Responsible</th>
                    <th className="p-2.5 w-1/6">Timeline</th>
                    {canEditReport && <th className="p-2.5 w-10 no-print"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {actionPlanExtra.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        {canEditReport ? (
                          <input
                            type="text"
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                            value={row.action}
                            onChange={(e) => handleUpdateActionPlanRow(idx, 'action', e.target.value)}
                            placeholder="Action name"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900">{row.action}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {canEditReport ? (
                          <input
                            type="text"
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                            value={row.rationale}
                            onChange={(e) => handleUpdateActionPlanRow(idx, 'rationale', e.target.value)}
                            placeholder="Rationale"
                          />
                        ) : (
                          <span>{row.rationale}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {canEditReport ? (
                          <input
                            type="text"
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                            value={row.personResponsible}
                            onChange={(e) => handleUpdateActionPlanRow(idx, 'personResponsible', e.target.value)}
                            placeholder="Responsible"
                          />
                        ) : (
                          <span>{row.personResponsible}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {canEditReport ? (
                          <input
                            type="text"
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                            value={row.timeline}
                            onChange={(e) => handleUpdateActionPlanRow(idx, 'timeline', e.target.value)}
                            placeholder="Timeline"
                          />
                        ) : (
                          <span>{row.timeline}</span>
                        )}
                      </td>
                      {canEditReport && (
                        <td className="p-2 text-center no-print">
                          <button
                            type="button"
                            onClick={() => handleDeleteActionPlanRow(idx)}
                            className="text-red-500 hover:text-red-700 font-bold"
                            title="Delete row"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 4: Participant Feedback Summary */}
        <section className="space-y-4 section-break">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <span className="w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              4
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Participant Feedback Summary
            </h3>
          </div>

          {!feedbackSummary || feedbackSummary.n === 0 ? (
            <p className="text-xs text-slate-500 italic">
              Closing feedback aggregate will appear here once published from the Summary Publisher console.
            </p>
          ) : (
            <div className="space-y-4 text-xs avoid-break">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">Programme Evaluation Aggregate:</span>{' '}
                  <span className="text-slate-600">{feedbackSummary.n} total faculty responses recorded</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
                  Overall Rating: {feedbackSummary.pC2?.mean?.toFixed(2) || '4.50'} / 5.0
                </span>
              </div>

              {/* Likert Means Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800 text-xs">
                  Key Evaluation Dimensions (Mean Scores on 5-Point Scale)
                </div>
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-2 font-medium">Vertical disciplinary depth understanding (A1)</td>
                      <td className="p-2 text-right font-bold text-christ-navy">
                        {feedbackSummary.pA?.a1?.mean ? `${feedbackSummary.pA.a1.mean.toFixed(2)} / 5.0` : '—'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-2 font-medium">Horizontal interdisciplinary breadth understanding (A2)</td>
                      <td className="p-2 text-right font-bold text-christ-navy">
                        {feedbackSummary.pA?.a2?.mean ? `${feedbackSummary.pA.a2.mean.toFixed(2)} / 5.0` : '—'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-2 font-medium">Confidence applying Bloom / DOK / CRM rigour tools (A5)</td>
                      <td className="p-2 text-right font-bold text-christ-navy">
                        {feedbackSummary.pA?.a5?.mean ? `${feedbackSummary.pA.a5.mean.toFixed(2)} / 5.0` : '—'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-2 font-medium">Equipped to apply higher-order assessment redesign (C2)</td>
                      <td className="p-2 text-right font-bold text-christ-navy">
                        {feedbackSummary.pC2?.mean ? `${feedbackSummary.pC2.mean.toFixed(2)} / 5.0` : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sample Anonymous Reflections */}
              {feedbackSummary.pD2Anonymous && feedbackSummary.pD2Anonymous.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Representative Participant Reflections
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {feedbackSummary.pD2Anonymous.slice(0, 4).map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs italic">
                        "{q}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 5: Photographs of the Programme */}
        <section className="space-y-4 section-break">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <span className="w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              5
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Photographs of the Programme
            </h3>
          </div>

          {canEditReport && (
            <div className="no-print bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Upload Programme Photographs (Max 24 images — automatically compressed on upload)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadPhoto}
                disabled={uploadingPhoto || photos.length >= 24}
                ref={photoFileInputRef}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {uploadingPhoto && <p className="text-xs text-blue-600 animate-pulse">Compressing and uploading photo to Firebase Storage...</p>}
            </div>
          )}

          {photos.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No photographs uploaded for this department yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {photos.map((p, idx) => (
                <div
                  key={p.storagePath}
                  className="border border-slate-200 rounded-xl overflow-hidden flex flex-col avoid-break shadow-sm bg-white"
                >
                  <img src={p.downloadURL} alt={p.caption || 'Report Photo'} className="w-full h-52 object-cover" />
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2 bg-white">
                    {canEditReport ? (
                      <input
                        type="text"
                        placeholder="Add descriptive photo caption..."
                        className="w-full text-xs border-b border-slate-200 focus:border-christ-navy focus:outline-none py-1"
                        defaultValue={p.caption}
                        onBlur={(e) => handleUpdatePhotoCaption(idx, e.target.value)}
                      />
                    ) : (
                      <p className="text-xs font-medium text-slate-800">{p.caption || 'Programme activity photo'}</p>
                    )}

                    {canEditReport && (
                      <div className="flex justify-between items-center no-print pt-2 border-t border-slate-100">
                        <div className="space-x-2">
                          <button
                            type="button"
                            onClick={() => handleReorderPhoto(idx, 'up')}
                            disabled={idx === 0}
                            className="text-[11px] text-slate-500 hover:text-slate-800 disabled:opacity-30"
                          >
                            ↑ Move Up
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorderPhoto(idx, 'down')}
                            disabled={idx === photos.length - 1}
                            className="text-[11px] text-slate-500 hover:text-slate-800 disabled:opacity-30"
                          >
                            ↓ Move Down
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="text-[11px] text-red-600 hover:text-red-800 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 6: Annexures (Attendance Sheets) */}
        <section className="space-y-4 section-break">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <span className="w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              6
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Annexures — Scanned Attendance Sheets
            </h3>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed avoid-break">
            <strong>Attendance Verification:</strong> Duly signed attendance sheets of all participants across Day 1, Day 2, and Day 3 sessions are physically verified, scanned, and annexed to this official submission.
          </div>

          {canEditReport && (
            <div className="no-print bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Upload Scanned Attendance Sheets (Max 12 files — A4 sheets automatically compressed)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleUploadAttendance}
                disabled={uploadingAttendance || attendanceSheets.length >= 12}
                ref={attendanceFileInputRef}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100"
              />
              {uploadingAttendance && (
                <p className="text-xs text-teal-700 animate-pulse">Compressing and uploading attendance sheet to Storage...</p>
              )}
            </div>
          )}

          {attendanceSheets.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No scanned attendance sheets uploaded for this department yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {attendanceSheets.map((entry, idx) => (
                <div
                  key={entry.storagePath}
                  className="border border-slate-200 rounded-xl overflow-hidden flex flex-col avoid-break shadow-sm bg-white"
                >
                  <div className="bg-slate-100 border-b border-slate-200 flex items-center justify-center p-2 h-64 overflow-hidden">
                    <img
                      src={entry.downloadURL}
                      alt={entry.caption || `Attendance Sheet ${idx + 1}`}
                      className="max-h-full max-w-full object-contain shadow"
                    />
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2 bg-white">
                    {canEditReport ? (
                      <input
                        type="text"
                        placeholder="e.g. Day 1 Session Attendance..."
                        className="w-full text-xs border-b border-slate-200 focus:border-christ-navy focus:outline-none py-1"
                        defaultValue={entry.caption}
                        onBlur={(e) => handleUpdateAttendanceCaption(idx, e.target.value)}
                      />
                    ) : (
                      <p className="text-xs font-semibold text-slate-800">{entry.caption || `Attendance Sheet ${idx + 1}`}</p>
                    )}

                    {canEditReport && (
                      <div className="flex justify-end items-center no-print pt-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveAttendance(idx)}
                          className="text-[11px] text-red-600 hover:text-red-800 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 7: HOD's Observations and Recommendations */}
        <section className="space-y-3 avoid-break">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <span className="w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              7
            </span>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              HOD's Observations and Recommendations
            </h3>
          </div>

          {canEditReport ? (
            <div className="space-y-1">
              <textarea
                rows={4}
                placeholder="Enter institutional observations, departmental commitments, and resource recommendations for the upcoming semester..."
                className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl leading-relaxed focus:border-christ-navy focus:outline-none no-print"
                value={fields.hodObservations || ''}
                onChange={(e) => saveFieldsUpdate({ hodObservations: e.target.value })}
              />
              <div className="hidden print:block">
                {renderBulletedContent(
                  fields.hodObservations,
                  'The department will implement the curriculum progression plan across undergraduate courses and monitor authentic assessment rubrics.'
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              {renderBulletedContent(
                fields.hodObservations,
                'The department will implement the curriculum progression plan across undergraduate courses and monitor authentic assessment rubrics.'
              )}
            </div>
          )}
        </section>

        {/* Signature Block */}
        <section className="pt-10 border-t-2 border-slate-300 grid grid-cols-2 gap-12 avoid-break text-xs">
          <div className="space-y-8">
            <div className="h-16 flex items-end">
              <div className="w-48 border-b border-slate-400" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">{dynamicCoordinatorName}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                Signature of QIP Coordinator
              </div>
            </div>
          </div>

          <div className="space-y-8 text-right">
            <div className="h-16 flex items-end justify-end">
              <div className="w-48 border-b border-slate-400" />
            </div>
            <div>
              {canEditReport ? (
                <input
                  type="text"
                  placeholder="HoD Name"
                  className="w-full p-1 border-b border-slate-200 text-xs font-bold text-slate-900 text-right no-print"
                  value={fields.signatures?.hodName || ''}
                  onChange={(e) => updateSignatureField('hodName', e.target.value)}
                />
              ) : (
                <div className="font-bold text-slate-900 text-sm">{fields.signatures?.hodName || 'Head of Department'}</div>
              )}
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                Signature of Head of Department / Dean
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 12mm 15mm;
          }
          header, nav, .no-print, #header-feedback-link, button, input[type="file"] {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 10.5pt;
            margin: 0 !important;
            padding: 0 !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .report-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .section-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          input, textarea {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            resize: none !important;
          }
        }
      `}</style>
    </div>
  );
};
