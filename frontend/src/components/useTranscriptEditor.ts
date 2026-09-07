import { computed, ref, watch } from 'vue';
import type { AnnotationSpan, SpanType } from '../api';
import { tokenizeTranscript } from '../lib/tokenize';

const spanClass: Record<SpanType, string> = {
  NUMBER: 'span-number',
  FORMATTING_COMMAND: 'span-format',
  SPELLED_OUT: 'span-spell',
  NAMED_ENTITY: 'span-entity',
  MEDICAL_TERM: 'span-medical',
  MEASUREMENT: 'span-measure',
};

export function useTranscriptEditor(
  props: {
    original: string;
    corrected: string;
    spans: AnnotationSpan[];
  },
  emit: {
    (e: 'update:corrected', value: string): void;
    (e: 'wordClick', tokenIndex: number): void;
    (e: 'selection', payload: { start: number; end: number; text: string }): void;
  },
) {
  const editMode = ref(false);
  const draft = ref(props.corrected);

  watch(
    () => props.corrected,
    (v) => {
      if (!editMode.value) draft.value = v;
    },
  );

  const tokens = computed(() => tokenizeTranscript(props.corrected));

  function classesForOffset(start: number, end: number): string[] {
    const classes: string[] = [];
    for (const span of props.spans) {
      if (span.startOffset < end && span.endOffset > start) {
        classes.push(spanClass[span.type]);
      }
    }
    return classes;
  }

  function onWordClick(index: number) {
    emit('wordClick', index);
  }

  function onSelect() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const root = document.getElementById('transcript-view');
    if (!root || !root.contains(range.commonAncestorContainer)) return;

    const startEl = (
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer
    ) as HTMLElement | null;
    const endEl = (
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement
        : range.endContainer
    ) as HTMLElement | null;

    const startToken = startEl?.closest('[data-start]') as HTMLElement | null;
    const endToken = endEl?.closest('[data-start]') as HTMLElement | null;
    if (!startToken || !endToken) return;

    const start = Math.min(Number(startToken.dataset.start), Number(endToken.dataset.start));
    const end = Math.max(Number(startToken.dataset.end), Number(endToken.dataset.end));
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) return;

    emit('selection', {
      start,
      end,
      text: props.corrected.slice(start, end),
    });
  }

  function startEdit() {
    editMode.value = true;
  }

  function saveEdit() {
    emit('update:corrected', draft.value);
    editMode.value = false;
  }

  function cancelEdit() {
    draft.value = props.corrected;
    editMode.value = false;
  }

  return {
    editMode,
    draft,
    tokens,
    classesForOffset,
    onWordClick,
    onSelect,
    startEdit,
    saveEdit,
    cancelEdit,
  };
}
