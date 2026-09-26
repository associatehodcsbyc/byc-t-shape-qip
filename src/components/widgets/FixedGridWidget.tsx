import React from 'react';
import { Activity } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface FixedGridConfig {
  rows: string[];
  columns: string[];
  reflections?: any[];
}

interface FixedGridWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const FixedGridWidget: React.FC<FixedGridWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as FixedGridConfig;
  const rows = config?.rows || [];
  const columns = config?.columns || [];
  const cells: Record<string, string> = answers.cells || {};

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    if (readOnly) return;
    const cellKey = `${rIdx}_${cIdx}`;
    onChange({
      ...answers,
      cells: {
        ...cells,
        [cellKey]: val,
      },
    });
  };

  const handleReflectionChange = (rId: string, text: string) => {
    if (readOnly) return;
    const currentReflections = answers.reflections || {};
    onChange({
      ...answers,
      reflections: {
        ...currentReflections,
        [rId]: text,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <th className="py-3 px-4 w-1/3">Focus Dimension / Row</th>
              {columns.map((col, cIdx) => (
                <th key={cIdx} className="py-3 px-4">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.map((rowLabel, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/40 transition">
                <td className="py-3.5 px-4 font-semibold text-slate-800 text-xs sm:text-sm bg-slate-50/50 align-top">
                  {rowLabel}
                </td>
                {columns.map((_, cIdx) => {
                  const cellKey = `${rIdx}_${cIdx}`;
                  const cellVal = cells[cellKey] || '';

                  return (
                    <td key={cIdx} className="py-2.5 px-3 align-top">
                      <textarea
                        rows={2}
                        value={cellVal}
                        disabled={readOnly}
                        onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                        placeholder={readOnly ? '' : 'Type details here...'}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-christ-navy focus:border-christ-navy transition disabled:bg-slate-100 disabled:text-slate-600"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reflections */}
      {config.reflections && (
        <ReflectionsWidget
          reflections={config.reflections}
          values={answers.reflections || {}}
          onChange={handleReflectionChange}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};
