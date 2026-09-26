import React, { useMemo } from 'react';
import { Activity, RatingScaleConfig } from '../../types';
import { computeRatingScaleScore } from '../../utils/scoring';
import { ReflectionsWidget } from './ReflectionsWidget';

interface RatingScaleWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const RatingScaleWidget: React.FC<RatingScaleWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as RatingScaleConfig;
  const scale = config?.scale || { min: 1, max: 5, labels: ['1', '2', '3', '4', '5'] };
  const evidence = Boolean(config?.evidence);

  const scaleValues = useMemo(() => {
    const list: number[] = [];
    for (let i = scale.min; i <= scale.max; i++) {
      list.push(i);
    }
    return list;
  }, [scale.min, scale.max]);

  const scoreResult = useMemo(() => {
    return computeRatingScaleScore(answers, activity);
  }, [answers, activity]);

  const handleRatingChange = (itemId: string, val: number) => {
    if (readOnly) return;
    onChange({
      ...answers,
      [itemId]: val,
    });
  };

  const handleEvidenceChange = (itemId: string, text: string) => {
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

  const sections = config.sections || (config.items ? [{ id: 'all', title: 'Items', items: config.items }] : []);

  return (
    <div className="space-y-8">
      {/* Live Scoring Summary Bar */}
      <div className="bg-gradient-to-r from-slate-900 to-christ-navy text-white rounded-xl p-5 shadow-md border border-christ-navy/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-christ-gold font-bold">
                Live Rating Summary
              </span>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded font-mono text-slate-300">
                {scoreResult.answeredItems} of {scoreResult.totalItems} rated
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white">
                {scoreResult.totalScore}
              </span>
              <span className="text-sm text-slate-300">
                / {scoreResult.maxScore} points
              </span>
            </div>
          </div>

          {scoreResult.band && (
            <div className="sm:text-right bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/10 max-w-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold block">
                Current Interpretation Band
              </span>
              <span className="text-sm font-bold text-christ-gold block mt-0.5">
                {scoreResult.band.label}
              </span>
              {scoreResult.band.description && (
                <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">
                  {scoreResult.band.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Section Subtotal Pills */}
        {scoreResult.sections.length > 1 && (
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-2">
            {scoreResult.sections.map((sec) => (
              <div
                key={sec.sectionId}
                className="bg-black/20 px-2.5 py-1 rounded text-xs flex items-center gap-1.5"
              >
                <span className="text-slate-300 font-medium truncate max-w-[120px]">
                  {sec.title}:
                </span>
                <span className="font-bold text-christ-gold">
                  {sec.score} / {sec.maxScore}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rating Scale Legend */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600">
        <span className="font-semibold text-slate-800">Rating Scale Key:</span>
        <div className="flex flex-wrap gap-3">
          {scaleValues.map((v, i) => (
            <div key={v} className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-christ-navy text-white text-[10px] font-bold flex items-center justify-center">
                {v}
              </span>
              <span>{scale.labels?.[i] || v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sections and Items */}
      {sections.map((sec, secIdx) => {
        const secStats = scoreResult.sections.find((s) => s.sectionId === sec.id);

        return (
          <div
            key={sec.id || secIdx}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                {sec.title}
              </h3>
              {secStats && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                  {secStats.score} / {secStats.maxScore} pts ({secStats.answeredCount}/{secStats.itemCount})
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {sec.items.map((item) => {
                const currentRating = answers[item.id];
                const currentEvidence = answers[`${item.id}_ev`] || '';

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 transition ${
                      currentRating ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800 leading-relaxed">
                          <span className="inline-block text-xs font-mono font-bold text-slate-400 mr-2">
                            {item.id.toUpperCase()}
                          </span>
                          {item.text}
                        </div>
                      </div>

                      {/* Scale Radios */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {scaleValues.map((v, i) => {
                          const isSelected = currentRating === v;
                          return (
                            <button
                              type="button"
                              key={v}
                              disabled={readOnly}
                              onClick={() => handleRatingChange(item.id, v)}
                              title={`${v}: ${scale.labels?.[i] || v}`}
                              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg font-bold text-xs flex flex-col items-center justify-center transition border ${
                                isSelected
                                  ? 'bg-christ-navy text-white border-christ-navy ring-2 ring-christ-gold shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              <span className="text-sm">{v}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Evidence Box */}
                    {evidence && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <label
                          htmlFor={`ev-${item.id}`}
                          className="block text-xs font-medium text-slate-500 mb-1"
                        >
                          Evidence / Notes (optional):
                        </label>
                        <input
                          type="text"
                          id={`ev-${item.id}`}
                          disabled={readOnly}
                          value={currentEvidence}
                          onChange={(e) => handleEvidenceChange(item.id, e.target.value)}
                          placeholder={readOnly ? '' : 'e.g. Course syllabus section 4, rubric in LMS'}
                          className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-white focus:ring-1 focus:ring-christ-navy focus:border-christ-navy disabled:bg-slate-100"
                        />
                      </div>
                    )}
                  </div>
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
