import { describe, expect, it } from 'vitest';
import { assertSpanOffsets, parseSpanAttributes } from '../lib/spans';

describe('span persistence validation', () => {
  it('validates NUMBER attributes', () => {
    expect(
      parseSpanAttributes('NUMBER', { rendering: 'words', normalizedValue: 12 }),
    ).toEqual({ rendering: 'words', normalizedValue: 12 });
  });

  it('normalizes MEASUREMENT attributes on parse', () => {
    const attrs = parseSpanAttributes('MEASUREMENT', { value: 1500, unit: 'mg' });
    expect(attrs).toMatchObject({
      value: 1500,
      unit: 'mg',
      normalizedValue: 1.5,
      baseUnit: 'g',
    });
  });

  it('validates MEDICAL_TERM and FORMATTING_COMMAND', () => {
    expect(
      parseSpanAttributes('MEDICAL_TERM', { category: 'drug', note: 'Cefuroxim' }),
    ).toMatchObject({ category: 'drug' });

    expect(
      parseSpanAttributes('FORMATTING_COMMAND', {
        command: 'newline',
        isCommand: true,
      }),
    ).toEqual({ command: 'newline', isCommand: true });
  });

  it('rejects out-of-range offsets', () => {
    expect(() => assertSpanOffsets(0, 5, 4)).toThrow(/exceeds/);
    expect(() => assertSpanOffsets(3, 3, 10)).toThrow(/less than/);
  });

  it('accepts overlapping span offsets (policy: allowed)', () => {
    expect(() => assertSpanOffsets(0, 10, 20)).not.toThrow();
    expect(() => assertSpanOffsets(5, 15, 20)).not.toThrow();
  });
});
