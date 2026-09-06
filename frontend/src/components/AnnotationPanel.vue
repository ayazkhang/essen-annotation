<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { AnnotationSpan, SpanType } from '../api';

const props = defineProps<{
  spans: AnnotationSpan[];
  selection: { start: number; end: number; text: string } | null;
  transcript: string;
}>();

const emit = defineEmits<{
  create: [payload: { type: SpanType; startOffset: number; endOffset: number; attributes: Record<string, unknown> }];
  update: [payload: { id: string; type: SpanType; startOffset: number; endOffset: number; attributes: Record<string, unknown> }];
  remove: [id: string];
}>();

const type = ref<SpanType>('MEDICAL_TERM');
const editingId = ref<string | null>(null);

const form = reactive<Record<string, unknown>>({
  rendering: 'words',
  normalizedValue: '',
  command: 'newline',
  isCommand: true,
  resolvedWord: '',
  entityType: 'human_name',
  category: 'drug',
  note: '',
  value: 0,
  unit: 'mg',
});

watch(
  () => props.selection,
  () => {
    editingId.value = null;
  },
);

const types: SpanType[] = [
  'NUMBER',
  'FORMATTING_COMMAND',
  'SPELLED_OUT',
  'NAMED_ENTITY',
  'MEDICAL_TERM',
  'MEASUREMENT',
];

function attributesForType(t: SpanType): Record<string, unknown> {
  switch (t) {
    case 'NUMBER':
      return {
        rendering: form.rendering,
        normalizedValue:
          typeof form.normalizedValue === 'string' && /^-?\d+(\.\d+)?$/.test(form.normalizedValue)
            ? Number(form.normalizedValue)
            : form.normalizedValue,
      };
    case 'FORMATTING_COMMAND':
      return { command: form.command, isCommand: Boolean(form.isCommand) };
    case 'SPELLED_OUT':
      return { resolvedWord: form.resolvedWord };
    case 'NAMED_ENTITY':
      return { entityType: form.entityType };
    case 'MEDICAL_TERM':
      return { category: form.category, note: form.note || '' };
    case 'MEASUREMENT':
      return { value: Number(form.value), unit: form.unit };
  }
}

function loadSpan(span: AnnotationSpan) {
  editingId.value = span.id;
  type.value = span.type;
  const a = span.attributes;
  Object.assign(form, {
    rendering: a.rendering ?? 'words',
    normalizedValue: a.normalizedValue ?? '',
    command: a.command ?? 'newline',
    isCommand: a.isCommand ?? true,
    resolvedWord: a.resolvedWord ?? '',
    entityType: a.entityType ?? 'human_name',
    category: a.category ?? 'drug',
    note: a.note ?? '',
    value: a.value ?? 0,
    unit: a.unit ?? 'mg',
  });
}

function submit() {
  if (!props.selection && !editingId.value) return;
  const attrs = attributesForType(type.value);
  if (editingId.value) {
    const existing = props.spans.find((s) => s.id === editingId.value);
    if (!existing) return;
    emit('update', {
      id: editingId.value,
      type: type.value,
      startOffset: existing.startOffset,
      endOffset: existing.endOffset,
      attributes: attrs,
    });
  } else if (props.selection) {
    emit('create', {
      type: type.value,
      startOffset: props.selection.start,
      endOffset: props.selection.end,
      attributes: attrs,
    });
  }
}

const selectionLabel = computed(() => {
  if (editingId.value) {
    const s = props.spans.find((x) => x.id === editingId.value);
    return s ? props.transcript.slice(s.startOffset, s.endOffset) : '';
  }
  return props.selection?.text ?? '';
});
</script>

<template>
  <div class="panel">
    <h2>Annotations</h2>
    <p class="muted small">
      Select text in the corrected transcript, choose a type, fill attributes, save.
      CRUD token fixes belong in the transcript editor.
    </p>

    <div v-if="selectionLabel" class="sel mono">“{{ selectionLabel }}”</div>
    <p v-else class="muted small">No selection</p>

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
          <option
            v-for="c in ['newline','paragraph','period','comma','colon','dash','bracket_open','bracket_close']"
            :key="c"
            :value="c"
          >
            {{ c }}
          </option>
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
          <option v-for="c in ['anatomy','procedure','diagnosis','drug','device']" :key="c" :value="c">
            {{ c }}
          </option>
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
          <option
            v-for="u in ['g','mg','ug','kg','ml','l','mmHg','IE','mm','cm','Ch']"
            :key="u"
            :value="u"
          >
            {{ u }}
          </option>
        </select>
      </label>
    </div>

    <button
      type="button"
      class="primary"
      :disabled="!selectionLabel"
      @click="submit"
    >
      {{ editingId ? 'Update span' : 'Create span' }}
    </button>

    <ul class="list">
      <li v-for="span in spans" :key="span.id">
        <div>
          <strong>{{ span.type }}</strong>
          <span class="mono"> {{ transcript.slice(span.startOffset, span.endOffset) }}</span>
          <div class="attrs muted">{{ JSON.stringify(span.attributes) }}</div>
        </div>
        <div class="row-actions">
          <button type="button" @click="loadSpan(span)">Edit</button>
          <button type="button" @click="$emit('remove', span.id)">Delete</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
}

.small {
  font-size: 0.85rem;
}

.sel {
  padding: 0.4rem 0.55rem;
  background: var(--accent-soft);
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.6rem;
}

input,
select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
}

.fields {
  margin-bottom: 0.5rem;
}

.check {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
}

.list li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--line);
  font-size: 0.88rem;
}

.attrs {
  font-size: 0.75rem;
  word-break: break-all;
}

.row-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
