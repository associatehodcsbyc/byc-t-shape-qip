import React from 'react';
import { Activity, FreeTextConfig } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface FreeTextWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const FreeTextWidget: React.FC<FreeTextWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as FreeTextConfig;
  const questions = config.questions || [];

  const handleTextChange = (qId: string, val: string) => {
    if (readOnly) return;
    onChange({
      ...answers,
      [qId]: val,
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
      {questions.map((q, idx) => {
        const textVal = typeof answers[q.id] === 'string' ? answers[q.id] : '';
        const maxChars = q.maxChars || 2000;
        const charsLeft = maxChars - textVal.length;

        return (
          <div
            key={q.id}
            className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition"
          >
            <label
              htmlFor={`freetext-${q.id}`}
              className="block text-sm font-bold text-slate-800 mb-2 leading-relaxed"
            >
              <span className="inline-block w-6 h-6 rounded-full bg-christ-navy text-white text-xs font-bold text-center leading-6 mr-2">
                {idx + 1}
              </span>
              {q.prompt}
            </label>
            <textarea
              id={`freetext-${q.id}`}
              rows={4}
              value={textVal}
              disabled={readOnly}
              maxLength={maxChars}
              onChange={(e) => handleTextChange(q.id, e.target.value)}
              placeholder={readOnly ? 'No response recorded.' : 'Type your answer here...'}
              className="w-full text-sm rounded-lg border border-slate-300 p-3 bg-white text-slate-900 focus:ring-2 focus:ring-christ-navy focus:border-christ-navy transition disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
              <span>{readOnly ? 'Locked' : 'Character count limit'}</span>
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
