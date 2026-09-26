import React, { useMemo } from 'react';
import { Activity, TableEntryConfig } from '../../types';
import {
  computeRatioByCategory,
  computeColumnSum,
  computeRowSum,
} from '../../utils/scoring';
import { ReflectionsWidget } from './ReflectionsWidget';

interface TableEntryWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const TableEntryWidget: React.FC<TableEntryWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as TableEntryConfig;
  const columns = config.columns || [];
  const minRows = config.minRows || 1;
  const maxRows = config.maxRows || 60;
  const computed = config.computed;

  // Initialize rows from answers.rows or empty initial rows
  const rows: Record<string, any>[] = useMemo(() => {
    if (Array.isArray(answers.rows) && answers.rows.length > 0) {
      return answers.rows;
    }
    const initialRows: Record<string, any>[] = [];
    const count = Math.max(minRows, 1);
    for (let i = 0; i < count; i++) {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        row[col.id] = col.type === 'number' ? (col.min !== undefined ? col.min : 0) : '';
      });
      initialRows.push(row);
    }
    return initialRows;
  }, [answers.rows, minRows, columns]);

  const handleCellChange = (rowIndex: number, colId: string, val: any) => {
    if (readOnly) return;
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      [colId]: val,
    };
    onChange({
      ...answers,
      rows: newRows,
    });
  };

  const handleAddRow = () => {
    if (readOnly || rows.length >= maxRows) return;
    const newRow: Record<string, any> = {};
    columns.forEach((col) => {
      newRow[col.id] = col.type === 'number' ? (col.min !== undefined ? col.min : 0) : '';
    });
    onChange({
      ...answers,
      rows: [...rows, newRow],
    });
  };

  const handleRemoveRow = (index: number) => {
    if (readOnly || rows.length <= minRows) return;
    const newRows = rows.filter((_, i) => i !== index);
    onChange({
      ...answers,
      rows: newRows,
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

  // Computed results
  const ratioResult = useMemo(() => {
    if (computed?.type === 'ratio_by_category') {
      return computeRatioByCategory(
        rows,
        computed.valueColumn,
        computed.categoryColumn,
        computed.target
      );
    }
    return null;
  }, [rows, computed]);

  const sumResult = useMemo(() => {
    if (computed?.type === 'sum') {
      return computeColumnSum(rows, computed.column, computed.expect);
    }
    return null;
  }, [rows, computed]);

  return (
    <div className="space-y-6">
      {/* Ratio By Category Computed Display (e.g. Draw Our T 70:30) */}
      {ratioResult && (
        <div className="bg-gradient-to-r from-slate-900 to-christ-navy text-white rounded-xl p-5 shadow-sm border border-christ-navy/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-christ-gold">
                Live Ratio Analysis
              </span>
              <h4 className="text-sm font-semibold text-white mt-0.5">
                Target Equation: {ratioResult.target}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-300">Total Credits/Units:</span>
              <span className="text-xl font-extrabold text-white ml-2">
                {ratioResult.total}
              </span>
            </div>
          </div>

          {/* Visual Percentage Bar */}
          <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex border border-white/20">
            {Object.entries(ratioResult.percentages).map(([cat, pct], idx) => {
              const colors = [
                'bg-christ-gold',
                'bg-blue-400',
                'bg-emerald-400',
                'bg-purple-400',
              ];
              const bg = colors[idx % colors.length];
              return (
                <div
                  key={cat}
                  style={{ width: `${pct}%` }}
                  title={`${cat}: ${pct}%`}
                  className={`${bg} h-full transition-all duration-300`}
                />
              );
            })}
          </div>

          {/* Breakdown Pills */}
          <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-white/10 text-xs">
            {Object.entries(ratioResult.categorySums).map(([cat, sum], idx) => {
              const pct = ratioResult.percentages[cat] || 0;
              const dotColors = [
                'bg-christ-gold',
                'bg-blue-400',
                'bg-emerald-400',
                'bg-purple-400',
              ];
              return (
                <div key={cat} className="flex items-center gap-1.5 bg-black/25 px-2.5 py-1 rounded">
                  <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                  <span className="text-slate-200">{cat}:</span>
                  <span className="font-bold text-white">{sum}</span>
                  <span className="text-christ-gold font-mono">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sum Computed Banner */}
      {sumResult && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            sumResult.matches
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">Total {config.computed?.type === 'sum' ? config.computed.column : ''}:</span>
            <span className="text-xl font-extrabold">{sumResult.sum}</span>
            {sumResult.expect !== undefined && (
              <span className="text-xs font-semibold">
                (Expected: {sumResult.expect})
              </span>
            )}
          </div>
          {!sumResult.matches && (
            <span className="text-xs bg-amber-200/60 px-2.5 py-1 rounded-full font-bold">
              Total does not match target ({sumResult.expect})
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <th className="py-3 px-3 w-12 text-center">#</th>
              {columns.map((col) => (
                <th key={col.id} className="py-3 px-3">
                  {col.label}
                </th>
              ))}
              {computed?.type === 'row_sum' && (
                <th className="py-3 px-3 text-center bg-blue-50/70 text-christ-navy">
                  {computed.label || 'Row Sum'}
                </th>
              )}
              {!readOnly && <th className="py-3 px-3 w-16 text-center">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.map((row, rowIdx) => {
              const rowSumVal =
                computed?.type === 'row_sum'
                  ? computeRowSum(row, computed.columns)
                  : null;

              return (
                <tr key={rowIdx} className="hover:bg-slate-50/50 transition">
                  <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-400 font-bold">
                    {rowIdx + 1}
                  </td>
                  {columns.map((col) => {
                    const cellVal = row[col.id] ?? '';

                    return (
                      <td key={col.id} className="py-2 px-3">
                        {col.type === 'select' ? (
                          <select
                            disabled={readOnly}
                            value={cellVal}
                            onChange={(e) => handleCellChange(rowIdx, col.id, e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 p-2 bg-white text-slate-800 focus:ring-1 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100"
                          >
                            <option value="">-- Select --</option>
                            {col.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : col.type === 'number' ? (
                          <input
                            type="number"
                            disabled={readOnly}
                            min={col.min}
                            max={col.max}
                            value={cellVal}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                              handleCellChange(rowIdx, col.id, val);
                            }}
                            className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-white focus:ring-1 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100"
                          />
                        ) : (
                          <input
                            type="text"
                            disabled={readOnly}
                            value={cellVal}
                            onChange={(e) => handleCellChange(rowIdx, col.id, e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-white focus:ring-1 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100"
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* Computed Row Sum */}
                  {computed?.type === 'row_sum' && (
                    <td className="py-2 px-3 text-center font-bold text-sm bg-blue-50/50 text-christ-navy">
                      {rowSumVal}
                    </td>
                  )}

                  {!readOnly && (
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        disabled={rows.length <= minRows}
                        onClick={() => handleRemoveRow(rowIdx)}
                        title="Remove row"
                        className="text-red-500 hover:text-red-700 text-xs font-bold p-1 rounded hover:bg-red-50 transition disabled:opacity-20"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add Row Bar */}
        {!readOnly && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              disabled={rows.length >= maxRows}
              onClick={handleAddRow}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-sm disabled:opacity-40"
            >
              + Add Row ({rows.length} / {maxRows})
            </button>
            <span className="text-xs text-slate-500">
              Min: {minRows} rows • Max: {maxRows} rows
            </span>
          </div>
        )}
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
