import React from 'react';
import { Activity } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface WorkingDocField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  required?: boolean;
}

interface WorkingDocConfig {
  fields: WorkingDocField[];
  reflections?: any[];
}

interface WorkingDocWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const WorkingDocWidget: React.FC<WorkingDocWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as WorkingDocConfig;
  const fields = config?.fields || [];

  const handleFieldChange = (key: string, val: string) => {
    if (readOnly) return;
    onChange({
      ...answers,
      [key]: val,
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
          Working Document Form
        </span>
        <span className="text-[11px] text-slate-500">
          These fields will carry forward to subsequent Day 2 & 3 redesign activities
        </span>
      </div>

      <div className="space-y-4">
        {fields.map((field) => {
          const val = typeof answers[field.key] === 'string' ? answers[field.key] : '';

          return (
            <div
              key={field.key}
              className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1.5"
            >
              <label
                htmlFor={`field-${field.key}`}
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  id={`field-${field.key}`}
                  rows={4}
                  value={val}
                  disabled={readOnly}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={readOnly ? 'No text recorded.' : `Enter ${field.label.toLowerCase()}...`}
                  className="w-full text-sm rounded-lg border border-slate-300 p-3 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy focus:border-christ-navy transition disabled:bg-slate-100 disabled:text-slate-600"
                />
              ) : (
                <input
                  type="text"
                  id={`field-${field.key}`}
                  value={val}
                  disabled={readOnly}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={readOnly ? 'No text recorded.' : `Enter ${field.label.toLowerCase()}...`}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy focus:border-christ-navy transition disabled:bg-slate-100 disabled:text-slate-600"
                />
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
