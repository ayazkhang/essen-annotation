import { describe, expect, it } from 'vitest';
import { routeByDuration } from '../lib/pairing';
import { computeItemStatus } from '../lib/status';
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
