<script setup lang="ts">
import { ref } from 'vue';
import type { AnnotationSpan } from '../api';
import { useTranscriptEditor } from './useTranscriptEditor';

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

const showOriginal = ref(false);

const {
  editMode,
  draft,
  tokens,
  classesForOffset,
  onWordClick,
  onSelect,
  startEdit,
  saveEdit,
  cancelEdit,
} = useTranscriptEditor(props, emit);

defineExpose({ tokens });
</script>

<template>
  <div class="editor panel">
    <div class="bar">
      <h2>Transcript</h2>
      <div class="actions">
        <button v-if="!editMode" type="button" @click="startEdit">Edit corrected (CRUD)</button>
        <template v-else>
          <button type="button" class="primary" @click="saveEdit">Save correction</button>
          <button type="button" @click="cancelEdit">Cancel</button>
        </template>
      </div>
    </div>

    <details class="orig" :open="showOriginal" @toggle="showOriginal = ($event.target as HTMLDetailsElement).open">
      <summary>Original (immutable)</summary>
      <p class="mono locked">{{ original || '—' }}</p>
    </details>

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
            @click.stop="onWordClick(tok.index)"
          >{{ tok.text }}</span><span v-if="i < tokens.length - 1"> </span>
        </template>
        <p v-if="tokens.length === 0" class="muted">Empty transcript</p>
      </div>
      <p class="hint muted">
        Click a word to seek · select text to create a span · overlaps allowed
      </p>
    </div>
  </div>
</template>
