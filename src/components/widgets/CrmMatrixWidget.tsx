import React, { useState, useMemo } from 'react';
import { Activity } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface CrmItem {
  id?: string;
  type: string;
  text: string;
  bloom: string;
  dok: string;
}

interface CrmConfig {
  bloom: string[];
  dok: string[];
  itemTypes: string[];
  minItems?: number;
  maxItems?: number;
  reflections?: any[];
}

interface CrmMatrixWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

const DEFAULT_BLOOM = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

const DEFAULT_DOK = [
  'DOK 1 - Recall and Reproduction',
  'DOK 2 - Skills and Concepts',
  'DOK 3 - Strategic Thinking / Reasoning',
  'DOK 4 - Extended Thinking',
];

const DEFAULT_ITEM_TYPES = ['Course Outcome', 'Unit', 'Assessment item'];

export const CrmMatrixWidget: React.FC<CrmMatrixWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as CrmConfig;
  const bloomLevels = config?.bloom || DEFAULT_BLOOM;
  const dokLevels = config?.dok || DEFAULT_DOK;
  const itemTypes = config?.itemTypes || DEFAULT_ITEM_TYPES;

  const items: CrmItem[] = Array.isArray(answers.items) ? answers.items : [];

  // New item form state
  const [newItemType, setNewItemType] = useState<string>(itemTypes[0] || 'Course Outcome');
  const [newItemText, setNewItemText] = useState<string>('');
  const [newBloom, setNewBloom] = useState<string>(bloomLevels[0] || 'Remember');
  const [newDok, setNewDok] = useState<string>(dokLevels[0] || 'DOK 1 - Recall and Reproduction');
  const [selectedCell, setSelectedCell] = useState<{ bloom: string; dok: string } | null>(null);

  // Compute Heat Map Grid Counts & DOK percentages
  const { heatMap, dokHighPercentage, dokLowPercentage, totalItems } = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    let highCount = 0;
    let lowCount = 0;

    bloomLevels.forEach((b) => {
      map[b] = {};
      dokLevels.forEach((d) => {
        map[b][d] = 0;
      });
    });

    items.forEach((item) => {
      if (map[item.bloom] && map[item.bloom][item.dok] !== undefined) {
        map[item.bloom][item.dok]++;
      }
      if (item.dok.includes('DOK 3') || item.dok.includes('DOK 4')) {
        highCount++;
      } else {
        lowCount++;
      }
    });

    const total = items.length;
    const highPct = total > 0 ? Math.round((highCount / total) * 100) : 0;
    const lowPct = total > 0 ? Math.round((lowCount / total) * 100) : 0;

    return {
      heatMap: map,
      dokHighPercentage: highPct,
      dokLowPercentage: lowPct,
      totalItems: total,
    };
  }, [items, bloomLevels, dokLevels]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !newItemText.trim()) return;

    const updated = [
      ...items,
      {
        type: newItemType,
        text: newItemText.trim(),
        bloom: newBloom,
        dok: newDok,
      },
    ];

    onChange({
      ...answers,
      items: updated,
    });

    setNewItemText('');
  };

  const handleRemoveItem = (index: number) => {
    if (readOnly) return;
    const updated = items.filter((_, i) => i !== index);
    onChange({
      ...answers,
      items: updated,
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

  // Filtered items if a specific heat map cell is clicked
  const activeCellItems = useMemo(() => {
    if (!selectedCell) return items;
    return items.filter(
      (item) => item.bloom === selectedCell.bloom && item.dok === selectedCell.dok
    );
  }, [items, selectedCell]);

  return (
    <div className="space-y-8">
      {/* Heat Map & High-Order Reasoning Analysis Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-christ-navy text-white rounded-2xl p-6 shadow-md border border-christ-navy/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-christ-gold">
              Cognitive Rigour Matrix (CRM) Analysis
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Personal Heat Map ({totalItems} Items Placed)
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 text-center">
              <span className="text-[10px] uppercase text-slate-300 block font-semibold">
                DOK 3–4 (Deep Learning)
              </span>
              <span className="text-xl font-extrabold text-christ-gold">
                {dokHighPercentage}%
              </span>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 text-center">
              <span className="text-[10px] uppercase text-slate-300 block font-semibold">
                DOK 1–2 (Foundational)
              </span>
              <span className="text-xl font-extrabold text-slate-200">
                {dokLowPercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* 6x4 Grid Heat Map */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-center border-collapse min-w-[650px] text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left font-bold text-slate-300 w-28 uppercase text-[11px]">
                  Bloom \ DOK
                </th>
                {dokLevels.map((d, dIdx) => (
                  <th
                    key={d}
                    className="p-2 font-bold text-slate-200 border-b border-white/20 text-[11px]"
                  >
                    DOK {dIdx + 1}
                    <span className="block text-[9px] text-slate-400 font-normal truncate max-w-[130px] mx-auto">
                      {d.split('-')[1]?.trim() || d}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloomLevels.map((b) => (
                <tr key={b} className="border-b border-white/10">
                  <td className="p-2 text-left font-bold text-slate-300 text-xs">
                    {b}
                  </td>
                  {dokLevels.map((d) => {
                    const count = heatMap[b]?.[d] || 0;
                    const isSelected =
                      selectedCell?.bloom === b && selectedCell?.dok === d;

                    // Color density based on count
                    let cellBg = 'bg-white/5 text-slate-400';
                    if (count > 0 && count < 3) {
                      cellBg = 'bg-blue-600/40 text-blue-100 font-bold';
                    } else if (count >= 3 && count < 6) {
                      cellBg = 'bg-amber-600/60 text-white font-extrabold';
                    } else if (count >= 6) {
                      cellBg = 'bg-christ-gold text-slate-950 font-black';
                    }

                    return (
                      <td key={d} className="p-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) setSelectedCell(null);
                            else setSelectedCell({ bloom: b, dok: d });
                          }}
                          className={`w-full py-2.5 rounded-lg border transition ${cellBg} ${
                            isSelected
                              ? 'ring-2 ring-white border-white scale-95 shadow-md'
                              : 'border-white/10 hover:border-white/40'
                          }`}
                          title={`${b} × ${d}: ${count} item(s)`}
                        >
                          <span className="text-sm">{count}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedCell && (
          <div className="flex items-center justify-between text-xs bg-white/15 px-3 py-1.5 rounded-lg">
            <span>
              Filtered: <strong>{selectedCell.bloom}</strong> ×{' '}
              <strong>{selectedCell.dok}</strong> ({activeCellItems.length} items)
            </span>
            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              className="text-christ-gold hover:underline font-bold"
            >
              Clear Filter ✕
            </button>
          </div>
        )}
      </div>

      {/* Add New Item Form */}
      {!readOnly && (
        <form
          onSubmit={handleAddItem}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4"
        >
          <h4 className="text-xs font-bold uppercase tracking-wider text-christ-navy">
            + Place New Item into Matrix
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Item Type
              </label>
              <select
                value={newItemType}
                onChange={(e) => setNewItemType(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-christ-navy"
              >
                {itemTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Bloom Category
              </label>
              <select
                value={newBloom}
                onChange={(e) => setNewBloom(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-christ-navy"
              >
                {bloomLevels.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Webb's DOK Level
              </label>
              <select
                value={newDok}
                onChange={(e) => setNewDok(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-christ-navy"
              >
                {dokLevels.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Description / Learning Outcome / Task
            </label>
            <input
              type="text"
              required
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="e.g. Design a normalized database schema with functional dependency analysis"
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-christ-navy"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold text-white bg-christ-navy hover:bg-slate-800 rounded-lg shadow transition"
          >
            Add Item to Matrix
          </button>
        </form>
      )}

      {/* Items List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Mapped Items ({activeCellItems.length} of {items.length})
          </h4>
          <span className="text-xs text-slate-500">
            Min recommended: {config?.minItems || 5} items
          </span>
        </div>

        {activeCellItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No items have been mapped yet. Add items above to build your heat map.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeCellItems.map((item, idx) => {
              const originalIdx = items.indexOf(item);
              const isHighDok =
                item.dok.includes('DOK 3') || item.dok.includes('DOK 4');

              return (
                <div
                  key={idx}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.type}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        Bloom: {item.bloom}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isHighDok
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {item.dok}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {item.text}
                    </p>
                  </div>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(originalIdx)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition shrink-0"
                    >
                      Delete ✕
                    </button>
                  )}
                </div>
              );
            })}
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
