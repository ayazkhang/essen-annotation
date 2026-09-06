import type { AnnotationItem, AnnotationSpan } from '@prisma/client';

export interface ExportLine {
  audio: {
    filename: string;
    storagePath: string | null;
    durationSeconds: number | null;
  };
  originalTranscript: string | null;
  correctedTranscript: string | null;
  spans: Array<{
    id: string;
    type: string;
    startOffset: number;
    endOffset: number;
    text: string;
    attributes: unknown;
  }>;
  recordingConditions: {
    sampleRate: number | null;
    channels: number | null;
    bitDepth: number | null;
    headerMetadata: unknown;
    speechRateWpm: number | null;
    speechRateWpmSuggested: number | null;
    distanceEstimate: number | null;
    distanceEstimateSuggested: number | null;
    distanceEstimateMethod: string;
  };
  status: string;
  annotator: string | null;
  exportedAt: string;
}

export function toExportLine(
  item: AnnotationItem & { spans: AnnotationSpan[] },
): ExportLine {
  const corrected = item.correctedTranscript ?? '';
  return {
    audio: {
      filename: item.filename,
      storagePath: item.storagePath,
      durationSeconds: item.durationSeconds,
    },
    originalTranscript: item.originalTranscript,
    correctedTranscript: item.correctedTranscript,
    spans: item.spans.map((s) => ({
      id: s.id,
      type: s.type,
      startOffset: s.startOffset,
      endOffset: s.endOffset,
      text: corrected.slice(s.startOffset, s.endOffset),
      attributes: s.attributes,
    })),
    recordingConditions: {
      sampleRate: item.sampleRate,
      channels: item.channels,
      bitDepth: item.bitDepth,
      headerMetadata: item.headerMetadata,
      speechRateWpm: item.speechRateWpmOverride ?? item.speechRateWpmSuggested,
      speechRateWpmSuggested: item.speechRateWpmSuggested,
      distanceEstimate: item.distanceEstimateOverride ?? item.distanceEstimateSuggested,
      distanceEstimateSuggested: item.distanceEstimateSuggested,
      distanceEstimateMethod:
        'rms_vs_noise_floor_proxy_v1 (WAV PCM) or bitrate_density_fallback (compressed)',
    },
    status: item.status,
    annotator: item.annotator,
    exportedAt: new Date().toISOString(),
  };
}

export function toJsonl(items: Array<AnnotationItem & { spans: AnnotationSpan[] }>): string {
  return items.map((item) => JSON.stringify(toExportLine(item))).join('\n') + (items.length ? '\n' : '');
}
