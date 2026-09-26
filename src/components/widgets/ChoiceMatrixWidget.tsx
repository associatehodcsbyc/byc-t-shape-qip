import React from 'react';
import { Activity, ChoiceMatrixConfig } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface ChoiceMatrixWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const ChoiceMatrixWidget: React.FC<ChoiceMatrixWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as ChoiceMatrixConfig;
  const options = config.options || [];
  const items = config.items || [];
  const evidence = Boolean(config.evidence);

  const handleSelect = (itemId: string, opt: string) => {
    if (readOnly) return;
    onChange({
      ...answers,
      [itemId]: opt,
    });
  };

  const handleEvidence = (itemId: string, text: string) => {
    if (readOnly) return;
    onChange({
      ...answers,
      [`${itemId}_ev`]: text,
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header visible on desktop */}
        <div className="hidden md:grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <div className="col-span-6">Characteristic / Practice</div>
          <div className="col-span-6 grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
            {options.map((opt) => (
              <div key={opt} className="truncate px-1" title={opt}>
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const currentSelected = answers[item.id];
            const currentEvidence = answers[`${item.id}_ev`] || '';

            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 transition ${
                  currentSelected ? 'bg-white' : 'bg-slate-50/30'
                }`}
              >
                <div className="flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center">
                  <div className="md:col-span-6 text-sm font-medium text-slate-800 leading-relaxed">
                    <span className="inline-block text-xs font-mono font-bold text-slate-400 mr-2">
                      {item.id.toUpperCase()}
                    </span>
                    {item.text}
                  </div>

                  <div className="w-full md:col-span-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {options.map((opt) => {
                      const isSelected = currentSelected === opt;
                      return (
                        <button
                          type="button"
                          key={opt}
                          disabled={readOnly}
                          onClick={() => handleSelect(item.id, opt)}
                          className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center ${
                            isSelected
                              ? 'bg-christ-navy text-white border-christ-navy ring-2 ring-christ-gold shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {evidence && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <label
                      htmlFor={`ev-${item.id}`}
                      className="block text-xs font-medium text-slate-500 mb-1"
                    >
                      Evidence / Details (optional):
                    </label>
                    <input
                      type="text"
                      id={`ev-${item.id}`}
                      disabled={readOnly}
                      value={currentEvidence}
                      onChange={(e) => handleEvidence(item.id, e.target.value)}
                      placeholder={readOnly ? '' : 'Brief evidence supporting your selection'}
                      className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-white focus:ring-1 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
