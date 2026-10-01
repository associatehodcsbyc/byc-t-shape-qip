import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SessionBoard } from '../components/hod/SessionBoard';
import { RosterManagement } from '../components/admin/RosterManagement';
import { useAuth } from '../context/AuthContext';
import { getMyFeedback } from '../data/feedback';

export const HoDLanding: React.FC = () => {
  const navigate = useNavigate();
  const { rosterUser, isCoordinator, isResourcePerson } = useAuth();
  const [activeTab, setActiveTab] = useState<'sessions' | 'roster'>('sessions');
  const [feedbackStatus, setFeedbackStatus] = useState<'not_started' | 'draft' | 'submitted'>('not_started');

  useEffect(() => {
    async function checkFeedback() {
      try {
        const fb = await getMyFeedback();
        if (fb) setFeedbackStatus(fb.status || 'draft');
      } catch (err) {
        console.error('HoD check feedback error:', err);
      }
    }
    checkFeedback();
  }, [rosterUser?.email]);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Closing Programme Feedback Callout Card */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500 text-slate-900 rounded text-[10px] font-extrabold uppercase tracking-wide">
                Closing Feedback Required
              </span>
              <span className="text-xs font-semibold text-amber-950">
                All Roles (Faculty, HoDs, Coordinators, Resource Persons)
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Official QIP Programme Closing Feedback (8–10 mins)
            </h3>
            <p className="text-xs text-slate-600 max-w-2xl">
              Please provide your observations and evaluation on the 3-day programme to support the official HRDC Report.
            </p>
          </div>

          <button
            onClick={() => navigate('/feedback')}
            id="btn-hod-open-feedback"
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm shrink-0 flex items-center gap-2 ${
              feedbackStatus === 'submitted'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
            }`}
          >
            {feedbackStatus === 'submitted' ? (
              <>
                <span>✅</span> View Submitted Feedback
              </>
            ) : feedbackStatus === 'draft' ? (
              <>
                <span>✏️</span> Resume Feedback (Draft)
              </>
            ) : (
              <>
                <span>📝</span> Fill Closing Feedback
              </>
            )}
          </button>
        </div>

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
