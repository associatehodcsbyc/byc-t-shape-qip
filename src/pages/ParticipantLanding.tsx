import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';

export const ParticipantLanding: React.FC = () => {
  const { rosterUser } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Participant Portal
              </span>
              <span className="text-xs font-mono text-gray-500">
                Dept: <strong className="text-slate-800">{rosterUser?.department}</strong>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              Welcome, {rosterUser?.name}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Access your department's enabled sessions and worksheet activities for the 3-day QIP workshop.
            </p>
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm">
              📄 My Working Document
            </button>
            <button className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition shadow-sm">
              📋 My Past Responses
            </button>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="border-b border-slate-200 mb-6">
          <nav className="flex space-x-8">
            <button className="border-b-2 border-christ-navy py-3 px-1 text-sm font-bold text-christ-navy">
              Day 1 (28 Sept)
            </button>
            <button className="border-b-2 border-transparent py-3 px-1 text-sm font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300">
              Day 2 (29 Sept)
            </button>
            <button className="border-b-2 border-transparent py-3 px-1 text-sm font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300">
              Day 3 (30 Sept)
            </button>
          </nav>
        </div>

        {/* Sessions list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-christ-navy transition">
            <div className="flex items-center justify-between text-xs font-semibold text-christ-gold mb-2">
              <span>SLOT I • 09:15 - 10:45 IST</span>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">Open</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Setting the Vision</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Facilitator: Dean(s) • Session ID: d1s1</p>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs">
                <span className="font-medium text-slate-800">1. The Four Pillars: Where Do We Stand?</span>
                <span className="text-emerald-600 font-semibold">Ready to Start →</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs text-slate-400">
                <span>2. Contemporary Teaching and Learning Assessment</span>
                <span className="italic">Awaiting HoD</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 opacity-75">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>SLOT II • 11:15 - 12:45 IST</span>
              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Upcoming</span>
            </div>
            <h3 className="text-lg font-bold text-slate-700">The T-Shaped Graduate</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">Facilitator: Core Committee • Session ID: d1s2</p>
            <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-3">
              Activities will appear when enabled by your HoD.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
