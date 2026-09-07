import { computed, onMounted, ref, type Ref } from 'vue';
import {
  api,
  type AnnotationItem,
  type AnnotationSpan,
  type SpanType,
} from '../api';
import type TranscriptEditor from '../components/TranscriptEditor.vue';
import { tokenizeTranscript } from '../lib/tokenize';

export function useAnnotateView(itemId: Ref<string>) {
  const item = ref<AnnotationItem | null>(null);
  const error = ref('');
  const saving = ref(false);
  const selection = ref<{ start: number; end: number; text: string } | null>(null);
  const editor = ref<InstanceType<typeof TranscriptEditor> | null>(null);

  // From transcript text — not the editor ref (often empty when seeking).
  const tokens = computed(() =>
    tokenizeTranscript(item.value?.correctedTranscript ?? '').map((t) => t.text),
  );
  const spans = computed<AnnotationSpan[]>(() => item.value?.spans ?? []);
  const audioSrc = computed(() => (item.value ? api.audioUrl(item.value.id) : ''));

  async function load() {
    error.value = '';
    try {
      const res = await api.getItem(itemId.value);
      item.value = res.item;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load item';
    }
  }

  async function saveCorrected(text: string) {
    if (!item.value) return;
    saving.value = true;
    try {
      const res = await api.updateItem(item.value.id, { correctedTranscript: text });
      item.value = res.item;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Save failed';
    } finally {
      saving.value = false;
    }
  }

  async function markComplete() {
    if (!item.value) return;
    const res = await api.updateItem(item.value.id, { status: 'COMPLETED' });
    item.value = res.item;
  }

  async function createSpan(payload: {
    type: SpanType;
    startOffset: number;
    endOffset: number;
    attributes: Record<string, unknown>;
  }) {
    if (!item.value) return;
    try {
      await api.createSpan(item.value.id, payload);
      selection.value = null;
      await load();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Span create failed';
    }
  }

  async function updateSpan(payload: {
    id: string;
    type: SpanType;
    startOffset: number;
    endOffset: number;
    attributes: Record<string, unknown>;
  }) {
    if (!item.value) return;
    try {
      await api.updateSpan(item.value.id, payload.id, payload);
      await load();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Span update failed';
    }
  }

  async function removeSpan(spanId: string) {
    if (!item.value) return;
    await api.deleteSpan(item.value.id, spanId);
    await load();
  }

  async function saveConditions(payload: {
    speechRateWpmOverride: number | null;
    distanceEstimateOverride: number | null;
  }) {
    if (!item.value) return;
    const res = await api.updateItem(item.value.id, payload);
    item.value = res.item;
  }

  function onSelection(payload: { start: number; end: number; text: string }) {
    selection.value = payload;
  }

  onMounted(load);

  return {
    item,
    error,
    saving,
    selection,
    editor,
    tokens,
    spans,
    audioSrc,
    saveCorrected,
    markComplete,
    createSpan,
    updateSpan,
    removeSpan,
    saveConditions,
    onSelection,
  };
}
