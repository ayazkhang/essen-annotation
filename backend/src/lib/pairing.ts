import path from 'node:path';
import { AUTO_REJECT_MAX_SECONDS } from './constants.js';

export type RoutingStatus = 'AUTO_REJECTED' | 'PENDING';

/**
 * Recordings longer than 15 seconds go to a human annotator.
 * 15 seconds and under are auto-rejected (not worth annotator time).
 */
export function routeByDuration(durationSeconds: number | null | undefined): RoutingStatus | null {
  if (durationSeconds == null || Number.isNaN(durationSeconds)) {
    return null;
  }
  if (durationSeconds <= AUTO_REJECT_MAX_SECONDS) {
    return 'AUTO_REJECTED';
  }
  return 'PENDING';
}

/** Basename used for pairing transcript paths to uploaded files. */
export function normalizeFilename(input: string): string {
  const base = path.basename(input.replace(/\\/g, '/'));
  return base.trim();
}

export interface TranscriptRow {
  path: string;
  label: string;
}

export interface PairingIssue {
  kind:
    | 'malformed_entry'
    | 'missing_fields'
    | 'duplicate_path'
    | 'audio_without_transcript'
    | 'transcript_without_audio';
  message: string;
  path?: string;
  index?: number;
}

export interface ParsedTranscriptUpload {
  rows: TranscriptRow[];
  issues: PairingIssue[];
}

/**
 * Parse and validate the AI transcript JSON array.
 * Keeps good rows; reports every problem without silently dropping context.
 */
export function parseTranscriptJson(raw: unknown): ParsedTranscriptUpload {
  const issues: PairingIssue[] = [];
  const rows: TranscriptRow[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(raw)) {
    issues.push({
      kind: 'malformed_entry',
      message: 'Transcript JSON must be an array of { path, label } objects',
    });
    return { rows, issues };
  }

  raw.forEach((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push({
        kind: 'malformed_entry',
        message: `Entry at index ${index} is not an object`,
        index,
      });
      return;
    }

    const record = entry as Record<string, unknown>;
    const pathValue = record.path;
    const labelValue = record.label;

    if (typeof pathValue !== 'string' || typeof labelValue !== 'string') {
      issues.push({
        kind: 'missing_fields',
        message: `Entry at index ${index} must have string fields "path" and "label"`,
        index,
        path: typeof pathValue === 'string' ? pathValue : undefined,
      });
      return;
    }

    if (!pathValue.trim() || !labelValue.trim()) {
      issues.push({
        kind: 'missing_fields',
        message: `Entry at index ${index} has empty path or label`,
        index,
        path: pathValue,
      });
      return;
    }

    const filename = normalizeFilename(pathValue);
    if (seen.has(filename)) {
      issues.push({
        kind: 'duplicate_path',
        message: `Duplicate path "${filename}" (from "${pathValue}")`,
        path: filename,
        index,
      });
      return;
    }

    seen.add(filename);
    rows.push({ path: filename, label: labelValue });
  });

  return { rows, issues };
}

export interface PairingResult {
  matched: Array<{ filename: string; label: string }>;
  unmatchedAudio: string[];
  unmatchedTranscripts: Array<{ filename: string; label: string }>;
  issues: PairingIssue[];
}

/**
 * Match transcript rows to audio filenames by basename.
 * Does not silently drop either side.
 */
export function pairTranscriptsToAudio(
  audioFilenames: string[],
  transcriptRows: TranscriptRow[],
): PairingResult {
  const audioSet = new Map(audioFilenames.map((f) => [normalizeFilename(f), f]));
  const matched: Array<{ filename: string; label: string }> = [];
  const unmatchedTranscripts: Array<{ filename: string; label: string }> = [];
  const issues: PairingIssue[] = [];
  const matchedAudio = new Set<string>();

  for (const row of transcriptRows) {
    const key = normalizeFilename(row.path);
    if (audioSet.has(key)) {
      matched.push({ filename: key, label: row.label });
      matchedAudio.add(key);
    } else {
      unmatchedTranscripts.push({ filename: key, label: row.label });
      issues.push({
        kind: 'transcript_without_audio',
        message: `Transcript for "${key}" has no matching audio file`,
        path: key,
      });
    }
  }

  const unmatchedAudio: string[] = [];
  for (const [key] of audioSet) {
    if (!matchedAudio.has(key)) {
      unmatchedAudio.push(key);
      issues.push({
        kind: 'audio_without_transcript',
        message: `Audio file "${key}" has no matching transcript`,
        path: key,
      });
    }
  }

  return { matched, unmatchedAudio, unmatchedTranscripts, issues };
}
