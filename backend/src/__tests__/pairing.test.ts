import { describe, expect, it } from 'vitest';
import {
  normalizeFilename,
  pairTranscriptsToAudio,
  parseTranscriptJson,
} from '../lib/pairing';

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
