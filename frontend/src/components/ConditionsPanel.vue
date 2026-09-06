<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AnnotationItem } from '../api';

const props = defineProps<{ item: AnnotationItem }>();
const emit = defineEmits<{
  save: [payload: { speechRateWpmOverride: number | null; distanceEstimateOverride: number | null }];
}>();

const speechOverride = ref<string>('');
const distanceOverride = ref<string>('');

watch(
  () => props.item.id,
  () => {
    speechOverride.value =
      props.item.speechRateWpmOverride != null ? String(props.item.speechRateWpmOverride) : '';
    distanceOverride.value =
      props.item.distanceEstimateOverride != null
        ? String(props.item.distanceEstimateOverride)
        : '';
  },
  { immediate: true },
);

const headerEntries = computed(() => {
  const meta = props.item.headerMetadata;
  if (!meta) return [];
  return Object.entries(meta).slice(0, 12);
});

function save() {
  emit('save', {
    speechRateWpmOverride: speechOverride.value === '' ? null : Number(speechOverride.value),
    distanceEstimateOverride:
      distanceOverride.value === '' ? null : Number(distanceOverride.value),
  });
}
</script>

<template>
  <div class="panel">
    <h2>Recording conditions</h2>

    <dl class="meta">
      <div><dt>Duration</dt><dd>{{ item.durationSeconds?.toFixed(2) ?? '—' }} s</dd></div>
      <div><dt>Sample rate</dt><dd>{{ item.sampleRate ?? '—' }} Hz</dd></div>
      <div><dt>Channels</dt><dd>{{ item.channels ?? '—' }}</dd></div>
      <div><dt>Bit depth</dt><dd>{{ item.bitDepth ?? '—' }}</dd></div>
    </dl>

    <details v-if="headerEntries.length" class="hdr">
      <summary>Header / tag metadata</summary>
      <pre class="mono">{{ JSON.stringify(item.headerMetadata, null, 2) }}</pre>
    </details>

    <div class="derived">
      <label>
        Speech rate (WPM)
        <span class="muted sug">
          suggested {{ item.speechRateWpmSuggested?.toFixed(1) ?? '—' }}
          (tokens ÷ duration × 60)
        </span>
        <input v-model="speechOverride" type="number" step="0.1" placeholder="Override or leave blank" />
      </label>

      <label>
        Distance estimate (0 far → 1 close)
        <span class="muted sug">
          suggested {{ item.distanceEstimateSuggested?.toFixed(3) ?? '—' }}
          — proxy from RMS vs noise floor (WAV) or bitrate density (compressed). Not a metre measurement.
        </span>
        <input
          v-model="distanceOverride"
          type="number"
          min="0"
          max="1"
          step="0.01"
          placeholder="Override or leave blank"
        />
      </label>

      <button type="button" class="primary" @click="save">Save overrides</button>
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
  margin: 0 0 0.75rem;
}

.meta div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.9rem;
  border-bottom: 1px solid var(--line);
  padding-bottom: 0.25rem;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
  font-family: var(--mono);
}

.hdr pre {
  max-height: 160px;
  overflow: auto;
  font-size: 0.75rem;
  background: var(--bg-deep);
  padding: 0.5rem;
  border-radius: 6px;
}

.derived label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}

.sug {
  font-size: 0.78rem;
}

input {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: 6px;
}
</style>
