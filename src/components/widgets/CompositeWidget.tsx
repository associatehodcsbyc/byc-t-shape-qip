import React from 'react';
import { Activity, CompositeConfig, CompositePart } from '../../types';
import { RatingScaleWidget } from './RatingScaleWidget';
import { ChoiceMatrixWidget } from './ChoiceMatrixWidget';
import { RankOrderWidget } from './RankOrderWidget';
import { ChecklistWidget } from './ChecklistWidget';
import { TableEntryWidget } from './TableEntryWidget';
import { FreeTextWidget } from './FreeTextWidget';
import { PollWidget } from './PollWidget';
import { WorkingDocWidget } from './WorkingDocWidget';
import { FixedGridWidget } from './FixedGridWidget';
import { CrmMatrixWidget } from './CrmMatrixWidget';
import { ReflectionsWidget } from './ReflectionsWidget';

interface CompositeWidgetProps {
  activity: Activity;
  answers: Record<string, any>;
  onChange: (updatedAnswers: Record<string, any>) => void;
  readOnly?: boolean;
}

export const CompositeWidget: React.FC<CompositeWidgetProps> = ({
  activity,
  answers = {},
  onChange,
  readOnly = false,
}) => {
  const config = activity.config as CompositeConfig;
  const parts = config.parts || [];

  const handlePartChange = (partId: string, partAnswers: any) => {
    if (readOnly) return;
    onChange({
      ...answers,
      [partId]: partAnswers,
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

  const renderPartWidget = (part: CompositePart) => {
    // Construct a sub-activity object for the part
    const subActivity: Activity = {
      ...activity,
      widgetType: part.widgetType,
      config: part.config,
    };
    const partAnswers = answers[part.id] || {};

    const updateCurrentPart = (updated: any) => {
      handlePartChange(part.id, updated);
    };

    switch (part.widgetType) {
      case 'rating_scale':
        return (
          <RatingScaleWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'choice_matrix':
        return (
          <ChoiceMatrixWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'rank_order':
        return (
          <RankOrderWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'checklist':
        return (
          <ChecklistWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'table_entry':
        return (
          <TableEntryWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'free_text':
        return (
          <FreeTextWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'poll':
        return (
          <PollWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'working_doc':
        return (
          <WorkingDocWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'fixed_grid':
        return (
          <FixedGridWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      case 'crm_matrix':
        return (
          <CrmMatrixWidget
            activity={subActivity}
            answers={partAnswers}
            onChange={updateCurrentPart}
            readOnly={readOnly}
          />
        );
      default:
        return (
          <div className="p-4 bg-slate-100 rounded-lg text-xs text-slate-500">
            Widget type {part.widgetType} will be available in Day 2-3 set.
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      {parts.map((part, index) => (
        <section
          key={part.id}
          className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden"
        >
          {/* Part Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-christ-navy text-white text-xs font-extrabold flex items-center justify-center">
                {index + 1}
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                {part.label || `Part ${part.id.toUpperCase()}`}
              </h3>
            </div>
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold">
              {part.widgetType.replace('_', ' ')}
            </span>
          </div>

          {/* Part Instructions if any */}
          {part.instructions && (
            <div className="px-5 py-3 bg-amber-50/50 border-b border-amber-100 text-xs text-slate-700 italic">
              {part.instructions}
            </div>
          )}

          {/* Part Content */}
          <div className="p-5">{renderPartWidget(part)}</div>
        </section>
      ))}

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
