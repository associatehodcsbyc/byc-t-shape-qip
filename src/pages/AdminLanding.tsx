import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { ContentImport } from '../components/ContentImport';
import { SessionBoard } from '../components/hod/SessionBoard';
import { RosterManagement } from '../components/admin/RosterManagement';

export const AdminLanding: React.FC = () => {
  const { rosterUser, isAppAdmin, isDeanOrLeadership } = useAuth();
  const [activeAdminTab, setActiveAdminTab] = useState<'roster' | 'content' | 'sessions'>('roster');

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Banner based on Admin Type */}
        {isDeanOrLeadership && (
          <div id="dean-readonly-banner" className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 shadow-sm flex items-start gap-4">
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
          <div id="appadmin-banner" className="p-4 rounded-xl bg-amber-50 border border-amber-300 shadow-sm flex items-center justify-between gap-4">
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

        {/* Admin / Leadership Navigation Tabs */}
        <div className="border-b border-slate-200">
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
              👥 {isAppAdmin ? 'Roster Management' : 'Faculty Roster'}
            </button>

            {isAppAdmin && (
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
            )}

            <button
              type="button"
              id="admin-tab-sessions"
              onClick={() => setActiveAdminTab('sessions')}
              className={`py-3 px-1 text-sm font-bold border-b-2 transition ${
                activeAdminTab === 'sessions'
                  ? 'border-christ-navy text-christ-navy'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              📋 {isAppAdmin ? 'Session Board & Activity Gates' : 'Session Board & Live Tracker'}
            </button>
          </nav>
        </div>

        {/* Tab Views */}
        {activeAdminTab === 'roster' && <RosterManagement />}
        {isAppAdmin && activeAdminTab === 'content' && <ContentImport />}
        {activeAdminTab === 'sessions' && <SessionBoard />}
      </main>
    </div>
  );
};
