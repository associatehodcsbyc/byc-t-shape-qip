import { Activity } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_WIDGET_TYPES = new Set([
  'composite',
  'rating_scale',
  'choice_matrix',
  'rank_order',
  'checklist',
  'table_entry',
  'fixed_grid',
  'crm_matrix',
  'free_text',
  'working_doc',
  'poll',
  'ladder_game',
]);

const ACTIVITY_ID_REGEX = /^d[1-3]s[1-4]_a[0-9]+_[a-z0-9_]+$/;
const SESSION_ID_REGEX = /^d[1-3]s[1-4]$/;

/**
 * Validates a single Activity against seed/activities.schema.json
 */
export function validateActivity(act: any, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Activity #${index + 1} (${act?.activityId || 'unnamed'}):`;

  if (!act || typeof act !== 'object') {
    errors.push(`${prefix} Must be a valid object.`);
    return errors;
  }

  // Required: activityId
  if (!act.activityId || typeof act.activityId !== 'string') {
    errors.push(`${prefix} Missing required 'activityId'.`);
  } else if (!ACTIVITY_ID_REGEX.test(act.activityId)) {
    errors.push(
      `${prefix} 'activityId' ("${act.activityId}") does not match pattern ^d[1-3]s[1-4]_a[0-9]+_[a-z0-9_]+$.`
    );
  }

  // Required: sessionId
  if (!act.sessionId || typeof act.sessionId !== 'string') {
    errors.push(`${prefix} Missing required 'sessionId'.`);
  } else if (!SESSION_ID_REGEX.test(act.sessionId)) {
    errors.push(`${prefix} 'sessionId' ("${act.sessionId}") does not match pattern ^d[1-3]s[1-4]$.`);
  }

  // Required: order
  if (typeof act.order !== 'number' || act.order < 1 || !Number.isInteger(act.order)) {
    errors.push(`${prefix} 'order' must be an integer >= 1.`);
  }

  // Required: title
  if (typeof act.title !== 'string' || act.title.trim().length < 3) {
    errors.push(`${prefix} 'title' must be a string with at least 3 characters.`);
  }

  // Required: widgetType
  if (!VALID_WIDGET_TYPES.has(act.widgetType)) {
    errors.push(`${prefix} Invalid 'widgetType': "${act.widgetType}".`);
  }

  // Required: config
  if (!act.config || typeof act.config !== 'object' || Array.isArray(act.config)) {
    errors.push(`${prefix} 'config' must be an object.`);
  }

  // Required: sourceRef
  if (typeof act.sourceRef !== 'string') {
    errors.push(`${prefix} Missing required 'sourceRef' string.`);
  }

  // Required: groupMode
  if (act.groupMode !== 'individual' && act.groupMode !== 'group') {
    errors.push(`${prefix} 'groupMode' must be 'individual' or 'group'.`);
  }

  // Required: derived
  if (typeof act.derived !== 'boolean') {
    errors.push(`${prefix} 'derived' must be a boolean.`);
  }

  // Required: confidential
  if (typeof act.confidential !== 'boolean') {
    errors.push(`${prefix} 'confidential' must be a boolean.`);
  }

  // Optional: timeLimitMin
  if (act.timeLimitMin !== undefined) {
    if (
      typeof act.timeLimitMin !== 'number' ||
      !Number.isInteger(act.timeLimitMin) ||
      act.timeLimitMin < 1 ||
      act.timeLimitMin > 120
    ) {
      errors.push(`${prefix} 'timeLimitMin' must be an integer between 1 and 120.`);
    }
  }

  // Optional: carryForward
  if (act.carryForward !== undefined) {
    if (typeof act.carryForward !== 'object' || act.carryForward === null || Array.isArray(act.carryForward)) {
      errors.push(`${prefix} 'carryForward' must be an object.`);
    } else {
      if (act.carryForward.readKeys && !Array.isArray(act.carryForward.readKeys)) {
        errors.push(`${prefix} 'carryForward.readKeys' must be an array of strings.`);
      }
      if (act.carryForward.writeKeys && !Array.isArray(act.carryForward.writeKeys)) {
        errors.push(`${prefix} 'carryForward.writeKeys' must be an array of strings.`);
      }
      if (
        act.carryForward.writeFrom &&
        (typeof act.carryForward.writeFrom !== 'object' || Array.isArray(act.carryForward.writeFrom))
      ) {
        errors.push(`${prefix} 'carryForward.writeFrom' must be an object mapping.`);
      }
    }
  }

  // Optional: scoring
  if (act.scoring !== undefined) {
    if (typeof act.scoring !== 'object' || act.scoring === null) {
      errors.push(`${prefix} 'scoring' must be an object.`);
    } else {
      if (act.scoring.method !== 'sum') {
        errors.push(`${prefix} 'scoring.method' must be 'sum'.`);
      }
      if (act.scoring.bands) {
        if (!Array.isArray(act.scoring.bands)) {
          errors.push(`${prefix} 'scoring.bands' must be an array.`);
        } else {
          act.scoring.bands.forEach((b: any, bIdx: number) => {
            if (
              typeof b.min !== 'number' ||
              typeof b.max !== 'number' ||
              typeof b.label !== 'string'
            ) {
              errors.push(`${prefix} Band #${bIdx + 1} must have 'min' (number), 'max' (number), and 'label' (string).`);
            }
          });
        }
      }
    }
  }

  // Reflections check if present in config
  if (act.config?.reflections) {
    if (!Array.isArray(act.config.reflections)) {
      errors.push(`${prefix} 'config.reflections' must be an array.`);
    } else {
      act.config.reflections.forEach((r: any, rIdx: number) => {
        if (!r.id || typeof r.id !== 'string') {
          errors.push(`${prefix} Reflection #${rIdx + 1} missing required 'id'.`);
        }
        if (!r.prompt || typeof r.prompt !== 'string') {
          errors.push(`${prefix} Reflection #${rIdx + 1} missing required 'prompt'.`);
        }
      });
    }
  }

  return errors;
}

/**
 * Validates the full activities seed payload
 */
export function validateActivitiesSeed(payload: any): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Invalid payload: Must be a JSON object.'] };
  }

  if (!payload.version || typeof payload.version !== 'string') {
    errors.push("Missing or invalid required 'version' string.");
  }

  if (!Array.isArray(payload.activities)) {
    errors.push("Missing or invalid required 'activities' array.");
    return { valid: false, errors };
  }

  if (payload.groupLabels && !Array.isArray(payload.groupLabels)) {
    errors.push("'groupLabels' must be an array of strings.");
  }

  if (payload.groupProtocol && typeof payload.groupProtocol !== 'string') {
    errors.push("'groupProtocol' must be a string.");
  }

  payload.activities.forEach((act: Activity, idx: number) => {
    const actErrors = validateActivity(act, idx);
    errors.push(...actErrors);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
