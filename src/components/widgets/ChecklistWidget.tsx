import React from 'react';
import { Activity, ChecklistConfig } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface ChecklistWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const ChecklistWidget: React.FC<ChecklistWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as ChecklistConfig;
  const options = config.options || [];
  const allowOther = Boolean(config.allowOther);

  const selectedIds: string[] = Array.isArray(answers.selected) ? answers.selected : [];
  const otherText: string = typeof answers.other === 'string' ? answers.other : '';

  const handleToggle = (id: string) => {
    if (readOnly) return;
    const isChecked = selectedIds.includes(id);
    const updated = isChecked
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];

    onChange({
      ...answers,
      selected: updated,
    });
  };

  const handleOtherChange = (text: string) => {
    if (readOnly) return;
    onChange({
      ...answers,
      other: text,
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
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between">
        <span className="font-semibold text-slate-800">
          Tick all practices that apply
        </span>
        <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
          {selectedIds.length} of {options.length} selected
        </span>
      </div>

      <div className="space-y-2.5">
        {options.map((opt) => {
          const isSelected = selectedIds.includes(opt.id);

          return (
            <label
              key={opt.id}
              className={`flex items-start gap-3.5 p-4 rounded-xl border transition cursor-pointer select-none ${
                isSelected
                  ? 'bg-blue-50/50 border-christ-navy ring-1 ring-christ-navy shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              } ${readOnly ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={readOnly}
                onChange={() => handleToggle(opt.id)}
                className="w-5 h-5 rounded border-slate-300 text-christ-navy focus:ring-christ-navy mt-0.5 shrink-0"
              />
              <div className="text-sm font-medium text-slate-800 leading-relaxed">
                {opt.text}
              </div>
            </label>
          );
        })}

        {/* Other text field if permitted */}
        {allowOther && (
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <label
              htmlFor="checklist-other"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
            >
              Other (please specify):
            </label>
            <input
              type="text"
              id="checklist-other"
              value={otherText}
              disabled={readOnly}
              onChange={(e) => handleOtherChange(e.target.value)}
              placeholder={readOnly ? '' : 'Describe any other practice...'}
              className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-800 bg-white focus:ring-2 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100"
            />
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
