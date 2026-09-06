import { describe, expect, it } from 'vitest';
import {
  normalizeFilename,
  pairTranscriptsToAudio,
  parseTranscriptJson,
  routeByDuration,
} from './pairing';
import { normalizeMeasurement } from './units';
import { assertSpanOffsets, parseSpanAttributes } from './spans';
import { estimateDistanceFromPcm, estimateSpeechRateWpm } from './audio';
import { computeItemStatus } from './status';
import { ItemStatus } from '@prisma/client';

describe('15-second routing rule', () => {
  it('auto-rejects recordings at or under 15 seconds', () => {
    expect(routeByDuration(0)).toBe('AUTO_REJECTED');
    expect(routeByDuration(15)).toBe('AUTO_REJECTED');
    expect(routeByDuration(14.999)).toBe('AUTO_REJECTED');
  });

  it('routes recordings longer than 15 seconds to PENDING', () => {
    expect(routeByDuration(15.001)).toBe('PENDING');
    expect(routeByDuration(60)).toBe('PENDING');
  });

  it('returns null when duration is unknown', () => {
    expect(routeByDuration(null)).toBeNull();
    expect(routeByDuration(undefined)).toBeNull();
  });

  it('computeItemStatus respects pairing and duration', () => {
    expect(
      computeItemStatus({
        hasAudio: true,
        hasTranscript: true,
        durationSeconds: 10,
      }),
    ).toBe(ItemStatus.AUTO_REJECTED);

    expect(
      computeItemStatus({
        hasAudio: true,
        hasTranscript: true,
        durationSeconds: 20,
      }),
    ).toBe(ItemStatus.PENDING);

    expect(
      computeItemStatus({
        hasAudio: true,
        hasTranscript: false,
        durationSeconds: 20,
      }),
    ).toBe(ItemStatus.UNPAIRED);

    expect(
      computeItemStatus({
        hasAudio: true,
        hasTranscript: true,
        durationSeconds: 20,
        currentStatus: ItemStatus.COMPLETED,
      }),
    ).toBe(ItemStatus.COMPLETED);
  });
});

describe('pairing logic', () => {
  it('normalizes paths to basename', () => {
    expect(normalizeFilename('audio/880_NTX.wav')).toBe('880_NTX.wav');
    expect(normalizeFilename('C:\\clips\\a.mp3')).toBe('a.mp3');
  });

  it('keeps good rows and reports malformed / missing / duplicates', () => {
    const { rows, issues } = parseTranscriptJson([
      { path: 'audio/a.wav', label: 'hello' },
      { path: 'audio/a.wav', label: 'dup' },
      { path: 'b.wav' },
      null,
      { path: 'c.wav', label: 'ok' },
    ]);

    expect(rows).toEqual([
      { path: 'a.wav', label: 'hello' },
      { path: 'c.wav', label: 'ok' },
    ]);
    expect(issues.map((i) => i.kind)).toEqual([
      'duplicate_path',
      'missing_fields',
      'malformed_entry',
    ]);
  });

  it('reports unmatched audio and transcripts without dropping matches', () => {
    const result = pairTranscriptsToAudio(
      ['a.wav', 'b.wav'],
      [
        { path: 'audio/a.wav', label: 'one' },
        { path: 'c.wav', label: 'orphan' },
      ],
    );

    expect(result.matched).toEqual([{ filename: 'a.wav', label: 'one' }]);
    expect(result.unmatchedAudio).toEqual(['b.wav']);
    expect(result.unmatchedTranscripts).toEqual([{ filename: 'c.wav', label: 'orphan' }]);
    expect(result.issues).toHaveLength(2);
  });

  it('rejects non-array JSON root', () => {
    const { rows, issues } = parseTranscriptJson({ path: 'a.wav', label: 'x' });
    expect(rows).toHaveLength(0);
    expect(issues[0].kind).toBe('malformed_entry');
  });
});

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
    // Overlaps are allowed at the model layer; only bounds are checked.
    expect(() => assertSpanOffsets(0, 10, 20)).not.toThrow();
    expect(() => assertSpanOffsets(5, 15, 20)).not.toThrow();
  });
});

describe('recording condition helpers', () => {
  it('estimates WPM from tokens and duration', () => {
    // 10 tokens in 30s => 20 wpm
    expect(estimateSpeechRateWpm('a b c d e f g h i j', 30)).toBe(20);
  });

  it('maps loud PCM relative to quiet frames toward closer estimate', () => {
    const quiet = new Float32Array(4096);
    const loud = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      quiet[i] = (Math.random() - 0.5) * 0.01;
      loud[i] = Math.sin(i / 10) * 0.5;
    }
    // First 10% frames quiet-ish, rest loud
    const mixed = new Float32Array(8192);
    mixed.set(quiet, 0);
    mixed.set(loud, 4096);
    const estimate = estimateDistanceFromPcm(mixed, 1024);
    expect(estimate).toBeGreaterThan(0.2);
    expect(estimate).toBeLessThanOrEqual(1);
  });
});
