import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import {
  OverallFeedbackSummaryDoc,
  getOverallFeedbackSummary,
  subscribeToOverallFeedbackSummary,
} from '../../data/feedbackSummaries';
import { feedbackFormContent } from '../../data/feedbackForm';

export const FeedbackAnalysisView: React.FC = () => {
  const [summary, setSummary] = useState<OverallFeedbackSummaryDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await getOverallFeedbackSummary();
        if (isMounted) setSummary(data);
      } catch (err) {
        console.error('Error fetching feedback summary:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    // Live subscription to overall feedback summary
    const unsub = subscribeToOverallFeedbackSummary((data) => {
      if (isMounted) setSummary(data);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getOverallFeedbackSummary();
      setSummary(data);
    } catch (err) {
      console.error('Manual refresh failed:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-christ-navy border-t-christ-gold rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Loading feedback analytics...</span>
      </div>
    );
  }

  if (!summary || summary.n === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center text-2xl border border-amber-200">
          📊
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">No Feedback Published Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Closing feedback responses have not been published to the programme aggregate yet. The App Admin publishes the combined aggregate from the Summary Publisher console.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : '🔄 Check for Updates'}
        </button>
      </div>
    );
  }

  // Format Section A Chart Data
  const partASchema = feedbackFormContent.parts.find((p) => p.id === 'pA');
  const partAItems: Array<{ id: string; text: string }> = partASchema?.config?.items || [];
  const partAChartData = partAItems.map((item: { id: string; text: string }) => {
    const stats = summary.pA?.[item.id];
    return {
      id: item.id.toUpperCase(),
      label: item.text,
      shortLabel: item.text.length > 40 ? item.text.substring(0, 37) + '...' : item.text,
      mean: stats ? stats.mean : 0,
      count: stats ? stats.count : 0,
    };
  });

  // Format Section B Chart Data
  const partBSchema = feedbackFormContent.parts.find((p) => p.id === 'pB');
  const partBItems: Array<{ id: string; text: string }> = partBSchema?.config?.items || [];
  const partBChartData = partBItems.map((item: { id: string; text: string }) => {
    const stats = summary.pB?.[item.id];
    const counts = stats?.counts || {};
    return {
      id: item.id,
      name: item.text.split('—')[0].trim(),
      fullText: item.text,
      Excellent: counts['Excellent'] || 0,
      Good: counts['Good'] || 0,
      Satisfactory: counts['Satisfactory'] || 0,
      NeedsImprovement: counts['Needs Improvement'] || 0,
      total: stats?.total || 0,
    };
  });

  // Format Section C1 Poll Chart Data
  const partC1Schema = feedbackFormContent.parts.find((p) => p.id === 'pC1');
  const partC1Options: Array<{ id: string; text: string }> = partC1Schema?.config?.options || [];
  const partC1Counts = summary.pC1?.counts || {};
  const partC1ChartData = partC1Options.map((opt: { id: string; text: string }) => ({
    name: opt.text,
    count: partC1Counts[opt.id] || 0,
  }));

  // Format Section D1 Checklist Chart Data
  const partD1Schema = feedbackFormContent.parts.find((p) => p.id === 'pD1');
  const partD1Options: Array<{ id: string; text: string }> = partD1Schema?.config?.options || [];
  const partD1Counts = summary.pD1?.counts || {};
  const partD1ChartData = partD1Options
    .map((opt: { id: string; text: string }) => ({
      name: opt.text,
      count: partD1Counts[opt.id] || 0,
    }))
    .sort((a: { count: number }, b: { count: number }) => b.count - a.count);

  const anonymousQuotes = summary.pD2Anonymous || [];

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-christ-navy text-white">
              Programme-Wide Analysis
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Concluded 30 Sept 2026
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            QIP Closing Programme Feedback Analysis
          </h2>
          <p className="text-xs text-slate-600">
            Combined aggregate across all participating departments and roles (N = {summary.n} participants).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-700">Sample Size</div>
            <div className="text-lg font-extrabold text-christ-navy">{summary.n} Responses</div>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50"
            title="Refresh Feedback Data"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>🔄</span>
          </button>
        </div>
      </div>

      {/* Section A: T-Shaped Learning & Curriculum Direction */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div>
          <span className="text-[10px] font-bold text-christ-gold bg-slate-900 px-2.5 py-0.5 rounded uppercase tracking-wider">
            Section A
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-2">
            T-Shaped Learning & Curriculum Direction
          </h3>
          <p className="text-xs text-slate-500">
            5-point Likert Scale (1 = Strongly Disagree to 5 = Strongly Agree)
          </p>
        </div>

        {/* Bar Chart for Section A Means */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={partAChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <YAxis dataKey="id" type="category" tick={{ fontSize: 11, fontWeight: 600 }} />
              <Tooltip
                formatter={(val: any) => [`${val} / 5.0`, 'Mean Score']}
                labelFormatter={(label: any) => {
                  const item = partAChartData.find((d: any) => d.id === label);
                  return item ? `${item.id}: ${item.label}` : label;
                }}
              />
              <Bar dataKey="mean" fill="#0A2540" radius={[0, 6, 6, 0]}>
                {partAChartData.map((_: any, idx: number) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={idx % 2 === 0 ? '#0A2540' : '#1E3A8A'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Means Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-12">#</th>
                <th className="py-2.5 px-3">Statement</th>
                <th className="py-2.5 px-3 text-right w-24">Mean (1-5)</th>
                <th className="py-2.5 px-3 text-right w-20">N</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partAChartData.map((item: any, idx: number) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">A{idx + 1}</td>
                  <td className="py-2.5 px-3 text-slate-800 font-medium">{item.label}</td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-christ-navy">
                    {item.mean.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B: Programme Delivery & Facilitation */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div>
          <span className="text-[10px] font-bold text-christ-gold bg-slate-900 px-2.5 py-0.5 rounded uppercase tracking-wider">
            Section B
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-2">
            Programme Delivery & Facilitation
          </h3>
          <p className="text-xs text-slate-500">
            Ratings breakdown across modules, pacing, and materials
          </p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={partBChartData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                tick={{ fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Bar dataKey="Excellent" stackId="a" fill="#10B981" />
              <Bar dataKey="Good" stackId="a" fill="#3B82F6" />
              <Bar dataKey="Satisfactory" stackId="a" fill="#F59E0B" />
              <Bar dataKey="NeedsImprovement" name="Needs Improvement" stackId="a" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section C: Higher-Order Thinking & SoTL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* C1: Poll on Assessment */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div>
            <span className="text-[10px] font-bold text-christ-gold bg-slate-900 px-2.5 py-0.5 rounded uppercase tracking-wider">
              Section C1
            </span>
            <h3 className="text-sm font-bold text-slate-900 mt-2">
              Most Impactful Assessment Design Component
            </h3>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partC1ChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* C2: Equip Rating & Section D1 Checklist */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-christ-gold bg-slate-900 px-2.5 py-0.5 rounded uppercase tracking-wider">
              Section C2
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              Confidence in Applying Higher-Order Ideas
            </h3>
            <p className="text-xs text-slate-600 italic">
              "{feedbackFormContent.parts.find((p) => p.id === 'pC2')?.config?.items?.[0]?.text}"
            </p>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-700 font-semibold">Mean Agreement Score</div>
                <div className="text-2xl font-extrabold text-christ-navy">
                  {summary.pC2?.mean ? summary.pC2.mean.toFixed(2) : '—'} <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">
                  {summary.pC2 && summary.pC2.mean >= 4.0 ? 'High Confidence' : 'Moderate'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold text-christ-gold bg-slate-900 px-2.5 py-0.5 rounded uppercase tracking-wider">
              Section D1
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              Most Effective Programme Elements
            </h3>
            <div className="space-y-2">
              {partD1ChartData.slice(0, 4).map((item: { name: string; count: number }) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-medium truncate max-w-[200px]">{item.name}</span>
                  <span className="font-mono font-bold text-christ-navy bg-slate-100 px-2 py-0.5 rounded">
                    {item.count} votes
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section D2: Shuffled Anonymous Quotes */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-christ-gold bg-slate-900 px-2.5 py-0.5 rounded uppercase tracking-wider">
              Section D2 (Anonymous)
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-2">
              Participant Recommendations for Future Runs
            </h3>
            <p className="text-xs text-slate-500">
              Shuffled and unattributed qualitative reflections
            </p>
          </div>
          <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-bold">
            {anonymousQuotes.length} Quotes
          </span>
        </div>

        {anonymousQuotes.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No comments submitted yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anonymousQuotes.map((quote, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed relative flex flex-col justify-between"
              >
                <p className="italic">"{quote}"</p>
                <div className="mt-2 text-[10px] text-slate-400 text-right font-medium">
                  Anonymous Participant
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
