import type { ItemStatus, SpanType } from '@prisma/client';
import type { JsonObject, JsonValue } from './json.js';
import type { SpanAttributes } from '../lib/spans.js';

export type UnpairDrop = 'audio' | 'transcript';

export interface UpdateItemBody {
  correctedTranscript?: string;
  status?: ItemStatus | string;
  annotator?: string;
  speechRateWpmOverride?: number | null;
  distanceEstimateOverride?: number | null;
}

export interface SpanBody {
  type: SpanType;
  startOffset: number;
  endOffset: number;
  attributes: SpanAttributes | JsonObject;
}

export interface UpdateSpanBody {
  type?: SpanType;
  startOffset?: number;
  endOffset?: number;
  attributes?: SpanAttributes | JsonObject;
}

export interface SingleTranscriptBody {
  path: string;
  label: string;
}

export interface ManualPairBody {
  audioItemId: string;
  transcriptItemId: string;
}

export interface UnpairBody {
  itemId: string;
  drop: UnpairDrop;
}

/** Incoming transcript upload: raw array, or `{ transcripts }` / `{ json }` wrappers. */
export type TranscriptUploadBody =
  | JsonValue
  | { json: string }
  | { transcripts: JsonValue };
