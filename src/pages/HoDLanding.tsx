import React, { useState } from 'react';
import { Header } from '../components/Header';
import { SessionBoard } from '../components/hod/SessionBoard';
import { RosterManagement } from '../components/admin/RosterManagement';
import { useAuth } from '../context/AuthContext';

export const HoDLanding: React.FC = () => {
  const { rosterUser, isCoordinator, isResourcePerson } = useAuth();
  const [activeTab, setActiveTab] = useState<'sessions' | 'roster'>('sessions');

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs (Only if user has roster management duties) */}
        {!isResourcePerson && (
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              id="hod-tab-sessions"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'sessions'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              📋 {isCoordinator ? 'Session Board & Activity Gates' : 'Session Board & Progress'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              id="hod-tab-roster"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'roster'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              👥 {isCoordinator ? 'QIP Coordinator' : 'Department'} Roster Management
            </button>
          </div>
        )}

        {(activeTab === 'sessions' || isResourcePerson) && <SessionBoard />}
        {activeTab === 'roster' && !isResourcePerson && (
          <RosterManagement forcedDepartmentId={rosterUser?.department} />
        )}
      </main>
    </div>
  );
};
