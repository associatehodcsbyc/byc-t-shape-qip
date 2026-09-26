import { Activity } from '../types';

/**
 * Extracts fields from an activity response that should be merged into workingDocs.fields
 * based on activity.carryForward.writeKeys and writeFrom.
 */
export function extractCarryForwardWrites(
  answers: Record<string, any> = {},
  activity: Partial<Activity>
): Record<string, any> {
  const extracted: Record<string, any> = {};
  const carryForward = activity.carryForward;

  if (!carryForward || !carryForward.writeKeys || carryForward.writeKeys.length === 0) {
    // If it's a working_doc widget without explicit writeKeys, copy all top-level answers
    if (activity.widgetType === 'working_doc') {
      return { ...answers };
    }
    return extracted;
  }

  const writeFrom = carryForward.writeFrom || {};

  for (const key of carryForward.writeKeys) {
    const sourcePath = writeFrom[key] || key;
    const parts = sourcePath.split('.');

    let currentVal: any = answers;
    let found = true;

    for (const part of parts) {
      if (currentVal && typeof currentVal === 'object' && part in currentVal) {
        currentVal = currentVal[part];
      } else {
        found = false;
        break;
      }
    }

    if (found && currentVal !== undefined) {
      extracted[key] = currentVal;
    } else {
      // Fallback: Check composite parts / nested objects for the key
      for (const partKey of Object.keys(answers)) {
        const sub = answers[partKey];
        if (sub && typeof sub === 'object' && key in sub && sub[key] !== undefined) {
          extracted[key] = sub[key];
          break;
        }
      }
    }
  }

  return extracted;
}
