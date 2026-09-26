import { describe, it, expect } from 'vitest';
import { toDepartmentId } from '../src/utils/department';

describe('toDepartmentId utility', () => {
  it('converts "Computer Science" to "computer-science"', () => {
    expect(toDepartmentId('Computer Science')).toBe('computer-science');
  });

  it('converts "&" to "and"', () => {
    expect(toDepartmentId('Commerce & Management')).toBe('commerce-and-management');
    expect(toDepartmentId('Arts & Humanities & Sciences')).toBe('arts-and-humanities-and-sciences');
  });

  it('lowercases and trims leading/trailing whitespace', () => {
    expect(toDepartmentId('   Data Science   ')).toBe('data-science');
    expect(toDepartmentId('\tMathematics\n')).toBe('mathematics');
  });

  it('converts runs of non-alphanumerics into single hyphens', () => {
    expect(toDepartmentId('Artificial Intelligence / Machine Learning')).toBe('artificial-intelligence-machine-learning');
    expect(toDepartmentId('Media, Communications & Journalism (MCJ)')).toBe('media-communications-and-journalism-mcj');
    expect(toDepartmentId('Physics (General & Applied) - 2026')).toBe('physics-general-and-applied-2026');
  });

  it('strips leading and trailing hyphens', () => {
    expect(toDepartmentId('--Economics--')).toBe('economics');
    expect(toDepartmentId('!Chemistry!')).toBe('chemistry');
    expect(toDepartmentId('---')).toBe('');
  });

  it('handles single-word and already normalized names', () => {
    expect(toDepartmentId('byc')).toBe('byc');
    expect(toDepartmentId('computer-science')).toBe('computer-science');
  });

  it('handles empty strings gracefully', () => {
    expect(toDepartmentId('')).toBe('');
  });
});
