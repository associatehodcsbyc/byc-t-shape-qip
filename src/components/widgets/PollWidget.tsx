import React from 'react';
import { Activity, PollConfig } from '../../types';
import { ReflectionsWidget } from './ReflectionsWidget';

interface PollWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const PollWidget: React.FC<PollWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as PollConfig;
  const questions = config.questions || [];

  const handleSingleSelect = (qId: string, optId: string) => {
    if (readOnly) return;
    onChange({
      ...answers,
      [qId]: optId,
    });
  };

  const handleMultiToggle = (qId: string, optId: string) => {
    if (readOnly) return;
    const current: string[] = Array.isArray(answers[qId]) ? answers[qId] : [];
    const isChecked = current.includes(optId);
    const updated = isChecked
      ? current.filter((item) => item !== optId)
      : [...current, optId];

    onChange({
      ...answers,
      [qId]: updated,
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
      {questions.map((q, qIdx) => {
        const val = answers[q.id];

        return (
          <div
            key={q.id}
            className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-christ-gold">
                {q.multi ? 'Multiple Choice Poll' : 'Single Choice Poll'}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1 leading-snug">
                {questions.length > 1 && (
                  <span className="inline-block w-5 h-5 rounded-full bg-christ-navy text-white text-xs font-bold text-center leading-5 mr-2">
                    {qIdx + 1}
                  </span>
                )}
                {q.prompt}
              </h3>
            </div>

            <div className="space-y-2">
              {q.options.map((opt) => {
                const isSelected = q.multi
                  ? Array.isArray(val) && val.includes(opt.id)
                  : val === opt.id;

                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-50/50 border-christ-navy ring-1 ring-christ-navy shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    } ${readOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    <input
                      type={q.multi ? 'checkbox' : 'radio'}
                      name={`poll-${q.id}`}
                      checked={Boolean(isSelected)}
                      disabled={readOnly}
                      onChange={() =>
                        q.multi
                          ? handleMultiToggle(q.id, opt.id)
                          : handleSingleSelect(q.id, opt.id)
                      }
                      className={`text-christ-navy focus:ring-christ-navy mt-0.5 shrink-0 ${
                        q.multi ? 'rounded w-4 h-4' : 'w-4 h-4'
                      }`}
                    />
                    <div className="text-sm font-medium text-slate-800 leading-snug">
                      {opt.text}
                    </div>
                  </label>
                );
              })}
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
