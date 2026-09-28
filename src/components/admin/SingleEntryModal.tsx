import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toDepartmentId } from '../../utils/department';
import {
  insertSingleDepartment,
  insertSingleFaculty,
  validateDepartmentInput,
  validateFacultyInput,
  NewFacultyInput,
} from '../../services/departmentRosterService';
import { Department, Role, AdminType } from '../../types';

interface SingleEntryModalProps {
  isOpen: boolean;
  initialTab?: 'department' | 'faculty';
  departments: Department[];
  existingEmails: Set<string>;
  existingDeptIds: Set<string>;
  onClose: () => void;
  onSuccess: (type: 'department' | 'faculty', message: string) => void;
  userDept?: string;
  canManageAllDepts?: boolean;
}

export const SingleEntryModal: React.FC<SingleEntryModalProps> = ({
  isOpen,
  initialTab = 'faculty',
  departments,
  existingEmails,
  existingDeptIds,
  onClose,
  onSuccess,
  userDept,
  canManageAllDepts = true,
}) => {
  const { user } = useAuth();
  const actorEmail = user?.email || 'appadmin@christuniversity.in';

  const [activeTab, setActiveTab] = useState<'department' | 'faculty'>(initialTab);

  // Department Form State
  const [deptName, setDeptName] = useState('');
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Faculty Form State
  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyDeptId, setFacultyDeptId] = useState('');
  const [facultyRole, setFacultyRole] = useState<Role>('participant');
  const [facultyAdminType, setFacultyAdminType] = useState<AdminType>('app_admin');
  const [facultyActive, setFacultyActive] = useState(true);
  const [facultyAllowUpdate, setFacultyAllowUpdate] = useState(false);
  const [facultySubmitting, setFacultySubmitting] = useState(false);
  const [facultyError, setFacultyError] = useState<string | null>(null);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(!canManageAllDepts ? 'faculty' : initialTab);
      // Preselect scoped user department if available, or first department
      if (userDept) {
        setFacultyDeptId(userDept);
      } else if (departments.length > 0 && !facultyDeptId) {
        setFacultyDeptId(departments[0].id);
      }
    }
  }, [isOpen, initialTab, departments, userDept, canManageAllDepts]);

  if (!isOpen) return null;

  // Real-time calculations
  const deptSlug = toDepartmentId(deptName);
  const isDuplicateDept = deptSlug ? existingDeptIds.has(deptSlug) : false;
  const cleanedEmail = facultyEmail.trim().toLowerCase();
  const isDuplicateEmail = cleanedEmail ? existingEmails.has(cleanedEmail) : false;
  const isEmailValidDomain = /^[a-z0-9._%+-]+@christuniversity\.in$/.test(cleanedEmail);

  // Handle ESC key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // 1. Handle Department Submission
  const handleDepartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);

    const validation = validateDepartmentInput(deptName);
    if (!validation.valid) {
      setDeptError(Object.values(validation.errors)[0]);
      return;
    }

    if (isDuplicateDept) {
      setDeptError(`Department ID "${deptSlug}" already exists in the system.`);
      return;
    }

    setDeptSubmitting(true);
    try {
      const created = await insertSingleDepartment(deptName, actorEmail);
      setDeptName('');
      onSuccess('department', `Department "${created.name}" (${created.id}) added successfully!`);
      // Automatically select the new department in the faculty form
      setFacultyDeptId(created.id);
    } catch (err: any) {
      console.error('Failed to create department:', err);
      setDeptError(err.message || 'Failed to create department');
    } finally {
      setDeptSubmitting(false);
    }
  };

  // 2. Handle Faculty Submission
  const handleFacultySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFacultyError(null);

    const input: NewFacultyInput = {
      name: facultyName.trim(),
      email: cleanedEmail,
      departmentId: facultyDeptId,
      role: facultyRole,
      adminType: facultyRole === 'admin' ? facultyAdminType : null,
      active: facultyActive,
    };

    const validation = validateFacultyInput(input);
    if (!validation.valid) {
      setFacultyError(Object.values(validation.errors)[0]);
      return;
    }

    if (isDuplicateEmail && !facultyAllowUpdate) {
      setFacultyError(`Email "${cleanedEmail}" is already registered. Please check "Update existing record" to overwrite.`);
      return;
    }

    setFacultySubmitting(true);
    try {
      const created = await insertSingleFaculty(input, actorEmail, {
        allowUpdate: facultyAllowUpdate,
      });

      // Reset form
      setFacultyName('');
      setFacultyEmail('');
      setFacultyRole('participant');
      setFacultyAdminType('app_admin');
      setFacultyActive(true);
      setFacultyAllowUpdate(false);

      onSuccess(
        'faculty',
        `Faculty member "${created.name}" (${created.email}) ${facultyAllowUpdate && isDuplicateEmail ? 'updated' : 'registered'} successfully!`
      );
    } catch (err: any) {
      console.error('Failed to create/update faculty:', err);
      if (err.code === 'FACULTY_EXISTS') {
        setFacultyError(`Faculty with email "${cleanedEmail}" already exists. Check "Update existing record" to update.`);
      } else {
        setFacultyError(err.message || 'Failed to save faculty record');
      }
    } finally {
      setFacultySubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="single-entry-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-christ-navy px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner">
              {activeTab === 'faculty' ? '👤' : '🏛️'}
            </div>
            <div>
              <h2 id="single-entry-title" className="text-base font-bold tracking-tight">
                Single-Entry Data Management
              </h2>
              <p className="text-xs text-slate-300">
                Register individual departments and faculty details into QIP 2026
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            id="close-single-entry-modal-btn"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        {canManageAllDepts && (
          <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3">
            <button
              type="button"
              id="tab-btn-faculty"
              onClick={() => setActiveTab('faculty')}
              className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition ${
                activeTab === 'faculty'
                  ? 'border-christ-navy text-christ-navy bg-white rounded-t-lg -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>👤</span> Add Faculty Member
            </button>
            <button
              type="button"
              id="tab-btn-department"
              onClick={() => setActiveTab('department')}
              className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition ${
                activeTab === 'department'
                  ? 'border-christ-navy text-christ-navy bg-white rounded-t-lg -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🏛️</span> Add Department
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6">
          {/* TAB 1: FACULTY ENTRY */}
          {activeTab === 'faculty' && (
            <form onSubmit={handleFacultySubmit} className="space-y-4">
              {facultyError && (
                <div
                  id="faculty-error-alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-start gap-2"
                >
                  <span className="text-red-500 font-bold">⚠️</span>
                  <div className="flex-1">{facultyError}</div>
                </div>
              )}

              {/* Duplicate User Warning & Action */}
              {isDuplicateEmail && (
                <div
                  id="faculty-duplicate-warning"
                  className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-bold">ℹ️</span>
                    <span>
                      <strong>{cleanedEmail}</strong> is already registered in the roster.
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-amber-950">
                    <input
                      type="checkbox"
                      id="faculty-allow-update-checkbox"
                      checked={facultyAllowUpdate}
                      onChange={(e) => setFacultyAllowUpdate(e.target.checked)}
                      className="rounded border-amber-300 text-christ-navy focus:ring-christ-navy"
                    />
                    <span>Update existing record</span>
                  </label>
                </div>
              )}

              {/* Faculty Name */}
              <div>
                <label htmlFor="faculty-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Faculty Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="faculty-name-input"
                  type="text"
                  required
                  placeholder="e.g. Dr. Balakrishnan C"
                  value={facultyName}
                  onChange={(e) => setFacultyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-christ-navy/30 focus:border-christ-navy transition"
                />
              </div>

              {/* Faculty Email with domain validation chip */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="faculty-email-input" className="block text-xs font-semibold text-slate-700">
                    CHRIST Institutional Email ID <span className="text-red-500">*</span>
                  </label>
                  {cleanedEmail && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isEmailValidDomain
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isEmailValidDomain ? '✓ Valid CHRIST domain' : '⚠️ Must end in @christuniversity.in'}
                    </span>
                  )}
                </div>
                <input
                  id="faculty-email-input"
                  type="email"
                  required
                  placeholder="e.g. firstname.lastname@christuniversity.in"
                  value={facultyEmail}
                  onChange={(e) => setFacultyEmail(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-lg border transition focus:outline-none focus:ring-2 ${
                    cleanedEmail && !isEmailValidDomain
                      ? 'border-amber-400 focus:ring-amber-200'
                      : 'border-slate-300 focus:ring-christ-navy/30 focus:border-christ-navy'
                  }`}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Only official <code className="text-slate-600 font-semibold">@christuniversity.in</code> Google Workspace accounts are permitted.
                </p>
              </div>

              {/* Department Selector with Quick Add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="faculty-department-select" className="block text-xs font-semibold text-slate-700">
                    Assigned Department <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('department')}
                    className="text-[11px] text-christ-navy hover:underline font-bold flex items-center gap-1"
                  >
                    <span>+</span> Register New Department
                  </button>
                </div>
                {!canManageAllDepts && userDept ? (
                  <div className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-semibold flex items-center justify-between">
                    <span>{departments.find((d) => d.id === userDept)?.name || userDept}</span>
                    <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded-full">
                      Locked to your department
                    </span>
                  </div>
                ) : (
                  <select
                    id="faculty-department-select"
                    value={facultyDeptId}
                    onChange={(e) => setFacultyDeptId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-christ-navy/30 focus:border-christ-navy bg-white transition"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assigned Workshop Role <span className="text-red-500">*</span>
                </label>
                <div className={`grid gap-2.5 ${canManageAllDepts ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                  <button
                    type="button"
                    onClick={() => setFacultyRole('participant')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                      facultyRole === 'participant'
                        ? 'border-christ-navy bg-blue-50/60 ring-1 ring-christ-navy'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Participant</span>
                      {facultyRole === 'participant' && <span className="text-christ-navy text-xs">●</span>}
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      Completes activities
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFacultyRole('hod')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                      facultyRole === 'hod'
                        ? 'border-purple-600 bg-purple-50/60 ring-1 ring-purple-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">HoD</span>
                      {facultyRole === 'hod' && <span className="text-purple-600 text-xs">●</span>}
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      Gates & live tracker
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFacultyRole('coordinator')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                      facultyRole === 'coordinator'
                        ? 'border-teal-600 bg-teal-50/60 ring-1 ring-teal-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">QIP Coordinator</span>
                      {facultyRole === 'coordinator' && <span className="text-teal-600 text-xs">●</span>}
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      Gates & dept reports
                    </span>
                  </button>

                  {canManageAllDepts && (
                    <button
                      type="button"
                      onClick={() => setFacultyRole('admin')}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                        facultyRole === 'admin'
                          ? 'border-amber-600 bg-amber-50/60 ring-1 ring-amber-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Admin</span>
                        {facultyRole === 'admin' && <span className="text-amber-600 text-xs">●</span>}
                      </div>
                      <span className="text-[10px] text-slate-500 leading-tight">
                        System / Leadership
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Admin Type (Visible only when Role == Admin) */}
              {facultyRole === 'admin' && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 animate-in fade-in duration-150">
                  <label htmlFor="faculty-admin-type-select" className="block text-xs font-bold text-amber-950">
                    Administrative Sub-Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="faculty-admin-type-select"
                    value={facultyAdminType}
                    onChange={(e) => setFacultyAdminType(e.target.value as AdminType)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="app_admin">App Admin — Full System Administration & Onboarding</option>
                    <option value="dean">Dean — Institutional Oversight (View-Only)</option>
                    <option value="associate_dean">Associate Dean — Institutional Oversight (View-Only)</option>
                    <option value="hrdc">HRDC — Quality Programme Leadership (View-Only)</option>
                  </select>
                  <p className="text-[11px] text-amber-800">
                    Per SPEC §2: Deans, Associate Deans, and HRDC have read-only analytics access across all campus departments.
                  </p>
                </div>
              )}

              {/* Active Status Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Status: Account Active</span>
                  <span className="text-[11px] text-slate-400">
                    Inactive faculty cannot sign in or submit responses.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="faculty-active-toggle"
                    checked={facultyActive}
                    onChange={(e) => setFacultyActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={facultySubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="faculty-submit-btn"
                  disabled={facultySubmitting || (isDuplicateEmail && !facultyAllowUpdate)}
                  className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 ${
                    facultySubmitting || (isDuplicateEmail && !facultyAllowUpdate)
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-christ-navy hover:bg-slate-800 text-white'
                  }`}
                >
                  {facultySubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : facultyAllowUpdate && isDuplicateEmail ? (
                    'Update Faculty Record'
                  ) : (
                    'Save Faculty Member'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: DEPARTMENT ENTRY */}
          {activeTab === 'department' && (
            <form onSubmit={handleDepartmentSubmit} className="space-y-4">
              {deptError && (
                <div
                  id="dept-error-alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-start gap-2"
                >
                  <span className="text-red-500 font-bold">⚠️</span>
                  <div className="flex-1">{deptError}</div>
                </div>
              )}

              {/* Department Name */}
              <div>
                <label htmlFor="dept-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="dept-name-input"
                  type="text"
                  required
                  placeholder="e.g. Media Studies or Mechanical Engineering"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-christ-navy/30 focus:border-christ-navy transition"
                />
              </div>

              {/* Live Normalized Slug / ID Preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Computed Department ID (Slug):</span>
                  {deptSlug && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isDuplicateDept
                          ? 'bg-red-100 text-red-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isDuplicateDept ? 'Already exists' : 'Available'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <code
                    id="dept-slug-preview"
                    className="font-mono text-xs font-bold text-christ-navy bg-white px-2.5 py-1 rounded border border-slate-200 flex-1 truncate"
                  >
                    {deptSlug || 'e.g. computer-science'}
                  </code>
                </div>
                <p className="text-[11px] text-slate-400">
                  Slug normalized per SPEC §3 / §5: lowercase, non-alphanumerics replaced with hyphens.
                </p>
              </div>

              {/* Campus Indicator */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="font-semibold text-slate-700 block">Campus</span>
                  <span className="text-slate-400 text-[11px]">Fixed for Bangalore Yeshwanthpur Campus</span>
                </div>
                <span className="bg-christ-navy text-white text-[11px] font-bold px-3 py-1 rounded-md">
                  BYC
                </span>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={deptSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="dept-submit-btn"
                  disabled={deptSubmitting || isDuplicateDept || !deptName.trim()}
                  className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 ${
                    deptSubmitting || isDuplicateDept || !deptName.trim()
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-christ-navy hover:bg-slate-800 text-white'
                  }`}
                >
                  {deptSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Department'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
