import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { SingleEntryModal } from './SingleEntryModal';
import { EditUserModal } from './EditUserModal';
import { RosterUpload } from '../RosterUpload';
import { RosterUser, Department } from '../../types';

interface RosterManagementProps {
  // If passed, locks the view to this department (e.g. for HoD or QIP Coordinator)
  forcedDepartmentId?: string;
}

export const RosterManagement: React.FC<RosterManagementProps> = ({ forcedDepartmentId }) => {
  const { rosterUser, isAppAdmin, isHoD, isCoordinator } = useAuth();

  const userDept = forcedDepartmentId || (isHoD || isCoordinator ? rosterUser?.department : undefined);
  const canManageAllDepts = isAppAdmin && !forcedDepartmentId;

  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>(userDept || 'all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Type-name-to-edit state
  const [typeToEditQuery, setTypeToEditQuery] = useState('');
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<RosterUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Single entry add modal state
  const [isSingleEntryModalOpen, setIsSingleEntryModalOpen] = useState(false);
  const [singleEntryTab, setSingleEntryTab] = useState<'department' | 'faculty'>('faculty');

  // Fetch roster and departments
  const fetchRosterAndDepartments = async () => {
    setLoading(true);
    try {
      const rosterSnap = await getDocs(collection(db, 'roster'));
      const rosterList: RosterUser[] = [];
      rosterSnap.forEach((docSnap) => {
        rosterList.push(docSnap.data() as RosterUser);
      });
      rosterList.sort((a, b) => {
        const deptCompare = a.department.localeCompare(b.department);
        if (deptCompare !== 0) return deptCompare;
        return a.name.localeCompare(b.name);
      });
      setRoster(rosterList);

      const deptSnap = await getDocs(collection(db, 'departments'));
      const deptList: Department[] = [];
      deptSnap.forEach((docSnap) => {
        deptList.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      deptList.sort((a, b) => a.name.localeCompare(b.name));
      setDepartments(deptList);
    } catch (err) {
      console.error('Error fetching roster data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRosterAndDepartments();
  }, []);

  // Department ID to name lookup map
  const deptMap = useMemo(() => {
    const map = new Map<string, Department>();
    departments.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  // Update selectedDept if userDept changes
  useEffect(() => {
    if (userDept) {
      setSelectedDept(userDept);
    }
  }, [userDept]);

  const existingEmails = useMemo(() => new Set(roster.map((u) => u.email.toLowerCase().trim())), [roster]);
  const existingDeptIds = useMemo(() => new Set(departments.map((d) => d.id)), [departments]);

  // Scoped roster based on permission
  const scopedRoster = useMemo(() => {
    if (userDept) {
      return roster.filter((u) => u.department === userDept);
    }
    return roster;
  }, [roster, userDept]);

  // Live matching users for "Type Name to Edit"
  const matchingUsersToEdit = useMemo(() => {
    const q = typeToEditQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return scopedRoster
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [scopedRoster, typeToEditQuery]);

  // Filtered roster for table display: Department-wise, then name in ascending order
  const filteredRoster = useMemo(() => {
    return scopedRoster
      .filter((u) => {
        const matchesSearch =
          u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === 'all' || u.department === selectedDept;
        const matchesRole = selectedRole === 'all' || u.role === selectedRole;
        return matchesSearch && matchesDept && matchesRole;
      })
      .sort((a, b) => {
        const deptA = deptMap.get(a.department)?.name || a.department;
        const deptB = deptMap.get(b.department)?.name || b.department;
        const deptCompare = deptA.localeCompare(deptB);
        if (deptCompare !== 0) return deptCompare;
        return a.name.localeCompare(b.name);
      });
  }, [scopedRoster, searchTerm, selectedDept, selectedRole, deptMap]);

  // Toggle user activation
  const handleToggleActive = async (targetUser: RosterUser) => {
    const newStatus = !targetUser.active;
    try {
      await updateDoc(doc(db, 'roster', targetUser.email.toLowerCase().trim()), {
        active: newStatus,
      });
      setRoster((prev) =>
        prev.map((u) =>
          u.email.toLowerCase().trim() === targetUser.email.toLowerCase().trim()
            ? { ...u, active: newStatus }
            : u
        )
      );
      setStatusMessage(`User ${targetUser.email} ${newStatus ? 'activated' : 'deactivated'}.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Error updating user status:', err);
      alert(`Failed to update user status: ${err.message}`);
    }
  };

  // Export current scoped roster to CSV
  const handleExportRoster = () => {
    const exportData = filteredRoster.map((u) => ({
      Name: u.name,
      Department: u.department,
      'Email ID': u.email,
      Role: u.role,
      'Admin Type': u.adminType || '',
      Active: u.active ? 'true' : 'false',
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const prefix = userDept ? `${userDept}_` : 'campus_';
    link.setAttribute('download', `byc_qip_roster_${prefix}${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle edit user success
  const handleEditUserSuccess = (updatedUser: RosterUser, message: string) => {
    setIsEditModalOpen(false);
    setSelectedUserToEdit(null);
    setRoster((prev) =>
      prev.map((u) =>
        u.email.toLowerCase().trim() === updatedUser.email.toLowerCase().trim() ? updatedUser : u
      )
    );
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Handle single entry add success
  const handleSingleEntrySuccess = (_type: 'department' | 'faculty', message: string) => {
    setIsSingleEntryModalOpen(false);
    setStatusMessage(message);
    fetchRosterAndDepartments();
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const currentDeptObj = departments.find((d) => d.id === userDept);

  return (
    <div className="space-y-6" id="roster-management-root">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="p-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-between gap-2 border border-slate-700 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Role / Scope Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              👥 {userDept ? `${currentDeptObj?.name || userDept} — Roster Management` : 'Institutional Faculty Roster'}
            </h2>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-christ-navy border border-blue-200">
              {isAppAdmin ? 'App Admin' : isCoordinator ? 'QIP Coordinator' : isHoD ? 'HoD' : 'Management'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {userDept
              ? `Manage faculty roster, designations, and account access for ${currentDeptObj?.name || userDept}.`
              : 'Institutional faculty roster onboarding, credentials, roles, and department affiliations.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSingleEntryTab('faculty');
              setIsSingleEntryModalOpen(true);
            }}
            id="add-single-faculty-btn"
            className="px-3.5 py-2 bg-christ-navy hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            <span>➕</span> Add Faculty Member
          </button>

          {canManageAllDepts && (
            <button
              type="button"
              onClick={() => {
                setSingleEntryTab('department');
                setIsSingleEntryModalOpen(true);
              }}
              id="add-single-dept-btn"
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold rounded-xl border border-indigo-200 transition shadow-sm flex items-center gap-1.5"
            >
              <span>🏛</span> Add Department
            </button>
          )}

          <button
            type="button"
            onClick={handleExportRoster}
            id="export-roster-csv-btn"
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 transition shadow-sm flex items-center gap-1.5"
          >
            <span>📥</span> Export CSV
          </button>
        </div>
      </div>

      {/* 1. Quick Edit User by Typing Name Section */}
      <div className="bg-gradient-to-r from-purple-50/60 via-indigo-50/40 to-slate-50 rounded-2xl border border-purple-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
              <span>🔍</span> Quick Edit Faculty Details by Name
            </span>
            <span className="text-[10px] bg-purple-200 text-purple-900 font-extrabold px-2 py-0.5 rounded-full">
              Live Search
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Type any name to instantly find and update details
          </span>
        </div>

        <div className="relative mt-2">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-slate-400 text-sm">👤</span>
            <input
              type="text"
              id="quick-edit-user-input"
              placeholder="Type faculty name to edit details (e.g. Balakrishnan, Vinay, Alice)..."
              value={typeToEditQuery}
              onChange={(e) => setTypeToEditQuery(e.target.value)}
              className="w-full text-xs sm:text-sm font-medium border border-purple-300/80 rounded-xl pl-10 pr-10 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
            />
            {typeToEditQuery && (
              <button
                type="button"
                onClick={() => setTypeToEditQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Matching User Suggestions Dropdown */}
          {matchingUsersToEdit.length > 0 && (
            <div
              id="quick-edit-suggestions-list"
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-purple-200 rounded-xl shadow-2xl z-30 divide-y divide-slate-100 max-h-72 overflow-y-auto"
            >
              <div className="px-3.5 py-1.5 bg-purple-50 text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                Select a faculty member to edit:
              </div>
              {matchingUsersToEdit.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => {
                    setSelectedUserToEdit(u);
                    setIsEditModalOpen(true);
                    setTypeToEditQuery('');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-purple-50/70 flex items-center justify-between transition group"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-purple-900 flex items-center gap-1.5">
                      <span>{u.name}</span>
                      <span className="text-[10px] font-medium text-slate-400 font-mono">({u.email})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Dept: <strong className="text-slate-700">{u.department}</strong> • Role:{' '}
                      <span className="capitalize font-semibold text-christ-navy">{u.role}</span>
                      {!u.active && (
                        <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 group-hover:bg-purple-200 px-3 py-1 rounded-lg transition border border-purple-200">
                    Edit Details ✏️
                  </span>
                </button>
              ))}
            </div>
          )}

          {typeToEditQuery.trim().length >= 2 && matchingUsersToEdit.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-center text-xs text-slate-500 z-30">
              No faculty found matching "{typeToEditQuery}".
            </div>
          )}
        </div>
      </div>

      {/* 2. Bulk CSV Upload Section (for App Admin only) */}
      {canManageAllDepts && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>📤</span> Bulk Roster Upload & Validation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload institutional CSV roster to add or update participant accounts across all departments.
            </p>
          </div>
          <RosterUpload
            existingEmails={existingEmails}
            existingDeptIds={existingDeptIds}
            onUploadSuccess={fetchRosterAndDepartments}
          />
        </div>
      )}

      {/* 3. Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        {/* Table Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Search Table
          </label>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2 bg-white text-slate-800 focus:ring-2 focus:ring-christ-navy"
          />
        </div>

        {/* Department Filter (Only for App Admin) */}
        {canManageAllDepts && (
          <div className="min-w-[180px]">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2 bg-white text-slate-800 focus:ring-2 focus:ring-christ-navy"
            >
              <option value="all">All Departments ({roster.length})</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Role Filter */}
        <div className="min-w-[150px]">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Role
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2 bg-white text-slate-800 focus:ring-2 focus:ring-christ-navy"
          >
            <option value="all">All Roles</option>
            <option value="participant">Participant</option>
            <option value="coordinator">QIP Coordinator</option>
            <option value="hod">HoD</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Records Count Badge */}
        <div className="pt-4 sm:pt-0 self-end">
          <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">
            Showing {filteredRoster.length} of {scopedRoster.length} faculty
          </span>
        </div>
      </div>

      {/* 4. Roster Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-christ-navy border-t-christ-gold rounded-full animate-spin" />
            Loading faculty roster...
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No faculty members match your selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Institutional Email</th>
                  <th className="py-3 px-4">Role / Designation</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredRoster.map((u, idx) => (
                  <tr key={u.email} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-semibold text-slate-700">
                        {departments.find((d) => d.id === u.department)?.name || u.department}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : u.role === 'hod'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : u.role === 'coordinator'
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.role === 'coordinator' ? 'QIP Coordinator' : u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {/* Status Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition ${
                          u.active
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={isEditModalOpen}
        targetUser={selectedUserToEdit}
        departments={departments}
        isAppAdmin={Boolean(isAppAdmin)}
        userDept={userDept}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUserToEdit(null);
        }}
        onSuccess={handleEditUserSuccess}
      />

      {/* Add Faculty / Add Department Single Entry Modal */}
      <SingleEntryModal
        isOpen={isSingleEntryModalOpen}
        initialTab={singleEntryTab}
        departments={departments}
        existingEmails={existingEmails}
        existingDeptIds={existingDeptIds}
        onClose={() => setIsSingleEntryModalOpen(false)}
        onSuccess={handleSingleEntrySuccess}
      />
    </div>
  );
};
