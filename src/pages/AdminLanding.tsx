import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { RosterUpload } from '../components/RosterUpload';
import { ContentImport } from '../components/ContentImport';
import { RosterUser, Department } from '../types';

export const AdminLanding: React.FC = () => {
  const { rosterUser, isAppAdmin, isDeanOrLeadership } = useAuth();

  const [activeAdminTab, setActiveAdminTab] = useState<'roster' | 'content'>('roster');
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchRosterAndDepartments = async () => {
    setLoading(true);
    try {
      // Fetch roster
      const rosterSnap = await getDocs(collection(db, 'roster'));
      const rosterList: RosterUser[] = [];
      rosterSnap.forEach((docSnap) => {
        rosterList.push(docSnap.data() as RosterUser);
      });
      // Sort alphabetically by name
      rosterList.sort((a, b) => a.name.localeCompare(b.name));
      setRoster(rosterList);

      // Fetch departments
      const deptSnap = await getDocs(collection(db, 'departments'));
      const deptList: Department[] = [];
      deptSnap.forEach((docSnap) => {
        deptList.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      deptList.sort((a, b) => a.name.localeCompare(b.name));
      setDepartments(deptList);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRosterAndDepartments();
  }, []);

  const existingEmails = new Set(roster.map(u => u.email.toLowerCase().trim()));
  const existingDeptIds = new Set(departments.map(d => d.id));

  // Toggle user activation (deactivate, never delete)
  const handleToggleActive = async (targetUser: RosterUser) => {
    if (!isAppAdmin) {
      alert('Only App Admin can modify user status.');
      return;
    }
    const newStatus = !targetUser.active;
    try {
      await updateDoc(doc(db, 'roster', targetUser.email.toLowerCase().trim()), {
        active: newStatus,
      });
      setRoster(prev =>
        prev.map(u =>
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

  // Download current roster export as CSV
  const handleExportRoster = () => {
    const exportData = roster.map(u => ({
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
    link.setAttribute('download', `byc_qip_roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRoster = roster.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'all' || u.department === selectedDept;
    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    return matchesSearch && matchesDept && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner based on Admin Type */}
        {isDeanOrLeadership && (
          <div id="dean-readonly-banner" className="mb-8 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wide">
                  Leadership / HRDC Console — Read-Only Mode
                </h3>
                <span className="bg-emerald-200 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded">
                  {rosterUser?.adminType === 'dean' ? 'Dean' : rosterUser?.adminType === 'associate_dean' ? 'Associate Dean' : 'HRDC'}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                You have institutional oversight across all BYC departments. Per SPEC §2, leadership access is view-only; roster onboarding and system configurations are restricted to technical administrators.
              </p>
            </div>
          </div>
        )}

        {isAppAdmin && (
          <div id="appadmin-banner" className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-300 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                  App Admin Console — Full System Administration
                </h3>
                <p className="text-xs text-amber-800">
                  Manage roster onboarding, department registry, session states, and audit logs.
                </p>
              </div>
            </div>
            <span className="bg-amber-200 text-amber-900 text-xs font-bold px-3 py-1 rounded-full border border-amber-300">
              Full Access
            </span>
          </div>
        )}

        {/* Status Toast */}
        {statusMessage && (
          <div className="mb-4 p-3 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-md flex items-center gap-2">
            <span>✓</span> {statusMessage}
          </div>
        )}

        {/* Admin Navigation Tabs */}
        {isAppAdmin && (
          <div className="border-b border-slate-200 mb-6">
            <nav className="flex space-x-6">
              <button
                type="button"
                id="admin-tab-roster"
                onClick={() => setActiveAdminTab('roster')}
                className={`py-3 px-1 text-sm font-bold border-b-2 transition ${
                  activeAdminTab === 'roster'
                    ? 'border-christ-navy text-christ-navy'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                👥 Roster Management
              </button>
              <button
                type="button"
                id="admin-tab-content"
                onClick={() => setActiveAdminTab('content')}
                className={`py-3 px-1 text-sm font-bold border-b-2 transition ${
                  activeAdminTab === 'content'
                    ? 'border-christ-navy text-christ-navy'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                📦 Content Import (Sessions & Activities)
              </button>
            </nav>
          </div>
        )}

        {/* Content Import Tab View */}
        {isAppAdmin && activeAdminTab === 'content' && (
          <div className="mb-8">
            <ContentImport />
          </div>
        )}

        {/* Roster Upload Component (App Admin Only) */}
        {isAppAdmin && activeAdminTab === 'roster' && (
          <RosterUpload
            existingEmails={existingEmails}
            existingDeptIds={existingDeptIds}
            onUploadSuccess={fetchRosterAndDepartments}
          />
        )}

        {/* Roster Table Section */}
        {activeAdminTab === 'roster' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Registered Roster ({roster.length} Total Faculty)
              </h3>
              <p className="text-xs text-slate-500">
                Current active users and assigned roles across BYC campus
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportRoster}
                id="export-roster-btn"
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download current roster (CSV)
              </button>
              <button
                onClick={fetchRosterAndDepartments}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-christ-navy"
            />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-christ-navy"
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.id})
                </option>
              ))}
            </select>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-christ-navy"
            >
              <option value="all">All Roles</option>
              <option value="participant">Participant</option>
              <option value="hod">HoD</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading roster...</div>
          ) : filteredRoster.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No matching roster entries found.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table id="current-roster-table" className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Email ID</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Admin Type</th>
                    {isAppAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRoster.map((u) => (
                    <tr key={u.email} className={u.active ? 'hover:bg-slate-50' : 'bg-slate-50/60 opacity-60'}>
                      <td className="px-4 py-3">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{u.department}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{u.email}</td>
                      <td className="px-4 py-3 capitalize">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-amber-100 text-amber-900'
                            : u.role === 'hod'
                            ? 'bg-purple-100 text-purple-900'
                            : 'bg-blue-100 text-blue-900'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.adminType || '-'}</td>
                      {isAppAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded transition border ${
                              u.active
                                ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                            }`}
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Registered Departments Cards */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-bold text-slate-900 mb-2">Registered Departments ({departments.length})</h3>
          <p className="text-xs text-slate-500 mb-4">All departments active for QIP 2026</p>
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <div key={d.id} className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-semibold text-slate-800">{d.name}</span>
                <span className="text-slate-400 font-mono text-[10px] ml-1.5">({d.id})</span>
              </div>
            ))}
          </div>
        </div>
          </>
        )}
      </main>
    </div>
  );
};
