import { computed, reactive, ref, watch } from 'vue';
import type { AnnotationSpan, SpanType } from '../api';

export const SPAN_TYPES: SpanType[] = [
  'NUMBER',
  'FORMATTING_COMMAND',
  'SPELLED_OUT',
  'NAMED_ENTITY',
  'MEDICAL_TERM',
  'MEASUREMENT',
];

export const FORMATTING_COMMANDS = [
  'newline',
  'paragraph',
  'period',
  'comma',
  'colon',
  'dash',
  'bracket_open',
  'bracket_close',
] as const;

export const MEDICAL_CATEGORIES = [
  'anatomy',
  'procedure',
  'diagnosis',
  'drug',
  'device',
] as const;

export const MEASUREMENT_UNITS = [
  'g',
  'mg',
  'ug',
  'kg',
  'ml',
  'l',
  'mmHg',
  'IE',
  'mm',
  'cm',
  'Ch',
] as const;

export function useAnnotationPanel(
  props: {
    spans: AnnotationSpan[];
    selection: { start: number; end: number; text: string } | null;
    transcript: string;
  },
  emit: {
    (
      e: 'create',
      payload: {
        type: SpanType;
        startOffset: number;
        endOffset: number;
        attributes: Record<string, unknown>;
      },
    ): void;
    (
      e: 'update',
      payload: {
        id: string;
        type: SpanType;
        startOffset: number;
        endOffset: number;
        attributes: Record<string, unknown>;
      },
    ): void;
    (e: 'remove', id: string): void;
  },
) {
  const type = ref<SpanType>('MEDICAL_TERM');
  const editingId = ref<string | null>(null);

  const form = reactive({
    rendering: 'words' as 'digits' | 'words',
    normalizedValue: '' as string | number,
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
      rendering: (a.rendering as 'digits' | 'words') ?? 'words',
      normalizedValue: (a.normalizedValue as string | number) ?? '',
      command: (a.command as string) ?? 'newline',
      isCommand: (a.isCommand as boolean) ?? true,
      resolvedWord: (a.resolvedWord as string) ?? '',
      entityType: (a.entityType as string) ?? 'human_name',
      category: (a.category as string) ?? 'drug',
      note: (a.note as string) ?? '',
      value: (a.value as number) ?? 0,
      unit: (a.unit as string) ?? 'mg',
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

  function removeSpan(id: string) {
    emit('remove', id);
  }

  function spanText(span: AnnotationSpan): string {
    return props.transcript.slice(span.startOffset, span.endOffset);
  }

  function formatAttrs(attrs: Record<string, unknown>): string {
    return Object.entries(attrs)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(' · ');
  }

  function cancelEdit() {
    editingId.value = null;
  }

  const selectionLabel = computed(() => {
    if (editingId.value) {
      const s = props.spans.find((x) => x.id === editingId.value);
      return s ? props.transcript.slice(s.startOffset, s.endOffset) : '';
    }
    return props.selection?.text ?? '';
  });

  return {
    type,
    editingId,
    form,
    types: SPAN_TYPES,
    formattingCommands: FORMATTING_COMMANDS,
    medicalCategories: MEDICAL_CATEGORIES,
    measurementUnits: MEASUREMENT_UNITS,
    selectionLabel,
    loadSpan,
    cancelEdit,
    submit,
    removeSpan,
    spanText,
    formatAttrs,
  };
}
