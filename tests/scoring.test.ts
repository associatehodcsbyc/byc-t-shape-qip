import { describe, it, expect } from 'vitest';
import {
  computeRatingScaleScore,
  computeRatioByCategory,
  computeColumnSum,
  computeRowSum,
} from '../src/utils/scoring';
import { Activity } from '../src/types';

describe('Scoring Utilities', () => {
  const sampleActivity: Partial<Activity> = {
    activityId: 'd1s3_a1_rigour_checklist',
    widgetType: 'rating_scale',
    scoring: {
      method: 'sum',
      max: 260,
      bands: [
        { min: 220, max: 260, label: 'Exemplary' },
        { min: 180, max: 219, label: 'Strong' },
        { min: 140, max: 179, label: 'Developing' },
        { min: 52, max: 139, label: 'Significant enhancement required' },
      ],
    },
    config: {
      scale: { min: 1, max: 5, labels: ['1', '2', '3', '4', '5'] },
      sections: [
        {
          id: 'A',
          title: 'Section A',
          items: [
            { id: 'a1', text: 'Item A1' },
            { id: 'a2', text: 'Item A2' },
          ],
        },
        {
          id: 'B',
          title: 'Section B',
          items: [
            { id: 'b1', text: 'Item B1' },
            { id: 'b2', text: 'Item B2' },
          ],
        },
      ],
    },
  };

  it('calculates sum, section subtotals and matching Exemplary band', () => {
    const answers = {
      a1: 5,
      a2: 5,
      b1: 5,
      b2: 5,
    };
    // 20 points
    const customAct = {
      ...sampleActivity,
      scoring: {
        method: 'sum' as const,
        max: 20,
        bands: [
          { min: 18, max: 20, label: 'Exemplary' },
          { min: 14, max: 17, label: 'Strong' },
          { min: 10, max: 13, label: 'Developing' },
          { min: 4, max: 9, label: 'Needs Improvement' },
        ],
      },
    };

    const res = computeRatingScaleScore(answers, customAct);
    expect(res.totalScore).toBe(20);
    expect(res.maxScore).toBe(20);
    expect(res.answeredItems).toBe(4);
    expect(res.totalItems).toBe(4);
    expect(res.sections).toHaveLength(2);
    expect(res.sections[0].score).toBe(10);
    expect(res.sections[1].score).toBe(10);
    expect(res.band?.label).toBe('Exemplary');
  });

  it('correctly maps to Strong, Developing, and Needs Improvement bands', () => {
    const customAct = {
      ...sampleActivity,
      scoring: {
        method: 'sum' as const,
        max: 20,
        bands: [
          { min: 18, max: 20, label: 'Exemplary' },
          { min: 14, max: 17, label: 'Strong' },
          { min: 10, max: 13, label: 'Developing' },
          { min: 4, max: 9, label: 'Needs Improvement' },
        ],
      },
    };

    const strongRes = computeRatingScaleScore({ a1: 4, a2: 4, b1: 4, b2: 4 }, customAct);
    expect(strongRes.totalScore).toBe(16);
    expect(strongRes.band?.label).toBe('Strong');

    const devRes = computeRatingScaleScore({ a1: 3, a2: 3, b1: 3, b2: 3 }, customAct);
    expect(devRes.totalScore).toBe(12);
    expect(devRes.band?.label).toBe('Developing');

    const lowRes = computeRatingScaleScore({ a1: 1, a2: 2, b1: 1, b2: 2 }, customAct);
    expect(lowRes.totalScore).toBe(6);
    expect(lowRes.band?.label).toBe('Needs Improvement');
  });

  it('handles partial answers correctly', () => {
    const customAct = {
      ...sampleActivity,
      scoring: {
        method: 'sum' as const,
        max: 20,
        bands: [{ min: 0, max: 20, label: 'All' }],
      },
    };

    const partial = computeRatingScaleScore({ a1: 5 }, customAct);
    expect(partial.totalScore).toBe(5);
    expect(partial.answeredItems).toBe(1);
    expect(partial.totalItems).toBe(4);
    expect(partial.sections[0].answeredCount).toBe(1);
    expect(partial.sections[1].answeredCount).toBe(0);
  });

  it('computes ratio by category for Draw Our T', () => {
    const rows = [
      { course: 'CS101', strand: 'Vertical - disciplinary depth', credits: 4 },
      { course: 'CS102', strand: 'Vertical - disciplinary depth', credits: 3 },
      { course: 'ENG101', strand: 'Horizontal - breadth / transferable', credits: 3 },
    ];
    const res = computeRatioByCategory(
      rows,
      'credits',
      'strand',
      '70:30 (Vertical:Horizontal)'
    );

    expect(res.total).toBe(10);
    expect(res.categorySums['Vertical - disciplinary depth']).toBe(7);
    expect(res.categorySums['Horizontal - breadth / transferable']).toBe(3);
    expect(res.percentages['Vertical - disciplinary depth']).toBe(70);
    expect(res.percentages['Horizontal - breadth / transferable']).toBe(30);
  });

  it('computes column sum and checks against expected value', () => {
    const rows = [
      { task: 'T1', weight: 40 },
      { task: 'T2', weight: 60 },
    ];
    const matchRes = computeColumnSum(rows, 'weight', 100);
    expect(matchRes.sum).toBe(100);
    expect(matchRes.matches).toBe(true);

    const failRes = computeColumnSum(rows, 'weight', 80);
    expect(failRes.sum).toBe(100);
    expect(failRes.matches).toBe(false);
  });

  it('computes row sum for priority matrix', () => {
    const row = { impact: 4, urgency: 5, feasibility: 3 };
    const sum = computeRowSum(row, ['impact', 'urgency', 'feasibility']);
    expect(sum).toBe(12);
  });
});
