import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import defaultSessions from '../../seed/sessions.json';
import defaultActivities from '../../seed/activities.json';
import {
  computeContentDryRun,
  commitContentImport,
  DryRunDiffResult,
} from '../services/contentImport';

export const ContentImport: React.FC = () => {
  const { user } = useAuth();
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [diffResult, setDiffResult] = useState<DryRunDiffResult | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'new' | 'changed' | 'unchanged'>('all');
  const [activeTab, setActiveTab] = useState<'activities' | 'sessions'>('activities');
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute dry-run diff on mount using bundled seed files
  const runDryRun = async () => {
    setLoadingDiff(true);
    setCommitSuccess(null);
    setErrorMessage(null);

    try {
      const res = await computeContentDryRun(
        defaultSessions as any,
        defaultActivities as any
      );
      setDiffResult(res);
    } catch (err: any) {
      console.error('Dry-run diff computation failed:', err);
      setErrorMessage(err.message || 'Failed to compute dry-run diff against Firestore.');
    } finally {
      setLoadingDiff(false);
    }
  };

  useEffect(() => {
    runDryRun();
  }, []);

  const handleCommit = async () => {
    if (!diffResult || !user?.email) return;

    setCommitting(true);
    setErrorMessage(null);
    setCommitSuccess(null);
    setProgress({ current: 0, total: defaultSessions.sessions.length + defaultActivities.activities.length });

    try {
      const res = await commitContentImport(
        defaultSessions.sessions as any,
        defaultActivities.activities as any,
        diffResult.groupProtocol,
        diffResult.groupLabels,
        user.email,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      if (res.success) {
        setCommitSuccess(
          `Successfully committed ${res.sessionsCommitted} sessions and ${res.activitiesCommitted} activities to Firestore.`
        );
        // Re-run diff to show updated state (everything unchanged)
        await runDryRun();
      }
    } catch (err: any) {
      console.error('Commit failed:', err);
      setErrorMessage(err.message || 'Content import commit failed.');
    } finally {
      setCommitting(false);
      setProgress(null);
    }
  };

  const activityItems = diffResult?.activities.items.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  }) || [];

  const sessionItems = diffResult?.sessions.items.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Content Management (Sessions & Activities)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Validate seed against JSON Schema, review dry-run diff (new / changed / unchanged), and commit to Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loadingDiff || committing}
            onClick={runDryRun}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-semibold transition disabled:opacity-50"
          >
            {loadingDiff ? 'Calculating Diff...' : '🔄 Refresh Dry-Run'}
          </button>

          <button
            type="button"
            id="commit-content-import-btn"
            disabled={
              loadingDiff ||
              committing ||
              !diffResult?.validation.valid ||
              (diffResult?.sessions.newCount === 0 &&
                diffResult?.sessions.changedCount === 0 &&
                diffResult?.activities.newCount === 0 &&
                diffResult?.activities.changedCount === 0)
            }
            onClick={handleCommit}
            className="px-4 py-2 rounded-lg bg-christ-navy text-white text-xs font-bold hover:bg-slate-800 transition shadow-sm disabled:opacity-40 ring-1 ring-christ-gold"
          >
            {committing ? 'Committing to Firestore...' : 'Commit Import to Firestore'}
          </button>
        </div>
      </div>

      {/* Progress Bar when committing */}
      {committing && progress && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
          <div className="flex justify-between text-xs font-semibold text-blue-900">
            <span>Writing documents to Firestore...</span>
            <span className="font-mono">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-christ-navy h-full transition-all duration-200"
              style={{
                width: `${Math.round((progress.current / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Success and Error Banners */}
      {commitSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <span>✅</span>
          <span>{commitSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-2">
          <span>❌</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Schema Validation Status */}
      {diffResult && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
            diffResult.validation.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{diffResult.validation.valid ? '✓' : '⚠'}</span>
            <span className="font-semibold">
              Schema Validation ({defaultActivities.activities.length} activities):{' '}
              {diffResult.validation.valid
                ? 'All activities match seed/activities.schema.json specifications cleanly.'
                : `${diffResult.validation.errors.length} validation errors detected.`}
            </span>
          </div>
          <span className="font-mono font-bold bg-white/70 px-2 py-0.5 rounded">
            Version: {defaultActivities.version}
          </span>
        </div>
      )}

      {/* Validation Errors List if any */}
      {diffResult && !diffResult.validation.valid && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
          <h4 className="text-xs font-bold text-red-900 uppercase tracking-wide">
            Schema Validation Failures:
          </h4>
          <ul className="list-disc list-inside text-xs text-red-700 space-y-1 max-h-48 overflow-y-auto font-mono">
            {diffResult.validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Dry Run Summary Cards */}
      {diffResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sessions Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Sessions ({diffResult.sessions.total})
              </h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                seed/sessions.json
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                <span className="text-emerald-700 font-bold block text-lg">
                  {diffResult.sessions.newCount}
                </span>
                <span className="text-emerald-800 text-[11px] font-semibold">New</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                <span className="text-amber-700 font-bold block text-lg">
                  {diffResult.sessions.changedCount}
                </span>
                <span className="text-amber-800 text-[11px] font-semibold">Changed</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                <span className="text-slate-600 font-bold block text-lg">
                  {diffResult.sessions.unchangedCount}
                </span>
                <span className="text-slate-500 text-[11px] font-semibold">Unchanged</span>
              </div>
            </div>
          </div>

          {/* Activities Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Activities ({diffResult.activities.total})
              </h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                seed/activities.json
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                <span className="text-emerald-700 font-bold block text-lg">
                  {diffResult.activities.newCount}
                </span>
                <span className="text-emerald-800 text-[11px] font-semibold">New</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                <span className="text-amber-700 font-bold block text-lg">
                  {diffResult.activities.changedCount}
                </span>
                <span className="text-amber-800 text-[11px] font-semibold">Changed</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                <span className="text-slate-600 font-bold block text-lg">
                  {diffResult.activities.unchangedCount}
                </span>
                <span className="text-slate-500 text-[11px] font-semibold">Unchanged</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Filter Bar */}
      {diffResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            {/* Tab switch */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('activities')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'activities'
                    ? 'bg-christ-navy text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Activities ({diffResult.activities.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sessions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'sessions'
                    ? 'bg-christ-navy text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Sessions ({diffResult.sessions.total})
              </button>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 mr-1">Filter diff:</span>
              {(['all', 'new', 'changed', 'unchanged'] as const).map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setFilterType(ft)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition ${
                    filterType === ft
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {ft}
                </button>
              ))}
            </div>
          </div>

          {/* Diff Items Table */}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Document ID</th>
                  <th className="py-2.5 px-4">Title / Label</th>
                  <th className="py-2.5 px-4">Type / Session</th>
                  <th className="py-2.5 px-4 text-center">Diff Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTab === 'activities' ? (
                  activityItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No activities match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    activityItems.map(({ id, item, type, diffNotes }) => (
                      <tr key={id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-700">
                          {id}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <div>{item.title}</div>
                          {diffNotes && diffNotes.length > 0 && (
                            <div className="text-[11px] text-amber-700 font-mono mt-0.5">
                              {diffNotes.join(' • ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.sessionId}
                          </span>{' '}
                          • {item.widgetType}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              type === 'new'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : type === 'changed'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {type}
                          </span>
                        </td>
                      </tr>
                    ))
                  )
                ) : sessionItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No sessions match the selected filter.
                    </td>
                  </tr>
                ) : (
                  sessionItems.map(({ id, item, type, diffNotes }) => (
                    <tr key={id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-700">
                        {id}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div>{item.title}</div>
                        {diffNotes && diffNotes.length > 0 && (
                          <div className="text-[11px] text-amber-700 font-mono mt-0.5">
                            {diffNotes.join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        Day {item.day} • Slot {item.slot} ({item.time})
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            type === 'new'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : type === 'changed'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
