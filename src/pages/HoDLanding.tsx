import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';

export const HoDLanding: React.FC = () => {
  const { rosterUser } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* HoD Header Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                HoD Control Console
              </span>
              <span className="text-xs font-mono text-gray-500">
                Department: <strong className="text-purple-900">{rosterUser?.department}</strong>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              HoD Dashboard — {rosterUser?.name}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Control activity gates (Enable / Lock / Disable) and track live submission progress for your department.
            </p>
          </div>

          <div className="flex gap-2">
            <button className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-sm transition">
              Live Submission Tracker
            </button>
            <button className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 shadow-sm transition">
              Department Reports
            </button>
          </div>
        </div>

        {/* Live Submission Tracker Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Active Faculty</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">12</div>
            <span className="text-[11px] text-slate-400">Registered in {rosterUser?.department}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-emerald-600">Submitted Responses</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">9</div>
            <span className="text-[11px] text-slate-400">75% completion rate</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-amber-600">In Progress / Drafts</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">2</div>
            <span className="text-[11px] text-slate-400">Drafts saved in progress</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-400">Not Started</span>
            <div className="text-2xl font-extrabold text-slate-600 mt-1">1</div>
            <span className="text-[11px] text-slate-400">Awaiting participation</span>
          </div>
        </div>

        {/* Activity Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Activity State Controls (Day 1 - Session I)</h3>
              <p className="text-xs text-slate-500">Enable or lock activities for your faculty</p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-100 transition">
                Enable All in Session
              </button>
              <button className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 rounded hover:bg-amber-100 transition">
                Lock All in Session
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Activity 1.1</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">Enabled</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-1">The Four Pillars: Where Do We Stand?</h4>
                <p className="text-xs text-slate-500">Composite activity • 9 submissions recorded</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-xs font-medium bg-white text-amber-700 border border-amber-300 rounded hover:bg-amber-50">
                  Lock
                </button>
                <button className="px-3 py-1 text-xs font-medium bg-white text-red-700 border border-red-300 rounded hover:bg-red-50">
                  Disable
                </button>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Activity 1.2</span>
                  <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">Disabled</span>
                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium px-2 py-0.5 rounded">🔒 Confidential</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-1">Contemporary Teaching and Learning Assessment Questionnaire</h4>
                <p className="text-xs text-slate-500">Rating scale (confidential ratings — summary only)</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700">
                  Enable
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
