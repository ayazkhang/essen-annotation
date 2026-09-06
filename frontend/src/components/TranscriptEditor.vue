<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AnnotationSpan, SpanType } from '../api';

const props = defineProps<{
  original: string;
  corrected: string;
  spans: AnnotationSpan[];
}>();

const emit = defineEmits<{
  'update:corrected': [value: string];
  wordClick: [tokenIndex: number];
  selection: [payload: { start: number; end: number; text: string }];
}>();

const editMode = ref(false);
const draft = ref(props.corrected);

watch(
  () => props.corrected,
  (v) => {
    if (!editMode.value) draft.value = v;
  },
);

const tokens = computed(() => {
  const text = props.corrected;
  const result: Array<{ text: string; start: number; end: number; index: number }> = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text)) !== null) {
    result.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      index: index++,
    });
  }
  return result;
});

const spanClass: Record<SpanType, string> = {
  NUMBER: 'span-number',
  FORMATTING_COMMAND: 'span-format',
  SPELLED_OUT: 'span-spell',
  NAMED_ENTITY: 'span-entity',
  MEDICAL_TERM: 'span-medical',
  MEASUREMENT: 'span-measure',
};

function classesForOffset(start: number, end: number): string[] {
  const classes: string[] = [];
  for (const span of props.spans) {
    // Overlap with token
    if (span.startOffset < end && span.endOffset > start) {
      classes.push(spanClass[span.type]);
    }
  }
  return classes;
}

function onSelect() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const root = document.getElementById('transcript-view');
  if (!root || !root.contains(range.commonAncestorContainer)) return;

  // Map DOM selection back to character offsets via token data attributes
  const startEl = (range.startContainer.nodeType === Node.TEXT_NODE
    ? range.startContainer.parentElement
    : range.startContainer) as HTMLElement | null;
  const endEl = (range.endContainer.nodeType === Node.TEXT_NODE
    ? range.endContainer.parentElement
    : range.endContainer) as HTMLElement | null;

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

function saveEdit() {
  emit('update:corrected', draft.value);
  editMode.value = false;
}

function cancelEdit() {
  draft.value = props.corrected;
  editMode.value = false;
}

defineExpose({ tokens });
</script>

<template>
  <div class="editor panel">
    <div class="bar">
      <h2>Transcript</h2>
      <div class="actions">
        <button v-if="!editMode" type="button" @click="editMode = true">Edit corrected (CRUD)</button>
        <template v-else>
          <button type="button" class="primary" @click="saveEdit">Save correction</button>
          <button type="button" @click="cancelEdit">Cancel</button>
        </template>
      </div>
    </div>

    <div class="orig">
      <h3>Original (immutable)</h3>
      <p class="mono locked">{{ original }}</p>
    </div>

    <div class="corr">
      <h3>Corrected</h3>
      <textarea v-if="editMode" v-model="draft" rows="5" class="mono" />
      <div
        v-else
        id="transcript-view"
        class="tokens mono"
        @mouseup="onSelect"
      >
        <template v-for="(tok, i) in tokens" :key="`${tok.start}-${tok.text}`">
          <span
            class="token"
            :class="classesForOffset(tok.start, tok.end)"
            :data-start="tok.start"
            :data-end="tok.end"
            :data-index="tok.index"
            @click.stop="$emit('wordClick', tok.index)"
            >{{ tok.text }}</span
          ><span v-if="i < tokens.length - 1"> </span>
        </template>
        <p v-if="tokens.length === 0" class="muted">Empty transcript</p>
      </div>
      <p class="hint muted">
        Click a word to seek audio. Select text, then create a span in the panel on the right.
        Overlapping spans are allowed.
      </p>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

h2,
h3 {
  margin: 0;
}

h2 {
  font-size: 1.1rem;
}

h3 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 0.35rem;
}

.actions {
  display: flex;
  gap: 0.4rem;
}

.orig {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed var(--line);
}

.locked {
  margin: 0;
  padding: 0.6rem 0.75rem;
  background: var(--bg-deep);
  border-radius: 6px;
  white-space: pre-wrap;
  line-height: 1.5;
}

.tokens {
  line-height: 1.85;
  white-space: pre-wrap;
}

.token {
  cursor: pointer;
  border-radius: 3px;
  padding: 0.05rem 0.1rem;
}

.token:hover {
  outline: 1px solid var(--accent);
}

.token.span-number { background: var(--span-number); }
.token.span-format { background: var(--span-format); }
.token.span-spell { background: var(--span-spell); }
.token.span-entity { background: var(--span-entity); }
.token.span-medical { background: var(--span-medical); }
.token.span-measure { background: var(--span-measure); }

textarea {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.hint {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
}
</style>
