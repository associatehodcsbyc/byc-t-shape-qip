import { describe, it, expect } from 'vitest';
import { extractCarryForwardWrites } from '../src/utils/carryForward';
import { Activity } from '../src/types';

describe('Carry-Forward Extraction Utilities', () => {
  it('extracts writes for working_doc activities without writeKeys', () => {
    const activity: Partial<Activity> = {
      activityId: 'd2s1_a1_register_working_doc',
      widgetType: 'working_doc',
    };
    const answers = {
      courseName: 'Data Structures',
      targetSemester: 3,
      rationale: 'Core foundational course',
    };

    const extracted = extractCarryForwardWrites(answers, activity);
    expect(extracted).toEqual({
      courseName: 'Data Structures',
      targetSemester: 3,
      rationale: 'Core foundational course',
    });
  });

  it('extracts direct writeKeys when no writeFrom is specified', () => {
    const activity: Partial<Activity> = {
      activityId: 'd2s1_a2_threshold_concepts',
      widgetType: 'table_entry',
      carryForward: {
        writeKeys: ['threshold_concepts_table', 'key_concept'],
      },
    };
    const answers = {
      threshold_concepts_table: [{ concept: 'Recursion' }],
      key_concept: 'Tree Traversal',
      other_field: 'ignored',
    };

    const extracted = extractCarryForwardWrites(answers, activity);
    expect(extracted).toEqual({
      threshold_concepts_table: [{ concept: 'Recursion' }],
      key_concept: 'Tree Traversal',
    });
    expect(extracted.other_field).toBeUndefined();
  });

  it('extracts priorityStage using writeFrom in d2s2_a2_doing_to_deep_learning', () => {
    const activity: Partial<Activity> = {
      activityId: 'd2s2_a2_doing_to_deep_learning',
      widgetType: 'composite',
      carryForward: {
        readKeys: ['course', 'originalItem'],
        writeKeys: ['priorityStage'],
        writeFrom: {
          priorityStage: 'p3.q1',
        },
      },
    };
    const answers = {
      p1: { r1: 'Present' },
      p2: { r1: 'Partial' },
      p3: {
        q1: 'Stage 3: Authentic Problem Scaffolding',
        q2: 'Code repository with automated test fixtures',
      },
    };

    const extracted = extractCarryForwardWrites(answers, activity);
    expect(extracted).toEqual({
      priorityStage: 'Stage 3: Authentic Problem Scaffolding',
    });
  });

  it('extracts rewrittenItem from composite part fallback in d2s2_a3_rewrite_working_doc', () => {
    const activity: Partial<Activity> = {
      activityId: 'd2s2_a3_rewrite_working_doc',
      widgetType: 'composite',
      carryForward: {
        readKeys: ['course', 'originalItem', 'priorityStage'],
        writeKeys: ['rewrittenItem', 'addedComponents'],
      },
    };
    const answers = {
      p1: { i1: true, i2: true },
      p2: {
        rewrittenItem: 'Given a distributed database partition, design a consensus mechanism ensuring linearizability.',
        addedComponents: 'Fault-injection test harness and formal state transition proof.',
      },
      p3: { c1: 'DOK 4' },
      p4: 'Reflection notes',
    };

    const extracted = extractCarryForwardWrites(answers, activity);
    expect(extracted).toEqual({
      rewrittenItem: 'Given a distributed database partition, design a consensus mechanism ensuring linearizability.',
      addedComponents: 'Fault-injection test harness and formal state transition proof.',
    });
  });

  it('handles missing keys in answers gracefully', () => {
    const activity: Partial<Activity> = {
      activityId: 'd1s1_test',
      widgetType: 'free_text',
      carryForward: {
        writeKeys: ['missingKey', 'presentKey'],
        writeFrom: {
          missingKey: 'p9.unknown',
          presentKey: 'p1.q1',
        },
      },
    };
    const answers = {
      p1: { q1: 'Existing value' },
    };

    const extracted = extractCarryForwardWrites(answers, activity);
    expect(extracted).toEqual({
      presentKey: 'Existing value',
    });
    expect('missingKey' in extracted).toBe(false);
  });
});
