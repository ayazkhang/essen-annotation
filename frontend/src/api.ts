export type ItemStatus =
  | 'UNPAIRED'
  | 'AUTO_REJECTED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export type SpanType =
  | 'NUMBER'
  | 'FORMATTING_COMMAND'
  | 'SPELLED_OUT'
  | 'NAMED_ENTITY'
  | 'MEDICAL_TERM'
  | 'MEASUREMENT';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type SpanAttributeMap = Record<string, string | number | boolean>;

export interface AnnotationSpan {
  id: string;
  itemId: string;
  type: SpanType;
  startOffset: number;
  endOffset: number;
  attributes: SpanAttributeMap;
}

export interface AnnotationItem {
  id: string;
  filename: string;
  storagePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  durationSeconds: number | null;
  sampleRate: number | null;
  channels: number | null;
  bitDepth: number | null;
  headerMetadata: JsonObject | null;
  status: ItemStatus;
  annotator: string | null;
  originalTranscript: string | null;
  correctedTranscript: string | null;
  speechRateWpmSuggested: number | null;
  speechRateWpmOverride: number | null;
  distanceEstimateSuggested: number | null;
  distanceEstimateOverride: number | null;
  createdAt: string;
  updatedAt: string;
  spans?: AnnotationSpan[];
  _count?: { spans: number };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listItems(params: { status?: string; sort?: string; order?: string } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.sort) q.set('sort', params.sort);
    if (params.order) q.set('order', params.order);
    const qs = q.toString();
    return request<{ items: AnnotationItem[] }>(`/api/items${qs ? `?${qs}` : ''}`);
  },

  getItem(id: string) {
    return request<{ item: AnnotationItem }>(`/api/items/${id}`);
  },

  updateItem(
    id: string,
    body: {
      correctedTranscript?: string;
      status?: ItemStatus;
      annotator?: string;
      speechRateWpmOverride?: number | null;
      distanceEstimateOverride?: number | null;
    },
  ) {
    return request<{ item: AnnotationItem }>(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  createSpan(
    id: string,
    body: {
      type: SpanType;
      startOffset: number;
      endOffset: number;
      attributes: SpanAttributeMap;
    },
  ) {
    return request<{ span: AnnotationSpan }>(`/api/items/${id}/spans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  updateSpan(
    id: string,
    spanId: string,
    body: {
      type?: SpanType;
      startOffset?: number;
      endOffset?: number;
      attributes?: SpanAttributeMap;
    },
  ) {
    return request<{ span: AnnotationSpan }>(`/api/items/${id}/spans/${spanId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  deleteSpan(id: string, spanId: string) {
    return request<void>(`/api/items/${id}/spans/${spanId}`, { method: 'DELETE' });
  },

  uploadAudio(files: FileList | File[]) {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('files', f));
    return request<{ items: AnnotationItem[]; issues: Array<{ filename: string; message: string }> }>(
      '/api/ingest/audio',
      { method: 'POST', body: form },
    );
  },

  uploadTranscripts(payload: JsonValue) {
    return request<{
      items: AnnotationItem[];
      issues: Array<{ kind: string; message: string; path?: string }>;
    }>('/api/ingest/transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  pasteTranscript(path: string, label: string) {
    return request<{ item: AnnotationItem }>('/api/ingest/transcripts/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, label }),
    });
  },

  getPairing() {
    return request<{
      paired: Array<{ id: string; filename: string; status: string }>;
      unmatchedAudio: Array<{ id: string; filename: string }>;
      unmatchedTranscripts: Array<{ id: string; filename: string; label: string | null }>;
    }>('/api/ingest/pairing');
  },

  manualPair(audioItemId: string, transcriptItemId: string) {
    return request<{ item: AnnotationItem }>('/api/ingest/pairing/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioItemId, transcriptItemId }),
    });
  },

  unpair(itemId: string, drop: 'audio' | 'transcript') {
    return request<{ item?: AnnotationItem; deleted?: boolean }>('/api/ingest/pairing/unpair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, drop }),
    });
  },

  exportUrl(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return `/api/items/export.jsonl${q}`;
  },

  audioUrl(id: string) {
    return `/api/items/${id}/audio`;
  },
};

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
