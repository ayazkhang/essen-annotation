<script setup lang="ts">
import type { AnnotationSpan } from '../api';
import { useAnnotationPanel } from './useAnnotationPanel';

const props = defineProps<{
  spans: AnnotationSpan[];
  selection: { start: number; end: number; text: string } | null;
  transcript: string;
}>();

const emit = defineEmits<{
  create: [
    payload: {
      type: import('../api').SpanType;
      startOffset: number;
      endOffset: number;
      attributes: Record<string, unknown>;
    },
  ];
  update: [
    payload: {
      id: string;
      type: import('../api').SpanType;
      startOffset: number;
      endOffset: number;
      attributes: Record<string, unknown>;
    },
  ];
  remove: [id: string];
}>();

const {
  type,
  editingId,
  form,
  types,
  formattingCommands,
  medicalCategories,
  measurementUnits,
  selectionLabel,
  loadSpan,
  cancelEdit,
  submit,
  removeSpan,
  spanText,
  formatAttrs,
} = useAnnotationPanel(props, emit);
</script>

<template>
  <div class="annotation-panel panel">
    <h2>Annotations</h2>
    <p class="muted small">
      Select text → type + attributes → save. Token CRUD is in the transcript editor.
    </p>

    <div class="form-block">
    <div v-if="selectionLabel" class="sel mono">“{{ selectionLabel }}”</div>
    <p v-else class="muted small">No selection</p>
    <p v-if="editingId" class="muted small editing-banner">Editing existing span</p>

    <label>
      Type
      <select v-model="type">
        <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>

    <div v-if="type === 'NUMBER'" class="fields">
      <label>
        Rendering
        <select v-model="form.rendering">
          <option value="digits">digits</option>
          <option value="words">words</option>
        </select>
      </label>
      <label>
        Normalized value
        <input v-model="form.normalizedValue" placeholder="12 or 6/0" />
      </label>
    </div>

    <div v-else-if="type === 'FORMATTING_COMMAND'" class="fields">
      <label>
        Command
        <select v-model="form.command">
          <option v-for="c in formattingCommands" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="check">
        <input v-model="form.isCommand" type="checkbox" />
        Phrase is a command (not literal speech)
      </label>
    </div>

    <div v-else-if="type === 'SPELLED_OUT'" class="fields">
      <label>
        Resolved word
        <input v-model="form.resolvedWord" placeholder="Cefuroxim" />
      </label>
    </div>

    <div v-else-if="type === 'NAMED_ENTITY'" class="fields">
      <label>
        Entity type
        <select v-model="form.entityType">
          <option value="human_name">human names</option>
          <option value="organisation">organisation</option>
          <option value="place">place</option>
          <option value="date">date</option>
        </select>
      </label>
    </div>

    <div v-else-if="type === 'MEDICAL_TERM'" class="fields">
      <label>
        Category
        <select v-model="form.category">
          <option v-for="c in medicalCategories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label>
        Note
        <input v-model="form.note" />
      </label>
    </div>

    <div v-else-if="type === 'MEASUREMENT'" class="fields">
      <label>
        Value
        <input v-model.number="form.value" type="number" step="any" />
      </label>
      <label>
        Unit
        <select v-model="form.unit">
          <option v-for="u in measurementUnits" :key="u" :value="u">{{ u }}</option>
        </select>
      </label>
    </div>

    <div class="form-actions">
      <button type="button" class="primary" :disabled="!selectionLabel" @click="submit">
        {{ editingId ? 'Update span' : 'Create span' }}
      </button>
      <button v-if="editingId" type="button" @click="cancelEdit">Cancel</button>
    </div>
    </div>

    <h3 class="list-title">Spans ({{ spans.length }})</h3>
    <p v-if="spans.length === 0" class="muted small empty-spans">No spans yet.</p>
    <ul class="list">
      <li v-for="span in spans" :key="span.id" :class="{ active: editingId === span.id }">
        <div class="span-body">
          <div class="span-head">
            <strong>{{ span.type }}</strong>
            <span class="mono span-text">{{ spanText(span) }}</span>
          </div>
          <div class="attrs muted">{{ formatAttrs(span.attributes) }}</div>
        </div>
        <div class="row-actions">
          <button type="button" @click="loadSpan(span)">Edit</button>
          <button type="button" @click="removeSpan(span.id)">Delete</button>
        </div>
      </li>
    </ul>
  </div>
</template>
