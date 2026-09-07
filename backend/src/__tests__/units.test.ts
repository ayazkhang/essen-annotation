import { describe, expect, it } from 'vitest';
import { normalizeMeasurement } from '../lib/units';

describe('unit normalization', () => {
  it('converts mass units to grams', () => {
    expect(normalizeMeasurement(1500, 'mg')).toEqual({
      value: 1500,
      unit: 'mg',
      normalizedValue: 1.5,
      baseUnit: 'g',
    });
    expect(normalizeMeasurement(2, 'kg').normalizedValue).toBe(2000);
    expect(normalizeMeasurement(1000, 'ug').normalizedValue).toBeCloseTo(0.001);
  });

  it('converts volume and length', () => {
    expect(normalizeMeasurement(500, 'ml').normalizedValue).toBe(0.5);
    expect(normalizeMeasurement(10, 'mm').normalizedValue).toBe(1);
  });

  it('leaves mmHg / IE / Ch as identity', () => {
    expect(normalizeMeasurement(120, 'mmHg').normalizedValue).toBe(120);
    expect(normalizeMeasurement(6, 'Ch').baseUnit).toBe('Ch');
  });
});
