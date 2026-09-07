import { describe, expect, it } from 'vitest';
import { estimateDistanceFromPcm, estimateSpeechRateWpm } from '../lib/audio';

describe('recording condition helpers', () => {
  it('estimates WPM from tokens and duration', () => {
    expect(estimateSpeechRateWpm('a b c d e f g h i j', 30)).toBe(20);
  });

  it('maps loud PCM relative to quiet frames toward closer estimate', () => {
    const quiet = new Float32Array(4096);
    const loud = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      quiet[i] = (Math.random() - 0.5) * 0.01;
      loud[i] = Math.sin(i / 10) * 0.5;
    }
    const mixed = new Float32Array(8192);
    mixed.set(quiet, 0);
    mixed.set(loud, 4096);
    const estimate = estimateDistanceFromPcm(mixed, 1024);
    expect(estimate).toBeGreaterThan(0.2);
    expect(estimate).toBeLessThanOrEqual(1);
  });
});
