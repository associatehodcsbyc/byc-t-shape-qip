import React, { useState, useEffect } from 'react';
import { Activity, RankOrderConfig } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface RankOrderWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const RankOrderWidget: React.FC<RankOrderWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as RankOrderConfig;
  const initialOptions = config.options || [];

  // Initialize order from answers.order or default option IDs
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    if (Array.isArray(answers.order) && answers.order.length === initialOptions.length) {
      return answers.order;
    }
    return initialOptions.map((o) => o.id);
  });

  useEffect(() => {
    if (Array.isArray(answers.order) && answers.order.length === initialOptions.length) {
      setOrderedIds(answers.order);
    }
  }, [answers.order, initialOptions.length]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= orderedIds.length) return;

    const copy = [...orderedIds];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIdx, 0, moved);

    setOrderedIds(copy);
    onChange({
      ...answers,
      order: copy,
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

  const optionsMap = new Map(initialOptions.map((o) => [o.id, o.text]));

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between">
        <span className="font-semibold text-slate-800">
          Rank from 1 (Most Important) to {orderedIds.length} (Least Important)
        </span>
        <span className="text-slate-500">
          Use the ▲ and ▼ buttons to reorder
        </span>
      </div>

      <div className="space-y-2">
        {orderedIds.map((id, index) => {
          const text = optionsMap.get(id) || id;
          const isFirst = index === 0;
          const isLast = index === orderedIds.length - 1;

          return (
            <div
              key={id}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-christ-navy transition group"
            >
              {/* Rank Badge */}
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-sm shrink-0 ${
                  index < 3
                    ? 'bg-christ-navy text-christ-gold shadow'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                #{index + 1}
              </div>

              {/* Text */}
              <div className="flex-1 text-sm font-semibold text-slate-800 leading-snug">
                {text}
              </div>

              {/* Reorder Buttons */}
              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => moveItem(index, 'up')}
                    aria-label={`Move ${text} up`}
                    className="w-8 h-8 rounded border border-slate-200 bg-slate-50 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold transition disabled:opacity-30 disabled:hover:bg-slate-50"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => moveItem(index, 'down')}
                    aria-label={`Move ${text} down`}
                    className="w-8 h-8 rounded border border-slate-200 bg-slate-50 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold transition disabled:opacity-30 disabled:hover:bg-slate-50"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          );
        })}
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
