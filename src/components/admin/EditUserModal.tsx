import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { insertSingleFaculty } from '../../services/departmentRosterService';
import { RosterUser, Department, Role, AdminType } from '../../types';

interface EditUserModalProps {
  isOpen: boolean;
  targetUser: RosterUser | null;
  departments: Department[];
  isAppAdmin: boolean;
  userDept?: string;
  existingCoordinators?: Map<string, RosterUser>;
  onClose: () => void;
  onSuccess: (updatedUser: RosterUser, message: string) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  targetUser,
  departments,
  isAppAdmin,
  userDept,
  existingCoordinators,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const actorEmail = user?.email || 'admin@christuniversity.in';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState<Role>('participant');
  const [adminType, setAdminType] = useState<AdminType>('app_admin');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetUser && isOpen) {
      setName(targetUser.name || '');
      setEmail(targetUser.email || '');
      setDepartmentId(targetUser.department || userDept || '');
      setRole(targetUser.role || 'participant');
      setAdminType(targetUser.adminType || 'app_admin');
      setActive(targetUser.active !== false);
      setError(null);
    }
  }, [targetUser, isOpen, userDept]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Please enter a valid full name (at least 2 characters).');
      return;
    }

    const effectiveDept = isAppAdmin ? departmentId : (userDept || departmentId);
    if (!effectiveDept) {
      setError('Department is required.');
      return;
    }

    const existingCoord = existingCoordinators?.get(effectiveDept);
    if (
      role === 'coordinator' &&
      active &&
      existingCoord &&
      existingCoord.email.toLowerCase() !== targetUser.email.toLowerCase()
    ) {
      setError(
        `Department "${effectiveDept}" already has an assigned QIP Coordinator (${existingCoord.name || existingCoord.email}). Only one QIP Coordinator is allowed per department.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const updated = await insertSingleFaculty(
        {
          name: cleanName,
          email: targetUser.email,
          departmentId: effectiveDept,
          role,
          adminType: role === 'admin' ? adminType : null,
          active,
        },
        actorEmail,
        { allowUpdate: true }
      );

      onSuccess(updated, `Successfully updated details for ${cleanName}.`);
    } catch (err: any) {
      console.error('Error updating user details:', err);
      setError(err.message || 'Failed to update user details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-modal-title"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-lg border border-purple-200">
              ✏️
            </div>
            <div>
              <h3 id="edit-user-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Edit Faculty Details
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update profile, department, role, or active status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Email (Read-Only ID) */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Institutional Email (CHRIST Account)
            </label>
            <input
              type="text"
              disabled
              value={email}
              className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-2.5 bg-slate-100 text-slate-500 cursor-not-allowed font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Primary key ID for Google Workspace authentication.
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr Balakrishnan C"
              className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy focus:border-christ-navy"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Department *
            </label>
            {isAppAdmin ? (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.id})
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full text-xs font-bold rounded-lg border border-slate-200 p-2.5 bg-slate-100 text-slate-700">
                {departments.find((d) => d.id === userDept)?.name || userDept}
                <span className="ml-2 text-[10px] text-purple-700 font-semibold bg-purple-100 px-2 py-0.5 rounded-full">
                  Locked to your department
                </span>
              </div>
            )}
          </div>

          {/* Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy"
              >
                <option value="participant">Participant</option>
                <option value="coordinator">QIP Coordinator</option>
                <option value="hod">Head of Department (HoD)</option>
                {isAppAdmin && <option value="admin">Admin / Leadership</option>}
              </select>
              {role === 'coordinator' && active && existingCoordinators?.get(isAppAdmin ? departmentId : (userDept || departmentId)) && existingCoordinators.get(isAppAdmin ? departmentId : (userDept || departmentId))!.email.toLowerCase() !== targetUser.email.toLowerCase() && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-1.5 animate-in fade-in duration-150">
                  <span className="text-amber-600 font-bold text-xs mt-0.5">⚠️</span>
                  <span className="text-[11px] text-amber-800 leading-tight">
                    <strong>{existingCoordinators.get(isAppAdmin ? departmentId : (userDept || departmentId))!.name || existingCoordinators.get(isAppAdmin ? departmentId : (userDept || departmentId))!.email}</strong> is already assigned as the QIP Coordinator for this department.
                  </span>
                </div>
              )}
            </div>

            {/* Active Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Account Status *
              </label>
              <select
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
                className={`w-full text-xs font-bold rounded-lg border p-2.5 focus:ring-2 focus:ring-christ-navy ${
                  active
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
                }`}
              >
                <option value="true">✓ Active (Can participate & sign in)</option>
                <option value="false">✕ Inactive / Suspended</option>
              </select>
            </div>
          </div>

          {/* Admin Type (if role === admin) */}
          {role === 'admin' && isAppAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Admin Type *
              </label>
              <select
                value={adminType}
                onChange={(e) => setAdminType(e.target.value as AdminType)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy"
              >
                <option value="app_admin">App Admin (Full Administration)</option>
                <option value="dean">Dean (Leadership Read-Only)</option>
                <option value="associate_dean">Associate Dean (Leadership Read-Only)</option>
                <option value="hrdc">HRDC (Leadership Read-Only)</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-christ-navy hover:bg-slate-800 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? 'Saving changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
