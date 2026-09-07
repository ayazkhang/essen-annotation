<script setup lang="ts">
import type { AnnotationItem } from '../api';
import { useConditionsPanel } from './useConditionsPanel';

const props = defineProps<{ item: AnnotationItem }>();

const emit = defineEmits<{
  save: [
    payload: {
      speechRateWpmOverride: number | null;
      distanceEstimateOverride: number | null;
    },
  ];
}>();

const { speechOverride, distanceOverride, headerEntries, save } = useConditionsPanel(props, emit);
</script>

<template>
  <div class="conditions-panel panel">
    <h2>Recording conditions</h2>

    <dl class="meta">
      <div>
        <dt>Duration</dt>
        <dd>{{ item.durationSeconds?.toFixed(2) ?? '—' }} s</dd>
      </div>
      <div>
        <dt>Sample rate</dt>
        <dd>{{ item.sampleRate ?? '—' }} Hz</dd>
      </div>
      <div>
        <dt>Channels</dt>
        <dd>{{ item.channels ?? '—' }}</dd>
      </div>
      <div>
        <dt>Bit depth</dt>
        <dd>{{ item.bitDepth ?? '—' }}</dd>
      </div>
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
        <input
          v-model="speechOverride"
          type="number"
          step="0.1"
          placeholder="Override or leave blank"
        />
      </label>

      <label>
        Distance estimate (0 far → 1 close)
        <span class="muted sug">
          suggested {{ item.distanceEstimateSuggested?.toFixed(3) ?? '—' }}
          — proxy from RMS vs noise floor (WAV) or bitrate density (compressed). Not a metre
          measurement.
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
