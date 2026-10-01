import React, { useState } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { ActivityAnalytics } from '../components/analytics/ActivityAnalytics';
import { SessionSummaryView } from '../components/analytics/SessionSummaryView';
import { FeedbackAnalysisView } from '../components/analytics/FeedbackAnalysisView';
import { SummaryPublisher } from '../components/admin/SummaryPublisher';
import { ReportGenerationView } from '../components/analytics/ReportGenerationView';

export const AnalyticsPage: React.FC = () => {
  const { isAppAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'activity' | 'session' | 'feedback' | 'report' | 'publisher'>('activity');
  const [selectedActivityId, setSelectedActivityId] = useState<string | undefined>();

  const handleNavigateToActivity = (actId: string) => {
    setSelectedActivityId(actId);
    setActiveTab('activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top View Selector Tabs */}
        <div className="no-print bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('activity')}
            id="tab-activity-analytics"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'activity'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📊 Per-Activity Analysis
          </button>

          <button
            onClick={() => setActiveTab('session')}
            id="tab-session-summary"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'session'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📋 Session Summary Reports
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            id="tab-feedback-analysis"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'feedback'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
            }`}
          >
            📝 Feedback Analysis
          </button>

          <button
            onClick={() => setActiveTab('report')}
            id="tab-report-generation"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'report'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📑 Report Generation
          </button>

          {isAppAdmin && (
            <button
              onClick={() => setActiveTab('publisher')}
              id="tab-summary-publisher"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'publisher'
                  ? 'bg-purple-900 text-white shadow-sm'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              🔒 Summary Publisher (App Admin)
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'activity' && <ActivityAnalytics initialActivityId={selectedActivityId} />}
        {activeTab === 'session' && <SessionSummaryView />}
        {activeTab === 'feedback' && <FeedbackAnalysisView />}
        {activeTab === 'report' && (
          <ReportGenerationView onViewActivityAnalytics={handleNavigateToActivity} />
        )}
        {activeTab === 'publisher' && isAppAdmin && <SummaryPublisher />}
      </main>
    </div>
  );
};
