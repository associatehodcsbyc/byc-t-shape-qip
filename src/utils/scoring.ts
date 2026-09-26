import { Activity, ScoreBand } from '../types';

export interface SectionScore {
  sectionId: string;
  title: string;
  score: number;
  maxScore: number;
  itemCount: number;
  answeredCount: number;
}

export interface RatingScaleScoreResult {
  totalScore: number;
  maxScore: number;
  totalItems: number;
  answeredItems: number;
  sections: SectionScore[];
  band: ScoreBand | null;
}

/**
 * Computes rating scale totals, section breakdowns, and matching score bands.
 */
export function computeRatingScaleScore(
  answers: Record<string, any> = {},
  activity: Partial<Activity>
): RatingScaleScoreResult {
  const config = activity.config || {};
  const scoring = activity.scoring;
  const sectionsConfig = config.sections || [];
  const scaleMax = config.scale?.max || 5;

  let totalScore = 0;
  let totalItems = 0;
  let answeredItems = 0;
  const sections: SectionScore[] = [];

  if (sectionsConfig.length > 0) {
    for (const sec of sectionsConfig) {
      let secScore = 0;
      let secAnswered = 0;
      const secItems = sec.items || [];

      for (const item of secItems) {
        totalItems++;
        const val = answers[item.id];
        if (typeof val === 'number' && !isNaN(val)) {
          secScore += val;
          secAnswered++;
          answeredItems++;
        }
      }

      totalScore += secScore;
      sections.push({
        sectionId: sec.id,
        title: sec.title,
        score: secScore,
        maxScore: secItems.length * scaleMax,
        itemCount: secItems.length,
        answeredCount: secAnswered,
      });
    }
  } else if (config.items && Array.isArray(config.items)) {
    // Single section / flat items list
    let flatScore = 0;
    let flatAnswered = 0;
    for (const item of config.items) {
      totalItems++;
      const val = answers[item.id];
      if (typeof val === 'number' && !isNaN(val)) {
        flatScore += val;
        flatAnswered++;
        answeredItems++;
      }
    }
    totalScore = flatScore;
    sections.push({
      sectionId: 'default',
      title: 'Items',
      score: flatScore,
      maxScore: config.items.length * scaleMax,
      itemCount: config.items.length,
      answeredCount: flatAnswered,
    });
  }

  const configuredMax = scoring?.max || totalItems * scaleMax;

  // Determine score band
  let matchedBand: ScoreBand | null = null;
  if (scoring?.bands && scoring.bands.length > 0) {
    matchedBand =
      scoring.bands.find(
        (b) => totalScore >= b.min && totalScore <= b.max
      ) || null;

    // Fallback if score exceeds maximum band or is lower than lowest band
    if (!matchedBand) {
      if (totalScore >= scoring.bands[0].max) {
        matchedBand = scoring.bands[0];
      } else {
        matchedBand = scoring.bands[scoring.bands.length - 1];
      }
    }
  }

  return {
    totalScore,
    maxScore: configuredMax,
    totalItems,
    answeredItems,
    sections,
    band: matchedBand,
  };
}

/**
 * Ratio by category computation (e.g. Draw Our T 70:30)
 */
export interface RatioByCategoryResult {
  categorySums: Record<string, number>;
  total: number;
  percentages: Record<string, number>;
  target: string;
}

export function computeRatioByCategory(
  rows: Record<string, any>[] = [],
  valueColumn: string,
  categoryColumn: string,
  target: string
): RatioByCategoryResult {
  const categorySums: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    const rawVal = row[valueColumn];
    const val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
    const cat = String(row[categoryColumn] || 'Unclassified').trim();

    categorySums[cat] = (categorySums[cat] || 0) + val;
    total += val;
  }

  const percentages: Record<string, number> = {};
  for (const [cat, sum] of Object.entries(categorySums)) {
    percentages[cat] = total > 0 ? Math.round((sum / total) * 100) : 0;
  }

  return {
    categorySums,
    total,
    percentages,
    target,
  };
}

/**
 * Column sum computation with expected value check
 */
export function computeColumnSum(
  rows: Record<string, any>[] = [],
  column: string,
  expect?: number
): { sum: number; expect?: number; matches: boolean } {
  let sum = 0;
  for (const row of rows) {
    const rawVal = row[column];
    const val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
    sum += val;
  }
  const matches = expect === undefined || sum === expect;
  return { sum, expect, matches };
}

/**
 * Row sum computation across specified columns
 */
export function computeRowSum(
  row: Record<string, any> = {},
  columns: string[] = []
): number {
  let sum = 0;
  for (const col of columns) {
    const rawVal = row[col];
    const val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
    sum += val;
  }
  return sum;
}
