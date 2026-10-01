import feedbackJson from '../../seed/feedback_form.json';
import { Activity } from '../types';

export interface FeedbackFormSchema {
  id: string;
  title: string;
  subtitle: string;
  instructions: string;
  widgetType: 'composite';
  estimatedMinutes: number;
  parts: Array<{
    id: string;
    label?: string;
    widgetType: string;
    config: Record<string, any>;
  }>;
}

export const feedbackFormContent = feedbackJson as FeedbackFormSchema;

export const feedbackActivity: Activity = {
  activityId: feedbackFormContent.id,
  sessionId: 'closing',
  title: feedbackFormContent.title,
  instructions: feedbackFormContent.instructions,
  widgetType: 'composite',
  order: 99,
  sourceRef: 'SPEC_ADDENDUM',
  groupMode: 'individual',
  confidential: true,
  derived: false,
  config: {
    parts: feedbackFormContent.parts,
  },
};
