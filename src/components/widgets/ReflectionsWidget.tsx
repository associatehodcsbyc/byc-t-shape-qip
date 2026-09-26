import React from 'react';
import { ReflectionConfig } from '../../types';

interface ReflectionsWidgetProps {
  reflections?: ReflectionConfig[];
  values: Record<string, string>;
  onChange: (rId: string, val: string) => void;
  readOnly?: boolean;
}

export const ReflectionsWidget: React.FC<ReflectionsWidgetProps> = ({
  reflections,
  values = {},
  onChange,
  readOnly = false,
}) => {
  if (!reflections || reflections.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t-2 border-slate-200 space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-wider text-christ-navy">
          Reflections & Notes
        </span>
        <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
          Personal synthesis
        </span>
      </div>

      {reflections.map((r, idx) => {
        const textVal = values[r.id] || '';
        const maxChars = r.maxChars || 1500;
        const charsLeft = maxChars - textVal.length;

        return (
          <div
            key={r.id}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition"
          >
            <label
              htmlFor={`reflection-${r.id}`}
              className="block text-sm font-semibold text-slate-800 mb-2 leading-relaxed"
            >
              <span className="inline-block w-6 h-6 rounded-full bg-christ-navy text-white text-xs font-bold text-center leading-6 mr-2">
                R{idx + 1}
              </span>
              {r.prompt}
            </label>
            <textarea
              id={`reflection-${r.id}`}
              rows={3}
              value={textVal}
              disabled={readOnly}
              maxLength={maxChars}
              onChange={(e) => onChange(r.id, e.target.value)}
              placeholder={readOnly ? 'No reflection entered.' : 'Enter your reflection here...'}
              className="w-full text-sm rounded-lg border border-slate-300 p-3 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy focus:border-christ-navy transition disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
              <span>{readOnly ? 'Locked' : 'Character limit applies'}</span>
              <span
                className={`font-mono ${
                  charsLeft < 50 ? 'text-red-600 font-bold' : 'text-slate-500'
                }`}
              >
                {textVal.length} / {maxChars}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
